import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterEach, describe, expect, it } from 'vitest';
import { seedVault, cleanupVault } from '../tools/helpers.js';

function stringEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function textFrom(result: { content?: Array<{ type: string; text?: string }> }): string {
  const first = result.content?.[0];
  if (!first || first.type !== 'text' || typeof first.text !== 'string') {
    throw new Error('Expected first MCP content item to be text');
  }
  return first.text;
}

describe('MCP stdio smoke test', () => {
  let client: Client | undefined;
  let vaultPath: string | undefined;

  afterEach(async () => {
    await client?.close();
    client = undefined;

    if (vaultPath) {
      await cleanupVault(vaultPath);
      vaultPath = undefined;
    }
  });

  it('lists tools, reads notes, and blocks writes in Codex-safe read-only mode', async () => {
    vaultPath = await fs.mkdtemp(path.join(os.tmpdir(), 'obsidian-mcp-stdio-'));
    await seedVault(vaultPath);

    client = new Client({ name: 'obsidian-mcp-stdio-test', version: '0.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['./node_modules/tsx/dist/cli.mjs', './src/index.ts'],
      cwd: path.resolve('.'),
      env: {
        ...stringEnv(),
        OBSIDIAN_VAULT_PATH: vaultPath,
        OBSIDIAN_READ_ONLY: 'true',
        OBSIDIAN_BACKUP_ENABLED: 'false',
        OBSIDIAN_LOG_LEVEL: 'error',
      },
      stderr: 'pipe',
    });

    await client.connect(transport);

    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);
    expect(toolNames).toEqual(expect.arrayContaining(['list_vaults', 'list_notes', 'read_note', 'create_note']));

    const listNotes = await client.callTool({ name: 'list_notes', arguments: {} });
    const notesPayload = JSON.parse(textFrom(listNotes));
    expect(notesPayload.count).toBeGreaterThan(0);
    expect(notesPayload.notes).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'index.md', name: 'index' })]),
    );

    const readNote = await client.callTool({ name: 'read_note', arguments: { path: 'index' } });
    const readPayload = JSON.parse(textFrom(readNote));
    expect(readPayload).toMatchObject({ vault: 'default', path: 'index.md' });
    expect(readPayload.content).toContain('Welcome to the vault');

    const createNote = await client.callTool({
      name: 'create_note',
      arguments: { path: 'should-not-write', content: 'nope' },
    });
    expect(createNote.isError).toBe(true);
    expect(textFrom(createNote)).toContain('Vault is in read-only mode');
  }, 20_000);
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { registerDeleteNote } from '../../src/tools/delete-note.js';
import { registerCreateNote } from '../../src/tools/create-note.js';
import { createTestVault, cleanupVault, callTool, parseResult } from './helpers.js';
import type { TestContext } from './helpers.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestVault();
  registerCreateNote(ctx.server, ctx.config);
  registerDeleteNote(ctx.server, ctx.config);
});

afterAll(async () => {
  await cleanupVault(ctx.vault);
});

describe('delete_note', () => {
  it('deletes a note', async () => {
    await callTool(ctx.server, 'create_note', { path: 'to-delete', content: '# Delete me' });
    const result = await callTool(ctx.server, 'delete_note', { path: 'to-delete', confirm: true });
    expect(result.isError).toBeFalsy();
    const exists = await fsp
      .access(path.join(ctx.vault, 'to-delete.md'))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it('returns error for non-existent note', async () => {
    const result = await callTool(ctx.server, 'delete_note', { path: 'ghost', confirm: true });
    expect(result.isError).toBe(true);
  });

  it('returns ReadOnlyError in read-only mode', async () => {
    const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const { registerDeleteNote: reg } = await import('../../src/tools/delete-note.js');
    const roServer = new McpServer({ name: 'ro', version: '0' });
    reg(roServer, { ...ctx.config, readOnly: true });
    const result = await callTool(roServer, 'delete_note', { path: 'x', confirm: true });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('read-only');
  });

  it('rejects path traversal', async () => {
    const result = await callTool(ctx.server, 'delete_note', {
      path: '../../../etc/passwd',
      confirm: true,
    });
    expect(result.isError).toBe(true);
  });
});

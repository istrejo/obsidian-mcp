import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { registerMoveNote } from '../../src/tools/move-note.js';
import { registerCreateNote } from '../../src/tools/create-note.js';
import { createTestVault, seedVault, cleanupVault, callTool, parseResult } from './helpers.js';
import type { TestContext } from './helpers.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestVault();
  await seedVault(ctx.vault);
  registerCreateNote(ctx.server, ctx.config);
  registerMoveNote(ctx.server, ctx.config);
});

afterAll(async () => {
  await cleanupVault(ctx.vault);
});

describe('move_note', () => {
  it('moves a note to a new path', async () => {
    await callTool(ctx.server, 'create_note', { path: 'to-move', content: '# Move me' });
    const result = await callTool(ctx.server, 'move_note', {
      fromPath: 'to-move',
      toPath: 'Archive/moved',
    });
    expect(result.isError).toBeFalsy();
    const data = parseResult(result) as { from: string; to: string };
    expect(data.to).toContain('Archive');
    const exists = await fsp
      .access(path.join(ctx.vault, 'Archive/moved.md'))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it('updates backlinks when updateBacklinks is true', async () => {
    await callTool(ctx.server, 'create_note', {
      path: 'source-note',
      content: '# Source\n[[target-note]]',
    });
    await callTool(ctx.server, 'create_note', { path: 'target-note', content: '# Target' });

    const result = await callTool(ctx.server, 'move_note', {
      fromPath: 'target-note',
      toPath: 'renamed-target',
      updateBacklinks: true,
    });
    expect(result.isError).toBeFalsy();
    const data = parseResult(result) as { backlinksUpdated: number };
    expect(data.backlinksUpdated).toBeGreaterThan(0);
  });

  it('rejects path traversal on fromPath', async () => {
    const result = await callTool(ctx.server, 'move_note', {
      fromPath: '../../../etc/passwd',
      toPath: 'safe',
    });
    expect(result.isError).toBe(true);
  });

  it('rejects in read-only mode', async () => {
    const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const { registerMoveNote: reg } = await import('../../src/tools/move-note.js');
    const roServer = new McpServer({ name: 'ro', version: '0' });
    reg(roServer, { ...ctx.config, readOnly: true });
    const result = await callTool(roServer, 'move_note', { fromPath: 'a', toPath: 'b' });
    expect(result.isError).toBe(true);
  });
});

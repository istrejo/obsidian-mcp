import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerManageFolders } from '../../src/tools/manage-folders.js';
import { createTestVault, cleanupVault, callTool, parseResult } from './helpers.js';
import type { TestContext } from './helpers.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestVault();
  registerManageFolders(ctx.server, ctx.config);
});

afterAll(async () => {
  await cleanupVault(ctx.vault);
});

describe('manage_folders', () => {
  it('creates a folder', async () => {
    const result = await callTool(ctx.server, 'manage_folders', {
      operation: 'create',
      path: 'NewFolder',
    });
    expect(result.isError).toBeFalsy();
    const data = parseResult(result) as { created: string };
    expect(data.created).toBe('NewFolder');
  });

  it('creates nested folders', async () => {
    const result = await callTool(ctx.server, 'manage_folders', {
      operation: 'create',
      path: 'Deep/Nested/Folder',
    });
    expect(result.isError).toBeFalsy();
  });

  it('lists subfolders', async () => {
    await callTool(ctx.server, 'manage_folders', { operation: 'create', path: 'Parent/Child1' });
    await callTool(ctx.server, 'manage_folders', { operation: 'create', path: 'Parent/Child2' });
    const result = await callTool(ctx.server, 'manage_folders', {
      operation: 'list',
      path: 'Parent',
    });
    expect(result.isError).toBeFalsy();
    const data = parseResult(result) as { subfolders: string[] };
    expect(data.subfolders.length).toBeGreaterThanOrEqual(2);
  });

  it('deletes an empty folder with confirm', async () => {
    await callTool(ctx.server, 'manage_folders', { operation: 'create', path: 'ToDelete' });
    const result = await callTool(ctx.server, 'manage_folders', {
      operation: 'delete',
      path: 'ToDelete',
      confirm: true,
    });
    expect(result.isError).toBeFalsy();
  });

  it('fails to delete without confirm', async () => {
    await callTool(ctx.server, 'manage_folders', { operation: 'create', path: 'NoConfirm' });
    const result = await callTool(ctx.server, 'manage_folders', {
      operation: 'delete',
      path: 'NoConfirm',
      confirm: false,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('confirm');
  });

  it('rejects path traversal', async () => {
    const result = await callTool(ctx.server, 'manage_folders', {
      operation: 'create',
      path: '../evil',
    });
    expect(result.isError).toBe(true);
  });

  it('rejects in read-only mode', async () => {
    const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const { registerManageFolders: reg } = await import('../../src/tools/manage-folders.js');
    const roServer = new McpServer({ name: 'ro', version: '0' });
    reg(roServer, { ...ctx.config, readOnly: true });
    const result = await callTool(roServer, 'manage_folders', {
      operation: 'create',
      path: 'x',
    });
    expect(result.isError).toBe(true);
  });
});

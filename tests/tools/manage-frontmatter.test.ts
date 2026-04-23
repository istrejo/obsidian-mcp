import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerManageFrontmatter } from '../../src/tools/manage-frontmatter.js';
import { registerCreateNote } from '../../src/tools/create-note.js';
import { createTestVault, cleanupVault, callTool, parseResult } from './helpers.js';
import type { TestContext } from './helpers.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestVault();
  registerCreateNote(ctx.server, ctx.config);
  registerManageFrontmatter(ctx.server, ctx.config);
  await callTool(ctx.server, 'create_note', {
    path: 'fm-note',
    content: '# Body content',
    frontmatter: { title: 'Original', tags: ['a'] },
  });
});

afterAll(async () => {
  await cleanupVault(ctx.vault);
});

describe('manage_frontmatter', () => {
  it('gets frontmatter', async () => {
    const result = await callTool(ctx.server, 'manage_frontmatter', {
      path: 'fm-note',
      operation: 'get',
    });
    expect(result.isError).toBeFalsy();
    const data = parseResult(result) as { frontmatter: Record<string, unknown> };
    expect(data.frontmatter.title).toBe('Original');
  });

  it('sets frontmatter replacing all keys', async () => {
    const result = await callTool(ctx.server, 'manage_frontmatter', {
      path: 'fm-note',
      operation: 'set',
      data: { title: 'New Title', status: 'active' },
    });
    expect(result.isError).toBeFalsy();
    const check = await callTool(ctx.server, 'manage_frontmatter', {
      path: 'fm-note',
      operation: 'get',
    });
    const data = parseResult(check) as { frontmatter: Record<string, unknown> };
    expect(data.frontmatter.title).toBe('New Title');
    expect(data.frontmatter.tags).toBeUndefined();
  });

  it('merges frontmatter', async () => {
    await callTool(ctx.server, 'manage_frontmatter', {
      path: 'fm-note',
      operation: 'set',
      data: { title: 'T', existing: 'keep' },
    });
    const result = await callTool(ctx.server, 'manage_frontmatter', {
      path: 'fm-note',
      operation: 'merge',
      data: { newKey: 'added' },
    });
    expect(result.isError).toBeFalsy();
    const check = await callTool(ctx.server, 'manage_frontmatter', {
      path: 'fm-note',
      operation: 'get',
    });
    const data = parseResult(check) as { frontmatter: Record<string, unknown> };
    expect(data.frontmatter.existing).toBe('keep');
    expect(data.frontmatter.newKey).toBe('added');
  });

  it('deletes specific keys', async () => {
    await callTool(ctx.server, 'manage_frontmatter', {
      path: 'fm-note',
      operation: 'set',
      data: { keep: 'yes', remove: 'yes' },
    });
    const result = await callTool(ctx.server, 'manage_frontmatter', {
      path: 'fm-note',
      operation: 'delete',
      keys: ['remove'],
    });
    expect(result.isError).toBeFalsy();
    const check = await callTool(ctx.server, 'manage_frontmatter', {
      path: 'fm-note',
      operation: 'get',
    });
    const data = parseResult(check) as { frontmatter: Record<string, unknown> };
    expect(data.frontmatter.keep).toBe('yes');
    expect(data.frontmatter.remove).toBeUndefined();
  });

  it('rejects destructive operations in read-only mode', async () => {
    const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const { registerManageFrontmatter: reg } = await import(
      '../../src/tools/manage-frontmatter.js'
    );
    const roServer = new McpServer({ name: 'ro', version: '0' });
    reg(roServer, { ...ctx.config, readOnly: true });
    const result = await callTool(roServer, 'manage_frontmatter', {
      path: 'fm-note',
      operation: 'set',
      data: { x: 1 },
    });
    expect(result.isError).toBe(true);
  });

  it('rejects path traversal', async () => {
    const result = await callTool(ctx.server, 'manage_frontmatter', {
      path: '../../../etc/passwd',
      operation: 'get',
    });
    expect(result.isError).toBe(true);
  });
});

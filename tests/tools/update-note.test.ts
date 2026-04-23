import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { registerUpdateNote } from '../../src/tools/update-note.js';
import { registerCreateNote } from '../../src/tools/create-note.js';
import { createTestVault, cleanupVault, callTool, parseResult } from './helpers.js';
import type { TestContext } from './helpers.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestVault();
  registerCreateNote(ctx.server, ctx.config);
  registerUpdateNote(ctx.server, ctx.config);
  await callTool(ctx.server, 'create_note', {
    path: 'editable',
    content: '# Original',
    frontmatter: { title: 'Editable' },
  });
});

afterAll(async () => {
  await cleanupVault(ctx.vault);
});

describe('update_note', () => {
  it('replaces content (default mode)', async () => {
    const result = await callTool(ctx.server, 'update_note', {
      path: 'editable',
      content: '# Replaced',
      mode: 'replace',
    });
    expect(result.isError).toBeFalsy();
    const data = parseResult(result) as { mode: string };
    expect(data.mode).toBe('replace');
    const content = await fsp.readFile(path.join(ctx.vault, 'editable.md'), 'utf-8');
    expect(content).toContain('Replaced');
  });

  it('appends content preserving frontmatter', async () => {
    await callTool(ctx.server, 'update_note', { path: 'editable', content: '# Base' });
    const result = await callTool(ctx.server, 'update_note', {
      path: 'editable',
      content: '## Appended',
      mode: 'append',
    });
    expect(result.isError).toBeFalsy();
    const raw = await fsp.readFile(path.join(ctx.vault, 'editable.md'), 'utf-8');
    expect(raw).toContain('# Base');
    expect(raw).toContain('## Appended');
  });

  it('prepends content', async () => {
    await callTool(ctx.server, 'update_note', { path: 'editable', content: '# Body' });
    const result = await callTool(ctx.server, 'update_note', {
      path: 'editable',
      content: '## Prepended',
      mode: 'prepend',
    });
    expect(result.isError).toBeFalsy();
    const raw = await fsp.readFile(path.join(ctx.vault, 'editable.md'), 'utf-8');
    const prependedIdx = raw.indexOf('## Prepended');
    const bodyIdx = raw.indexOf('# Body');
    expect(prependedIdx).toBeLessThan(bodyIdx);
  });

  it('returns error for non-existent note', async () => {
    const result = await callTool(ctx.server, 'update_note', { path: 'ghost', content: 'x' });
    expect(result.isError).toBe(true);
  });

  it('rejects in read-only mode', async () => {
    const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const { registerUpdateNote: reg } = await import('../../src/tools/update-note.js');
    const roServer = new McpServer({ name: 'ro', version: '0' });
    reg(roServer, { ...ctx.config, readOnly: true });
    const result = await callTool(roServer, 'update_note', { path: 'editable', content: 'x' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('read-only');
  });

  it('rejects path traversal', async () => {
    const result = await callTool(ctx.server, 'update_note', {
      path: '../../../etc/passwd',
      content: 'evil',
    });
    expect(result.isError).toBe(true);
  });
});

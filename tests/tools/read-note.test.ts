import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerReadNote } from '../../src/tools/read-note.js';
import { createTestVault, seedVault, cleanupVault, callTool, parseResult } from './helpers.js';
import type { TestContext } from './helpers.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestVault();
  await seedVault(ctx.vault);
  registerReadNote(ctx.server, ctx.config);
});

afterAll(async () => {
  await cleanupVault(ctx.vault);
});

describe('read_note', () => {
  it('reads a note with frontmatter', async () => {
    const result = await callTool(ctx.server, 'read_note', { path: 'index' });
    expect(result.isError).toBeFalsy();
    const data = parseResult(result) as { frontmatter: Record<string, unknown>; content: string };
    expect(data.frontmatter.title).toBe('Vault Index');
    expect(data.content).toContain('My Vault');
  });

  it('accepts path with .md extension', async () => {
    const result = await callTool(ctx.server, 'read_note', { path: 'index.md' });
    expect(result.isError).toBeFalsy();
  });

  it('returns error for non-existent note', async () => {
    const result = await callTool(ctx.server, 'read_note', { path: 'does-not-exist' });
    expect(result.isError).toBe(true);
  });

  it('rejects path traversal', async () => {
    const result = await callTool(ctx.server, 'read_note', { path: '../../../etc/passwd' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
  });
});

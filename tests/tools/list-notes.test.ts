import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerListNotes } from '../../src/tools/list-notes.js';
import { createTestVault, seedVault, cleanupVault, callTool, parseResult } from './helpers.js';
import type { TestContext } from './helpers.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestVault();
  await seedVault(ctx.vault);
  registerListNotes(ctx.server, ctx.config);
});

afterAll(async () => {
  await cleanupVault(ctx.vault);
});

describe('list_notes', () => {
  it('lists all notes in vault', async () => {
    const result = await callTool(ctx.server, 'list_notes', {});
    const data = parseResult(result) as { count: number; notes: unknown[] };
    expect(data.count).toBeGreaterThan(0);
    expect(data.notes.length).toBe(data.count);
  });

  it('filters by folder', async () => {
    const result = await callTool(ctx.server, 'list_notes', { folder: 'Daily' });
    const data = parseResult(result) as { notes: Array<{ path: string }> };
    expect(data.notes.every((n) => n.path.startsWith('Daily'))).toBe(true);
  });

  it('non-recursive lists only top level', async () => {
    const result = await callTool(ctx.server, 'list_notes', { recursive: false });
    const data = parseResult(result) as { notes: Array<{ path: string }> };
    expect(data.notes.every((n) => !n.path.includes('/'))).toBe(true);
  });

  it('rejects path traversal on folder', async () => {
    const result = await callTool(ctx.server, 'list_notes', { folder: '../../etc' });
    expect(result.isError).toBe(true);
  });
});

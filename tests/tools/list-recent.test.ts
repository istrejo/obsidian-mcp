import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerListRecent } from '../../src/tools/list-recent.js';
import { createTestVault, seedVault, cleanupVault, callTool, parseResult } from './helpers.js';
import type { TestContext } from './helpers.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestVault();
  await seedVault(ctx.vault);
  registerListRecent(ctx.server, ctx.config);
});

afterAll(async () => {
  await cleanupVault(ctx.vault);
});

describe('list_recent', () => {
  it('lists notes sorted by mtime', async () => {
    const result = await callTool(ctx.server, 'list_recent', {});
    expect(result.isError).toBeFalsy();
    const data = parseResult(result) as { notes: Array<{ mtime: string }> };
    expect(data.notes.length).toBeGreaterThan(0);
    // Verify sorted desc
    for (let i = 1; i < data.notes.length; i++) {
      expect(new Date(data.notes[i - 1].mtime).getTime()).toBeGreaterThanOrEqual(
        new Date(data.notes[i].mtime).getTime(),
      );
    }
  });

  it('respects the limit', async () => {
    const result = await callTool(ctx.server, 'list_recent', { limit: 2 });
    const data = parseResult(result) as { notes: unknown[] };
    expect(data.notes.length).toBeLessThanOrEqual(2);
  });

  it('filters by folder', async () => {
    const result = await callTool(ctx.server, 'list_recent', { folder: 'Daily' });
    const data = parseResult(result) as { notes: Array<{ path: string }> };
    expect(data.notes.every((n) => n.path.startsWith('Daily'))).toBe(true);
  });
});

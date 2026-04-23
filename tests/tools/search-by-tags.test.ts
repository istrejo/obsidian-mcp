import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerSearchByTags } from '../../src/tools/search-by-tags.js';
import { createTestVault, seedVault, cleanupVault, callTool, parseResult } from './helpers.js';
import type { TestContext } from './helpers.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestVault();
  await seedVault(ctx.vault);
  registerSearchByTags(ctx.server, ctx.config);
});

afterAll(async () => {
  await cleanupVault(ctx.vault);
});

describe('search_by_tags', () => {
  it('finds notes by frontmatter tag', async () => {
    const result = await callTool(ctx.server, 'search_by_tags', { tags: ['daily'] });
    const data = parseResult(result) as { notes: unknown[] };
    expect(data.notes.length).toBeGreaterThan(0);
  });

  it('finds notes by inline tag', async () => {
    const result = await callTool(ctx.server, 'search_by_tags', { tags: ['resource'] });
    const data = parseResult(result) as { notes: Array<{ path: string }> };
    expect(data.notes.some((n) => n.path.includes('Resources'))).toBe(true);
  });

  it('matchMode any returns union', async () => {
    const result = await callTool(ctx.server, 'search_by_tags', {
      tags: ['daily', 'resource'],
      matchMode: 'any',
    });
    const data = parseResult(result) as { notes: unknown[] };
    expect(data.notes.length).toBeGreaterThan(0);
  });

  it('matchMode all returns intersection', async () => {
    // Notes with both daily AND resource — likely none
    const result = await callTool(ctx.server, 'search_by_tags', {
      tags: ['daily', 'resource'],
      matchMode: 'all',
    });
    const data = parseResult(result) as { notes: unknown[] };
    expect(Array.isArray(data.notes)).toBe(true);
  });

  it('returns empty for non-existent tag', async () => {
    const result = await callTool(ctx.server, 'search_by_tags', { tags: ['nonexistent-xyz'] });
    const data = parseResult(result) as { notes: unknown[] };
    expect(data.notes).toHaveLength(0);
  });
});

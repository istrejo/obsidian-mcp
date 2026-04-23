import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerSearchContent } from '../../src/tools/search-content.js';
import { createTestVault, seedVault, cleanupVault, callTool, parseResult } from './helpers.js';
import type { TestContext } from './helpers.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestVault();
  await seedVault(ctx.vault);
  registerSearchContent(ctx.server, ctx.config);
});

afterAll(async () => {
  await cleanupVault(ctx.vault);
});

describe('search_content', () => {
  it('finds notes containing query', async () => {
    const result = await callTool(ctx.server, 'search_content', { query: 'Project A' });
    const data = parseResult(result) as { results: Array<{ path: string }> };
    expect(data.results.length).toBeGreaterThan(0);
  });

  it('returns snippets with line numbers', async () => {
    const result = await callTool(ctx.server, 'search_content', { query: 'vault' });
    const data = parseResult(result) as { results: Array<{ snippets: Array<{ lineNumber: number }> }> };
    expect(data.results[0].snippets[0].lineNumber).toBeGreaterThan(0);
  });

  it('case-insensitive by default', async () => {
    const result1 = await callTool(ctx.server, 'search_content', { query: 'project a' });
    const result2 = await callTool(ctx.server, 'search_content', { query: 'Project A' });
    const d1 = parseResult(result1) as { results: unknown[] };
    const d2 = parseResult(result2) as { results: unknown[] };
    expect(d1.results.length).toBe(d2.results.length);
  });

  it('returns empty results for unknown query', async () => {
    const result = await callTool(ctx.server, 'search_content', { query: 'xyzzy-nonexistent-12345' });
    const data = parseResult(result) as { results: unknown[] };
    expect(data.results).toHaveLength(0);
  });
});

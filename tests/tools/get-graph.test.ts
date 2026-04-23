import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerGetGraph } from '../../src/tools/get-graph.js';
import { createTestVault, seedVault, cleanupVault, callTool, parseResult } from './helpers.js';
import type { TestContext } from './helpers.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestVault();
  await seedVault(ctx.vault);
  registerGetGraph(ctx.server, ctx.config);
});

afterAll(async () => {
  await cleanupVault(ctx.vault);
});

describe('get_graph', () => {
  it('returns full graph of all notes', async () => {
    const result = await callTool(ctx.server, 'get_graph', {});
    expect(result.isError).toBeFalsy();
    const data = parseResult(result) as {
      nodes: unknown[];
      edges: unknown[];
      nodeCount: number;
      edgeCount: number;
    };
    expect(data.nodes.length).toBeGreaterThan(0);
    expect(data.nodeCount).toBe(data.nodes.length);
  });

  it('returns subgraph from root note', async () => {
    const result = await callTool(ctx.server, 'get_graph', {
      rootNote: 'index',
      depth: 1,
    });
    expect(result.isError).toBeFalsy();
    const data = parseResult(result) as { nodes: Array<{ id: string }> };
    expect(data.nodes.some((n) => n.id === 'index.md')).toBe(true);
  });

  it('rejects path traversal on rootNote', async () => {
    const result = await callTool(ctx.server, 'get_graph', {
      rootNote: '../../../etc/passwd',
    });
    expect(result.isError).toBe(true);
  });

  it('edges reference valid node ids', async () => {
    const result = await callTool(ctx.server, 'get_graph', {});
    const data = parseResult(result) as {
      nodes: Array<{ id: string }>;
      edges: Array<{ from: string; to: string }>;
    };
    const nodeIds = new Set(data.nodes.map((n) => n.id));
    for (const edge of data.edges) {
      expect(nodeIds.has(edge.from)).toBe(true);
      expect(nodeIds.has(edge.to)).toBe(true);
    }
  });
});

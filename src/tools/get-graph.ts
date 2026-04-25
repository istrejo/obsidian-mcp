import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { resolvePath, noteNameFromPath, resolveVault, vaultParamDesc } from '../lib/vault.js';
import { assertSafePathAsync } from '../lib/security.js';
import { extractWikilinks } from '../lib/wikilinks.js';
import { ok, err, type GraphNode, type GraphEdge } from '../types/index.js';

export function registerGetGraph(server: McpServer, config: Config): void {
  server.registerTool(
    'get_graph',
    {
      description:
        'Get the connection graph of wikilinks across a vault. Returns nodes (notes) and edges (links between them). Optionally, start from a root note and limit depth to explore a specific neighborhood of connected notes.',
      inputSchema: {
        rootNote: z.string().optional().describe('Path to a note to use as the starting point. If provided, only returns the subgraph reachable within the given depth.'),
        depth: z.number().int().min(1).max(10).optional().default(2).describe('How many hops from the root note to include (only applies when rootNote is set). Defaults to 2.'),
        vault: z.string().optional().describe(vaultParamDesc(config)),
      },
    },
    async ({ rootNote, depth, vault }) => {
      try {
        const vc = resolveVault(config, vault);

        const files = await fg('**/*.md', {
          cwd: vc.path,
          absolute: true,
          dot: false,
          ignore: ['**/.obsidian-mcp-trash/**'],
        });

        // Build a map: noteName → relativePath
        const nameToPath = new Map<string, string>();
        for (const file of files) {
          const rel = path.relative(vc.path, file);
          nameToPath.set(path.basename(file, '.md').toLowerCase(), rel);
          nameToPath.set(rel.replace(/\.md$/, '').toLowerCase(), rel);
        }

        // Build adjacency map: relativePath → [linkedRelativePaths]
        const adjacency = new Map<string, string[]>();
        for (const file of files) {
          const rel = path.relative(vc.path, file);
          const content = await fs.readFile(file, 'utf-8');
          const links = extractWikilinks(content);

          const resolved = links
            .map((link) => {
              const key = link.toLowerCase();
              return nameToPath.get(key) ?? nameToPath.get(key + '.md') ?? null;
            })
            .filter((l): l is string => l !== null && l !== rel);

          adjacency.set(rel, [...new Set(resolved)]);
        }

        let relevantNodes: Set<string>;

        if (rootNote) {
          const rootResolved = resolvePath(vc.path, rootNote);
          await assertSafePathAsync(vc.path, rootResolved);
          const rootRel = path.relative(vc.path, rootResolved);

          // BFS up to depth
          relevantNodes = new Set([rootRel]);
          const queue: Array<{ node: string; d: number }> = [{ node: rootRel, d: 0 }];

          while (queue.length > 0) {
            const item = queue.shift()!;
            if (item.d >= depth) continue;
            for (const neighbor of adjacency.get(item.node) ?? []) {
              if (!relevantNodes.has(neighbor)) {
                relevantNodes.add(neighbor);
                queue.push({ node: neighbor, d: item.d + 1 });
              }
            }
          }
        } else {
          relevantNodes = new Set(adjacency.keys());
        }

        const nodes: GraphNode[] = [...relevantNodes].map((rel) => ({
          id: rel,
          title: noteNameFromPath(rel),
        }));

        const edges: GraphEdge[] = [];
        for (const [from, targets] of adjacency.entries()) {
          if (!relevantNodes.has(from)) continue;
          for (const to of targets) {
            if (relevantNodes.has(to)) {
              edges.push({ from, to });
            }
          }
        }

        return ok({ vault: vc.name, nodeCount: nodes.length, edgeCount: edges.length, nodes, edges });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}

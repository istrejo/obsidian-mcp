import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { resolveVaultsForSearch, vaultSearchParamDesc } from '../lib/vault.js';
import { ok, err, type SearchResult } from '../types/index.js';

export function registerSearchContent(server: McpServer, config: Config): void {
  server.registerTool(
    'search_content',
    {
      description:
        'Search the full text of all notes for a query string. Searches across all configured vaults by default. Returns matching notes with line-level snippets showing where the match occurred.',
      inputSchema: {
        query: z.string().min(1).describe('Text to search for across all notes'),
        caseSensitive: z.boolean().optional().default(false).describe('Whether the search is case-sensitive. Defaults to false.'),
        limit: z.number().int().min(1).max(200).optional().default(50).describe('Maximum number of matching notes to return. Defaults to 50.'),
        vault: z.string().optional().describe(vaultSearchParamDesc(config)),
      },
    },
    async ({ query, caseSensitive, limit, vault }) => {
      try {
        const vaults = resolveVaultsForSearch(config, vault);
        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
        const results: Array<SearchResult & { vault: string }> = [];

        for (const vc of vaults) {
          const files = await fg('**/*.md', {
            cwd: vc.path,
            absolute: true,
            dot: false,
            ignore: ['**/.obsidian-mcp-trash/**'],
          });

          for (const file of files) {
            if (results.length >= limit) break;

            const content = await fs.readFile(file, 'utf-8');
            const lines = content.split('\n');
            const snippets = [];

            for (let i = 0; i < lines.length; i++) {
              regex.lastIndex = 0;
              const match = regex.exec(lines[i]);
              if (match) {
                snippets.push({
                  lineNumber: i + 1,
                  line: lines[i].trim(),
                  match: match[0],
                });
              }
            }

            if (snippets.length > 0) {
              results.push({
                vault: vc.name,
                path: path.relative(vc.path, file),
                matchCount: snippets.length,
                snippets: snippets.slice(0, 5),
              });
            }
          }

          if (results.length >= limit) break;
        }

        return ok({ query, totalMatches: results.length, results });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}

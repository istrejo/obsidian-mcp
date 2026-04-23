import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { ok, err, type SearchResult } from '../types/index.js';

export function registerSearchContent(server: McpServer, config: Config): void {
  server.registerTool(
    'search_content',
    {
      description:
        'Search the full text of all notes in the vault for a query string. Use this to find notes containing specific keywords, phrases, code snippets, or any text. Returns matching notes with line-level snippets showing where the match occurred.',
      inputSchema: {
        query: z.string().min(1).describe('Text to search for across all notes'),
        caseSensitive: z.boolean().optional().default(false).describe('Whether the search is case-sensitive. Defaults to false.'),
        limit: z.number().int().min(1).max(200).optional().default(50).describe('Maximum number of matching notes to return. Defaults to 50.'),
      },
    },
    async ({ query, caseSensitive, limit }) => {
      try {
        const files = await fg('**/*.md', {
          cwd: config.vaultPath,
          absolute: true,
          dot: false,
          ignore: ['**/.obsidian-mcp-trash/**'],
        });

        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
        const results: SearchResult[] = [];

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
              path: path.relative(config.vaultPath, file),
              matchCount: snippets.length,
              snippets: snippets.slice(0, 5),
            });
          }
        }

        return ok({ query, totalMatches: results.length, results });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}

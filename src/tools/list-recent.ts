import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { resolveDir, resolveVaultsForSearch, vaultSearchParamDesc } from '../lib/vault.js';
import { assertSafePath } from '../lib/security.js';
import { ok, err, type NoteMetadata } from '../types/index.js';

export function registerListRecent(server: McpServer, config: Config): void {
  server.registerTool(
    'list_recent',
    {
      description:
        'List the most recently modified notes. Searches across all configured vaults by default. Returns notes sorted by modification time, newest first.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().default(10).describe('Maximum number of notes to return (1-100). Defaults to 10.'),
        folder: z.string().optional().describe('Limit results to a specific subfolder (e.g. "Daily"). Applied per vault when searching all vaults.'),
        vault: z.string().optional().describe(vaultSearchParamDesc(config)),
      },
    },
    async ({ limit, folder, vault }) => {
      try {
        const vaults = resolveVaultsForSearch(config, vault);
        const allNotes: Array<NoteMetadata & { vault: string }> = [];

        for (const vc of vaults) {
          const baseDir = folder ? resolveDir(vc.path, folder) : vc.path;

          if (folder) {
            assertSafePath(vc.path, baseDir);
          }

          const files = await fg('**/*.md', {
            cwd: baseDir,
            absolute: true,
            dot: false,
            ignore: ['**/.obsidian-mcp-trash/**'],
          });

          const notes = await Promise.all(
            files.map(async (file) => {
              const stat = await fs.stat(file);
              const relativePath = path.relative(vc.path, file);
              return {
                vault: vc.name,
                path: relativePath,
                name: path.basename(file, '.md'),
                size: stat.size,
                mtime: stat.mtime.toISOString(),
              };
            }),
          );

          allNotes.push(...notes);
        }

        allNotes.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());

        return ok({ notes: allNotes.slice(0, limit) });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}

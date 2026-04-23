import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { resolveDir } from '../lib/vault.js';
import { assertSafePath } from '../lib/security.js';
import { ok, err, type NoteMetadata } from '../types/index.js';

export function registerListRecent(server: McpServer, config: Config): void {
  server.registerTool(
    'list_recent',
    {
      description:
        'List the most recently modified notes in the vault. Use this to see what has been worked on lately, find notes from a recent session, or identify recently updated content. Returns notes sorted by modification time, newest first.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().default(10).describe('Maximum number of notes to return (1-100). Defaults to 10.'),
        folder: z.string().optional().describe('Limit results to a specific subfolder (e.g. "Daily").'),
      },
    },
    async ({ limit, folder }) => {
      try {
        const baseDir = folder ? resolveDir(config.vaultPath, folder) : config.vaultPath;

        if (folder) {
          assertSafePath(config.vaultPath, baseDir);
        }

        const files = await fg('**/*.md', {
          cwd: baseDir,
          absolute: true,
          dot: false,
          ignore: ['**/.obsidian-mcp-trash/**'],
        });

        const notes: NoteMetadata[] = await Promise.all(
          files.map(async (file) => {
            const stat = await fs.stat(file);
            const relativePath = path.relative(config.vaultPath, file);
            return {
              path: relativePath,
              name: path.basename(file, '.md'),
              size: stat.size,
              mtime: stat.mtime.toISOString(),
            };
          }),
        );

        notes.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());

        return ok({ notes: notes.slice(0, limit) });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}

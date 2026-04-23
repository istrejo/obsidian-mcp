import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { resolveDir } from '../lib/vault.js';
import { assertSafePath } from '../lib/security.js';
import { ok, err, type NoteMetadata } from '../types/index.js';

export function registerListNotes(server: McpServer, config: Config): void {
  server.registerTool(
    'list_notes',
    {
      description:
        'List all notes in the Obsidian vault, optionally filtered by folder. Use this to discover what notes exist before reading or searching them. Returns path, name, size, and last modification time for each note.',
      inputSchema: {
        folder: z.string().optional().describe('Subfolder to filter notes (e.g. "Projects"). Omit to list all notes in the vault.'),
        recursive: z.boolean().optional().default(true).describe('Whether to include notes in subfolders. Defaults to true.'),
      },
    },
    async ({ folder, recursive }) => {
      try {
        const baseDir = folder ? resolveDir(config.vaultPath, folder) : config.vaultPath;

        if (folder) {
          assertSafePath(config.vaultPath, baseDir);
        }

        const pattern = recursive ? '**/*.md' : '*.md';
        const files = await fg(pattern, {
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

        notes.sort((a, b) => a.path.localeCompare(b.path));

        return ok({ count: notes.length, notes });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}

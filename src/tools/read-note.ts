import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { resolvePath, toRelativePath } from '../lib/vault.js';
import { assertSafePathAsync, assertFileSize } from '../lib/security.js';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { ok, err } from '../types/index.js';

export function registerReadNote(server: McpServer, config: Config): void {
  server.registerTool(
    'read_note',
    {
      description:
        'Read the complete content of an Obsidian note. Use this when you need to see the full text, frontmatter metadata, or any details of a specific note. Provide the note path relative to the vault root (with or without .md extension).',
      inputSchema: {
        path: z.string().min(1).describe('Relative path to the note within the vault (e.g. "Projects/my-project" or "Daily/2024-01-15.md")'),
      },
    },
    async ({ path: notePath }) => {
      try {
        const resolved = resolvePath(config.vaultPath, notePath);
        await assertSafePathAsync(config.vaultPath, resolved);
        await assertFileSize(resolved, config.maxFileSize);

        const raw = await fs.readFile(resolved, 'utf-8');
        const stat = await fs.stat(resolved);
        const { data, content } = parseFrontmatter(raw);

        return ok({
          path: toRelativePath(config.vaultPath, resolved),
          frontmatter: data,
          content,
          metadata: {
            size: stat.size,
            mtime: stat.mtime.toISOString(),
          },
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}

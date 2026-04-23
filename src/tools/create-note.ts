import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { resolvePath, toRelativePath } from '../lib/vault.js';
import { assertSafePathAsync, assertNotReadOnly } from '../lib/security.js';
import { stringifyFrontmatter } from '../lib/frontmatter.js';
import { logger } from '../lib/logger.js';
import { ok, err } from '../types/index.js';

export function registerCreateNote(server: McpServer, config: Config): void {
  server.registerTool(
    'create_note',
    {
      description:
        'Create a new note in the Obsidian vault. Use this to add new notes, journal entries, or documents. Optionally include frontmatter metadata (title, tags, date, etc.). Intermediate folders are created automatically. Fails if the note already exists unless overwrite is set to true.',
      inputSchema: {
        path: z.string().min(1).describe('Path for the new note relative to the vault root (e.g. "Projects/new-project" or "Daily/2024-01-15")'),
        content: z.string().describe('Markdown content for the note body (without frontmatter)'),
        frontmatter: z.record(z.unknown()).optional().describe('YAML frontmatter data as an object (e.g. { title: "My Note", tags: ["project"] })'),
        overwrite: z.boolean().optional().default(false).describe('If true, overwrite the note if it already exists. Defaults to false.'),
      },
    },
    async ({ path: notePath, content, frontmatter, overwrite }) => {
      try {
        assertNotReadOnly(config.readOnly);

        const resolved = resolvePath(config.vaultPath, notePath);
        await assertSafePathAsync(config.vaultPath, resolved);

        try {
          await fs.access(resolved);
          if (!overwrite) {
            return err(
              `Note already exists: "${notePath}". Use overwrite: true to replace it, or choose a different path.`,
            );
          }
        } catch {
          // File doesn't exist — good, proceed
        }

        await fs.mkdir(path.dirname(resolved), { recursive: true });

        const body = frontmatter ? stringifyFrontmatter(frontmatter as Record<string, unknown>, content) : content;
        await fs.writeFile(resolved, body, 'utf-8');

        const relative = toRelativePath(config.vaultPath, resolved);
        logger.info('Note created', { path: relative, overwrite });

        return ok({ created: relative, overwrite });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}

import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { resolvePath, toRelativePath } from '../lib/vault.js';
import { assertSafePathAsync, assertNotReadOnly, assertFileSize } from '../lib/security.js';
import { parseFrontmatter, stringifyFrontmatter, mergeFrontmatter } from '../lib/frontmatter.js';
import { logger } from '../lib/logger.js';
import { ok, err } from '../types/index.js';

export function registerManageFrontmatter(server: McpServer, config: Config): void {
  server.registerTool(
    'manage_frontmatter',
    {
      description:
        'Read or modify the YAML frontmatter metadata of a note. Use "get" to retrieve all metadata, "set" to replace it entirely, "merge" to add or update specific fields while keeping others, or "delete" to remove specific keys. The note body content is always preserved.',
      inputSchema: {
        path: z.string().min(1).describe('Relative path to the note (e.g. "Projects/my-project")'),
        operation: z.enum(['get', 'set', 'merge', 'delete']).describe('Operation to perform: "get" reads metadata, "set" replaces it, "merge" updates specific fields, "delete" removes specific keys'),
        data: z.record(z.unknown()).optional().describe('Frontmatter data for "set" or "merge" operations (e.g. { tags: ["project"], status: "active" })'),
        keys: z.array(z.string()).optional().describe('Keys to remove for the "delete" operation (e.g. ["draft", "review-date"])'),
      },
    },
    async ({ path: notePath, operation, data, keys }) => {
      try {
        if (operation !== 'get') {
          assertNotReadOnly(config.readOnly);
        }

        const resolved = resolvePath(config.vaultPath, notePath);
        await assertSafePathAsync(config.vaultPath, resolved);
        await assertFileSize(resolved, config.maxFileSize);

        const raw = await fs.readFile(resolved, 'utf-8');
        const { data: existing, content } = parseFrontmatter(raw);

        if (operation === 'get') {
          return ok({ path: toRelativePath(config.vaultPath, resolved), frontmatter: existing });
        }

        let updated: Record<string, unknown>;

        if (operation === 'set') {
          updated = (data as Record<string, unknown>) ?? {};
        } else if (operation === 'merge') {
          updated = mergeFrontmatter(existing, (data as Record<string, unknown>) ?? {});
        } else {
          updated = { ...existing };
          for (const key of keys ?? []) {
            delete updated[key];
          }
        }

        const newContent = stringifyFrontmatter(updated, content);
        await fs.writeFile(resolved, newContent, 'utf-8');

        const relative = toRelativePath(config.vaultPath, resolved);
        logger.info('Frontmatter updated', { path: relative, operation });

        return ok({ path: relative, operation, frontmatter: updated });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}

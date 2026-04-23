import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { resolvePath, toRelativePath } from '../lib/vault.js';
import { assertSafePathAsync, assertNotReadOnly, assertFileSize } from '../lib/security.js';
import { parseFrontmatter, stringifyFrontmatter } from '../lib/frontmatter.js';
import { logger } from '../lib/logger.js';
import { ok, err } from '../types/index.js';

export function registerUpdateNote(server: McpServer, config: Config): void {
  server.registerTool(
    'update_note',
    {
      description:
        'Update the content of an existing note. Use "replace" to overwrite the entire body, "append" to add content at the end, or "prepend" to add content at the beginning. When using append or prepend, the existing frontmatter is preserved.',
      inputSchema: {
        path: z.string().min(1).describe('Relative path to the note to update (e.g. "Projects/my-project")'),
        content: z.string().describe('New content to write (or add) to the note'),
        mode: z.enum(['replace', 'append', 'prepend']).optional().default('replace').describe('How to update: "replace" overwrites the body, "append" adds to the end, "prepend" adds to the beginning. Defaults to "replace".'),
      },
    },
    async ({ path: notePath, content, mode }) => {
      try {
        assertNotReadOnly(config.readOnly);

        const resolved = resolvePath(config.vaultPath, notePath);
        await assertSafePathAsync(config.vaultPath, resolved);
        await assertFileSize(resolved, config.maxFileSize);

        const raw = await fs.readFile(resolved, 'utf-8');
        const { data, content: existingContent } = parseFrontmatter(raw);

        let newBody: string;
        if (mode === 'replace') {
          newBody = stringifyFrontmatter(data, content);
        } else if (mode === 'append') {
          newBody = stringifyFrontmatter(data, `${existingContent}\n${content}`);
        } else {
          newBody = stringifyFrontmatter(data, `${content}\n${existingContent}`);
        }

        await fs.writeFile(resolved, newBody, 'utf-8');

        const relative = toRelativePath(config.vaultPath, resolved);
        logger.info('Note updated', { path: relative, mode });

        return ok({ updated: relative, mode });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}

import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { resolvePath } from '../lib/vault.js';
import { assertSafePathAsync } from '../lib/security.js';
import { extractWikilinks, wikilinkMatchesNote } from '../lib/wikilinks.js';
import { ok, err, type BacklinkResult } from '../types/index.js';

export function registerGetBacklinks(server: McpServer, config: Config): void {
  server.registerTool(
    'get_backlinks',
    {
      description:
        'Find all notes that link to a specific note using [[wikilinks]]. Use this to understand which notes reference a given note, discover related content, or analyze the connection structure of your vault.',
      inputSchema: {
        path: z.string().min(1).describe('Relative path to the note you want to find backlinks for (e.g. "Resources/book")'),
      },
    },
    async ({ path: notePath }) => {
      try {
        const resolved = resolvePath(config.vaultPath, notePath);
        await assertSafePathAsync(config.vaultPath, resolved);

        const relativePath = path.relative(config.vaultPath, resolved);

        const files = await fg('**/*.md', {
          cwd: config.vaultPath,
          absolute: true,
          dot: false,
          ignore: ['**/.obsidian-mcp-trash/**'],
        });

        const backlinks: BacklinkResult[] = [];

        for (const file of files) {
          if (file === resolved) continue;

          const content = await fs.readFile(file, 'utf-8');
          const links = extractWikilinks(content);
          const matching = links.filter((link) => wikilinkMatchesNote(link, relativePath));

          if (matching.length > 0) {
            backlinks.push({
              path: path.relative(config.vaultPath, file),
              wikilinks: matching,
            });
          }
        }

        return ok({
          note: relativePath,
          backlinkCount: backlinks.length,
          backlinks,
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}

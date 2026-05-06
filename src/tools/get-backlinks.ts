import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { resolvePath, resolveVault, vaultParamDesc } from '../lib/vault.js';
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
        vault: z.string().optional().describe(vaultParamDesc(config)),
      },
    },
    async ({ path: notePath, vault }) => {
      try {
        const vc = resolveVault(config, vault);
        const resolved = resolvePath(vc.path, notePath);
        await assertSafePathAsync(vc.path, resolved);

        const relativePath = path.relative(vc.path, resolved);

        const files = await fg('**/*.md', {
          cwd: vc.path,
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
              path: path.relative(vc.path, file),
              wikilinks: matching,
            });
          }
        }

        return ok({
          vault: vc.name,
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

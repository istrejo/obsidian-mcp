import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { extractTags } from '../lib/wikilinks.js';
import { ok, err, type NoteMetadata } from '../types/index.js';

export function registerSearchByTags(server: McpServer, config: Config): void {
  server.registerTool(
    'search_by_tags',
    {
      description:
        'Find notes that contain specific tags. Tags can appear in frontmatter (tags: [tag1, tag2]) or inline in the content (#tag). Use this to find notes by topic, project, status, or any classification system you use in Obsidian.',
      inputSchema: {
        tags: z.array(z.string().min(1)).min(1).describe('List of tags to search for (without the # symbol, e.g. ["project/active", "daily"])'),
        matchMode: z.enum(['any', 'all']).optional().default('any').describe('Whether to match notes with ANY of the tags or ALL of them. Defaults to "any".'),
      },
    },
    async ({ tags, matchMode }) => {
      try {
        const files = await fg('**/*.md', {
          cwd: config.vaultPath,
          absolute: true,
          dot: false,
          ignore: ['**/.obsidian-mcp-trash/**'],
        });

        const normalizedTags = tags.map((t) => t.toLowerCase().replace(/^#/, ''));
        const results: NoteMetadata[] = [];

        for (const file of files) {
          const raw = await fs.readFile(file, 'utf-8');
          const stat = await fs.stat(file);
          const { data, content } = parseFrontmatter(raw);

          const frontmatterTags = (
            Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : []
          ).map((t: unknown) => String(t).toLowerCase());

          const inlineTags = extractTags(content);
          const allTags = [...new Set([...frontmatterTags, ...inlineTags])];

          const matched =
            matchMode === 'all'
              ? normalizedTags.every((t) => allTags.includes(t))
              : normalizedTags.some((t) => allTags.includes(t));

          if (matched) {
            results.push({
              path: path.relative(config.vaultPath, file),
              name: path.basename(file, '.md'),
              size: stat.size,
              mtime: stat.mtime.toISOString(),
            });
          }
        }

        return ok({ tags: normalizedTags, matchMode, count: results.length, notes: results });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { resolveVault } from '../lib/vault.js';
import { readNoteHandler } from '../notes/read-note.handler.js';
import { createReadNoteInputSchema } from '../notes/read-note.schema.js';
import { ok, err } from '../types/index.js';

export function registerReadNote(server: McpServer, config: Config): void {
  server.registerTool(
    'read_note',
    {
      description:
        'Read the complete content of an Obsidian note. Use this when you need to see the full text, frontmatter metadata, or any details of a specific note. Provide the note path relative to the vault root (with or without .md extension).',
      inputSchema: createReadNoteInputSchema(config),
    },
    async ({ path, vault }) => {
      const vc = resolveVault(config, vault);
      const result = await readNoteHandler(
        {
          vault: vc,
          maxFileSize: config.maxFileSize,
        },
        { path },
      );

      return result.ok ? ok(result.value) : err(result.error);
    },
  );
}

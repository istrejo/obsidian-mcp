import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { resolvePath, toRelativePath } from '../lib/vault.js';
import { assertSafePathAsync, assertNotReadOnly } from '../lib/security.js';
import { backupNote } from '../lib/backup.js';
import { logger } from '../lib/logger.js';
import { ok, err } from '../types/index.js';

export function registerDeleteNote(server: McpServer, config: Config): void {
  server.registerTool(
    'delete_note',
    {
      description:
        'Permanently delete a note from the vault. This action requires explicit confirmation (confirm: true). A backup is automatically created before deletion (unless backups are disabled). Use this only when you are certain the note is no longer needed.',
      inputSchema: {
        path: z.string().min(1).describe('Relative path to the note to delete (e.g. "Archive/old-note")'),
        confirm: z.literal(true).describe('Must be set to true to confirm the deletion. This is a destructive, irreversible operation (except for the automatic backup).'),
      },
    },
    async ({ path: notePath, confirm: _confirm }) => {
      try {
        assertNotReadOnly(config.readOnly);

        const resolved = resolvePath(config.vaultPath, notePath);
        await assertSafePathAsync(config.vaultPath, resolved);

        let backupPath: string | undefined;
        if (config.backupEnabled) {
          backupPath = await backupNote(config.vaultPath, resolved);
        }

        await fs.unlink(resolved);

        const relative = toRelativePath(config.vaultPath, resolved);
        logger.info('Note deleted', { path: relative, backup: backupPath });

        return ok({
          deleted: relative,
          backup: backupPath
            ? `Backup saved to: ${backupPath}`
            : 'Backup disabled — note permanently removed.',
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}

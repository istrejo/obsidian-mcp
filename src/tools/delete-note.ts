import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { resolvePath, toRelativePath, resolveVault, vaultParamDesc } from '../lib/vault.js';
import { assertSafePathAsync, assertNotReadOnly } from '../lib/security.js';
import { backupNote } from '../lib/backup.js';
import { logger } from '../lib/logger.js';
import { ok, err } from '../types/index.js';

export function registerDeleteNote(server: McpServer, config: Config): void {
  server.registerTool(
    'delete_note',
    {
      description:
        'Permanently delete a note from a vault. This action requires explicit confirmation (confirm: true). A backup is automatically created before deletion (unless backups are disabled for the vault). Use this only when you are certain the note is no longer needed.',
      inputSchema: {
        path: z.string().min(1).describe('Relative path to the note to delete (e.g. "Archive/old-note")'),
        confirm: z.literal(true).describe('Must be set to true to confirm the deletion. This is a destructive, irreversible operation (except for the automatic backup).'),
        vault: z.string().optional().describe(vaultParamDesc(config)),
      },
    },
    async ({ path: notePath, confirm: _confirm, vault }) => {
      try {
        const vc = resolveVault(config, vault);
        assertNotReadOnly(vc.readOnly);

        const resolved = resolvePath(vc.path, notePath);
        await assertSafePathAsync(vc.path, resolved);

        let backupPath: string | undefined;
        if (vc.backupEnabled) {
          backupPath = await backupNote(vc.path, resolved);
        }

        await fs.unlink(resolved);

        const relative = toRelativePath(vc.path, resolved);
        logger.info('Note deleted', { vault: vc.name, path: relative, backup: backupPath });

        return ok({
          vault: vc.name,
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

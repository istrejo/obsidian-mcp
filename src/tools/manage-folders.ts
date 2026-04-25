import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { resolveDir, resolveVault, vaultParamDesc } from '../lib/vault.js';
import { assertSafePath, assertNotReadOnly } from '../lib/security.js';
import { logger } from '../lib/logger.js';
import { ok, err } from '../types/index.js';

export function registerManageFolders(server: McpServer, config: Config): void {
  server.registerTool(
    'manage_folders',
    {
      description:
        'Create, list, or delete folders within an Obsidian vault. Use "create" to add a new folder (including nested paths), "list" to see the subfolders inside a folder, or "delete" to remove an empty folder. Deleting non-empty folders is not allowed for safety.',
      inputSchema: {
        operation: z.enum(['create', 'list', 'delete']).describe('Operation: "create" makes a new folder, "list" shows subfolders, "delete" removes an empty folder'),
        path: z.string().min(1).describe('Folder path relative to the vault root (e.g. "Projects/2024" or "Archive")'),
        confirm: z.boolean().optional().describe('Required to be true for "delete" operations'),
        vault: z.string().optional().describe(vaultParamDesc(config)),
      },
    },
    async ({ operation, path: folderPath, confirm, vault }) => {
      try {
        const vc = resolveVault(config, vault);

        if (operation !== 'list') {
          assertNotReadOnly(vc.readOnly);
        }

        const resolved = resolveDir(vc.path, folderPath);
        assertSafePath(vc.path, resolved);

        if (operation === 'create') {
          await fs.mkdir(resolved, { recursive: true });
          logger.info('Folder created', { vault: vc.name, path: folderPath });
          return ok({ vault: vc.name, created: folderPath });
        }

        if (operation === 'list') {
          const entries = await fg('*', {
            cwd: resolved,
            onlyDirectories: true,
            dot: false,
          });
          const subfolders = entries.map((e) => path.join(folderPath, e));
          return ok({ vault: vc.name, folder: folderPath, subfolders });
        }

        // delete
        if (!confirm) {
          return err('Folder deletion requires confirm: true. This operation cannot be undone.');
        }

        const contents = await fs.readdir(resolved);
        if (contents.length > 0) {
          return err(
            `Folder "${folderPath}" is not empty (${contents.length} items). Remove all contents first before deleting the folder.`,
          );
        }

        await fs.rmdir(resolved);
        logger.info('Folder deleted', { vault: vc.name, path: folderPath });
        return ok({ vault: vc.name, deleted: folderPath });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}

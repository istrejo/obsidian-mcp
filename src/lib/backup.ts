import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from './logger.js';

const TRASH_DIR = '.obsidian-mcp-trash';

export async function backupNote(vaultPath: string, notePath: string): Promise<string> {
  const relativePath = path.relative(vaultPath, notePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(vaultPath, TRASH_DIR, timestamp, path.dirname(relativePath));

  await fs.mkdir(backupDir, { recursive: true });

  const backupPath = path.join(backupDir, path.basename(notePath));
  await fs.copyFile(notePath, backupPath);

  logger.info('Backup created', { original: relativePath, backup: backupPath });
  return backupPath;
}

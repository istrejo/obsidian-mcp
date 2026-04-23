import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { backupNote } from '../../src/lib/backup.js';

let vault: string;
let noteFile: string;

beforeAll(async () => {
  vault = await fsp.mkdtemp(path.join(os.tmpdir(), 'backup-test-'));
  noteFile = path.join(vault, 'note.md');
  await fsp.writeFile(noteFile, '# Original content');
});

afterAll(async () => {
  await fsp.rm(vault, { recursive: true, force: true });
});

describe('backupNote', () => {
  it('creates a backup file in the trash directory', async () => {
    const backupPath = await backupNote(vault, noteFile);
    const exists = await fsp.access(backupPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('backup contains the original content', async () => {
    const backupPath = await backupNote(vault, noteFile);
    const content = await fsp.readFile(backupPath, 'utf-8');
    expect(content).toBe('# Original content');
  });

  it('backup path is inside .obsidian-mcp-trash', async () => {
    const backupPath = await backupNote(vault, noteFile);
    expect(backupPath).toContain('.obsidian-mcp-trash');
  });
});

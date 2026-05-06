import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Config, type VaultConfig } from '../../src/config.js';
import { type ReadNoteContext } from '../../src/notes/read-note.handler.js';

export interface TestVaultContext {
  vault: string;
  config: Config;
}

export async function createTestVault(): Promise<TestVaultContext> {
  const vaultPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'obsidian-mcp-test-'));
  const vaultConfig: VaultConfig = {
    name: 'default',
    path: vaultPath,
    readOnly: false,
    backupEnabled: false,
  };

  return {
    vault: vaultPath,
    config: {
      vaults: new Map([['default', vaultConfig]]),
      maxFileSize: 10_485_760,
      logLevel: 'error',
    },
  };
}

export function buildReadNoteContext(config: Config, vaultName = 'default'): ReadNoteContext {
  const vault = config.vaults.get(vaultName);
  if (!vault) {
    throw new Error(`Vault "${vaultName}" not found in test config`);
  }

  return {
    vault,
    maxFileSize: config.maxFileSize,
  };
}

export async function seedVault(vault: string): Promise<void> {
  const fixturesDir = path.join(path.dirname(import.meta.dirname), 'fixtures/test-vault');
  await copyDir(fixturesDir, vault);
}

async function copyDir(src: string, dest: string): Promise<void> {
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await fsp.mkdir(destPath, { recursive: true });
      await copyDir(srcPath, destPath);
    } else {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

export async function cleanupVault(vault: string): Promise<void> {
  await fsp.rm(vault, { recursive: true, force: true });
}

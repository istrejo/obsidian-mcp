import path from 'node:path';
import { type Config, type VaultConfig } from '../config.js';

export function resolvePath(vaultPath: string, userPath: string): string {
  const normalized = userPath.endsWith('.md') ? userPath : `${userPath}.md`;
  return path.resolve(vaultPath, normalized);
}

export function resolveDir(vaultPath: string, userPath: string): string {
  return path.resolve(vaultPath, userPath);
}

export function toRelativePath(vaultPath: string, absolutePath: string): string {
  return path.relative(vaultPath, absolutePath);
}

export function noteNameFromPath(notePath: string): string {
  return path.basename(notePath, '.md');
}

export function resolveVault(config: Config, vaultName?: string): VaultConfig {
  if (vaultName) {
    const v = config.vaults.get(vaultName);
    if (!v) {
      const available = [...config.vaults.keys()].join(', ');
      throw new Error(`Vault "${vaultName}" not found. Available: ${available}`);
    }
    return v;
  }
  if (config.vaults.size === 1) {
    return config.vaults.values().next().value!;
  }
  const available = [...config.vaults.keys()].join(', ');
  throw new Error(
    `Vault name is required when multiple vaults are configured. Available: ${available}`,
  );
}

export function resolveVaultsForSearch(config: Config, vaultName?: string): VaultConfig[] {
  if (!vaultName || vaultName === 'all') {
    return [...config.vaults.values()];
  }
  return [resolveVault(config, vaultName)];
}

export function vaultParamDesc(config: Config): string {
  const names = [...config.vaults.keys()];
  if (names.length === 1) {
    return `Vault name (optional — only one vault configured: "${names[0]}").`;
  }
  return `Vault name. Required when multiple vaults are configured. Available: ${names.join(', ')}.`;
}

export function vaultSearchParamDesc(config: Config): string {
  const names = [...config.vaults.keys()];
  return `Vault to search in. Omit or use "all" to search all vaults. Available: ${names.join(', ')}.`;
}

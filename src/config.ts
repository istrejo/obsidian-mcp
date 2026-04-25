import { z } from 'zod/v3';
import fs from 'node:fs';
import { setLogLevel, type LogLevel } from './lib/logger.js';

export interface VaultConfig {
  name: string;
  path: string;
  readOnly: boolean;
  backupEnabled: boolean;
}

export interface Config {
  vaults: Map<string, VaultConfig>;
  maxFileSize: number;
  logLevel: LogLevel;
}

const VAULT_NAME_RE = /^[a-zA-Z0-9_-]+$/;

const vaultEntrySchema = z.object({
  path: z.string().min(1),
  readOnly: z.boolean().optional().default(false),
  backupEnabled: z.boolean().optional().default(true),
});

const configFileSchema = z.object({
  vaults: z.record(vaultEntrySchema),
  maxFileSize: z.number().int().positive().optional().default(10_485_760),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
});

const legacyEnvSchema = z.object({
  OBSIDIAN_VAULT_PATH: z.string().min(1),
  OBSIDIAN_READ_ONLY: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  OBSIDIAN_MAX_FILE_SIZE: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10_485_760)),
  OBSIDIAN_BACKUP_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
  OBSIDIAN_LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .optional()
    .default('info'),
});

function validateVaultPath(name: string, vaultPath: string): void {
  if (!fs.existsSync(vaultPath)) {
    console.error(`[FATAL] Vault "${name}" path does not exist: ${vaultPath}`);
    process.exit(1);
  }
  const stat = fs.statSync(vaultPath);
  if (!stat.isDirectory()) {
    console.error(`[FATAL] Vault "${name}" path is not a directory: ${vaultPath}`);
    process.exit(1);
  }
}

function validateVaultName(name: string): void {
  if (name === 'all') {
    console.error('[FATAL] Vault name "all" is reserved and cannot be used.');
    process.exit(1);
  }
  if (!VAULT_NAME_RE.test(name)) {
    console.error(
      `[FATAL] Invalid vault name "${name}". Use only letters, numbers, hyphens, and underscores.`,
    );
    process.exit(1);
  }
}

function loadFromFile(configPath: string): Config {
  if (!fs.existsSync(configPath)) {
    console.error(`[FATAL] Config file not found: ${configPath}`);
    process.exit(1);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    console.error(`[FATAL] Failed to parse config file as JSON: ${configPath}`);
    process.exit(1);
  }

  const result = configFileSchema.safeParse(raw);
  if (!result.success) {
    console.error(`[FATAL] Invalid config file: ${result.error.message}`);
    process.exit(1);
  }

  const parsed = result.data as Required<typeof result.data>;

  if (Object.keys(parsed.vaults).length === 0) {
    console.error('[FATAL] Config must define at least one vault.');
    process.exit(1);
  }

  const vaults = new Map<string, VaultConfig>();
  for (const [name, entry] of Object.entries(parsed.vaults)) {
    validateVaultName(name);
    validateVaultPath(name, entry.path);
    vaults.set(name, { name, path: entry.path, readOnly: entry.readOnly, backupEnabled: entry.backupEnabled });
  }

  setLogLevel(parsed.logLevel as LogLevel);
  return { vaults, maxFileSize: parsed.maxFileSize, logLevel: parsed.logLevel as LogLevel };
}

function loadFromLegacy(): Config {
  const result = legacyEnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('[FATAL] Missing required environment variable: OBSIDIAN_VAULT_PATH');
    console.error('Set it to the absolute path of your Obsidian vault.');
    console.error('Example: OBSIDIAN_VAULT_PATH=/Users/you/MyVault');
    process.exit(1);
  }

  const env = result.data as Required<typeof result.data>;
  validateVaultPath('default', env.OBSIDIAN_VAULT_PATH);

  const vaultConfig: VaultConfig = {
    name: 'default',
    path: env.OBSIDIAN_VAULT_PATH,
    readOnly: env.OBSIDIAN_READ_ONLY,
    backupEnabled: env.OBSIDIAN_BACKUP_ENABLED,
  };

  setLogLevel(env.OBSIDIAN_LOG_LEVEL as LogLevel);

  return {
    vaults: new Map([['default', vaultConfig]]),
    maxFileSize: env.OBSIDIAN_MAX_FILE_SIZE,
    logLevel: env.OBSIDIAN_LOG_LEVEL as LogLevel,
  };
}

export function loadConfig(): Config {
  const configPath = process.env.OBSIDIAN_CONFIG;
  const legacyVaultPath = process.env.OBSIDIAN_VAULT_PATH;

  if (configPath) {
    return loadFromFile(configPath);
  }

  if (legacyVaultPath) {
    return loadFromLegacy();
  }

  console.error('[FATAL] Missing configuration.');
  console.error('  Multi-vault: set OBSIDIAN_CONFIG=/path/to/obsidian-mcp.config.json');
  console.error('  Single vault: set OBSIDIAN_VAULT_PATH=/path/to/vault');
  process.exit(1);
}

import { z } from 'zod/v3';
import fs from 'node:fs';
import { setLogLevel, type LogLevel } from './lib/logger.js';

const configSchema = z.object({
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

export interface Config {
  vaultPath: string;
  readOnly: boolean;
  maxFileSize: number;
  backupEnabled: boolean;
  logLevel: LogLevel;
}

export function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    console.error('[FATAL] Missing required environment variable: OBSIDIAN_VAULT_PATH');
    console.error('Set it to the absolute path of your Obsidian vault.');
    console.error('Example: OBSIDIAN_VAULT_PATH=/Users/you/MyVault');
    process.exit(1);
  }

  const env = result.data as Required<NonNullable<typeof result.data>>;
  const vaultPath = env.OBSIDIAN_VAULT_PATH;

  if (!fs.existsSync(vaultPath)) {
    console.error(`[FATAL] Vault path does not exist: ${vaultPath}`);
    process.exit(1);
  }

  const stat = fs.statSync(vaultPath);
  if (!stat.isDirectory()) {
    console.error(`[FATAL] Vault path is not a directory: ${vaultPath}`);
    process.exit(1);
  }

  const config: Config = {
    vaultPath,
    readOnly: env.OBSIDIAN_READ_ONLY,
    maxFileSize: env.OBSIDIAN_MAX_FILE_SIZE,
    backupEnabled: env.OBSIDIAN_BACKUP_ENABLED,
    logLevel: env.OBSIDIAN_LOG_LEVEL as LogLevel,
  };

  setLogLevel(config.logLevel);
  return config;
}

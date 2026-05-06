import { z } from 'zod/v3';
import { type Config } from '../config.js';
import { vaultParamDesc } from '../lib/vault.js';

export function createReadNoteInputSchema(config: Config) {
  return {
    path: z
      .string()
      .min(1)
      .describe(
        'Relative path to the note within the vault (e.g. "Projects/my-project" or "Daily/2024-01-15.md")',
      ),
    vault: z.string().optional().describe(vaultParamDesc(config)),
  };
}

export interface ReadNoteInput {
  path: string;
  vault?: string;
}

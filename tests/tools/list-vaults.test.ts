import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerListVaults } from '../../src/tools/list-vaults.js';
import {
  createTestVault,
  cleanupVault,
  createMultiVaultTestContext,
  cleanupVaults,
  callTool,
  parseResult,
} from './helpers.js';
import type { TestContext, MultiVaultTestContext } from './helpers.js';

let single: TestContext;
let multi: MultiVaultTestContext;

beforeAll(async () => {
  single = await createTestVault();
  registerListVaults(single.server, single.config);

  multi = await createMultiVaultTestContext([
    { name: 'work' },
    { name: 'personal', readOnly: true },
  ]);
  registerListVaults(multi.server, multi.config);
});

afterAll(async () => {
  await cleanupVault(single.vault);
  await cleanupVaults(multi.vaults);
});

describe('list_vaults — single vault', () => {
  it('returns the single vault', async () => {
    const result = await callTool(single.server, 'list_vaults', {});
    expect(result.isError).toBeFalsy();
    const data = parseResult(result) as { count: number; vaults: Array<{ name: string }> };
    expect(data.count).toBe(1);
    expect(data.vaults[0].name).toBe('default');
  });

  it('includes path and flags', async () => {
    const result = await callTool(single.server, 'list_vaults', {});
    const data = parseResult(result) as {
      vaults: Array<{ name: string; path: string; readOnly: boolean; backupEnabled: boolean }>;
    };
    const v = data.vaults[0];
    expect(v.path).toBe(single.vault);
    expect(v.readOnly).toBe(false);
    expect(v.backupEnabled).toBe(false);
  });
});

describe('list_vaults — multi vault', () => {
  it('returns all configured vaults', async () => {
    const result = await callTool(multi.server, 'list_vaults', {});
    expect(result.isError).toBeFalsy();
    const data = parseResult(result) as { count: number; vaults: Array<{ name: string }> };
    expect(data.count).toBe(2);
    const names = data.vaults.map((v) => v.name);
    expect(names).toContain('work');
    expect(names).toContain('personal');
  });

  it('reflects per-vault readOnly flag', async () => {
    const result = await callTool(multi.server, 'list_vaults', {});
    const data = parseResult(result) as {
      vaults: Array<{ name: string; readOnly: boolean }>;
    };
    const personal = data.vaults.find((v) => v.name === 'personal')!;
    const work = data.vaults.find((v) => v.name === 'work')!;
    expect(personal.readOnly).toBe(true);
    expect(work.readOnly).toBe(false);
  });
});

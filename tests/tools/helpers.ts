import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config, type VaultConfig } from '../../src/config.js';

export interface TestContext {
  vault: string;
  server: McpServer;
  config: Config;
}

export interface MultiVaultTestContext {
  vaults: Record<string, string>;
  server: McpServer;
  config: Config;
}

export async function createTestVault(): Promise<TestContext> {
  const vaultPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'obsidian-mcp-test-'));
  const vaultConfig: VaultConfig = {
    name: 'default',
    path: vaultPath,
    readOnly: false,
    backupEnabled: false,
  };
  const config: Config = {
    vaults: new Map([['default', vaultConfig]]),
    maxFileSize: 10_485_760,
    logLevel: 'error',
  };
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  return { vault: vaultPath, server, config };
}

export async function createMultiVaultTestContext(
  vaultDefs: Array<{ name: string; readOnly?: boolean }>,
): Promise<MultiVaultTestContext> {
  const vaultPaths: Record<string, string> = {};
  const vaultEntries: Array<[string, VaultConfig]> = [];

  for (const def of vaultDefs) {
    const vaultPath = await fsp.mkdtemp(path.join(os.tmpdir(), `obsidian-mcp-${def.name}-`));
    vaultPaths[def.name] = vaultPath;
    vaultEntries.push([
      def.name,
      {
        name: def.name,
        path: vaultPath,
        readOnly: def.readOnly ?? false,
        backupEnabled: false,
      },
    ]);
  }

  const config: Config = {
    vaults: new Map(vaultEntries),
    maxFileSize: 10_485_760,
    logLevel: 'error',
  };
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  return { vaults: vaultPaths, server, config };
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

export async function cleanupVaults(vaults: Record<string, string>): Promise<void> {
  await Promise.all(Object.values(vaults).map((v) => fsp.rm(v, { recursive: true, force: true })));
}

export async function writeNote(vault: string, relativePath: string, content: string): Promise<void> {
  const full = path.join(vault, relativePath);
  await fsp.mkdir(path.dirname(full), { recursive: true });
  await fsp.writeFile(full, content, 'utf-8');
}

export async function callTool(
  server: McpServer,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  // Access internal tool registry — _registeredTools[name].handler is the async callback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registered = (server as any)._registeredTools?.[toolName];
  if (!registered?.handler) {
    throw new Error(`Tool not registered: ${toolName}`);
  }
  return registered.handler(args);
}

export function parseResult(result: { content: Array<{ type: string; text: string }> }): unknown {
  return JSON.parse(result.content[0].text);
}

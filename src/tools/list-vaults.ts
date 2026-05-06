import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { ok } from '../types/index.js';

export function registerListVaults(server: McpServer, config: Config): void {
  server.registerTool(
    'list_vaults',
    {
      description:
        'List all configured Obsidian vaults. Use this first to discover available vault names before calling other tools. Vault names are required as input to other tools when multiple vaults are configured.',
      inputSchema: {},
    },
    async () => {
      const vaults = [...config.vaults.values()].map((v) => ({
        name: v.name,
        path: v.path,
        readOnly: v.readOnly,
        backupEnabled: v.backupEnabled,
      }));
      return ok({ count: vaults.length, vaults });
    },
  );
}

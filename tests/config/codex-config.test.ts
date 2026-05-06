import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Codex config example', () => {
  it('is safe to commit and defaults Codex to read-only', async () => {
    const configPath = path.resolve('.codex/config.example.toml');
    const content = await fs.readFile(configPath, 'utf-8');

    expect(content).toContain('[mcp_servers.obsidian]');
    expect(content).toContain('command = "npx"');
    expect(content).toContain('args = ["-y", "@istrejo/obsidian-mcp"]');
    expect(content).toContain('OBSIDIAN_READ_ONLY = "true"');
    expect(content).toContain('writable_roots = ["/absolute/path/to/your/vault"]');

    expect(content).not.toContain('/Users/aletrejo');
    expect(content).not.toContain('Documents/Obsidian Vault');
    expect(content).not.toContain('dist/index.js');
  });
});

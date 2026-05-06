# @istrejo/obsidian-mcp

> MCP server that connects Claude (Desktop & Code) and Codex to your Obsidian vault via direct filesystem access.

[![npm version](https://img.shields.io/npm/v/@istrejo/obsidian-mcp)](https://www.npmjs.com/package/@istrejo/obsidian-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@istrejo/obsidian-mcp)](https://www.npmjs.com/package/@istrejo/obsidian-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/istrejo/obsidian-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/istrejo/obsidian-mcp/actions/workflows/ci.yml)

## Features

- **14 powerful tools** for reading, writing, searching, and organizing notes
- **Direct filesystem access** — no Obsidian plugins required, works even if Obsidian is closed
- **Secure by design**: path traversal prevention, read-only mode, automatic backups before deletion
- **Works with Claude Desktop, Claude Code, and Codex** via stdio transport
- **Zero configuration** beyond pointing it at your vault path

## Requirements

- Node.js >= 20
- An existing Obsidian vault

## Installation & Setup

### For Claude Desktop

1. Open your Claude Desktop config file:
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux:** `~/.config/Claude/claude_desktop_config.json`

2. Add the following configuration:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["-y", "@istrejo/obsidian-mcp"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/absolute/path/to/your/vault"
      }
    }
  }
}
```

3. Restart Claude Desktop.

### For Claude Code

Run this command in your terminal:

```bash
claude mcp add obsidian -e OBSIDIAN_VAULT_PATH=/absolute/path/to/your/vault -- npx -y @istrejo/obsidian-mcp
```

Or manually edit `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["-y", "@istrejo/obsidian-mcp"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/absolute/path/to/your/vault"
      }
    }
  }
}
```

### For Codex

Codex uses the same MCP stdio server, but the safe public default is **read-only first**. Start with read access, then explicitly opt in to write access when you need it.

Run this command in your terminal:

```bash
codex mcp add obsidian \
  --env OBSIDIAN_VAULT_PATH=/absolute/path/to/your/vault \
  --env OBSIDIAN_READ_ONLY=true \
  -- npx -y @istrejo/obsidian-mcp
```

Or use a project-scoped Codex config. Copy `.codex/config.example.toml` to `.codex/config.toml` and replace the placeholder vault path:

```toml
[mcp_servers.obsidian]
command = "npx"
args = ["-y", "@istrejo/obsidian-mcp"]

[mcp_servers.obsidian.env]
OBSIDIAN_VAULT_PATH = "/absolute/path/to/your/vault"
OBSIDIAN_READ_ONLY = "true"
```

Then open Codex and run `/mcp` to verify the server is enabled.

#### Enabling writes in Codex

To use write tools (`create_note`, `update_note`, `move_note`, `delete_note`, etc.) in Codex, opt in twice:

1. Set `OBSIDIAN_READ_ONLY=false`.
2. Grant Codex sandbox access to the vault path.

Per session:

```bash
codex --add-dir /absolute/path/to/your/vault
```

Or in `~/.codex/config.toml` / `.codex/config.toml`:

```toml
[sandbox_workspace_write]
writable_roots = ["/absolute/path/to/your/vault"]
```

If you skip either step, writes will fail. That is expected: one layer controls MCP behavior, and the other controls Codex sandbox access.

#### Local development with Codex

For local development, avoid pointing Codex at ignored `dist/` output unless you just built it. Also avoid `npm run dev` as the MCP command because npm can write lifecycle output to stdout, and MCP stdio requires stdout to contain only protocol messages.

Use the local TypeScript runner directly instead:

```toml
[mcp_servers.obsidian]
command = "node"
args = ["./node_modules/tsx/dist/cli.mjs", "./src/index.ts"]
cwd = "/absolute/path/to/obsidian-mcp"

[mcp_servers.obsidian.env]
OBSIDIAN_VAULT_PATH = "/absolute/path/to/your/vault"
OBSIDIAN_READ_ONLY = "true"
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OBSIDIAN_CONFIG` | No | — | Path to a JSON config file for multiple vaults. Takes precedence over `OBSIDIAN_VAULT_PATH` |
| `OBSIDIAN_VAULT_PATH` | ✅ Yes, unless `OBSIDIAN_CONFIG` is set | — | Absolute path to your Obsidian vault directory |
| `OBSIDIAN_READ_ONLY` | No | `false` | Set to `true` to disable all write/delete operations |
| `OBSIDIAN_MAX_FILE_SIZE` | No | `10485760` (10 MB) | Maximum file size in bytes for read/write operations |
| `OBSIDIAN_BACKUP_ENABLED` | No | `true` | Whether to create backups before deleting notes |
| `OBSIDIAN_LOG_LEVEL` | No | `info` | Log verbosity: `debug`, `info`, `warn`, or `error` |

## Available Tools

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `list_vaults` | List configured vaults and their safety settings | *"Which Obsidian vaults are available?"* |
| `read_note` | Read the full content and frontmatter of a note | *"Read my note at Projects/my-project"* |
| `list_notes` | List all notes, optionally filtered by folder | *"List all notes in the Resources folder"* |
| `list_recent` | Show the most recently modified notes | *"What are my 5 most recently edited notes?"* |
| `search_content` | Full-text search across all notes | *"Search all my notes for 'microservices'"* |
| `search_by_tags` | Find notes by their tags | *"Find all notes tagged #project/active"* |
| `create_note` | Create a new note with optional frontmatter | *"Create a daily note for today in the Daily folder"* |
| `update_note` | Append, prepend, or replace note content | *"Add a summary section to my meeting note"* |
| `manage_frontmatter` | Read or update YAML frontmatter | *"Set the status field to 'done' in my task note"* |
| `manage_folders` | Create, list, or delete folders | *"Create a folder called Archive/2024"* |
| `move_note` | Move or rename a note, updating backlinks | *"Rename Projects/old-name to Projects/new-name"* |
| `delete_note` | Delete a note (with automatic backup) | *"Delete the draft note at Drafts/scratch"* |
| `get_backlinks` | Find all notes that link to a given note | *"Which notes link to Resources/book?"* |
| `get_graph` | Get the full wikilink connection graph | *"Show me how my notes are connected, starting from index"* |

## Security

- **Path traversal prevention:** All paths are validated to remain within your vault boundaries. Requests like `../../../etc/passwd` are rejected outright.
- **Read-only mode:** Set `OBSIDIAN_READ_ONLY=true` to disable all write and delete operations. Useful for giving Claude or Codex read access to your vault without risk.
- **Automatic backups:** Before deleting any note, a copy is saved to `.obsidian-mcp-trash/{timestamp}/` inside your vault. Set `OBSIDIAN_BACKUP_ENABLED=false` to disable.
- **File size limits:** Files larger than `OBSIDIAN_MAX_FILE_SIZE` bytes are rejected to prevent runaway reads/writes.
- **Structured logs:** All destructive operations (create, update, delete, move) are logged to stderr with timestamps.

## Codex Troubleshooting

### `EPERM: operation not permitted, scandir '/path/to/vault'`

This usually means Codex or macOS blocked filesystem access before `obsidian-mcp` could read your vault.

Check these in order:

1. **Vault outside workspace:** start Codex with `--add-dir /absolute/path/to/your/vault`, or add the vault to `sandbox_workspace_write.writable_roots`.
2. **macOS protected folders:** if the vault is under `Documents`, `Desktop`, iCloud Drive, or another protected location, grant Full Disk Access / Files and Folders permission to the terminal, IDE, or Codex app you use.
3. **Wrong path:** verify the path is absolute and points to the vault directory, not an individual note.
4. **Write attempts in read-only mode:** if the MCP returns `Vault is in read-only mode`, Codex reached the vault correctly; now set `OBSIDIAN_READ_ONLY=false` only if you intentionally want writes.

## Usage Examples

```
"Create a new daily note for today in the Daily folder with tags: daily, journal"

"Search all my notes for 'microservices' and summarize what I've written about the topic"

"Find all notes tagged #project/active that haven't been modified in the last 30 days"

"Move all notes in the Inbox folder to the appropriate project subfolders"

"Show me everything that links back to my 'index' note"

"Build a knowledge graph starting from my 'architecture' note, 3 hops deep"
```

## Development

```bash
git clone https://github.com/istrejo/obsidian-mcp.git
cd obsidian-mcp
npm install

# Run in dev mode (uses tsx, no build needed)
OBSIDIAN_VAULT_PATH=/path/to/vault npm run dev

# Type check
npm run typecheck

# Lint
npm run lint

# Run tests
npm test

# Build for production
npm run build
```

## Contributing

PRs welcome. Please follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `chore:` build/tooling
- `test:` tests only
- `refactor:` refactoring

## License

MIT © [José Alejandro Trejo Rivera](https://github.com/istrejo)

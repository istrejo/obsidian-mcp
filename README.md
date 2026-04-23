# @istrejo/obsidian-mcp

> MCP server that connects Claude (Desktop & Code) to your Obsidian vault via direct filesystem access.

[![npm version](https://img.shields.io/npm/v/@istrejo/obsidian-mcp)](https://www.npmjs.com/package/@istrejo/obsidian-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@istrejo/obsidian-mcp)](https://www.npmjs.com/package/@istrejo/obsidian-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/istrejo/obsidian-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/istrejo/obsidian-mcp/actions/workflows/ci.yml)

## Features

- **13 powerful tools** for reading, writing, searching, and organizing notes
- **Direct filesystem access** — no Obsidian plugins required, works even if Obsidian is closed
- **Secure by design**: path traversal prevention, read-only mode, automatic backups before deletion
- **Works with Claude Desktop AND Claude Code** via stdio transport
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

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OBSIDIAN_VAULT_PATH` | ✅ Yes | — | Absolute path to your Obsidian vault directory |
| `OBSIDIAN_READ_ONLY` | No | `false` | Set to `true` to disable all write/delete operations |
| `OBSIDIAN_MAX_FILE_SIZE` | No | `10485760` (10 MB) | Maximum file size in bytes for read/write operations |
| `OBSIDIAN_BACKUP_ENABLED` | No | `true` | Whether to create backups before deleting notes |
| `OBSIDIAN_LOG_LEVEL` | No | `info` | Log verbosity: `debug`, `info`, `warn`, or `error` |

## Available Tools

| Tool | Description | Example Prompt |
|------|-------------|----------------|
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
- **Read-only mode:** Set `OBSIDIAN_READ_ONLY=true` to disable all write and delete operations. Useful for giving Claude read access to your vault without risk.
- **Automatic backups:** Before deleting any note, a copy is saved to `.obsidian-mcp-trash/{timestamp}/` inside your vault. Set `OBSIDIAN_BACKUP_ENABLED=false` to disable.
- **File size limits:** Files larger than `OBSIDIAN_MAX_FILE_SIZE` bytes are rejected to prevent runaway reads/writes.
- **Structured logs:** All destructive operations (create, update, delete, move) are logged to stderr with timestamps.

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

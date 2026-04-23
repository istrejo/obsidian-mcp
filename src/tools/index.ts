import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';

import { registerReadNote } from './read-note.js';
import { registerCreateNote } from './create-note.js';
import { registerUpdateNote } from './update-note.js';
import { registerDeleteNote } from './delete-note.js';
import { registerListNotes } from './list-notes.js';
import { registerSearchContent } from './search-content.js';
import { registerSearchByTags } from './search-by-tags.js';
import { registerGetBacklinks } from './get-backlinks.js';
import { registerManageFrontmatter } from './manage-frontmatter.js';
import { registerManageFolders } from './manage-folders.js';
import { registerListRecent } from './list-recent.js';
import { registerMoveNote } from './move-note.js';
import { registerGetGraph } from './get-graph.js';

export function registerAllTools(server: McpServer, config: Config): void {
  // Read tools
  registerReadNote(server, config);
  registerListNotes(server, config);
  registerListRecent(server, config);
  registerSearchContent(server, config);
  registerSearchByTags(server, config);

  // Write tools
  registerCreateNote(server, config);
  registerUpdateNote(server, config);
  registerManageFrontmatter(server, config);
  registerManageFolders(server, config);

  // Organization tools
  registerMoveNote(server, config);
  registerDeleteNote(server, config);

  // Analysis tools
  registerGetBacklinks(server, config);
  registerGetGraph(server, config);
}

export interface NoteMetadata {
  path: string;
  name: string;
  size: number;
  mtime: string;
}

export interface NoteContent extends NoteMetadata {
  frontmatter: Record<string, unknown>;
  content: string;
}

export interface SearchSnippet {
  line: string;
  lineNumber: number;
  match: string;
}

export interface SearchResult {
  path: string;
  matchCount: number;
  snippets: SearchSnippet[];
}

export interface GraphNode {
  id: string;
  title: string;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface BacklinkResult {
  path: string;
  wikilinks: string[];
}

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export function ok(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

export function err(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}

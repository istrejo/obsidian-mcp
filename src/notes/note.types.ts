export interface NoteMetadata {
  size: number;
  mtime: string;
}

export interface NoteContent {
  vault: string;
  path: string;
  frontmatter: Record<string, unknown>;
  content: string;
  metadata: NoteMetadata;
}

import fs from 'node:fs/promises';

export function readNoteFile(absolutePath: string): Promise<string> {
  return fs.readFile(absolutePath, 'utf-8');
}

export function statNote(absolutePath: string) {
  return fs.stat(absolutePath);
}

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { resolvePath, resolveDir, toRelativePath, noteNameFromPath } from '../../src/lib/vault.js';

const VAULT = '/vault';

describe('resolvePath', () => {
  it('adds .md extension when missing', () => {
    expect(resolvePath(VAULT, 'notes/foo')).toBe('/vault/notes/foo.md');
  });

  it('does not double .md extension', () => {
    expect(resolvePath(VAULT, 'notes/foo.md')).toBe('/vault/notes/foo.md');
  });

  it('resolves nested path', () => {
    expect(resolvePath(VAULT, 'Projects/sub/note')).toBe('/vault/Projects/sub/note.md');
  });
});

describe('resolveDir', () => {
  it('resolves directory path', () => {
    expect(resolveDir(VAULT, 'Projects')).toBe('/vault/Projects');
  });
});

describe('toRelativePath', () => {
  it('returns relative path from vault root', () => {
    expect(toRelativePath(VAULT, '/vault/notes/foo.md')).toBe(path.join('notes', 'foo.md'));
  });
});

describe('noteNameFromPath', () => {
  it('extracts note name without extension', () => {
    expect(noteNameFromPath('Projects/my-project.md')).toBe('my-project');
  });

  it('works with just filename', () => {
    expect(noteNameFromPath('note.md')).toBe('note');
  });
});

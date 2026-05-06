import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readNoteHandler } from '../../src/notes/read-note.handler.js';
import { cleanupVault, createTestVault, seedVault, buildReadNoteContext } from '../helpers/vault-builder.js';
import { callHandler } from '../helpers/invoke.js';
import type { TestVaultContext } from '../helpers/vault-builder.js';

let ctx: TestVaultContext;

beforeAll(async () => {
  ctx = await createTestVault();
  await seedVault(ctx.vault);
});

afterAll(async () => {
  await cleanupVault(ctx.vault);
});

describe('read_note', () => {
  it('reads a note with frontmatter', async () => {
    const result = await callHandler(readNoteHandler, buildReadNoteContext(ctx.config), { path: 'index' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful result');

    expect(result.value.frontmatter.title).toBe('Vault Index');
    expect(result.value.content).toContain('My Vault');
  });

  it('accepts path with .md extension', async () => {
    const result = await callHandler(readNoteHandler, buildReadNoteContext(ctx.config), {
      path: 'index.md',
    });
    expect(result.ok).toBe(true);
  });

  it('returns error for non-existent note', async () => {
    const result = await callHandler(readNoteHandler, buildReadNoteContext(ctx.config), {
      path: 'does-not-exist',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects path traversal', async () => {
    const result = await callHandler(readNoteHandler, buildReadNoteContext(ctx.config), {
      path: '../../../etc/passwd',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.error).toContain('Path');
  });
});

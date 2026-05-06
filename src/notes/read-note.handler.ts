import { type VaultConfig } from '../config.js';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { assertFileSize, assertSafePathAsync } from '../lib/security.js';
import { resolvePath, toRelativePath } from '../lib/vault.js';
import { Err, Ok, type Result } from '../shared/result.js';
import { readNoteFile, statNote } from './note.fs.js';
import { type NoteContent } from './note.types.js';

export interface ReadNoteContext {
  vault: VaultConfig;
  maxFileSize: number;
}

export async function readNoteHandler(
  ctx: ReadNoteContext,
  input: { path: string },
): Promise<Result<NoteContent>> {
  try {
    const resolved = resolvePath(ctx.vault.path, input.path);
    await assertSafePathAsync(ctx.vault.path, resolved);
    await assertFileSize(resolved, ctx.maxFileSize);

    const raw = await readNoteFile(resolved);
    const stat = await statNote(resolved);
    const { data, content } = parseFrontmatter(raw);

    return Ok({
      vault: ctx.vault.name,
      path: toRelativePath(ctx.vault.path, resolved),
      frontmatter: data,
      content,
      metadata: {
        size: stat.size,
        mtime: stat.mtime.toISOString(),
      },
    });
  } catch (error) {
    return Err(error instanceof Error ? error.message : String(error));
  }
}

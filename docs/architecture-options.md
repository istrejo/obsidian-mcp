# Ejemplos visuales: 3 arquitecturas para `obsidian-mcp`

Documento companion al plan principal. Mismo tool de ejemplo (`read_note`) implementado en las 3 arquitecturas para comparar **forma del código real**, no solo folder trees.

---

## Estado actual (referencia)

### Folder tree

```
src/
├── index.ts                   # bootstrap stdio
├── server.ts                  # createServer(config) + registra tools
├── config.ts                  # Zod multi-vault
├── types/
│   └── index.ts               # NoteContent, NoteMetadata, ToolResult, ok/err
├── lib/
│   ├── vault.ts               # resolvePath, resolveVault
│   ├── frontmatter.ts         # gray-matter wrapper
│   ├── wikilinks.ts           # extract/replace
│   ├── security.ts            # assertSafePath, ReadOnlyError
│   ├── backup.ts              # .obsidian-mcp-trash/
│   └── logger.ts
└── tools/
    ├── index.ts               # registerAllTools
    ├── read-note.ts           # registro + Zod + fs + parse + return — todo junto
    ├── create-note.ts
    ├── ... (13 más)
    └── get-graph.ts           # 106 líneas: registro + glob + BFS

tests/
├── fixtures/test-vault/
├── lib/*.test.ts              # 5 unit
└── tools/
    ├── helpers.ts             # callTool() hackea (server as any)._registeredTools
    └── *.test.ts              # 13 integration
```

### Cómo se ve `read-note` hoy

```typescript
// src/tools/read-note.ts
import { z } from 'zod/v3';
import fs from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from '../config.js';
import { resolvePath, resolveVault, vaultParamDesc } from '../lib/vault.js';
import { assertSafePathAsync } from '../lib/security.js';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { ok, err } from '../types/index.js';

export function registerReadNote(server: McpServer, config: Config): void {
  server.registerTool(
    'read_note',
    {
      description: 'Read a note...',
      inputSchema: {
        path: z.string().describe('Path to note'),
        vault: z.string().optional().describe(vaultParamDesc(config)),
      },
    },
    async ({ path: notePath, vault }) => {
      try {
        const vc = resolveVault(config, vault);
        const absPath = resolvePath(vc, notePath);
        await assertSafePathAsync(vc.path, absPath);
        const raw = await fs.readFile(absPath, 'utf-8');
        const { frontmatter, body } = parseFrontmatter(raw);
        const stat = await fs.stat(absPath);
        return ok({
          metadata: { path: notePath, name: notePath.split('/').pop()!, size: stat.size, mtime: stat.mtime.toISOString() },
          frontmatter,
          body,
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  );
}
```

### Cómo se ve su test hoy

```typescript
// tests/tools/read-note.test.ts
import { callTool, createTestVault, parseResult } from './helpers.js';

it('reads a note', async () => {
  const { server, vaultPath, cleanup } = await createTestVault();
  await fs.writeFile(path.join(vaultPath, 'foo.md'), '# Hi');
  const result = await callTool(server, 'read_note', { path: 'foo.md' });  // ← hackea _registeredTools
  expect(parseResult(result).body).toBe('# Hi');
  await cleanup();
});
```

**Problemas a resolver:**
- 1 archivo mezcla MCP SDK + Zod + fs + dominio + error handling.
- Test depende de `McpServer` levantado y de API privada (`_registeredTools`).
- Folder names (`tools/`, `lib/`) no dicen nada del producto.

---

## Opción A — Screaming Architecture

### Folder tree

```
src/
├── index.ts                                # bootstrap
├── notes/                                  # ← grita "esto maneja notas"
│   ├── read-note.handler.ts                # función pura (ctx, input) → Result
│   ├── read-note.schema.ts                 # Zod aislado
│   ├── create-note.handler.ts
│   ├── create-note.schema.ts
│   ├── update-note.{handler,schema}.ts
│   ├── delete-note.{handler,schema}.ts
│   ├── move-note.{handler,schema}.ts
│   ├── list-notes.{handler,schema}.ts
│   ├── list-recent.{handler,schema}.ts
│   ├── note.types.ts                       # NoteContent, NoteMetadata
│   ├── note.fs.ts                          # readNoteFile, writeNoteFile (fs encapsulado)
│   └── __tests__/
│       ├── read-note.test.ts               # llama handler directo
│       └── ...
├── search/
│   ├── search-content.{handler,schema}.ts
│   ├── search-by-tags.{handler,schema}.ts
│   ├── search.types.ts
│   ├── glob.ts                             # patrón **/*.md compartido
│   └── __tests__/
├── graph/
│   ├── get-graph.handler.ts                # orquesta
│   ├── get-graph.schema.ts
│   ├── graph.builder.ts                    # adyacencia + BFS PURO (sin fs)
│   ├── graph.types.ts
│   └── __tests__/
│       ├── get-graph.test.ts
│       └── graph.builder.test.ts           # unit-test BFS sin fs
├── backlinks/
│   └── ...
├── frontmatter/
│   ├── manage-frontmatter.{handler,schema}.ts
│   ├── frontmatter.parser.ts               # gray-matter wrapper
│   └── __tests__/
├── folders/
│   └── ...
├── vaults/
│   ├── list-vaults.{handler,schema}.ts
│   ├── vault.resolver.ts                   # resolveVault(config, name?)
│   ├── vault.config.ts                     # loadConfig + types
│   ├── vault.types.ts                      # VaultContext
│   └── __tests__/
├── shared/                                 # infra cross-feature SOLAMENTE
│   ├── fs/
│   │   ├── paths.ts                        # resolvePath, toRelativePath
│   │   └── glob.ts
│   ├── security/
│   │   ├── safe-path.ts
│   │   ├── read-only.ts
│   │   └── file-size.ts
│   ├── backup/
│   │   └── trash.ts
│   ├── wikilinks/
│   │   ├── parser.ts                       # extractWikilinks, replaceWikilink
│   │   └── tags.ts                         # extractTags
│   ├── logger.ts
│   └── result.ts                           # Result<T> = Ok<T> | Err
└── mcp/                                    # ÚNICO folder con @modelcontextprotocol/sdk
    ├── server.ts                           # createServer(config)
    ├── register.ts                         # importa todos los handlers
    ├── adapter.ts                          # toMcpResult(result) → MCP envelope
    └── transport-stdio.ts

tests/
├── fixtures/test-vault/
├── helpers/
│   ├── vault-builder.ts                    # createTestVault, seedVault
│   └── invoke.ts                           # callHandler — sin MCP server
└── e2e/
    └── mcp-stdio.test.ts                   # 1 smoke end-to-end
```

### Cómo se ve `read-note`

```typescript
// src/shared/result.ts
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export const Ok  = <T>(value: T): Result<T> => ({ ok: true, value });
export const Err = (error: string): Result<never> => ({ ok: false, error });
```

```typescript
// src/notes/note.types.ts
export interface NoteMetadata { path: string; name: string; size: number; mtime: string; }
export interface NoteContent {
  metadata: NoteMetadata;
  frontmatter: Record<string, unknown>;
  body: string;
}
```

```typescript
// src/notes/note.fs.ts
import fs from 'node:fs/promises';
export const readNoteFile = (absPath: string) => fs.readFile(absPath, 'utf-8');
export const statNote     = (absPath: string) => fs.stat(absPath);
```

```typescript
// src/notes/read-note.schema.ts
import { z } from 'zod/v3';
import type { Config } from '../vaults/vault.config.js';
import { vaultParamDesc } from '../vaults/vault.resolver.js';

export const readNoteInput = (config: Config) => ({
  path: z.string().describe('Path to note'),
  vault: z.string().optional().describe(vaultParamDesc(config)),
});

export type ReadNoteInput = { path: string; vault?: string };
```

```typescript
// src/notes/read-note.handler.ts — PURO. cero MCP.
import path from 'node:path';
import type { VaultContext } from '../vaults/vault.types.js';
import { resolvePath } from '../shared/fs/paths.js';
import { assertSafePathAsync } from '../shared/security/safe-path.js';
import { parseFrontmatter } from '../frontmatter/frontmatter.parser.js';
import { Ok, Err, type Result } from '../shared/result.js';
import { readNoteFile, statNote } from './note.fs.js';
import type { NoteContent, ReadNoteInput } from './note.types.js';

export async function readNote(
  ctx: VaultContext,
  input: ReadNoteInput
): Promise<Result<NoteContent>> {
  try {
    const absPath = resolvePath(ctx.vault, input.path);
    await assertSafePathAsync(ctx.vault.path, absPath);
    const raw = await readNoteFile(absPath);
    const { frontmatter, body } = parseFrontmatter(raw);
    const stat = await statNote(absPath);
    return Ok({
      metadata: {
        path: input.path,
        name: path.basename(input.path),
        size: stat.size,
        mtime: stat.mtime.toISOString(),
      },
      frontmatter,
      body,
    });
  } catch (e) {
    return Err(e instanceof Error ? e.message : String(e));
  }
}
```

```typescript
// src/mcp/register.ts (fragmento)
import { readNote } from '../notes/read-note.handler.js';
import { readNoteInput } from '../notes/read-note.schema.js';
import { resolveVaultContext } from '../vaults/vault.resolver.js';
import { toMcpResult } from './adapter.js';

export function registerAll(server: McpServer, config: Config) {
  server.registerTool(
    'read_note',
    { description: '...', inputSchema: readNoteInput(config) },
    async ({ path, vault }) =>
      toMcpResult(await readNote(resolveVaultContext(config, vault), { path, vault }))
  );
  // ... repeat per handler
}
```

```typescript
// src/notes/__tests__/read-note.test.ts — sin MCP server
import { readNote } from '../read-note.handler.js';
import { buildVaultContext } from '../../../tests/helpers/vault-builder.js';

it('reads a note', async () => {
  const ctx = await buildVaultContext({ files: { 'foo.md': '# Hi' } });
  const result = await readNote(ctx, { path: 'foo.md' });
  expect(result.ok).toBe(true);
  expect(result.value.body).toBe('# Hi');
});
```

**Wins visibles:**
- Reader abre `src/`, ve `notes/ search/ graph/ backlinks/ frontmatter/ folders/ vaults/` → entiende producto en 5 segundos.
- Handler es función pura testeable. Schema separado.
- MCP SDK aparece en 4 archivos (`src/mcp/*`). Cero menciones en `notes/`.
- Test no instancia `McpServer` ni toca `_registeredTools`.

---

## Opción B — Hexagonal / Ports & Adapters

### Folder tree

```
src/
├── index.ts                                # bootstrap
├── domain/                                 # CENTRO — sin fs, sin MCP, sin Zod
│   ├── note/
│   │   ├── note.entity.ts                  # class Note { links(), tags() }
│   │   ├── wikilink.value.ts               # class Wikilink { matches(), replace() }
│   │   ├── tag.value.ts
│   │   └── vault.entity.ts
│   ├── graph/
│   │   └── graph.builder.ts                # BFS puro
│   └── errors.ts                           # NoteNotFound, PathEscapesVault, VaultReadOnly
├── application/                            # CASOS DE USO — orquestan dominio + ports
│   ├── ports/                              # INTERFACES ÚNICAMENTE
│   │   ├── note-repository.port.ts
│   │   ├── vault-registry.port.ts
│   │   ├── backup-store.port.ts
│   │   ├── clock.port.ts
│   │   └── logger.port.ts
│   └── use-cases/
│       ├── read-note.use-case.ts           # class ReadNoteUseCase
│       ├── create-note.use-case.ts
│       ├── ... (13 más)
│       └── get-graph.use-case.ts
├── adapters/
│   ├── inbound/
│   │   └── mcp/                            # único delivery por ahora
│   │       ├── server.ts
│   │       ├── tool-registrar.ts           # bind use-case → MCP tool
│   │       ├── result-mapper.ts
│   │       └── schemas/
│   │           ├── read-note.schema.ts
│   │           └── ...
│   └── outbound/
│       ├── filesystem/
│       │   ├── fs-note-repository.ts       # implements NoteRepository
│       │   ├── fs-backup-store.ts
│       │   ├── fs-vault-registry.ts
│       │   ├── glob.ts
│       │   └── safe-path.ts
│       └── logging/
│           └── console-logger.ts
├── composition/
│   └── container.ts                        # wiring — único lugar que toca ambos lados
└── config/
    └── config.loader.ts

tests/
├── domain/                                 # entities + VOs, zero IO
│   ├── note.entity.test.ts
│   └── wikilink.value.test.ts
├── application/
│   ├── fakes/
│   │   ├── in-memory-note-repository.ts    # implements NoteRepository en Map
│   │   ├── in-memory-backup-store.ts
│   │   └── stub-vault-registry.ts
│   └── use-cases/
│       └── read-note.use-case.test.ts      # corre contra fakes — instantáneo
├── adapters/
│   └── filesystem/
│       └── fs-note-repository.test.ts      # ~5 tests contra fs real
└── e2e/
    └── mcp-stdio.test.ts
```

### Cómo se ve `read-note`

```typescript
// src/domain/note/note.entity.ts
export class Note {
  constructor(
    public readonly path: string,
    public readonly frontmatter: Record<string, unknown>,
    public readonly body: string,
    public readonly size: number,
    public readonly mtime: Date,
  ) {}

  links(): Wikilink[]     { return Wikilink.extractFrom(this.body); }
  tags(): Tag[]           { return Tag.extractFrom(this.body, this.frontmatter); }
  get name(): string      { return this.path.split('/').pop()!; }
}
```

```typescript
// src/domain/errors.ts
export class NoteNotFound      extends Error { constructor(public path: string) { super(`Not found: ${path}`); } }
export class PathEscapesVault  extends Error {}
export class VaultReadOnly     extends Error {}
```

```typescript
// src/application/ports/note-repository.port.ts
import type { Note } from '../../domain/note/note.entity.js';
import type { Vault } from '../../domain/note/vault.entity.js';

export interface NoteRepository {
  read(vault: Vault, path: string): Promise<Note>;            // throws NoteNotFound
  write(vault: Vault, path: string, note: Note): Promise<void>;
  delete(vault: Vault, path: string): Promise<void>;
  list(vault: Vault, folder?: string): Promise<string[]>;
  exists(vault: Vault, path: string): Promise<boolean>;
}
```

```typescript
// src/application/use-cases/read-note.use-case.ts
import type { NoteRepository } from '../ports/note-repository.port.js';
import type { VaultRegistry }  from '../ports/vault-registry.port.js';
import type { Note } from '../../domain/note/note.entity.js';

export class ReadNoteUseCase {
  constructor(
    private readonly notes: NoteRepository,
    private readonly vaults: VaultRegistry,
  ) {}

  async execute(input: { path: string; vault?: string }): Promise<Note> {
    const vault = this.vaults.get(input.vault);   // throws if ambiguous
    return this.notes.read(vault, input.path);    // throws NoteNotFound
  }
}
```

```typescript
// src/adapters/outbound/filesystem/fs-note-repository.ts
import fs from 'node:fs/promises';
import { Note } from '../../../domain/note/note.entity.js';
import { NoteNotFound } from '../../../domain/errors.js';
import type { NoteRepository } from '../../../application/ports/note-repository.port.js';

export class FsNoteRepository implements NoteRepository {
  async read(vault: Vault, p: string): Promise<Note> {
    const abs = path.join(vault.root, p);
    assertSafePath(vault.root, abs);
    let raw: string;
    try { raw = await fs.readFile(abs, 'utf-8'); }
    catch (e: any) { if (e.code === 'ENOENT') throw new NoteNotFound(p); throw e; }
    const { frontmatter, body } = parseFrontmatter(raw);
    const stat = await fs.stat(abs);
    return new Note(p, frontmatter, body, stat.size, stat.mtime);
  }
  // ... write, delete, list, exists
}
```

```typescript
// src/adapters/inbound/mcp/tool-registrar.ts (fragmento)
server.registerTool('read_note', { inputSchema: readNoteSchema(config) }, async (args) => {
  try {
    const note = await container.readNote.execute(args);
    return toMcpOk(noteToDto(note));
  } catch (e) {
    return toMcpErr(e);                      // mapea NoteNotFound → "Not found"
  }
});
```

```typescript
// src/composition/container.ts
const vaultRegistry  = new FsVaultRegistry(config);
const noteRepository = new FsNoteRepository();
const backupStore    = new FsBackupStore('.obsidian-mcp-trash');

export const container = {
  readNote:   new ReadNoteUseCase(noteRepository, vaultRegistry),
  createNote: new CreateNoteUseCase(noteRepository, vaultRegistry),
  deleteNote: new DeleteNoteUseCase(noteRepository, vaultRegistry, backupStore),
  // ... 12 más
};
```

```typescript
// tests/application/use-cases/read-note.use-case.test.ts — sin fs
import { ReadNoteUseCase } from '../../../src/application/use-cases/read-note.use-case.js';
import { InMemoryNoteRepository } from '../fakes/in-memory-note-repository.js';
import { StubVaultRegistry }      from '../fakes/stub-vault-registry.js';

it('reads a note', async () => {
  const repo = new InMemoryNoteRepository({ 'foo.md': new Note('foo.md', {}, '# Hi', 4, new Date()) });
  const useCase = new ReadNoteUseCase(repo, new StubVaultRegistry());
  const note = await useCase.execute({ path: 'foo.md' });
  expect(note.body).toBe('# Hi');
});
```

**Wins visibles:**
- Dominio totalmente portable. `Note` es entidad con comportamiento (`note.links()`).
- Use cases se testean con fakes in-memory → sub-millisegundo por test.
- Swap fs → REST API real de Obsidian = escribir un nuevo `RestNoteRepository implements NoteRepository`. Cero cambio en use cases.
- Agregar HTTP transport = nuevo `adapters/inbound/http/`.

**Costos visibles:**
- 3 archivos por tool (use case + schema + binding) → 45 archivos solo para los 15 tools.
- Hay que mantener fakes paralelos a los adapters reales.
- Para 1.3 KLOC actual: dominio inventado. La mayoría de "use cases" son `vault.get() → repo.read()`. Poca lógica para proteger.

---

## Opción C — Clean-Lite (capas concéntricas)

### Folder tree

```
src/
├── index.ts                                # bootstrap
├── domain/                                 # tipos planos + helpers puros
│   ├── note.types.ts
│   ├── vault.types.ts
│   ├── graph.types.ts
│   ├── search.types.ts
│   ├── backlinks.types.ts
│   ├── wikilinks.ts                        # regex puro
│   ├── frontmatter.ts                      # gray-matter wrapper
│   └── errors.ts
├── application/
│   ├── notes/
│   │   ├── read-note.ts                    # función plana (deps, input)
│   │   ├── create-note.ts
│   │   └── ...
│   ├── search/
│   ├── graph/
│   ├── backlinks/
│   ├── folders/
│   └── vaults/
├── infrastructure/
│   ├── fs/
│   │   ├── paths.ts
│   │   ├── glob.ts
│   │   ├── safe-path.ts
│   │   └── file-size.ts
│   ├── backup/
│   │   └── trash.ts
│   ├── logger.ts
│   └── config/
│       ├── config.loader.ts
│       └── vault-resolver.ts
└── transport/
    └── mcp/
        ├── server.ts
        ├── register.ts
        ├── result-mapper.ts
        └── schemas/
            ├── read-note.schema.ts
            └── ...

tests/
├── domain/                                 # helpers puros
├── application/                            # use cases con stubs de funciones
├── infrastructure/                         # tests fs reales
└── e2e/
```

### Cómo se ve `read-note`

```typescript
// src/domain/note.types.ts
export interface NoteContent {
  metadata: { path: string; name: string; size: number; mtime: string };
  frontmatter: Record<string, unknown>;
  body: string;
}
```

```typescript
// src/application/notes/read-note.ts
import type { Vault } from '../../domain/vault.types.js';
import type { NoteContent } from '../../domain/note.types.js';
import { parseFrontmatter } from '../../domain/frontmatter.js';

// Deps = type alias plano. Sin interface, sin class.
export type ReadNoteDeps = {
  readFile: (abs: string) => Promise<string>;
  stat:     (abs: string) => Promise<{ size: number; mtime: Date }>;
  resolvePath:    (vault: Vault, p: string) => string;
  assertSafePath: (root: string, abs: string) => Promise<void>;
};

export async function readNote(
  deps: ReadNoteDeps,
  vault: Vault,
  input: { path: string },
): Promise<NoteContent> {
  const abs = deps.resolvePath(vault, input.path);
  await deps.assertSafePath(vault.path, abs);
  const raw = await deps.readFile(abs);
  const { frontmatter, body } = parseFrontmatter(raw);
  const stat = await deps.stat(abs);
  return {
    metadata: { path: input.path, name: input.path.split('/').pop()!, size: stat.size, mtime: stat.mtime.toISOString() },
    frontmatter,
    body,
  };
}
```

```typescript
// src/transport/mcp/register.ts (fragmento)
import fs from 'node:fs/promises';
import { readNote } from '../../application/notes/read-note.js';
import { resolvePath } from '../../infrastructure/fs/paths.js';
import { assertSafePathAsync } from '../../infrastructure/fs/safe-path.js';
import { resolveVault } from '../../infrastructure/config/vault-resolver.js';

const readNoteDeps = {
  readFile: (abs: string) => fs.readFile(abs, 'utf-8'),
  stat: (abs: string) => fs.stat(abs),
  resolvePath,
  assertSafePath: assertSafePathAsync,
};

server.registerTool('read_note', { inputSchema: readNoteSchema(config) }, async (args) => {
  try {
    const note = await readNote(readNoteDeps, resolveVault(config, args.vault), { path: args.path });
    return toMcpOk(note);
  } catch (e) { return toMcpErr(e); }
});
```

```typescript
// tests/application/notes/read-note.test.ts — stubs planos
import { readNote } from '../../../src/application/notes/read-note.js';

it('reads a note', async () => {
  const deps = {
    readFile: vi.fn().mockResolvedValue('---\ntags: [a]\n---\n# Hi'),
    stat:     vi.fn().mockResolvedValue({ size: 16, mtime: new Date('2025-01-01') }),
    resolvePath:    () => '/abs/foo.md',
    assertSafePath: () => Promise.resolve(),
  };
  const note = await readNote(deps, { name: 'v', path: '/v', readOnly: false, backupEnabled: true }, { path: 'foo.md' });
  expect(note.body).toBe('# Hi');
  expect(note.frontmatter.tags).toEqual(['a']);
});
```

**Wins visibles:**
- Vocabulario Clean explícito (`domain` / `application` / `infrastructure` / `transport`).
- Tests usan stubs planos — sin clases fake.
- `Deps` plano es liviano comparado con interfaces formales de Hexagonal.

**Costos visibles:**
- Folder names son de framework (`application`), no de producto (`notes`). Reader no sabe qué hace el proyecto al abrir `src/`.
- Para 1.3 KLOC: la capa `application` queda con 15 funciones que cada una hace `glob → fs.read → parse → return`. **No hay lógica para proteger** de cambios de infrastructure.
- Indirección sin payoff actual. Pagás ceremonia para flexibilidad que no usás.

---

## Comparación lado a lado del mismo handler

| Aspecto | Hoy | A — Screaming | B — Hexagonal | C — Clean-Lite |
|---|---|---|---|---|
| Archivos para `read_note` | 1 (`tools/read-note.ts`) | 2 (`handler` + `schema`) | 3 (use case + schema + binding) | 2 (`application/notes/read-note.ts` + `transport/mcp/schemas/read-note.schema.ts`) |
| Folders nuevos | — | 9 (notes, search, graph, backlinks, frontmatter, folders, vaults, shared, mcp) | 8 (domain/{note,graph}, application/{ports,use-cases}, adapters/{inbound,outbound}, composition, config) | 8 (domain, application/{notes,search,graph,backlinks,folders,vaults}, infrastructure/{fs,backup,config}, transport/mcp) |
| Test de `read_note` | Levanta `McpServer`, hackea `_registeredTools`, escribe a fs real | Llama función pura con `VaultContext` builder. Sin server. Sin fs si querés. | Instancia `ReadNoteUseCase` con `InMemoryNoteRepository`. Cero IO. | Llama función con `Deps` stub. Cero IO. |
| Domain coupling al SDK MCP | En cada tool | Solo en `src/mcp/` (4 archivos) | Solo en `adapters/inbound/mcp/` | Solo en `transport/mcp/` |
| `Note` como entidad con métodos | No | No (sigue siendo `interface`) | **Sí** (`class Note { links(), tags() }`) | No |
| Folders gritan dominio | No | **Sí** | Parcial (`domain/note/`, sí; `adapters/`, no) | No |
| Esfuerzo total estimado | — | 6 fases · S/M | 6 fases · M/L | 4 fases · S/M/L |
| Reversibilidad | — | Alta | Media (entidades + ports difíciles de revertir) | Alta |

---

## Recomendación final

**Opción A** salvo que:
- Vayas a agregar segundo transport (HTTP/SSE) en próximos 3 meses → **B**
- Vayas a soportar segundo backend (REST API contra Obsidian corriendo) → **B**
- Equipo prefiere vocabulario Clean explícito y va a crecer dominio pronto → **C**

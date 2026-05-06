# Plan de refactor — Screaming Architecture

## Context

`obsidian-mcp` (~1.3 KLOC TypeScript) es un MCP server que expone 15 tools sobre vaults de Obsidian. La forma actual mezcla en cada `src/tools/*.ts` el SDK de MCP, validación Zod, llamadas a `fs/promises`/`fast-glob`, y lógica de dominio. Los tests reach into `(server as any)._registeredTools` (`tests/tools/helpers.ts:105`) para invocar handlers — API privada del SDK.

**Refactor objetivo (Opción A — Screaming):**

- Folders top-level que **gritan dominio**: `notes/`, `search/`, `graph/`, `backlinks/`, `frontmatter/`, `folders/`, `vaults/`.
- Infra cross-feature en `shared/` (paths, security, backup, wikilinks, logger, Result).
- Único folder con `@modelcontextprotocol/sdk`: `src/mcp/`.
- Cada tool = `<name>.handler.ts` (función pura `(ctx, input) → Result<T>`) + `<name>.schema.ts` (Zod aislado).
- Tests co-localizados (`__tests__/`) llaman handler directo via `tests/helpers/invoke.ts` — adiós al hack de `_registeredTools`.

**Decisiones cerradas:**
- Backwards compat: `OBSIDIAN_VAULT_PATH` legacy se mantiene (cero ruptura). Pendiente confirmación final del usuario.
- Co-localización de tests: `__tests__/` al lado del source, NO en `tests/` paralelo.
- `Result<T>` discriminated union reemplaza el actual `ToolResult` + `ok()`/`err()`.

Documento companion con ejemplos de código por arquitectura: `docs/architecture-options.md`.

---

## Layout objetivo

```
src/
├── index.ts                                # bootstrap: loadConfig → createServer → stdio
├── notes/
│   ├── read-note.{handler,schema}.ts
│   ├── create-note.{handler,schema}.ts
│   ├── update-note.{handler,schema}.ts
│   ├── delete-note.{handler,schema}.ts
│   ├── move-note.{handler,schema}.ts
│   ├── list-notes.{handler,schema}.ts
│   ├── list-recent.{handler,schema}.ts
│   ├── note.types.ts
│   ├── note.fs.ts
│   └── __tests__/
├── search/
│   ├── search-content.{handler,schema}.ts
│   ├── search-by-tags.{handler,schema}.ts
│   ├── search.types.ts
│   ├── glob.ts
│   └── __tests__/
├── graph/
│   ├── get-graph.{handler,schema}.ts
│   ├── graph.builder.ts                    # adyacencia + BFS PURO (sin fs)
│   ├── graph.types.ts
│   └── __tests__/
├── backlinks/
│   ├── get-backlinks.{handler,schema}.ts
│   ├── backlinks.types.ts
│   └── __tests__/
├── frontmatter/
│   ├── manage-frontmatter.{handler,schema}.ts
│   ├── frontmatter.parser.ts               # gray-matter wrapper
│   └── __tests__/
├── folders/
│   ├── manage-folders.{handler,schema}.ts
│   └── __tests__/
├── vaults/
│   ├── list-vaults.{handler,schema}.ts
│   ├── vault.resolver.ts                   # resolveVault, resolveVaultsForSearch, vaultParamDesc
│   ├── vault.config.ts                     # loadConfig + Config + VaultConfig
│   ├── vault.types.ts                      # VaultContext
│   └── __tests__/
├── shared/
│   ├── fs/
│   │   ├── paths.ts                        # resolvePath, resolveDir, toRelativePath
│   │   └── glob.ts
│   ├── security/
│   │   ├── safe-path.ts                    # assertSafePath(Async), SecurityError
│   │   ├── read-only.ts                    # assertNotReadOnly, ReadOnlyError
│   │   └── file-size.ts                    # assertFileSize
│   ├── backup/
│   │   └── trash.ts                        # backupNote → .obsidian-mcp-trash/
│   ├── wikilinks/
│   │   ├── parser.ts                       # extractWikilinks, replaceWikilink
│   │   └── tags.ts                         # extractTags
│   ├── logger.ts
│   └── result.ts                           # Result<T> = Ok<T> | Err
└── mcp/
    ├── server.ts                           # createServer(config)
    ├── register.ts                         # registra todos los handlers
    ├── adapter.ts                          # toMcpResult(result) → MCP envelope
    └── transport-stdio.ts

tests/
├── fixtures/test-vault/                    # se mantiene
├── helpers/
│   ├── vault-builder.ts                    # createTestVault, seedVault, buildVaultContext
│   └── invoke.ts                           # callHandler(handler, ctx, input)
└── e2e/
    └── mcp-stdio.test.ts
```

---

## Reglas arquitectónicas

| Folder | Owns | NO debe importar |
|---|---|---|
| `notes/`, `search/`, `graph/`, `backlinks/`, `frontmatter/`, `folders/`, `vaults/` | Handlers (funciones puras), Zod schemas, tipos del feature, helpers fs locales | `@modelcontextprotocol/sdk`, otros features (no sibling imports) |
| `shared/` | Infra cross-cutting: paths, security, backup, wikilinks, logger, Result | Cualquier feature folder o `mcp/` |
| `mcp/` | Único dueño de `McpServer`. Envuelve handlers, registra schemas, mapea `Result` a envelope MCP | `node:fs` directo — solo handlers |
| `index.ts` | Composition root | Lógica de dominio |

**Multi-vault flow:** `VaultContext = { vault: VaultConfig; maxFileSize: number }` construido por `vaults/vault.resolver.ts` desde `(config, vaultName?)`. Se pasa como primer argumento a cada handler. Los handlers nunca ven el `Config` completo.

**Sibling rule:** features no se importan entre sí. Si lógica es compartida (ej. wikilinks usado por `notes/move-note` y `backlinks/`), vive en `shared/`.

---

## Fases (cada una shippable)

### Fase 1 — Result + canary `read-note` (S)

**Goal:** establecer el patrón sin tocar el resto.

Archivos nuevos:
- `src/shared/result.ts` — `Result<T>`, `Ok`, `Err`.
- `tests/helpers/invoke.ts` — `callHandler(handler, ctx, input)`.
- `tests/helpers/vault-builder.ts` — `buildVaultContext({ files })` (envuelve el actual `createTestVault` sin instanciar `McpServer`).
- `src/notes/read-note.handler.ts` — función pura extraída de `src/tools/read-note.ts`.
- `src/notes/read-note.schema.ts` — Zod aislado.
- `src/notes/note.types.ts` — `NoteContent`, `NoteMetadata` (movidos de `src/types/index.ts`).
- `src/notes/note.fs.ts` — `readNoteFile`, `statNote`.

Archivos modificados:
- `src/tools/read-note.ts` — pasa a ser un thin adapter que importa `readNote` handler y lo envuelve con `toMcpResult` (provisorio hasta Fase 6).
- `tests/tools/read-note.test.ts` — reescribir para invocar handler directo via `callHandler`. Borrar uso de `callTool`.

Verificación:
- `npx vitest run` — todos pasan.
- `npx tsc --noEmit` — sin errores.
- Smoke manual: arrancar server con vault de fixtures, llamar `read_note` desde MCP client.

### Fase 2 — Mover infra a `shared/` y `frontmatter/` (S)

**Goal:** mecánica pura. Cero cambio de comportamiento.

Movimientos:
- `src/lib/security.ts` → split en `src/shared/security/{safe-path.ts, read-only.ts, file-size.ts}`.
- `src/lib/backup.ts` → `src/shared/backup/trash.ts`.
- `src/lib/wikilinks.ts` → split en `src/shared/wikilinks/{parser.ts, tags.ts}`.
- `src/lib/logger.ts` → `src/shared/logger.ts`.
- `src/lib/frontmatter.ts` → `src/frontmatter/frontmatter.parser.ts`.
- `src/lib/vault.ts` → split: paths utilities (`resolvePath`, `resolveDir`, `toRelativePath`) → `src/shared/fs/paths.ts`; resolvers (`resolveVault`, `resolveVaultsForSearch`, `vaultParamDesc`) → `src/vaults/vault.resolver.ts`; tipo `VaultContext` → `src/vaults/vault.types.ts`.
- `src/config.ts` → `src/vaults/vault.config.ts`.
- `tests/lib/*.test.ts` → co-localizar en `__tests__/` del módulo correspondiente:
  - `tests/lib/security.test.ts` → `src/shared/security/__tests__/safe-path.test.ts` (split por concern si conviene)
  - `tests/lib/backup.test.ts` → `src/shared/backup/__tests__/trash.test.ts`
  - `tests/lib/wikilinks.test.ts` → `src/shared/wikilinks/__tests__/parser.test.ts`
  - `tests/lib/vault.test.ts` → `src/vaults/__tests__/vault.resolver.test.ts`
  - `tests/lib/frontmatter.test.ts` → `src/frontmatter/__tests__/frontmatter.parser.test.ts`

Updates:
- Todos los imports en `src/tools/*.ts` y `src/server.ts` apuntando a `lib/` y `config.ts` se actualizan.
- `vitest.config.ts` — incluir `src/**/__tests__/**/*.test.ts` además de `tests/**`.

Verificación:
- `npx vitest run` — todos pasan (es solo rename + re-import).
- `npx tsc --noEmit` — sin errores.

### Fase 3 — Migrar slice `notes/` (M)

**Goal:** completar `notes/` con los 6 tools restantes (read-note ya hecho en Fase 1).

Por cada tool en `{create-note, update-note, delete-note, move-note, list-notes, list-recent}`:
1. Crear `src/notes/<tool>.handler.ts` — función pura `(ctx, input) → Result<T>`.
2. Crear `src/notes/<tool>.schema.ts` — Zod input.
3. `src/tools/<tool>.ts` queda como thin adapter (envuelve handler con `toMcpResult`). Provisorio hasta Fase 6.
4. Mover test: `tests/tools/<tool>.test.ts` → `src/notes/__tests__/<tool>.test.ts`. Reescribir para invocar handler directo.

Atención especial:
- `delete-note` usa `shared/backup/trash.ts` y requiere `confirm: true` — schema mantiene esa validación.
- `move-note` actualiza wikilinks → importa `shared/wikilinks/parser.ts` (`replaceWikilink`).

Verificación: `npx vitest run` + `npx tsc --noEmit` después de cada tool migrado.

### Fase 4 — Migrar slices `search/`, `backlinks/`, `frontmatter/`, `folders/`, `vaults/` (M)

**Goal:** mismo patrón de Fase 3 aplicado al resto. Shippable por feature.

Por slice:

**`search/`:**
- `src/search/search-content.{handler,schema}.ts`
- `src/search/search-by-tags.{handler,schema}.ts`
- `src/search/search.types.ts` (mueve `SearchResult` desde `src/types/index.ts`)
- `src/search/glob.ts` (extrae el patrón `**/*.md` + ignore rules compartidos)
- Tests co-localizados.

**`backlinks/`:**
- `src/backlinks/get-backlinks.{handler,schema}.ts`
- `src/backlinks/backlinks.types.ts` (mueve `BacklinkResult`)
- Test co-localizado.

**`frontmatter/`:**
- `src/frontmatter/manage-frontmatter.{handler,schema}.ts`
- (`frontmatter.parser.ts` ya está desde Fase 2.)
- Test co-localizado.

**`folders/`:**
- `src/folders/manage-folders.{handler,schema}.ts`
- Test co-localizado.

**`vaults/`:**
- `src/vaults/list-vaults.{handler,schema}.ts`
- (`vault.resolver.ts`, `vault.config.ts`, `vault.types.ts` ya están desde Fase 2.)
- Test co-localizado.

Verificación por slice: `npx vitest run src/<slice>/` + `npx tsc --noEmit`.

### Fase 5 — Migrar `graph/` con builder puro (M)

**Goal:** romper `src/tools/get-graph.ts` (106 líneas mezclando IO + BFS) en partes testeables.

Archivos nuevos:
- `src/graph/get-graph.handler.ts` — orquesta: glob de archivos, lee contenido, llama a `graphBuilder.build()`, opcionalmente filtra subgrafo desde `rootNote`.
- `src/graph/get-graph.schema.ts` — Zod input (`rootNote?`, `depth?`, `vault?`).
- `src/graph/graph.builder.ts` — funciones puras: `buildAdjacency(notes)`, `bfs(graph, root, depth)`. Cero imports de `node:fs`. Recibe `{ path, links }[]`.
- `src/graph/graph.types.ts` — `GraphNode`, `GraphEdge`, `GraphData`.
- `src/graph/__tests__/get-graph.test.ts` — integration con vault de fixtures.
- `src/graph/__tests__/graph.builder.test.ts` — unit-test BFS sin fs.

Verificación:
- `npx vitest run src/graph/` — pasa, incluye nuevo `graph.builder.test.ts`.
- Output de `get_graph` byte-idéntico al actual sobre `tests/fixtures/test-vault/`.

### Fase 6 — Mover MCP adapter, eliminar `src/tools/` y hack `callTool` (S)

**Goal:** cierre. MCP queda contenido en 4 archivos.

Movimientos:
- `src/server.ts` → `src/mcp/server.ts`.
- `src/tools/index.ts` → `src/mcp/register.ts`. Imports apuntan a `src/<feature>/<tool>.handler.ts` y `src/<feature>/<tool>.schema.ts`. Cada `server.registerTool(...)` envuelve el handler con `toMcpResult`.
- Crear `src/mcp/adapter.ts` con `toMcpResult(result: Result<T>)` (consolida lo que estuvo provisorio en Fase 1-5).
- Crear `src/mcp/transport-stdio.ts` (extrae el setup de transport de `src/index.ts`).
- `src/index.ts` queda como bootstrap: `loadConfig() → createServer(config) → connectStdio(server)`.

Borrados:
- `src/tools/` completo.
- `src/lib/` (vacío después de Fase 2).
- `src/config.ts` (movido en Fase 2).
- `src/types/index.ts` (vacío después de Fase 4 — todos los tipos ya distribuidos).
- `tests/tools/helpers.ts::callTool` y `tests/tools/helpers.ts::parseResult` — reemplazados por `tests/helpers/invoke.ts`.
- `tests/tools/helpers.ts` completo si queda vacío. `createTestVault` debe quedar en `tests/helpers/vault-builder.ts`.

Archivos nuevos:
- `tests/e2e/mcp-stdio.test.ts` — boota `createServer()` real, conecta vía MCP client (`Client` del SDK), invoca `read_note` round-trip, valida envelope.

Updates:
- `tsconfig.json` — verificar `include` cubre `src/**/*.ts`.
- `vitest.config.ts` — patrón final `src/**/__tests__/**/*.test.ts` + `tests/e2e/**/*.test.ts`.
- `package.json` — scripts (`build`, `test`) deben seguir funcionando sin cambios; verificar `bin` apunta a `dist/index.js`.

Verificación final:
- `npx vitest run` — todos los tests (unit + e2e) pasan.
- `npx tsc --noEmit` — sin errores.
- `npx eslint .` — sin errores.
- `npm run build && node dist/index.js` con `OBSIDIAN_VAULT_PATH=tests/fixtures/test-vault` — server arranca, expone los 15 tools.
- Smoke MCP client: `read_note`, `search_content`, `get_graph`, `list_vaults`.

---

## Archivos críticos a tocar

| Path actual | Acción |
|---|---|
| `src/index.ts` | Mantener; updates de import en Fase 6 |
| `src/server.ts` | Mover a `src/mcp/server.ts` (Fase 6) |
| `src/config.ts` | Mover a `src/vaults/vault.config.ts` (Fase 2) |
| `src/types/index.ts` | Splitear en 5 (Fase 1-4); borrar (Fase 6) |
| `src/lib/vault.ts` | Splitear: `shared/fs/paths.ts` + `vaults/vault.resolver.ts` + `vaults/vault.types.ts` (Fase 2) |
| `src/lib/security.ts` | Splitear en `shared/security/{safe-path,read-only,file-size}.ts` (Fase 2) |
| `src/lib/backup.ts` | Mover a `shared/backup/trash.ts` (Fase 2) |
| `src/lib/wikilinks.ts` | Splitear en `shared/wikilinks/{parser,tags}.ts` (Fase 2) |
| `src/lib/frontmatter.ts` | Mover a `frontmatter/frontmatter.parser.ts` (Fase 2) |
| `src/lib/logger.ts` | Mover a `shared/logger.ts` (Fase 2) |
| `src/tools/index.ts` | Mover a `src/mcp/register.ts` (Fase 6) |
| `src/tools/read-note.ts` | Splitear en handler+schema (Fase 1); thin adapter; borrar (Fase 6) |
| `src/tools/{create,update,delete,move,list,list-recent}-note.ts` | Splitear (Fase 3); borrar (Fase 6) |
| `src/tools/search-{content,by-tags}.ts` | Splitear (Fase 4); borrar (Fase 6) |
| `src/tools/get-backlinks.ts` | Splitear (Fase 4); borrar (Fase 6) |
| `src/tools/manage-frontmatter.ts` | Splitear (Fase 4); borrar (Fase 6) |
| `src/tools/manage-folders.ts` | Splitear (Fase 4); borrar (Fase 6) |
| `src/tools/list-vaults.ts` | Splitear (Fase 4); borrar (Fase 6) |
| `src/tools/get-graph.ts` | Splitear handler + builder puro (Fase 5); borrar (Fase 6) |
| `tests/tools/helpers.ts` | `callTool` → `tests/helpers/invoke.ts::callHandler`; `createTestVault` → `tests/helpers/vault-builder.ts`; borrar (Fase 6) |
| `tests/lib/*.test.ts` | Co-localizar en `src/<module>/__tests__/` (Fase 2) |
| `tests/tools/*.test.ts` | Co-localizar en `src/<feature>/__tests__/` (Fase 1, 3, 4, 5) |
| `vitest.config.ts` | Update glob (Fase 2 + Fase 6) |
| `tsconfig.json` | Verificar include (Fase 6) |

---

## Verificación end-to-end

Por fase, todas obligatorias antes de mergear:

1. `npx vitest run` — verde.
2. `npx tsc --noEmit` — sin errores.
3. `npx eslint .` — sin errores.

Adicionales cierre Fase 6:
4. `npm run build` — compila `dist/`.
5. `OBSIDIAN_VAULT_PATH=tests/fixtures/test-vault node dist/index.js` — arranca sin fatal.
6. **E2E:** `tests/e2e/mcp-stdio.test.ts` invoca round-trip con MCP client real.
7. Smoke manual con Claude Desktop o `mcp-cli`: confirmar `read_note`, `search_content`, `get_graph`, `list_vaults`.

**Reglas de no-regresión durante todo el refactor:**
- Forma del input/output de cada tool MCP idéntica (los Zod schemas no cambian de shape).
- `OBSIDIAN_CONFIG` y `OBSIDIAN_VAULT_PATH` legacy siguen funcionando.
- `.obsidian-mcp-trash/` sigue siendo el target de backup en `delete-note`.
- Nombres de tools sin cambios (`read_note`, `create_note`, etc.).

---

## Pendientes antes de ejecutar

1. **Confirmar legacy `OBSIDIAN_VAULT_PATH`:** mantener (default), deprecar con warning, o romper. Default elegido: mantener.
2. **Ramas / commits:** una rama por fase (`refactor/screaming-fase-1`, etc.) o una sola rama con commits granulares. Sugerencia: una rama, commits por fase, PRs separados si el equipo lo quiere review-able.
3. **CI:** validar que GitHub Actions (`.github/workflows/`) corra sobre el nuevo glob de vitest tras Fase 2.

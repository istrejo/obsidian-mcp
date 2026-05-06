# Plan: soporte publicable de Codex para `obsidian-mcp`

## Summary

- Mantener compatibilidad Claude intacta y sumar soporte Codex **stdio-only**.
- Default público para Codex: **read-only primero**; escritura solo con opt-in explícito.
- Codex support se documenta para paquete publicado y para desarrollo local sin depender de `dist/` stale.
- Evidencia inicial verificada: `npm test` pasó, `npm run typecheck` pasó, Codex carga el MCP pero el vault fuera del workspace puede fallar por sandbox/macOS (`EPERM`).

## Key Changes

- README público con sección “For Codex”, comando `codex mcp add`, configuración read-only por defecto y variante write-enabled.
- `.codex/config.example.toml` seguro, sin rutas privadas, con `npx -y @istrejo/obsidian-mcp`.
- `.codex/config.toml` real queda ignorado porque contiene rutas locales por máquina.
- Smoke test MCP real usando `@modelcontextprotocol/sdk` client + `StdioClientTransport`.
- Test estático para evitar filtrar rutas privadas o apuntar el template a `dist/index.js`.

## Codex Defaults

Codex debe instalarse read-only primero:

```bash
codex mcp add obsidian \
  --env OBSIDIAN_VAULT_PATH=/absolute/path/to/your/vault \
  --env OBSIDIAN_READ_ONLY=true \
  -- npx -y @istrejo/obsidian-mcp
```

Para habilitar escrituras:

1. Cambiar `OBSIDIAN_READ_ONLY=false`.
2. Autorizar el vault en el sandbox de Codex con `--add-dir /absolute/path/to/your/vault` o con `sandbox_workspace_write.writable_roots`.

## Test Plan

- `npm test`
- `npm run typecheck`
- No correr build local después de cambios; CI/release ya ejecutan `npm run build`.
- Manual Codex check:
  - `codex mcp list`
  - `codex mcp get obsidian`
  - abrir Codex y verificar `/mcp`
  - probar lectura sobre vault permitido por sandbox.

## References

- [Codex MCP](https://developers.openai.com/codex/mcp)
- [Codex sandboxing](https://developers.openai.com/codex/concepts/sandboxing)
- [Codex config reference](https://developers.openai.com/codex/config-reference)
- [Codex CLI flags](https://developers.openai.com/codex/cli/reference)

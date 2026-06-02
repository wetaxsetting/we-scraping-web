# Frontend Project Rules

The authoritative, living frontend rules for `wecms-web` are maintained in the
project's AI/developer guide at the project root — read these first:

- ➡️ [../AGENTS.md](../AGENTS.md) — **Next.js 16 differs from earlier versions**; read before writing code.
- ➡️ [../CLAUDE.md](../CLAUDE.md) — full frontend conventions (routing, hooks, Axios mappers,
  View Setting registry, typography tokens, identifier-naming slugs, known contract mismatches).

Cross-tree / workspace rules (layout, write boundaries, typography source of truth):
➡️ [../../CLAUDE.md](../../CLAUDE.md)

### Quick reference

- **Routing & identifiers** — kebab-case slugs only; never echo legacy JEX WSVC ids
  (`comm_0220_001`, …). See [screen-flows/page-mapping.md](references/page-mapping/page-mapping.md).
- **Typography** — semantic Tailwind tokens (`text-page-title`, `text-section-title`, …);
  no arbitrary `text-[14.5px]` or inline `style={{ fontFamily }}`. Source of truth: workspace CLAUDE.md.
- **API client** — Axios; `UPPER_SNAKE`/`snake_case` wire → camelCase mappers. Talks only to `wecms-api`.

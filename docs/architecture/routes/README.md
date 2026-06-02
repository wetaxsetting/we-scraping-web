# frontend/routes/

Next.js route design for `wecms-web`.

## Purpose

Per-route documentation: URL path, layout, route guard, loaders, search params, and the parent screen ID used by View Setting.

## Naming convention

- Route slug is **kebab-case** and must match the feature slug under [`../../features/`](../../features/).
- Never use legacy JEX WSVC ids (`comm_0220_001`, …) as route segments — refactor uses slug identifiers everywhere per workspace CLAUDE.md.

## What goes here

- One markdown per route group, mirroring the App Router file tree
- Cross-link to the page-level component design in [`../components/`](../components/) and hooks in [`../hooks/`](../hooks/)

## Related

- Components: [`../components/`](../components/)
- Hooks: [`../hooks/`](../hooks/)
- State: [`../state-management/`](../state-management/)
- View Setting (global): [`../view-setting/`](../view-setting/)

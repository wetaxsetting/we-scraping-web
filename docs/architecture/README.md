# Architecture — wecms-web

Cross-cutting frontend architecture for the Next.js 16 `wecms-web` app — the system-wide concerns that span features (chrome, routing, hooks, state, API integration, View Setting). Per-feature / per-screen design lives under [../features/](../features/).

## Contents

| Folder | What goes here |
|---|---|
| [routes/](routes/) | App Router structure, route groups `(auth)` / `(dashboard)`, route constants ([`lib/routes.ts`](../../lib/routes.ts)), slug-based routing rules |
| [components/](components/) | Component / layout architecture — shell (`AppShell`, `Header`, `Sidebar`), shared components, shadcn primitives |
| [hooks/](hooks/) | Cross-feature hooks (`usePagination`, `useApiData`, `useTableSort`, `useExcelExport`, …) |
| [state-management/](state-management/) | Client state strategy — `localStorage` auth/locale, providers (`LocaleProvider`, `DialogProvider`); no Redux/Zustand/react-query |
| [integrations/](integrations/) | API integration mapping — JEX WSVC → Spring REST → Next.js fetcher; Axios + JWT interceptor; mappers (snake_case wire ↔ camelCase) |
| [view-setting/](view-setting/) | Global column visibility / order / size feature — shared `<ViewSettingPopover>` + `useViewSetting(webSvcId)` + per-page registry ([`lib/viewSettingScreens.ts`](../../lib/viewSettingScreens.ts)) |

## What does NOT go here

- Per-feature page design → [../features/](../features/)
- Reference material (page-mapping, screen-flows) → [../references/](../references/)
- Backend REST / DB / migration design → maintained in the separate `wecms-api` backend repo (not included in this clone).
- JEX UI / JSP reference — legacy JEX source, read-only in the original system (not included in this repository).

## Typography & tokens

UI **must** follow the global typography rules documented in the in-repo frontend guide [../../CLAUDE.md](../../CLAUDE.md) (font family `Inter, Noto Sans KR, …`, base 13px, Tailwind tokens under `@theme inline` — `text-wb-*`, `tracking-wb-*`). No arbitrary `text-[14.5px]` or inline `style={{ fontFamily: ... }}`.

View Setting is a global/common feature consumed by every list page across all modules — never per-feature. See [view-setting/](view-setting/) and wecms-web/CLAUDE.md §13.

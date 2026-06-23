# Common > View Setting (Screen Options) — Summary (Frontend)

> ⚠️ This document is a high-level feature summary.
> The detailed source of truth is located in:
> `docs/features/common/view-setting/`

**Domain:** `common` (global, screen-agnostic) · **Slug:** `view-setting`
**Status:** ✅ Implemented — shared component + hook; first wired screen `banking-account-inquiry-vnd`.

## Feature overview

A toolbar "list-view" icon opens the View Setting popover (Figma 100:13382) on any list page — toggle column
visibility, reorder, **Save**, or **Reset**. One shared popover + one shared hook + one API surface + a per-page
registry. Adopting a new page is a registry entry + a backend seed, never a fork.

| Piece | Source |
|---|---|
| `<ViewSettingPopover>` | `components/shared/view-setting/ViewSettingPopover.tsx` |
| `useViewSetting(screenId, dymAreaId?)` / `useViewSettingColumns()` | `components/shared/view-setting/` |
| `SCREEN_IDS` registry | `lib/viewSettingScreens.ts` |
| API client | `lib/api/screenOption.ts` |

Special columns `CHECKBOX`/`ETC` are hidden in the popover and locked server-side. `SIZE` (column width) is
**not yet consumed** end-to-end — layout widths come from Figma → Tailwind tokens today.

## Detailed documentation

| Doc | Scope |
|---|---|
| [view-setting/README.md](view-setting/README.md) | Folder hub + document index |
| [view-setting/screen-flow.md](view-setting/screen-flow.md) | popover open → toggle/reorder → Save/Reset/Cancel |
| [view-setting/ui-specification.md](view-setting/ui-specification.md) | popover layout, tokens, locked/disabled rendering |
| [view-setting/component-index.md](view-setting/component-index.md) | shared components + hooks + props |
| [view-setting/api-consumption.md](view-setting/api-consumption.md) | screen-option calls, local-state-until-Save |
| [view-setting/test-scenarios.md](view-setting/test-scenarios.md) | user flows + error + a11y |

## Related

- Backend twin: [`../../../../wecms-api/docs/features/common/view-setting/README.md`](../../../../wecms-api/docs/features/common/view-setting/README.md)
- Architecture: [`../../architecture/view-setting/README.md`](../../architecture/view-setting/README.md)

# Common > View Setting (Screen Options) — Frontend Feature Spec

**Domain:** `common` (global, screen-agnostic)
**Refactor slug:** `view-setting`
**Status:** Working — shared component + hook; first wired screen `banking-account-inquiry-vnd`.
**Backend counterpart:** [`../../../../wecms-api/docs/features/common/view-setting.md`](../../../../wecms-api/docs/features/common/view-setting.md)
**Architecture:** [`../../architecture/view-setting/README.md`](../../architecture/view-setting/README.md)
**JEX functional reference (read-only):** [`../../../../docs/jex/features/view-setting.md`](../../../../docs/jex/features/view-setting.md)

> Created 2026-06-01 to resolve **OQ-DOC-2**. This is the feature spine; the hook contract / dialog UX
> / cache strategy live in the architecture doc above. Documents an already-implemented global
> feature — no new scope. Per memory `feedback_view_setting_global`, View Setting is a shared
> component + hook + API + per-page registry; never per-page or Sprint-1-only.

## Overview

A toolbar "list-view" icon on any list page opens the View Setting popover (Figma 100:13382). It lists
the columns available for that screen and lets the user toggle visibility, reorder, **Save**, or
**Reset** to system defaults. One shared popover + one shared hook + one API surface — adopting a new
page is a registry entry + a backend seed, never a fork.

## Shared building blocks

| Piece | Responsibility |
|---|---|
| `<ViewSettingPopover>` (a.k.a. `<ViewSettingDialog>`) | The shared popover UI — toggle / drag-reorder / Save / Reset / Cancel |
| `useViewSetting(screenId, dymAreaId?)` | Loads merged columns, holds local working copy, persists on Save |
| `lib/viewSettingScreens.ts` (`SCREEN_IDS`) | Single source of truth for the `screenId` roster (`banking-account-inquiry-vnd`, …) |
| Per-page registry | Maps `screenId` → allowed columns / labels for the owning feature |

## API Integration

| Action | Call |
|---|---|
| Load merged columns | `GET /api/v1/screen-options/{screenId}/{dymAreaId}` |
| Save user overrides | `PUT /api/v1/screen-options/{screenId}/{dymAreaId}` |
| Reset to defaults | `DELETE /api/v1/screen-options/{screenId}/{dymAreaId}` |
| List areas (multi-area pages) | `GET /api/v1/screen-options/{screenId}/areas` |

- **`screenId`** — route-based kebab-case from `SCREEN_IDS` (`<module>-<page>[-<type>]`); never a legacy JEX id.
- **`dymAreaId`** — required; single-area pages send `default`.
- Toggles / reorders are **local state only** until Save. Cancel / ESC / outside-click discards with no network call.
- **Special columns** — `CHECKBOX` / `ETC` are hidden in the popover and locked server-side; the frontend filters them via `isSpecialViewSettingField(...)`.
- `DISP_YN='N'` columns are excluded from the popover (mirrors the backend filter).

## UX rules

- The popover renumbers `DISP_ORD` densely from 1 after every reorder (the backend trusts this for non-special columns).
- `FIX_YN='Y'` columns render their checkbox `disabled` (backend enforces `USE_YN='Y'` regardless).
- Save sends the **full** merged column list (including hidden rows) so order survives across saves.
- Typography / tokens per workspace CLAUDE.md §"Global Typography" — no ad-hoc font sizes.

## Adopting a new page (frontend checklist)

1. Add the `screenId` to `lib/viewSettingScreens.ts`.
2. Mount `<ViewSettingPopover>` on the list toolbar and call `useViewSetting(screenId)`.
3. Ensure the backend seed migration ships the column set (see backend spec).

> SIZE (column width) is **not yet consumed** end-to-end — layout widths come from Figma → Tailwind
> tokens today (memory `project_view_setting_size_deferred`).

## Related

- Backend spec: [`../../../../wecms-api/docs/features/common/view-setting.md`](../../../../wecms-api/docs/features/common/view-setting.md)
- Architecture: [`../../architecture/view-setting/README.md`](../../architecture/view-setting/README.md)
- JEX functional reference: [`../../../../docs/jex/features/view-setting.md`](../../../../docs/jex/features/view-setting.md)

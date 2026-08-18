# Settings › Chart of Accounts — Frontend Feature (wecms-web)

**Slug:** `chart-of-accounts`
**Panel home:** [`components/settings/chart-of-accounts/`](../../../../components/settings/chart-of-accounts/)
**Mounts in:** Settings modal (`<SettingsModal>` → `<SettingsNav>` → `<ChartOfAccountsPanel>`) — **no top-level route**.
**Backend:** [`/api/v1/settings/chart-of-accounts`](../../../../../wecms-api/docs/features/settings/chart-of-accounts/interface-specification.md)
**Status:** Implemented full-stack (calls live endpoints, no mock fallback) — SIT/UAT verified.

> This folder is the **primary frontend documentation home** for Chart of Accounts. It documents the **shipped UI**, not the pre-implementation design. The older design spec [../chart-of-accounts.md](../chart-of-accounts.md) is preserved for traceability but is superseded here (it predates the implemented behaviour — e.g. it described Excel upload as "Phase 2 inert" and depth as 4 levels; the shipped panel wires upload live and the cap is 3).

---

## Documentation index

| File | Contents |
|---|---|
| [README.md](README.md) | This file — overview + index + cross-links |
| [screen-flow.md](screen-flow.md) | Panel composition + navigation + per-action UI flow |
| [ui-specification.md](ui-specification.md) | Grid columns, inline create/edit form, search/filter, import dialog, bulk actions |
| [component-index.md](component-index.md) | Component / hook / type / API-client / i18n inventory |
| [api-consumption.md](api-consumption.md) | Exact endpoints called, request/response shapes, error handling |
| [test-scenarios.md](test-scenarios.md) | UI SIT/UAT scenarios |

---

## At a glance

- **Single inline-edit table** (no separate dialog) — add/edit happens in a `<tbody>` form row, matching legacy `comm_0223_001_view.jsp`.
- **Two-level tree render** — restricted roots (ACC-01/02/03) as bold group rows, all else as indented child rows; indentation by `chart_acct_level` (16px/level).
- **Bulk Delete + Bulk Deactivate** via header buttons (checkbox selection on child rows only). **No bulk Activate** (matches backend — re-activate one row at a time via the inline edit status dropdown).
- **Excel Upload** dialog: download per-locale template → browse → SheetJS parse + per-row validate (incl. **depth ≤ 3**) → `POST /bulk-upload`. **No Excel export** (only template download).
- **No View Setting popover** (OQ-6 — legacy panel has no list-icon button); slug reserved in `viewSettingScreens.ts`.
- **Keyword search only** — no separate status/parent/type filter dropdowns; in-memory filtering across child rows.

---

## Cross-links

- **Backend feature docs:** [../../../../../wecms-api/docs/features/settings/chart-of-accounts/](../../../../../wecms-api/docs/features/settings/chart-of-accounts/)
- **Interface spec (endpoints):** [../../../../../wecms-api/docs/features/settings/chart-of-accounts/interface-specification.md](../../../../../wecms-api/docs/features/settings/chart-of-accounts/interface-specification.md)
- **Final parity audit:** [../../../../../wecms-api/docs/audits/legacy-parity/chart-of-accounts-final-parity-audit.md](../../../../../wecms-api/docs/audits/legacy-parity/chart-of-accounts-final-parity-audit.md)
- **Original design spec (preserved):** [../chart-of-accounts.md](../chart-of-accounts.md)
- **Legacy JEX dossier:** read-only reference under `docs/jex/features/chart-of-accounts/` (workspace root).

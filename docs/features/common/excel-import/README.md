# Excel Import (Frontend)

**Part of:** Common → excel-import
**Last verified:** 2026-06-23

Hub for the WeCMS refactor **Excel Import** UI — the shared "Download template → Browse / Re-Select file → Preview rows with per-cell error highlights → Upload" modal used by several Settings (and Payment) screens.

## Architecture in one line

> **A shared FRONTEND shell (`<ExcelUploadDialog>`) + per-feature wrappers. The backend is per-feature, NOT shared** (open decision C3 — see the backend twin).

The frontend half **is** genuinely shared: the modal shell, step panel, preview table region, error-cell tinting, and summary chips all live in one component. Per-feature wrappers supply only translated chrome, the `columns` config (with `widthPx`), the parsed `rows`, counts, and handlers. Forking the shell is forbidden per `wecms-web/CLAUDE.md` §3a.

The backend, by contrast, has no shared import service — each owning feature exposes its own endpoints. The frontend wrapper for each feature points at that feature's own backend.

## Documents

| Doc | Scope |
|---|---|
| [screen-flow.md](screen-flow.md) | Download template → Browse → Preview (error cells) → Upload |
| [ui-specification.md](ui-specification.md) | Shared modal shell, step panels, preview table region, summary chips, brand-green trigger |
| [component-index.md](component-index.md) | `<ExcelUploadDialog>`, `templateValidator`, `<ExcelUploadButton>`, `lib/xlsxReader`, per-feature wrappers |
| [api-consumption.md](api-consumption.md) | preview + import calls per owning feature; rows swap mock → parsed once API lands |
| [test-scenarios.md](test-scenarios.md) | wrong template, bad header, error-cell highlight, disabled Upload until valid |

## Related

- **Backend twin:** [`../../../../../wecms-api/docs/features/common/excel-import/README.md`](../../../../../wecms-api/docs/features/common/excel-import/README.md)
- **Authoritative shared-shell rules:** `wecms-web/CLAUDE.md` §3a "Excel Upload preview modals — shared shell, configurable columns, never per-page"
- **Common features hub:** [`../README.md`](../README.md)
- **Owning features (table-specific validation lives there — not duplicated here):**
  - Purpose — [`../../settings/purpose.md`](../../settings/purpose.md) · [`../../settings/purpose/`](../../settings/purpose/)
  - VAS Account — [`../../settings/vas-account.md`](../../settings/vas-account.md) · [`../../settings/vas-account/`](../../settings/vas-account/)
  - Chart of Accounts — [`../../settings/chart-of-accounts.md`](../../settings/chart-of-accounts.md) · [`../../settings/chart-of-accounts/`](../../settings/chart-of-accounts/)
  - Contacts — [`../../settings/contacts.md`](../../settings/contacts.md) · [`../../settings/contacts/`](../../settings/contacts/)

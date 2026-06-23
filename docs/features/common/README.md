# features/common/ (Frontend)

**Cross-cutting system domain** — shared, screen-agnostic UI features reused by every menu group
(Banking / Payment / Add-on / Settings). Not a WeCMS top-menu group; a **system feature group**. Formalized
2026-06-01 (OQ-DOC-2); standardized into per-module folders 2026-06-23.

## Doc convention (read first)

Each module has a `{module}/` **folder** with the authoritative 6-file frontend detail
(`README` · `screen-flow` · `ui-specification` · `component-index` · `api-consumption` · `test-scenarios`).
`view-setting` also keeps a flat `view-setting.md` summary with a banner pointing into the folder. When a
summary and the folder disagree the **folder wins**; when either disagrees with the **code, the code wins**.

Status legend: ✅ Implemented · 🟡 Partial · ⚪ Supporting (frontend handling exists; not a page).

## Common modules → docs

| # | Module | Folder | Status (frontend) |
|---|---|---|---|
| 1 | View Setting (Screen Options) | [view-setting/](view-setting/README.md) · [view-setting.md](view-setting.md) | ✅ shared popover + `useViewSetting` + registry |
| 2 | Audit Log (read-view) | [audit-log/](audit-log/README.md) | ✅ `AuditLogsDialog` (host supplies pre-translated rows) |
| 3 | Excel Export | [excel-export/](excel-export/README.md) | ✅ `lib/excel.ts` + `useExcelExport` + `PageActionButtons showExcel` |
| 4 | Excel Import | [excel-import/](excel-import/README.md) | ✅ shared `<ExcelUploadDialog>` shell + per-feature wrappers |
| 5 | File Management | [file-management/](file-management/README.md) | ✅ `lib/file.ts downloadFile` + `AttachmentsSection` + `DownloadIcon` |
| 6 | Notification | [notification/](notification/README.md) | ✅ header bell + slide-over (`components/layout/notifications/`) on `lib/api/notification.ts` |
| 7 | Navigation | [navigation/](navigation/README.md) | ✅ `Sidebar`/`Header`/`useNavigation` from `GET /api/v1/navigation` |
| 8 | Common Code / Lookup | [common-code-lookup/](common-code-lookup/README.md) | ✅ `SearchSelect`/`PurposeSelect`/`ReportingAccountSelect` + `lib/api/countries.ts` |
| 9 | Table Sort | [table-sort/](table-sort/README.md) | ⚪ `useTableSort` + `TableHeaderCell` (DB-side sort) |
| 10 | Dialog / Popup | [dialog-popup/](dialog-popup/README.md) | ✅ `useDialog`/`SystemDialog` + shadcn `stackLevel` ladder |
| 11 | Error Envelope | [error-envelope/](error-envelope/README.md) | ⚪ axios interceptor + `ApiCallError` + error dialogs |

## Cross-linked — owned by a domain (no Common folder)

| Capability | Real owner | Doc |
|---|---|---|
| Approval | Payment `approval-box` + Settings `approval-line`; shared `components/shared/approver/*` | [../payment/approval-box/README.md](../payment/approval-box/README.md) · [../settings/approval-line/README.md](../settings/approval-line/README.md) |
| Reporting Account | Settings `chart-of-accounts`; shared `ReportingAccountSelect` | [../settings/chart-of-accounts/README.md](../settings/chart-of-accounts/README.md) |
| Attachment (concrete UI) | Settings `contacts` (`AttachmentsSection`) | [../settings/contacts/README.md](../settings/contacts/README.md) (shared mechanics in [file-management/](file-management/README.md)) |

## DEAD / MISSING

- **Dashboard** — ❌ MISSING (no refactor page; feature modules own their layouts). README note only; no stub.
- **Notification** — the earlier refactor-only `NOTIFICATION` table was removed 2026-06-10; the live feature is BLTB-backed. Do not document the removed shape.

## What does NOT live here

- Per-table column lists → the owning feature spec under `../banking/` / `../payment/` / `../addon-service/` / `../settings/`.
- Hook / dialog architecture detail → [`../../architecture/`](../../architecture/) (incl. [`view-setting/`](../../architecture/view-setting/README.md)).

## Related (backend + audit baseline)

- Backend Common hub: [`../../../../wecms-api/docs/features/common/README.md`](../../../../wecms-api/docs/features/common/README.md)
- Audit deliverables: [`../../../../wecms-api/docs/audits/common-docs-audit.md`](../../../../wecms-api/docs/audits/common-docs-audit.md) · [`common-gap-analysis.md`](../../../../wecms-api/docs/audits/common-gap-analysis.md) · [`common-source-index.md`](../../../../wecms-api/docs/audits/common-source-index.md)

## Naming traceability

Every Common slug matches its backend counterpart under
[`../../../../wecms-api/docs/features/common/`](../../../../wecms-api/docs/features/common/). Routes and slugs are
kebab-case; never legacy JEX WSVC ids.

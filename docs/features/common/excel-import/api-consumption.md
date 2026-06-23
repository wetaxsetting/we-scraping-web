# Excel Import — API Consumption (Frontend)

**Part of:** Common → excel-import
**Last verified:** 2026-06-23

How the per-feature wrappers talk to the backend. There is **no shared frontend import client** because there is **no shared backend import service** — each wrapper calls its own feature's endpoints. Wire format is lowercase snake_case (global rule); the wrapper maps wire → camelCase at the boundary.

## Canonical two-step (Purpose Settings · VAS Account)

| Step | Call | Body | Response |
|---|---|---|---|
| Preview | `POST /api/v1/settings/{feature}/excel/preview` | `multipart/form-data`, `file` part | preview rows + `total_count` / `completed_count` / `error_count` |
| Import | `POST /api/v1/settings/{feature}/excel/import` | JSON rows ( + `upld_optn` for VAS ) | `inserted_count` ( + `replaced_count` for VAS ) |

- **Purpose:** `/api/v1/settings/purpose-settings/excel/preview` + `/import`. Import body = `{ rows: [...] }` (append only).
- **VAS Account:** `/api/v1/settings/vas-account/excel/preview` + `/import`. Import body carries `upld_optn` = `"A"` (append) or `"R"` (reset-and-replace).

The preview response drives the dialog directly: each preview row's per-cell `errors[]` map onto `ExcelUploadRow.cells[colId].error` + `errorMessage`; `completed_count` / `error_count` feed the summary chips.

## Variant (Chart of Accounts · Contacts) — client parse, no server preview

These wrappers parse the workbook in the browser (`lib/xlsxReader` + `templateValidator`), build the preview locally, then post JSON:

- **Chart of Accounts:** `POST /api/v1/settings/chart-of-accounts/bulk-upload` (per-row, non-atomic). **No server preview call.**
- **Contacts:** `POST /api/v1/settings/contacts/excel/import` (per-row, non-atomic, always 200 with partial `errors[]`); optionally preceded by `POST .../excel/preflight` (duplicate pre-check) and `POST .../excel/resolve-recipients` (bank/recipient resolution for the preview).

## Mock → parsed transition

Per CLAUDE.md §3a, wrappers ship with **static mock `rows`** during UI build (e.g. Chart of Accounts: 5 columns, 6 mock rows, 5 error cells, default-disabled Upload). When the API lands, swap the mock `rows` for the parsed/preview response — **the shell shape does not change**. Handlers (`onDownload`, `onReSelect`, `onUpload`) are optional during static UI; the shell renders inert buttons when omitted.

## Error surfacing

- Client validation failures (`templateValidator` reasons) and server business errors (`WBE2041/2042/2043` from canonical preview) surface through `useDialog()` with `type:"error"` (file-type / validation errors are **errors**, never warnings — CLAUDE.md dialog-variant rule).
- Successful import → `type:"success"` dialog.
- Destructive VAS "Reset and replace" → standard blue `type:"confirmation"` (NOT red `destructive` — CLAUDE.md §3a forbids red for Excel-replace).

## Related

- [component-index.md](component-index.md) · [screen-flow.md](screen-flow.md) · [README.md](README.md)
- Backend interface (exact DTOs + codes): [`../../../../../wecms-api/docs/features/common/excel-import/interface-specification.md`](../../../../../wecms-api/docs/features/common/excel-import/interface-specification.md)

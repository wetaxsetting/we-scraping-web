# File Management — Common Pattern (Frontend)

**Part of:** Common → file-management
**Last verified:** 2026-06-23

Shared frontend file **upload + download + attachment** pattern for `wecms-web`. Documentation only.

> **KEY FRAMING — there is NO generic attachments page or endpoint.** File upload/download is a Common **pattern**: a shared authenticated blob-download helper (`lib/file.ts`), a shared download glyph, and per-feature attachment UI. The only concrete attachment UI today is the **Contacts Add/Edit dialog's `AttachmentsSection`** (Settings → contacts); the ERP file download lives in Settings → erp-transaction-history. This hub documents the shared primitives and cross-links the owning features — it does not duplicate contacts/ERP screens.

## What this covers

- The shared authenticated download helper `lib/file.ts` `downloadFile(url, fallback)` — XHR-blob, JWT-aware, JSON-error-envelope sniffing.
- The shared download glyph `<DownloadIcon>` (Payment list rows) and the file-card icon/button sizing rules.
- The attachment UI pattern in `AttachmentsSection` — staged add-mode vs immediate edit-mode, client-side limits + allow-list (mirroring the backend), error routing through `useDialog()`.
- The multipart upload + blob download API-consumption contract.

## What this does NOT cover (owned elsewhere)

- Contacts CRUD / list / dialog composition → Settings → contacts.
- ERP transaction-history list / counts / tabs → Settings → erp-transaction-history.
- Excel/XLSX **export** of list data → the shared `lib/excel.ts` + `useExcelExport()` (a different "produce a file" feature).

## Documents index

| Doc | Purpose |
|---|---|
| [screen-flow.md](screen-flow.md) | Attach in add-mode (staged → upload after create), edit-mode (immediate), download click |
| [ui-specification.md](ui-specification.md) | File card, download button + icon sizes, ico-excel / ico-download assets |
| [component-index.md](component-index.md) | `lib/file.ts`, `<DownloadIcon>`, `AttachmentsSection`, ExcelUpload trigger relationship |
| [api-consumption.md](api-consumption.md) | Multipart upload, blob download + Content-Disposition + JSON-error sniff, 10MB/50MB limits, allow-list |
| [test-scenarios.md](test-scenarios.md) | Add-mode / edit-mode / oversize / bad-extension / download-error cases |

## Related

- Common hub: [`../README.md`](../README.md)
- API twin: [`../../../../../wecms-api/docs/features/common/file-management/README.md`](../../../../../wecms-api/docs/features/common/file-management/README.md)
- Owning feature — Contacts: [`../../settings/contacts/README.md`](../../settings/contacts/README.md)
- Owning feature — ERP Transaction History: no frontend feature-doc folder exists under `wecms-web/docs/features/` today (the feature is API-side + a Settings panel); see the API twin's ERP cross-links. Menu/permission slug is `settings-erp-transaction-history`.
- Sibling Common feature — Excel export: [`../excel-export/README.md`](../excel-export/README.md)

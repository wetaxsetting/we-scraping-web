# File Management — Component Index (Frontend)

**Part of:** Common → file-management
**Last verified:** 2026-06-23

Every frontend module backing the shared file pattern. Paths absolute-from-repo-root.

## Shared primitives

| Concern | Path | Notes |
|---|---|---|
| Authenticated blob download helper | `wecms-web/lib/file.ts` | `downloadFile(url, fallback)` — XHR via shared `api` axios (JWT auto-attached), `responseType: "blob"` + `transformResponse: []`; sniffs `application/json` → parses error envelope → throws `ApiCallError(code, message)`; otherwise drives a synthetic `<a download>` and revokes the object URL on the next tick. Filename: RFC 5987 `Content-Disposition` parse → caller fallback. |
| Download glyph (Payment rows) | `wecms-web/components/shared/icons/DownloadIcon.tsx` | `<img src="/assets/common/ico-download-file.svg">`, default `size-6`; single source across the five Payment batch-list tables. |

## Feature-local attachment UI

| Concern | Path | Notes |
|---|---|---|
| Contacts attachments section | `wecms-web/components/settings/contacts/AttachmentsSection.tsx` | Add-mode (staged via `stagedFiles`/`onStagedChange`) vs edit-mode (immediate: `listFiles`/`uploadFile`/`deleteFile` on mount/action). Client limits: `MAX_FILE_BYTES = 10 * 1024 * 1024` (`:14`), allow-list `jpg,jpeg,png,gif,pdf,doc,docx,xls,xlsx,ppt,pptx` (`:15-18`) — **mirrors the backend allow-list + size cap**. Download via `lib/file.ts`. |
| Contacts mutations hook | `wecms-web/components/settings/contacts/useContacts.ts` | `useContactsMutations()` exposes `listFiles` / `uploadFile` / `deleteFile` / `fileDownloadUrl` (consumed by `AttachmentsSection`). ⚠️ not opened in this pass — confirm method signatures. |
| Wire type | `wecms-web/lib/types/api.ts` | `ApiContactFileRow` — fields read in `AttachmentsSection`: `file_id`, `org_file_nm`, `file_size`, `trco_infm_titl` (snake_case wire shape). |

## Relationship to the Excel Upload trigger (distinct feature — do not conflate)

The "Excel Upload" preview modal (`components/shared/excel-upload/ExcelUploadDialog.tsx`) and the page-level brand-green "Excel Upload" trigger chips (Contacts / Chart of Accounts / VAS Account) are a **different** flow: they upload a spreadsheet for **bulk-import preview**, not a file attachment stored against a record. Likewise `lib/excel.ts` + `hooks/useExcelExport.ts` produce/download an XLSX **export** of list data. Neither is part of the attachment upload/download pattern documented here:

| Feature | Module | What it does |
|---|---|---|
| Attachment upload/download (this doc) | `AttachmentsSection` + `lib/file.ts` | store / fetch a file against a contact record (`TRCO_INFO_FILE`) |
| Excel **import** preview | `excel-upload/ExcelUploadDialog.tsx` | parse a spreadsheet, preview rows, bulk-create records |
| Excel **export** | `lib/excel.ts` + `useExcelExport()` | POST list context, receive + save an XLSX blob |

They share only the generic "browser saves a file" mechanics; keep them documented separately.

## Error handling

All three file actions route failures through `ApiCallError` (from `lib/api/banking.ts`) + the shared `useDialog()` error dialog with `errorCode`. 401s are handled globally by the axios response interceptor (`lib/axios.ts`); `downloadFile` surfaces `"NETWORK"` for pure transport failures and `"WBE9999"` for an unrecognised JSON body.

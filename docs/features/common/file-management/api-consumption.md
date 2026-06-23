# File Management — API Consumption (Frontend)

**Part of:** Common → file-management
**Last verified:** 2026-06-23

How the frontend talks to the backend file endpoints. Wire shape is lowercase snake_case; in-memory consumption stays snake_case for `ApiContactFileRow` (a wire type) per the three-layer rule.

## 1. Multipart upload

`AttachmentsSection` → `useContactsMutations().uploadFile(trcoKey, file)`:

- Target: `POST /api/v1/settings/contacts/{trcoKey}/files`, `multipart/form-data`, part name **`file`** (backend `@RequestPart("file")`).
- Client pre-validates before sending (size, extension, non-empty) so most rejections never hit the network (`AttachmentsSection.tsx:100-133`).
- On success the backend returns `ApiResponse<ContactFileRow>`; the row is appended to the in-memory list (edit-mode) or the staged list resolves (add-mode).
- ⚠️ The exact `uploadFile` axios call (FormData assembly, headers) lives in `useContacts.ts` — not opened in this pass; confirm it sets `Content-Type: multipart/form-data` via FormData (axios sets the boundary automatically).

## 2. Blob download

`AttachmentsSection.handleDownload` → `downloadFile(mutations.fileDownloadUrl(trcoKey, file_id), org_file_nm)` (`lib/file.ts`):

```
api.get(url, { responseType: "blob", transformResponse: [] })       file.ts:49-55
  ├─ content-type includes "application/json"  → maybeReadEnvelope() → throw ApiCallError(status.code, status.message)   :83-90
  ├─ else → Blob → URL.createObjectURL → synthetic <a download> → revoke next tick                                       :92-112
  └─ filename = parseContentDispositionFilename(RFC 5987 / quoted)  ??  caller fallback (org_file_nm)                     :97-99, :133-149
```

- **JSON-error-envelope sniff:** the backend returns **HTTP 200 + `application/json`** for known business errors (e.g. `WBE_CONTACTS_FILE_UNAVAILABLE`), so 200 alone is not "success" — the helper checks the content-type and rehydrates the envelope to throw `ApiCallError` (`file.ts:79-90`). A JSON body with no recognisable envelope → `ApiCallError("WBE9999", …)`.
- **Pre-request / transport failure:** axios throws → `maybeReadEnvelope` of `err.response.data` if present, else `ApiCallError("NETWORK", …)` (`file.ts:56-74`).
- The download URL targets `GET /api/v1/settings/contacts/{trcoKey}/files/{fileId}` (no `/download` suffix on the contacts path — confirm `fileDownloadUrl` builds this exact path). ERP downloads target `GET /api/v1/settings/erp-transaction-history/{seqNo}/download`.

## 3. Limits + allow-list (mirror the backend)

| Constraint | Frontend value | Backend match |
|---|---|---|
| Per-file size cap | `10 * 1024 * 1024` (`MAX_FILE_BYTES`, `AttachmentsSection.tsx:14`) | `ContactsFileService.MAX_FILE_SIZE_BYTES` (10 MB) |
| Request cap (container) | 50 MB (documented in `AttachmentsSection` Javadoc `:42-44`) | `spring.servlet.multipart.max-request-size: 50MB` |
| Extension allow-list | `jpg, jpeg, png, gif, pdf, doc, docx, xls, xlsx, ppt, pptx` (`:15-18`) | identical `ALLOWED_EXTENSIONS` set |

The frontend allow-list/size checks are a UX convenience; the backend re-enforces both, so a bypassed client still gets a `WBE_CONTACTS_FILE_*` envelope.

## 4. Error envelope + dialog routing

Every file API error carries `{ status: { error, code, message }, trace_id }`. `AttachmentsSection` opens a `useDialog()` error dialog with `errorCode: ex.code` for upload/delete/download failures and a localized `description` for client-side validation. 401 → handled globally by the axios interceptor (`lib/axios.ts`), not per-call.

## 5. Title / metadata

No title field is sent on upload — the backend stamps `"Business Registration"` (first file) / `"New document"` (subsequent). The returned `ApiContactFileRow.trco_infm_titl` is rendered as part of the file row's sub-line in edit-mode (`AttachmentsSection.tsx:279`).

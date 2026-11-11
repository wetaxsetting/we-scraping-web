# WeInvoice: Viewer Shows the Uploaded PDF First, Falls Back, and Labels Missing Files

**Date:** 2026-11-11
**Type:** ISSUE
**Status:** READY FOR MANUAL COMMIT
**Investigation Status:** COMPLETE · **Approval Status:** NOT REQUIRED (developer request 2026-11-11) · **Implementation Status:** COMPLETE · **Test Status:** PASS (automated)
**Repository:** we-scraping-web
**Evidence:** [audit](../audits/weinvoice-uploaded-pdf-not-shown-audit-2026-11-11.md)
**Backend record:** `we-scraping-api/docs/issues/weinvoice-uploaded-pdf-replaces-provider-pdf-2026-11-11.md` (backend repository)

## Problem

After uploading the PDF of invoice 1C26TWE-4 the viewer still showed the copy rendered from XML: it only tried
the first PDF (the provider PDF, whose file is not on the server), and the file table showed that missing file
as "1 KB".

## Expected Behavior

- Viewer tries, in order: uploaded PDF → provider PDF → GDT copy; a download that fails moves to the next one.
  The warning shows only when none loads.
- After a successful upload the record reloads from the server at once, so the uploaded PDF replaces the
  provider PDF in "Các tệp của hoá đơn" and in the viewer without reopening the modal.
- A file whose size is unknown (not on this server) shows "chưa có" instead of "1 KB".

## Scope

`components/invoices/InvoiceDetailModal.tsx`, `lib/api/weinvoice/invoices.ts`, `lib/weinvoice/types.ts`,
`locales/{vi,en,ko}.json`, tests.

## Database Impact

NONE (frontend). Backend change in the backend record above (no DB change there either).

## Implementation

- `lib/api/weinvoice/invoices.ts`: `normalizeFile` marks `missing: true` when the wire `size` is `null`;
  `pdfCandidates(inv)` = uploaded PDFs → other PDFs → GDT copy, leaving out `missing` files; `addFile` (api) reloads
  the record right after an `ok` upload that is not handed to the engine (an XML with `request_id` is reloaded when
  that request ends, as before).
- `components/invoices/InvoiceDetailModal.tsx` `InvoiceView`: walks `pdfCandidates`; a failed download moves to the
  next one, the warning (first error, or "chưa có") shows only when none loads. File table: `missing` → "(chưa có)"
  and no download button.
- `lib/weinvoice/types.ts`: `InvoiceFile.missing?`. Locales: `files.missing` VI "chưa có" / EN "not available yet" /
  KO "아직 없음".

## Files Changed

`components/invoices/InvoiceDetailModal.tsx`, `lib/api/weinvoice/invoices.ts`, `lib/weinvoice/types.ts`,
`locales/{vi,en,ko}.json`, `lib/api/weinvoice/invoices.api.test.ts`, this record, the test-result record.

## Verification

### Automated Tests

- Test: `npx vitest run components/invoices lib/api/weinvoice` — Result: PASS, 123 tests (3 new). `tsc`, eslint clean.

### Manual Verification

- Environment: LOCAL / .13 — NOT RUN (needs the backend of this change + login).

## Test Evidence

[WeInvoice Uploaded PDF Viewer Priority — Test Result](../testing/results/weinvoice-uploaded-pdf-viewer-priority-test-result-2026-11-11.md)
— PASS (automated), regression coverage YES.

## Known Limitations / Follow-up

Works fully only with the backend change (`we-scraping-api` record above); with the old backend the viewer still
falls back correctly but the provider PDF row stays listed next to the upload.

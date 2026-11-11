# WeInvoice Uploaded PDF Viewer Priority — Test Result

**Date:** 2026-11-11
**Type:** TEST RESULT
**Status:** PASS (automated) · UI NOT RUN
**Repository:** we-scraping-web
**Related Record:** [weinvoice-uploaded-pdf-viewer-priority-2026-11-11](../../issues/weinvoice-uploaded-pdf-viewer-priority-2026-11-11.md)

## Scope

Viewer PDF order + fallback, "chưa có" label for files the server lacks, record reload after an upload.

## Environment

LOCAL, Vitest (jsdom).

## Code / Build Under Test

Branch: `scraping-data` · Commit: NOT COMMITTED

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run components/invoices lib/api/weinvoice` | PASS | 12 files, 123 tests |
| new: `engine file with size null … is marked missing and left out of the viewer's PDFs` | PASS | |
| new: `viewer order: uploaded PDF → provider PDF → GDT copy` | PASS | |
| new: `ok → the record is reloaded from the server at once` | PASS | |
| `npx tsc --noEmit` | PASS | no errors outside stale `.next/types` |
| `npx eslint` on the 4 changed source/test files | PASS | no findings |

## Regression Tests

Did a regression test cover the original defect? **YES** — `pdfCandidates` puts the upload first and drops a
`missing` provider PDF, so the viewer no longer stops at the unreadable provider PDF.

## Not Tested

- UI in a browser (upload on 1C26TWE-4, viewer switches without reopening; fallback after a failed download):
  NOT RUN — needs the backend of this change running with a logged-in user.

## Final Result

PASS (automated)

## Recommendation

READY FOR MANUAL COMMIT

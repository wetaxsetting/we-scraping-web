# WeInvoice: Show the GDT Copy of the Invoice PDF Until the Provider Original Exists

**Date:** 2026-11-10
**Type:** ISSUE
**Status:** READY FOR SIT (pushed on user request; screen not yet checked in a browser)
**Approval Status:** NOT REQUIRED (developer request) · **Implementation Status:** COMPLETE · **Test Status:** PASS (unit)
**Repository:** we-scraping-web · Backend record: `we-scraping-api/docs/issues/weinvoice-gdt-pdf-fallback-2026-11-10.md`

## Problem

Screen 05 showed only the copy rendered from XML when the provider (NCC) original PDF was missing, and silently
fell back to it when a stored PDF could not be read (e.g. `WBE3010`: the file is on another machine's disk).

## Implementation

- `lib/api/weinvoice/invoices.ts`: file kind `pdf_gdt` (backend id `pdf-gdt`) is kept out of `files[]` as
  `Invoice.gdtPdf`, so `hasFile(inv, "pdf")`, KPIs, filters and the "Lấy PDF gốc" button are unchanged.
- `components/invoices/InvoiceDetailModal.tsx`: viewer uses the own PDF, else the GDT copy (tab "Bản của Thuế (PDF)"
  + hint); when the stored PDF cannot be opened, a warning with the reason and error code is shown above the XML copy.
- `locales/{vi,en,ko}.json`: `detail.view.gdt_copy`, `detail.view.gdt_copy_hint`, `detail.view.pdf_unavailable`.

## Database Impact

NONE in this repository (engine column `invoice_xml.gdt_pdf_path`, see the backend record).

## Verification

- `npx vitest run components/invoices lib/api/weinvoice` — PASS, 120 tests (1 new: `pdf_gdt` kept apart from `files[]`).
- `npx tsc --noEmit` — clean outside stale `.next/types`; `eslint` on the changed files — clean.
- Screen 05 in a browser: NOT RUN.

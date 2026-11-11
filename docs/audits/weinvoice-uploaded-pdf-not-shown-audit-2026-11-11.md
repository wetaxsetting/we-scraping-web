# WeInvoice: Uploaded PDF Not Shown in the Invoice Viewer — Audit

**Date:** 2026-11-11
**Type:** AUDIT / INVESTIGATION
**Current Work Classification:** AUDIT
**Finding Classification:** BUG (viewer) + ISSUE (files split across machines)
**Status:** COMPLETE (investigation)
**Investigation Status:** COMPLETE
**Approval Status:** APPROVED (developer, 2026-11-11) — implemented in [weinvoice-uploaded-pdf-viewer-priority-2026-11-11](../issues/weinvoice-uploaded-pdf-viewer-priority-2026-11-11.md) and the backend record `we-scraping-api/docs/issues/weinvoice-uploaded-pdf-replaces-provider-pdf-2026-11-11.md`
**Implementation Status:** see the implementation records
**Repository:** we-scraping-web (backend we-scraping-api and engine we-scraping may be involved)

## Observed Behavior

Invoice 1C26TWE-4, "Các tệp của hoá đơn" lists three files:

| Kind | File | Source | Time |
|---|---|---|---|
| XML | 1_C26TWE_4.xml (1 KB) | Cục Thuế | 02/11/2026 19:01 |
| PDF | 1_C26TWE_4.pdf (**1 KB**) | Nhà cung cấp HĐ | 02/11/2026 19:03 |
| PDF | 1C26TWE_00000004.pdf (511 KB) | Tự tải lên | 11/11/2026 10:23 |

The developer uploaded the real PDF, but the viewer still does not show it.

## Expected Behavior

The viewer shows a readable original PDF. A 1 KB provider PDF is unlikely to be a real invoice.

## Scope

Which PDF the viewer picks when several exist; what the 1 KB provider PDF actually is.

## Initial Evidence

Screenshot from the developer (2026-11-11).

## Investigation Plan

1. Engine DB `invoice_pdf` row + file on disk for this invoice (size, content).
2. Viewer selection logic in `components/invoices/InvoiceDetailModal.tsx`.
3. Backend `InvoiceFileService.list` order.

## Database Trace (engine DB, read-only, 2026-11-11)

- Invoice id 10435 = Webcash sales invoice 1C26TWE-4 (`company_mst` = `nbmst` = 1201496252).
- `invoice_pdf`: `source_id = misa_meinvoice`, `pdf_path = pdf/1201496252/2026/11/1201496252/1_C26TWE_4.pdf`,
  fetched 2026-11-02 19:03 (VN) **by the developer laptop's engine**.
- On the laptop the file exists: 523.332 bytes, a real MISA PDF (`%PDF-1.4`, HiQPdf). The uploaded file is
  511 KB ≈ the same document.

## Backend Trace

- `StoredFiles.engineFileSize` returns `null` when the file is not on **this server's** engine output dir
  (`WECMS_WEINVOICE_ENGINE_OUTPUT_DIR`). `InvoiceFileService.list` still lists the item (`size: null`).
- Downloading it then fails (`WBE3010`, file not on this server).

## Frontend Trace

- `InvoiceDetailModal.tsx` file table: `Math.max(1, Math.round(f.size / 1024))` → a `null` size prints
  **"1 KB"**. That is why both the XML and the provider PDF show "1 KB": neither file is on the server's disk.
- `InvoiceView` (line ~207): `ownPdf = inv.files.find(f => f.kind === "pdf")` → takes the **first** PDF = the
  provider PDF. Its download fails → the view falls back to the copy rendered from XML with the
  "PDF unavailable" warning. **The uploaded PDF (second in the list) is never tried.**

## Root Cause

Two causes together:

1. **Operational (ISSUE):** the provider PDF and XML of this invoice were downloaded by the laptop engine on
   2026-11-02, so they exist only on the laptop's disk; the server's backend lists them from the shared DB but
   cannot read them. Same file-split as in [weinvoice-gdt-pdf-copy-viewer-2026-11-10](../issues/weinvoice-gdt-pdf-copy-viewer-2026-11-10.md).
2. **Product (BUG):** the viewer picks only the first PDF and does not fall back to another readable PDF
   (the upload); the file table shows an unknown size as "1 KB" instead of "not on this server".

**Finding Classification:** BUG (viewer selection + size label) and ISSUE (files split across machines).

## Recommended Implementation

- web: `InvoiceView` tries the PDFs in order — uploaded / provider PDFs whose `size` is known first, then the
  GDT copy — and moves to the next when a download fails; show the warning only when none loads. The file table
  shows "không có trên máy chủ" (VI/EN/KO) for `size == null` instead of "1 KB".
- api: optional — add `available: false` on engine items whose file is missing, so the web does not infer it
  from `size`.
- ops: copy the laptop's `output/xml`, `output/pdf` (and `pdf_gdt`) to `.13`, or run the engine on one machine
  only, so the server has every file the DB points at.

## Required Regression Tests

- web: first PDF fails to download → the next PDF (upload) is shown; `size: null` → "not on server" label.
- api (if `available` is added): `InvoiceFileServiceTest` — missing engine file → `available=false`.

## Affected Repositories

we-scraping-web (viewer); we-scraping-api (optional flag); operations on .13.

**Investigation Status:** COMPLETE · **Approval Status:** PENDING · **Implementation Status:** NOT STARTED

# WeInvoice: Invoice List Download Bar per UI Spec v1.1

**Date:** 2026-11-25
**Type:** FEATURE
**Current Work Classification:** FEATURE
**Status:** READY FOR MANUAL COMMIT
**Approval Status:** APPROVED (user, 2026-11-25: "tiến hành dev giúp t")
**Implementation Status:** COMPLETE (web) · **Test Status:** PASS (Vitest / tsc / eslint; browser not run)
**Repository:** wecms-web (`we-scraping-web`) — backend counterpart: `wecms-api/docs/features/addon-service/weinvoice/weinvoice-invoice-downloads-v1-1-2026-11-25.md` (backend repository)

## Purpose

UI Spec v1.1 (PO, 20/11/2026) changes the purchase / sales invoice list only (`00_THAY_DOI_v1.0_v1.1.md`, items 1–11):

1. Page header keeps only **Đồng bộ**; download buttons move to a **download bar above the table**: left a hint
   ("Tick checkbox để chọn…" / "Đã chọn n hoá đơn — …"), right **Cột · Gắn tag (n)** (only when ticked) **· Tải PDF (n) ▾ ·
   Excel (n) · Bảng kê gốc (CQT) · Tải XML tất cả (n) / Tải XML đã chọn (n)**.
2. Scope: nothing ticked → whole list under the filter; ticked → selected rows.
3. **Tải PDF (n) ▾**: 6-item menu (icon + name + hint); progress dialog (XML step x/n, done/failed/loading counts, %,
   Cancel, per-invoice list, footer); result dialog (success x/n, failed n, Retry all, failed-invoices Excel, errors
   grouped by cause with Retry, "n invoices without original PDF — rendered copy used" by reason, **Quét email để lấy mã
   tra cứu** (spec says "Gmail"; renamed to "email" by user decision 2026-11-25 — mailboxes are Gmail / Outlook / IMAP).
4. **Excel (n)** tooltip; when invoices with a CQT code lack XML → dialog with state boxes, ETA ~1.5 s/invoice and
   **Xuất ngay (thiếu n HĐ)** / **Đồng bộ + xuất đầy đủ**.
5. **Bảng kê gốc (CQT)** → ZIP from the server, toast "Đã tải bảng kê gốc CQT (n hoá đơn)".
6. Selection bar: Chọn tất cả theo bộ lọc · Lấy XML còn thiếu · Bỏ chọn.
7. Upload screen TestData hint text changed.

Labels VI/EN/KO come from the spec source `lib/i18n/*.ts` (keys `inv.tb_*`, `inv.tag_n`, `inv.excel_*`, `inv.cqt_list*`,
`inv.xml_*`, `pdfdl.*`).

## Current System Behavior

Header holds Cột · Excel (n) · Tải XML/ZIP (n) · Đồng bộ; Excel asks "Lấy XML còn thiếu?"; no bulk PDF, no GDT list.

## Scope

`components/invoices/*` (list page, new bulk PDF component), `lib/api/weinvoice/invoices.ts` (API + mock paths),
`locales/*.json`, tests.

## Out of Scope

Server-side building of files (backend record). Mock mode keeps the "not available in this build" behaviour for files
the browser cannot build (Excel, PDF pack, GDT list) — Excel is never built in the browser (project rule).

## API Impact (planned)

Consumes the backend endpoints of the backend record (Excel/ZIP with filter scope, PDF jobs, GDT list ZIP).

## Database Impact (planned)

None (frontend). Backend declares none.

## Testing Plan

Vitest: scope resolution (filter vs ticked), download bar labels/states, PDF dialog progress → result rendering,
missing-XML dialog choices, API wire mapping.

## Implementation

- **Page header** keeps only **Đồng bộ**. **Download bar** (`data-testid="dl-toolbar"`) above the table: hint / "Đã chọn n…" · Cột (View Setting, moved) · **Gắn tag (n)** (only when ticked, `danger` button as in the spec) · **Tải PDF (n) ▾** · **Excel (n)** (tooltip `inv.excel_tip`) · **Bảng kê gốc (CQT)** · **Tải XML tất cả (n) / Tải XML đã chọn (n)** (the existing 5-mode ZIP dialog). Counts = ticked rows, else the filtered total.
- **Selection bar**: Chọn tất cả theo bộ lọc · Lấy XML còn thiếu · Bỏ chọn (tag / download moved to the bar).
- **Scope (§3.6)**: `lib/api/weinvoice/downloads.ts` sends the list filter as a JSON body (`listFilterBody`, arrays for list values) and `ids` only when rows are ticked; the server resolves the whole filtered list otherwise.
- **Excel**: coded invoices without XML → `Modal` "Còn hoá đơn thiếu XML" (message, state box x có XML · n chưa có, ETA ~1.5 s/invoice) with **Xuất ngay (thiếu n HĐ)** / **Đồng bộ + xuất đầy đủ** (`fetchMissingXml` then export). Replaces the old confirm.
- **Tải PDF ▾** (`components/invoices/PdfDownload.tsx`): 6-mode menu; starts the server job, polls every 2 s, progress dialog (XML step x/n, done / failed / loading, %, per-invoice list, Cancel), downloads the one ZIP when packed, result dialog (Thành công x/n, Thất bại n, Thử lại tất cả, Excel HĐ thất bại, failure groups with Thử lại, fallback reasons, **Quét email để lấy mã tra cứu** → `/sources/mailbox`, "Tải lại file ZIP").
- **Bảng kê gốc (CQT)**: server ZIP + toast `inv.cqt_list_done`.
- **Mock build**: Excel / Bảng kê / PDF pack say "not available" (files are built by the backend only).
- **i18n**: 66 spec keys (`inv.tb_*`, `inv.tag_n`, `inv.excel_*`, `inv.cqt_list*`, `inv.xml_*`, `pdfdl.*`) VI/EN/KO from the v1.1 source; adjusted: "mô phỏng" removed from `inv.cqt_list_tip` / `inv.cqt_list_done`, `pdfdl.scan_gmail` says "email" (user decision 2026-11-25), `pdfdl.foot_r` says the server builds the renditions; new `pdfdl.r.pending` / `not_on_server` / `xml_missing`, `pdfdl.cancelled`, `pdfdl.job_failed`, `pdfdl.download_zip`, `pdfdl.unavailable`; `td.hint` = v1.1 text (item 11). `pdfdl.sim*` not added (no simulation).

## Files Changed

- `components/invoices/InvoiceListPage.tsx`, new `components/invoices/PdfDownload.tsx`
- new `lib/api/weinvoice/downloads.ts`; `lib/api/weinvoice/invoices.ts` (`listFilterBody`)
- `locales/vi.json`, `locales/en.json`, `locales/ko.json`
- new test `components/invoices/InvoiceListPage.downloadBar.test.tsx`

## API Impact

Consumes the backend endpoints of the backend record (`/invoices/export/excel`, `/invoices/export/cqt-list`, `/invoices/export/pdf-jobs*`).

## UI Impact

Screen 04 per UI Spec v1.1 items 1–11 (`00_THAY_DOI_v1.0_v1.1.md`).

## Database Impact

None (frontend). Backend declares none.

## Verification

### Automated Tests

`npx vitest run`: **27 files, 221 tests, all pass**, incl. 6 new in `InvoiceListPage.downloadBar.test.tsx` (bar replaces header buttons with whole-list counts; ticking switches labels to the selection and Excel sends `ids`; Tải PDF starts a server job without `ids`, downloads the ZIP, result shows fallback + "Quét email" → `/sources/mailbox`; Excel missing-XML dialog with both choices, "Xuất ngay" exports the whole list; Bảng kê gốc posts the filter and toasts; mock build without invoices disables the bar). `npx tsc --noEmit` clean (only stale `.next/types` of routes outside this repo's current tree); `eslint` clean on the changed files.

### Test Scenarios

Not added to `test-scenarios.md` yet — add after the SIT run.

### Regression Review

`DownloadDialog` (5-mode XML ZIP) unchanged, opened from the bar; existing list tests (server paging, provider tooltip) pass.

### Manual Verification

**Not run in a browser**: the dev server started, but login needs the backend (`localhost:8080` not running) and a real account. Check on SIT at 375 / 1440: bar wraps, menu, progress and result dialogs.

## Result

READY FOR MANUAL COMMIT (no commit / push made).

## Test Evidence

[weinvoice-invoice-downloads-v1-1-test-result-2026-11-25.md](../../testing/results/weinvoice-invoice-downloads-v1-1-test-result-2026-11-25.md)

## Known Limitations / Follow-up

- Closing the browser tab does not stop the server job, but the page loses its id (no "my downloads" list); start again to get the ZIP.
- Browser check at 375 / 1024 / 1440 pending (needs a running backend).

# WeInvoice: Invoice List Loads One Page at a Time from the Server

**Date:** 2026-11-18
**Type:** ISSUE
**Status:** READY FOR MANUAL COMMIT
**Approval Status:** NOT REQUIRED (developer request 2026-11-18: "sửa giúp t câu search lấy trong tháng gần nhất thôi, vì dữ liệu 1 số cty đã bắt đầu lớn nên load rất lâu? or chỉ lấy theo page. sau khi đổi page thì research lại, order by theo ngày gần nhất")
**Implementation Status:** COMPLETE · **Test Status:** PASS (automated) · UI NOT RUN
**Repository:** we-scraping-web
**Backend record:** `we-scraping-api/docs/issues/weinvoice-invoice-list-server-paging-2026-11-18.md` (backend repository)

## Problem

Large MSTs load very slowly: in API mode the web downloads **every invoice of the year** before showing anything —
`hydrate()` calls `loadInvoices(taxId, year)` at app start and after an MST switch, paging `GET /invoices` 200 rows at a
time until the year is complete; the list then filters, sorts, counts and pages in the browser. 0318793907 has ~64,000
invoices in 2026 (~60,000 MTT sales in a single month), so "latest month only" would not be enough.

## Current Behavior

- `lib/api/weinvoice/remote.ts` hydrate → `loadInvoices` (whole year into the store).
- `InvoiceListPage`: `filterInvoices` / `kpisFor` over the store; page = slice; "select all" = all filtered ids from the
  store; provider / exclude-partner options computed from the store.
- The backend already serves filtering, sort, paging, KPIs, facets and ids (`GET /invoices`, `/invoices/facets`,
  `/invoices/ids`) — unused by the list.

## Expected Behavior

API mode: the list asks the server for **one page** (default newest first), and asks again on every filter / sort / page /
size / period change. KPIs, "Phát hành qua" and "Loại trừ MST" options come from the server. No whole-year download at app
start. Mock mode unchanged.

## Scope

`lib/api/weinvoice/invoices.ts` (server query, ids, facets), `lib/api/weinvoice/remote.ts` (no whole-year preload),
`components/invoices/InvoiceListPage.tsx`, callers that reloaded the whole year (`UploadPage`, `reloadInvoicesOf`), tests.

## Out of Scope

P3–P6 mock screens that read the store (checks, journal); dashboard (already `GET /dashboard`).

## Database Impact

NONE (frontend) — depends on the backend record above (query params / KPI fields; no DB change).

## Implementation

- `lib/api/weinvoice/invoices.ts`:
  - `listInvoices(q)` — api: `GET /invoices` with every filter (comma lists), 0-based page, size, sort; maps the
    server KPIs (`missing_xml_all` for the card, `period_*_count` for "Cả kỳ", `missing_xml` kept as `missingXmlCoded`
    for the Excel pre-check) and incomplete periods; merges only that page into the store. mock: as before.
  - `listInvoiceIds(q)` (`/invoices/ids`, ≤ 20,000), `invoiceFacets(…)` (`/invoices/facets` → providers, needs-code,
    none, partners), `loadInvoicesByIds(taxId, ids)` (`GET /invoices?ids=`).
  - `bumpInvoiceList()` / `useInvoiceListVersion()`: the list asks again after sync, upload, fetched XML.
  - `reloadInvoicesOf` (after "Lấy XML") re-reads only cached rows by id, then bumps the list.
- `lib/api/weinvoice/remote.ts`: no `loadInvoices` at hydrate / MST switch; `refreshAfterSync` bumps the list.
- `InvoiceListPage`: async page query keyed by filters + page + size + list version (keyword debounced 350 ms; stale
  responses ignored); rows read back from the store; loading row; counts / footer / pagination from `total_count`;
  "Phát hành qua" / "Loại trừ MST" from facets; "select all", Excel, ZIP without a selection resolve ids from the server.
- `DownloadDialog`: ids outside the store are packaged by id; XML / PDF counts shown only when every invoice is cached.
- `UploadPage`: after an import loads only the imported invoices by id (no whole-year reload).
- Locales VI/EN/KO: `dl.xml_any`, `dl.pdf_any`.

## Files Changed

`lib/api/weinvoice/invoices.ts`, `lib/api/weinvoice/remote.ts`, `components/invoices/InvoiceListPage.tsx`,
`components/invoices/DownloadDialog.tsx`, `components/upload/UploadPage.tsx`, `locales/{vi,en,ko}.json`, tests
`lib/api/weinvoice/invoices.serverList.api.test.ts` (new), `components/invoices/InvoiceListPage.serverPaging.test.tsx`
(new), `docs/features/weinvoice/test-scenarios.md` (36), this record, the test-result record.

## Verification

- `npx vitest run` — PASS (25 files, 212 tests); the new component tests FAIL on the old list page / hydrate.
- `tsc --noEmit`, `eslint` — PASS. Browser: NOT RUN (no backend running locally; SIT not deployed).

## Test Evidence

Test result: [WeInvoice Invoice List Server Paging (Web) Test Result](../testing/results/weinvoice-invoice-list-server-paging-web-test-result-2026-11-18.md)

Final test result: PASS · Regression coverage: PASS

## Known Limitations / Follow-up

- Needs the backend change (new `xml` / `provider` values, `ids`, KPI / facet fields) deployed with it.
- "Select all" / Excel / ZIP of a filtered list above 20,000 invoices → backend `WBE3017` (shown as an error toast).
- Screens that read the store in api mode now see only what was loaded (pages visited, details opened): command
  palette invoice search, tag / provider counts on Settings → Tags and Tools → Providers. P3–P6 mock screens unaffected.
- `loadInvoices` (whole-year loader) is no longer called by the app; kept with its tests — remove in a later clean-up.

# Sales e-Invoices — Frontend Test Scenarios

No automated frontend tests exist for this page yet (the repo has no component test harness wired). The scenarios below are the manual / future-automated checklist. Run against a local `wecms-api` with seed data for tenant `VN_VNM0004_000001`.

## 1. List, filter, sort, paginate
1. Page loads → rows render; footer shows one totals row per currency; pagination reflects `total_count` / `total_pages`.
2. Type in search → after ~300 ms the list refetches with `keyword`; page resets to 1; matches across the 5 server columns.
3. Open invoice-status dropdown → pick Original/Replacement/Adjustment/Cancelled → a **new request fires** carrying the wire `status` param and the list reloads pre-filtered; page resets to 0. Verify the pagination count **and** the footer currency totals both change with the selection — that is the observable proof the filter is server-side (IR-4 closed 2026-06-30), not a client post-filter over one page of rows.
4. Change date range (preset or chips) → refetch with new `from`/`to`; page resets.
5. Click a sortable header → cycles default → ASC → DESC → default; rows reorder **server-side** (verify the request carries `sortField`/`sortDirection`, not a client re-sort).
6. Change page / page-size → refetch; rows don't flicker between fetches (`stableData`).
7. Empty result → centered `sales_einvoices.empty`; first load → `common.loading` only.

## 2. Status display & totals
1. Each status renders the correct tone: Original = blue, Replacement/Adjustment = green/amber, Cancelled = red, with the raw localised string.
2. Footer totals: per-currency `Total (VND)` / `Total (USD)` rows align under Total / Tax / Pre-tax columns; counts correct.
3. Switch locale (EN/KO/VI) → column headers + status labels change; status tint stable (regex-driven).

## 3. Toolbar — Print / Excel / Update
1. **Print** → opens the print popup with 8 columns (no checkbox), status as plain text, current (status-filtered) rows.
2. **Excel — with List** → downloads an XLSX (`POST /einvoices/export`); 8 columns; raw status; current filters + sort applied; per-currency subheader.
3. **Excel — with Details** → downloads a line-item-expanded XLSX (`POST /einvoices/export-details`).
4. **Update** → opens `<UpdateEInvoiceModal>`; a successful run bumps `refreshKey` and the list refetches; closing discards modal state.
5. Print/Excel disabled while a download is in flight.

## 4. Pagination & multi-currency
1. With VND + USD rows present, the footer shows two totals rows; navigating pages keeps the totals stable (computed unpaged server-side).

## 5. Auth / responsive
1. Expired token mid-action → global 401 interceptor handles re-auth (not a per-page dialog).
2. Verify layout at 375 / 768 / 1024 / 1440 — table scrolls horizontally below `--w-wb-si-table-min` (1340px); filter row wraps; sidebar drawer < lg.

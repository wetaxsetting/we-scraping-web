# Daily Financial — Frontend (Next.js) Documentation Package

> **Scope.** Implementation-accurate frontend documentation for the **Daily Financial** report
> (Banking → Reports). Every statement here is backed by the actual `wecms-web` code; mock-data
> fallbacks, stubs, and known divergences are flagged, not hidden. The matching backend package
> (same slug) is [`wecms-api/docs/features/banking/reports/daily-financial/`](../../../../../../wecms-api/docs/features/banking/reports/daily-financial/README.md) — read it for the API contract, DTO shapes, and legacy JEX source-of-truth.

| Field | Value |
|---|---|
| Feature slug | `daily-financial` (route-based; never `rept_0015_001`, never `daily-financial-report`) |
| Module | Banking → Reports |
| Variants | **CMC** (default) `/banking/reports/daily-financial` · **HS** (HAENGSUNG) `/banking/reports/daily-financial-hs` |
| Legacy JEX twin | `rept_0015_001` (CMC) · `rept_0017_001` (HS) · `rept_0015_002` (transaction popup) |
| Page type | Report (§7b) — **no pagination, no `<DataTableShell>`**; routes through `<ReportLayout>` |
| Backend base URI | `/api/v1/banking/reports/daily-financial` (+ `/transactions`, `+ /daily-financial-hs`) |
| Status (CMC) | **Wired to real API** (backend reads the legacy function `rept_0015_001_r001_rec1` directly, 2026-06-14 — the earlier Strategy-B Java live-compute was superseded); search-gated; transaction popup READY FOR SIT |
| Status (HS) | **Live** — backend `ReportService.dailyFinancialHs()` calls the real DB function `fn_get_haengsung_daily_financial_report` (via `DailyFinancialHsReportRepository`, since 2026-06-14); the HS client has **no** mock fallback (it renders the live rows; empty state when there is no data). (HS frontend wire types in `lib/types/api.ts` still reflect the stub-era shape; `projectHsRows` bridges them — wire-type flip still pending.) |

---

## 1. What this feature renders

Daily Financial is a **point-in-time (as-of-date) treasury snapshot** for one company. Two distinct
variants exist as **separate routes with separate page components** — they share `<ReportLayout>`
but have fundamentally different data shapes and user flows (CLAUDE.md §7c):

- **CMC** (`/banking/reports/daily-financial`) — per-currency **Financial Status** summary tables +
  **Current Accounts** / **Saving Accounts** ledgers. Boots in an **empty state** and renders only
  after the user clicks **Search** (`hasSearched` flag — legacy `rept_0015_001` parity). Each account
  row links to a **Transaction History Details** popup.
- **HS** (`/banking/reports/daily-financial-hs`) — a bank-grouped ledger (Receipt/Payment codes,
  EN/KO descriptions, sub-total + TOTAL rows). **Eager render** (no Search gate). Filters are
  currently static/non-functional; data comes from the live backend (`fn_get_haengsung_daily_financial_report`,
  since 2026-06-14) with **no** mock fallback (the HS client renders the live rows; empty state when there is no data).

> The two variants must **never** be merged into one page with a runtime toggle (CLAUDE.md §7c).

---

## 2. Documents in this package

| File | Purpose |
|---|---|
| [README.md](README.md) | This file — overview, variant split, status, index. |
| [screen-flow.md](screen-flow.md) | Route → component composition; CMC search-gated flow vs HS eager flow; popup navigation. |
| [ui-specification.md](ui-specification.md) | Filters, summary section, grid columns + formatting, empty/loading states, detail popup, export/print, typography & token-rule deviations. |
| [component-index.md](component-index.md) | Every page / component / hook / API client / type, with file paths. |
| [api-consumption.md](api-consumption.md) | Endpoints called, request params, response mapping (wire → in-memory), error/fallback handling. |
| [test-scenarios.md](test-scenarios.md) | SIT/UAT scenarios — search, financial data, currency (VND/USD/KRW), export, permissions. |

---

## 3. Related documents

- **Backend package (authoritative API contract):** [wecms-api/docs/features/banking/reports/daily-financial/](../../../../../../wecms-api/docs/features/banking/reports/daily-financial/README.md)
- **HS variant package (supersedes the HS column of §4 below, 2026-07-02):** [`../daily-financial-hs/`](../daily-financial-hs/README.md) — the HS screen is now live end-to-end (real API, per-field save, backend template Excel, DB-backed View Setting); the "filters static / client-side export / View Setting not registered" HS notes below reflect the 2026-06 snapshot.
- One-page frontend stub (superseded by this package, retained): [`../daily-financial.md`](legacy-spec.md)
- Reports group index: [`../README.md`](../README.md)
- Sibling report (clone reference): [`../daily-cash.md`](../daily-cash/README.md)
- Page mapping (JEX `_view.jsp` → Next.js route): [references/page-mapping/page-mapping.md](../../../../references/page-mapping/page-mapping.md)
- Report-page rules: `wecms-web/CLAUDE.md` §7b (no-pagination), §7c (variants), §7d (wide tables), §7e (report header).

---

## 4. Honest status summary (evidence-based)

| Surface | CMC | HS |
|---|---|---|
| Page shell + filters | ✅ implemented | ⚠️ filters **static/inert** (hardcoded date `08-09-2025`, no handlers) |
| Real API data | ✅ `GET …/daily-financial` (HTTP 200, VND/USD/KRW); `mockData.ts` is fallback-only | ✅ `GET …/daily-financial-hs` — backend calls the live `fn_get_haengsung_daily_financial_report` (since 2026-06-14); the HS client has **no** mock fallback (empty state on no data) |
| Financial Status summary | ✅ per-currency (VND/USD/KRW) | n/a (HS has no Financial Status section — do not add one) |
| Current/Saving ledger grids | ✅ live numbers | ✅ bank-grouped ledger (live; no mock fallback) |
| Transaction History popup | ✅ **READY FOR SIT** (real `…/transactions`, paginated, e-Invoice-styled) | n/a |
| Excel export | ⚠️ **client-side** (`xlsx-js-style`) — documented interim divergence from §13b backend-export rule | ⚠️ client-side via shared `exportReportExcel` |
| Sort | none (report headers `sortable={false}`) | inert sort glyphs (no wiring) — minor anti-pattern, flagged |
| View Setting | not registered (report page, not a list page) | not registered |

**Known token-rule deviations to fix in a stabilisation pass** (not feature gaps; CLAUDE.md §5):
the CMC title uses a hardcoded `text-[36px]` and `<CellLink>` uses inline `style={{ color: "#494949" }}` — both flagged in [ui-specification.md](ui-specification.md#known-deviations).

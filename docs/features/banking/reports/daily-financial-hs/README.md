# Daily Financial (HS) — Frontend (Next.js) Documentation Package

> **Scope.** Implementation-accurate frontend documentation for the **Daily Financial (HS)**
> report (Banking → Reports; HAENGSUNG `PRDT_TYPE='H'` variant, legacy JEX `rept_0017_001`).
> Every statement is backed by the actual `wecms-web` code as of 2026-07-02. The matching backend
> package (same slug) is
> [`wecms-api/docs/features/banking/reports/daily-financial-hs/`](../../../../../../wecms-api/docs/features/banking/reports/daily-financial-hs/README.md)
> — read it for the API contract, DTO shapes, Excel internals, and legacy JEX source-of-truth.
> Anything not traceable to source is marked *"Not verified from implementation."*

| Field | Value |
|---|---|
| Feature slug | `daily-financial-hs` (route-based; never `rept_0017_001`) |
| Module | Banking → Reports |
| Route | `/banking/reports/daily-financial-hs` — [app/(dashboard)/banking/reports/daily-financial-hs/page.tsx](../../../../../app/(dashboard)/banking/reports/daily-financial-hs/page.tsx) |
| Sibling variant | **CMC** (default) `/banking/reports/daily-financial` — separate route + page; never merge (CLAUDE.md §7c) |
| Legacy JEX twin | `rept_0017_001` ("자금일보" — Daily Financial, HAENGSUNG) |
| Page type | Report (§7b) — **no pagination, no `<DataTableShell>`**; routes through `<ReportLayout>`; **eager render** (no Search gate) |
| Backend base URI | `/api/v1/banking/reports/daily-financial-hs` (+ `/entries/{acctSeqNo}` PATCH, + `/report` Excel) |
| View Setting screenId | `SCREEN_IDS.BANKING_REPORTS_DAILY_FINANCIAL_HS` = `banking-reports-daily-financial-hs`, area `default` ([lib/viewSettingScreens.ts](../../../../../lib/viewSettingScreens.ts)) |
| i18n prefix | `report.daily_financial_hs.*` — complete in `en/ko/vi.json` (no `km.json` platform-wide) |
| Status | ✅ **Live, code-complete (2026-07-02)** — real API fetch + per-field PATCH save + Excel download + DB-backed View Setting; `mockData.ts`/`bankOptions.ts` **deleted 2026-07-01**; no mock fallback. Closed by [daily-financial-hs-final-audit.md](../../../../../../wecms-api/docs/audits/daily-financial-hs-final-audit.md). |

---

## 1. What this feature renders

A **bank-grouped daily cash ledger** for one as-of date. One wide table inside `<ReportLayout>`:

- Per bank account: frozen **Bank** + **Currency** cells (`rowSpan` across the group) → a
  BEFORE_BALANCE line → the day's TRANSACTION lines → a blue **SUB TOTAL** row.
- Per currency (VND → USD → KRW): a green **TOTAL** row closes the section; its Memo column
  carries the company-wide actual balance.
- **Five editable cells on TRANSACTION rows only** (Receipt Code, Payment Code, Description
  EN/KO, Memo) — auto-saved per field on blur/Enter.
- Filter row: As-of `<DateField>` + bank/account multi-select + Search button (no keyword
  `<SearchInput>` — §7e). Title row: list icon (View Setting) + Download Excel.

Unlike the CMC sibling there is **no** Financial Status section, **no** empty-state Search gate,
**no** transaction popup — the ledger is the landing view (Figma 9183:18510; CLAUDE.md §7c).

---

## 2. Documents in this package

| File | Purpose |
|---|---|
| [README.md](README.md) | This file — overview, status, index. |
| [screen-flow.md](screen-flow.md) | Route → component composition; eager-load / Search / save / download flows. |
| [ui-specification.md](ui-specification.md) | Filter row, table + 12-column registry, frozen cells, subtotal/total rows, editable cells, View Setting, empty/loading/error states. |
| [component-index.md](component-index.md) | Every page / component / hook / API client / type, with file paths and responsibilities. |
| [api-consumption.md](api-consumption.md) | The 3 endpoints consumed — params, wire types, `projectHsRows` mapping, error handling. |
| [legacy-spec.md](legacy-spec.md) | Legacy `rept_0017_001` UI/behaviour vs this page — layout, search, rendering, save, download, localization. |
| [test-scenarios.md](test-scenarios.md) | Manual scenario catalogue (automated FE tests are ABSENT). |

---

## 3. Related documents

- **Backend package (authoritative API contract):**
  [wecms-api/docs/features/banking/reports/daily-financial-hs/](../../../../../../wecms-api/docs/features/banking/reports/daily-financial-hs/README.md)
- **Audit records:**
  [daily-financial-hs-legacy-audit.md](../../../../../../wecms-api/docs/audits/daily-financial-hs-legacy-audit.md) ·
  [daily-financial-hs-final-audit.md](../../../../../../wecms-api/docs/audits/daily-financial-hs-final-audit.md)
- **CMC sibling package:** [`../daily-financial/`](../daily-financial/README.md) — its HS status
  column reflects the 2026-06 snapshot and is superseded by this package.
- **Reports group index:** [`../README.md`](../README.md)
- **Page mapping:** [references/page-mapping/page-mapping.md](../../../../references/page-mapping/page-mapping.md)
- **Report-page rules:** `wecms-web/CLAUDE.md` §7b (no pagination), §7c (HS-specific layout —
  never reuse CMC layout), §7d (wide tables), §7e (report header), §13 (View Setting).

---

## 4. Honest status summary (evidence-based, 2026-07-02)

| Surface | State | Evidence |
|---|---|---|
| Real API data (mount + Search) | ✅ live, no mock fallback | `DailyFinancialHsClient` → `fetchDailyFinancialHs`; `mockData.ts` deleted |
| Bank dropdown | ✅ derived from the unfiltered `ALL` report's HEADER rows (mount-only fetch; silent-degrade on error) | `deriveBankOptions` in [projectRows.ts](../../../../../components/banking/reports/daily-financial-hs/projectRows.ts) |
| Per-field editable save | ✅ blur/Enter → `PATCH /entries/{acctSeqNo}`; TRANSACTION rows only; error → `useDialog` | `handleSaveEntry` in `DailyFinancialHsClient` |
| Excel download | ✅ backend template XLSX via `downloadDailyFinancialHsReport` + shared `downloadFile` (blob) — **not** client-side xlsx | `handleDownloadExcel` |
| View Setting | ✅ DB-backed via shared `useViewSetting` (12 columns; seed = manual V249; unseeded → `DEFAULT_VIEW_SETTING_ITEMS` fallback) | `DailyFinancialHsPage` |
| Sorting / pagination | none by design (report page; `sort_yn='N'` on all columns) | — |
| Automated FE tests | ❌ **ABSENT** | no test files in the feature folder |
| Optimistic update / auto-refetch after save | ❌ none by design — persisted value shows in context on next Search (legacy parity) | `DailyFinancialHsClient` |

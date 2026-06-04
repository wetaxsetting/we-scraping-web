# Daily Cash — Screen Flow (Frontend)

Source: `app/(dashboard)/banking/reports/daily-cash/page.tsx`,
`components/banking/reports/daily-cash/DailyCashClient.tsx`,
`components/banking/reports/daily-cash/DailyCashPage.tsx`.

---

## 1. Component / responsibility split

| Layer | File | Role |
|---|---|---|
| Server page | `page.tsx` | Sets `metadata = { title: "Daily Cash Report — WeCMS" }`; renders `<DailyCashClient />`. No `"use client"`. Auth guard + `<AppShell>` chrome inherited from `app/(dashboard)/layout.tsx`. |
| Client root | `DailyCashClient.tsx` (`"use client"`) | Owns filter state (`asOfIsoDate`, `scope`, `hasSearched`, `searchKey`), the keyed data fetch (`useApiData`), and wire→view mapping. |
| Presentation | `DailyCashPage.tsx` (`"use client"`) | Pure render: page header, filter row, export buttons, per-currency summary, the two account ledgers. Receives derived props only. |

---

## 2. Load → search → render flow

```
mount
  ├─ asOfIsoDate = today (YYYY-MM-DD)          // new Date().toISOString().slice(0,10)
  ├─ scope = ALL, hasSearched = false
  └─ useApiData(hasSearched ? loader : () => EMPTY_REPORT, [searchKey, hasSearched])
        → on mount hasSearched=false → renders EMPTY placeholder (no network call)

user picks As-of date (DateField)            // does NOT refetch — date is not in loader deps
user picks Currency scope (All / FCY / VND)  // before first search: stored only, no fetch

click Search  →  handleSearch()
  ├─ hasSearched = true
  └─ searchKey++                              // loader is keyed on searchKey → fetch fires
        → GET /api/v1/banking/reports/daily-cash-report?asOfDate=…&currency=…

response arrives
  ├─ summary  = currency_summary.map(toSummaryRow)  (fallback: rollupSummary(accounts))
  ├─ current  = accounts where acct_type_cd ∈ {03,04}
  └─ savings  = accounts where acct_type_cd ∈ {05,06}
        → DailyCashPage renders summary + two ledgers + export buttons
```

### After the first search

- **Currency-scope change auto-refetches.** `handleScopeChange` sets the scope and, *only if*
  `hasSearched`, bumps `searchKey` → the loader re-fires with the new `currency`.
- **As-of date change does NOT auto-refetch.** The user must click **Search** again (the date is read at
  search time, not tracked as a fetch dependency). This matches the legacy "press Search to run" model.

---

## 3. State matrix

| State | Trigger | What renders |
|---|---|---|
| **Empty placeholder** | Initial mount, before first Search | Filter row only; no summary, no grids, no export buttons (`hasSearched=false`). |
| **Loading** | A Search / scope-change fetch in flight | `loading=true` → Search, Print, Excel buttons disabled. |
| **Loaded — data** | Fetch resolved with rows | Per-currency summary blocks + Current/Savings ledgers populated; export buttons shown. |
| **Loaded — zero data** | Fetch resolved, no summary rows | Summary block still renders with a **zero VND/USD/KRW fallback** (`Total : 0`); ledgers show the per-grid empty row (`common.no_rows`, `colSpan=8`). Detail rows are **not** fabricated. |
| **Error** | Fetch threw `ApiCallError` | Handled by `useApiData`'s error surface (global pattern); no partial render. |

---

## 4. Export sub-flow

Export buttons appear **only after Search** (`hasSearched`), right-aligned above the report body, both
disabled while `loading`:

- **Excel** → `exportDailyCashExcel(...)` (`lib/dailyCashExport.ts`) builds an `xlsx-js-style` workbook and
  triggers a download named `Daily Cash_<YYYYMMDDhhmm>.xlsx`.
- **Print** → `printDailyCashReport(...)` builds a standalone A4-landscape HTML document and prints it via
  a hidden iframe.

Both run off the **already-fetched** summary + account rows (no second network call). See
[api-consumption.md](api-consumption.md) §"Export" and the backend note in
[ui-specification.md](ui-specification.md) §"Export" about the single-producer gap.

---

## 5. Navigation

- Reached from the sidebar **Banking → Reports → Daily Cash** (`components/layout/Sidebar.tsx`).
- URL `/banking/reports/daily-cash`; the `(dashboard)` route group is invisible in the URL.
- Siblings under the same group: `reports/cash-flow`, `reports/daily-financial`, `reports/daily-financial-hs`.

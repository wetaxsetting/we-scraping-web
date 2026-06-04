# Cash Flow — Screen Flow (Frontend)

Page lifecycle from mount → render → export, with every state the user can observe. Backed by
`CashFlowClient.tsx` + `CashFlowPage.tsx`.

---

## 1. Mount sequence

```
/banking/reports/cash-flow
 page.tsx (server)  → metadata.title = "Cash Flow Report — WeCMS"  → <CashFlowClient />

 CashFlowClient (client)
   ├─ useState<CashFlowFilters>(defaultCashFlowFilters)   {year=current, baseCurrency:"VND",
   │                                                        usdRate:26000, krwRate:19, quarter:null, bankFilters:[]}
   ├─ searchKey counter (drives refetch)
   ├─ fetchExchangeRates()  (on mount)  → seed usdRate/krwRate from USD/KRW sell rows (non-fatal on error)
   ├─ fetchAccounts()       (on mount)  → BankFilterOption[] for the bank popover (silent empty on error)
   └─ useApiData(loader, [searchKey])   loader = fetchCashFlow({year, baseCurrency, usdRate||null,
                                                               krwRate||null, bankFilters})   ← NO quarter
        → report = data ? mapCashFlowReport(data) : undefined
```

The fetch fires **once on mount** (initial `searchKey`) and again whenever **Search** bumps it. Changing
year / currency / quarter / banks only updates `filters` — nothing refetches until Search is clicked.

---

## 2. Search

`handleSearch` → `setSearchKey(k => k+1)` → `useApiData` re-runs `loader` with the current filters. The
loader's dependency array is `[searchKey]` (filters are read fresh inside the closure), so a stale
filter never triggers an unexpected fetch.

**Quarter is deliberately excluded** from the loader and from `CashFlowQueryParams` — the report is
always full-year; quarter only changes which month columns render (see §4).

---

## 3. Render branches

| Condition | Render |
|---|---|
| `loading && !report` | centered "Loading…" note |
| `report` present | `<ReportLayout>` → filter row + `<CashFlowMatrix>` with grouped rows |
| `report` undefined (initial, or backend error/empty) | `buildEmptyReport(baseCurrency)` → matrix chrome with 8 empty rows (borders visible, no data) |

There is **no separate empty-placeholder screen** (unlike Daily Cash/Daily Financial's Search-gated
empty state) — the matrix chrome always renders, populated or empty. On a backend error `useApiData`
sets `data:null` → `report=undefined` → empty matrix (**never** the dead `mockCashFlowReport`).

---

## 4. Quarter column visibility (client-only)

```
visibleMonthIdx = monthIndicesForQuarter(filters.quarter)   // types.ts
   This Year → [0..11]   Q1 → [0,1,2]   Q2 → [3,4,5]   Q3 → [6,7,8]   Q4 → [9,10,11]
```

The `<colgroup>`, header cells, and every body/band row iterate `visibleMonthIdx.map(...)`, so
out-of-quarter months are **never rendered** (not CSS-hidden). The data stays full-year; only the
rendered columns shrink. Opening Balance (header), End Balance (footer), and all monthly cells are
identical across quarter selections — the calculation is quarter-independent (verified backend-side by
`CashFlowReportQuarterParityTest`).

---

## 5. Export

```
handleExport → exportExcel({
   endpoint: "/api/v1/banking/reports/cash-flow-report/export",
   screenId: SCREEN_IDS.CASH_FLOW_REPORT,  dymAreaId: "default",
   fileName: `CashFlow_${DDMMYYYY}`,  title: t("report.cash_flow.title"),
   columns: buildExportColumns(t, baseCcy),     // DISP_CD/DISP_NM/ITEM_CD/ITEM_NM/ROW_TYPE + 12 *_AMT + TOTAL_AMT + DISP_CCY_CD
   filters: { year, quarter: quarter ?? "", baseCurrency, usdRate, krwRate, bankFilters: JSON.stringify([...]) },
})  → backend CashFlowExcelWriter streams .xlsx → blob download
```

- `CashFlowClient` calls `exportExcel(...)` **directly** (documented deviation — this report page does
  not adopt the View Setting popover, so it does not go through `useExcelExport`).
- The **export request does send `quarter`** in `filters` (unlike the calc fetch), but the export always
  emits **all 12 month columns** regardless.
- Error handling: `WBE1401` swallowed; any other `ApiCallError` opens a `useDialog()` error dialog with
  the code.

---

## 6. Exchange-rate prefetch & fallback

On mount `fetchExchangeRates()` seeds the rate inputs from the USD/KRW `sell` rows. On failure the
`try/catch` leaves the static defaults (`usdRate=26000`, `krwRate=19`) — the page degrades gracefully
(parity audit N5; legacy read `.sell` unguarded and could error). The combined Exchange Rate input edits
`krwRate` when `baseCurrency === "USD"`, otherwise `usdRate`.

---

## 7. Bank filter

`<BankFilterPopover>` binds `filters.bankFilters` (`{bankCd, acctNo}[]`). Empty = "All Banks" (no wire
filter). Selection is JSON-stringified into the `bankFilters` query param only when non-empty. Options
come from `fetchAccounts()` on mount.

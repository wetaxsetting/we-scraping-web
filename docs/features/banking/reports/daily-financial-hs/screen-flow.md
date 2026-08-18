# Daily Financial (HS) — Screen Flow

> Route → component composition and the four runtime flows (eager load, Search, per-field save,
> Excel download), verified in the feature source.

---

## 1. Route & composition

```
app/(dashboard)/banking/reports/daily-financial-hs/page.tsx     (server; metadata
        │                                                        "Daily Financial (HS) Report — WeCMS")
        ▼
DailyFinancialHsClient.tsx        ("use client" — state + API orchestration)
        │  groups, bankOptions, asOf, filters, handlers
        ▼
DailyFinancialHsPage.tsx          (presentational)
  ├── <PageHeader title=t("report.daily_financial_hs.title")>
  │     ├── list-icon button  ──anchorRect──▶ <ViewSettingPopover>   (shared, §13)
  │     └── Download Excel button (/assets/common/ico-excel.svg — §8a)
  ├── Filter row: <DateField> (As of) · <BankFilterPopover> · Search <Button>
  └── <ReportLayout>            (shared single scroll container, §7b)
        └── LedgerTable  (internal, column-driven by visible View Setting items)
              └── BankGroupRows ×N
                    ├── frozen BankCell + Currency cell (rowSpan = entries + SUB TOTAL)
                    ├── EntryCell ×cols per row  (InputCell when editable)
                    ├── SUB TOTAL row (blue, SummaryCells)
                    └── TOTAL row (green, when group.closesTotal)
```

Auth/shell: inherited from `app/(dashboard)/layout.tsx` (client guard + `<AppShell>`). Menu
visibility is backend-driven — the sidebar node (`banking-report-daily-financial-haengsung`
presentation entry, [components/layout/sidebarNav.ts](../../../../../components/layout/sidebarNav.ts))
renders only when `GET /api/v1/navigation` returns it (H product tree). There is **no
frontend-side per-route permission check** — the route guard is authentication only; real
enforcement is the backend `@menuAuthz` gate.

## 2. Eager initial load (no Search gate)

```
mount
 ├─ useApiData(loader, [searchKey])          searchKey = 0
 │    └─ fetchDailyFinancialHs({ asOf: toPeriodDate(today), accountFilter: "ALL" })
 │         └─ GET /api/v1/banking/reports/daily-financial-hs
 │              └─ data.rows ──▶ projectHsRows(rows) ──▶ BankGroup[] ──▶ table
 └─ useEffect (mount-only)
      └─ fetchDailyFinancialHs({ accountFilter: "ALL" })     ← unfiltered, for the dropdown
           └─ deriveBankOptions(rows)  → bank/account options (non-fatal on error: empty dropdown)
```

Legacy parity: `rept_0017_001.ts` also runs the initial report on page load with today + all
banks checked. This is the deliberate opposite of the CMC variant's empty-state Search gate
(CLAUDE.md §7c).

## 3. Search flow

```
user changes DateField / bank selection      → state only, NO refetch
user clicks Search
 └─ setSearchKey(k+1)                        → useApiData deps change → loader re-fires
      └─ GET …?asOf=<yyyyMMdd>&accountFilter=<"ALL" | JSON [{BANK_CD,ACCT_NO}]>
```

`toPeriodDate` converts the ISO `yyyy-MM-dd` state to `yyyyMMdd`; `toAccountFilter` maps an empty
selection to the literal `"ALL"` and a non-empty one to the JSON-stringified array (verbatim
legacy `rept_0017_001.js` contract). The Search button is disabled while loading.

## 4. Per-field save flow (TRANSACTION rows only)

```
InputCell (editable cell)  — value changed? (savedRef check)
 └─ blur OR Enter
      └─ onSaveField(entry, fieldId, value)
           └─ DailyFinancialHsClient.handleSaveEntry
                ├─ wireKey = FIELD_WIRE_KEY[fieldId]     (RECEIPT_CODE→rept_cd, … MEMO_NOTE→memo)
                └─ updateDailyFinancialHsEntry(entry.acctSeqNo, { [wireKey]: value })
                     └─ PATCH /entries/{acctSeqNo}
success → silent (cell keeps the typed value; totals update on next Search — legacy parity)
failure → useDialog().open({ type: "error", … })
```

No optimistic rollback, no auto-refetch. BEFORE_BALANCE rows never render inputs
(`entry.editable === false`, `acctSeqNo === ""`).

## 5. Excel download flow

```
Download Excel button
 └─ handleDownloadExcel
      └─ downloadDailyFinancialHsReport({ asOf: toPeriodDate(asOf),
                                          accountFilter: toAccountFilter(bankFilters),
                                          lang: locale.toLowerCase() })
           └─ GET /report?asOf&accountFilter&lang   (responseType: blob, shared downloadFile)
                └─ saves the server-named XLSX (Content-Disposition; fallback name
                   "Daily Financial (HS).xlsx")
failure → useDialog error
```

The backend re-reads the DB, so saved edits are included even without re-Searching. The download
does **not** go through `useExcelExport`/View Setting — the HS workbook always carries all 12
columns (legacy parity; see the backend package's
[wecms-api/…/interface-specification.md §4](../../../../../../wecms-api/docs/features/banking/reports/daily-financial-hs/interface-specification.md)).

## 6. View Setting flow

```
list icon click → capture DOMRect → open <ViewSettingPopover anchorRect>
  draft (vsDraft) edited locally — reversible until Save
  Save  → vs.save(draft)  → PUT  /api/v1/screen-options/banking-reports-daily-financial-hs/default
  Reset → vs.reset()      → DELETE same → system defaults re-init
  Close/ESC → discard draft, no network call
visibleColumns = items.filter(use_yn==='Y').sort(disp_ord) → COLUMN_REGISTRY lookup
```

Unseeded environment (manual V249 not yet run): the screen-options GET returns `WBE2001` and the
page renders from `DEFAULT_VIEW_SETTING_ITEMS` (all 12 visible) — degraded (no persistence), not
broken.

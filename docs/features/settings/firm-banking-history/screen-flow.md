# Firm Banking History — Screen Flow (Frontend)

Parent: [README.md](README.md). Backend flow: [wecms-api .../business-flow.md](../../../../../wecms-api/docs/features/settings/firm-banking-history/business-flow.md).

---

## Entry

```
Top nav → Settings  →  <SettingsModal> opens
        →  <SettingsNav> "Firm Banking" group → "Firm Banking History"
        →  panel = "firm_banking_history"  →  <FirmBankingHistoryPanel> mounts
```

No standalone route — the panel lives inside the Settings modal shell (L1). Permission gate:
non-admin users need `settings-firm-banking-history` in `allowedMenuCds` for the nav item to show.

---

## List flow

```
Panel mounts
   │  default date range = last 30 days (defaultDateRange())
   │  default page = 0, pageSize = 10, serviceType = "all", keyword = ""
   ▼
useApiData(fetchFirmBankingHistory, deps)
   │  deps: startDate, endDate, wireSvcType, debouncedKeyword, sortField, sortDirection, page, pageSize
   ▼
GET /api/v1/settings/firm-banking-history?from_date&to_date[&svc_type&keyword&sort_*&page&size]
   ▼
ApiFirmBankingHistoryListResponse  →  mapFirmBankingHistoryRow(...)  →  FirmBankingHistoryRow[]
   ▼
latched stable data  →  <FirmBankingHistoryTable> renders  →  <Pagination>
```

- **Latched stable data:** the last non-null response is held in `stableData` so pagination /
  total-count don't flicker between refetches (mirrors `AccountInquiryClient`).
- **Pagination:** `page` is zero-based in state and on the wire; the UI chrome shows one-based
  (`page + 1`). Page size default 10.

## Filter interactions

| Control | Effect |
|---|---|
| Date range picker (`<InteractiveDateRangePicker>`) | updates `startDate`/`endDate` (ISO) → refetch; resets to page 0 |
| Service-type dropdown | `all` / F / S / G / B → wire `svc_type` (omitted for `all`); G+B hidden for product `H` |
| Keyword search (`<SearchInput>`) | 300 ms debounce → `debouncedKeyword` → wire `keyword` |
| Sort (click header) | `useTableSort` cycles default → ASC → DESC → default; forwards `sort_field`+`sort_direction` |

## Detail flow

```
Row "View Details"  →  setDetail({ row, anchorRect })
        ▼
<FirmBankingHistoryDetailPopover row={...} anchorRect={...} />   (client-side; NO HTTP call)
        ▼
per-leg field rendering (F / S / G / B) + leg-specific result-message resolution
        ▼
ESC / outside-click / X closes
```

The popover reads every field it needs from the already-fetched row (`rsltCd`, `rsltMsg`, `job`,
`reqData`, `vanOrgCd`). See [ui-specification.md § Detail popover](ui-specification.md#4-detail-popover).

## Export flow

```
Excel icon  →  useExcelExport(...)  →  POST /api/v1/settings/firm-banking-history/export
        ▼
backend streams XLSX  →  browser saves blob (filename from Content-Disposition)
```

---

## Loading / empty / error

| State | UI |
|---|---|
| Initial / search loading | spinner / skeleton; latched data prevents grid flicker |
| Empty result | localized empty-state row |
| Validation error (`WBE_VALIDATION`) | suppressed — the panel guarantees its own input shape |
| Other API error | global `useDialog().open({ type: "error", … })` with `trace_id`; de-duped via `lastSurfacedRef` |

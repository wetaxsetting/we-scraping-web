# ERP Transaction History — Screen Flow (Frontend)

Interaction flow for the ERP Transaction History panel. Backend flow:
[wecms-api/.../business-flow.md](../../../../../wecms-api/docs/features/settings/transaction-history/business-flow.md).

```
Top nav → Settings → <SettingsModal> opens → <SettingsNav> → "Transaction History"
   (visible only when the session has the settings-erp-transaction-history grant or is admin)
      │
      ▼
<ErpTransactionHistoryPanel> mounts (state owner: tabs · filters · sort · page)
      │  useApiData(() => fetchErpTransactionHistory({ from_date, to_date, erp_type?, trns_type_cd?, keyword?, sort?, page, size }),
      │               [wireStart, wireEnd, erpType, trnsTypeCd, debouncedKeyword, sortField, sortDirection, page, pageSize])
      ▼
GET /api/v1/settings/erp-transaction-history
      │  map ApiErpTransactionHistoryRow[] → ErpTransactionHistoryRow[]  (snake_case → camelCase)
      │  latch latest non-null response (stableData) so chrome doesn't flicker between refetches
      ▼
Tabs (counts) + Filters + Table render; pagination pinned outside the scroll region
```

---

## States

| State | Trigger | UI |
|---|---|---|
| **List (idle)** | panel mount, GET resolves | four tabs with counts; date range + type dropdown + search; table (Date / Type / Transaction Type / File / User); pagination below |
| **Loading** | GET in flight | `useStickyLoading` smooths the toggle; the empty-area shows `settings.erp_transaction_history.loading` while rows are empty + loading |
| **Empty** | GET resolves with no rows | centered `settings.erp_transaction_history.empty` ("No Data Found") in the scroll area |
| **Error** | GET fails (non-`WBE_VALIDATION`) | global system error dialog via `useDialog()` (deduped by code via `lastSurfacedRef`); `WBE_VALIDATION` suppressed (panel state guards it); 401 handled globally by the Axios interceptor |
| **Tab change** | click a tab | sets `erp_type` filter (`all` omits it); resets to page 0; if switching to **Deleted** and the current type isn't in the Deleted subset, reset type to `all` (legacy `comm_0219_001.ts:502-509`) |
| **Date range** | preset or manual | preset recomputes the ISO window from "today"; manual passes start/end verbatim; resets to page 0; wire dates are `YYYYMMDD` |
| **Type filter** | pick a code | sets `trns_type_cd`; resets to page 0 |
| **Keyword** | type in search | live in the input; **debounced 300ms** before the API dep fires; resets to page 0 |
| **Sort** | click a sortable header | `useTableSort` cycles default → ASC → DESC → default; re-fires the fetch (sort in the dep list) |
| **Download** | click a File-cell link (only when `fileSize > 0`) | `downloadFile(getErpTransactionHistoryDownloadUrl(seqNo), orgFileNm)` (authenticated XHR + blob save); `WBE2014`/`WBE2015` → error dialog |
| **Export** | toolbar Excel action (when wired) | `POST /export` via the shared export pipeline → XLSX blob saved |

---

## Refresh model

Every filter / tab / sort / page change is a dependency of the `useApiData` call — the list refetches
on change. There is no optimistic row mutation (read-only feature). The latest non-null response is
latched (`stableData`) so the table + pagination chrome stay stable across refetches (the canonical
FBH / AccountInquiryClient pattern). Pagination math converts at the boundary — Spring is 0-based, the
chrome displays 1-based (`page={page + 1}`, `onPageChange={p => setPage(p - 1)}`).

---

## Authorization & visibility

The Transaction History entry appears in `<SettingsNav>` only when the session is admin or the granted
menu codes include `settings-erp-transaction-history`. The backend independently enforces
`@menuAuthz.canAccess('settings-erp-transaction-history')` on every endpoint — the frontend gate is UX,
the backend gate is the security boundary. Download attempts by an unauthorized user surface the
backend's 403 (`WBE1003`) through the error dialog.

---

## Product-agnostic (no `prdt_type` branching)

Per OQ-2 (resolved 2026-05-11) the panel drops all legacy HAENGSUNG-only behaviour: all four tabs are
always visible, the File column is always present, and every transaction-type code (incl. `15` Exchange
Rate) is selectable for every tenant. The only legacy per-tab filter preserved is the **Deleted-tab
dropdown subset** (`02`, `03`, `12`, `13`, `16`), enforced client-side in `<ErpTransactionHistoryFilters>`.

# Account Inquiry (VND) — Screen Flow

**Route:** `/banking/account-inquiry` · **Screen ID:** `banking-account-inquiry-vnd` · **Hub:** [README.md](README.md)

User journeys + interaction flows for the refactored page. Layout/columns: [ui-specification.md](ui-specification.md);
endpoints: [api-consumption.md](api-consumption.md).

---

## 1. Layout tree

```
(dashboard) layout                                   ← auth guard + AppShell (sidebar + top nav)
└── /banking/account-inquiry/page.tsx
    └── <AccountInquiryClient currency="VND" />       ← currency-locked wrapper, owns fetch + sort + paging state
        └── <AccountInquiryPage … serverPaging />     ← shared shell (also used by FCY)
            ├── PageHeader + PageActionButtons (List / Print / Excel)
            ├── Filter row: BankFilterPopover · SearchInput · DateField · (Currency popover — FCY only)
            ├── Summary tiles (count · Available Balance · Balance)
            ├── DataTableShell → table (sortable headers, row checkboxes)
            ├── Pagination (server-driven)
            └── Dialogs: ViewSettingPopover · BalancePopover · TransactionSyncDialog
                          (→ SyncHistoryDialog, LatestTransactionHistoryModal)
```

---

## 2. Initial load

1. `AccountInquiryClient` calls `fetchAccounts({ currency:"VND", bankCd, keyword, sort, page, size })` via `useApiData`.
2. Deps: `[wireCurrency, refreshKey, sortField, sortDirection, bankCd, debouncedKeyword, page, pageSize]` — any change refetches.
3. Rows mapped via `mapAccountRow()` → `AccountInquiryRow[]`; totals via `mapCurrencyTotal()`.
4. View Setting loads in parallel (`useViewSetting`); the table renders `FALLBACK_COLUMNS` until it resolves, then the live merge.
5. **Stable-data latch** retains the last non-null result so the table doesn't blank between refetches.
6. **No mock fallback** — on error the table renders empty + the error surfaces via the global dialog; on load it shows the sticky loading state (`useStickyLoading`, min 400 ms).

---

## 3. Filter / sort / paginate

| Action | Flow |
|---|---|
| Bank filter | `BankFilterPopover` → `serverPaging.onBankCdChange(bankCd)` → wrapper resets page 0 → refetch. Options come from `banks_available` (never narrowed). |
| Keyword search | `SearchInput` updates live; debounced 300 ms → `serverPaging.onKeywordChange` → page 0 → refetch (matches formatted nickname). |
| Sort header click | `TableHeaderCell` → `useTableSort.toggleSort(fieldId)` cycles `default→ASC→DESC→default` → refetch with `sortField`/`sortDirection`. |
| Page nav / size | `serverPaging.onPageChange(0-based)` / `onPageSizeChange(size)` (page 0 on size change; selection cleared). |
| Refresh | `onRefresh()` bumps `refreshKey` → refetch with current sort + filter + page. |

---

## 4. Update Balance / Sync (real-time inquiry)

```
Select account rows (checkbox) → "Update" → <TransactionSyncDialog>
        ↓ syncTransactions({ accounts, from_dt, to_dt, auto })   → POST /accounts/transactions-sync
   status = COMPLETED → show LatestTransactionHistoryModal + onRefresh() (list re-fetch)
   status = OTP_REQUIRED / CAPTCHA_REQUIRED / QNA_REQUIRED
        → render challenge UI → submitSyncOtp / submitSyncCaptcha / submitSyncQna(sessionId, …)
        → loop until COMPLETED or ERROR
   status = ERROR → useDialog({type:"error", errorCode})
```

- Row checkboxes are **disabled** for manual accounts (`hand_reg_yn="Y"`) and disconnected accounts
  (`cert_conn_yn="N"`) — a tooltip explains why (`account_inquiry.disabled.manual` / `.disconnected`).
- After a successful sync the list re-fetch updates Balance / Available / **Last Update** / status cells.
- **Sync History** button (inside the sync dialog) opens `<SyncHistoryDialog>` → `fetchSyncHistory({from,to,bank,result})`.

---

## 5. Balance-click → transaction popup

Clicking a balance cell opens `<BalancePopover>` (portal at `document.body`) which calls
`fetchTransactions(acctSeqNo, { from, to })` for the clicked account/date — a lightweight drill-down
into recent transactions without leaving the page.

---

## 6. View Setting / Print / Excel

| Trigger | Flow |
|---|---|
| List icon | `PageActionButtons.onList(rect)` → `<ViewSettingPopover anchorRect>` → toggle/reorder columns → `save()`/`reset()` via `useViewSetting`. |
| Print | `printReport({title, summary, columns, rows})` (`lib/print.ts`) — filtered in-memory set, popup window (never the live DOM). |
| Excel | `useExcelExport()` → `POST /accounts/export` with live View Setting columns + filters + sort → downloads `Account Inquiry (VND).xlsx`. |

---

## 7. Session / error

- 401 → Axios interceptor → global session-expired dialog → `/login`.
- Business errors (`status.error`) → `useDialog({type:"error", errorCode, description})` with the `trace_id`.

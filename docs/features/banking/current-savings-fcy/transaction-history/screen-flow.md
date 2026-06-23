# Transaction History (FCY) — Screen Flow (Frontend)

User journeys and interaction flows for the FCY transaction inquiry. The layout detail is in
[ui-specification.md](ui-specification.md); the component map in [component-index.md](component-index.md).
FCY and VND share the same client + page; this doc notes only the FCY-specific routing/empty-state.

---

## 1. Entry & routing

```
Sidebar ▸ Current & Savings (FCY) ▸ Transaction History          ← expandable parent (toggle)
   └─ WOORI 2308 / BIDV 2913 / SHINHAN 6946 …                     ← per-account children (real links)
        │  accountHref("FCY", id) → /banking/transaction-history-fcy/{id}
        ▼
/banking/transaction-history-fcy                                  ← index
   └─ <TransactionHistoryIndexRedirect scope="FCY" />
        useTransactionHistoryAccounts("FCY") → first account
        router.replace(accountHref("FCY", first.id))
        (renders "No accounts available for this scope." if the FCY list is empty)
        ▼
/banking/transaction-history-fcy/[accountId]
   └─ <TransactionHistoryClient acctSeqNo={accountId} scope="FCY" />
        ▼
   <TransactionHistoryPage … />   (presentation)
```

`accountId` (URL slug) **equals** the backend composite `acct_seq_no` = `BANK_CD_ACCT_NO` — no
bridging. The Account Inquiry (FCY) balance drill-down also deep-links here.

---

## 2. Initial load

```
TransactionHistoryClient mounts (scope="FCY")
   │
   ├─ useApiData(fetchAccounts, ["FCY"])         → resolve the account record (bankName, ccy_cd, nickname)
   ├─ useApiData(fetchTransactions, [acctSeqNo, listParams, refreshKey])    → rows
   ├─ useApiData(fetchTransactionsSummary, [acctSeqNo, summaryParams, refreshKey]) → tab counts + totals
   └─ picker option loads: chart-of-accounts · purpose · VAS · contacts
        │
        ▼
   stickyInitialLoading = useStickyLoading(txnState.loading && !stableTxnData)
   → centered t("common.loading") until the first list response latches into stableTxnData
```

Default filters (in the client): `typeFilter="all"`, `statusFilter="all"`, `search=""`, date range =
last 30 days (`defaultDateRange()`).

---

## 3. Search / filter flow

```
User changes a filter (date range · type radio · status tab · search box)
   → handler calls pg.resetPage() then updates the corresponding state
   → useApiData deps change → fetchTransactions re-fires with the new params
   → stableTxnData keeps prior rows visible (no flash) until the new response arrives
```

Currency is **not** a filter — it is fixed by the selected FCY account. The keyword box placeholder is
`t("txn_history.search_placeholder")` ("Search for amount, contacts name, purpose").

---

## 4. Confirm / undo flow

```
Row action cell ▸ "Confirm"  → confirmTransaction(acctSeqNo, trnsSeqNo)  → refreshed detail
   → client bumps refreshKey → list + summary re-fetch → success dialog t("txn_history.confirm_success")
Row action cell ▸ "Undo"     → undoConfirmTransaction(...)               → t("txn_history.undo_success")
```

---

## 5. Classification flow (per row)

```
Reporting Account / Purpose / VAS / Contact cell  ▸ in-cell <Select> picker
   → update*/clear* API call → refreshed detail → refreshKey bump → row re-renders
   (no navigation; classification setters show no success dialog)
```

Picker options are loaded once on mount and joined client-side into each row so cells render without
per-row API calls.

---

## 6. Smart Organizer (match) flow

```
File Name cell  ▸ "Match" / "Unmatch" link  → onOrganize(row.id) opens <SmartOrganizerDialog>
Toolbar Smart Organizer CTA → <Link href=/banking/smart-organizer?account={bankCd_acctNo}>
```

Smart Organizer is account-scoped (R11) — the selected account threads through the `?account=` query.

---

## 7. Export flow

```
Toolbar Excel icon  ▸ onExport
   → handleExport guards double-click, sets exporting
   → useExcelExport().exportXlsx({ endpoint: "/api/v1/banking/accounts/transactions/export",
        screenId: "banking-transaction-history", fileName: t("txn_history.export_title")+date,
        title: t("txn_history.breadcrumb", { account }), filters: { acctSeqNo, from, to, type, cnfmYn, keyword } })
   → backend streams XLSX → blob downloaded → finally setExporting(false)
```

---

## 8. View Setting flow

```
Toolbar list icon  ▸ onList(rect)  → opens <ViewSettingPopover anchorRect={rect}>
   → toggle/reorder columns → Save commits via useViewSetting().save() → grid re-renders
```

`useViewSetting(SCREEN_IDS.BANKING_TRANSACTION_HISTORY, DEFAULT_AREA_ID)` — shared screenId with VND.

---

## 9. Empty / loading / error states

- **Initial load:** centered `t("common.loading")`.
- **Empty (FCY):** when `account.currency !== "VND"` and no rows → `t("txn_history.empty_fcy")`
  ("Transaction History (FCY) Not Found").
- **Errors:** `showErrorDialog(err)` → `useDialog().open({ type: "error", … })` reading
  `ApiCallError.code`; 401s handled by the global axios interceptor.

---

## 10. Synchronization (not on this screen)

There is **no sync button** on Transaction History (FCY). Pulling fresh transactions from the bank is
owned by Account Inquiry (FCY); this screen reads already-synced rows. See
[account-inquiry-fcy/screen-flow.md](../account-inquiry/screen-flow.md).

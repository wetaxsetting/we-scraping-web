# Transaction History (VND) — Screen Flow (Frontend)

User journeys and interaction flows for the refactored Next.js screen. Backend behaviour:
[wecms-api .../transaction-history-vnd/business-flow.md](../../../../../../wecms-api/docs/features/banking/current-savings-vnd/transaction-history/business-flow.md).
JEX source of truth: [docs/jex/features/transaction-history-vnd/business-flow.md](../../../../../../docs/jex/features/transaction-history-vnd/business-flow.md).

---

## 1. Entry & routing

```
Sidebar: Current & Savings ▸ Transaction History (VND)   ← expandable nested parent (§2a)
     └─ per-account child (e.g. BIDV 0569, VCB 8210, HD BANK 0442)
        └─ /banking/transaction-history/[accountId]

OR  Account Inquiry (VND) → click an account → its Transaction History
OR  /banking/transaction-history  (index)  →  TransactionHistoryIndexRedirect  →  first account
```

- `app/(dashboard)/banking/transaction-history/page.tsx` renders
  `<TransactionHistoryIndexRedirect scope="VND" />`, which fetches the live `/accounts?currency=VND`
  list and `router.replace`s to the first account so the parent never shows a blank landing page.
- `app/(dashboard)/banking/transaction-history/[accountId]/page.tsx` awaits the `accountId` param
  (Next.js 16 `params: Promise<{ accountId: string }>`) and renders
  `<TransactionHistoryClient acctSeqNo={accountId} scope="VND" />`.
- `accountId` = backend composite `BANK_CD_ACCT_NO`.

## 2. Initial load

```
TransactionHistoryClient mount
  ├─ default filters: date range = last 30 days, type = all, status = all, search = ""
  ├─ fetch /accounts?currency=VND        → resolve breadcrumb account (bank + nickname)
  ├─ fetch .../transactions  (list)      ┐ two parallel calls
  ├─ fetch .../transactions/summary      ┘ (tab counters + footer totals)
  └─ fetch picker options: chart-of-accounts · purpose · vas-account · contacts
  → sticky loading gate (≥400ms) → latch stable data → render grid
```

## 3. Search / filter flow

```
User changes a filter (date range / type / status tab / search)
      ↓ onChange handler → pg.resetPage()
      ↓ filter state updates → useApiData deps change → list + summary refetch
      ↓ previous rows stay latched (no flash) until new result lands
      ↓ grid + footer totals + tab counters update
```

| Control | Component | Effect |
|---|---|---|
| Date range | `<InteractiveDateRangePicker>` | sets `from`/`to` (wire `yyyyMMdd`); default last 30 days |
| Transaction type | `<TransactionTypeFilter>` | all / deposit / withdraw → wire `type` |
| Status tabs | `<TransactionStatusTabs>` | All / Confirmed / Unconfirmed → wire `cnfm_yn`; counts from summary |
| Search | `<SearchInput>` | debounced → wire `keyword` |

## 4. Confirm / undo flow

```
Row Confirm button → PUT .../{trnsSeqNo}/confirm → refreshed detail → in-place row update
Row Undo button    → DELETE .../{trnsSeqNo}/confirm → row flips to unconfirmed (yellow tint)
Errors → useDialog({ type: "error", errorCode })
```

## 5. Classification flow (per row)

```
Row picker (Reporting Account / Purpose / VAS / Contact dropdown)
      ↓ select a value → PATCH .../{reporting-account|purpose|vas-account|contact}
      ↓ clear → DELETE the same path
      ↓ refreshed detail → in-place row update
Picker options preloaded on mount (chart-of-accounts / purpose / vas-account / contacts).
```

## 6. Export flow

```
Toolbar Excel icon → handleExport()
  → useExcelExport().exportXlsx({
        endpoint: /api/v1/banking/accounts/transactions/export,
        screenId: BANKING_TRANSACTION_HISTORY,
        fileName: "Transaction History (VND)_DDMMYYYY",
        title:    "Transaction History (VND) " + account label,
        items:    live View Setting columns,
        columnConfig: TRANSACTION_HISTORY_EXPORT_COLUMNS,
        filters:  { acctSeqNo, from, to, type, cnfm_yn, keyword },
        sort:     null,            ← sort not yet wired
     })
  → backend streams XLSX → blob saved with server filename
  → sticky exporting flag disables Excel/List icons during the call
```

## 7. View Setting flow

```
Toolbar List icon → captures icon DOMRect → <ViewSettingPopover anchorRect={rect} />
  → toggle column visibility / reorder (CHECKBOX/ETC specials hidden + locked)
  → Save → useViewSetting.save() ; Reset → reset() ; Cancel/ESC/outside → discard
```

## 8. State diagram (summary)

```
                ┌─────────────┐  filter change   ┌─────────────┐
   mount ─────▶ │  LOADING    │ ───────────────▶ │  REFETCHING │
                │ (≥400ms)    │                  │ (rows latch)│
                └─────┬───────┘                  └─────┬───────┘
                      │ data lands                     │ data lands
                      ▼                                ▼
                ┌─────────────┐   empty result   ┌─────────────┐
                │   GRID      │ ───────────────▶ │   EMPTY     │  "No Data Found (VND)"
                └─────────────┘                  └─────────────┘
                      │ API error
                      ▼
                ┌─────────────┐
                │  ERROR      │  useDialog({ type:"error" })
                └─────────────┘
```

## 9. Synchronization (not on this screen)

Transaction History does **not** trigger a bank pull. Fresh transactions are synced via the **Account
Inquiry (VND)** "Update / Sync" action (`BankTransactionSyncService`). This screen reads the
already-synced rows. See [account-inquiry-vnd/screen-flow.md](../account-inquiry/screen-flow.md).

# Transaction History (FCY) — UI Specification (Frontend)

Layout, filters, grid, and states for the FCY transaction inquiry. FCY reuses the VND shell
(`TransactionHistoryClient` + `TransactionHistoryPage`) verbatim — this doc notes only FCY-specific
behaviour (route scope, currency labelling, empty state). Component map:
[component-index.md](component-index.md). Backend contract:
[wecms-api/docs/features/banking/transaction-history-fcy/](../../../../../wecms-api/docs/features/banking/transaction-history-fcy/README.md).

---

## 1. Layout

Inlined two-column header block (CLAUDE.md §11 — NOT `<PageHeader>`, because both columns stack two
rows). Below it, a **custom shell** (not `<DataTableShell>`) so the Total row is pinned outside the
scroll area.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ▸ left column                          ▸ right column (items-end)           │
│   h1  Transaction History (BIDV USD)     [list] [excel]  [Smart Organizer]  │  ← toolbar
│   [date range]  [type radio]             [All|Confirmed|Unconfirmed tabs]   │
│                                          [search input]                     │
├───────────────────────────────────────────────────────────────────────────┤
│  custom-scrollbar (X+Y)                                                      │
│    <TransactionTable rows=pg.paged visibleColumns minWidth … />             │
│    (empty-state div when pg.paged.length === 0)                             │
│    <TransactionTableFooter mt-auto totals currency … />                     │
│  <Pagination shrink-0 />   (outside scroll container)                        │
└───────────────────────────────────────────────────────────────────────────┘
```

Title: `text-wb-18 font-semibold tracking-wb-tight text-wb-dark` via
`t("txn_history.breadcrumb", { account: \`${account.bankName} ${account.currency}\` })` — for FCY the
currency segment is the foreign currency (USD/KRW/JPY/EUR/…).

---

## 2. Filters

| Control | Component | Notes |
|---|---|---|
| Date range | `<InteractiveDateRangePicker startIso endIso onChange>` | default last 30 days |
| Transaction type | `<TransactionTypeFilter>` | All / deposit / withdraw radios |
| Status tabs | `<TransactionStatusTabs active counts onChange>` | All / Confirmed / Unconfirmed (counts from summary) |
| Keyword | `<SearchInput placeholder={t("txn_history.search_placeholder")}>` | matches amount / contact / purpose / remark |

There is **no currency filter** and **no bank filter** on this screen — the FCY account (and therefore
the currency) is fixed by the `[accountId]` route. There is **no sync button** (sync is Account
Inquiry's concern).

---

## 3. Currency scoping (FCY)

- The current currency comes from the resolved account record: `fetchAccounts("FCY")` → match
  `acct_seq_no === acctSeqNo` → `currency = row.ccy_cd`. Fallback while the list loads:
  `scope === "VND" ? "VND" : ""`.
- The selectable FCY accounts (which currencies are reachable) are the sidebar's per-account children,
  from `useTransactionHistoryAccounts("FCY")` → `GET /api/v1/banking/accounts?currency=FCY`.
- Currency is consumed for: the page title, the footer total label
  (`t("txn_history.total_label", { currency })`), the empty-state branch, and the export filename. It
  is **not** sent as a list-filter param (the `acctSeqNo` already scopes it).

---

## 4. Grid columns

View-Setting-driven (`columnRegistry.tsx`), filtered to `use_yn === "Y"`, special FIELD_IDs dropped,
sorted by `disp_ord`. Default order (FALLBACK seed):

| FIELD_ID | Header key | Bound field / render |
|---|---|---|
| `TRSC_ID` | `txn_history.col.transaction_id` | `row.transactionId` |
| `TRSC_DTM` | `txn_history.col.date_time` | two-line `row.date` / `row.time` |
| `DEPOSIT_AMT` | `txn_history.col.deposit` | `row.deposit` (green) |
| `WITHDRAW_AMT` | `txn_history.col.withdraw` | `row.withdraw` (red) |
| `BAL` | `txn_history.col.balance` | `row.balance` |
| `RMRK` | `txn_history.col.remarks` | `row.remarks` |
| `FILE_NM` | `txn_history.col.file_name` | Smart Organizer Match/Unmatch link |
| `MTCH_DT` | `txn_history.col.matched_date` | `row.matchedDate` (when matched) |
| `MTCH_BY` | `txn_history.col.matched_by` | `row.matchedBy` (when matched) |
| `CHART_ACCT_CD` | `txn_history.col.reporting_account` | `<ReportingAccountSelect>` |
| `PURPOSE` | `txn_history.col.purpose` | `<PurposeSelect>` (yellow tint) |
| `VAS_ACCT_CD` | `txn_history.col.vas_account` | `<VasAccountSelect>` (yellow tint) |
| `CONTACT_NM` | `txn_history.col.contact_name` | `<ContactSelect>` (yellow tint) |
| `CONFIRMED_BY` | `txn_history.col.confirmed_by` | `row.confirmedBy.name` |
| *(trailing)* `ACTION` | — | Confirm / Undo button (hardcoded chrome, not in View Setting) |

Amounts render the raw wire strings (FCY values, not VND-converted). Date/time formatted via
`formatLegacyDate` / `formatLegacyTime`. No row-selection checkbox column.

**Row tinting:** unmatched rows (`row.linkMatchYn !== "Y"`) tint the Confirmed-by + Action cluster
yellow (`bg-[#FFFEDB]`, the legacy unmatched-row color — documented inline-hex exception). Purpose/VAS/
Contact cells are always yellow.

---

## 5. Sorting

All headers `sortable={false}` — per-column interactive sort is **not wired** (PARTIAL, shared with
VND). The grid is most-recent-first by default. Seed `sort_yn` flags exist for future use.

---

## 6. Pagination

Client-side `usePagination<TransactionRow>({ items: rows })`, page sizes `[10,20,50,100]` (default 10),
outside the scroll container (`shrink-0`). Filter `onChange` handlers call `pg.resetPage()`.

---

## 7. Detail surface

There is **no separate per-transaction detail page or drawer**. Classification (Reporting Account /
Purpose / VAS / Contact) and Confirm/Undo operate **in place** — each mutation returns the refreshed
transaction and the client bumps `refreshKey` to re-fetch. A single-transaction detail API
(`fetchTransactionDetail`) exists and backs the mutation responses, but renders no standalone page.
The only drill-down popup is `<SmartOrganizerDialog>` (match hand-off).

---

## 8. Loading / empty / error states

| State | Render |
|---|---|
| Initial load | centered `t("common.loading")` (sticky-gated) |
| Search/refetch | previous rows stay visible (`stableTxnData` latch) — no flash |
| Empty (FCY) | `t("txn_history.empty_fcy")` — "Transaction History (FCY) Not Found" |
| Export in flight | Excel icon disabled (`stickyExporting`, `cursor-wait opacity-60`) |
| Error | `useDialog().open({ type: "error", title: t("dialog.error"), errorCode })` |
| Confirm/Undo success | `t("txn_history.confirm_success")` / `t("txn_history.undo_success")` |

---

## 9. Typography / tokens

Fully compliant with the `text-wb-*` token system: headers + cells `text-wb-13`, title `text-wb-18
font-semibold`, tabs `text-wb-14-tight font-semibold`, footer totals `text-wb-13 font-semibold`. Green
deposit `text-wb-status-approved-text`, red withdraw `text-wb-status-rejected-text`. The one documented
deviation is the `bg-[#FFFEDB]` unmatched-row tint (legacy color, predates a token).

---

## 10. FCY vs VND

Identical layout, grid, and behaviour. The only differences: the route folder
(`transaction-history-fcy`), the `scope="FCY"` prop, the empty-state key (`empty_fcy` vs `empty_vnd`),
the title/footer currency label (foreign currency vs `VND`), and the export filename. One page
component serves both — fix once, fix both.

# Transaction History (VND) — UI Specification (Frontend)

Layout, filters, grid columns, states. Follows the global UI rules in the wecms-web CLAUDE.md
(§7a table-footer + pagination, §11 two-column header, §13 View Setting). Backend contract:
[wecms-api .../transaction-history-vnd/functional-specification.md](../../../../../wecms-api/docs/features/banking/transaction-history-vnd/functional-specification.md).

---

## 1. Layout

Two-column header block (CLAUDE.md §11) over a `<DataTableShell footerMode="paginationWithTotals">`:

```
┌───────────────────────────────────────────────────────────────────────┐
│ Title + breadcrumb (bank · account)        [List] [Excel] [Smart Org.]  │  ← title row
│ Date range  ·  Type filter                 Tabs(All/Confirmed/Unconf.)  │  ← filter row
│                                            Search input                 │
├───────────────────────────────────────────────────────────────────────┤
│ Transaction grid (sticky thead, horizontal scroll, View-Setting cols)   │
│ …                                                                       │
│ ─────────── (mt-auto) ───────────                                       │
│ Total footer: count · deposit total · withdrawal total                  │
├───────────────────────────────────────────────────────────────────────┤
│ Pagination (outside scroll container)                                   │
└───────────────────────────────────────────────────────────────────────┘
```

- Toolbar (List / Excel / Smart Organizer) sits **once**, top-right of the title row.
- Tabs + search sit in the right column directly under the toolbar.
- The footer (count + deposit/withdraw totals) shares the grid's `<colgroup>` and is anchored with
  `mt-auto`; pagination lives outside the scroll container.

## 2. Filters

| Control | Component | Values | Default |
|---|---|---|---|
| Date range | `InteractiveDateRangePicker` | from–to (display "DD Mon YYYY – DD Mon YYYY"; wire `yyyyMMdd`) | last 30 days |
| Transaction type | `TransactionTypeFilter` | All / Deposit / Withdraw | All |
| Confirmation status | `TransactionStatusTabs` | All / Confirmed / Unconfirmed (with counters) | All |
| Keyword | `SearchInput` | debounced text (matches remark / ref) | empty |

There is **no** separate currency / bank filter on this screen — currency is fixed by the route scope
(VND) and the account is fixed by `[accountId]`. (Account/bank selection happens upstream via the
sidebar nested list or Account Inquiry.)

## 3. Grid columns

Columns are View-Setting-driven (`banking-transaction-history`); the registry
(`columnRegistry.tsx`) maps each `FIELD_ID` to header / width / align / renderer. Visible set =
`use_yn='Y'` ∩ registered, ordered by `disp_ord`; a `FALLBACK_COLUMNS` constant paints the right
shape before the View Setting resolves.

| FIELD_ID | Header | Format / rendering |
|---|---|---|
| `CHECKBOX` | — | row-selection (special, always prepended, not in View Setting popover) |
| `TRSC_ID` | Transaction ID | text |
| `TRSC_DTM` | Date / Time | two-line: date + muted time |
| `DEPOSIT_AMT` | Deposit | right-aligned, green |
| `WITHDRAW_AMT` | Withdrawal | right-aligned, red |
| `BAL` | Balance | right-aligned |
| `RMRK` | Remarks | multi-line text |
| `FILE_NM` | File / source | text or Smart-Organizer match link |
| `MTCH_DT` | Matched date | shown when matched |
| `MTCH_BY` | Matched by | shown when matched |
| `CHART_ACCT_CD` | Reporting Account | picker dropdown (white) |
| `PURPOSE` | Purpose | picker dropdown (yellow tint when unmatched) |
| `VAS_ACCT_CD` | VAS Account | picker dropdown (yellow tint) |
| `CONTACT_NM` | Contact | picker dropdown (yellow tint) |
| `CONFIRMED_BY` | Confirmed by | operator + date when confirmed |
| `ACTION` | — | Confirm / Undo button (trailing; hardcoded, not in View Setting) |

**Row tinting.** Unconfirmed rows tint the Purpose/VAS/Contact/Confirmed-by cluster yellow
(`bg-[#FFFEDB]`); confirmed rows stay white and the action button reads "Undo".

**Typography.** Header + body `text-wb-13` per the table-typography rule; no inline px sizes.

## 4. Sorting

All headers currently render `sortable={false}` — interactive per-column sort is **not yet wired**
(PARTIAL). The grid is most-recent-first by default. Infrastructure (View Setting `SORT_YN`,
`useTableSort`) is ready for a future stabilisation pass — see the backend gap analysis.

## 5. Pagination

Client-side via `usePagination` (10 / 20 / 50 / 100, default 10), `{shown} of {total}` count, page
buttons `size-7`. Pinned outside the scroll container (`shrink-0`).

## 6. Detail surface

Per-row classification + confirm/undo operate **in place** on the grid rows (PATCH/DELETE returning
the refreshed row) — there is no separate full-page detail route on this screen. The related
drill-down modal is `LatestTransactionHistoryModal` (opened from Account Inquiry's balance-click /
sync popup), which fans out to the same per-account `/transactions` endpoint filtered by type and
renders a Date · Amount · Description list.

## 7. Loading / empty / error states

| State | Behaviour |
|---|---|
| Initial load | sticky "Loading…" for ≥400 ms; stable data latched once the list lands |
| Search / filter refetch | previous rows stay visible (latched); no spinner flash |
| Export in flight | sticky exporting flag disables Excel + List icons |
| Empty result | centered "No Data Found (VND)" (`txn_history.empty_vnd`); FCY twin uses `…_fcy` |
| API error | `useDialog({ type: "error", description, errorCode })` — confirm / undo / classify / export all routed |

## 8. VND vs FCY

Identical UI; the only differences are the `scope` prop, the route
(`/banking/transaction-history-fcy`), the empty-state message key, and the export filename/title
label. One `TransactionHistoryPage` + one `TransactionHistoryClient` serve both.

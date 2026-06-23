# Transaction History (VND) — Frontend Test Scenarios (SIT/UAT)

Frontend-facing SIT/UAT scenarios. Backend scenarios:
[wecms-api .../transaction-history-vnd/test-scenarios.md](../../../../../../wecms-api/docs/features/banking/current-savings-vnd/transaction-history/test-scenarios.md).
Legend: ✅ verified · ⏳ pending PARTIAL item.

---

## Navigation & load

| # | Scenario | Expected | Status |
|---|---|---|---|
| N1 | Open via sidebar nested account | Routes to `/banking/transaction-history/[accountId]`; sidebar parent expanded, child active | ✅ |
| N2 | Open index route | `TransactionHistoryIndexRedirect` redirects to first account; no blank landing | ✅ |
| N3 | Enter from Account Inquiry | Account drill-in lands on its transaction history | ✅ |
| N4 | Breadcrumb | Shows bank + account nickname from `/accounts` | ✅ |

## Search / filter

| # | Scenario | Expected | Status |
|---|---|---|---|
| F1 | Default load | Last-30-days range; rows most-recent-first; tab counts from summary | ✅ |
| F2 | Change date range | List + summary refetch; totals update; page resets to 1 | ✅ |
| F3 | Type = Deposit / Withdraw | Only matching rows; opposite amount column blank | ✅ |
| F4 | Status tab Confirmed / Unconfirmed | Filters rows; counters reflect summary | ✅ |
| F5 | Keyword search | Debounced; matches remark/ref | ✅ |
| F6 | Filter change keeps rows visible | Previous rows latched during refetch (no flash) | ✅ |

## Grid

| # | Scenario | Expected | Status |
|---|---|---|---|
| G1 | Deposit row | Deposit cell green, withdrawal blank, balance shown | ✅ |
| G2 | Withdrawal row | Withdrawal cell red, deposit blank | ✅ |
| G3 | Unconfirmed row tint | Purpose/VAS/Contact/Confirmed-by cluster tinted yellow; action = Confirm | ✅ |
| G4 | Confirmed row | White row; action = Undo; confirmed-by populated | ✅ |
| G5 | Column visibility/order | Changing View Setting reflows columns; CHECKBOX/ETC locked & hidden from popover | ✅ |

## Confirm / classify

| # | Scenario | Expected | Status |
|---|---|---|---|
| C1 | Confirm a row | PUT confirm; row flips to confirmed in place; no full refetch | ✅ |
| C2 | Undo a row | DELETE confirm; row flips to unconfirmed | ✅ |
| C3 | Assign Reporting Account / Purpose / VAS / Contact | PATCH; cell updates in place | ✅ |
| C4 | Clear a classification | DELETE; cell clears | ✅ |
| C5 | Picker options | Preloaded from settings endpoints | ✅ |

## Detail

| # | Scenario | Expected | Status |
|---|---|---|---|
| D1 | Account-Inquiry drill-down modal | `LatestTransactionHistoryModal` lists Date · Amount · Description via `/transactions` | ✅ |
| D2 | In-place row mutations | Confirm/classify operate on grid rows (no separate detail route on this screen) | ✅ |

## Sort & pagination

| # | Scenario | Expected | Status |
|---|---|---|---|
| SP1 | Default order | Most-recent-first | ✅ |
| SP2 | Click sortable header | Server-side re-sort | ⏳ PARTIAL — headers `sortable={false}`; not yet wired |
| SP3 | Page navigation / size change | Client-side paging; page-1 reset on size change; `{shown} of {total}` correct | ✅ |

## Export

| # | Scenario | Expected | Status |
|---|---|---|---|
| E1 | Export with data | XLSX downloads; filename `Transaction History (VND)_DDMMYYYY`; toolbar disabled during call | ✅ |
| E2 | Export without data | XLSX header + zero rows | ✅ |
| E3 | Column verification | Visible View-Setting columns present; date/amounts/remark/confirmed-by populated | ✅ |
| E4 | Stub columns | TRSC_ID/FILE_NM/MTCH_DT/PURPOSE/CONTACT_NM cells blank | ⏳ PARTIAL (backend stub) |

## States & errors

| # | Scenario | Expected | Status |
|---|---|---|---|
| ST1 | Initial loading | "Loading…" gate ≥400 ms | ✅ |
| ST2 | Empty result | "No Data Found (VND)" centered | ✅ |
| ST3 | API error | `useDialog({ type:"error" })` with code + trace id | ✅ |
| ST4 | 401 | Global session-expired interceptor handles re-auth | ✅ |

## Permissions

| # | Scenario | Expected | Status |
|---|---|---|---|
| P1 | Authorized | Page renders with data | ✅ |
| P2 | Unauthorized | Backend 403/401 surfaces as error dialog; no data | ✅ |

## VND / FCY parity

| # | Scenario | Expected | Status |
|---|---|---|---|
| V1 | FCY twin route | Same UI; `scope="FCY"`; empty message `…_fcy`; export label FCY | ✅ |
| V2 | Single shared component | Both routes compose one `TransactionHistoryClient`/`Page` | ✅ |

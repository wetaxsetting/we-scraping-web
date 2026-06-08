# Transaction History (FCY) — Test Scenarios (Frontend)

Frontend SIT/UAT scenarios for the FCY transaction inquiry. Legend: ✅ verified · ⏳ pending PARTIAL.
Backend-side scenarios: [wecms-api/docs/features/banking/transaction-history-fcy/test-scenarios.md](../../../../../wecms-api/docs/features/banking/transaction-history-fcy/test-scenarios.md).

## Navigation & load

| # | Scenario | Expected | Status |
|---|---|---|---|
| N1 | Sidebar ▸ Current & Savings (FCY) ▸ Transaction History expands | Per-account FCY children (WOORI 2308, BIDV 2913, SHINHAN 6946) listed | ✅ |
| N2 | Click an FCY account child | Navigates to `/banking/transaction-history-fcy/{id}`; active state highlights | ✅ |
| N3 | Visit `/banking/transaction-history-fcy` (index) | Redirects to the first FCY account | ✅ |
| N4 | Index with empty FCY account list | "No accounts available for this scope." stub (no redirect loop) | ✅ |
| N5 | Initial load | Centered `t("common.loading")` until rows latch | ✅ |
| N6 | Deep-link from Account Inquiry (FCY) balance | Lands on the correct FCY account ledger | ✅ |

## Search / filter

| # | Scenario | Expected | Status |
|---|---|---|---|
| S1 | Change date range | Rows re-fetch; page resets to 1 | ✅ |
| S2 | Type = deposit / withdraw | Only matching rows | ✅ |
| S3 | Status tab Confirmed / Unconfirmed | Counts + rows match the tab | ✅ |
| S4 | Keyword (amount / contact / purpose) | Case-insensitive backend match | ✅ |
| S5 | Filter change keeps prior rows visible | No flash (`stableTxnData`) | ✅ |

## Grid

| # | Scenario | Expected | Status |
|---|---|---|---|
| G1 | Columns render per View Setting | `use_yn='Y'` columns in `disp_ord` order | ✅ |
| G2 | Deposit green / withdraw red | `text-wb-status-approved-text` / `…-rejected-text` | ✅ |
| G3 | Amounts in FCY | Raw FCY wire strings, not VND-converted | ✅ |
| G4 | Unmatched-row tint | Confirmed-by + action cluster yellow; Purpose/VAS/Contact always yellow | ✅ |
| G5 | View Setting popover (list icon) | Toggle/reorder columns; Save persists | ✅ |

## Multi-currency (FCY)

| # | Scenario | Expected | Status |
|---|---|---|---|
| M1 | USD account | Title + footer show USD; amounts in USD | ✅ |
| M2 | KRW account | Title + footer show KRW | ✅ |
| M3 | JPY / EUR account | Title + footer show the account's currency | ✅ |
| M4 | No in-page currency dropdown | Currency fixed by the selected account only | ✅ |

## Confirm / classify

| # | Scenario | Expected | Status |
|---|---|---|---|
| C1 | Confirm a row | Confirm → success dialog → row reflects confirmed | ✅ |
| C2 | Undo a row | Undo → success dialog | ✅ |
| C3 | Pick Reporting Account / Purpose / VAS / Contact | In-cell select writes + row re-renders | ✅ |
| C4 | Picker options pre-loaded | Cells render names without per-row calls | ✅ |

## Detail

| # | Scenario | Expected | Status |
|---|---|---|---|
| D1 | No standalone detail page | Classification/confirm operate in place | ✅ |
| D2 | Smart Organizer dialog opens from File Name cell | Match/Unmatch hand-off (account-scoped) | ✅ |

## Sort & pagination

| # | Scenario | Expected | Status |
|---|---|---|---|
| P1 | Default order | Most-recent-first | ✅ |
| P2 | Header click sort | Not wired (`sortable={false}`) | ⏳ |
| P3 | Page size 10/20/50/100 | Client-side paging; resets on filter change | ✅ |

## Export

| # | Scenario | Expected | Status |
|---|---|---|---|
| E1 | Export with data | XLSX downloads with FCY filename + visible columns | ✅ |
| E2 | Export without data | XLSX with header + zero rows | ✅ |
| E3 | Currency formatting | Data cells `#,##0.##`; subheader totals (no symbol) — UAT sign-off | ⏳ |
| E4 | Double-click guard | Excel icon disabled while exporting | ✅ |

## Permissions

| # | Scenario | Expected | Status |
|---|---|---|---|
| A1 | Authorized user | Page loads, rows shown | ✅ |
| A2 | Unauthorized user (no View grant) | 403 `WBE1003` surfaced via error dialog | ✅ |

## Error handling

| # | Scenario | Expected | Status |
|---|---|---|---|
| X1 | API failure on list | Error dialog with code + trace id | ✅ |
| X2 | Empty result (FCY) | `t("txn_history.empty_fcy")` ("Transaction History (FCY) Not Found") | ✅ |
| X3 | Session expired (401) | Global re-auth dialog (axios interceptor) | ✅ |
| X4 | Bank integration failure | Owned by Account Inquiry sync; not surfaced here | ✅ |

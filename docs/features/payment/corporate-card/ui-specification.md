# Corporate Card — UI Specification (Card Transactions)

Frontend UI contract for `/payment/corporate-card/card-transactions`. Typography + tokens per workspace global typography; reference baseline = Banking > Account Inquiry (VND) list page with dashboard hero cards.

## Page chrome

- **Title** `text-page-title` (18/500), key `card_transactions.title`.
- **Toolbar (top-right)** — Dashboard toggle, View Setting popover (list icon), Print, Excel, "Manage Cards", "Update" (primary). List/print/Excel via `<PageActionButtons>`; Manage Cards / Update are feature-scoped.

## Summary cards (`CardSummaryCards`)

Three KPI tiles above the table, toggleable via the dashboard icon:
- **TOTAL** — count + total amount.
- **APPROVAL REQUESTED** — count + amount.
- **APPROVAL NOT REQUESTED** — count + amount.
KPI numbers `text-3xl font-semibold` (27/600).

## Filter bar (`CardTransactionsFilterBar`)

Date range (Last 30/90/180 / custom — required, default 30), All Card Companies (multi-select bank), All Cards (multi-select card), keyword search, link-status tabs (All / Linked / Unlinked), Request Approval CTA. Every `onChange` resets to page 1.

## List / detail (`CardTransactionsTable` + `CardTransactionsTableColumns`)

- Bare `<table>` + shared `<colgroup>` (sibling-footer pattern, totals row).
- Columns iterate the visible View Setting registry in `DISP_ORD` order; checkbox column prepended (not part of View Setting).
- Variant: H product → `table2`, F/M → `table1` (selected from `StoredUser.productType`).
- Inline cells: ReportingAccount, Purpose, Description (editable); memo + link cells.

## Tables / columns

Date/Time (date + small grey time), Card Number (brand chip + masked PAN), Merchant, Card Nickname, Cardholder, Currency, Amount (right-aligned via `formatAmount`), Reporting Account (composite), Status (via `t(stts_key)`), Purpose, Link Reference, Description, Approval Ref, Memo. Page-size options `[15, 20, 50, 100]`.

## Pagination / sorting / empty states

- Server-side pagination via `usePagination` + `<Pagination>`.
- Header sort cycle `default → ASC → DESC → default` (shared `<TableHeaderCell>`); special / projection-only columns no glyph.
- Empty → shared empty-state; loading → skeleton; KPI tiles shimmer.

## Dialogs

| Dialog | Component | Stack |
|---|---|---|
| Approval Ref detail | `ApprovalRefDetailDialog` → `<ApprovalDetailsDialog kind="card">` | 1 |
| Link Card Payments | `LinkCardPaymentsDialog` (e-Invoice + Receipt tabs) | 1 |
| New Receipt | `NewReceiptDialog` | stacked |
| Receipt detail | `ReceiptDetailDialog` | 1 |
| Reporting Account picker | `ReportingAccountPickerDialog` (chart tree) | 1 |
| Card Management | `CardManagementDialog` | 1 |
| Add Card flow | `AddCardFlowDialog` + `SelectCardsDialog` | stacked |
| Update Cards (scrape) | `UpdateCardsDialog` | 1 |
| Memo drawer | `MemoPanel` | side drawer |

System dialogs (success/error/confirm) via `useDialog()`. Modal stacking + close behaviour per the shared primitives.

## Update / sync

Update Cards dialog drives `startCardSyncSession` → challenge resume (`qna`/`otp`/`captcha`); period limits seed the date validator.

## Export / download

Excel via `useExcelExport` (`/api/v1/payment/card-transactions/export`, `screenId: card-transactions`), columns from live View Setting state. Print via shared `printReport`. CSV not sanctioned; frontend never ships rows.

## Approval actions

Request Approval (multipart) from the filter bar CTA on selected rows; Withdraw + Change Line from the Approval Ref detail kebab.

# Corporate Card — Screen Flow (Card Transactions)

Route: `/payment/corporate-card/card-transactions`. Single page (`CardTransactionsPage`) orchestrating the table, dialogs, View Setting popover, export, and print.

## Landing

1. User opens `/payment/corporate-card/card-transactions` (tenant user with the `payment-corporate-card-transactions` menu granted).
2. `CardTransactionsPage` fetches two endpoints: `fetchCardTransactions(filters + page + sort)` and `fetchActiveCards(bankCd?)` via `useApiData` (+ `refreshKey`). Default date range 30 days back.
3. Render: dashboard hero cards (TOTAL / APPROVAL REQUESTED / APPROVAL NOT REQUESTED), filter bar, table (15 rows default), pagination.

## Filter / sort

- Each filter `onChange` (date preset, bank multi-select, card multi-select, link-status tabs, keyword) resets to page 1 and re-fetches.
- Header-click sort cycles `default → ASC → DESC → default` (server-side); special + projection-only columns render no glyph.

## Classify a row

1. Click `CONT` (Description) cell → inline edit → blur → `patchCardTransaction({field:"description"})` → `bumpRefresh()`.
2. Click Purpose cell → code dropdown → `patchCardTransaction({field:"purpose"})`.
3. Click Reporting Account cell → `ReportingAccountPickerDialog` (chart-of-accounts tree, `stackLevel={1}`) → pick → `putCardTransactionReportingAccount`; the × clears via `clearCardTransactionReportingAccount`.

## Drill-ins

- Click **Approval Ref** badge → `ApprovalRefDetailDialog` wrapping `<ApprovalDetailsDialog kind="card">` — shows the linked expense resolution + approver chain (fetched via `fetchCardTransactionsByApproval`); kebab Withdraw (`withdrawCardApproval`) / Change Line (`changeCardApprovalLine` via `EditApprovalLinePicker`).
- Click linked-doc cell → `ReceiptDetailDialog` (`fetchReceiptDetail`).
- Click memo icon (last column) → `MemoPanel` side drawer (`fetchMemos` / `createMemo` / `deleteMemo`).

## Card Management

Toolbar "Manage Cards" → `CardManagementDialog` (list / activate / rename / delete). "Add Card" → `AddCardFlowDialog` → NXISAS scrape → `SelectCardsDialog` (tick) → `createScrapedCards`.

## Update Cards (scrape)

Toolbar "Update" → `UpdateCardsDialog` → `startCardSyncSession`; on a challenge, prompt and call `submitCardSyncQna` / `submitCardSyncOtp` / `submitCardSyncCaptcha`; `fetchCardTranListPeriodLimits` seeds the date-range validator. On success, refresh the ledger.

## Request Approval

Filter-bar Request Approval CTA (on selected rows) → shared `RequestApprovalDialog` → `requestCardApproval` (multipart + attachments). `fetchNextCardDocNo` previews the `VO_YYMMDD_NNN` document number.

## Link Card Payments

Row action → `LinkCardPaymentsDialog` (Expenses e-Invoice + Receipt tabs: `fetchLinkableEInvoices` / `fetchLinkableReceipts`) → `linkCardExpenses` (sum must equal the transaction amount); `unlinkCardExpenses` to undo. "New Receipt" → `NewReceiptDialog` → `createCardReceipt` (+ `fetchPurposeOptions`).

## Export / Print

Toolbar Excel → `useExcelExport` (`endpoint: /api/v1/payment/card-transactions/export`, `screenId: card-transactions`). Print → shared `printReport`.

## Empty / error

- No rows → shared empty-state primitive.
- API/network/validation failure → `useDialog().open({ type: "error", … })` with `code` + `traceId`.

# Corporate Card — Component Index (Card Transactions)

Repo-relative paths under `wecms-web/`.

## Route

`app/(dashboard)/payment/corporate-card/card-transactions/page.tsx` — thin server component (metadata + `<CardTransactionsPage />`).

## Components — `components/payment/corporate-card/` (16)

| File | Role |
|---|---|
| `CardTransactionsPage.tsx` | Top-level client orchestrator — dialogs, View Setting, export, print, fetch/refresh |
| `CardSummaryCards.tsx` | Three KPI cards + dashboard toggle |
| `CardTransactionsFilterBar.tsx` | Date range, bank/card dropdowns, link-status tabs, search, Request Approval CTA |
| `CardTransactionsTable.tsx` | Bare `<table>`; inline ReportingAccount/Purpose/Description cells, memo + link cells |
| `CardTransactionsTableColumns.tsx` | Shared `<colgroup>` + minWidth constant |
| `ApprovalRefDetailDialog.tsx` | Wraps `<ApprovalDetailsDialog kind="card">` (withdraw / change-line) |
| `LinkCardPaymentsDialog.tsx` | Expenses e-Invoice + Receipt tabs |
| `NewReceiptDialog.tsx` | Manual receipt create |
| `ReceiptDetailDialog.tsx` | Read-only linked-doc detail |
| `ReportingAccountPickerDialog.tsx` | Chart-of-accounts tree picker |
| `MemoPanel.tsx` | Right-side memo drawer (list/add/delete) |
| `CardManagementDialog.tsx` | Card Management modal (list/activate/rename/delete) |
| `AddCardFlowDialog.tsx` | Add-Card NXISAS scrape → confirm flow |
| `SelectCardsDialog.tsx` | Tick-which-cards step of Add Card |
| `UpdateCardsDialog.tsx` | Update / Coocon scrape (session/challenge aware) |
| `EditApprovalLinePicker.tsx` | Approval-line picker for change-line |

### Support files (same folder)

- `cardTransactionMappers.ts` — snake_case wire → camelCase boundary mapper (`mapCardTransactionList(api, locale)`). **Feature-local**, not `lib/api/mappers.ts`.
- `addCardFlowTypes.ts` — Add-Card flow types.
- `types.ts` — in-memory types (legacy static-UI shape).
- `mockData.ts` — static seed; present, **NOT a runtime fallback**.

## Hooks (shared)

`useApiData`, `usePagination`, `useTableSort`, `useExcelExport`, `useDialog`, `useTranslation`, `useRefreshKey`, `useViewSetting`. No feature-local hooks.

## API client + mapper

- `lib/api/cardTransactions.ts` — 28 functions: `fetchCardTransactions`, `fetchActiveCards`, `patchCardTransaction`, `putCardTransactionReportingAccount`, `clearCardTransactionReportingAccount`, `fetchManagementCards`, `patchCardActive`, `patchCardInfo`, `deleteManagementCard`, `createScrapedCards`, `syncCardTransactions`, `startCardSyncSession`, `submitCardSyncQna`/`Otp`/`Captcha`, `fetchCardTranListPeriodLimits`, `requestCardApproval`, `fetchNextCardDocNo`, `fetchCardTransactionsByApproval`, `withdrawCardApproval`, `changeCardApprovalLine`, `fetchLinkableEInvoices`, `fetchLinkableReceipts`, `linkCardExpenses`, `unlinkCardExpenses`, `createCardReceipt`, `fetchReceiptDetail`, `fetchPurposeOptions`, `fetchMemos`, `createMemo`, `deleteMemo`.
- `components/payment/corporate-card/cardTransactionMappers.ts` — the boundary mapper.

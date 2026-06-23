# Card Transactions — Frontend (high-level summary)

> ⚠️ This document is a high-level feature summary.
> The detailed source of truth is located in:
> `docs/features/payment/corporate-card/`

**Module:** Payment → Corporate Card · **Menu:** Card Transactions
**Route:** `/payment/corporate-card/card-transactions` · **Slug:** `card-transactions`

Corporate-card ledger page — implemented full-stack (real API wiring, no mock fallback). 16 components, inline-edit cells (reporting account / purpose / description), three feature dialogs, a memo drawer, Card Management + Update Cards modals, Request Approval, Link Card Payments, View Setting popover, Excel export, and Print. API client `lib/api/cardTransactions.ts` (28 functions); boundary mapper `components/payment/corporate-card/cardTransactionMappers.ts`.

## Detailed docs (source of truth) — `corporate-card/`

| Doc | Focus |
|---|---|
| [corporate-card/README.md](corporate-card/README.md) | Overview, route/folder, doc index |
| [corporate-card/screen-flow.md](corporate-card/screen-flow.md) | List → classify → link → approve; Card Management / Update flows |
| [corporate-card/ui-specification.md](corporate-card/ui-specification.md) | Summary cards, filters, list/detail, dialogs, export/download |
| [corporate-card/component-index.md](corporate-card/component-index.md) | 16 components, hooks, API client, mappers |
| [corporate-card/api-consumption.md](corporate-card/api-consumption.md) | Endpoints per screen + shapes (approvers[] empty on ledger rows) |
| [corporate-card/test-scenarios.md](corporate-card/test-scenarios.md) | FE test scenarios + coverage gap |

Backend counterpart: [`wecms-api/docs/features/payment/corporate-card/`](../../../../wecms-api/docs/features/payment/corporate-card/README.md).

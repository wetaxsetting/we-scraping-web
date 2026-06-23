# Corporate Card — Payment Module (Refactor frontend)

> **Companion backend docs:** [`wecms-api/docs/features/payment/corporate-card/`](../../../../../wecms-api/docs/features/payment/corporate-card/README.md). Feature slugs and sub-screen names must match across both trees.

The **Corporate Card** group of the Payment module ships a single sub-screen today: **Card Transactions**.

| Field | Value |
|---|---|
| Module | `payment` (Payments domain), **Corporate Card** group |
| Sub-screens | **Card Transactions** — the only one |
| Route | `/payment/corporate-card/card-transactions` |
| Component folder | `components/payment/corporate-card/` |
| API client | `lib/api/cardTransactions.ts` (28 functions) |
| Mapper | `components/payment/corporate-card/cardTransactionMappers.ts` (feature-local boundary mapper) |
| View Setting `screenId` | `SCREEN_IDS.PAYMENT_CARD_TRANSACTIONS` → `card-transactions` |
| Status | **Implemented full-stack** — real API wiring (no mock fallback), 16 components, inline-edit cells, dialogs, memo drawer, Card Management + Update Cards modals, Request Approval, Link Card Payments, View Setting popover, Excel export, Print |

> **Status banner.** Implemented full-stack, NOT "List-only (Sprint 2)", "design phase", or "not started". `mockData.ts` exists in the folder but the page does **not** use it as a runtime fallback — `useApiData(fetchCardTransactions…)` drives the table.

## Sub-screen map

| Sub-screen | Route | Page component |
|---|---|---|
| **Card Transactions** | `/payment/corporate-card/card-transactions` | `CardTransactionsPage` (via thin `page.tsx`) |

## Document set

| Doc | Purpose |
|---|---|
| [README.md](README.md) | This file — banner, route, sub-screen map, links |
| [screen-flow.md](screen-flow.md) | Screen-by-screen interaction flow |
| [ui-specification.md](ui-specification.md) | Filters, summary cards, list/detail, tables, dialogs, actions |
| [component-index.md](component-index.md) | Components + hooks + API client + mappers |
| [api-consumption.md](api-consumption.md) | Endpoints per screen + shapes |
| [test-scenarios.md](test-scenarios.md) | Browser test plan; FE tests missing |

## Key facts

- Route `/payment/corporate-card/card-transactions`; components `components/payment/corporate-card/`.
- Authz live on the backend: class-level `@PreAuthorize("@menuAuthz.canAccess('payment-corporate-card-transactions')")`.
- Wire ledger row does NOT carry invented fields (`card_trns_usage_nm`, `chart_acct_nm`/`_en`/`_level_nm`, `appr_dv`, `post_seq_no`, `post_reg_id`). `approvers[]` is **always empty** on ledger rows. Real extra fields: `using_type`/`auth_code`/`city`/`note`. Display names resolved client-side from the chart-of-accounts tree + purpose-options (APPROVED DEVIATION).

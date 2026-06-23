# Approval Box — Frontend (high-level summary)

> ⚠️ This document is a high-level feature summary.
> The detailed source of truth is located in:
> `docs/features/payment/approval-box/`

**Module:** Payment → Approval Management · **Menu:** Approval Box
**Route:** `/payment/approval-box` · **Slug:** `approval-box` · **JEX:** `resl_0001_001` (centralized approval inbox)

Centralized approval inbox consumed by every Payment write flow (internal-transfer / vendor / expense / payroll / overseas). Lists pending items with approval status, scheduled date, requestor, and approver chain; supports approve / reject / withdraw / change-approval-line, a detail drill-down, and Excel export. Notifications deep-link back here (`?appr_seq_no={id}` → row highlight + Approval Details auto-open).

## Detailed docs (source of truth)

| Doc | Focus |
|---|---|
| [approval-box/README.md](approval-box/README.md) | Overview, route, doc index |
| [approval-box/screen-flow.md](approval-box/screen-flow.md) | Navigation + tab/filter/detail flow |
| [approval-box/ui-specification.md](approval-box/ui-specification.md) | Tabs, filters, table columns, footer, dialogs |
| [approval-box/component-index.md](approval-box/component-index.md) | Page components, hooks, API client |
| [approval-box/api-consumption.md](approval-box/api-consumption.md) | Endpoints consumed + request/response shapes |
| [approval-box/test-scenarios.md](approval-box/test-scenarios.md) | FE test scenarios + coverage gaps |

Backend counterpart: [`wecms-api/docs/features/payment/approval-box/`](../../../../wecms-api/docs/features/payment/approval-box/README.md).

# Add-on Service — Frontend Feature Docs

Per-screen Next.js design docs for the **Add-on Service** top-menu module (e-invoice + tax-authority operation status). Mirrors the WeCMS Add-on Service menu.

## Menu → file map

| WeCMS Add-on Service menu item | Doc | Route |
|---|---|---|
| Sales e-Invoices | [sales-e-invoices.md](sales-e-invoices.md) | `/addon/sales-einvoices` |
| Expenses e-Invoices | [expenses-e-invoices.md](expenses-e-invoices.md) | `/addon/expenses-einvoices` |
| Operation Status Inquiry | [operation-status-inquiry.md](operation-status-inquiry.md) | `/addon/operation-status` |

Sales / Expenses e-Invoices share one page shell (`EInvoicesPage`) via `translationPrefix` — they are an approved menu-page baseline (multi-currency sibling-footer totals).

## Related components

[`components/addon/sales-einvoices/`](../../../components/addon/sales-einvoices/) (`EInvoicesPage`, `EInvoiceTable`, `EInvoiceTableColumns`) · [`components/addon/`](../../../components/addon/) operation-status.

## API integration

`GET /api/v1/addon/einvoices?type=SALES|EXPENSE` (Sales + Expenses share one endpoint) · `GET /api/v1/addon/operation-status` — see [`lib/api/addon.ts`](../../../lib/api/addon.ts).

## Related backend docs

- Feature specs: [`../../../../wecms-api/docs/features/addon-service/`](../../../../wecms-api/docs/features/addon-service/)
- API contracts: [`../../../../wecms-api/docs/api-spec/addon/`](../../../../wecms-api/docs/references/api-spec/addon/)
- DB schema: [`../../../../wecms-api/docs/database/addon/`](../../../../wecms-api/docs/references/database/addon/)

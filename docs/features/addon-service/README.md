# Add-on Service — Frontend Feature Docs

Per-screen Next.js design docs for the **Add-on Service** top-menu module (e-invoice + tax-authority operation status). Mirrors the WeCMS Add-on Service menu.

## Menu → file map

| WeCMS Add-on Service menu item | Doc | Route |
|---|---|---|
| Sales e-Invoices | [sales-e-invoices/](sales-e-invoices/) ✅ · [sales-e-invoices.md](sales-e-invoices.md) (history) | `/addon/sales-einvoices` |
| Expenses e-Invoices | [expenses-e-invoices/](expenses-e-invoices/) ✅ · [expenses-e-invoices.md](expenses-e-invoices.md) (history) | `/addon/expenses-einvoices` |
| Operation Status Inquiry | [operation-status-inquiry/](operation-status-inquiry/) ✅ · [operation-status-inquiry.md](operation-status-inquiry.md) (history) | `/addon/operation-status` |

Sales / Expenses e-Invoices share one page shell (`EInvoicesPage`) via `translationPrefix` — they are an approved menu-page baseline (multi-currency sibling-footer totals).

**Authorization:** [menu-route-authorization.md](menu-route-authorization.md) — how the top menu / sidebar / route guard show/hide Add-on Service per product type (F/M/H, plus the "W" question) and per permission. Source-verified 2026-06-06.

> **e-Invoice status (2026-06-04):** the consolidated folder docs (✅) supersede the "static UI only / handlers NOT wired" claims in the single-file specs. The pages are wired end-to-end — server-side keyword/sort/pagination, Print, Excel (list + with-details), and the Update modal all call live endpoints.

## Related components

[`components/addon/sales-einvoices/`](../../../components/addon/sales-einvoices/) (`EInvoicesPage`, `EInvoiceTable`, `EInvoiceTableColumns`) · [`components/addon/`](../../../components/addon/) operation-status.

## API integration

`GET /api/v1/addon/einvoices?type=SALES|EXPENSE` (Sales + Expenses share one endpoint) · `GET /api/v1/addon/operation-status` — see [`lib/api/addon.ts`](../../../lib/api/addon.ts).

## Related backend docs

- Feature specs: `addon-service` _(wecms-api backend repo — not included in this clone)_
- API contracts: `addon` _(wecms-api backend repo — not included in this clone)_
- DB schema: `addon` _(wecms-api backend repo — not included in this clone)_

# Add-on Service — Frontend Feature Docs

**Status: CURRENT (index)** — navigation only. Each linked screen doc carries its own status; see [../../README.md § Status vocabulary](../../README.md#status-vocabulary).

Per-screen Next.js design docs for the **Add-on Service** top-menu module (e-invoices, tax-authority operation status, and VAT tax filing). Mirrors the WeCMS Add-on Service menu.

> ⚠️ **This README and the root-level single-file specs are high-level summaries.**
> The detailed source of truth is the per-module folder documentation under
> `docs/features/addon-service/{module}/` (+ the implementation code under
> `components/addon/` and `lib/api/addon.ts`). When a summary and the folder
> docs/code disagree, the **folder docs and code win**.

## Menu → file map

| WeCMS Add-on Service menu item | Doc | Route | Menu permission code | Export / View Setting screenId |
|---|---|---|---|---|
| Sales e-Invoices | [sales-e-invoices/](sales-e-invoices/) ✅ · [sales-e-invoices.md](sales-e-invoices.md) (summary) | `/addon/sales-einvoices` | `addon-einvoices-sales` | `addon-sales-einvoices` |
| Expenses e-Invoices | [expenses-e-invoices/](expenses-e-invoices/) ✅ · [expenses-e-invoices.md](expenses-e-invoices.md) (summary) | `/addon/expenses-einvoices` | `addon-einvoices-expenses` | `addon-expenses-einvoices` |
| Operation Status Inquiry | [operation-status-inquiry/](operation-status-inquiry/) ✅ · [operation-status-inquiry.md](operation-status-inquiry.md) (summary) | `/addon/operation-status` | `addon-operation-status-inquiry` | `addon-operation-status` |
| Tax Filing (VAT Declaration) | [tax-filing/](tax-filing/) ✅ | `/addon/tax-filing` | `addon-vat-declaration` | *(none — list not View-Setting-driven; annex export uses the unseeded id `addon-vat-declaration-annex`)* |

> **Tax Filing documented 2026-08-17.** This index previously listed only three Add-on screens, which
> falsely implied the module had only three features. The full 6-doc set now lives at
> [tax-filing/](tax-filing/README.md), authored from source: statutory form **01/GTGT** (TT80) with a
> dashboard list plus a full-screen declaration form (an overlay, **not** a route), Draft →
> Confirmed lock lifecycle, five annex tabs driven by the declaration's own flags, a schema-driven
> 30-cell indicator grid backed by the shared formula engine in
> [`lib/vat/vatFormula.ts`](../../../lib/vat/vatFormula.ts), and five exports — four generated
> **in the browser** from the authority's own workbooks, one (HTKK XML) from the backend.
>
> Two gaps are recorded there rather than hidden: `POST …/sync` is **not implemented server-side**
> yet, and `GET …/export/pdf` exists but is deliberately not called (it cannot show unsaved edits).

> ⚠️ The **menu permission code** (route guard / `@menuAuthz`) and the **export / View-Setting screenId** are different strings — for e-Invoices the word order flips (`einvoices-sales` vs `sales-einvoices`). Product gating: **F + M show Add-on; HAENGSUNG (H) does not.**

Sales / Expenses e-Invoices share one page shell (`EInvoicesPage`) via `translationPrefix` — they are an approved menu-page baseline (multi-currency sibling-footer totals).

**Authorization:** [menu-route-authorization.md](menu-route-authorization.md) — how the top menu / sidebar / route guard show/hide Add-on Service per product type (F/M/H, plus the "W" question) and per permission. Source-verified 2026-06-06.

> **Status (all three screens ✅ wired, verified through 2026-06-23):** the consolidated folder docs (✅) supersede the "static UI only / handlers NOT wired" claims in the single-file specs.
> - **Sales / Expenses e-Invoices** — server-side keyword/sort/pagination/**status filter**, Print, Excel (list + with-details), and the Update modal all call live endpoints. **IR-4 is CLOSED (2026-06-30):** the invoice-status filter is server-side; there is no client-side post-filter left. *(Corrected 2026-08-17 — this line previously described the status filter as the one remaining client-side piece.)*
> - **Operation Status Inquiry** — list/filter/sort/pagination, the Inquire dialog (Get Business Info **+ Save**), bulk Update, Excel, and Print are all wired against live endpoints.

## Related components

[`components/addon/sales-einvoices/`](../../../components/addon/sales-einvoices/) (`EInvoicesPage`, `EInvoiceTable`, `EInvoiceTableColumns`) · [`components/addon/`](../../../components/addon/) operation-status.

## API integration

`GET /api/v1/addon/einvoices?type=SALES|EXPENSE` (Sales + Expenses share one endpoint) · `GET /api/v1/addon/operation-status` — see [`lib/api/addon.ts`](../../../lib/api/addon.ts).

## Related backend docs

- Feature specs: `addon-service` _(wecms-api backend repo — not included in this clone)_
- API contracts: `addon` _(wecms-api backend repo — not included in this clone)_
- DB schema: `addon` _(wecms-api backend repo — not included in this clone)_

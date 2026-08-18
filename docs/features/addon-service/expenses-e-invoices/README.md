# Expenses e-Invoices — Frontend Feature (wecms-web)

**Module:** Add-on Service
**Feature slug:** `expenses-e-invoices`
**Route:** `/addon/expenses-einvoices`
**View Setting screen ID:** `SCREEN_IDS.ADDON_EXPENSES_EINVOICES` = `addon-expenses-einvoices`
**Status:** ✅ **Wired** — the same page shell as Sales with `type="EXPENSE"`; list, filters, sort, pagination, Print, Excel (list + details), and Update are wired against live backend endpoints (verified 2026-06-02).

> **Expenses is a two-line variant wrapper around the Sales shell.** [`<ExpensesEInvoicesPage>`](../../../../components/addon/expenses-einvoices/ExpensesEInvoicesPage.tsx) renders `<EInvoicesClient type="EXPENSE" translationPrefix="expenses_einvoices" />` — every other component lives in `components/addon/sales-einvoices/`. This folder documents **only the deltas**; the canonical frontend description is [../sales-e-invoices/](../sales-e-invoices/README.md).

> This folder **supersedes the status claims** in the older single-file spec [../expenses-e-invoices.md](../expenses-e-invoices.md) (which calls the page "static UI implemented as a thin variant wrapper; filters/sort/pagination/Print/Excel/Update NOT wired" and flags the `EXPENSE→'E'` backend code bug). **Both are stale** — the page is wired and the backend maps `EXPENSE→'B'`.

---

## What the page does

`/addon/expenses-einvoices` lists every e-invoice the company has **received from its suppliers** (`DOC_TYPE='B'`). Same 8-column table and multi-currency footer as Sales; the counterparty column header reads **"Supplier"** and the dominant compliance driver is **input-VAT credit** — a suspended/ceased supplier MST can invalidate the buyer's credit.

---

## Key differences vs Sales

| Aspect | Sales | Expenses |
|---|---|---|
| Route | `/addon/sales-einvoices` | `/addon/expenses-einvoices` |
| `type` | `SALES` | `EXPENSE` |
| `translationPrefix` | `sales_einvoices` | `expenses_einvoices` |
| Counterparty header | "Buyer" | **"Supplier"** (`expenses_einvoices.col.buyer`) |
| Screen ID | `ADDON_SALES_EINVOICES` | `ADDON_EXPENSES_EINVOICES` |
| Excel `screenId` | `addon-sales-einvoices` | `addon-expenses-einvoices` |
| Compliance angle | output VAT | input-VAT credit (supplier MST) |

Everything else — page shell, table, footer, filters, sort, pagination, Print, Excel, Update modal, status badge logic — is **identical** (shared code).

---

## Documents in this folder

| Doc | Focus (delta only) |
|---|---|
| [screen-flow.md](screen-flow.md) | Variant wrapper + `type=EXPENSE` fetch; otherwise identical to Sales. |
| [ui-specification.md](ui-specification.md) | "Supplier" header relabel + `expenses_einvoices.*` keys; otherwise identical. |
| [component-index.md](component-index.md) | The one Expenses-owned file + the shared Sales components. |
| [api-consumption.md](api-consumption.md) | `type=EXPENSE` request delta; `addon-expenses-einvoices` export screenId. |
| [test-scenarios.md](test-scenarios.md) | Expenses-specific assertions. |

---

## Legacy & Migration Traceability

**JEX counterpart (read-only reference):** `einv_0001_001` with `einvType=2` (Expenses / inbound)

---

## Related docs (kept in place — cross-references)

- Design-history spec: [../expenses-e-invoices.md](../expenses-e-invoices.md)
- Canonical frontend (shared shell): [../sales-e-invoices/README.md](../sales-e-invoices/README.md)
- **Backend counterpart:** [../../../../../wecms-api/docs/features/addon-service/expenses-e-invoices/README.md](../../../../../wecms-api/docs/features/addon-service/expenses-e-invoices/README.md)
  - API contract: [wecms-api/…/interface-specification.md](../../../../../wecms-api/docs/features/addon-service/expenses-e-invoices/interface-specification.md)
- Page mapping index: [../../../references/page-mapping/page-mapping.md](../../../references/page-mapping/page-mapping.md)

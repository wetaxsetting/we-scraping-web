# Add-on Service > Expenses e-Invoices — Frontend Summary (Root)

> ⚠️ **This document is a high-level feature summary.**
> The detailed source of truth is the module-folder documentation:
> [`docs/features/addon-service/expenses-e-invoices/`](expenses-e-invoices/README.md)
> (deltas over the shared [Sales shell](sales-e-invoices/README.md)) + the code under `components/addon/` and `lib/api/addon.ts`. When this summary and the folder docs/code disagree, the **folder docs and code win**.

**Module:** Add-on Service · **Feature slug:** `expenses-e-invoices`
**Route:** `/addon/expenses-einvoices` · **View Setting / export screenId:** `addon-expenses-einvoices`
**Menu permission code:** `addon-einvoices-expenses` (see [menu-route-authorization.md](menu-route-authorization.md))
**Status:** ✅ **Wired** — a thin variant of the shared Sales shell (`<ExpensesEInvoicesPage>` → `<EInvoicesClient type="EXPENSE">`); same wired list/sort/pagination/Print/Excel/Update as Sales (verified 2026-06-02).
**JEX counterpart (read-only reference):** `einv_0001_001` with `einvType=2` (Expenses / inbound).

---

## Purpose

`/addon/expenses-einvoices` lists every e-invoice the company has **received from its suppliers** (`DOC_TYPE='B'`). Same columns and capabilities as Sales, with the counterparty being the **supplier** (input-VAT credit compliance angle).

## Feature overview

- **Shares the Sales page shell** — `components/addon/sales-einvoices/` components are reused; only `type="EXPENSE"` + `translationPrefix="expenses_einvoices"` differ. The Expenses-specific wrapper is `components/addon/expenses-einvoices/ExpensesEInvoicesPage.tsx`.
- All Sales capabilities apply (list, multi-currency totals, Print, Excel list + with-details, Update modal).
- **No View Setting popover** (export screenId only — same as Sales).

## Route / menu / permission mapping

| Concern | Value |
|---|---|
| Route | `/addon/expenses-einvoices` |
| Menu permission code | `addon-einvoices-expenses` |
| Export / View Setting screenId | `addon-expenses-einvoices` |
| Components | `components/addon/expenses-einvoices/` (wrapper) + shared `components/addon/sales-einvoices/` |
| API client | [`lib/api/addon.ts`](../../../lib/api/addon.ts) — `fetchEInvoices("EXPENSE")` etc. |
| Product gating | F + M only (H omits Add-on) |

## Current implementation status

✅ Wired (shared shell). **Known gap:** the invoice-**status** filter is client-side on both Sales and Expenses (backend IR-4 status param not implemented).

## Detailed docs (source of truth)

[expenses-e-invoices/](expenses-e-invoices/README.md) (deltas) → canonical shared shell [sales-e-invoices/](sales-e-invoices/README.md). **Backend counterpart:** [`wecms-api/.../expenses-e-invoices/`](../../../../wecms-api/docs/features/addon-service/expenses-e-invoices/README.md).

## Design history

The prior verbose version of this file (which also flagged the now-resolved backend `EXPENSE → 'E'` bug — actual mapping is `'B'`) is preserved in git history.

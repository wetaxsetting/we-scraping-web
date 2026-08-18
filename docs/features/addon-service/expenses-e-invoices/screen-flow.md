# Expenses e-Invoices — Screen Flow

Route `/addon/expenses-einvoices`. Page: `app/(dashboard)/addon/expenses-einvoices/page.tsx` → [`<ExpensesEInvoicesPage>`](../../../../components/addon/expenses-einvoices/ExpensesEInvoicesPage.tsx) → [`<EInvoicesClient type="EXPENSE" translationPrefix="expenses_einvoices">`](../../../../components/addon/sales-einvoices/EInvoicesClient.tsx).

**The flow is identical to Sales** — see the canonical [Sales screen-flow.md](../sales-e-invoices/screen-flow.md). Only the deltas are below.

---

## Deltas vs Sales

| Step | Expenses behaviour |
|---|---|
| Entry wrapper | `<ExpensesEInvoicesPage>` (two lines) → shared `<EInvoicesClient>` with `type="EXPENSE"`, `translationPrefix="expenses_einvoices"`. |
| List fetch | `fetchEInvoices({ type: "EXPENSE", from, to, keyword, status, page, size, ...sortParams })` → `GET /api/v1/addon/einvoices?type=EXPENSE` (resolves to `DOC_TYPE='B'`). |
| Counterparty | `trco_cmnm` / `trco_tax_id` carry the **supplier**; the BUYER column header renders "Supplier" via `expenses_einvoices.col.buyer`. |
| Excel | `screenId: addon-expenses-einvoices`; filters carry `type: "EXPENSE"` — **critical**: if `type` falls through the export returns Sales data. |
| Update modal | `<UpdateEInvoiceModal variant="EXPENSE">` (per-variant copy "Expenses e-Invoice"). |
| Everything else | identical — **server-side status filter** (IR-4 closed 2026-06-30; no client post-filter), date range default (last 30 days), 300 ms keyword debounce, server-side sort + pagination, multi-currency footer, latched `stableData`, sticky loading, error dialogs. |

All loading / empty / error behaviour matches [Sales §7](../sales-e-invoices/screen-flow.md#7-loading--empty--error) (empty key = `expenses_einvoices.empty`).

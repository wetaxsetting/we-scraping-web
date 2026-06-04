# Expenses e-Invoices — Frontend Test Scenarios

The page is the shared Sales shell with `type="EXPENSE"`, so the full checklist in the canonical [Sales test-scenarios.md](../sales-e-invoices/test-scenarios.md) applies. Run each scenario at `/addon/expenses-einvoices` and verify the Expenses-specific assertions below.

## Expenses-specific assertions

1. **Type discriminator** — every list request carries `type=EXPENSE`; only `DOC_TYPE='B'` (supplier) rows return.
2. **Supplier header** — the counterparty column header reads "Supplier" (EN) / "공급자" (KO) / "Nhà cung cấp" (VI) via `expenses_einvoices.col.buyer`; the cell composition (name + `MST : {code}` + status) matches Sales.
3. **Compliance flag** — a supplier with `COMPANYSTATUS = 'NNT ngừng hoạt động …'` renders the verbatim Vietnamese text (not abbreviated) — input-VAT credit signal.
4. **Excel** — `POST /einvoices/export` carries `screenId=addon-expenses-einvoices` + `type=EXPENSE`; verify the download is Expenses data (a missing `type` would silently yield Sales data — regression check).
5. **Empty-state** — on a DEV DB without `DOC_TYPE='B'` rows the list is empty (no mock fallback); after the V52 demo seed it is populated.
6. **i18n** — title, status labels, and footer use `expenses_einvoices.*`.

All list/filter/sort/paginate, status-display, toolbar, pagination, and auth/responsive scenarios are identical to Sales.

# Sales e-Invoices — Frontend Feature (wecms-web)

**Module:** Add-on Service
**Feature slug:** `sales-e-invoices`
**Route:** `/addon/sales-einvoices`
**View Setting screen ID:** `SCREEN_IDS.ADDON_SALES_EINVOICES` = `addon-sales-einvoices`
**Status:** ✅ **Wired** — the page renders live data with server-side keyword search, status filter, header-click sort, and pagination; multi-currency footer totals; Print, Excel (list **and** with-details), and an Update modal are all wired against live backend endpoints (verified 2026-06-02).

> Consolidated, **code-accurate** home for the Sales e-Invoices frontend. It **supersedes the status claims** in the older single-file spec [../sales-e-invoices.md](../sales-e-invoices.md) (which describes the page as "static UI only — filters/sort/pagination/Print/Excel/Update NOT wired"). That is **stale**: all of those are wired today. The older spec is kept as design-history reference and cross-linked below.

> **Sales and Expenses share one page shell.** `<EInvoicesClient>` / `<EInvoicesPage>` / `<EInvoiceTable>` and friends live in `components/addon/sales-einvoices/` and are reused by both routes — only `type` (`SALES`/`EXPENSE`) and `translationPrefix` differ. This Sales folder is the canonical frontend description; [expenses-e-invoices/](../expenses-e-invoices/README.md) documents only the deltas.

---

## What the page does

`/addon/sales-einvoices` lists every e-invoice the company has **issued to its customers** (`DOC_TYPE='I'`). Each row shows the issue date/time, e-invoice serial + status sub-line, buyer (name + MST), currency, total / status / tax / pre-tax amounts. The footer shows one totals row per currency. The finance team filters, sorts, exports, prints, and refreshes the list from the GDT.

Capabilities, all wired:

- **List** — server-side keyword search (`keyword`, 300 ms debounce), invoice-status dropdown filter, header-click sort (`useTableSort`), and server-side pagination.
- **Multi-currency totals** — sibling footer table, one `<tr>` per currency.
- **Print** — shared `printReport` over the current rows.
- **Excel — with List** — XLSX via the shared `useExcelExport` hook → `POST /api/v1/addon/einvoices/export`.
- **Excel — with Details** — line-item-expanded XLSX → `POST /api/v1/addon/einvoices/export-details`.
- **Update** — opens `<UpdateEInvoiceModal>` (Settings / History + GDT re-pull UI); on completion bumps `refreshKey` to refetch.

---

## Documents in this folder

| Doc | Focus |
|---|---|
| [screen-flow.md](screen-flow.md) | Page behaviour & user flows: list/filter/sort/paginate, status filter, Update modal flow, export, print, loading/empty/error. |
| [ui-specification.md](ui-specification.md) | Layout, toolbar, filters, 8 table columns, status badge rules, footer totals, column-width tokens, Update modal spec. |
| [component-index.md](component-index.md) | Component files, shared/expenses split, hooks, lib helpers used. |
| [api-consumption.md](api-consumption.md) | Backend endpoints consumed, API-client functions, wire types, mappers, state handling, validation. |
| [test-scenarios.md](test-scenarios.md) | Frontend test scenarios. |

---

## Legacy & Migration Traceability

**JEX counterpart (read-only reference):** `einv_0001_001` with `einvType=1` (Sales / outbound)

---

## Related docs (kept in place — cross-references)

- Design-history spec: [../sales-e-invoices.md](../sales-e-invoices.md)
- Sister feature (shared shell): [../expenses-e-invoices/README.md](../expenses-e-invoices/README.md)
- **Backend counterpart:** [../../../../../wecms-api/docs/features/addon-service/sales-e-invoices/README.md](../../../../../wecms-api/docs/features/addon-service/sales-e-invoices/README.md)
  - API contract: [interface-specification.md](../../../../../wecms-api/docs/features/addon-service/sales-e-invoices/interface-specification.md)
- Page mapping index (JEX `_view.jsp` → Next.js route): [../../../references/page-mapping/page-mapping.md](../../../references/page-mapping/page-mapping.md)

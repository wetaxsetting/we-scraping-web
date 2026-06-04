# Expenses e-Invoices — API Consumption

Identical to Sales — see the canonical [Sales api-consumption.md](../sales-e-invoices/api-consumption.md) for wire types, mappers, state handling, and error handling. Only the deltas are below.

Backend contract: [../../../../../wecms-api/docs/features/addon-service/expenses-e-invoices/interface-specification.md](../../../../../wecms-api/docs/features/addon-service/expenses-e-invoices/interface-specification.md).

---

## Deltas vs Sales

| Concern | Expenses |
|---|---|
| List request | `fetchEInvoices({ type: "EXPENSE", ... })` → `GET /api/v1/addon/einvoices?type=EXPENSE` (resolves to `DOC_TYPE='B'`). |
| Excel — list | `useExcelExport` with `screenId: addon-expenses-einvoices`; `filters.type = "EXPENSE"`. **If `type` is omitted the export silently returns Sales data** — Phase-4 testing must verify it. |
| Excel — with details | `POST /einvoices/export-details` with `type=EXPENSE` in filters. |
| Wire row meaning | `trco_cmnm` / `trco_tax_id` carry the **supplier**; the field names are legacy holdovers (`TRCO_*` describe the counterparty regardless of direction). |
| Detail-history | not consumed (the backend endpoint is Sales-only; `type=EXPENSE` → `WBE2002`). |

The same `mapEInvoiceRow` / `mapEInvoiceTotal` mappers, wire types (`ApiEInvoiceRow` / `ApiEInvoiceListResponse`), and `ApiCallError` handling apply unchanged.

## Empty-data caveat

Until the DEV seed carries `DOC_TYPE='B'` rows (V52 `addon_expenses_einvoices_demo_seed`), the Expenses list can render empty even though the wire is correct. The static mock fallback was removed in Sprint 1 — empty wire = empty table (do not reintroduce a mock fallback).

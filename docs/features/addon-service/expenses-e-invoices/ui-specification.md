# Expenses e-Invoices — UI Specification

The layout, toolbar, filters, table, footer, status rules, and Update modal are **identical to Sales** — see the canonical [Sales ui-specification.md](../sales-e-invoices/ui-specification.md). Only the deltas are below.

---

## Deltas vs Sales

| Concern | Expenses delta |
|---|---|
| Page title | `t("expenses_einvoices.title")` → "Expenses e-Invoices" |
| Counterparty column (`BUYER` FIELD_ID) | header text = `t("expenses_einvoices.col.buyer")` → **"Supplier"** (en) / "공급자" (ko) / "Nhà cung cấp" (vi). Same `<BuyerCell>` composition (name + `MST : {code}` + status). |
| MST label key | `expenses_einvoices.mst_label` |
| Status filter / footer / column keys | all `expenses_einvoices.*` prefixed |
| Excel filename / in-sheet title | `expenses_einvoices.export_title` / `expenses_einvoices.title` |
| Compliance emphasis | the supplier MST status (`COMPANYSTATUS = 'NNT ngừng hoạt động …'`) is the strongest signal — input-VAT credit risk. Rendered as the verbatim Vietnamese text in the Supplier cell (not abbreviated/mapped). |

The 8-column set, width tokens (`--w-wb-si-*`), status badge tint logic (`matchInvoiceStatus`), multi-currency footer, and the no-View-Setting-popover rule (IR-9) are all shared.

## i18n keys (Expenses)

`expenses_einvoices.title`, `.empty`, `.export_title`, `.mst_label`, `.total_label`, `.transaction_count`, `.filter.invoice_status`, `.filter.status.{all,original,replacement,adjustment,cancelled}`, `.col.{date_time,invoice_no,buyer,currency,total,status,tax,pretax}` — `col.buyer` resolves to "Supplier". EN/KO/VI present; KM not yet.

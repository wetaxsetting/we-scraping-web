# Expenses e-Invoices — Component Index

The Expenses page contributes **one file**; everything else is the shared Sales-folder set — see the canonical [Sales component-index.md](../sales-e-invoices/component-index.md).

## Route
| File | Role |
|---|---|
| `app/(dashboard)/addon/expenses-einvoices/page.tsx` | Thin App Router page — sets `metadata`, renders `<ExpensesEInvoicesPage />`. |

## Expenses-owned component
| File | Role |
|---|---|
| [components/addon/expenses-einvoices/ExpensesEInvoicesPage.tsx](../../../../components/addon/expenses-einvoices/ExpensesEInvoicesPage.tsx) | **Two meaningful lines** — `<EInvoicesClient type="EXPENSE" translationPrefix="expenses_einvoices" />`. |

## Shared components (live in `components/addon/sales-einvoices/`)

`EInvoicesClient`, `EInvoicesPage`, `EInvoiceTable`, `EInvoiceTableColumns`, `EInvoiceTableFooter`, `EInvoiceStatusText`, `InvoiceStatusFilter`, `SalesEInvoiceActionBar` (name lies — used by both pages), `UpdateEInvoiceModal`, `exportConfig.ts`, `types.ts`. All documented in [../sales-e-invoices/component-index.md](../sales-e-invoices/component-index.md).

> Per the Common Reusability Rule, the `components/addon/expenses-einvoices/` folder must NOT gain anything beyond the entry wrapper — any shared logic copied there is a regression.

## Hooks & lib helpers

Identical to Sales — `useApiData`, `useTableSort`, `useStickyLoading`, `useExcelExport`, `useViewSetting`, `useDialog`; `fetchEInvoices`, `mapEInvoiceRow`/`mapEInvoiceTotal`, `matchInvoiceStatus`, `printReport`, `formatAmount`. The only Expenses-specific value is `SCREEN_IDS.ADDON_EXPENSES_EINVOICES` from [lib/viewSettingScreens.ts](../../../../lib/viewSettingScreens.ts).

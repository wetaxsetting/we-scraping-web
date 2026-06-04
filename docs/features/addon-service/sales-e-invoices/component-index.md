# Sales e-Invoices — Component Index

Paths relative to the `wecms-web/` repo root. **All components in `components/addon/sales-einvoices/` are shared with [Expenses](../expenses-e-invoices/README.md)** (which contributes only a thin entry wrapper).

## Route
| File | Role |
|---|---|
| `app/(dashboard)/addon/sales-einvoices/page.tsx` | Thin App Router page — sets `metadata`, renders `<SalesEInvoicesPage />`. |

## Feature components — `components/addon/sales-einvoices/`
| File | Role |
|---|---|
| [SalesEInvoicesPage.tsx](../../../../components/addon/sales-einvoices/SalesEInvoicesPage.tsx) | Sales entry — `<EInvoicesClient type="SALES" translationPrefix="sales_einvoices" />`. |
| [EInvoicesClient.tsx](../../../../components/addon/sales-einvoices/EInvoicesClient.tsx) | **Shared** client wrapper. Owns server-side state (keyword/debounce, status filter, date range, page/size, sort, refreshKey), `useApiData` fetch, latched `stableData`, sticky loading, status post-filter, and the Print/Excel/Update handlers. Maps rows via `mapEInvoiceRow` / `mapEInvoiceTotal`. |
| [EInvoicesPage.tsx](../../../../components/addon/sales-einvoices/EInvoicesPage.tsx) | **Shared** presentational shell — `PageLayout → PageHeader → FilterRow → DataTableShell`. |
| [EInvoiceTable.tsx](../../../../components/addon/sales-einvoices/EInvoiceTable.tsx) | **Shared** — `<thead>`+`<tbody>`, 8 columns, sort wiring, status cell. Reads `translationPrefix` to label the counterparty column ("Buyer"/"Supplier"). |
| [EInvoiceTableColumns.tsx](../../../../components/addon/sales-einvoices/EInvoiceTableColumns.tsx) | **Shared** `<colgroup>` keyed by `--w-wb-si-*` width tokens; reused by table + footer. |
| [EInvoiceTableFooter.tsx](../../../../components/addon/sales-einvoices/EInvoiceTableFooter.tsx) | **Shared** sibling footer `<table>` — one `<tr>` per currency. |
| [EInvoiceStatusText.tsx](../../../../components/addon/sales-einvoices/EInvoiceStatusText.tsx) | **Shared** coloured status text; tint via `matchInvoiceStatus`. |
| [InvoiceStatusFilter.tsx](../../../../components/addon/sales-einvoices/InvoiceStatusFilter.tsx) | **Shared** status dropdown popover (`translationPrefix`-keyed labels). |
| [SalesEInvoiceActionBar.tsx](../../../../components/addon/sales-einvoices/SalesEInvoiceActionBar.tsx) | **Shared** (name lies — used by both pages) page-specific toolbar: Print · Excel▾ (List/Details) · Update. |
| [UpdateEInvoiceModal.tsx](../../../../components/addon/sales-einvoices/UpdateEInvoiceModal.tsx) | **Shared** GDT re-pull modal (variant-driven copy). |
| [exportConfig.ts](../../../../components/addon/sales-einvoices/exportConfig.ts) | **Shared** `buildEInvoiceExportColumns(prefix)` + `EINVOICE_FALLBACK_COLUMNS` (8-column registry: FIELD_ID → format/width/align). |
| [types.ts](../../../../components/addon/sales-einvoices/types.ts) | **Shared** `EInvoiceRow`, `EInvoiceCurrencyTotal`, `InvoiceStatus`, `InvoiceStatusFilterKey`. |

## Expenses entry (sister)
| File | Role |
|---|---|
| [components/addon/expenses-einvoices/ExpensesEInvoicesPage.tsx](../../../../components/addon/expenses-einvoices/ExpensesEInvoicesPage.tsx) | Thin wrapper — `<EInvoicesClient type="EXPENSE" translationPrefix="expenses_einvoices" />`. |

## Shared components consumed (reused, not rebuilt)
| Component | Path |
|---|---|
| PageLayout / PageHeader / FilterRow | `components/shared/{PageLayout,PageHeader,FilterRow}.tsx` |
| SearchInput / DateRangeFilter | `components/shared/{SearchInput,DateRangeFilter}.tsx` |
| DataTableShell / Pagination / TableHeaderCell | `components/shared/{DataTableShell,Pagination,TableHeaderCell}.tsx` |
| View Setting hook + helpers | [components/shared/view-setting/](../../../../components/shared/view-setting/) (`useViewSetting`, `isSpecialViewSettingField`) |
| System dialog | [components/shared/dialog/](../../../../components/shared/dialog/) (`useDialog`) |

## Hooks
| Hook | Path | Use |
|---|---|---|
| `useApiData` | [lib/api/useApiData.ts](../../../../lib/api/useApiData.ts) | mount fetch + refetch on deps |
| `useTableSort` | [hooks/useTableSort.ts](../../../../hooks/useTableSort.ts) | sort cycle + `sortParams` |
| `useStickyLoading` | [hooks/useStickyLoading.ts](../../../../hooks/useStickyLoading.ts) | min-visibility loading gate |
| `useExcelExport` | [hooks/useExcelExport.ts](../../../../hooks/useExcelExport.ts) | XLSX export via shared pipeline |
| `useViewSetting` | [components/shared/view-setting/useViewSetting.ts](../../../../components/shared/view-setting/useViewSetting.ts) | column metadata for render + export (popover NOT rendered, IR-9) |
| `useDialog` | [components/shared/dialog/](../../../../components/shared/dialog/) | system success/error dialogs |

## lib helpers
| Helper | Path | Use |
|---|---|---|
| `fetchEInvoices` | [lib/api/addon.ts](../../../../lib/api/addon.ts) | list API client wrapper |
| `mapEInvoiceRow` / `mapEInvoiceTotal` / `coerceInvoiceCurrency` / `formatLegacyDate` / `formatLegacyTime` | [lib/api/mappers.ts](../../../../lib/api/mappers.ts) | wire → in-memory |
| `matchInvoiceStatus` | [lib/api/einvoiceStatus.ts](../../../../lib/api/einvoiceStatus.ts) | raw status string → logical key + tint |
| `ApiEInvoiceListResponse` / `ApiEInvoiceRow` / `ApiEInvoiceCurrencyTotal` | [lib/types/api.ts](../../../../lib/types/api.ts) | wire types |
| `printReport`, `PrintColumn` | [lib/print.ts](../../../../lib/print.ts) | print pipeline |
| `formatAmount` | [lib/currency.ts](../../../../lib/currency.ts) | amount display |
| `SCREEN_IDS`, `DEFAULT_AREA_ID` | [lib/viewSettingScreens.ts](../../../../lib/viewSettingScreens.ts) | `ADDON_SALES_EINVOICES` screen id |
| `ApiCallError` | [lib/api/banking.ts](../../../../lib/api/banking.ts) | typed error carrying WBE code |

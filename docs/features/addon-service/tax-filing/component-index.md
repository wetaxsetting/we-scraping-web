# Tax Filing — Component Index

Every file in the feature, with its role. Line counts as of 2026-08-17 (5,556 lines total).

## Route

| File | Role |
|---|---|
| [`app/(dashboard)/addon/tax-filing/page.tsx`](../../../../app/(dashboard)/addon/tax-filing/page.tsx) | Thin route page — sets `metadata.title`, renders `<TaxFilingPage />`. No route exists for the form (it is an overlay). |

## Feature components — `components/addon/tax-filing/`

| File | Lines | Role |
|---|---|---|
| [`DeclarationTab.tsx`](../../../../components/addon/tax-filing/DeclarationTab.tsx) | 952 | The 01/GTGT indicator grid. Merges `INDICATOR_SCHEMA` with live `indicators`, owns editable-cell state, client-side validation, and Save Draft. |
| [`TaxFilingPage.tsx`](../../../../components/addon/tax-filing/TaxFilingPage.tsx) | 607 | Dashboard list — filters, table, pagination, row kebab, and the create/form open state. Also holds the inline SVG icon constants. |
| [`VatDeclarationFormPage.tsx`](../../../../components/addon/tax-filing/VatDeclarationFormPage.tsx) | 532 | Full-screen form overlay — tab strip from annex flags, Save / Sync / Lock, and the Export ▾ menu. |
| [`PlReduce8Tab.tsx`](../../../../components/addon/tax-filing/PlReduce8Tab.tsx) | 475 | PL 43/2022 reduce-8% annex — two independently-fetched sections; reduced column = `(4) × 80%`. |
| [`mockData.ts`](../../../../components/addon/tax-filing/mockData.ts) | 348 | Static option lists — `YEAR_OPTIONS`, month/quarter options, activity codes. **Not row data**: the list and form both run on live API data. |
| [`BkmvTab.tsx`](../../../../components/addon/tax-filing/BkmvTab.tsx) | 339 | BKMV (purchase) invoice listing, grouped by VAT rate. |
| [`BkbrTab.tsx`](../../../../components/addon/tax-filing/BkbrTab.tsx) | 316 | BKBR (sales) invoice listing, same shape as BKMV. |
| [`declarationPdf.test.ts`](../../../../components/addon/tax-filing/declarationPdf.test.ts) | 284 | Vitest suite for the PDF renderer — the module's only automated coverage. See [test-scenarios.md](test-scenarios.md). |
| [`NewVatDeclarationDialog.tsx`](../../../../components/addon/tax-filing/NewVatDeclarationDialog.tsx) | 257 | Create dialog — period mode, year/period, industry, annex checkboxes → `createVatDeclaration()`. |
| [`invoiceListingExcel.ts`](../../../../components/addon/tax-filing/invoiceListingExcel.ts) | 253 | Browser XLSX for BKBR / BKMV (form 01-1/GTGT). Exports `InvoiceListingKind`, `invoiceListingFileName()`, `exportInvoiceListingExcel()`. |
| [`indicatorSchema.ts`](../../../../components/addon/tax-filing/indicatorSchema.ts) | 240 | `INDICATOR_SCHEMA` — structure + i18n keys for every form row. **Holds no values.** |
| [`types.ts`](../../../../components/addon/tax-filing/types.ts) | 176 | All feature types — `TaxFilingRow`, `TaxIndicatorRow`, `AnnexLine` / `AnnexGroup`, `AnnexInvoiceRow` / `AnnexTaxGroup` / `AnnexInvoicePage`, `BkbrRow`, `BkmvRow`, `PlCssx*Row`. |
| [`plReduce8Excel.ts`](../../../../components/addon/tax-filing/plReduce8Excel.ts) | 160 | Browser XLSX for the reduce-8% annex. |
| [`declarationExcel.ts`](../../../../components/addon/tax-filing/declarationExcel.ts) | 139 | Browser XLSX for 01/GTGT — owns `DECLARATION_TEMPLATE_URL`, `buildDeclarationPatches()`, `exportFileName()`. **The patch map the PDF also consumes.** |
| [`declarationPdf.ts`](../../../../components/addon/tax-filing/declarationPdf.ts) | 137 | Browser PDF — patches the same sheet, converts it to HTML, prints it. |
| [`useTaxFilingActions.ts`](../../../../components/addon/tax-filing/useTaxFilingActions.ts) | 118 | `unlock` / `remove` — one confirm→call→refresh→report shape so the two cannot drift. |
| [`TaxFilingDropdown.tsx`](../../../../components/addon/tax-filing/TaxFilingDropdown.tsx) | 78 | Per-row kebab menu. |
| [`annexGrouping.ts`](../../../../components/addon/tax-filing/annexGrouping.ts) | 53 | Shared BKBR/BKMV page-grouping — `AnnexDisplayGroup`, page-scoped groups with whole-set subtotals. |
| [`vatDeclErrors.ts`](../../../../components/addon/tax-filing/vatDeclErrors.ts) | 39 | `VAT_DECL_ERROR_KEYS` code→i18n map + `vatDeclErrorMessage()`. Codes were **observed from the live backend**, not inferred. |
| [`TaxFilingStatusBadge.tsx`](../../../../components/addon/tax-filing/TaxFilingStatusBadge.tsx) | 39 | Status pill. |
| [`agentTaxCode.ts`](../../../../components/addon/tax-filing/agentTaxCode.ts) | 14 | `isValidAgentTaxCode()` — blank, or exactly 10 / 13 digits. |

## Shared and lib modules consumed

| Module | Used for |
|---|---|
| [`lib/api/addon.ts`](../../../../lib/api/addon.ts) | All 11 VAT endpoints + `ANNEX_EXPORT_SCREEN_ID` |
| [`lib/api/mappers.ts`](../../../../lib/api/mappers.ts) | `toTaxFilingRow()` (wire → `TaxFilingRow`), `toTaxFilingStatus()` |
| [`lib/api/useApiData.ts`](../../../../lib/api/useApiData.ts) | List fetch, detail fetch, per-annex fetches |
| [`lib/types/api.ts`](../../../../lib/types/api.ts) | `ApiVatDeclarationRow` / `…ListResponse` / `…Detail` / `…Indicators` |
| [`lib/vat/vatFormula.ts`](../../../../lib/vat/vatFormula.ts) | `computeVatIndicators()`, `propagateVatInput()` — the single write path for derived cells |
| [`lib/vat/periodLabel.ts`](../../../../lib/vat/periodLabel.ts) | `formatVatPeriod()` — month vs. quarter label |
| [`lib/xlsxTemplate.ts`](../../../../lib/xlsxTemplate.ts) | `loadXlsxParts()`, `patchSheetXml()` — template patching |
| [`lib/xlsxToHtml.ts`](../../../../lib/xlsxToHtml.ts) | `xlsxSheetToHtml()`, `XLSX_HTML_BASE_CSS` — sheet → printable HTML |
| [`lib/print.ts`](../../../../lib/print.ts) | `printHtmlDocument()` per CLAUDE.md §6d |
| [`lib/file.ts`](../../../../lib/file.ts) | `downloadFile()` for the binary XML endpoint |
| [`lib/excel.ts`](../../../../lib/excel.ts) | `exportExcel()` for the server-side annex XLSX |
| [`hooks/useServerPagination.ts`](../../../../hooks/useServerPagination.ts) | List paging + `clampToTotal()` |
| [`components/shared/*`](../../../../components/shared/) | `PageLayout`, `PageActionButtons`, `DataTableShell`, `Pagination`, `SearchInput`, `TableHeaderCell`, `useDialog` |
| [`components/ui/table`](../../../../components/ui/table.tsx) | shadcn table primitives |
| [`lib/i18n`](../../../../lib/i18n/) | `useTranslation()` |

## Static assets

| Path | Used by |
|---|---|
| `public/templates/vat-declaration-01-gtgt.xlsx` | `declarationExcel.ts` **and** `declarationPdf.ts` |
| `public/templates/vat-invoice-listing-01-1-gtgt.xlsx` | `invoiceListingExcel.ts` |
| `public/templates/vat-declaration-tt80-workbook.xlsx` | `plReduce8Excel.ts` |

## Integration points outside the feature folder

| File | Entry |
|---|---|
| [`components/layout/sidebarNav.ts`](../../../../components/layout/sidebarNav.ts) | group `addon-vat-declaration` → item `addon-tax-filing` |
| [`lib/menuAuth.ts`](../../../../lib/menuAuth.ts) | `{ prefix: "/addon/tax-filing", cd: "addon-vat-declaration" }` |
| `locales/{en,ko,vi}.json` | the `tax_filing.*` namespace |

## Notable structural properties

- **The XLSX and the PDF cannot diverge.** `declarationPdf.ts` imports `buildDeclarationPatches` from
  `declarationExcel.ts`; both render the same patched sheet, so a template change moves both at once.
  A test asserts this explicitly.
- **The form and the export cannot diverge.** Both read derived figures from `lib/vat/vatFormula.ts`.
- **`mockData.ts` is option data, not fixture rows** — unlike most `mockData.ts` files in the repo.

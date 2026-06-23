# Excel Import — Component Index (Frontend)

**Part of:** Common → excel-import
**Last verified:** 2026-06-23

All paths under `c:\WECMS PROJECT\wecms-web\`. Verified at indexing time.

## Shared shell (the reusable half)

| Component | Path | Role |
|---|---|---|
| `<ExcelUploadDialog>` (default export) | `components/shared/excel-upload/ExcelUploadDialog.tsx` | The modal shell: header, two-pane body (step panel + preview), footer, three-table preview region sharing one `<colgroup>`. Exports types `ExcelUploadColumn`, `ExcelUploadRow`, `ExcelUploadCell`, `ExcelUploadSelectStep`, `ExcelUploadOptionsStep`, `ExcelUploadExtraStep`, `ExcelUploadDialogProps`. |
| `templateValidator` | `components/shared/excel-upload/templateValidator.ts` | `validateExcelTemplate(file, spec)` → typed result (`parse_error` / `no_sheet` / `no_headers` / `wrong_template`). Case-insensitive, whitespace-tolerant header matching. |
| `<ExcelUploadButton>` (default export) | `components/shared/ExcelUploadButton.tsx` | Brand-green trigger chip with Excel glyph; chrome only. |
| `readXlsxQuiet` | `lib/xlsxReader.ts` | Thin `XLSX.read` wrapper that mutes benign SheetJS "Bad uncompressed size" console noise; real parse failures still throw. |

### Predefined `TemplateSpec`s (in `templateValidator.ts`) — confirmed set

| Constant | `templateName` | Required columns (logical) |
|---|---|---|
| `PURPOSE_TEMPLATE_SPEC` | Purpose | Purpose Code, Purpose Name, Parent Purpose |
| `CHART_OF_ACCOUNTS_TEMPLATE_SPEC` | Chart of Accounts | Account Code, Account Name (English), Parent Account |
| `CONTACTS_LOCAL_TEMPLATE_SPEC` | Local Contacts | Contact Code, Deposit Bank, Deposit Account No. |
| `CONTACTS_OVERSEAS_TEMPLATE_SPEC` | Overseas Contacts | Contact Code, Beneficiary Name, Bank Identifier Code (BIC) |
| `VAS_ACCOUNT_TEMPLATE_SPEC` | VAS Account | Account Type, Status |

Each spec also carries `forbiddenHeaders` (tell-tale columns from the other templates) so the wrong template is rejected even when required columns happen to match. Anchors include EN/KO/VI label variants.

## Per-feature wrappers (the not-shared half)

Each wraps `SharedExcelUploadDialog`, supplies its own `columns` / `rows` / chrome / handlers, and (for the canonical features) calls `validateExcelTemplate` with its spec.

| Feature | Wrapper path |
|---|---|
| Chart of Accounts | `components/settings/chart-of-accounts/ExcelUploadDialog.tsx` (calls `validateExcelTemplate(file, CHART_OF_ACCOUNTS_TEMPLATE_SPEC)` — `:88-90`) |
| Purpose | `components/settings/purpose/ExcelUploadDialog.tsx` |
| VAS Account | `components/settings/vas-account/ExcelUploadDialog.tsx` |
| Contacts | `components/settings/contacts/ExcelUploadDialog.tsx` |
| Payment — Vendor | `components/payment/vendor-payment/VendorPaymentUploadDialog.tsx` |
| Payment — Expense | `components/payment/expense-payment/ExpensePaymentUploadDialog.tsx` |
| Payment — Payroll | `components/payment/payroll/PayrollPaymentUploadDialog.tsx` |
| Payment — Internal Transfer | `components/payment/internal-transfer/InternalTransferUploadDialog.tsx` |
| Payment — Overseas | `components/payment/overseas-payment/OverseasExcelUploadModal.tsx` |
| Payment — shared | `components/payment/shared/PaymentExcelUploadDialog.tsx`, `PaymentScheduledBatchListPage.tsx` |

> Each Settings panel also imports `<ExcelUploadButton>` to render the trigger (`VasAccountPanel.tsx`, `PurposePanel.tsx`, `ChartOfAccountsPanel.tsx`).

## Naming note

There is no single class named `ChartOfAccountsExcelUploadDialog` — each wrapper is `export default function ExcelUploadDialog` in a feature-namespaced folder, imported with an alias (e.g. `import SharedExcelUploadDialog from "@/components/shared/excel-upload/ExcelUploadDialog"`). Refer to wrappers by their path, not a global class name.

## Related

- [ui-specification.md](ui-specification.md) · [api-consumption.md](api-consumption.md) · [README.md](README.md)
- Backend source index: [`../../../../../wecms-api/docs/features/common/excel-import/source-code-index.md`](../../../../../wecms-api/docs/features/common/excel-import/source-code-index.md)

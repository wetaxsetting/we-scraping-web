# Daily Financial (HS) — Component Index

> Every file the feature owns or depends on, with responsibilities. Line counts as of
> 2026-07-02.

## 1. Feature-owned files

| File | Lines | Responsibility |
|---|---|---|
| [app/(dashboard)/banking/reports/daily-financial-hs/page.tsx](../../../../../app/(dashboard)/banking/reports/daily-financial-hs/page.tsx) | 10 | Server component; `metadata.title = "Daily Financial (HS) Report — WeCMS"`; composes `<DailyFinancialHsClient/>`. |
| [components/banking/reports/daily-financial-hs/DailyFinancialHsClient.tsx](../../../../../components/banking/reports/daily-financial-hs/DailyFinancialHsClient.tsx) | 158 | Client orchestration: `asOf` / `bankFilters` / `searchKey` / `bankOptions` state; `useApiData` loader (Search-keyed); mount-only `ALL` fetch → `deriveBankOptions`; `handleSaveEntry` (FIELD_ID→wire key, PATCH, error dialog); `handleDownloadExcel`; `toPeriodDate` / `toAccountFilter` helpers. |
| [components/banking/reports/daily-financial-hs/DailyFinancialHsPage.tsx](../../../../../components/banking/reports/daily-financial-hs/DailyFinancialHsPage.tsx) | 611 | Presentational page: PageHeader + toolbar, filter row, `<ReportLayout>` + internal `LedgerTable` / `BankGroupRows` / `SummaryCells` / `EntryCell` / `InputCell` / `BankCell`; View Setting popover wiring (`vsDraft` local draft, save/reset/close); `visibleColumns` memo; `FIELD_WIRE_KEY` + `FIELD_LABEL_KEY` registries. |
| [components/banking/reports/daily-financial-hs/columns.ts](../../../../../components/banking/reports/daily-financial-hs/columns.ts) | 208 | `ColumnDescriptor` type; 12-column `COLUMN_REGISTRY` (fieldId, koKey/enKey, align, kind, widthClass/widthPx, entry/subtotal/total accessors); `DEFAULT_VIEW_SETTING_ITEMS` fallback (all visible, `sort_yn:'N'`); `NUMERIC_FIELD_IDS`. |
| [components/banking/reports/daily-financial-hs/projectRows.ts](../../../../../components/banking/reports/daily-financial-hs/projectRows.ts) | 226 | `projectHsRows` (wire row stream → `BankGroup[]`; row_type discriminator; per-currency TOTAL anchoring; `formatAmount` at projection; blank-not-zero rule); `parseBankHeader` (bank name / type / BRANCH accent / due date); `deriveBankOptions`. |
| [components/banking/reports/daily-financial-hs/types.ts](../../../../../components/banking/reports/daily-financial-hs/types.ts) | 80 | In-memory camelCase types: `LedgerEntry` (incl. `acctSeqNo`, `editable`), `LedgerTotals`, `BankGroup` (incl. `closesTotal`, `total.memo`), `HsEntryPatch` (wire-key patch shape). |

Deleted 2026-07-01 (live wiring): `mockData.ts`, `bankOptions.ts`.

Tests: **ABSENT** — no `__tests__/` or `*.test.*` files in the feature folder.

## 2. API layer

| File | Items |
|---|---|
| [lib/api/banking.ts](../../../../../lib/api/banking.ts) | `fetchDailyFinancialHs` (~L1004) · `updateDailyFinancialHsEntry` (~L1022, void-tolerant unwrap) · `downloadDailyFinancialHsReport` (~L1062, blob via `downloadFile`) |
| [lib/types/api.ts](../../../../../lib/types/api.ts) | `ApiHsLedgerRow` (~L945) · `ApiDailyFinancialHsReport` (~L970) — lowercase snake_case wire types |
| [lib/api/useApiData.ts](../../../../../lib/api/useApiData.ts) | shared fetch-on-deps hook (loader keyed on `searchKey`) |
| [lib/file.ts](../../../../../lib/file.ts) | shared blob download (`Content-Disposition` filename) |

## 3. Shared components & hooks consumed

| Shared item | Use here |
|---|---|
| [components/shared/PageHeader.tsx](../../../../../components/shared/PageHeader.tsx) | title row + right action slot |
| [components/shared/ReportLayout.tsx](../../../../../components/shared/ReportLayout.tsx) | §7b report scroll viewport (single-table, non-`sectioned`) |
| [components/shared/DateField.tsx](../../../../../components/shared/DateField.tsx) | As-of date chip + calendar popup (custom `formatValue` → `DD-MM-YYYY`) |
| Bank filter popover (shared banking filter component) | bank/account multi-select — options supplied by `deriveBankOptions` |
| [components/shared/view-setting/ViewSettingPopover.tsx](../../../../../components/shared/view-setting/ViewSettingPopover.tsx) + [useViewSetting.ts](../../../../../components/shared/view-setting/useViewSetting.ts) | 12-column visibility/order, DB-persisted |
| [lib/viewSettingScreens.ts](../../../../../lib/viewSettingScreens.ts) | `SCREEN_IDS.BANKING_REPORTS_DAILY_FINANCIAL_HS` (~L265) + route map entry |
| [components/shared/dialog](../../../../../components/shared/dialog/) (`useDialog`) | save/download error dialogs |
| [lib/currency.ts](../../../../../lib/currency.ts) (`formatAmount`) | projection-time amount formatting (id-ID, symbol-less) |
| [lib/i18n/LocaleProvider.tsx](../../../../../lib/i18n/LocaleProvider.tsx) (`useTranslation`) | all visible strings |
| [components/layout/sidebarNav.ts](../../../../../components/layout/sidebarNav.ts) | presentation entry `banking-report-daily-financial-haengsung` (~L108: label key `sidebar.banking.dailyFinancialHs`, chart icon) — actual visibility comes from `GET /api/v1/navigation` |

## 4. i18n keys (all present in `locales/en.json` / `ko.json` / `vi.json`)

- `report.daily_financial_hs.title` · `.sub_total` · `.total`
- `report.daily_financial_hs.col.{bank,currency,receipt_code,payment_code,description_en,description_ko,counterparty,before_balance,receipt,payment,balance,memo}` (EN header line + input placeholders)
- `report.daily_financial_hs.col_ko.{…same 12…}` (KO header line)
- Shared: `report.as_of` · `report.download_excel` · `common.search` · `view_setting.aria.list_button` · `dialog.*`

## 5. Related docs

- Backend counterpart: [wecms-api/docs/features/banking/reports/daily-financial-hs/source-code-index.md](../../../../../../wecms-api/docs/features/banking/reports/daily-financial-hs/source-code-index.md)
- View Setting architecture: [docs/architecture/view-setting/](../../../../architecture/view-setting/) + `wecms-web/CLAUDE.md` §13

# Excel Export — Component Index

**Part of:** Common → excel-export
**Last verified:** 2026-06-23

All paths relative to `wecms-web/`.

## Shared modules

| File | Export | Role |
|---|---|---|
| `lib/excel.ts` | `exportExcel(opts)` | POSTs JSON to the per-resource endpoint, parses XLSX blob OR JSON error envelope, saves the blob. Helpers: `buildRequestBody`, `maybeDecodeJsonError`, `parseContentDispositionFilename`, `todayDmy`, `triggerDownload`. Types: `ExcelColumnFormat`, `ExcelAlignment`, `ExcelExportColumn`, `ExcelExportSort`, `ExcelExportOptions`. |
| `hooks/useExcelExport.ts` | `useExcelExport()` | Returns a stable async fn. Walks `vs.items`, applies the visibility/special/registry filters, sorts by `disp_ord`, resolves headers via `t(...)`, calls `exportExcel`. Type: `ExcelExportColumnConfig`, `UseExcelExportInput`. |
| `components/shared/PageActionButtons.tsx` | `<PageActionButtons>` | Toolbar; `showExcel` + `onExport` + `exporting` drive the Excel icon. |

## Per-page contribution — `columnConfig` registry

Each adopting page declares one registry next to its `COLUMN_REGISTRY`:

```ts
// Record<FIELD_ID, ExcelExportColumnConfig>
{
  headerKey: string;          // i18n key — hook resolves via t(headerKey)
  format?:   ExcelColumnFormat;  // "text" | "amount" | "number" | "date" | "datetime"
  ccyCd?:    string;          // currency code for AMOUNT headers
  align?:    ExcelAlignment;  // "left" | "right" | "center"
  widthChars?: number;        // explicit POI column width
}
```

Type defined in `hooks/useExcelExport.ts:28-52`. Only FIELD_IDs present in this
object can appear in the export — unknown `vs.items` FIELD_IDs are dropped
(`useExcelExport.ts:108`). Pages must NOT register `CHECKBOX` / `ETC` — the hook
drops them via `isSpecialViewSettingField` anyway (`useExcelExport.ts:102`).

## Wire-shape parity with backend

| Frontend type | Backend record | Notes |
|---|---|---|
| `ExcelExportColumn` | `ExcelColumnSpec` | `fieldId`/`header`/`format`/`ccyCd`/`align`/`widthChars` |
| `ExcelExportSort` | `ExcelSortSpec` | `field`/`direction` |
| `ExcelColumnFormat` (`text\|amount\|…`) | `ExcelColumnFormat` enum | lowercase wire, parsed case-insensitively backend-side |
| `ExcelAlignment` (`left\|right\|center`) | `ExcelAlignment` enum | same |
| request body (`buildRequestBody`) | `ExcelExportRequest` | `screenId`,`dymAreaId`,`fileName`,`title`,`filters`,`sort`,`columns`,`subHeader` |

`buildRequestBody` (`lib/excel.ts:161-182`) sends `title: opts.title ?? null`,
`sort` only when both `field` + `direction` present, each column with
`format ?? "text"` / `ccyCd ?? null` / `align ?? null` / `widthChars ?? null`.

## Reference implementation

- Page registry: `ACCOUNT_INQUIRY_EXPORT_COLUMNS` in
  `components/shared/AccountInquiryPage.tsx` (BANK · ACCOUNT_NICKNAME · BALANCE ·
  AVAILABLE_BALANCE · VAS_ACCOUNT · LAST_UPDATE).
- Page wiring: `AccountInquiryPage#handleExportExcel` — pulls live `vs.items`,
  derives `sort`, hands `currency`/`bankName`/`keyword` to `filters`.
- Endpoint: `POST /api/v1/banking/accounts/export`.

## Screen ID source

`screenId` comes from `SCREEN_IDS` in `lib/viewSettingScreens.ts` (e.g.
`SCREEN_IDS.ACCOUNT_INQUIRY_VND = "banking-account-inquiry-vnd"`) — never an
inline string literal, never a raw route path, never a legacy JEX id
(CLAUDE.md §13 / §13b).

# Operation Status Inquiry — Component Index

Paths relative to the `wecms-web/` repo root.

## Route
| File | Role |
|---|---|
| [app/(dashboard)/addon/operation-status/page.tsx](../../../../app/%28dashboard%29/addon/operation-status/page.tsx) | Thin App Router page — sets `metadata` (title "Operation Status Inquiry — WeCMS"), renders `<OperationStatusClient />`. |

## Feature components — `components/addon/operation-status/`
| File | Role |
|---|---|
| [OperationStatusClient.tsx](../../../../components/addon/operation-status/OperationStatusClient.tsx) | Client wrapper. Owns server-side state (q/companyStatus/page/pageSize/sort/selectedIds/refreshKey), `useApiData` fetch, latched `stableData`, sticky loading, and the Update/Inquire handlers. Maps rows via `mapOperationCompanyRow`. |
| [OperationStatusPage.tsx](../../../../components/addon/operation-status/OperationStatusPage.tsx) | Presentational page shell. `COLUMN_REGISTRY`, `FALLBACK_COLUMNS`, `OPERATION_STATUS_EXPORT_COLUMNS`, `STATUS_FILTER_OPTIONS`; renders header/filter/table/pagination; owns export + print handlers, `OperationStatusCell`, `StatusFilterPopover`, print-cell builders. |
| [OperationStatusActionBar.tsx](../../../../components/addon/operation-status/OperationStatusActionBar.tsx) | Page-specific toolbar — Print · Excel icons + Update + Inquire CTA. |
| [InquireOperationStatusDialog.tsx](../../../../components/addon/operation-status/InquireOperationStatusDialog.tsx) | Inquire popup — masked Tax ID input, Get Business Info, status banner, read-only name/address, Save/Close. |
| [types.ts](../../../../components/addon/operation-status/types.ts) | `OperationStatusCode` union + `OperationCompanyRow` in-memory type. |

## Shared components consumed (reused, not rebuilt)
| Component | Path |
|---|---|
| PageLayout | [components/shared/PageLayout.tsx](../../../../components/shared/PageLayout.tsx) |
| PageHeader | [components/shared/PageHeader.tsx](../../../../components/shared/PageHeader.tsx) |
| FilterRow | [components/shared/FilterRow.tsx](../../../../components/shared/FilterRow.tsx) |
| FilterDropdown | [components/shared/FilterDropdown.tsx](../../../../components/shared/FilterDropdown.tsx) |
| SearchInput | [components/shared/SearchInput.tsx](../../../../components/shared/SearchInput.tsx) |
| DataTableShell | [components/shared/DataTableShell.tsx](../../../../components/shared/DataTableShell.tsx) |
| Pagination | [components/shared/Pagination.tsx](../../../../components/shared/Pagination.tsx) |
| TableHeaderCell | [components/shared/TableHeaderCell.tsx](../../../../components/shared/TableHeaderCell.tsx) |
| View Setting hook + helpers | [components/shared/view-setting/](../../../../components/shared/view-setting/) (`useViewSetting`, `isSpecialViewSettingField`, `ViewSettingItem`) |
| System dialog | [components/shared/dialog/](../../../../components/shared/dialog/) (`useDialog`) |
| shadcn primitives | `components/ui/` — `Dialog*`, `Checkbox`, `Table*` |

## Hooks
| Hook | Path | Use |
|---|---|---|
| `useApiData` | [lib/api/useApiData.ts](../../../../lib/api/useApiData.ts) | mount fetch + refetch on deps |
| `useTableSort` | [hooks/useTableSort.ts](../../../../hooks/useTableSort.ts) | sort cycle state + `sortParams` |
| `useStickyLoading` | [hooks/useStickyLoading.ts](../../../../hooks/useStickyLoading.ts) | min-visibility loading gate |
| `useExcelExport` | [hooks/useExcelExport.ts](../../../../hooks/useExcelExport.ts) | XLSX export via shared pipeline |
| `useViewSetting` | [components/shared/view-setting/useViewSetting.ts](../../../../components/shared/view-setting/useViewSetting.ts) | column metadata for render + export |
| `useDialog` | [components/shared/dialog/](../../../../components/shared/dialog/) | system success/error dialogs |

## lib helpers
| Helper | Path | Use |
|---|---|---|
| `fetchOperationStatus` / `inquireOperationStatus` / `createOperationStatus` / `updateOperationStatus` | [lib/api/addon.ts](../../../../lib/api/addon.ts) | API client wrappers |
| `mapOperationCompanyRow` | [lib/api/mappers.ts](../../../../lib/api/mappers.ts) | wire row → `OperationCompanyRow` |
| `ApiOperationStatusRow` / `ApiOperationStatusListResponse` | [lib/types/api.ts](../../../../lib/types/api.ts) | wire types |
| `printReport`, `PrintColumn` | [lib/print.ts](../../../../lib/print.ts) | print pipeline |
| `todayDmy` | [lib/excel.ts](../../../../lib/excel.ts) | export filename suffix |
| `formatDateLang` | [lib/datetime.ts](../../../../lib/datetime.ts) | locale-aware last-update display |
| `SCREEN_IDS`, `DEFAULT_AREA_ID` | [lib/viewSettingScreens.ts](../../../../lib/viewSettingScreens.ts) | `ADDON_OPERATION_STATUS` screen id |
| `ApiCallError` | [lib/api/banking.ts](../../../../lib/api/banking.ts) | typed error carrying WBE code |

# Firm Banking History — Component Index (Frontend)

Parent: [README.md](README.md). Backend source index: [wecms-api .../source-code-index.md](../../../../../wecms-api/docs/features/settings/firm-banking-history/source-code-index.md).

---

## Feature components — `components/settings/firm-banking-history/`

| File | Role |
|---|---|
| [`FirmBankingHistoryPanel.tsx`](../../../../components/settings/firm-banking-history/FirmBankingHistoryPanel.tsx) | Panel shell + state owner: date range / service type / keyword (300 ms debounce) / page / pageSize / sort / detail anchor; `useApiData` fetch; latched stable data; error dialog |
| [`FirmBankingHistoryFilters.tsx`](../../../../components/settings/firm-banking-history/FirmBankingHistoryFilters.tsx) | Filter row — `<InteractiveDateRangePicker>` + service-type dropdown (G/B hidden for product `H`) + `<SearchInput>` |
| [`FirmBankingHistoryTable.tsx`](../../../../components/settings/firm-banking-history/FirmBankingHistoryTable.tsx) | Grid — 6 data columns + View Details; sortable headers via `<TableHeaderCell>`; `ResultText` status pill; `<EllipsisTooltip>` cells |
| [`FirmBankingHistoryDetailPopover.tsx`](../../../../components/settings/firm-banking-history/FirmBankingHistoryDetailPopover.tsx) | Row-driven detail popover; per-leg fields (F/S/G/B); VAN + scraping result-message resolution; copy-to-clipboard |
| [`types.ts`](../../../../components/settings/firm-banking-history/types.ts) | `FirmBankingHistoryRow` (camelCase), `FirmBankingServiceType`, `FirmBankingResult` |

## Shared components reused

| Component | Source |
|---|---|
| `<InteractiveDateRangePicker>` | `components/shared/InteractiveDateRangePicker.tsx` |
| `<SearchInput>` | `components/shared/SearchInput.tsx` |
| `<Pagination>` + `usePagination` / `PAGE_SIZE_OPTIONS` | `components/shared/Pagination.tsx` |
| `<TableHeaderCell>` | `components/shared/TableHeaderCell.tsx` |
| `<EllipsisTooltip>` | `components/shared/EllipsisTooltip.tsx` |
| `useDialog()` system dialog | `components/shared/dialog/` |
| Settings shell + nav | `components/settings/SettingsModal.tsx` · `components/settings/SettingsNav.tsx` |

## Hooks

| Hook | Source | Use |
|---|---|---|
| `useApiData` | `lib/api/useApiData.ts` | fetch on mount + refetch on dep change |
| `useTableSort` | `hooks/useTableSort.ts` | default → ASC → DESC → default cycle |
| `useStickyLoading` | `hooks/useStickyLoading.ts` | smooths the empty/loading toggle (the panel actually imports this) |

> **Note:** the panel does **not** import `useExcelExport` — the Excel export is unwired on the
> frontend (backend endpoint exists; no toolbar trigger). See [api-consumption.md § 5](api-consumption.md#5-export-api).

## API client / mappers / types

| File | Role |
|---|---|
| [`lib/api/firmBankingHistory.ts`](../../../../lib/api/firmBankingHistory.ts) | `fetchFirmBankingHistory(params)` + `FetchFirmBankingHistoryParams`; camelCase → snake_case wire translation; `ApiCallError` |
| [`lib/api/mappers.ts`](../../../../lib/api/mappers.ts) | `mapFirmBankingHistoryRow` (wire → camelCase); `extractFirmBankingServiceType`; `rslt_cd` → 3-state result; `tarn_dtm` → date + time split |
| [`lib/types/api.ts`](../../../../lib/types/api.ts) | `ApiFirmBankingHistoryRow`, `ApiFirmBankingHistoryListResponse` (snake_case wire) |

## i18n bundles

| File | Role |
|---|---|
| [`lib/i18n/dictionaryVan.ts`](../../../../lib/i18n/dictionaryVan.ts) + `dictionaryVan.data.ts` | F-leg VAN result-message dictionary (69 entries) — `lookupVanMessage` / `resolveVanMessage` |
| [`lib/i18n/scrapingResultCodes.ts`](../../../../lib/i18n/scrapingResultCodes.ts) + `scrapingResultCodes.data.ts` | S/G/B-leg result-code registry (18 codes) — `lookupScrapingResultMessage` / `resolveScrapingResultMessage` |
| `locales/{en,ko,vi}.json` | `settings.firm_banking_history.*`, `fb_history.service.*`, `fb_history.result.*` |

## Mount points

| File | What |
|---|---|
| [`components/settings/SettingsModal.tsx`](../../../../components/settings/SettingsModal.tsx) | renders `<FirmBankingHistoryPanel>` when `panel === "firm_banking_history"` |
| [`components/settings/SettingsNav.tsx`](../../../../components/settings/SettingsNav.tsx) | nav item in the "Firm Banking" group; permission `settings-firm-banking-history` |

## Reuse contract

Any future banking / payment / VAN-gateway feature that surfaces an `RS_CD` from a VAN-fronted table
**must** consume `resolveVanMessage` (F-leg / 4-char) or `resolveScrapingResultMessage` (8-char) —
never inline a per-page result-code map. Service-type / service-name labels always come from the
server `svc_type_key` / `svc_name_key` via `t(...)`.

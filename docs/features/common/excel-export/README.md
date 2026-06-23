# Excel Export — Frontend (Common)

**Part of:** Common → excel-export
**Last verified:** 2026-06-23

Shared frontend path for the toolbar **Excel** action on every list page. The
page declares a per-FIELD_ID `columnConfig` registry, hands the
[`useExcelExport()`](../../../../hooks/useExcelExport.ts) hook its current View
Setting items + filter + sort state, and the hook POSTs JSON to the
per-resource backend endpoint and saves the returned XLSX blob. **The frontend
never generates a workbook** — backend Apache POI is the single producer; the
client ships JSON and saves bytes. **CSV is not a sanctioned format.**

> Source of truth = `wecms-web/lib/excel.ts`, `wecms-web/hooks/useExcelExport.ts`,
> `wecms-web/components/shared/PageActionButtons.tsx`. Authoritative rules:
> `wecms-web/CLAUDE.md` §13b "Excel export".

## At a glance

| Fact | Value | Source |
|---|---|---|
| Entry point | `useExcelExport()` hook (pages never call `exportExcel` directly) | `hooks/useExcelExport.ts:98` |
| Transport | `api.post<Blob>(endpoint, body, { responseType: "blob" })` | `lib/excel.ts:129-131` |
| Endpoint | per-resource `POST /api/v1/{module}/{resource}/export` (passed via `endpoint`) | `lib/excel.ts:74-78` |
| Save | `<a download>` from object URL, server-supplied filename | `lib/excel.ts:238-250` |
| Error on 200 | sniffs `Content-Type: application/json` → throws `ApiCallError` | `lib/excel.ts:147-152` |
| Toolbar | `<PageActionButtons showExcel onExport exporting>` | `components/shared/PageActionButtons.tsx:112-129` |
| Excel icon | `/assets/common/ico-excel.svg`, `size-5` | `components/shared/PageActionButtons.tsx:123-127` |

## Documents

| Doc | Purpose |
|---|---|
| [screen-flow.md](screen-flow.md) | Toolbar Excel icon → POST → blob download; exporting state disables buttons |
| [ui-specification.md](ui-specification.md) | `PageActionButtons` Excel icon asset, size, cursor-wait state |
| [component-index.md](component-index.md) | `lib/excel.ts`, `hooks/useExcelExport.ts`, `<PageActionButtons>`, columnConfig registry |
| [api-consumption.md](api-consumption.md) | columnConfig FIELD_ID→{headerKey,format,ccyCd,align}; ships `vs.items ∩ config`; filters+sort travel; blob save; JSON-error-on-200 sniff |
| [test-scenarios.md](test-scenarios.md) | Visible-column ship, special-field drop, JSON-error-on-200, blob save, exporting-disable |

## Related

- Common frontend hub: [`../README.md`](../README.md)
- Backend twin: [`../../../../../wecms-api/docs/features/common/excel-export/README.md`](../../../../../wecms-api/docs/features/common/excel-export/README.md)
- View Setting (column source): [`../view-setting/README.md`](../view-setting/README.md)

# Excel Export — Test Scenarios (Frontend)

**Part of:** Common → excel-export
**Last verified:** 2026-06-23

Behaviour-level scenarios for the shared frontend export path. Citations to
`wecms-web/`.

## `useExcelExport()` hook

| # | Scenario | Expected | Source |
|---|---|---|---|
| F1 | `vs.items` has a `use_yn='N'` column | dropped — not shipped | `hooks/useExcelExport.ts:101` |
| F2 | `vs.items` contains `CHECKBOX` / `ETC` | dropped via `isSpecialViewSettingField` | `:102` |
| F3 | `vs.items` has a `disp_yn='N'` column | dropped (admin-hidden) | `:107` |
| F4 | `vs.items` FIELD_ID not in `columnConfig` | dropped silently | `:108` |
| F5 | unsaved popover reorder | columns shipped in current `disp_ord` order | `:110` |
| F6 | header resolution | `header = t(cfg.headerKey)` (already-translated) | `:116` |
| F7 | empty `vs.items` (loading) | page passes `FALLBACK_COLUMNS`; hook still filters by config | page wiring + `:100` |

## `exportExcel()` helper

| # | Scenario | Expected | Source |
|---|---|---|---|
| F8 | happy path | `api.post(responseType:"blob")` → `triggerDownload` with server filename | `lib/excel.ts:125-159` |
| F9 | 200 + `Content-Type: application/json` (e.g. WBE2010/2011/2013) | blob decoded → `ApiCallError(code, message)` thrown | `:147-152` |
| F10 | 200 + JSON but not a recognisable envelope | `ApiCallError("WBE9999", …)` | `:149-151` |
| F11 | axios throws with a blob error body | `maybeDecodeJsonError` → typed `ApiCallError`, else `ApiCallError("NETWORK", …)` | `:132-139` |
| F12 | `sort` with missing field or direction | `sort: null` in body (backend default ORDER BY) | `:168-171` |
| F13 | filename from `Content-Disposition` RFC 5987 | decoded UTF-8 (Korean/Khmer round-trip) | `:209-220` |
| F14 | no `Content-Disposition` filename | falls back to `${fileName}.xlsx` | `:154-157` |
| F15 | `title` omitted by caller | body `title: null` (backend falls back to fileName) | `:166` |
| F16 | SSR / no window | `triggerDownload` is a no-op | `:239` |

## `<PageActionButtons>` toolbar

| # | Scenario | Expected | Source |
|---|---|---|---|
| F17 | `showExcel` not set | Excel icon not rendered | `PageActionButtons.tsx:56, :112` |
| F18 | no `show*` flags | toolbar returns `null` | `:67` |
| F19 | `exporting=true` | Print + Excel `disabled`, `cursor-wait opacity-60`, `aria-busy` | `:69-72, :94-129` |
| F20 | `exporting=true` + List | List stays clickable (local popover, no API) | `:36-37, :76-93` |
| F21 | click Excel | calls `onExport()` (no args) | `:117` |

## Integration (page level)

| # | Scenario | Expected |
|---|---|---|
| F22 | non-401 `ApiCallError` from export | page surfaces `useDialog({ type:"error", errorCode })` |
| F23 | 401 during export | global session-expired interceptor handles it; no page dialog |
| F24 | active filters/sort on screen | export request mirrors the on-screen filter + sort |

## Notes

- F2 / F9 are the highest-value scenarios: F2 prevents a special column leaking
  to the workbook from the client side (the backend also enforces it — defence in
  depth); F9 is the sole path that surfaces backend export errors, since the
  response is a blob, not the usual JSON envelope.
- No CSV scenario exists by design — CSV export is not sanctioned (CLAUDE.md §13b).

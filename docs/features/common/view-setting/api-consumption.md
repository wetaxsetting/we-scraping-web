# View Setting — API Consumption (Frontend)

**Part of:** Common → view-setting
**Last verified:** 2026-06-23

Source: `lib/api/screenOption.ts` + `components/shared/view-setting/useViewSetting.ts`.

## The 4 calls (`lib/api/screenOption.ts`)

| Function | HTTP | Path |
|---|---|---|
| `fetchScreenOptions(webSvcId, dymAreaId)` | GET | `/api/v1/screen-options/{webSvcId}/{dymAreaId}` |
| `fetchScreenAreas(webSvcId)` | GET | `/api/v1/screen-options/{webSvcId}/areas` |
| `saveScreenOptions(webSvcId, dymAreaId, items)` | PUT | `/api/v1/screen-options/{webSvcId}/{dymAreaId}` (body `{ items }`) |
| `resetScreenOptions(webSvcId, dymAreaId)` | DELETE | `/api/v1/screen-options/{webSvcId}/{dymAreaId}` |

Path segments are `encodeURIComponent`-escaped. All go through the shared `api` Axios instance
(JWT auto-attached) and `unwrap()` the `ApiResponse<T>` envelope: on `status.error` (or missing
`data`) they throw `ApiCallError(status.code, status.message)`.

Wire types: `ApiScreenOptionListResponse`, `ApiScreenAreaListResponse`, `ApiScreenOptionItem` —
lowercase snake_case property names matching the backend (`field_id`, `disp_ord`, `use_yn`, …). Stable
identifier **values** stay UPPERCASE (`field_id === "BANK"`, `disp_yn === "Y"`).

## Local state until Save (`useViewSetting`)

- **Load** is one-shot on mount + on `(webSvcId, dymAreaId)` change (`reload`); result sorted by
  `disp_ord`.
- Toggle / reorder mutate a **local working copy** via `setItems` — no network call.
- **Save** (`save(next)`): optimistic — sets local items immediately, then PUTs; on success replaces
  with the server response; on failure **rolls back** to the pre-save items, sets `error`, and
  **re-throws** so the popover skips its success dialog.
- **Reset** (`reset()`): DELETEs, sets local items from the response, returns the refreshed list.
- Cancel / ESC / outside-click discard the working copy with no call.

## `SCREEN_IDS` registry (`lib/viewSettingScreens.ts`)

- The popover binds a stable **semantic slug** from `SCREEN_IDS` (e.g. `ACCOUNT_INQUIRY_VND =
  "banking-account-inquiry-vnd"`). Format `<module>-<page>[-<type>]`, lowercase kebab.
- `dymAreaId` is required on every call; single-area pages pass `DEFAULT_AREA_ID` (`"default"`). The
  hook signature defaults it so callers may omit it; the network request always sends a non-empty area.
- **Forbidden:** raw URL paths as screenIds; legacy JEX ids (`fnsh_0001_001`); duplicated tokens;
  module-less ids; inline string literals at the call site (always import from `SCREEN_IDS`). A module-
  load guard throws on duplicate registry values.

## Error handling

- `useViewSetting.extractError` normalises thrown errors to `{ code, message }` (defaults
  `WBE9999` / "Unexpected error"); stored in `vs.error`.
- The page surfaces `vs.error` via the global `useDialog()` system dialog (`type:"error"`,
  `errorCode`). 401s are handled by the global Axios session-expired interceptor in `lib/axios.ts`.
- Backend error codes the FE may see: `WBE2001` (unknown screenId), `WBE_VALIDATION` (bad path / empty
  items), `WBE9999`.

## Adopting a new page (frontend)

1. Add the slug to `SCREEN_IDS` (+ a `SCREEN_ID_TO_ROUTE` row).
2. Call `useViewSetting(SCREEN_IDS.X, DEFAULT_AREA_ID)`; mount `<ViewSettingPopover>` from the toolbar
   `onList` rect.
3. Ensure the backend seed migration ships the column set. No new component / hook / endpoint.

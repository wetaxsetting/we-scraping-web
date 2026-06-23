# View Setting — Component Index (Frontend)

**Part of:** Common → view-setting
**Last verified:** 2026-06-23

All View Setting code lives under `components/shared/view-setting/` — never in a feature folder.

## `<ViewSettingPopover>` — `components/shared/view-setting/ViewSettingPopover.tsx`

Shared popover UI. Portalled, anchored to a trigger rect. Props:

| Prop | Type | Purpose |
|---|---|---|
| `anchorRect` | `DOMRect` | trigger rect for positioning (from `PageActionButtons.onList`) |
| `items` | `ViewSettingItem[]` | working copy (local edits before Save) |
| `lockedFieldIds?` | `ReadonlySet<string>` | FIELD_IDs rendered disabled + skipped by reorder; replaces DB `FIX_YN` |
| `onItemsChange` | `(next) => void` | setter for toggle / reorder |
| `onSave` | `() => void \| Promise<void>` | persist working copy (caller closes on success) |
| `onReset` | `() => void \| Promise<void>` | wipe user overrides (popover stays open with defaults) |
| `onClose` | `() => void` | discard working copy + close |
| `getLabel?` | `(item) => string` | localized row label; falls back to `item.field_nm` |

## `useViewSetting(screenId, dymAreaId = "default")` — `useViewSetting.ts`

Backs every page's popup. Returns `UseViewSettingState`:

| Member | Type | Purpose |
|---|---|---|
| `items` | `ApiScreenOptionItem[]` | merged list (sys + user), sorted by `disp_ord` |
| `loading` | `boolean` | true until first load resolves |
| `error` | `{ code, message } \| null` | last load/save/reset failure |
| `setItems` | `(next) => void` | local working-copy setter |
| `save` | `(next) => Promise<void>` | PUT; optimistic update + rollback on failure (re-throws) |
| `reset` | `() => Promise<ApiScreenOptionItem[]>` | DELETE; returns refreshed defaults |
| `reload` | `() => Promise<void>` | re-fetch from API |

Also exports `VIEW_SETTING_SPECIAL_FIELD_IDS` (`{CHECKBOX, CHECKBOX_1, ETC, MEMO}`),
`isSpecialViewSettingField(fieldId)`, and the `ViewSettingItem` type alias (= `ApiScreenOptionItem`).

> The FE special-field set is wider than the backend's `{CHECKBOX, ETC}` — `CHECKBOX_1` / `MEMO` are
> the V237 Card Transactions two-area variants the FE additionally hides.

## `useViewSettingColumns(config)` — `useViewSettingColumns.ts`

Projects View Setting items → the page's table columns. Config:

| Field | Purpose |
|---|---|
| `vs` | the `useViewSetting` result |
| `baseColumns` | page's column factory output (keys match `fieldIdToColumnKey` values) |
| `fieldIdToColumnKey` | map `FIELD_ID` → column `key`; FIELD_IDs missing from the map are dropped |
| `fallbackMinWidth` | CSS value for `minWidth` when no visible column carries a px size |

Returns `{ columns, minWidth, loading }`. Filters to `use_yn==='Y'` + non-special + known-key, sorts
by `disp_ord`, overrides each column `width` with the seed `size` (DB is the width authority when
present), and sums visible px widths for `minWidth`. `loading` is sticky-wrapped (`useStickyLoading`)
so it doesn't strobe. **No FALLBACK fallthrough** for the table projection — returns `[]` until
`vs.items` populates.

## `<PageActionButtons showList onList>` — `components/shared/PageActionButtons.tsx`

Toolbar icon group. `showList` (opt-in, default false) renders the list-view icon
(`/assets/common/ico-list.svg`, `size-5`); `onList(anchorRect)` fires with the button's `DOMRect`.
List pages declare `showList showPrint showExcel`; detail pages declare `showList` only.

## API client — `lib/api/screenOption.ts`

`fetchScreenOptions(webSvcId, dymAreaId)`, `fetchScreenAreas(webSvcId)`,
`saveScreenOptions(webSvcId, dymAreaId, items)`, `resetScreenOptions(webSvcId, dymAreaId)`. All unwrap
the `ApiResponse<T>` envelope and throw `ApiCallError(code, message)` on `status.error`.

## Registry — `lib/viewSettingScreens.ts`

`SCREEN_IDS` (closed set of kebab slugs, with an import-time uniqueness guard), `DEFAULT_AREA_ID`
(`"default"`), `SCREEN_ID_TO_ROUTE`, `ScreenId` type, `isKnownScreenId(candidate)`. Pages import the
constant — never inline a literal screenId string.

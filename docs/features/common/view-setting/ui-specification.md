# View Setting — UI Specification (Frontend)

**Part of:** Common → view-setting
**Last verified:** 2026-06-23

Source: `components/shared/view-setting/ViewSettingPopover.tsx` (Figma 100:13382).

## Layout

Portalled (`createPortal` → `document.body`), `position: fixed`, `z-50`, width `340px`
(`POPUP_WIDTH`), max height `360px` (`POPUP_MAX_HEIGHT`), `rounded-[10px] bg-white shadow-wb-popup`.
Anchored via `anchorRect`: right-edge aligned to the trigger's right edge so it extends LEFT; opens
below the trigger (`anchorRect.bottom + 6`), or flips above when it would overflow the viewport bottom.
Enter animation `fade-in-0 slide-in-from-top-1 duration-150`.

Three regions:

| Region | Figma | Content |
|---|---|---|
| Header | 100:13384 | Title `view_setting.title` (`text-wb-14 font-medium`) + 4 reorder buttons (First/Prev/Next/Last) |
| Body | 100:13404 | Scrollable column-row list (`custom-scrollbar-y`), `gap-1 p-1` |
| Footer | 100:13420 | Reset (outline, left) · Save (brand) · Cancel (outline, right), `border-t p-4` |

## Tokens

- Reorder buttons: `size-7 rounded-md bg-white shadow-wb-btn`, disabled → `opacity-40 cursor-not-allowed`.
- Row: `flex items-center gap-2 rounded-[5px] px-2.5 py-2`; selected → `bg-brand-softer`, else
  `hover:bg-wb-bg-active`.
- Row label: `text-wb-14-tight font-medium text-wb-ntrl-8`.
- Checkbox: shadcn `<Checkbox>` `size-[18px]`.
- Save: `bg-brand text-white shadow-wb-brand-btn hover:bg-brand-hover`. Reset / Cancel: `bg-white
  text-wb-ntrl-10 shadow-wb-btn`. All `h-8 text-wb-14 font-medium`.
- Icons: `lucide-react` `ChevronsUp/ChevronUp/ChevronDown/ChevronsDown` + `RotateCcw` (utility chrome,
  allowed per CLAUDE.md §6b).

Typography per workspace CLAUDE.md §"Global Typography" — no ad-hoc `text-[Npx]` / inline font styles.

## Locked / disabled rendering

- A FIELD_ID in `lockedFieldIds` renders its checkbox `disabled` and is skipped by the reorder buttons
  (`canMove` false when the selected row is locked). `lockedFieldIds` is a static per-page set passed
  by the page — it replaces the removed DB `FIX_YN` flag. Default is no locked fields.

## Special-field + hidden-column hiding

- Rows where `isSpecialViewSettingField(field_id)` is true (`CHECKBOX`, `CHECKBOX_1`, `ETC`, `MEMO`)
  are excluded from the visible list (`userItems`) but preserved in `specialItems` so Save/Reset carry
  them back unchanged. Reorder renumbers `userItems` `1..N` and merges `specialItems` back verbatim.
- Rows where `disp_yn === "N"` are likewise hidden from the popover (mirrors legacy
  `IDO.USER_SCR_OPTION_WECMS_R002.xml` `WHERE USR.DISP_YN='Y'`). `VAS_ACCOUNT` is the current example.

## Label resolution

- The `getLabel(item)` prop maps a row to its localized header (page aliases the DB `FIELD_ID` to an
  i18n header key). Falls back to `item.field_nm` when `getLabel` is omitted. The DB `FIELD_ID` /
  `FIELD_NM` are never mutated — this is a presentation hook only.

## Dialogs

- Save success → shared `useDialog()` `type:"success"` (`view_setting.saved_successfully`).
- Reset → `type:"confirmation"` (`view_setting.confirm_reset_description`) then `type:"success"`
  (`view_setting.reset_successfully`). Button labels come from shared SystemDialog defaults.

## Width (SIZE) consumption

- `useViewSettingColumns` projects visible items → table columns, overriding `width` with the seed's
  `size` when present and computing `minWidth` from the sum of visible px widths. **Deferred /
  partial:** the SIZE round-trip is not the layout authority end-to-end yet (memory
  `project_view_setting_size_deferred`); Figma → Tailwind tokens remain the width source for now.

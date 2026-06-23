# View Setting — Screen Flow (Frontend)

**Part of:** Common → view-setting
**Last verified:** 2026-06-23

Source: `components/shared/view-setting/ViewSettingPopover.tsx` + `useViewSetting.ts`.

## Open

1. The list page renders `<PageActionButtons showList onList={(rect) => …} />`. Clicking the list-view
   icon fires `onList` with the button's `DOMRect` (`PageActionButtons.tsx` passes
   `e.currentTarget.getBoundingClientRect()`).
2. The page stores the rect and renders `<ViewSettingPopover anchorRect={rect} … />`. The popover is
   portalled to `document.body` and anchored right-edge-to-right-edge (extends LEFT) so it doesn't
   overflow the right viewport edge; flips above the trigger if it would overflow the bottom.

## Working copy

- `useViewSetting(screenId, dymAreaId="default")` loads the merged column list once on mount (and on
  `(screenId, dymAreaId)` change) via GET, sorted by `disp_ord`.
- The popover edits a **local working copy** (`items` + `onItemsChange`). No network call on toggle or
  reorder.
- Rows shown in the list = items that are **not** special (`isSpecialViewSettingField`) **and** not
  `disp_yn === "N"`. CHECKBOX/ETC + hidden-by-admin rows are preserved in the array but not rendered.

## Toggle visibility

- A row's checkbox flips `use_yn` between `Y`/`N` in the working copy.
- Locked rows (`lockedFieldIds`) render the checkbox `disabled` and ignore toggles (defensive guard in
  `handleToggleVisibility` too). Special/`disp_yn='N'` rows never render, so can't be toggled.

## Reorder

- Selecting a row enables the First / Prev / Next / Last buttons (`ChevronsUp/Up/Down/ChevronsDown`).
- Reorder operates only on non-special, visible rows. After a move the user rows are renumbered
  densely `1..N` and the special rows (CHECKBOX `disp_ord=0`, ETC `disp_ord=99`) are merged back
  unchanged — so specials keep their order across every Save.
- Locked rows cannot be selected for a move (`canMove` is false).

## Save

- `handleSaveClick` → host `onSave()` (the page calls `vs.save(items)` → PUT). On success a shared
  Success dialog opens (`view_setting.saved_successfully`). On failure the hook rolls back the
  optimistic update and sets `vs.error`; the popover shows no success dialog.
- The full merged list (including `use_yn='N'` and special rows) is sent so order survives.

## Reset

- `handleResetClick` → confirmation dialog (`view_setting.confirm_reset_description`). On Continue →
  `onReset()` (page calls `vs.reset()` → DELETE). On success a Success dialog opens
  (`view_setting.reset_successfully`); the popover stays open showing refreshed defaults. Cancel is a
  no-op (no backend call).

## Cancel / dismiss

- Cancel button, ESC, or outside-click closes the popover and **discards** the working copy with no
  network call.

## States summary

| State | Trigger | Effect |
|---|---|---|
| Loading | mount / reload | `vs.loading` true; page may OR into its table loading flag |
| Editing | toggle / reorder | local working copy only |
| Saving | Save click | optimistic update + PUT; rollback on error |
| Reset confirm | Reset click | confirmation dialog → DELETE on Continue |
| Error | failed load/save/reset | `vs.error` set; surfaced via global system dialog |

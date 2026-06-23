# View Setting — Test Scenarios (Frontend)

**Part of:** Common → view-setting
**Last verified:** 2026-06-23

## User flows

| # | Scenario | Steps | Expected |
|---|---|---|---|
| F1 | Open popover | Click list-view icon in the toolbar | Popover opens anchored right-edge to the trigger, extending left; column list loaded + sorted by `disp_ord` |
| F2 | Toggle visibility | Uncheck a column | `use_yn` flips to `N` locally; no network call; table reflects on Save |
| F3 | Reorder | Select a row, click Prev/Next/First/Last | Row moves; user rows renumber `1..N`; CHECKBOX stays first, ETC stays last |
| F4 | Locked column | Open a page with `lockedFieldIds` (e.g. Account Inquiry `BANK`) | That checkbox is disabled; row cannot be selected for reorder |
| F5 | Special-field hiding | Inspect the popover list | `CHECKBOX`/`ETC` (+ `CHECKBOX_1`/`MEMO`) never appear; `disp_yn='N'` rows (e.g. `VAS_ACCOUNT`) hidden |
| F6 | Save success | Edit + Save | PUT fires; optimistic table update; Success dialog `view_setting.saved_successfully` |
| F7 | Reset | Click Reset → Continue | Confirmation dialog → DELETE → Success dialog; popover shows refreshed defaults |
| F8 | Reset cancel | Click Reset → Cancel | No backend call; working copy untouched |
| F9 | Cancel / ESC / outside-click | Edit then dismiss | Working copy discarded; no network call |
| F10 | Width projection | Page using `useViewSettingColumns` | Table renders only visible+known columns in `disp_ord`; width from seed `size` when present; no FALLBACK flash |

## Error handling

| # | Scenario | Expected |
|---|---|---|
| E1 | Save fails (server `WBE…`) | Optimistic update rolled back; `vs.error` set; no success dialog; global error dialog with `errorCode` |
| E2 | Load fails | `vs.error` set; page surfaces error; popover does not show stale data as saved |
| E3 | 401 mid-session | Global Axios interceptor (`lib/axios.ts`) triggers session-expired re-auth; not handled per-call |
| E4 | Reset fails | `vs.error` set, re-thrown; no success dialog |

## Accessibility

| # | Scenario | Expected |
|---|---|---|
| A1 | Keyboard select | Enter / Space on a row body selects it (`role="option"`, `aria-selected`) |
| A2 | Checkbox keyboard | Space toggles the focused checkbox independently of row selection |
| A3 | Reorder button labels | Buttons have `aria-label` (`view_setting.aria.first/prev/next/last`) |
| A4 | ESC closes | ESC dismisses the popover (discards) |
| A5 | Disabled state | Locked checkboxes are `disabled`; reorder buttons are `disabled` (`opacity-40`) when no movable row is selected |

## Notes / gaps

- All user-visible strings go through `t(…)` (`view_setting.*`, `dialog.*`) and must exist in
  `en.json` / `ko.json` / `vi.json`.
- `⚠️ UNVERIFIED` — no automated frontend test (unit / RTL / e2e) for the popover or hook was located
  this pass; scenarios above are manual SIT/UAT. Recommend RTL coverage for F2/F3/F5/F6/E1 and the
  special-field + locked-row invariants.

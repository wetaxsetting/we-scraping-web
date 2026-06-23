# Approval Line — Frontend Test Scenarios (SIT / UAT)

Manual verification for the Settings → Approval Line panel. Backend coverage map:
[wecms-api/docs/features/settings/approval-line/test-scenarios.md](../../../../../wecms-api/docs/features/settings/approval-line/test-scenarios.md).
Run against a local backend with V6 / V7 applied (the `APPR_LINE_INFM` + `APPR_LINE_INFM_DETL` schema; key-gen branch lives in the consolidated V140 `wb_get_next_val`) + a tenant user seeded in `USER_BUSI_CONN_INFM`.

---

## Search

| # | Steps | Expected |
|---|---|---|
| S1 | Type a substring of a line name | grid filters in place (client-side; no refetch) |
| S2 | Type a non-matching string | empty state "Approval Line Not Found" |
| S3 | Clear the box | full tenant set returns |
| S4 | Click "Approval Line Name" / "Approver name" / "Create Date" headers | sort glyph cycles default → ASC → DESC (client-side) |

## Create

| # | Steps | Expected |
|---|---|---|
| C1 | "+ Add Approval line" → name + pick 1 approver → Save | success dialog; row appears; primary approver shown; list refetches |
| C2 | Pick 2+ approvers → Save | row shows primary name + `+N` count chip; clicking the chip opens the chain hover card |
| C3 | Blank name → Save | inline Zod error (`validation.name.required`); no request sent |
| C4 | 0 approvers → Save | inline Zod error (`validation.approvers.required`) |
| C5 | Try to add a 6th approver | picker capacity caps at 5; if forced, Save shows `validation.approvers.too_many` |
| C6 | Add the same approver twice | Zod `superRefine` duplicate error inline; backstop `WBE_APPROVAL_LINE_DUP_APPROVER` |
| C7 | Approver not linked to tenant (forced) | backend `WBE_APPROVAL_LINE_APPROVER_NOT_IN_TENANT` → error dialog |

## Edit

| # | Steps | Expected |
|---|---|---|
| E1 | Row "Edit" | dialog fetches full chain via `loadDetail` (not just the primary); skeleton/loading while fetching |
| E2 | Rename + remove one + add another → Save | PUT diff-syncs; list refetches; row reflects changes |

## Reordering (AL-GAP-01)

| # | Steps | Expected |
|---|---|---|
| O1 | Drag an approver row up | row moves; dragged row dims (`opacity-50`); `#` column re-numbers live |
| O2 | Drag a row down | same |
| O3 | Save the reordered list | PUT succeeds; backend re-numbers `apprvr_disp_ord` `1..N` from array order |
| O4 | Reopen the line (Edit) | chain shows the **saved order** (read path orders `APPRVR_DISP_ORD ASC`) → order persisted |
| O5 | Drag via the `GripVertical` handle vs anywhere on the row | both work — the whole `<tr>` is `draggable`; the grip is a visual affordance |

## Validation

| # | Steps | Expected |
|---|---|---|
| V1 | Duplicate approver | inline `validation.approvers.duplicate` |
| V2 | Empty line | inline `validation.approvers.required` |
| V3 | > 5 approvers | inline `validation.approvers.too_many` |
| V4 | Blank / >100-char name | inline `validation.name.required` / `validation.name.max` |

## Delete

| # | Steps | Expected |
|---|---|---|
| D1 | Row "Delete" | `confirmation` dialog with the line name |
| D2 | Confirm | DELETE succeeds; row disappears; success dialog; list refetches |
| D3 | Delete the same row in two tabs (race) | second attempt → `WBE_APPROVAL_LINE_NOT_FOUND` error dialog |

## Errors / locale

| # | Steps | Expected |
|---|---|---|
| X1 | Stop the backend mid-Save | `error` dialog with a `trace_id` |
| X2 | Switch language (EN/KO/VI) | every Approval Line surface re-renders in the new locale |
| X3 | 401 (session expired) | global re-auth interceptor fires (not feature-specific) |

## Responsive

| # | Steps | Expected |
|---|---|---|
| R1 | Open at 1440 / 1024 | panel + dialog render cleanly; chain table scrolls inside the dialog if needed |

---

## Notes

- No automated frontend test harness ships for this feature (consistent with the rest of `wecms-web`
  static-UI panels) — verification is manual per the table above plus the backend `ApprovalLineServiceTest`
  (12 cases) for the server contract.
- The drag-and-drop is native HTML5 (no library) — verify in a real browser (`npm run dev`), not via
  unit assertion.

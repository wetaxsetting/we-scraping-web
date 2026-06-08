# Approval Box — Test Scenarios (Frontend)

Manual / integration scenarios for `/payment/approval-box`. Backend scenarios: [../../../../../wecms-api/docs/features/payment/approval-box/test-scenarios.md](../../../../../wecms-api/docs/features/payment/approval-box/test-scenarios.md).

---

## 1. List, filter, tabs, sort

| # | Scenario | Expected |
|---|---|---|
| L1 | Page loads | live `GET /approval-box` (default preset + `all` tab); rows render; tab counts from backend |
| L2 | Switch to Pending tab | `appr_type_cd=00`; only pending rows; counts unchanged; page resets to 0 |
| L3 | Change date preset 30→90 days | new `from_date`/`to_date`; refetch; page resets |
| L4 | "Enter Manually" range | manual range seeds from active preset; chips never open empty |
| L5 | Type a keyword | `srch_wd` sent (trimmed); page resets |
| L6 | Click a sortable header | cycle default→ASC→DESC→default; `sort_field`/`sort_direction` sent; DB orders rows (no client sort) |
| L7 | Click a non-sortable header (Approver/Currency) | no glyph, no sort |
| L8 | Paginate | page index changes; default page size 10 |
| L9 | Empty result | centered `approval.empty` placeholder |
| L10 | Refetch after action | stable-data latch keeps prior rows; no empty flash |

## 2. Approver popover

| # | Scenario | Expected |
|---|---|---|
| AP1 | Click approver count chip | popover lists chain (line · name · actedAt · status pill) |
| AP2 | Status icons | A→check, R→x, P→hourglass, W/S→alert; labels via `approval.approver_status.*` |
| AP3 | ESC / outside click | popover closes |
| AP4 | Empty chain | cell shows `—` |

## 3. Approval Details dialog

| # | Scenario | Expected |
|---|---|---|
| D1 | Click Document No. | dialog opens; per-line transactions lazily loaded by `typeKey` |
| D2 | Card row | transactions loaded via `fetchCardTransactionsByApproval(apprSeqNo)` |
| D3 | Non-card row | loaded via the module detail endpoint keyed by `documentNo` |
| D4 | Detail load error | system `error` dialog |
| D5 | Approve/Reject buttons visible | only when `actionable` (current user is the pending approver) & not in-flight & not editing |
| D6 | Kebab Edit/Delete/Re-submit visible | only when document is Pending/In Progress |

## 4. Approve / Reject

| # | Scenario | Expected |
|---|---|---|
| A1 | Approve (your turn) | `approveApprovalBoxRow`; success dialog; dialog closes; list refetches; status/counts updated |
| A2 | Reject (your turn) | `rejectApprovalBoxRow`; downstream peers stopped (backend); refetch |
| A3 | Approve not your turn | button not shown (`actionable=false`) |
| A4 | Backend error (e.g. `WBE2052`) | `error` dialog with the code |
| A5 | Double-click guard | `actionInFlight` blocks a second submit |

## 5. Withdraw / Change line / Re-submit

| # | Scenario | Expected |
|---|---|---|
| W1 | Delete (withdraw) non-card | `confirmation` dialog → confirm → `withdrawApprovalBoxRow` → success → refetch |
| W2 | Delete card | `withdrawCardApproval` |
| W3 | Edit (change line) non-card | inline `EditApprovalLinePicker`; Save → `changeApprovalBoxApprovalLine`; disabled until a line is picked |
| W4 | Edit card | `changeCardApprovalLine` |
| W5 | Re-submit | `warning` placeholder dialog (not implemented) |

## 6. Deep-link

| # | Scenario | Expected |
|---|---|---|
| DL1 | Open `?appr_seq_no=<id>` for a row in the current slice | dialog auto-opens; row highlighted; fires once |
| DL2 | Id not in current slice | `warning` dialog `approval.deeplink.not_found` |

## 7. Toolbar

| # | Scenario | Expected |
|---|---|---|
| T1 | List icon | View Setting popover (column visibility/order); Save/Reset round-trip |
| T2 | Print | `printReport` of on-screen columns (filtered rows, not page slice) |
| T3 | Excel | `POST /approval-box/export` with live View-Setting columns ∩ 10 export cols (Approver excluded) + filters + sort |

## 8. Loading / error states

| # | Scenario | Expected |
|---|---|---|
| LE1 | Initial load | sticky `common.loading` (≥400ms) |
| LE2 | List error | `error` dialog with code + trace id |
| LE3 | Mutation in flight | Approve/Reject/kebab handlers withheld |

## 9. Known issues to verify-fix (open)

| # | Issue | Where | Expected fix |
|---|---|---|---|
| K1 | Missing locale keys `approval.action.approve_success`/`approve_failed`/`reject_success`/`reject_failed` — raw key leaks to UI on approve/reject | `ApprovalBoxPage.tsx` + `locales/en.json` | add the keys (or point handlers at existing `approval.success.*`) in all three locale files |
| K2 | Duplicate `approval.col.file_name` key | `locales/en.json` | dedupe |
| K3 | Dead files still in tree (`ApprovalTableColumns`, `ApproverHoverCard`, `BulkActionBar`, `RowActionDialog`, local `DateRangePicker`) | `components/payment/approval-box/` | remove in a cleanup MR (no functional impact) |

## 10. Legacy parity (verified)

| # | Scenario | Expected |
|---|---|---|
| P1 | Page-size default 10 | intentional divergence from legacy 15 (project decision) |
| P2 | File Name from `file_name` (`ORG_FILE_NM`) | not `TITL`; ellipsis + native `title` hover |
| P3 | Tab counts independent of selected tab | matches backend `countTabs` |
| P4 | Notification deep-link round-trip | request/approve/reject notifications + `?appr_seq_no=` auto-open work end-to-end |

SIT/UAT: **complete**.

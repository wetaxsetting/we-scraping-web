# Audit Log — Test Scenarios (Frontend)

**Part of:** Common → audit-log
**Last verified:** 2026-06-23

`AuditLogsDialog` is a thin read-only presentational modal. Scenarios are UI/manual — no write path exists
on the frontend.

## Render

| # | Scenario | Expected |
|---|---|---|
| 1 | Open with `rows` populated | 4-column table (Date/Time · User · Activity · Activity Details); Date/Time renders the two-line date+time stack. |
| 2 | Open with empty `rows` | Header shows; body shows centered `common.no_data` placeholder, no empty table area. |
| 3 | `description` omitted | Subtitle line is hidden; header still renders the title. |
| 4 | `columnLabels` override passed | Overridden header label(s) shown; un-overridden default to `DEFAULT_COL_KEYS`. |
| 5 | Long Activity / Details text | Cells `truncate` (single line) without breaking the row height. |

## Close behaviour

| # | Scenario | Expected |
|---|---|---|
| 6 | Click Close button | `onClose()` fires; only this dialog dismisses. |
| 7 | Click top-right X | `onClose()` fires (provided by `<DialogContent>`). |
| 8 | Press ESC | Dismisses only this dialog (`stackLevel={2}`); parent Settings modal stays open. |

## Stacking

| # | Scenario | Expected |
|---|---|---|
| 9 | Opened from inside the Settings shell (L1) | Sits at L2 with the lighter overlay dim; parent dims but stays visible. |

## Host integration (Login Credentials / Bank Account)

| # | Scenario | Expected |
|---|---|---|
| 10 | Select a row → open Audit Logs | Host fetches that row's history from its per-feature endpoint, maps to `AuditLogRow[]`, passes pre-translated rows. |
| 11 | Activity / details locale | Strings are already translated by the host mapper — the dialog renders verbatim, no client re-translation. |
| 12 | Fetch error / empty result | Host renders the dialog with empty `rows` → no-data placeholder (graceful). |

## Not applicable

- No write/append test — the frontend has no audit write path.
- No locale-fan-out / seq-no test — those are backend concerns
  (see the API twin's `test-scenarios.md`).

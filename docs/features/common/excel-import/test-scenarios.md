# Excel Import — Test Scenarios (Frontend)

**Part of:** Common → excel-import
**Last verified:** 2026-06-23

UI/behaviour scenarios for the shared `<ExcelUploadDialog>` shell + per-feature wrappers. Backend-side scenarios live in the [backend twin](../../../../../wecms-api/docs/features/common/excel-import/test-scenarios.md).

## Template validation (`templateValidator`)

| # | Scenario | Expectation |
|---|---|---|
| T1 | Pick the **wrong template** (e.g. Contacts file in the Purpose dialog) | `validateExcelTemplate` → `wrong_template` (forbidden header detected); `type:"error"` dialog; preview NOT populated |
| T2 | Pick a file whose **header row is missing/garbled** | `no_headers`; error dialog |
| T3 | Pick a **corrupt / non-Excel** file | `parse_error`; error dialog |
| T4 | Pick a workbook with **no sheet** | `no_sheet`; error dialog |
| T5 | Pick a valid **KO or VI** template | accepted (locale-aware, whitespace-tolerant matching) |
| T6 | Header with leading/trailing/run-on whitespace (e.g. " Contact Code") | accepted (normalised) |

## Preview rendering

| # | Scenario | Expectation |
|---|---|---|
| T7 | Preview returns rows with some invalid cells | invalid `<td>` tinted red (`bg-[#ffe1e3]`); Completed / Error chips reflect counts |
| T8 | Invalid cell with an `errorMessage` | hover/focus shows the custom dark tooltip with the message |
| T9 | Many columns exceeding panel width | three sibling tables pan in lockstep (shared horizontal scroll); columns stay aligned via shared `<colgroup>` |
| T10 | Many rows | body scrolls vertically; header frozen at top, Total row pinned at bottom |
| T11 | Column widths come from config | no hardcoded `<col className="w-[Npx]">`; widths from `widthPx` |

## Upload gating & buttons

| # | Scenario | Expectation |
|---|---|---|
| T12 | No valid file yet | Upload button disabled-grey (`bg-[#d4d4d4]`, `cursor-not-allowed`) |
| T13 | Valid preview, `uploadDisabled=false` | Upload becomes brand-blue, clickable |
| T14 | Before any file picked | picker button reads **"Browse"**; chip empty/placeholder |
| T15 | After file picked | picker button reads **"Re-Select"**; chip shows filename at `opacity-60` |
| T16 | Close / X / ESC / overlay | `onClose` fires → host unmounts the dialog |

## Per-feature variant chrome

| # | Scenario | Expectation |
|---|---|---|
| T17 | Contacts opens | `selectStep` (Local vs Overseas) renders above Download; badges shift to 1/2/3 |
| T18 | VAS Account opens | `optionsStep` (Add new vs Reset-and-replace) below Browse; Download full-width with green Excel icon; inline file chip + Browse on one row |
| T19 | Payment upload opens | `extraStep` / `customStep3` renders the withdrawal-account picker |

## Result dialogs (variant correctness — CLAUDE.md rule)

| # | Scenario | Expectation |
|---|---|---|
| T20 | File-type / template validation fails | `type:"error"` (NOT warning) |
| T21 | Import succeeds | `type:"success"` |
| T22 | VAS "Reset and replace" confirm | `type:"confirmation"`, standard **blue** Continue (NOT red `destructive`) |

## Open / UNVERIFIED

- ⚠️ No frontend test files were located for these wrappers at indexing time — these scenarios are spec-derived (component behaviour read from source), not tied to existing test files. Confirm whether wrapper tests exist before treating coverage as guaranteed.

## Related

- [screen-flow.md](screen-flow.md) · [ui-specification.md](ui-specification.md) · [component-index.md](component-index.md) · [README.md](README.md)

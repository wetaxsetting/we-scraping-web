# Purpose — Test Scenarios (Frontend)

Manual SIT/UAT scenarios for the Purpose panel. Backend scenarios + JUnit coverage:
[wecms-api/docs/features/settings/purpose/test-scenarios.md](../../../../../wecms-api/docs/features/settings/purpose/test-scenarios.md).

---

## Search

| # | Scenario | Expected |
|---|---|---|
| S1 | Open the Purpose panel | tree loads, level-1 rows ordered by display order, children collapsible |
| S2 | (keyword) | no visible search box in the current design (OQ-FE-2); backend supports `?keyword=` for future use |
| S3 | Expand a parent | children render indented; chevron rotates |

## Create

| # | Scenario | Expected |
|---|---|---|
| C1 | "+ Add Purpose", fill Code + Name, Save | success dialog; tree refetches with the new row |
| C2 | Add a child — pick a level-1 parent | row appears nested under the parent |
| C3 | Save with empty Code or Name | Save stays disabled |
| C4 | Duplicate code | error dialog `settings.purpose.error.duplicate_code` (`WBW1152`) |
| C5 | Duplicate name | error dialog `settings.purpose.error.duplicate_name` (`WBW1138`) |
| C6 | Parent picker only lists level-1 rows | no level-2 row is selectable as a parent |
| C7 | Cancel | inline form discards, no network call |

## Update

| # | Scenario | Expected |
|---|---|---|
| U1 | Edit name / description, Save | success dialog; row updated after refetch |
| U2 | Change parent | row re-nests under the new parent |
| U3 | Edit form excludes the row itself from the parent picker | cannot self-parent |
| U4 | Toggle status | `disp_yn` flips optimistically, persisted |

## Delete

| # | Scenario | Expected |
|---|---|---|
| D1 | Delete a leaf | deletes immediately (no confirm); row gone after refetch |
| D2 | Delete a parent with children | confirmation ("removes all sub-purposes") → Continue → deleted |
| D3 | Delete a row/parent that is in use | error dialog `settings.purpose.error.delete_blocked` (`WBE1199`) |
| D4 | Verify soft-delete | deleted row no longer appears (backend soft-deletes; FE never sees `USE_YN='N'`) |
| D5 | Double-click trash | `deletingIds` guard prevents a duplicate request |

## Import

| # | Scenario | Expected |
|---|---|---|
| I1 | Download template | locale-correct XLSX downloads from `/templates/purpose/...` |
| I2 | Upload a valid file | preview all-completed → Upload → success toast `{count}` → tree refetches |
| I3 | Duplicate / invalid rows | preview shows per-cell highlights (`dup_file`/`dup_db`/`parent_not_found`/`parent_not_root`/`required`/`length`); dialog stays open |
| I4 | Invalid hierarchy (child under a level-2 parent) | `parent_not_root` highlight |
| I5 | Import with a row error | whole batch rejected (`WBE_VALIDATION`); dialog stays open |

## Export

N/A — Purpose has no data export, only the template download (covered by I1).

## Authorization

| # | Scenario | Expected |
|---|---|---|
| A1 | User with `settings-core-purpose` | Purpose appears in the Settings sidebar; all actions work |
| A2 | User without the grant | Purpose entry hidden from `<SettingsNav>`; direct API attempts 403 server-side |

## Error handling

| # | Scenario | Expected |
|---|---|---|
| E1 | Backend unreachable on load | error dialog + mock fallback tree paints (panel never blank) |
| E2 | API failure on a mutation | `type: "error"` dialog with the mapped message/code |
| E3 | Session expired (401) | global Axios interceptor triggers the re-auth dialog |

## Cross-cutting

- Verify modal stack: Excel Upload opens at `stackLevel=2` over the Settings shell; dim compounds correctly; only the top layer is interactive.
- Verify the panel is the **modal baseline** — sidebar collapse arrow toggles width only (never closes the modal); ESC closes the top-most layer only.
- Verify all visible strings resolve via `t(...)` in EN / KO / VI.

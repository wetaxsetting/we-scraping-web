# Purpose — UI Specification (Frontend)

The implemented Purpose panel UI. Follows the Settings shell + panel-composition contract and the
Settings UI consistency rules in `wecms-web/CLAUDE.md` §3a / §3b. JEX reference:
[docs/jex/features/purpose/functional-specification.md](../../../../../docs/jex/features/purpose/functional-specification.md).

---

## Main page

- **Header:** title "Purpose" (`settings.purpose.title`) + description (`settings.purpose.description`); right-side actions = "+ Add Purpose" + "Excel Upload" chips.
- **Search / filters:** the Figma read-state shows **no search input** in the panel header (the backend list endpoint accepts `?keyword=` but no visible filter is wired — OQ-FE-2). There is no separate parent filter or active/inactive filter; soft-deleted rows simply never appear (the backend filters `USE_YN='Y'`), and the per-row status toggle controls `disp_yn`.
- **Scroll:** the tree scrolls inside `custom-scrollbar-y`; "+ Add Purpose" / pagination-equivalent chrome stays pinned outside the scroll region per the panel composition rule.

## Purpose grid (tree table)

[`<PurposeTable>`](../../../../components/settings/purpose/PurposeTable.tsx) — bare `<table>` +
shared `<colgroup>` ([`PurposeTableColumns`](../../../../components/settings/purpose/PurposeTableColumns.tsx)), level-1 rows with expandable level-2 children ([`<PurposeRow>`](../../../../components/settings/purpose/PurposeRow.tsx)).

| Column | Source field | Notes |
|---|---|---|
| (chevron) | — | expand/collapse for parents only |
| **Purpose Code** | `hand_use_usag_cd` | user-visible code (e.g. `BD01`, `BD01-01`) |
| **Purpose Name** | `use_usag_nm` | display name |
| **Description** | `use_usag_cont` | renders `-` when empty |
| (actions) | — | edit pencil · delete trash · status toggle ([`<RowActions>`](../../../../components/settings/purpose/RowActions.tsx)) |

- **Parent Purpose** is not a separate grid column — the hierarchy is expressed by nesting (children appear indented under their parent). It is an editable field in the add/edit form.
- **Display Order** is not shown as a column — it drives row order on load. Drag-reorder is not wired in the panel yet (the `reorderPurposeSettings` client fn + `PUT /order` endpoint exist but `<PurposePanel>` does not call them).
- **Status** = the `disp_yn` toggle in the actions cell (`settings.purpose.toggle_on` / `toggle_off`).

## Create / Edit form (inline)

[`<PurposeFormRow>`](../../../../components/settings/purpose/PurposeFormRow.tsx) — a sticky-bottom
form row sharing the table's `<colgroup>`.

| Field | Required | Limit | Notes |
|---|---|---|---|
| Purpose Code | ✅ | ≤20 | `settings.purpose.form.code_placeholder` ("Purpose Code*") |
| Purpose Name | ✅ | ≤255 | `settings.purpose.form.name_placeholder` |
| Description | — | ≤500 | `settings.purpose.form.description_placeholder` ("Description (optional)") |
| Parent Purpose | — | — | [`<ParentPurposePicker>`](../../../../components/settings/purpose/ParentPurposePicker.tsx) — searchable dropdown |

- **Save** is disabled until Code + Name are non-empty; frontend mirrors the backend length caps, backend is authoritative.
- **Parent selection logic:** the picker shows **only level-1 rows** (`!node.parentSystemCd`) per OQ-FE-Frontend-1; on edit, the row itself is excluded (no self-parent). The picker resolves the user-visible hand code → system `use_usag_cd` before submit.
- Create → `POST`; Edit → `PUT`; both refetch on success and surface a success dialog.

## Delete flow

[`<RowActions>`](../../../../components/settings/purpose/RowActions.tsx):

- Trash is always enabled (no frontend pre-disable on `usedInTransactions`).
- **Leaf row:** immediate delete, no confirmation.
- **Parent row:** confirmation dialog (`settings.purpose.confirm.delete_with_children`, Continue = `settings.purpose.confirm.delete_continue`) → delete.
- Server `WBE1199` flips the dialog to an error (`settings.purpose.error.delete_blocked`).
- A per-row `deletingIds` guard prevents duplicate requests in flight.

## Import / Export UI

[`<ExcelUploadDialog>`](../../../../components/settings/purpose/ExcelUploadDialog.tsx) wraps the shared
[`<ExcelUploadDialog>`](../../../../components/shared/excel-upload/ExcelUploadDialog.tsx) shell
(`stackLevel=2` from inside Settings):

- **Download Template** → static `/templates/purpose/WeCMS_Purpose_Bulk_Upload_{EN|KO|VI}.xlsx` (no API call).
- **Browse / Re-Select** → `.xls`/`.xlsx` only.
- **Preview** → multipart `POST /excel/preview`; four columns (Purpose Code / Purpose Name / Description / Parent Purpose) with per-cell error highlights; completed / error count chips.
- **Upload** → `POST /excel/import` with the previewed rows; success toast (`settings.purpose.success.uploaded`, `{count}` interpolated) + refetch; row errors keep the dialog open.
- There is **no data export** for Purpose — only the template download.

## States

Loading / empty / error per [screen-flow.md](screen-flow.md). Error dialogs use `type: "error"` with
the appropriate `errorCode`; success uses `type: "success"`; the parent-delete prompt uses
`type: "confirmation"` — per the project dialog-variant rule.

## i18n keys (namespace `settings.purpose.*`)

`title` · `description` · `add` · `excel_upload` · `col.code` · `col.name` · `col.description` ·
`col.actions` · `toggle_on` · `toggle_off` · `actions.{edit,delete,expand,collapse}_aria` ·
`form.{code,name,description,parent}_placeholder` · `form.parent_aria` · `form.cancel` · `form.save` ·
`list.loading` · `list.empty` · `confirm.delete_with_children` · `confirm.delete_continue` ·
`success.{created,updated,deleted,uploaded}` · `error.{duplicate_code,duplicate_name,delete_blocked,network,generic}`
· `upload.*` (Excel dialog chrome). Plus the nav label `settings.nav.purpose`. All present in
`locales/{en,ko,vi}.json`.

| Wire error code | i18n key |
|---|---|
| `WBW1152` | `settings.purpose.error.duplicate_code` |
| `WBW1138` | `settings.purpose.error.duplicate_name` |
| `WBE1199` | `settings.purpose.error.delete_blocked` |
| network / other | `settings.purpose.error.network` / `.generic` |

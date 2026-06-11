# Chart of Accounts — UI Specification (Frontend)

Documents the shipped panel UI. Tokens follow WB365 (`text-wb-*`); Settings rules §3a/§3b apply.

---

## 1. Main page

- **Header:** title `settings.chart_of_accounts.title` + description; right side `+ Add A New Account` CTA + green Excel Upload chip (`bg-[#1f7a4d]`, documented brand-asset exception).
- **Filter row:** a single `<SearchInput>` (keyword). When ≥1 child row is selected, the header surfaces bulk **Delete** (red) + **Deactivate** (blue) buttons.
- **No status / parent / account-type filter dropdowns** — keyword search only. Filtering is in-memory across child rows on `accountCode`, `accountTypeEn`, `accountTypeVi`, `accountTypeKo`, `parentCode`; a group row stays visible if any child matches or its own code/name matches.

## 2. COA grid (`ChartOfAccountsTable.tsx`)

Bare `<table>` + shared `<colgroup>` (`ChartOfAccountsTableColumns.tsx`), sticky `<thead>`. Two row kinds: **group** (restricted roots — bold, no checkbox/parent/calc/status/actions cells) and **child** (everything else).

| Column | Width | Content |
|---|---|---|
| Checkbox | 44px | Selection — **child rows only** (group rows render an empty placeholder); always rendered, not View-Setting-controlled |
| Account Code | 160px | Code; bold for groups; indented for children by `chartAcctLevel` (L2 = 16px, L3 = 32px; null = 0) |
| Account Type (English) | 240px | EN name (`accountTypeEn`); bold for groups |
| Account Type (Vietnamese) | 200px | VN name; ellipsis-tooltip on overflow |
| Account Type (Korean) | 180px | KO name; ellipsis-tooltip |
| Parent Account | 220px | Badge `{code} {name}` (child rows); ellipsis-tooltip |
| Calc Rule | 110px | `+`/`-` badge — **level-3 child rows only** |
| Status | 140px | Active (blue) / Inactive (red) badge — child rows only |
| Actions | 140px | `size-7` Edit pencil + Delete trash (child rows; disabled on restricted) |

> Columns requested in the prompt vs reality: the grid shows **English / Vietnamese / Korean name columns** (the prompt's single "Account Name") and a **Calc Rule** column; there is **no "Account Level" column** (level only drives indentation) and **no separate "Parent Account name" column** (rendered as a badge inside Parent Account). Status uses A/I.

## 3. Create / Edit inline row (`ChartOfAccountsInlineRow.tsx`)

Renders inside the table scroll region (shares the `<colgroup>`), not a separate dialog.

| Field | Required | Control / rule |
|---|---|---|
| Account Code | ✅ | text; max 10 (`ACCOUNT_CODE_MAX`), pattern `^[A-Za-z0-9_-]+$`; char counter; **disabled in edit mode** (immutable) |
| Account Name (English) | ✅ | text |
| Account Name (Vietnamese) | ✗ | text |
| Account Name (Korean) | ✗ | text |
| Parent Account | ✅ | `<InlineDropdown>` from `parentOptions` (excludes self, descendants, orphans, and level-4 nodes; only level ≤ 3 eligible) |
| Calc Rule | ✗ | `<InlineDropdown>` `["", "+", "-"]`; **disabled unless prospective level === 3** (`selectedParent.level + 1`) |
| Status | ✅ | `<InlineDropdown>` `["active","inactive"]`; default `active` on create |

**Client validation:** code required / ≤10 / pattern; name_en required; parent required. Backend re-validates and surfaces cycle / depth / duplicate / restricted / parent-not-found via the error dialog (`ApiCallError` → `useDialog`).

## 4. Search / filter

Single keyword `<SearchInput>` (see §1). No date / status / parent / type filters.

## 5. Import / Export UI

- **Import** (`ExcelUploadDialog.tsx`, stackLevel 2):
  - Step 1 — Download template (`/templates/chart-of-accounts/WeCMS_Chart_of_Accounts_upload_{EN,VI,KO}.xlsx`).
  - Step 2 — Browse `.xlsx`/`.xls`; template-shape validation; SheetJS parse (`useExcelUpload.ts`).
  - Preview table (5 columns: Account Code, Name EN, Name VI, Name KO, Parent Account); per-cell error highlight + tooltip.
  - Validation keys: `code_required`, `code_too_long` ({max:10}), `code_invalid`, `code_duplicate`, `name_en_required`, `parent_required`, `depth_exceeded` ({max:3}).
  - Completed / Error count chips; Upload button disabled while any error or uploading.
  - Upload → `POST /bulk-upload` (rows with `stts:"A"`) → `{created, failed}` → result dialog → list refetch.
- **Export:** **not implemented** — there is no Excel/CSV export control. The only file output is the import template.

## 6. Bulk actions

- Selection: checkboxes on **child, non-restricted** rows only; header checkbox toggles the filtered view; indeterminate when partial.
- **Delete** (red, `destructive`): confirmation → `POST /bulk-delete` → result dialog.
- **Deactivate** (blue): confirmation → `POST /bulk-deactivate` (idempotent) → result dialog.
- **Activate:** intentionally absent — re-activate one row at a time via the inline edit Status dropdown.
- Result dialogs: full success (`{processed}`) vs partial (`{processed, failed}`); selection cleared after refetch.

## 7. Typography / tokens

Page title `text-wb-18 font-semibold`; table header `text-wb-13 font-semibold`, body `text-wb-13 font-medium`; Edit/Delete are the canonical `size-7` icon-only pair (documented §3b exception); Excel chip green is a documented brand-asset exception. No View Setting popover (OQ-6).

Cross-links: [component-index.md](component-index.md) · [api-consumption.md](api-consumption.md).

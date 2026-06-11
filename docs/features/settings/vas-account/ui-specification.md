# Settings > VAS Account — UI Specification (Frontend)

Layout, columns, dialogs, states, typography. Flows in [screen-flow.md](screen-flow.md); components in
[component-index.md](component-index.md). Follows the wecms-web CLAUDE.md §3a (Settings panel
composition) + §3b (Settings UI consistency) rules.

---

## 1. Layout (`VasAccountPanel`)

```
┌─ <SettingsModal> card (1300×760) ──────────────────────────── Esc/X (top-4 right-4) ─┐
│ ┌─ Header (shrink-0, px-8 pb-5 pt-14 pr-24) ───────────────────────────────────────┐ │
│ │  VAS Account                       (text-wb-18 font-semibold tracking-wb-tight)   │ │
│ │  <description>                     (mt-1 text-wb-13 text-wb-muted)                 │ │
│ └───────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Filter row (shrink-0, px-8) ─────────────────────────────────────────────────────┐ │
│ │  [ <SearchInput> ]            [☑ Active] [☑ Inactive] [Excel Upload] [+ Add VAS …] │ │
│ └───────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Scroll region (min-h-0 flex-1, custom-scrollbar) ───────────────────────────────┐ │
│ │  <VasAccountTable>  (table-fixed, min-w 1000px)                                    │ │
│ └───────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

- The "Add" / "Excel Upload" actions live in the **filter row** (right group), not a separate header
  action button.
- No pagination row (panel loads the full filtered set, `all: true`).

## 2. Filters

| Control | Component | Values | Default |
|---|---|---|---|
| Keyword | shared `<SearchInput>` | free text → `search_wd` | empty |
| Active | local `CheckboxOption` | on → include `"A"` | **checked** |
| Inactive | local `CheckboxOption` | on → include `"I"` | **checked** |

Both unchecked → empty list, no wire call. No parent filter, no status dropdown.

## 3. Grid columns (`VasAccountTable` + `VasAccountTableColumns`)

`table-fixed`, colgroup **220 / 600 / 120 / 60 px** (sum = `VAS_ACCOUNT_TABLE_MIN_WIDTH` 1000px).

| # | Header | i18n key | Field / rendering |
|---|---|---|---|
| 1 | VAS Code | `settings.vas_account.col.code` | `row.vasCode` — **bold** for parent rows, `pl-9` indented (no chevron) for child rows |
| 2 | VAS Account Name | `settings.vas_account.col.name` | `row.accountName` — bold for parents, medium for children |
| 3 | Status | `settings.vas_account.col.status` | pill badge — active: `bg-brand-softer text-brand-active`; inactive: `bg-wb-status-rejected-bg text-wb-status-rejected-text`; label `t(row.statusKey ?? settings.vas_account.status.${row.status})` |
| 4 | (actions) | `settings.vas_account.col.actions` (aria only) | three-dot kebab → `VasAccountRowMenu` (Edit / Delete) |

- **No sorting** — headers are display-only (no sort glyph, no click handler).
- **No selection checkbox**, **no display-order column**.
- **Hierarchy rendering is display-only.** `row.kind` is `parent` or `child`. Parent rows show a
  `ChevronsUpDown` toggle button (`onToggleParent`), but the panel does **not** pass that handler — the
  chevron is **inert**; expand/collapse is not implemented and all rows always render. The two-level
  grouping is computed by `buildTree` from `vas_acct_cd` prefixes (≥ 3 chars), not from any backend
  parent field.

## 4. Sorting / pagination

- **Sorting:** none (display-only headers).
- **Pagination:** none (`all: true`).

## 5. Create / Edit dialog (`AddVasAccountDialog`)

shadcn `<Dialog>`, `stackLevel={2}`, `max-w-[400px] rounded-2xl`. Title `add_dialog.title` /
`edit_dialog.title`.

| Field | Required | Control | Validation (Zod `vasAccountSchema`) |
|---|---|---|---|
| VAS Code | yes (`*`) | `TextInput` | trim, `min(3)`/`max(15)`, `^[A-Za-z0-9_]+$` |
| VAS Account Name | yes (`*`) | `TextInput` | trim, `min(1)`, `max(50)` |
| Status | — | two `RadioPill` (Active / Inactive) | enum `["active","inactive"]` |

- English Name, Type, and Notes are **not rendered** (PO call). The wire create payload omits them
  (`toCreateRequest` → `{ vas_acct_cd, vas_acct_nm, stts }`).
- Validation surfaces the first Zod issue via a shared **error** dialog; fields show only an
  `aria-invalid` ring (no inline per-field message).
- Submit button: `add_dialog.add` / `add_dialog.update`, `add_dialog.saving` while submitting.

## 6. Excel Upload modal (`ExcelUploadDialog`)

Thin wrapper around the shared `components/shared/excel-upload/ExcelUploadDialog.tsx` (`stackLevel 2`,
`rounded-md`). Supplies columns (VAS Code 220px, VAS Account Name 600px), translated chrome, the
upload-option step (Add New / Reset-and-replace), and handlers. Completed / Error count chips; Upload
disabled when no preview / 0 rows / errors / busy. Brand-green Excel-action chip `bg-[#1f7a4d]`
(documented exception). No export button.

## 7. Loading / empty / error states

| State | Behaviour |
|---|---|
| Loading | `useStickyLoading` smooths the flag; grid area shows `settings.vas_account.loading` |
| Empty (`rows.length === 0`) | `settings.vas_account.empty` ("No Data Found") |
| Error | `useDialog({ type: "error", errorCode })` from `error.code` — never warning chrome for API/validation failures (project rule) |

## 8. Typography tokens (no raw px)

Page title `text-wb-18 font-semibold tracking-wb-tight text-wb-dark`; description
`text-wb-13 text-wb-muted`; table header `text-wb-13 font-semibold text-wb-dark`; body cells
`text-wb-13`; status pill via brand/status tokens; dialog title `text-wb-18`; form labels/inputs
`text-wb-13`/`text-wb-14`. The only inline-hex is the sanctioned Excel-action green
`bg-[#1f7a4d]` / `hover:bg-[#196439]` (CLAUDE.md §3b exception table). No `text-[Npx]` / `font-[N]` /
inline `style` font properties.

## 9. i18n

All strings under `settings.vas_account.*` and `settings.nav.vas_account`, present in `en/ko/vi.json`
(80 keys each). No `km.json` (Khmer not yet supported).

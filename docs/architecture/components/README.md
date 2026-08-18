# components/

Component architecture for `wecms-web`. Verified against source 2026-08-17.

**Normative rules live in [`../../../CLAUDE.md`](../../../CLAUDE.md)** — §"Shared UI Component
Architecture", §"Shared / Common Code Rules" (the two-call rule), §7a/§7b (table + report shells),
and §13/§13a/§13b/§13c (View Setting, sort, export, column widths). This page is the inventory and
the entry point; it does not restate those rules.

## Where components live

| Layer | Path | Contents |
|---|---|---|
| shadcn primitives | [`components/ui/`](../../../components/ui/) | 7 editable copies (button, card, checkbox, dialog, input, label, table). Add via `npx shadcn@latest add`. |
| Shell / chrome | [`components/layout/`](../../../components/layout/) | 16 files — `AppShell`, `Header`, `HeaderIcons`, `Sidebar`, `SidebarMenuItem`, `sidebarNav.ts`, `ProfileMenu`, … |
| Cross-feature shared | [`components/shared/`](../../../components/shared/) | 36 top-level components + 9 sub-modules |
| Per-feature | `components/{feature}/{screen}/` | banking · payment · addon · settings · auth |

The folder map is **closed**: no `utils/`, `services/`, `helpers/`, or a second `shared/` at the repo
root.

### `components/shared/` sub-modules

`approver/` · `attachment/` · `dialog/` (the `useDialog()` system-dialog surface) · `excel-upload/`
(the one sanctioned Excel-upload shell) · `icons/` · `memo/` (shared memo drawer, used by
Transaction History **and** Card Transactions) · `modal-form/` · `popups/` · `view-setting/`
(popover + hook + colgroup + width helpers).

## The load-bearing shared components

Reach for these before writing anything new — a second consumer is the trigger to extract, not the
third.

| Concern | Component |
|---|---|
| Page shell / header / toolbar | `PageLayout` · `PageHeader` · `PageActionButtons` |
| Paginated list | `DataTableShell` + `DataTableFooter` + `Pagination` |
| Report body (no pagination) | `ReportLayout` |
| Table header + sort glyph | `TableHeaderCell` |
| Column visibility / order / width | `view-setting/` — `ViewSettingPopover`, `ViewSettingColgroup`, `useViewSetting`, `columnWidth.ts` |
| Filters | `FilterRow` · `FilterDropdown` · `SearchInput` · `DateRangePicker` · `DateField` · `CalendarIconButton` · `SearchSelect` |
| System dialogs | `dialog/` → `useDialog()` — 4 variants, never a bespoke copy |
| Excel upload | `excel-upload/ExcelUploadDialog` |
| Memo drawer | `memo/MemoDrawer` |
| Long-text truncation | `EllipsisTooltip` |

## Cross-page UI standard

[main-page-ui-rule.md](main-page-ui-rule.md) — the layout, typography, control, table, card,
spacing, and icon rules of a standard menu/list main page, extracted verbatim from the approved
Account Inquiry (VND) baseline. It is a **read-only reference**: it introduces no tokens, no
components, and mandates no edits to existing pages. *(Moved here from the Account Inquiry feature
folder on 2026-08-17 — it is a cross-page standard, not one screen's spec.)*

## Two known-good table patterns

Both are valid; the choice is documented per PR:

- **shadcn `<Table>`** when there is no summary row and no shared colgroup is needed.
- **Bare `<table>` + shared `<colgroup>`** when the table has a footer summary row — the footer is a
  sibling `<table>` importing the same colgroup, so `mt-auto` can anchor it.

## Related

- Per-screen component inventories: each feature's `component-index.md` under [../../features/](../../features/)
- Hooks: [../hooks/](../hooks/) · State: [../state-management/](../state-management/) · Routes: [../routes/](../routes/)
- Design tokens: `app/globals.css` `@theme inline` (consume via `text-wb-*`, never raw px)

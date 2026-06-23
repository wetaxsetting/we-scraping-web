# Excel Export — UI Specification

**Part of:** Common → excel-export
**Last verified:** 2026-06-23

The Excel export has **no UI of its own** — it is one icon button in the shared
[`<PageActionButtons>`](../../../../components/shared/PageActionButtons.tsx)
toolbar plus the browser's native download. There is no modal, no progress bar,
no preview.

## Toolbar Excel icon (`PageActionButtons.tsx:112-129`)

| Property | Value | Source |
|---|---|---|
| Asset | `/assets/common/ico-excel.svg` (never a lucide substitute) | `:123` |
| Icon size | `size-5` (20px) — toolbar standard | `:126` |
| Button class (idle) | `flex items-center justify-center rounded-md p-1 hover:bg-black/5 cursor-pointer` | `:69-72` |
| Button class (exporting) | `… cursor-wait opacity-60` (no `cursor-pointer`) | `:71` |
| `aria-label` | `t("common.export_excel")` | `:115` |
| `aria-busy` | `true` while `exporting`, else undefined | `:116` |
| `disabled` | `exporting` | `:118` |
| Handler | `onExport` (no-arg) | `:117` |

## Opt-in rendering

- `showExcel` defaults to `false`; the whole toolbar returns `null` when no
  `show*` flag is set (`PageActionButtons.tsx:55-67`). Detail pages declare
  `showList` only; list pages declare `showList showPrint showExcel`.
- The icon group is `flex items-center gap-1` (`:75`).

## Exporting state (shared with Print)

`exporting` is an opt-in prop (default `false`). When `true`:

- Print **and** Excel buttons are `disabled`, dim (`opacity-60`), and show
  `cursor-wait` so a duplicate download can't fire on a fast resolve
  (`PageActionButtons.tsx:69-72, :94-129`).
- List stays clickable — it opens a local popover, not an API call
  (`PageActionButtons.tsx:30-37, :76-93`).

## Placement

The toolbar sits in the page-header right-action slot (title row), per
`wecms-web/CLAUDE.md` §6a / §11 — never duplicated in the filter row. The Excel
button is one of the three standard icons (list · print · excel), all from
`/assets/common/` at `size-5` (CLAUDE.md §6b).

## Typography / tokens

No export-specific typography. The button inherits the shared toolbar chrome;
the in-sheet title + headers are produced server-side (see backend twin
functional-specification), so the frontend ships no font/size for the workbook.

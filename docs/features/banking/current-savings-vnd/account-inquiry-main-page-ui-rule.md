# Account Inquiry (VND) — Main Page UI Rule

> **Status:** Reference rule for future reuse. Extracted verbatim from the
> live Account Inquiry (VND) implementation. This document does **not**
> change any page; it codifies the existing format so new main pages can
> match it.

---

## 1. Purpose

Account Inquiry (VND) is the **approved baseline for standard menu/list main
pages** in `wecms-web` (CLAUDE.md → "UI Implementation Baseline", reference
#1). This document captures its exact layout, typography, control, table,
card, spacing, and icon rules so that:

- future main pages reproduce the same look without per-page drift, and
- UI-normalization tasks have a single, concrete reference to align against.

It is a **read-only reference**. It introduces no new tokens, no new
components, and mandates no edits to existing pages.

---

## 2. Source Page and Related Files / Components

**Route:** `/banking/account-inquiry` · **Scope:** VND main page only.

| Path | Component | Purpose |
|---|---|---|
| `app/(dashboard)/banking/account-inquiry/page.tsx` | `BankingAccountInquiryPage` | Thin route page → `<AccountInquiryClient currency="VND" />` |
| `app/(dashboard)/banking/account-inquiry/AccountInquiryClient.tsx` | `AccountInquiryClient` | Data wiring (fetch, sort, server paging) |
| `components/shared/AccountInquiryPage.tsx` | `AccountInquiryPage` (+ local `SummaryTile`, `BankFilterPopover`, `CurrencyFilterPopover`, `LastUpdateCell`) | Full page composite |
| `components/shared/PageLayout.tsx` | `PageLayout` | Full-height flex column + page gutters |
| `components/shared/PageHeader.tsx` | `PageHeader` | Title row + right action slot |
| `components/shared/PageActionButtons.tsx` | `PageActionButtons` | List / Print / Excel icon group |
| `components/shared/FilterDropdown.tsx` | `FilterDropdown` | Bank / currency filter trigger |
| `components/shared/DateField.tsx` | `DateField` | Inquiry-date chip + calendar popup |
| `components/shared/SearchInput.tsx` | `SearchInput` | Keyword search field |
| `components/shared/DataTableShell.tsx` | `DataTableShell` | Scroll container + pagination anchor (`footerMode="paginationOnly"`) |
| `components/shared/TableHeaderCell.tsx` | `TableHeaderCell` | Sortable `<th>` with glyph |
| `components/shared/Pagination.tsx` | `Pagination` + `usePagination` | Page-size dropdown + arrows + page buttons |
| `components/ui/table.tsx` | `Table*` primitives | `<thead>/<tbody>/<tr>/<th>/<td>` wrappers |
| `components/ui/checkbox.tsx` | `Checkbox` | Row + select-all checkbox |
| `components/ui/input.tsx` | `Input` | Base input used by `SearchInput` |
| `components/shared/view-setting/` | `ViewSettingPopover`, `useViewSetting` | Column visibility/order popover (List icon) |
| `components/banking/account-inquiry/BalancePopover.tsx` | `BalancePopover` | Popup from a Balance link |
| `components/banking/account-inquiry/TransactionSyncDialog.tsx` | `TransactionSyncDialog` | "Update" button popup |
| `app/globals.css` | `@theme inline` tokens | All `--color-*`, `--text-wb-*`, `--w-wb-*`, `--h-wb-*` values |

> Columns are **data-driven** via `COLUMN_REGISTRY` keyed by View Setting
> `FIELD_ID`. `<colgroup>/<thead>/<tbody>` iterate the *visible* columns in
> `DISP_ORD` order; only the leading checkbox column is hardcoded.

---

## 3. Layout Rules

Outer chain (`PageLayout`):

```
<div class="flex min-h-0 flex-1 flex-col">
  <div class="flex min-h-0 flex-1 flex-col gap-5 px-4 md:px-6">   ← 20px gap between blocks
```

- **Page gutters:** `px-4` (16px) mobile → `md:px-6` (24px) desktop.
- **Block rhythm:** `gap-5` (20px) between header / summary / filter / table.
- **Top navigation & sidebar spacing:** owned by `AppShell` / `Header` /
  `Sidebar` chrome — the page never re-mounts them.
- **Page title:** `<h1 class="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">`
  (18px / 600 / `#05111d`).
- **Header row alignment:** `flex flex-wrap items-center justify-between gap-3 pt-4 md:pt-6`;
  right action slot is `flex flex-wrap items-center gap-6`.

**Block order (top → bottom):**
1. `PageHeader` (title + actions)
2. Summary card(s) — toggleable via the Dashboard chip
3. Filter row
4. `DataTableShell` (table + pagination)

---

## 4. Typography Rules

Font family is inherited from `<body>` (Inter / Noto Sans KR). Never override
font-family per cell. Default body text on this page is **13px** (`text-wb-13`).

| Role | Class | Size / line-height | Weight | Color |
|---|---|---|---|---|
| Page title | `text-wb-18 font-semibold tracking-wb-tight text-wb-dark` | 18 / 28 | 600 | `#05111d` |
| Header action button label | `text-wb-14 font-medium` | 14 / 20 | 500 | per element |
| Filter chip / search / date label | `text-wb-14-tight font-medium` | 14 / 16 | 500 | `text-wb-ntrl-8` (#404040) |
| Table header | `text-wb-13 font-semibold text-wb-dark` | 13 / normal | 600 | `#05111d` |
| Table body cell | `text-wb-13 font-medium` | 13 / normal | 500 | `text-wb-ink` (#1b1b1b) |
| Muted sub-line (acct no, Last Update) | `text-wb-13 font-medium text-wb-muted` | 13 | 500 | `#828282` |
| Error tag (Last Update) | `text-wb-13 font-medium text-wb-error` | 13 | 500 | `#f65f19` |
| Summary "Available" label/value | `text-wb-16 font-medium text-black` | 16 / normal | 500 | `#000` |
| Summary "Balance" label/value | `text-wb-13 font-medium text-black opacity-50` | 13 | 500 | black @50% |
| Summary title | `text-wb-12 font-bold text-brand` | 12 / 20 | 700 | `#0060b9` |
| Summary count pill | `text-wb-10 font-bold text-brand` | 10 / 16 | 700 | `#0060b9` |
| Pagination text / page button | `text-wb-13 font-medium text-wb-ink` | 13 | 500 | `#1b1b1b` |

**Forbidden:** `text-[Npx]`, `font-[N]`, `leading-[Npx]`, `tracking-[…]`,
inline `style={{ fontFamily|fontSize|fontWeight|lineHeight }}`. If a size is
missing, add the token to `@theme inline` first.

---

## 5. Button Rules

The page uses bespoke `<button>` elements for its three header actions.

**Dashboard chip (toggle):**
```
flex h-9 cursor-pointer items-center gap-2 rounded-md bg-white px-4
text-wb-14 font-medium text-brand shadow-wb-btn
```
- Height 36px (`h-9`), padding `px-4`, radius `rounded-md` (6px).
- Icon `Eye / EyeOff` `size-5` strokeWidth 1.8 (flips with state).

**Update button (primary / disabled):**
```
flex h-9 items-center gap-2 rounded-md px-4 text-wb-14 font-medium text-white shadow-wb-outline
  enabled:  cursor-pointer bg-brand hover:bg-brand-hover
  disabled: bg-wb-ntrl-4
```
- **Primary** = `bg-brand` (#0060b9) + white text + `hover:bg-brand-hover` (#0152a3).
- **Disabled** = `bg-wb-ntrl-4` (#d4d4d4), no hover, no pointer.

**Toolbar icon buttons (`PageActionButtons`):**
- Group: `flex items-center gap-1`.
- Each: `flex cursor-pointer items-center justify-center rounded-md p-1 hover:bg-black/5`.
- Icon: `<img class="size-5">` (20px) from `/assets/common/` (`ico-list.svg`,
  `ico-print.svg`, `ico-excel.svg`) — never lucide for list/print/excel.

There is no separate secondary/outline button on this page beyond the Update
button's `shadow-wb-outline`.

---

## 6. Input / Select / Search / Date Picker Rules

All filter controls share **height 32px** (`--h-wb-filter-btn`) and `rounded-md`.

**FilterDropdown (Bank / Currency):**
```
flex h-[var(--h-wb-filter-btn)] shrink-0 cursor-pointer items-center justify-between gap-2
overflow-clip rounded-md bg-white px-2 shadow-wb-btn
```
- Label `truncate text-left text-wb-14-tight font-medium text-wb-ntrl-8`.
- Trailing chevron `<img class="size-4">` (`ico-dropdown-chevron.svg`).
- Width on this page `w-[150px]`.
- **Popover:** `custom-scrollbar-y absolute left-0 top-full z-20 mt-1 max-h-64 w-[150px]
  overflow-y-auto overflow-x-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card`.
  Options: `cursor-pointer truncate px-2 py-1.5 text-wb-14-tight font-medium text-wb-ntrl-8 hover:bg-wb-bg-active`;
  selected `bg-wb-bg-active`.

**DateField chip (Inquiry date):**
```
flex h-[var(--h-wb-filter-btn)] items-center gap-2 overflow-clip rounded-md border-0 bg-white shadow-wb-btn p-2
```
- Text `text-wb-14-tight font-medium`; value `text-wb-ntrl-8`, placeholder `text-wb-ntrl-5` (#a3a3a3).
- Sibling `CalendarIconButton` (icon `size-4`). Click on chip or icon opens the
  shared Figma 77:12230 calendar popup.

**SearchInput:**
```
container: h-[var(--h-wb-filter-btn)] w-full md:w-[var(--w-wb-search)]   ← 32px tall, 230px wide on md+
icon:      Search size-4 -translate-y-1/2 text-wb-ntrl-5  (strokeWidth 1.8)
input:     h-full rounded-md pl-8 pr-2 text-wb-14-tight font-medium placeholder:text-wb-ntrl-5
```

> Base `Input` primitive defaults (overridden here) are `h-11 rounded-[6px] px-3 py-3
> text-wb-14 shadow-wb-outline`, focus = `shadow-wb-focus` (2px brand ring). On this
> page the filter controls use `shadow-wb-btn` (raised) at 32px height instead.

**Filter row layout:**
```
flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between
  left:  flex flex-wrap items-center gap-2   (bank dropdown → [currency dropdown] → date field)
  right: SearchInput
```

---

## 7. Table th / tr / td Rules

**Table element:**
```
w-full min-w-[var(--w-wb-table-min)] table-fixed border-collapse   ← min-w 1058px → horizontal scroll
```
Wrapped by `DataTableShell` scroll container: `custom-scrollbar min-h-0 flex-1 overflow-auto`.
`footerMode="paginationOnly"` — **no totals footer** on this page.

**`<thead>` — sticky:** `sticky top-0 z-10`. Header row:
```
h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar
```
- Height **40px**, background **#f5f5f5**, bottom border **#d3d3d3**.
- `<th>` base (`TableHeaderCell`): `overflow-hidden py-3 px-2.5 align-middle text-left|text-right`;
  label `text-wb-13 font-semibold text-wb-dark whitespace-nowrap`.

**`<tr>` (body):**
```
h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0   ← 60px row, #d3d3d3 separator
```

**`<td>`** — vertical-align middle; per-column padding from `COLUMN_REGISTRY`:

| Column | Padding | Body style |
|---|---|---|
| Checkbox | `px-2.5` | `Checkbox` 18px |
| Bank | `py-2.5 pr-2.5` | composite (see below) |
| Account Nickname | `py-2.5 pr-4` | `text-wb-13 font-medium text-wb-dark` |
| Balance | `p-2.5 text-right` | `<button> text-wb-13 font-medium text-brand` (blue, clickable) |
| Available Balance | `p-2.5 text-right` | `text-wb-13 font-medium text-wb-ink` |
| VAS Account | `py-2.5 pr-2.5` | `text-wb-13 font-medium text-wb-muted` (—) |
| Last Update | `py-2.5 pl-4` | muted; error = red tag + muted sub-line |

**Bank cell composition** — `flex flex-col items-start`; row 1 = `flex items-start gap-1`:
`[bankName] [building icon] [VND • type]`, icon `/assets/table/ico-building.svg size-[18px] opacity-50`
(icon sits **between** name and meta); row 2 = account number `text-wb-muted`.

**Checkbox** — base `size-4 rounded-[4px] border border-input bg-background`; sized to
**18px** (`--size-wb-icon-sm`) here. Checked/indeterminate = `bg-brand` + white check/minus.
Disabled rows re-skin to `border-transparent bg-wb-ntrl-4 opacity-100` with a `title` tooltip.
Select-all header checkbox supports the `indeterminate` state.

**Sort glyph** — inactive: `/assets/table/ico-sort.svg h-3 w-2`; active ASC: lucide
`ChevronUp size-3.5 text-brand`; active DESC: `ChevronDown size-3.5 text-brand`. Sortable
headers wrap content in a `<button>` and set `aria-sort`.

**Link / blue number** — the Balance value is the only in-table "blue link":
`text-brand` (#0060b9) on a `cursor-pointer` button opening `BalancePopover`.

---

## 8. Card / Summary Box Rules

`SummaryTile`, container `flex flex-wrap gap-3` (toggled by the Dashboard chip):
```
flex h-[var(--w-wb-summary-h)] w-full max-w-[var(--w-wb-summary)] flex-col justify-between
rounded-md border border-wb-border-sidebar bg-wb-bg-card p-4 md:w-[var(--w-wb-summary)]
```
- **Size:** 308 × 118px (`--w-wb-summary` / `--w-wb-summary-h`), padding `p-4` (16px),
  radius `rounded-md`, border `#e0e0e0`, bg **#fbfbfb**.
- **Title:** `text-wb-12 font-bold text-brand`.
- **Badge / count pill:** `flex items-center rounded-full bg-brand-softer px-1.5 py-0.5`
  → `text-wb-10 font-bold text-brand` (`brand-softer` = brand @15%).
- **Amount ("Available Balance"):** label + value `text-wb-16 font-medium text-black`,
  laid out `flex w-full items-center justify-between`.
- **Muted balance text:** `text-wb-13 font-medium text-black opacity-50`.
- Body block: `flex w-full flex-col gap-2`.

---

## 9. Spacing and Sizing Rules

| Concern | Value |
|---|---|
| Page block gap (header↔summary↔filter↔table) | `gap-5` (20px) |
| Page gutters | `px-4` (16px) → `md:px-6` (24px) |
| Header top padding | `pt-4` (16px) → `md:pt-6` (24px) |
| Header right-slot gap | `gap-6` (24px) |
| Summary cards gap | `gap-3` (12px) |
| Filter row gap | `gap-2` (8px); stacks `flex-col` < md, `md:flex-row md:justify-between` |
| Table shell | `gap-3 pb-3` (12px gap + 12px bottom pad) |
| Filter control height | 32px (`--h-wb-filter-btn`) |
| Header action button height | 36px (`h-9`) |
| Table header height | 40px (`--h-wb-table-head`) |
| Table row height | 60px (`--h-wb-table-row`) |
| Pagination row height | 32px (`h-8`) |
| Column widths | checkbox 38 / Bank 240 / Nickname 280 / Balance 160 / Available 180 / VAS 200 / Last Update 160; table min-w 1058px |
| Search width | 230px (`--w-wb-search`) |
| Page-size dropdown | 62px inert / 80px interactive |
| Summary card | 308 × 118px |

Common padding values: `px-2.5`/`py-3` (table cells/headers), `p-2` (filter chips),
`px-4` (header buttons), `p-4` (summary card), `px-2 py-1.5` (dropdown options).

---

## 10. Icon Rules

| Icon | Size | Source | Notes |
|---|---|---|---|
| Toolbar List / Print / Excel | `size-5` (20px) | `/assets/common/ico-list.svg`, `ico-print.svg`, `ico-excel.svg` | Never substitute lucide |
| Dashboard chip Eye / EyeOff | `size-5` | lucide `Eye` / `EyeOff` (strokeWidth 1.8) | Utility chrome — lucide allowed |
| Bank cell building icon | `size-[18px]` (`--size-wb-icon-sm`), `opacity-50` | `/assets/table/ico-building.svg` | Sits between bank name and meta |
| Sort glyph (inactive) | `h-3 w-2` | `/assets/table/ico-sort.svg` | — |
| Sort glyph (active) | `size-3.5 text-brand` | lucide `ChevronUp` / `ChevronDown` | Brand-colored |
| Filter dropdown chevron | `size-4` | `/assets/pagination/ico-dropdown-chevron.svg` | — |
| Calendar trigger | `size-4` | `CalendarIconButton` (`/assets/common/ico-calendar-outline.svg`) | Shared component |
| Search glyph | `size-4 text-wb-ntrl-5` | lucide `Search` (strokeWidth 1.8) | — |
| Pagination arrows | `size-4` | `/assets/pagination/ico-arrow.svg`, `ico-skip-arrow.svg` | Inside `size-7` buttons |
| Checkbox | `size-[18px]` | shadcn/Radix `Checkbox` | — |

**Alignment:** icons are flex children aligned with their text (`items-center`/
`items-start gap-1`). **Color usage:** brand (#0060b9) for active/interactive glyphs;
muted/neutral (`text-wb-ntrl-5`, `opacity-50`) for passive glyphs. Named business
icons come from `public/assets/`; generic chrome glyphs may use lucide.

---

## 11. Reusable Components / Classes / Tokens

**Tokens (from `app/globals.css` `@theme inline`):**
- **Colors:** `brand #0060b9`, `brand-hover #0152a3`, `brand-active #0069b9`,
  `brand-soft #f0f7ff`, `brand-softer rgba(0,96,185,.15)`, `wb-dark #05111d`,
  `wb-ink #1b1b1b`, `wb-ntrl-8 #404040`, `wb-ntrl-6 #737373`, `wb-muted #828282`,
  `wb-ntrl-5 #a3a3a3`, `wb-ntrl-4 #d4d4d4`, `wb-table-border #d3d3d3`,
  `wb-bg-active #e3e3e3`, `wb-border-sidebar #e0e0e0`, `wb-bg-sidebar #f5f5f5`,
  `wb-bg-card #fbfbfb`, `wb-error #f65f19`.
- **Text:** `text-wb-10/11/12/13/14/14-tight/15/16/18`; tracking `tracking-wb-tight` (-0.01em).
- **Shadows:** `shadow-wb-btn` (raised button), `shadow-wb-outline` (1px #d4d4d4),
  `shadow-wb-card` (1px #e0e0e0), `shadow-wb-focus` (2px brand ring).
- **Sizes:** `--h-wb-filter-btn 32`, `--h-wb-table-head 40`, `--h-wb-table-row 60`,
  `--size-wb-icon-sm 18`, `--w-wb-search 230`, `--w-wb-summary 308` / `--w-wb-summary-h 118`,
  `--w-wb-col-*`, `--w-wb-table-min 1058`, `--w-wb-page-size 62`.

**Shared components consumed:** `PageLayout`, `PageHeader`, `PageActionButtons`,
`FilterDropdown`, `DateField`, `SearchInput`, `DataTableShell`, `TableHeaderCell`,
`Pagination` / `usePagination`, `ViewSettingPopover` / `useViewSetting`, and the
`Table*` + `Checkbox` + `Input` shadcn primitives.

**Pagination chrome (`Pagination`):**
- Row `flex h-8 items-center justify-center md:justify-between`.
- Page-size dropdown `flex h-8 items-center gap-2 rounded-md border border-wb-ntrl-4 bg-white px-2`
  + `text-wb-13 font-medium text-wb-ink` + chevron `size-4`.
- Arrow buttons `size-7 rounded-md border border-wb-ntrl-4 bg-white text-wb-ink hover:bg-neutral-50`;
  disabled `opacity-40`; icons `size-4`.
- Page buttons `size-7 rounded-md text-wb-13`; active `border border-wb-ink bg-white font-bold`,
  inactive `font-medium hover:text-brand`.
- Count label `text-wb-13 font-medium text-wb-ink` (`common.showing_of`). Hidden on mobile (< md).
- `PAGE_SIZE_OPTIONS = [10, 20, 50, 100]`, default `10`. Use `usePagination` — never hand-roll.

---

## 12. Rules for Reusing This Style in Other Main Pages

1. **Compose the shells, don't rebuild them.** `<PageLayout>` → `<PageHeader>` →
   filter row → `<DataTableShell footerMode="paginationOnly|paginationWithTotals">`.
   The shell owns the scroll container, `mt-auto` footer anchor, and `gap-3 pb-3`
   bottom rhythm.
2. **Filter controls are all 32px / `rounded-md` / `shadow-wb-btn`.** Dropdowns →
   `FilterDropdown`; dates → `DateField`; keyword → `SearchInput`. No native
   `<select>` / `<input type="date">`.
3. **Header actions:** icons via `PageActionButtons` (`size-5` SVGs from
   `/assets/common/`, never lucide for list/print/excel); primary button =
   `h-9 px-4 rounded-md bg-brand text-white text-wb-14 font-medium`, disabled `bg-wb-ntrl-4`.
4. **Table typography is 13px throughout** — pass `textSizeClass="text-wb-13"` to
   `TableHeaderCell`; header `font-semibold text-wb-dark`, body `font-medium text-wb-ink`,
   muted sub-lines `text-wb-muted`. Header bg `bg-wb-bg-sidebar`, height 40px; rows 60px
   with `border-b border-wb-table-border`.
5. **Use the shared `Checkbox`** at `size-[var(--size-wb-icon-sm)]` (18px); support the
   `indeterminate` state for "select all".
6. **Blue clickable values** (like Balance) = `text-brand` on a `cursor-pointer` button —
   the only sanctioned in-table link color.
7. **Summary tiles:** 308×118 card, `bg-wb-bg-card`, `border-wb-border-sidebar`,
   `rounded-md p-4`; title `text-wb-12 font-bold text-brand` + count pill
   `bg-brand-softer / text-wb-10`.
8. **Pagination** is always `<Pagination>` + `usePagination` (`size-7` buttons,
   `PAGE_SIZE_OPTIONS`, default 10). Never hand-roll.
9. **Never** introduce `text-[Npx]` / `font-[N]` / inline font `style`; extend
   `@theme inline` tokens first. Use `cn()` for class composition.
10. **Popovers** (bank/currency pattern): `absolute top-full z-20 mt-1 rounded-md
    border border-wb-ntrl-4 bg-white shadow-wb-card custom-scrollbar-y`; options
    `px-2 py-1.5 text-wb-14-tight font-medium text-wb-ntrl-8 hover:bg-wb-bg-active`.
11. **Column visibility/order, table sort, print, and Excel export** are global shared
    features — route through `useViewSetting` (§13), `useTableSort` (§13a),
    `printReport` (§6d), and `useExcelExport` (§13b) per CLAUDE.md. Do not build
    page-local versions.

---

## 13. Important Restriction

- **This rule is for future reuse only.** It is a reference document, not a
  change order.
- **Do not automatically change existing completed pages.** Pages that predate or
  already match this baseline are left untouched. They migrate only during their
  own explicitly-scoped stabilization pass.
- **Apply this rule only when a new task explicitly requests** UI normalization or
  a new main-page implementation. Absent such a request, do not refactor existing
  UI to conform to this document.
- This document changes **no UI code, no API, and no business logic** — it
  documents the existing Account Inquiry (VND) format only.

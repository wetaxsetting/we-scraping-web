# Cash Flow UI — Figma Parity Audit

- **System:** Refactor (wecms-web frontend)
- **Screen:** Banking > Reports > Cash Flow (`/banking/reports/cash-flow`)
- **Figma:** node `291:9448` — file `yLmjEwaRqjzOSlGB4pX2xH` ("Banking → Cash Flow")
- **Date:** 2026-07-01
- **Scope:** UI / visual refinement only. No backend, API, SQL, DTO, mapper, calculation, search, pagination, or Excel-export logic changed.

## Summary

The Cash Flow report table was rendered as a full cell-grid (every `<td>`/`<th>`
carried a 4-side `border-wb-ntrl-3`), which did not match the Figma. It has been
reworked to the Figma "clean" treatment: horizontal row separators only, with
vertical dividers restricted to the frozen sticky-left columns. Summary-band
colours, row heights, cell padding, and font weights were aligned to the Figma
spec (extracted from Figma node `291:9725` "Datables").

## Files changed (this task only)

| File | Change |
|---|---|
| [components/banking/reports/cash-flow/CashFlowPage.tsx](../../components/banking/reports/cash-flow/CashFlowPage.tsx) | All table-body / header / summary-band / empty-state styling (borders, backgrounds, row height, padding, font weight, END BALANCE band). |
| [app/globals.css](../../app/globals.css) | **One additive line** — new token `--color-wb-status-profit-bg: #dcfce7;` (WB365 green-02) for the SALES / NON SALES PROFIT bands. No existing token/rule modified. |

> The other files present in the working tree (`daily-cash/*`, `daily-financial*/*`,
> `payment/*`, `lib/api/*`, `locales/*`, etc.) are **pre-existing uncommitted work
> from unrelated tasks** and were **not** touched by this task.

## Audit checklist

| Check | Result |
|---|---|
| No unnecessary table borders remain | ✅ Full-grid removed. Cells carry `border-b` (`wb-ntrl-4` = `#d4d4d4`) only; vertical dividers via `[&_td.sticky]/[&_th.sticky]:border-r` on frozen columns only. No `border-wb-ntrl-3` / 4-side `border` left in the file. |
| Sticky columns align while scrolling | ✅ `<colgroup>` widths + `STICKY_OFFSETS` unchanged; sticky cells keep their `left:` offsets and opaque backgrounds (`bg-white` / `bg-wb-bg-card`), so month cells scroll cleanly beneath them. |
| No row-height regressions | ✅ Data / band rows intentionally raised `h-9` (36px) → `h-12` (48px) per Figma; header stays `--h-wb-table-head`. Consistent across data rows, empty-state rows, and all summary bands. |
| Header columns align with body columns | ✅ Header padding raised `px-2.5` → `px-4` to match body `px-4`; both bind to the same `<colgroup>`. "Opening Balance" merged header cell (colspan 3) intentionally shows no internal dividers while the body shows the 5 sub-columns — matches Figma/legacy. |
| Summary rows match Figma | ✅ S.TOTAL `bg-brand-soft` (`#f0f7ff`); SALES / NON SALES PROFIT `bg-wb-status-profit-bg` (`#dcfce7`); END BALANCE `#16a34a` white text. Labels centered, values right-aligned, `font-semibold`, all `h-12`. |
| Empty-state layout matches Figma | ✅ 8 placeholder rows retain 5 sticky columns + month cells, inherit the clean border scheme and `h-12` height; structure/merged-cell chrome preserved. |
| No CSS impact on Daily Cash / Daily Financial | ✅ Only `globals.css` is shared, and the change is a **new** token not referenced by those pages. The tokens Cash Flow stopped using (`wb-status-approved-bg`, `wb-status-progress-bg`) were **not** removed and remain in use by other components. |
| No dead CSS / classes introduced | ✅ No new unused classes. `cf-scrollbar` is pre-existing (defined in `globals.css`, still used). New `wb-status-profit-bg` token is consumed. Full-grid border utilities removed. |
| Type-check | ✅ `npx tsc --noEmit` → exit 0. |

## Border scheme (final)

```
table: [&_td]:border-b [&_td]:border-wb-ntrl-4   (horizontal row separators, #d4d4d4)
       [&_th]:border-b [&_th]:border-wb-ntrl-4
       [&_td.sticky]:border-r [&_td.sticky]:border-wb-ntrl-4   (frozen-column dividers only)
       [&_th.sticky]:border-r [&_th.sticky]:border-wb-ntrl-4
month data cells: border-b only — NO vertical grid lines between months.
```

## Remaining intentional deviations

1. **Font size `text-wb-13` (13px), not Figma's 14px.** The Cash Flow Figma renders
   the table at 14px, but the project's hard table-typography rule
   (CLAUDE.md §5 / §7 — "all table components use `text-wb-13`") governs, and the
   sibling report pages (Daily Cash, Daily Financial) use 13px. Kept 13px for
   consistency; deviation is intentional. Font **weights** do follow Figma
   (amounts `font-normal`, category cells `font-medium`, summary/headers
   `font-semibold`).
2. **Pre-existing redundant `border-r border-wb-table-border` on some sticky cells.**
   Left in place (not introduced by this task); the global `.sticky` rule overrides
   their colour to `wb-ntrl-4`, so they are visually consistent and harmless.
   Not removed per the "change only what's broken" rule.
3. **END BALANCE band colour is an inline `#16a34a`** (matches Figma exactly and
   pre-dates this task; a `wb-tab-count-success` token of the same value exists but
   was left as-is to avoid unrelated churn).

## Round 2 (2026-07-01) — header border cleanup + tbody row-alignment fix

A follow-up review (against the Figma high-res render of node `291:9725` and the
legacy `test.wecms.vn/cash_0001_001.act` layout) flagged two remaining issues:

1. **Header month labels** — must stay clean (no vertical grid lines), matching
   the Figma.
2. **Tbody month area looked like a detached empty panel** — with all-zero data,
   the month cells rendered blank and, because they carried only a faint bottom
   border and no vertical borders, the whole month region read as an empty void
   disconnected from the gridded left/frozen columns. Rows did not visually align
   left-to-right.

### Root cause

The Figma mockup fills every month cell with sample amounts, so the month area
reads as a connected grid even without vertical borders. The real screen renders
zero amounts as blank cells (legacy `fmtAmt` parity — intentional, unchanged), so
with no vertical structure the empty month cells looked detached. The legacy
system (the stated layout reference) renders the month cells with the **same grid
structure as the frozen columns**.

### Fix (UI only)

- **Tbody month cells now carry a light vertical divider** (`border-r border-wb-ntrl-4`
  = `#d4d4d4`) so each data row "follows the same row structure as the left side"
  and the month area reads as an aligned grid, not a detached panel. Applied to:
  - Level-3 data-row month cells ([CashFlowPage.tsx:975](../../components/banking/reports/cash-flow/CashFlowPage.tsx))
  - the empty-L2 fallback month cells (line 884)
  - the empty-state placeholder month cells (line 736)
- **Header month cells left clean** — no vertical borders (matches Figma; issue #1).
- **Summary bands (S.TOTAL, SALES PROFIT, NON SALES PROFIT, END BALANCE) left
  smooth** — their month cells intentionally have **no** vertical dividers so each
  band renders as one full-width coloured span (matches Figma bands).
- **No double borders** at the frozen ↔ scrollable boundary: the `itemNm` sticky
  cell owns the single divider (`border-r`); the first month cell has no
  `border-left`.

### Resulting border model

| Region | Horizontal (`border-b`) | Vertical (`border-r`) |
|---|---|---|
| Header — frozen cells | ✅ `wb-ntrl-4` | ✅ `wb-ntrl-4` (sticky rule) |
| Header — month labels | ✅ `wb-ntrl-4` | ❌ clean |
| Body — frozen cells | ✅ | ✅ (sticky rule) |
| Body — month data / empty cells | ✅ | ✅ `wb-ntrl-4` (added round 2) |
| Summary bands (all month cells) | ✅ | ❌ smooth full-width span |

### Round-2 checklist

| Check | Result |
|---|---|
| Header borders match Figma / no unnecessary header grid lines | ✅ Month labels clean; only frozen-column dividers remain. |
| No double borders between sticky & scrollable columns | ✅ Single divider owned by `itemNm` sticky cell. |
| Tbody rows align across frozen + scrollable columns | ✅ Month cells now share the left grid; rows read row-by-row. |
| Month area not a detached empty panel | ✅ Light grid makes empty cells read as aligned rows. |
| Amounts render in the correct row | ✅ Month cells are in the same `<tr>` as the left cells (unchanged). |
| Blank cells preserve row height / alignment | ✅ `h-12` + padding + grid borders keep empty cells sized. |
| Summary rows span full table width | ✅ S.TOTAL / SALES PROFIT / NON SALES PROFIT / END BALANCE render as full-width bands. |
| END BALANCE aligns across the full row | ✅ Separate sibling table shares the identical `<colgroup>`. |
| Type-check | ✅ `npx tsc --noEmit` → exit 0. |

> **Note on Figma vs. legacy:** the Figma omits month-column vertical borders (its
> cells are data-filled), while the legacy screen shows them. Per the task's
> instruction to use the legacy layout as the behavioural reference and to make the
> month area "follow the same row structure as the left side," light vertical
> dividers were added to the **body data cells only** — the header stays clean per
> issue #1 and the coloured summary bands stay smooth per the Figma.

## Round 3 (2026-07-01) — top filter/search bar + Download Excel button

Reviewed against **Figma node `291:9648`** (the filter bar) and its parent title
row **`291:9647`**. The page spacing was already correct (shared `PageLayout`
`gap-5` = 20 px and `PageHeader` `pt-6` = 24 px match the Figma 20/24 px), so the
work was the filter container, its controls, and the Download Excel button.

### Top filter layout fixed ([CashFlowPage.tsx](../../components/banking/reports/cash-flow/CashFlowPage.tsx))

- **Container** `291:9648`: was `rounded-md bg-wb-bg-card px-4 py-2.5 shadow-wb-btn`
  → now `rounded-[12px] border border-wb-ntrl-4 bg-wb-bg-footer p-4` (12 px radius,
  `#fafafa` bg, 1 px `#d4d4d4` border, 16 px padding, **no shadow** — border only,
  per Figma).
- **Gaps**: restructured to the Figma nesting — a 16 px gap (`gap-4`) between the
  "Exchange Rate" label and the controls group, and an 8 px gap (`gap-2`) between
  the controls (was a flat 10 px gap).
- **Exchange Rate label**: 14→16 px (`text-wb-16 font-semibold`) per Figma.
- **Exchange Rate input**: `h-7`→`h-8` (32 px), `w-[200px]`→`w-[197px]`,
  `rounded-md`→`rounded-sm` (6 px), border removed in favour of the Figma hairline
  ring `shadow-wb-outline` (`0 0 0 1px #d4d4d4`), text left-aligned, `text-wb-14
  font-medium text-wb-ntrl-8` (`#404040`).
- **Currency / Year / Period / Bank controls**: kept the shared `FilterSelect` /
  `BankFilterPopover` (32 px height + `shadow-wb-btn` already matched Figma); added
  `rounded-sm border-0` to each `triggerClassName` so their radius (6 px) and
  shadow-only edge match Figma. **Per-usage overrides only — the shared components
  are unchanged, so no other page is affected.**
- **Search button**: `px-5`→`px-2`, `rounded-md`→`rounded-sm`, solid border removed
  (keeps `shadow-wb-btn` ring), `h-8`, `min-w-8`, `gap-1`, `justify-center` — matches
  the Figma "Button: Single".

### Download button alignment fixed (title row `291:9647`)

- The Download Excel button was `h-9 gap-2 px-4` with a `size-5` icon and the
  shadcn `outline` border → now `h-8 gap-1 px-2 rounded-sm border-0 bg-white
  shadow-wb-btn` with a `size-4` icon, matching the Figma "Button: Single"
  (white chip, 6 px radius, 3-layer button shadow, 4 px icon gap, 14 px medium
  label). The icon dropped to `size-4` (16 px) because a 20 px icon cannot fit a
  32 px-tall button at 8 px padding; this is the size the Figma node specifies.
- Title row spacing (`pt-6` = 24 px) and title typography (`text-wb-18
  font-semibold`) already came from the shared `PageHeader` and match Figma.

### Round-3 checklist

| Check | Result |
|---|---|
| Top filter/search area matches Figma | ✅ Container bg/border/radius/padding/no-shadow + label & control gaps + control sizing all aligned to node `291:9648`. |
| Download Excel button matches Figma | ✅ `h-8` white chip, 6 px radius, `shadow-wb-btn`, `size-4` icon, `gap-1`, 14 px medium. |
| Page title spacing matches Figma | ✅ Shared `PageHeader pt-6` (24 px) + `PageLayout gap-5` (20 px) already match. |
| Table rendering unaffected | ✅ No tbody/table/colgroup/summary/END-BALANCE code touched — only the header + filter block. |
| Shared components unchanged | ✅ `FilterSelect`, `BankFilterPopover`, `PageHeader`, `PageLayout`, `Button` untouched; only per-usage `className` / `triggerClassName` props passed. |
| Type-check | ✅ `npx tsc --noEmit` → exit 0. |

### Round-3 intentional notes

- **`rounded-[12px]` on the filter container** — the radius scale has no 12 px token
  (`sm` 6 / `md` 8 / `lg` 10 / `xl` 14); the arbitrary value matches the Figma exactly
  and follows the existing `SettingsModal` `rounded-[12px]` precedent.
- **`bg-wb-bg-footer`** (`#fafafa`) is reused as the container background because it
  is the only token carrying the exact Figma `#fafafa`; visually identical to the
  previous `#fbfbfb` but exact to spec.
- **Download Excel icon `size-4`** deviates from the general `size-5` report-toolbar
  icon convention (§6b) because this Figma button node specifies a 16 px icon and a
  20 px icon does not fit the 32 px button height.

## Round 4 (2026-07-01) — profit-band background + lighter month grid

### 1. SALES PROFIT / NON SALES PROFIT continuous green band — fixed

**Root cause found:** round 1 introduced a new `@theme` token
`--color-wb-status-profit-bg: #dcfce7` and used `bg-wb-status-profit-bg` on the
green bands. In the running dev environment that utility **never compiled** —
grep of the built CSS (`.next/dev/static/chunks/*.css`) showed no `#dcfce7` and no
`bg-wb-status-profit-bg` rule. Tailwind 4 + turbopack does not always regenerate
utilities from an `@theme` addition without a dev-server restart, so the class was
inert and the band cells rendered with **no background (white)**. (The END BALANCE
band was unaffected because it uses an inline `#16a34a`, bypassing the token
system.)

**Fix:**
- Replaced `bg-wb-status-profit-bg` with the arbitrary value **`bg-[#dcfce7]`** on
  the ProfitBand `<tr>`, its label cell, and every month cell — arbitrary values
  are generated from component scanning (HMR-reliable, unlike `@theme` additions)
  and are the exact Figma green. Consistent with the existing inline `#16a34a`
  END-BALANCE precedent in this file.
- Removed the now-unused `--color-wb-status-profit-bg` token from
  [globals.css](../../app/globals.css) (dead-token cleanup).
- Result: the SALES PROFIT and NON SALES PROFIT (green) rows are now a single
  continuous `#dcfce7` band across every column — no white cells.
- The pale-blue S.TOTAL band (`bg-brand-soft` `#f0f7ff`, a pre-existing/compiled
  token) and the blue ACC-03 "NON SALES PROFIT" subtotal band are unchanged — they
  render correctly and match the Figma S.TOTAL styling (legacy duplicate-render
  parity retained; not a green band by design).

### 2. Month grid weight reduced (open, not boxed) — fixed

Round 2 had added `border-r border-wb-ntrl-4` (`#d4d4d4`) vertical dividers to the
body month cells to stop the empty month area looking detached. With real data
present that made the month area read as a heavy spreadsheet grid. Per the
legacy/Figma (which show an open month area — vertical dividers are absent/very
faint), the **month vertical dividers were removed** from the three body month-cell
types (data rows, empty-L2 fallback, empty-state rows). The month cells now carry
only the light horizontal row separator (`border-b #d4d4d4`); the frozen sticky
columns keep their vertical grid and the single frozen↔month divider is retained.
Result: the month area is open and no longer boxed, while rows still align via the
horizontal separators.

### Round-4 checklist

| Check | Result |
|---|---|
| SALES PROFIT row is one continuous green band | ✅ `bg-[#dcfce7]` on `<tr>` + all `<td>` (label + months). |
| NON SALES PROFIT (green) row is one continuous green band | ✅ Same ProfitBand fix. |
| No white cells inside the profit rows | ✅ Every cell carries the green. |
| Month grid matches legacy/Figma (open, not boxed) | ✅ Month vertical dividers removed; horizontal separators + frozen grid retained. |
| Sticky columns unchanged | ✅ Frozen-column borders + frozen↔month divider untouched. |
| Alignment unchanged | ✅ Same `<colgroup>` / offsets; no structural change. |
| No rendering/data-logic change | ✅ Class-only edits; render loop, mappers, data untouched. |
| Type-check | ✅ `npx tsc --noEmit` → exit 0. |

### Round-4 intentional note

- **`bg-[#dcfce7]` arbitrary value** (instead of a `@theme` token) is used for the
  profit bands because the `@theme` token did not compile reliably under
  turbopack dev without a restart; the arbitrary value is HMR-reliable and matches
  the Figma green exactly. Documented here alongside the existing `#16a34a`
  END-BALANCE inline exception.

## Round 5 (2026-07-01) — true consistent grid (correction of round 4)

Round 4 removed the month vertical dividers, which made the month area read as an
open **panel with only horizontal separators** — the legacy/Figma is a **true
table grid** where every month cell is an individual rectangle and the vertical
lines continue from header through body. This round restores that.

**Root cause:** the table rule was `[&_td]:border-b` (bottom only) plus `border-r`
applied *only* to `.sticky` (frozen) cells. So non-sticky **month cells got no
vertical border** — the frozen columns looked gridded while the month columns
looked like an open panel; header and body no longer shared one border model.

**Fix** ([CashFlowPage.tsx](../../components/banking/reports/cash-flow/CashFlowPage.tsx) table `className`):
- Every `td` **and** `th` now draws `border-b border-r border-wb-ntrl-4` (1px,
  light neutral). The `.sticky`-only border-r rules were removed.
- `border-separate` + `borderSpacing:0` is kept, and each cell draws only its
  **right + bottom** edge, so every internal grid line is a single 1px line (no
  doubling), while the wrapper `div` (`border border-wb-ntrl-4`) supplies the outer
  top + left edge. This is the standard sticky-safe 1px-grid technique.
- `border-collapse: collapse` was **not** used: with collapse, cell-owned borders
  are dropped on `position: sticky` cells and disappear as the month columns
  scroll — `border-separate` keeps the frozen-column borders pinned.
- Result: header, body, month columns, and the S.TOTAL / SALES PROFIT / NON SALES
  PROFIT summary bands all share the **same** border model; month cells are
  individual grid cells; vertical + horizontal lines line up at every
  intersection. rowSpan (L1/L2 category) and colSpan (band labels) cells render as
  clean merged rectangles inside the grid.

**Preserved:** summary-band background colors (S.TOTAL `bg-brand-soft`; SALES /
NON SALES PROFIT `bg-[#dcfce7]`; END BALANCE `#16a34a`), sticky columns, colgroup
widths, and alignment are unchanged. The END BALANCE band stays a solid green
footer (separate sibling table) as in legacy.

### Round-5 checklist

| Check | Result |
|---|---|
| Header and body use the same border model | ✅ Uniform `border-b border-r border-wb-ntrl-4` on all `td` + `th`. |
| Month cells are individual grid cells | ✅ Every month cell now has right + bottom 1px borders. |
| Vertical lines continue through the entire table | ✅ Frozen + month + summary all gridded (END BALANCE footer aside). |
| Horizontal lines align perfectly | ✅ Shared `<colgroup>`; single-edge borders line up. |
| No double / thick borders | ✅ Each line drawn once (right/bottom only); `borderSpacing:0`. |
| Summary rows still span correctly + keep bg | ✅ colspan labels + coloured month cells unchanged. |
| Sticky columns remain working | ✅ `border-separate` retained so sticky borders persist on scroll. |
| Type-check | ✅ `npx tsc --noEmit` → exit 0. |

## Confirmations

- **Only UI was modified.** Changes are limited to Tailwind classes / arbitrary
  values. No JSX rendering logic, data flow, or component structure changed.
  (Round 2 added `border-r` classes to three month-cells; round 3 restyled the
  filter container / controls / Download button; round 4 swapped the profit-band
  background to `bg-[#dcfce7]`, removed the dead profit token, and removed the
  month vertical dividers; round 5 restored a uniform 1px `border-b border-r` grid
  on every `td`/`th` — all class-only.)
- **No business logic / API / backend changed.** `CashFlowClient.tsx`, `types.ts`,
  `lib/api/*`, mappers, and the Spring Boot backend were **not** touched. Search,
  pagination, calculations, and Excel export are unchanged.

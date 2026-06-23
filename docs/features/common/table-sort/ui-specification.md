# Table Sort — UI Specification

**Part of:** Common → table-sort
**Last verified:** 2026-06-23

The sortable header is the shared [`<TableHeaderCell>`](../../../../components/shared/TableHeaderCell.tsx).
All sort UI lives there — pages never render a bespoke sort glyph.

## Glyph states

| State | Glyph | Source | Class (verified) |
|---|---|---|---|
| Inactive (default, or column not currently sorted) | `ico-sort.svg` | `/assets/table/ico-sort.svg` | `h-3 w-2 shrink-0` (`TableHeaderCell.tsx:108-116`) |
| ASC active | lucide `ChevronUp` | `lucide-react` | `size-3.5 shrink-0 text-brand`, `strokeWidth={2.25}` (`TableHeaderCell.tsx:96-101`) |
| DESC active | lucide `ChevronDown` | `lucide-react` | `size-3.5 shrink-0 text-brand`, `strokeWidth={2.25}` (`TableHeaderCell.tsx:102-107`) |
| Not sortable (`sortable=false`) | none (`glyph = null`) | — | `TableHeaderCell.tsx:95,117` |

"Active" = `sortFieldId === activeSortField && activeSortDirection !== null` (`TableHeaderCell.tsx:82`).
Only the currently-sorted column shows a chevron; every other sortable header shows the neutral
`ico-sort.svg`. Lucide chevrons are sanctioned utility chrome here (per CLAUDE.md §6b); the static
default glyph stays the project SVG — do not swap either.

## Accessibility — `aria-sort`

Set on the `<th>` (`TableHeaderCell.tsx:140-148`):

| Condition | `aria-sort` |
|---|---|
| active + ASC | `"ascending"` |
| active + DESC | `"descending"` |
| sortable but not active | `"none"` |
| not sortable | attribute omitted (`undefined`) |

## Keyboard

When sort is wired (`clickable = sortable && sortFieldId && onSort`, `TableHeaderCell.tsx:81`), the
header content is wrapped in a `<button type="button">` (`TableHeaderCell.tsx:150-164`) so the cell is
keyboard-focusable:

- **Enter** / **Space** → `onSort(sortFieldId)` with `preventDefault()` (`TableHeaderCell.tsx:87-93`).
- Click → `onSort(sortFieldId)` (`TableHeaderCell.tsx:84-86`).
- Not clickable (missing `sortFieldId` / `onSort`, or `sortable=false`) → renders a plain `<div>`,
  the glyph may still show but the header is inert ("icon visible but inert" staged-rollout baseline,
  `TableHeaderCell.tsx:46-51,165-167`).

## Header-cell tokens (typography + layout)

| Concern | Value | Source |
|---|---|---|
| Text size | `text-wb-14` default; pages pass `textSizeClass="text-wb-13"` to adopt the 13px standard | `TableHeaderCell.tsx:75` + CLAUDE.md §5 |
| Weight / colour | `font-semibold text-wb-dark` | `TableHeaderCell.tsx:126,160` |
| No-wrap | `whitespace-nowrap` on the label span | `TableHeaderCell.tsx:126,160` |
| Cell padding / align | `py-3` + `px-2.5`; `align === "right" → text-right`/`justify-end` | `TableHeaderCell.tsx:135-137` |
| Glyph gap | `gap-1` between label and glyph | `TableHeaderCell.tsx:121,156` |

## Sortability derivation (page side)

A header is sortable when **both**:

```
sortable = col.SORT_YN === "Y" && !isSpecialViewSettingField(col.FIELD_ID)
```

- `SORT_YN` comes from the column's View Setting item (the same seed that drives visibility/order).
- `isSpecialViewSettingField(...)` (from `@/components/shared/view-setting`) excludes `CHECKBOX` /
  `ETC`.

Hidden columns (`USE_YN='N'`) are filtered out before the header set is built, so they never render a
sortable header at all.

## Forbidden (caught at review)

- Hardcoded sort imagery (`<img src="…/ico-sort-asc.svg">`) — the shared cell renders the canonical
  glyph.
- Attaching `onClick` to `<TableHead>` directly — go through `<TableHeaderCell onSort=…>`.
- A page-specific colour token for the active glyph — it is `text-brand`, owned by the shared cell.
- Inline `text-[Npx]` / `font-[N]` on a `<th>` — use the tokens above.

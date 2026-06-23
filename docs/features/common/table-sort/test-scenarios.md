# Table Sort — Test Scenarios (Frontend)

**Part of:** Common → table-sort
**Last verified:** 2026-06-23

Reference page: Banking > Account Inquiry (VND). Scenarios apply to every adopting page.

## Cycle

| # | Action | Expected |
|---|---|---|
| C1 | Page load | no column active; every sortable header shows the default `ico-sort.svg`; request omits `sortField`/`sortDirection` |
| C2 | Click `Balance` header | `BALANCE`/`ASC`; header shows `ChevronUp` (brand); request sends `sortField=BALANCE&sortDirection=ASC`; rows re-fetched in ASC order |
| C3 | Click `Balance` again | `BALANCE`/`DESC`; `ChevronDown`; request sends `…DESC` |
| C4 | Click `Balance` a third time | back to default; `ico-sort.svg`; request omits both keys |
| C5 | From C2, click `Last Update` | `LAST_UPDATE`/`ASC`; `Balance` reverts to default glyph (single-column sort) |
| C6 | Press Enter on a focused header | same as a click (keyboard parity) |
| C7 | Press Space on a focused header | same as a click; page does not scroll (`preventDefault`) |

## Default omits params

| # | State | Expected request |
|---|---|---|
| P1 | default (C1 / C4) | `sortParams === null` → both query keys omitted → backend default `ORDER BY` |
| P2 | active ASC/DESC | both keys present |

## Special-field inert

| # | Column | Expected |
|---|---|---|
| S1 | `CHECKBOX` header | no sort glyph, not clickable (`isSpecialViewSettingField` true) |
| S2 | `ETC` action column | no sort glyph, not clickable |
| S3 | `VAS_ACCOUNT` (`SORT_YN='N'`) | visible but no glyph, not clickable |

## Hidden / visibility interaction

| # | Action | Expected |
|---|---|---|
| H1 | Hide `Available Balance` via View Setting popover, Save | column removed from headers → cannot be sorted |
| H2 | Re-show it | reappears with the default glyph (page-level sort state unaffected) |
| H3 | Reorder columns | sort state persists; the active column keeps its glyph after reorder |

## DB-side guarantee

| # | Check | Expected |
|---|---|---|
| D1 | Inspect the page code | no `rows.sort(...)` / `[...].sort(...)` after the fetch — ordering comes from the API |
| D2 | Sort by `Balance` DESC | the order matches the backend response order exactly (no client reshuffle) |

## Accessibility

| # | Check | Expected |
|---|---|---|
| A1 | Sorted-ASC header | `aria-sort="ascending"` on the `<th>` |
| A2 | Sorted-DESC header | `aria-sort="descending"` |
| A3 | Sortable, not active | `aria-sort="none"` |
| A4 | Non-sortable header | `aria-sort` attribute absent |
| A5 | Tab to a sortable header | it is focusable (rendered as `<button>`) |

## Forbidden patterns (review checklist)

- [ ] No page-local `useState<{ sortField, sortDirection }>` — uses `useTableSort()`.
- [ ] No `rows.sort(...)` after the API call.
- [ ] No `onClick` on `<TableHead>` directly — goes through `<TableHeaderCell onSort=…>`.
- [ ] No hardcoded sort glyph SVG — shared cell renders it.
- [ ] No `sortField` concatenated into a URL string — passed via the axios `params` object.

## Gaps

- These are manual / behavioural scenarios; no automated frontend sort test was located this pass.
  ⚠️ confirm before claiming automated coverage.

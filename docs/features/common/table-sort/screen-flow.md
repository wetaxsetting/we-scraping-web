# Table Sort — Screen Flow

**Part of:** Common → table-sort
**Last verified:** 2026-06-23

Table sort has no screen of its own — it lives in the header of every list page. The flow below is
the reference (Account Inquiry); every adopting page behaves identically.

## Click flow

```
User clicks a sortable column header
        │
        ▼
useTableSort.toggleSort(fieldId)        (hooks/useTableSort.ts:72-86)
   prev.sortField !== fieldId  → { fieldId, ASC }          // new column ⇒ ASC
   prev.sortDirection === ASC  → { fieldId, DESC }          // same column 2nd click
   prev.sortDirection === DESC → { null, null }             // same column 3rd click ⇒ default
        │
        ▼
sortParams recomputed (useMemo)         (hooks/useTableSort.ts:95-100)
   field + (ASC|DESC) → { sortField, sortDirection }
   default state      → null
        │
        ▼
Client wrapper includes sortField/sortDirection in the useApiData deps
   → loader re-fires → fetchAccounts(currency, sortParams)
        │
        ▼
Backend returns rows already sorted (DB-side ORDER BY)
        │
        ▼
Table re-renders; the active header shows the ASC/DESC glyph, others show the default glyph
```

## Cycle states (one column)

| Click | `sortField` | `sortDirection` | `sortParams` | Glyph on this header |
|---|---|---|---|---|
| (initial) | null | null | null | default `ico-sort.svg` |
| 1st | `BALANCE` | `ASC` | `{ BALANCE, ASC }` | `ChevronUp` (brand) |
| 2nd | `BALANCE` | `DESC` | `{ BALANCE, DESC }` | `ChevronDown` (brand) |
| 3rd | null | null | null | default `ico-sort.svg` |

Clicking a **different** column at any point resets that new column to `ASC` and the previous column
reverts to the default glyph (only one column is active at a time — sort state is single-column at
the page level).

## Re-fetch contract

- Sort state lives at the **data-fetching wrapper** (e.g. `AccountInquiryClient`), not deep in the
  table. The wrapper calls `useTableSort()`, includes `sortField`/`sortDirection` in the `useApiData`
  deps, and passes `sortField`/`sortDirection`/`toggleSort` down to the table-header mapping.
- The default state omits both query keys (`sortParams === null`), so the backend applies its legacy
  default `ORDER BY` — the page does not need to know what that default is.
- Re-fetch is DB-side: the new ordering comes from the server, never from re-sorting in memory.

## Interaction with hidden / special columns

- A column hidden via the View Setting popover (`USE_YN='N'`) is removed from the header set before
  render, so it cannot be clicked to sort.
- Special columns `CHECKBOX` / `ETC` are filtered via `isSpecialViewSettingField(...)` and render no
  sort glyph and no click handler.
- A column whose View Setting `SORT_YN='N'` renders with no glyph and is not clickable, even though it
  is visible.

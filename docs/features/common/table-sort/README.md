# Table Sort — Frontend Feature Hub

**Part of:** Common → table-sort
**Last verified:** 2026-06-23

**Slug:** `table-sort`
**Status:** Working — shared hook + shared header cell; first wired screen `banking-account-inquiry-vnd`.

Table sort is a **global shared concern with no own route** — it is wired into the header of every
list page. Clicking a sortable column header cycles `default → ASC → DESC → default`; the page
re-fetches with the new sort params spread into the list API call. **Sort is always DB-side** — the
backend returns rows already ordered; the frontend never calls `Array.sort()`. One shared hook
(`useTableSort`) + one shared header cell (`<TableHeaderCell>`), keyed by the View Setting `FIELD_ID`
— adopting a new page is a hook call + forwarding sort params, never a fork.

## The cycle (one-line summary)

```
1st click on a column → ASC
2nd click (same column) → DESC
3rd click (same column) → default (no sort; params omitted)
click a different column → ASC on the new column
```

`sortParams` is `null` in the default state, so the request omits both keys and the backend falls
back to its legacy default `ORDER BY`.

## Documents

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Click header → ASC → DESC → default; re-fetch via `sortParams` |
| [ui-specification.md](ui-specification.md) | Glyph states, `aria-sort`, header-cell tokens, keyboard |
| [component-index.md](component-index.md) | `useTableSort`, `<TableHeaderCell>` props, View Setting integration |
| [api-consumption.md](api-consumption.md) | `sortParams` spread into the list fetch; null = default; DB-side |
| [test-scenarios.md](test-scenarios.md) | Cycle, default-omits-params, special-field inert, hidden-column, a11y |

## Related

- Backend twin: [`../../../../../wecms-api/docs/features/common/table-sort/README.md`](../../../../../wecms-api/docs/features/common/table-sort/README.md)
- Category hub: [`../README.md`](../README.md)
- View Setting sibling (FIELD_ID + SORT_YN source): [`../view-setting/README.md`](../view-setting/README.md)
- Excel export sibling (same FIELD_ID + sort contract): [`../excel-export/README.md`](../excel-export/README.md)
- Frontend rules: `wecms-web/CLAUDE.md` §13a "Table sorting" (+ §13 View Setting, §13b Excel export)

# Table Sort — Component Index

**Part of:** Common → table-sort
**Last verified:** 2026-06-23

## `useTableSort` — the cycle hook

`wecms-web/hooks/useTableSort.ts`

| Member | Type | Notes |
|---|---|---|
| `sortField` | `string \| null` | current View Setting `FIELD_ID`, null = default |
| `sortDirection` | `"ASC" \| "DESC" \| null` | null = default (no user sort) |
| `toggleSort(fieldId)` | `(string) => void` | cycles `default → ASC → DESC → default`; different column ⇒ ASC (`useTableSort.ts:72-86`) |
| `setSort(next)` | `(TableSortState) => void` | force a state (e.g. restore from URL) (`useTableSort.ts:88-93`) |
| `sortParams` | `{ sortField, sortDirection } \| null` | wire-shaped; **null in default state** so the request omits both keys (`useTableSort.ts:95-100`) |

Key behaviours (verified):
- The 3-state cycle is owned entirely here; pages never declare their own `useState` for sort
  (`useTableSort.ts:72-86`).
- `sortParams` is `null` whenever `sortField` is null or direction is not `ASC`/`DESC`
  (`useTableSort.ts:96-99`) — spread as `...(sortParams ?? {})` so default omits the keys.
- The hook is **screen-agnostic** — it does not know which FIELD_IDs are sortable. The caller filters
  its column registry against `SORT_YN === "Y"` and excludes specials before forwarding clicks
  (`useTableSort.ts:56-64`).
- One hook instance per list page (not per header) (`useTableSort.ts:63-64`).

```ts
const { sortField, sortDirection, toggleSort, sortParams } = useTableSort();
// ...spread into the fetch: fetchAccounts(currency, sortParams)
```

## `<TableHeaderCell>` — the sortable header

`wecms-web/components/shared/TableHeaderCell.tsx`

Sort-related props (all opt-in — omitting them renders a static, inert header):

| Prop | Type | Notes |
|---|---|---|
| `sortable` | `boolean` (default `true`) | `false` for `SORT_YN='N'`, special, or no-backing-field columns (`TableHeaderCell.tsx:18,73`) |
| `sortFieldId` | `string?` | the column's View Setting `FIELD_ID`; forwarded to the backend as `sortField` (`TableHeaderCell.tsx:34`) |
| `activeSortField` | `string \| null` | table-wide active sort field, from `useTableSort()` (`TableHeaderCell.tsx:41`) |
| `activeSortDirection` | `SortDirection` | active direction (`TableHeaderCell.tsx:43`) |
| `onSort` | `(fieldId) => void` | pass `toggleSort` from `useTableSort()` (`TableHeaderCell.tsx:51`) |
| `textSizeClass` | `string` (default `text-wb-14`) | pass `"text-wb-13"` for the 13px standard (`TableHeaderCell.tsx:26`) |
| `align` | `"left" \| "right"` | right for numeric columns (`TableHeaderCell.tsx:10`) |

Derived internally:
- `clickable = sortable && !!sortFieldId && !!onSort` (`TableHeaderCell.tsx:81`)
- `isActive = !!sortFieldId && activeSortField === sortFieldId && activeSortDirection !== null` (`TableHeaderCell.tsx:82`)

## Integration with View Setting columns

Sort and View Setting share the same `FIELD_ID` registry:

```tsx
// per header, in the page's visible-column mapping
<TableHeaderCell
  sortFieldId={col.FIELD_ID}
  sortable={col.SORT_YN === "Y" && !isSpecialViewSettingField(col.FIELD_ID)}
  activeSortField={sortField}
  activeSortDirection={sortDirection}
  onSort={toggleSort}
  textSizeClass="text-wb-13"
>
  {t(col.headerKey)}
</TableHeaderCell>
```

- `isSpecialViewSettingField(...)` and the special-field set come from
  `@/components/shared/view-setting` (the View Setting shared module) — never inline a string check.
- The visible-column list is filtered to `USE_YN === "Y"` and ordered by `DISP_ORD` **before** the
  header mapping, so hidden columns never produce a sortable header.

## Reference wiring

| File | Role |
|---|---|
| `wecms-web/app/(dashboard)/banking/account-inquiry/AccountInquiryClient.tsx` | calls `useTableSort()`, threads state into the page + `useApiData` deps |
| `wecms-web/components/shared/AccountInquiryPage.tsx` | maps visible View Setting columns to `<TableHeaderCell>` with the sort triplet |
| `wecms-web/lib/api/banking.ts` | `fetchAccounts(currency, sort)` accepts `ListSortParams` |

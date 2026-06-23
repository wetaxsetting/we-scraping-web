# Table Sort — API Consumption

**Part of:** Common → table-sort
**Last verified:** 2026-06-23

Table sort consumes **no endpoint of its own** — it adds two optional query params to whatever list
endpoint the page already calls. Sort is resolved **DB-side** by the backend; the frontend never
reorders rows.

## `sortParams` spread into the list fetch

`useTableSort()` returns `sortParams` — a wire-shaped object or `null`:

```ts
sortParams: { sortField: string; sortDirection: "ASC" | "DESC" } | null
```
(`hooks/useTableSort.ts:40,95-100`)

The page spreads it into the API call. When `sortParams` is `null` (default cycle state), both keys
are omitted and the backend applies its legacy default `ORDER BY`:

```ts
// list fetch — params object; null = default, keys omitted
const params = { currency, ...(sortParams ?? {}) };
// → GET /api/v1/banking/accounts?currency=VND&sortField=BALANCE&sortDirection=DESC
//   (in default state: GET /api/v1/banking/accounts?currency=VND)
```

The shared client wrapper accepts an optional `ListSortParams` (`lib/api/banking.ts`) and spreads it
into the axios `params` only when present — never a per-feature param name (`sort`, `order`, etc.).

## Wire contract

| Query key | Value | Casing |
|---|---|---|
| `sortField` | View Setting `FIELD_ID` (uppercase stable identifier — `BANK`, `BALANCE`) | value stays UPPERCASE (stable id, not a wire key) |
| `sortDirection` | `ASC` / `DESC` | UPPERCASE |

`sortField` / `sortDirection` are themselves snake_case-friendly query keys per the wire convention;
their **values** are stable identifiers, kept verbatim.

## Re-fetch on cycle change

Sort state belongs to the data-fetching wrapper, not the table:

```ts
// AccountInquiryClient.tsx (reference)
const { sortField, sortDirection, toggleSort, sortParams } = useTableSort();
const { data } = useApiData(
  () => fetchAccounts(currency, sortParams),
  [currency, sortField, sortDirection],   // ← cycle change re-fires the loader
);
```

Including `sortField`/`sortDirection` in the `useApiData` deps is what makes a header click re-fetch.
The wrapper forwards `sortField` / `sortDirection` / `toggleSort` to the table-header mapping.

## DB-side, never frontend

- **Do not** call `rows.sort(...)` after fetching — that breaks pagination order, masks backend bugs,
  and forks the contract. The backend returns rows already ordered.
- The backend whitelist (`AccountSortField` etc.) is the second line of defence: an unknown
  `sortField` (stale bundle) falls back to the default `ORDER BY` server-side — it is never echoed
  into SQL and never surfaces a 4xx.

## Error handling

Sort adds no new error path — it rides the host list endpoint's `ApiResponse<T>` envelope. A failed
list call surfaces through the page's existing `ApiCallError` → `useDialog({ type: "error" })` flow;
401s are caught by the global session-expired interceptor in `lib/axios.ts`. There is no
sort-specific error code.

## Adoption (purely additive)

Same shape as View Setting / Excel-export adoption — no new shared component, hook, or endpoint:

1. Call `useTableSort()` in the page's data wrapper.
2. Forward `sortField` / `sortDirection` / `toggleSort` to the existing `<TableHeaderCell>` mapping.
3. Spread `sortParams` into the existing list fetch and add `sortField`/`sortDirection` to the
   `useApiData` deps.
4. Backend adds one constant per new sortable `FIELD_ID` to its `*SortField` enum (the only backend
   change).

## Adoption status

| Screen | Status | List endpoint |
|---|---|---|
| Banking > Account Inquiry (VND) | ✅ Wired | `GET /api/v1/banking/accounts` |
| All other paginated list pages | ⏳ Pending | migrate in next stabilisation pass — do not regress existing tables |

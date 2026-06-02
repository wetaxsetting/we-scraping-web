# Banking > Account Inquiry (VND) — Frontend Page Design

**Refactor screen ID:** `banking-account-inquiry-vnd`
**Feature spec:** [../../features/banking/account-inquiry-vnd.md](./account-inquiry.md)
**JEX reference:** `fnsh_0001_001_view.jsp` + `fnsh_0001_001.ts` (read-only)

---

## Route

| | |
|---|---|
| Path | `/banking/account-inquiry` |
| Layout group | `(dashboard)` (sidebar + top nav chrome) |
| Route file | `wecms-web/app/(dashboard)/banking/account-inquiry/page.tsx` |
| Auth | Protected — redirected to `/login` by `(dashboard)/layout.tsx` if no JWT |
| Metadata | title: `Account Inquiry (VND) — WeCMS` |

The page is a thin wrapper that pins `currency="VND"` on the shared client component.

---

## Layout structure

```
(dashboard) layout                                  ← global chrome (sidebar + top nav)
└── /banking/account-inquiry/page.tsx
    └── <AccountInquiryClient currency="VND" />    ← currency-locked wrapper
        └── <AccountInquiryPage … />               ← shared shell (also used by FCY)
            ├── Title + breadcrumbs
            ├── Summary card (3 KPIs)
            ├── Filter bar (bank dropdown · keyword · refresh)
            ├── Table toolbar
            │   ├── ViewSettingPopover               ← global component
            │   └── Excel export button
            ├── DataTableShell
            │   └── TableHeaderCell × N (sortable)
            └── Pagination
```

---

## Components

| Component | File | Role |
|---|---|---|
| `AccountInquiryClient` | `app/(dashboard)/banking/account-inquiry/AccountInquiryClient.tsx` | Currency-locked wrapper. Owns refetch trigger, sort state, mock fallback. |
| `AccountInquiryPage` | `components/shared/AccountInquiryPage.tsx` | Shared list shell. Reused by VND and FCY pages. |
| `ViewSettingPopover` | `components/shared/ViewSettingPopover.tsx` | Global component bound to `WEB_SVC_ID` + `DYM_AREA_ID`. |
| `DataTableShell` + `TableHeaderCell` | `components/shared/...` | Standard table primitives with sort glyph. |
| `Pagination` | `components/shared/Pagination.tsx` | Reused across all list pages. |
| `useApiData()` (hook) | `lib/api/useApiData.ts` | Lightweight fetch-on-mount hook. |
| `useViewSetting()` (hook) | `lib/api/useViewSetting.ts` | Loads + persists screen options for the popover. |
| `useExcelExport()` (hook) | `lib/api/useExcelExport.ts` | Posts the export request, downloads the XLSX. |
| `useTableSort()` (hook) | `lib/hooks/useTableSort.ts` | Manages `sortField` / `sortDirection` round-tripping. |
| `usePagination()` (hook) | `lib/hooks/usePagination.ts` | Client-side page slicing. |
| `fetchAccounts()` (fetcher) | `lib/api/banking.ts` | Wraps `axios.get('/api/v1/banking/accounts', { params })`. |
| `mapAccountRow()` / `mapCurrencyTotal()` | `lib/api/mappers.ts` | UPPER_SNAKE → camelCase translation. |

UI must follow the global typography rules documented in the in-repo frontend guide [../../../../CLAUDE.md](../../../../CLAUDE.md). No arbitrary `text-[14.5px]` or inline `style={{ fontFamily: ... }}` — only semantic tokens (`text-page-title`, `text-section-title`, `text-table-cell`, `text-button`, `text-helper`).

---

## Summary card logic

Top of the page renders three KPIs:

| KPI | Source |
|---|---|
| Total Accounts | `TOTAL_COUNT` from response → `totalAccounts` prop. Fallback: `rows.length`. |
| Total Balance | `TOTALS_BY_CCY[VND].BALANCE` → `formatAmount(value, 'VND')`. Fallback: client-side sum of `BAL`. |
| Total Available Balance | `TOTALS_BY_CCY[VND].AVAILABLE_BAL` → `formatAmount(value, 'VND')`. Fallback: client-side sum of `REAL_AMT`. |

Server-side totals are preferred — they include rounding rules and currency-aware aggregation. Client-side fallback exists only for the offline mock path.

---

## Table rendering

- **Source data:** `mappedRows` from `mapAccountRow(api)` — never the raw API DTO. Camel-cased fields only inside the React tree.
- **Column registry:** `COLUMN_REGISTRY` in `AccountInquiryPage.tsx` maps each FIELD_ID → header + cell renderer + sort key.
- **Visible columns:** intersection of (a) registry keys for this screen and (b) `useViewSetting()` columns where `USE_YN='Y'`. Order follows `DISP_ORD` from the View Setting response.
- **Sort:** click on `TableHeaderCell` → `useTableSort()` rotates `none → ASC → DESC → none` and re-invokes `fetchAccounts()` with the new sort params.
- **Stable-data latch:** the client retains the last non-null API result in `stableData` so the table doesn't blank between sort requests.
- **Status indicator:** rows with `error=true` (mapped from `ACCT_BAL_INQ_STTS`) render a warning glyph next to the balance — value is still shown, with the `ACCT_BAL_INQ_MSG` as tooltip.
- **Empty state:** zero rows after filter → friendly empty message. Zero rows from the API (no accounts) → distinct empty message.

### VND amount cells

`formatAmount(value, 'VND')` — locale-aware thousands separators, no decimals. Negative numbers use leading minus. Empty / null balances render `-`, not `0`.

---

## Pagination

**Server-side** as of Sprint 2 (parity with JEX `fnsh_0001_001_r001` `PAGE_NO` / `PAGE_PER_CNT`).

- Wrapper owns `page` (zero-based) and `pageSize` state. Defaults: `page=0`, `pageSize=10` (matches the canonical `PAGE_SIZE_OPTIONS[0]` in the shared `Pagination` component; backend clamps to `MAX_PAGE_SIZE = 100`). Page-size options offered to the user: `10 / 20 / 50 / 100`.
- Wrapper passes a `serverPaging` controlled-mode prop to `<AccountInquiryPage>`. The page calls `usePagination` for rules-of-hooks compliance but discards its values when `serverPaging` is present, synthesising the same shape from server-driven props.
- Pagination chrome reads `PAGE_NUMBER` / `PAGE_SIZE` / `TOTAL_PAGES` / `TOTAL_COUNT` from the response. Page 0 (zero-based on the wire) is rendered as "Page 1 of N" (one-based for display).
- Page resets to 0 on every filter change (bank, keyword, page size); preserved on sort change.
- The legacy uncontrolled path (client-side `usePagination`) is still active when the wrapper omits `serverPaging` — used by the FCY client until its own server-side migration lands.

---

## UI behavior

| Trigger | Behavior |
|---|---|
| Page mount | `fetchAccounts({ currency, bankCd, keyword, sort, page, size })` → maps rows → renders. View Setting popover loads in parallel. |
| Bank dropdown options | Populated from the response's `BANKS_AVAILABLE` field (canonical, scoped to tenant + currency only — never narrowed by current bank/keyword/page filter). Selecting one bank therefore never removes the others from the option set. |
| Bank dropdown change | `serverPaging.onBankCdChange(bankCd)` — wrapper updates state + resets page to 0 → refetch fires via `useApiData` deps. Server-side `WHERE BANK_CD = ?`. Option set unchanged. |
| Keyword input | Live value updates the input synchronously; debounced 300 ms before the wrapper sends `keyword` to the API. Server-side case-insensitive partial match against the **formatted** account nickname (output of `wb_format_acct_nick_nm` — what the user sees in the table cell, including the synthesized `<bank short> <last4>` for empty raw nicknames). Mirrors JEX `SRCH_WD`. Page resets to 0. |
| Page navigation | `serverPaging.onPageChange(zeroBased)` → refetch with new `page`. |
| Page-size change | `serverPaging.onPageSizeChange(size)` → wrapper updates `pageSize` + resets page to 0 → refetch. |
| Sort header click | `useTableSort` rotates state → refetch with new `sortField` / `sortDirection`. |
| Refresh button | Increments `refreshKey` → forces refetch with current sort + filter + page. |
| View Setting save | `PUT /api/v1/screen-options/banking-account-inquiry-vnd/default` → on success, hook re-pulls and the table re-renders with the new column set. |
| Excel button | `POST /api/v1/banking/accounts/export` with current filter (`currency`, `bankCd`, `keyword`) + sort + column config → server runs the same `findFiltered` query with `Pageable.unpaged()` and streams XLSX. Browser downloads `account_inquiry_{YYYY-MM-DD}.xlsx`. |
| Logout / token expiry | `axios` interceptor surfaces `401` → global system dialog → redirect to `/login`. |

---

## Cross-references

- Feature spec: [../../features/banking/account-inquiry-vnd.md](./account-inquiry.md)
- Backend API: account-inquiry-vnd-api.md _(wecms-api backend repo — not included in this clone)_
- DB design: account-inquiry-vnd-db.md _(wecms-api backend repo — not included in this clone)_
- Page mapping (cross-feature): [../page-mapping.md](../../../references/page-mapping/page-mapping.md)
- View Setting global feature: [../../features/view-setting.md](../../) *(create if missing)*

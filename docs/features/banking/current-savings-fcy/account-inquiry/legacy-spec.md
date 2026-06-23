# Banking > Account Inquiry (FCY) — Frontend Page Design

> **Preserved single-file spec.** The **primary frontend documentation home** for this feature is now
> the folder [account-inquiry-fcy/](../account-inquiry/README.md). This file is kept as a quick
> reference; new detail lands in the folder.

**Refactor screen ID:** `banking-account-inquiry-fcy`
**Feature spec:** [../../features/banking/account-inquiry-fcy.md](README.md)
**JEX reference:** `fnsh_0001_001_view.jsp` + `fnsh_0001_001.ts` (shared driver, `CCY_CD='FCY'` mode); FCY popup variant `fnsh_0001_002_view.jsp` + `fnsh_0001_002.ts` (read-only)

---

## Route

| | |
|---|---|
| Path | `/banking/account-inquiry-fcy` |
| Layout group | `(dashboard)` (sidebar + top nav chrome) |
| Route file | `wecms-web/app/(dashboard)/banking/account-inquiry-fcy/page.tsx` |
| Client wrapper | `wecms-web/app/(dashboard)/banking/account-inquiry-fcy/AccountInquiryFcyClient.tsx` |
| Auth | Protected — `(dashboard)/layout.tsx` redirects to `/login` if no JWT |
| Metadata | title: `Account Inquiry (FCY) — WeCMS` |

The page file is a thin metadata + `<AccountInquiryFcyClient />` wrapper. The client wrapper is itself a thin shim around `AccountInquiryClient` (the same component the VND page uses) — it just pins `currency="FCY"`, switches the i18n keys to the FCY variants, passes `viewSettingScreenId={SCREEN_IDS.ACCOUNT_INQUIRY_FCY}`, and enables `multiCurrencyMode`.

---

## Layout structure

```
(dashboard) layout                                  ← global chrome (sidebar + top nav)
└── /banking/account-inquiry-fcy/page.tsx
    └── <AccountInquiryFcyClient />                 ← FCY-locked shim
        └── <AccountInquiryClient                   ← shared client wrapper (also used by VND)
              currency="FCY"
              titleKey="account_inquiry.title_fcy"
              exportTitleKey="account_inquiry.export_title_fcy"
              totalLabelKey="account_inquiry.total_label_ccy"
              viewSettingScreenId={ACCOUNT_INQUIRY_FCY}
              multiCurrencyMode />
            └── <AccountInquiryPage … />            ← shared shell (also used by VND)
                ├── Title + breadcrumbs
                ├── Summary tiles ×N (one per CCY group)
                ├── Filter bar (bank · currency · keyword · refresh)
                ├── Table toolbar
                │   ├── ViewSettingPopover           ← global component
                │   └── Excel export button
                ├── DataTableShell
                │   └── TableHeaderCell × N (sortable)
                └── Pagination
```

---

## Components

| Component | File | Role |
|---|---|---|
| `AccountInquiryFcyClient` | `app/(dashboard)/banking/account-inquiry-fcy/AccountInquiryFcyClient.tsx` | FCY shim — pins `currency`, FCY i18n keys, `multiCurrencyMode`, `viewSettingScreenId=ACCOUNT_INQUIRY_FCY`. |
| `AccountInquiryClient` | `app/(dashboard)/banking/account-inquiry/AccountInquiryClient.tsx` | Shared wrapper. Owns refresh, sort, filter, pagination, currency-dropdown state, mock fallback. |
| `AccountInquiryPage` | `components/shared/AccountInquiryPage.tsx` | Shared list shell. Renders summary tiles, filter row (bank + optional currency dropdown), DataTableShell, and pagination. |
| `ViewSettingPopover` | `components/shared/view-setting/ViewSettingPopover.tsx` | Global component bound to `WEB_SVC_ID=banking-account-inquiry-fcy` + `DYM_AREA_ID=default`. |
| `BankFilterPopover` / `CurrencyFilterPopover` | `components/shared/...` | Filter chip popovers — same primitive, two instances. |
| `DataTableShell` + `TableHeaderCell` | `components/shared/...` | Standard table primitives with sort glyph. |
| `Pagination` | `components/shared/Pagination.tsx` | Reused across all list pages. |
| `useApiData()` (hook) | `lib/api/useApiData.ts` | Fetch-on-mount hook. |
| `useViewSetting()` (hook) | `components/shared/view-setting/useViewSetting.ts` | Loads + persists screen options for the popover (FCY scope). |
| `useExcelExport()` (hook) | `hooks/useExcelExport.ts` | Posts the export request, downloads the XLSX. |
| `useTableSort()` (hook) | `hooks/useTableSort.ts` | Manages `sortField` / `sortDirection` round-tripping. |
| `fetchAccounts()` (fetcher) | `lib/api/banking.ts` | Wraps `axios.get('/api/v1/banking/accounts', { params })`. |
| `mapAccountRow()` / `mapCurrencyTotal()` | `lib/api/mappers.ts` + `lib/api/currencyTotal.ts` | UPPER_SNAKE → camelCase translation. |

UI must follow the global typography rules documented in the in-repo frontend guide [../../../../CLAUDE.md](../../../../../CLAUDE.md). No arbitrary `text-[14.5px]` / inline `style={{ fontFamily }}` — only Tailwind tokens (`text-page-title`, `text-section-title`, `text-table-cell`, `text-button`, `text-helper`).

---

## Wire `currency` derivation

The component prop `currency="FCY"` is the **page mode** (static). The actual wire param sent to the backend is derived per-render:

```
wireCurrency = multiCurrencyMode
    ? (selectedCurrency ?? currency)   // FCY page: null = "All Currency" → "FCY"
    : currency;                         // VND page: always "VND"
```

| User dropdown selection | `selectedCurrency` | `wireCurrency` | Backend filter |
|---|---|---|---|
| All Currency (default) | `null` | `"FCY"` | `ccy_cd <> 'VND'` |
| USD | `"USD"` | `"USD"` | `ccy_cd = 'USD'` |
| KRW | `"KRW"` | `"KRW"` | `ccy_cd = 'KRW'` |
| EUR | `"EUR"` | `"EUR"` | `ccy_cd = 'EUR'` |
| any other CCY | `<CCY>` | `<CCY>` | `ccy_cd = <CCY>` |

`wireCurrency` is forwarded to `<AccountInquiryPage>` and onward to the Excel export endpoint so list and export share the same filter scope.

---

## Summary tile logic (multi-currency)

Top of the page renders **one tile per currency group** sourced from `TOTALS_BY_CCY`:

| Mode | Tiles rendered |
|---|---|
| Wire `currency=FCY` (All Currency) | One tile per CCY found in the filtered result — typically `USD`, `KRW`, possibly `EUR` / `JPY` / others depending on the tenant's account roster. |
| Wire `currency=<CCY>` (concrete) | A single tile in the selected CCY. |
| Backend missing `TOTALS_BY_CCY` | Legacy single-tile fallback — uses scalar `BALANCE` / `AVAILABLE_BAL` against `summaryCurrency` (defaults to `"VND"` — should not happen on this screen; leave the fallback in place for offline mock). |

Per-tile content:
- **Title:** `t("account_inquiry.total_label_ccy", { ccy })` → "TOTAL ACCOUNTS (USD)" / "TOTAL ACCOUNTS (KRW)" / …
- **Count:** `t("account_inquiry.accounts_count", { count })`
- **Available label / value:** `t("account_inquiry.available_balance")` + `formatAmount(g.available, g.ccy, true)`
- **Balance label / value:** `t("account_inquiry.balance")` + `formatAmount(g.balance, g.ccy, true)`

Mixed-currency totals are **never** rendered. The legacy "TOTAL ACCOUNTS (FCY)" label is no longer shown — it was meaningless once per-CCY tiles landed.

---

## Currency dropdown logic

Owned by `AccountInquiryClient` (the shared wrapper) because changing the value re-fires the API call:

- **Trigger:** `multiCurrencyMode={true}` from the FCY shim.
- **State:** `selectedCurrency: string | null` — `null` represents "All Currency".
- **Options cache (`currencyOptions`):** Built from the first response under "All Currency" (wire `currency=FCY`, `selectedCurrency=null`). Distinct CCY codes from `TOTALS_BY_CCY[].CCY_CD`, sorted ascending. The cache is **not** refreshed on narrow responses so the dropdown stays populated when the user picks a single CCY.
- **Change handler:** `onCurrencyChange(value)` → `setSelectedCurrency(value)` → `resetPage(0)` → next render's `wireCurrency` flips → `useApiData` deps fire a refetch.
- **"All Currency" label:** `t("account_inquiry.currency_filter_all")` rendered when `selectedCurrency === null`.

---

## Table rendering

Identical to VND, with these FCY-specific notes:

- **Per-row CCY in the formatter.** Each row's `BAL` / `REAL_AMT` is formatted using the row's `CCY_CD`, not the page's `summaryCurrency`. The table contains rows in multiple CCYs simultaneously when wire `currency=FCY`.
- **Source data:** `mappedRows` from `mapAccountRow(api)` — never the raw API DTO. Camel-cased fields only inside the React tree.
- **Column registry:** `COLUMN_REGISTRY` in `AccountInquiryPage.tsx` maps each FIELD_ID → header + cell renderer + sort key (shared with VND).
- **Visible columns:** intersection of (a) registry keys for this screen and (b) `useViewSetting(SCREEN_IDS.ACCOUNT_INQUIRY_FCY).items` where `USE_YN='Y'`. Order follows `DISP_ORD` from the FCY-scoped View Setting response.
- **Sort:** click on `TableHeaderCell` → `useTableSort()` rotates `none → ASC → DESC → none` and re-invokes `fetchAccounts()` with the new sort params.
- **Stable-data latch:** wrapper retains the last non-null API result so the table doesn't blank between sort / filter / pagination requests.
- **Status indicator:** rows with `error=true` (mapped from `ACCT_BAL_INQ_STTS`) render a warning glyph next to the balance — value is still shown, with the `ACCT_BAL_INQ_MSG` as tooltip.
- **Empty state:** zero rows after filter → friendly empty message; zero rows from the API (no FCY accounts at all) → distinct empty message.

### FCY amount cells

`formatAmount(value, row.ccyCd, includeSymbol=true)` — locale-aware thousands separators with the CCY's standard symbol (`$`, `₩`, `€`, `¥`, …) and decimal precision (USD/EUR 2 dp, KRW/JPY 0 dp, default vi-VN with no symbol). Empty / null balances render `-`, not `0`.

---

## Pagination

**Server-side** (parity with VND). Inherited from `AccountInquiryClient`'s `serverPaging` controlled-mode plumbing:

- Wrapper owns `page` (zero-based) and `pageSize` state. Defaults: `page=0`, `pageSize=10`. Page-size options offered: `10 / 20 / 50 / 100`; backend clamps to `MAX_PAGE_SIZE = 100`.
- Pagination chrome reads `PAGE_NUMBER` / `PAGE_SIZE` / `TOTAL_PAGES` / `TOTAL_COUNT` from the response. Page 0 (zero-based on the wire) renders as "Page 1 of N" (one-based for display).
- Page resets to 0 on every filter change (bank, **currency**, keyword, page size); preserved on sort change.
- Excel export bypasses pagination — `Pageable.unpaged()` server-side.

---

## UI behaviour

| Trigger | Behavior |
|---|---|
| Page mount | `fetchAccounts({ currency: wireCurrency, bankCd, keyword, sort, page, size })` → maps rows → renders. View Setting popover (FCY scope) loads in parallel. |
| Bank dropdown options | Populated from the response's `BANKS_AVAILABLE` field — scoped to tenant + the current wire `currency` only, never narrowed by current bank/keyword filter. |
| Bank dropdown change | `serverPaging.onBankCdChange(bankCd)` → wrapper updates state + resets page to 0 → refetch. |
| Currency dropdown change | `onCurrencyChange(ccy \| null)` → wrapper sets `selectedCurrency`, resets page to 0 → next render's `wireCurrency` flips → refetch fires via `useApiData` deps. |
| Keyword input | Live value updates the input synchronously; debounced 300 ms before the wrapper sends `keyword` to the API. Server-side case-insensitive partial match against the formatted nickname. Page resets to 0. |
| Page navigation | `serverPaging.onPageChange(zeroBased)` → refetch with new `page`. |
| Page-size change | `serverPaging.onPageSizeChange(size)` → wrapper updates `pageSize` + resets page to 0 → refetch. |
| Sort header click | `useTableSort` rotates state → refetch with new `sortField` / `sortDirection`. |
| Refresh button | Increments `refreshKey` → forces refetch with current sort + filter + page. |
| View Setting save | `PUT /api/v1/screen-options/banking-account-inquiry-fcy/default` → on success, hook re-pulls and the table re-renders with the new column set. |
| Excel button | `POST /api/v1/banking/accounts/export` with `screenId="banking-account-inquiry-fcy"`, current filter (`currency=wireCurrency`, `bankCd`, `keyword`), sort, column config from `ACCOUNT_INQUIRY_EXPORT_COLUMNS`, and the FCY-specific filename / title (`exportTitleKey="account_inquiry.export_title_fcy"`). Browser downloads the XLSX. |
| Logout / token expiry | `axios` interceptor surfaces `401` → global system dialog → redirect to `/login`. |

---

## Cross-references

- Feature spec: [../../features/banking/account-inquiry-fcy.md](README.md)
- Backend API: account-inquiry-fcy-api.md _(wecms-api backend repo — not included in this clone)_
- DB design: account-inquiry-fcy-db.md _(wecms-api backend repo — not included in this clone)_
- VND twin (mirror layout): [./account-inquiry-vnd-page.md](../account-inquiry/legacy-spec.md)
- View Setting global feature: [../../features/view-setting.md](../../../) *(create if missing)*
- Page mapping (cross-feature): [../page-mapping.md](../../../../references/page-mapping/page-mapping.md)

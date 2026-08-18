# Account Inquiry (FCY) — Screen Flow (Frontend)

> User journeys + interaction flows. Companion: [ui-specification.md](ui-specification.md) (static layout)
> · [api-consumption.md](api-consumption.md) (the wire). Route: `/banking/account-inquiry-fcy`.

## 1. Page load

```
/banking/account-inquiry-fcy
  → page.tsx (server) sets metadata "Account Inquiry (FCY) — WeCMS"
  → AccountInquiryFcyClient  (currency="FCY", titleKey="account_inquiry.title_fcy",
                              multiCurrencyMode=true, viewSettingScreenId=ACCOUNT_INQUIRY_FCY)
  → AccountInquiryClient (shared)  derives wireCurrency = selectedCurrency ?? "FCY"
  → useApiData(() => fetchAccounts({ currency: wireCurrency, bankCd, keyword, sort, page, size }))
  → AccountInquiryPage renders: PageHeader · filter row · per-CCY summary tiles · grid · pagination
```

First paint uses `FALLBACK_COLUMNS` (mirrors the V43/V47 seed) until View Setting resolves; a sticky-
loading latch (`useStickyLoading`) keeps prior rows visible across refetches so the grid never flashes.

## 2. Filter — bank / keyword / currency

| Action | Flow |
|---|---|
| Pick a **bank** | `BankFilterPopover` → `serverPaging.onBankCdChange(bankCd)` → `resetPage(0)` → refetch. Bank options come from `banks_available` and don't shrink as you filter. |
| Type a **keyword** | debounced (300ms) → `serverPaging.onKeywordChange` → `resetPage(0)` → refetch (matches the formatted nickname server-side). |
| Pick a **currency** | `CurrencyFilterPopover` → `onCurrencyChange(value)` → `setSelectedCurrency` → `wireCurrency` flips → refetch. `null` ("All Currency") = `currency=FCY`; a concrete value narrows to that CCY. |

The currency dropdown is the FCY-only control (VND has none). Its options are the distinct CCYs cached
from the first "All Currency" response (kept stable when the user narrows, so the dropdown doesn't
collapse to one option).

> **Inquiry-date control (OQ-FCY-2 — PO Approved Deviation, Option B):** the date chip (`<DateField>`,
> `AccountInquiryPage.tsx:1125`) does **not** re-base list balances. Its `onChange` only
> `setSelectedDate(...) + resetPage()` (`:1127-1130`); `selectedDate` is page-local and is never sent to
> `fetchAccounts`. It scopes the per-account balance/transaction popup only (§6). Legacy `fnsh_0005_001`
> *did* drive as-of-date historical balances from the date; the refactor ships snapshot-only by PO
> decision (2026-06-06). Full legacy parity (Option A) is deferred to a post-SIT MR — see the backend
> [wecms-api/…/refactor-gap-analysis.md](../../../../../../wecms-api/docs/features/banking/current-savings-fcy/account-inquiry/refactor-gap-analysis.md).

## 3. Sort

Click a sortable column header → `useTableSort().toggleSort(fieldId)` cycles `default → ASC → DESC →
default`. `sortField`/`sortDirection` are in the `useApiData` dependency array, so a cycle change
re-fires the fetch; the **backend** returns the rows already ordered (never `rows.sort()` on the client).

## 4. Pagination

Server-side controlled via `serverPaging`. Page is 0-based on the wire, 1-based in the UI. Page-size
options `[10,20,50,100]`, default 10. Changing bank/currency/keyword resets to page 0; changing sort
preserves the page.

## 5. Update / Sync flow

```
Select ≥1 account (checkbox) → "Update" button enables
  → TransactionSyncDialog opens
  → syncTransactions({ accounts:[{bank_cd,acct_no}], from_dt?, to_dt? })
  → status:
      COMPLETED        → dialog shows counts/totals → onSyncComplete() → parent refetch → Last Update moves
      OTP_REQUIRED     → OTP input → submitSyncOtp(sessionId, value)
      QNA_REQUIRED     → question + answer → submitSyncQna(sessionId, {...})
      CAPTCHA_REQUIRED → captcha image + value → submitSyncCaptcha(sessionId, value)
      ERROR            → error dialog (errorCode)
```

Per-row checkboxes are disabled for manual-registration (`hand_reg_yn='Y'`) and disconnected-bank
(`cert_conn_yn='N'`) accounts, with a tooltip explaining why. R&D note: live scraping may be unavailable
locally (FCY-A03) — the flow and dialog are still exercisable.

## 6. Balance popup → transaction drill-down

```
Click a BALANCE cell → BalancePopover (portal, anchored below the cell)
  → fetchTransactions(acctSeqNo, { from: selectedDate, to: selectedDate })
  → shows Type / Amount / Reference ID rows + deposit/withdrawal footer (formatted per the row's CCY)
  → "View Details" → deep-link to the per-account FCY Transaction History
```

## 7. Export

`PageActionButtons` Excel icon → `useExcelExport()` posts the live `vs.items` ∩ `columnConfig` + filters
(`currency`, `bankCd`, `keyword`) + sort to `POST /api/v1/banking/accounts/export` → backend streams the
XLSX (per-CCY subheader) → browser saves the blob. No client-side CSV.

## 8. Loading / empty / error states

| State | Render |
|---|---|
| Initial loading | centered "Loading…" (sticky for ≥400ms to avoid flicker) |
| Empty result | `account_inquiry.empty_fcy` ("No Data Found" — FCY-specific copy) |
| Refetch (filter/sort/page change) | prior rows stay visible via the stable-data latch; no flash |
| Sync loading | spinner inside `TransactionSyncDialog` |
| API error | routed to the global `useDialog({ type: "error", errorCode })`; 401 → global session-expired interceptor |

## 9. VND ↔ FCY differences (same component)

| Aspect | VND | FCY |
|---|---|---|
| Route | `/banking/account-inquiry` | `/banking/account-inquiry-fcy` |
| `currency` prop | `"VND"` | `"FCY"` |
| `multiCurrencyMode` | off | **on** (currency dropdown + per-CCY tiles) |
| Summary tiles | single scalar tile | one tile per CCY |
| Row currency label | (default) | `"USD • Current"`, `"KRW • Savings"`, … |
| i18n keys | `*_vnd` / `empty_vnd` | `*_fcy` / `empty_fcy` |
| View Setting screenId | `ACCOUNT_INQUIRY_VND` | `ACCOUNT_INQUIRY_FCY` |
| Wire `currency` | always `VND` | `FCY` or a concrete CCY |

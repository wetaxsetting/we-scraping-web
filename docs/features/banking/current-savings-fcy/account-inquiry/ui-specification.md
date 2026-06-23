# Account Inquiry (FCY) — UI Specification (Frontend)

> Static layout, currency filter, table columns, per-CCY tiles, formatting, and state rendering.
> Companion: [screen-flow.md](screen-flow.md) (interaction) · [component-index.md](component-index.md) (files).
> FCY is a prop-variant of the approved Account Inquiry (VND) baseline — only the deltas below differ.

## 1. Layout

Standard menu-page baseline (`AccountInquiryPage`):

```
PageHeader  [ title "Account Inquiry (FCY)"        Dashboard toggle · View Setting · Excel · Print ]
Filter row  [ Bank ▾   Currency ▾   Date   Search keyword ]
Summary     [ tile: USD  4 accounts · Bal $… · Avail $… ] [ tile: KRW  2 accounts · Bal ₩… · Avail ₩… ]  (one per CCY)
            [ Update ]  (enabled when ≥1 row checked)
Grid        [ ☐ | Bank | Account Nickname | Balance | Available Balance | (VAS) | Last Update ]
Pagination  [ page-size ▾   {shown} of {total}              ‹ 1 2 3 › ]
```

Typography / tokens follow the shared WB365 system (`text-wb-13` table cells, `text-wb-18` page title);
no per-page font overrides.

> **Date chip (OQ-FCY-2 — PO Approved Deviation, Option B):** the `Date` control in the filter row does
> **not** re-base list balances in the refactor (snapshot-only). It scopes the per-account balance popup
> only. Legacy drove as-of-date historical balances from it; full parity (Option A) is deferred post-SIT.
> See [screen-flow.md §2](screen-flow.md) and the backend gap-analysis.

## 2. Currency filter (FCY-only)

- Component: `CurrencyFilterPopover` (second filter chip, after Bank).
- Options: **"All Currency"** (`null` → wire `currency=FCY`) + one entry per distinct CCY from the cached
  `currencyOptions` (e.g. USD, KRW, EUR, JPY).
- Selecting a value → `onCurrencyChange` → `wireCurrency` flips → refetch + `resetPage(0)`.
- Options are cached from the first "All Currency" response and preserved when the user narrows, so the
  dropdown never collapses to a single option.

## 3. Per-currency summary tiles

`multiCurrencyMode` renders one `SummaryTile` per `totals_by_ccy` entry. Each tile shows the CCY-labelled
title (interpolated via `account_inquiry.total_label_ccy` with `{ccy}`), the account count, Available
Balance, and Balance — each formatted with `formatAmount(value, ccy)` (per the tile's own currency). VND
renders a single scalar tile; FCY renders N tiles.

## 4. Account grid columns

Driven by the View Setting registry (`COLUMN_REGISTRY`), iterated in `DISP_ORD` order over the *visible*
(`USE_YN='Y'`) entries. The checkbox column is always prepended (not part of View Setting).

| FIELD_ID | Header | Cell | Align | Sortable |
|---|---|---|---|---|
| `BANK` | Bank | Bank name + building icon + currency label (`"USD • Current"`) + account number (muted sub-line) | left | yes |
| `ACCOUNT_NICKNAME` | Account Nickname | formatted nickname | left | yes |
| `BALANCE` | Balance | `formatAmount(balance, row.currencyCd)` — clickable button (brand blue) → balance popup | right | yes |
| `AVAILABLE_BALANCE` | Available Balance | `formatAmount(available, row.currencyCd)` | right | yes |
| `VAS_ACCOUNT` | VAS Account | `—` placeholder (`USE_YN='N'`, hidden by default) | left | no |
| `LAST_UPDATE` | Last Update | `LastUpdateCell` — humanized relative time + error tag | left | yes |

**Bank cell composition** follows Figma 87:13141 exactly: `[BankName] [icon] [VND/CCY • Type]` on row 1,
account number muted on row 2. The icon sits **between** the name and the currency label (not leading).

## 5. Last Update cell

`LastUpdateCell(lastUpdate, error, errorLabel)`:

- `error` (from `acct_bal_inq_stts` non-success) → red `errorLabel` ("Error") + humanized time if present.
- no timestamp → blank cell (`&nbsp;`).
- otherwise → muted humanized relative time ("40m ago", "1d ago", "3+ months ago") with the full datetime
  as the tooltip.

The displayed value is `acct_bal_upd_dtm`, whose backend source is `ACCT_HIS_LST_INQ_DT` (FD-only fallback
`ACCT_BAL_LST_INQ_DTM`) per FCY-A02 — the frontend contract is unchanged; only the value source flipped on
the backend. The legacy >72h stale-red indicator is **not** reproduced (FCY-A05, OPEN).

## 6. Amount formatting

All amounts route through `formatAmount(value, ccyCd, includeSymbol)` from `lib/currency.ts`: `$…` (en-US
prefix) for USD/EUR/KRW/JPY, `…₫` (vi-VN suffix) for VND, vi-VN no-symbol otherwise. Each FCY row formats
per **its own** `currencyCd`, not a page-wide currency. The same function feeds the summary tiles, the
balance popup footer, and (server-side mirror) the Excel subheader, so the number reads identically
everywhere.

## 7. States

| State | Render |
|---|---|
| Initial loading | centered "Loading…" (sticky ≥400ms) |
| Empty | `t("account_inquiry.empty_fcy")` |
| Refetch | prior rows held by the stable-data latch (no flash) |
| Update button | disabled until ≥1 selectable row checked |
| Row not selectable | checkbox disabled + tooltip (`account_inquiry.disabled.manual` / `.disconnected`) |
| Error | global `useDialog({ type:"error", errorCode })` |

## 8. Responsive

Desktop-first; verified at 375 / 768 / 1024 / 1440. Filter row wraps below `md`; the grid scrolls
horizontally below its min-width; summary tiles stack below `md`. Same behaviour as the VND baseline.

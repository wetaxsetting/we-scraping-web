# Exchange Rate Inquiry — UI Specification

Visual + interaction spec for `ExchangeRateInquiryPage` (Figma 38:13376). Standalone
Figma-specific component — NOT `PaymentListPage` / `DataTableShell`. Typography + tokens
follow the global WB365 system; no inline px sizes.

---

## 1. Page shell

- `<PageLayout>` → `<PageHeader title={t("payment.exchange_rate.title")} />` → `<FilterRow>` → matrix block.
- No `<PageActionButtons>` toolbar, no pagination, no `<DataTableShell>`.

## 2. Filter row (`<FilterRow>`)

Left children, in order:

1. **Choose bank** — label `payment.exchange_rate.choose_bank` + custom `<FilterDropdown>`
   (width `154px`) with a bank-logo `prefixIcon`. Opens a `DropdownPopover` listing
   `{ bank_cd → bank_nm }`. Logos: Shinhan / Woori PNGs from `/assets/banking_VN/icon/`.
2. **Sequence No. / Notification Round** — label switches to `notification_round` for Woori,
   `sequence_no` otherwise; `<FilterDropdown>` (width `150px`) + `DropdownPopover` of rounds.
3. **Reference date** — shared `<DateField value={refDate} onChange={setRefDate}>` (chip +
   calendar popup).
4. **Compare with** — checkbox (`accent var(--color-brand)`) + label
   `payment.exchange_rate.compare_with` + a compare-bank `<FilterDropdown>` (width `154px`,
   dimmed `opacity-40 pointer-events-none` when unchecked).

Right slot (`right` prop): `<SearchInput value={search} onChange={setSearch} placeholder={t("common.search")}>`.

## 3. Currency-matrix table

- Bare `<table className="w-full table-fixed border-collapse">` inside a
  `custom-scrollbar min-h-0 flex-1 overflow-auto` container (custom shape — not a shared shell).
- `<colgroup>`: `--w-wb-er-currency` + per rate type `--w-wb-er-rate` (×1 normal, plus
  `--w-wb-er-rate` + `--w-wb-er-diff` when compare is on).
- Sticky `<thead>` (`sticky top-0 z-10 bg-wb-bg-sidebar`).

### Columns (normal — 5)

| Column | Header | Cell |
|---|---|---|
| Currency | `payment.col.currency` (sortable, `CURRENCY`) | flag SVG (28×28) + ISO code; circular fallback badge with first 2 chars when no flag |
| Cash Buy | two-line: bank name + `col.cash_buy` (sortable `CASH_BUY`) | right-aligned `formatExchangeRate(buyAmt)` or `-` |
| Cash Sell | bank name + `col.cash_sell` (`CASH_SELL`) | right-aligned |
| T/T Buy | bank name + `col.tt_buy` (`TT_BUY`) | right-aligned |
| T/T Sell | bank name + `col.tt_sell` (`TT_SELL`) | right-aligned |

Bank-name header is shortened (`(Vietnam)` → ` VN`).

### Columns (compare — 13)

Per rate type: `[Bank1 | Bank2 | Diff]`. Bank1/Bank2 cells render the formatted rate; Diff is a
pill: positive `bg-wb-status-approved-bg`, negative `bg-wb-status-rejected-bg` with
`(parenthesised)` value, zero approved-bg `0.00`, `-` neutral when either side null/zero.
Compare column header carries a display-only sort glyph (sort applies to primary only).

## 4. Sort glyphs

- Inactive: `/assets/table/ico-sort.svg` (`h-3 w-2`).
- ASC: lucide `ChevronUp` `size-3.5 text-brand`; DESC: `ChevronDown size-3.5 text-brand`.
- Cycle: default → ASC → DESC → default. Nulls always sort last. `aria-sort` set on the active `<th>`.

## 5. Empty states

- No rows after filter/sort: centered `payment.exchange_rate.empty` (`text-wb-13 text-wb-ntrl-6`).
- During the initial sticky-load window (≥ 400 ms): centered `common.loading`.

## 6. Error dialog

- API failure → `useDialog().open({ type: "error", title: t("dialog.error"), description: t("payment.exchange_rate.error.load_failed") })`.
- No silent mock fallback (the earlier "silently shows mock VND data" behaviour is gone).

## 7. Date picker

- Shared `<DateField>` (chip + Figma single-date calendar popup); commits ISO `YYYY-MM-DD`,
  the page strips dashes before sending `ref_date`.

## 8. "Inquired on" footer

- Bottom-right `<p>` (Figma 38:14116), `border-t`, `text-wb-13 text-wb-ntrl-6`,
  `payment.exchange_rate.inquired_on` with `{date}` = `DD/MM/YYYY HH:MM:SS` from the first
  rate row's `lastUpdateDate` + `lastUpdateTime`.

## 9. Typography / tokens

- Body/cells `text-wb-13`; rate-column bank-name header `text-wb-14 font-semibold`; rate-type
  subline `text-wb-13 text-wb-ntrl-6`. Column widths via `--w-wb-er-*` tokens only — no
  `text-[Npx]` / inline styles. Scroll container uses `custom-scrollbar`; popovers use
  `custom-scrollbar-y`.

## 10. Locale keys

`payment.exchange_rate.*` namespace (EN/KO/VI): `title`, `choose_bank`, `sequence_no`,
`notification_round`, `last_time`, `first_time`, `compare_with`, `inquired_on`, `empty`,
`error.load_failed`, `col.cash_buy`, `col.cash_sell`, `col.tt_buy`, `col.tt_sell`,
`col.diff`; plus `payment.col.currency` and shared `common.search` / `common.loading` /
`dialog.error`.

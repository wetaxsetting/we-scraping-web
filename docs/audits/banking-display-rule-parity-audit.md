# Banking — Legacy Display-Rule Parity Audit & Fix (2026-06-26)

> **STATUS — CLOSED 2026-06-27 (accepted with documented limitations).**
> *Banking implemented pages display-rule parity completed; Exchange Rate and export/backend follow-ups remain documented.*
> The implemented Banking pages match the legacy display rules for the approved scope
> (amounts via shared `formatAmount`; Transaction History locale-aware dates; long text via
> shared `EllipsisTooltip`; `SearchSelect` native `title` removed; Organizer Settings Type =
> single Contains/Exact). No new formatter/tooltip utility, no backend code change, no Payment
> business-logic change. `tsc` ✅ · `build` ✅ · ESLint remaining items are pre-existing (see
> [tech-debt.md](../tech-debt.md) TD-1).
>
> **Accepted remaining follow-ups (not part of this closure):**
> 1. **Exchange Rate** under Banking is **not refactored** — feature gap, not complete.
> 2. **Excel export per-currency formatting** — backend follow-up (`ExcelWorkbookWriter` fixed `#,##0.##`; `AmountFormatter.forDisplay` USD `en-US`).
> 3. **Smart Organizer `RCV_PAY_DV`** — backend should derive from the Purpose usage-group (see [wecms-api/.../smart-organizer/refactor-gap-analysis.md §4 FB-01](../../../wecms-api/docs/features/banking/smart-organizer/refactor-gap-analysis.md)).
> 4. **Native `title` follow-ups** — `BalancePopover.tsx:253` (refId), `TransferHistoryTable.tsx:193` (statusMessage; needs shared `Tooltip`, not `EllipsisTooltip`). Minor UI.
> 5. **Account Inquiry bank-cell tooltip** — cosmetic (no tooltip today; not a native-title violation).
> 6. **Report-page local date slicers** (e.g. Daily Cash `formatDmyChip`) — pre-existing, not on the shared `lib/datetime` formatter.

Module-wide audit of how every **Banking** screen renders amounts, exchange
rates, numbers, dates, status, alignment, and long text — compared against the
live JEX system (source of truth) — plus the fixes landed to bring the refactor
back to legacy parity using the shared formatters and shared table components.

- **Scope:** Banking top menu — Current & Savings (VND/FCY), Internal Transfer,
  Reports (Daily Cash / Daily Financial CMC + HS / Cash Flow), Exchange Rate,
  shared dialogs / tables / formatters.
- **Method:** Analyze → Compare with Legacy → Root Cause → Impact → Approve →
  Implement → Verify (project workflow).
- **Outcome:** HIGH + MEDIUM frontend fixes landed (frontend only, no backend
  change). `tsc --noEmit` ✅ · ESLint ✅ (0 errors) · `next build` ✅.

Backend twin context: [`wecms-api/docs/features/banking/`](../../../wecms-api/docs/features/banking/README.md).
Shared rules: root CLAUDE.md §"Global Typography" + wecms-web CLAUDE.md §5/§7/§13a.

---

## 1. Legacy display rules (source of truth)

The legacy "Current & Savings" screens live in the **`fnsh`** family (not
`comm_02xx`); reports are `rept_*` / `cash_*`; FX is `exch_0001_001`; transfers
are `trns_*`. All legacy paths are under `WECMS DEV/`.

### Shared amount formatter
- Locale **`id-ID`** → dot thousands, comma decimal — `WECMS_STATIC/web/js/osmc/osmc_baseData.js:9`; `WECMS_STATIC/ts-src/js/wabooks/osmc.ui.ts:111-112`.
- Precision: **USD = 2dp, all other CCY = 0dp** — `osmc.ui.ts:84-106` (VND `550.000`, USD `10,00`).
- Symbols: VND `₫` suffix, USD `$` / KRW `₩` prefix, USD/KRW negatives parenthesised — `osmc_baseData.js:27-31`. Grid cells use no symbol; footers/summary prepend the CCY code.
- Zero/empty: inquiry & transaction grids → `null2zero` → `0`; reports (Daily Cash / Daily Financial HS / Cash Flow) → blank `""`.

### Date / number helpers — `WECMS_STATIC/ts-src/js/wabooks/wabooks.comm.ts`
- VI date `DD-MM-YYYY` (`:1359`), datetime `DD-MM-YYYY HH:mm:ss` (`:1423`), time `HH:MM:SS` (`time_format2:1164`), relative `humanizeDatetime` (`:1207`).
- **Transaction History is per-language**: EN `DD-MMM-YYYY`, KO `YYYY-MM-DD`, VI `DD-MM-YYYY` — `fnsh_0002_001_osmc_VN.ts:921-928`.
- Account number `bank_format` strips dashes — `:1109`.

### Per-screen
| Screen | Legacy file | Rules |
|---|---|---|
| Account Inquiry VND | `fnsh_0001_001_api_osmc.ts` | `BAL`/`REAL_AMT`→`formatAmount(...,VND,false)` `:852,859` right `tar`; acct no `bank_format` `:814`; Last Update `humanizeDatetime`+tooltip `:732`; footer CCY-coded totals `:613-637`. |
| Account Inquiry FCY | `fnsh_0005_001_api_osmc.ts` | Same; CCY selectable default USD `:158`; per-account popup Credit `cBlue`/Debit `cRed` `:1234`. |
| Transaction History VND | `fnsh_0002_001_osmc_VN.ts` | `IN_AMT`/`OUT_AMT`/`BAL`→`formatAmount(...,VND,false)` right `:1104-1118`; per-language date `:921-928`; footer `Total(VND)`+totals `:1256-1341`; unconfirmed row `yellow-bg` `:912`; default sort `trsc_dt:desc` (`FnshHelper.java:7029`). |
| Transaction History FCY | `fnsh_0006_001_osmc_VN.ts` | Identical, CCY = account FCY `:166`. |
| Own Account Transfer | `trns_0001_007.ts` | Balance `formatAmount(...,ccy,false)` `:1115`; amount input currency-masked `:1174`. |
| Transfer History | `trns_0003_001.ts` | Amount `formatAmount(...,ccy,false)` right `:316`; acct no `bank_format` `:302,312`; status colored text `cGreen`/`cRed` (success `00000000`) `:326-336`; footer VND-only total `:251`. |
| Daily Cash | `rept_0009_001_osmc.ts` | `formatAmount(...,ccy,includeSymbol)` `:274-288`; null→`""`; counts `Math.trunc` right. |
| Daily Financial CMC/HS | `rept_0015_001.ts` / `rept_0017_001.ts` | Both `formatAmount`; HS zero/NaN/null→blank `:396-408`; HS columns from View Setting. Two live variants — keep both. |
| Cash Flow | `cash_0001_001.ts` | `formatAmount(...,selectedCcy,false)`; zero→blank `:561-564`; editable FX rate defaults to USD sell. |
| Exchange Rate | `exch_0001_001.ts` | Rate cells `format_amt_max(amt,"USD")` (hardcoded USD) `:790,871-888`; empty→`-`; Diff `toFixed(2)` green/red pill `:794-805`; Woori notification-round `:945-999` / Shinhan sequence `:917-922`; latest round via `SEQ_NO="0"→max` (`exch_0001_001_r001_act.jsp:137-166`); **no weekend fallback**. |

---

## 2. Refactor mismatches (pre-fix)

| # | Sev | Screen | Legacy | Refactor (was) | File |
|---|---|---|---|---|---|
| M1 | HIGH | Transaction History VND/FCY | `formatAmount` id-ID grouping | raw backend string `row.deposit ?? "0"` | `components/banking/transaction-history/columnRegistry.tsx`, `TransactionTableFooter.tsx` |
| M2 | HIGH | Transaction History VND/FCY | amount cols right (`tar`) | left-aligned | columnRegistry.tsx / TransactionTable.tsx / footer |
| M3 | HIGH | Daily Cash | ledger amounts `formatAmount` | ledger cells raw | `components/banking/reports/daily-cash/DailyCashPage.tsx` |
| M4 | HIGH | Daily Financial HS | `formatAmount`, zero→blank | all amounts raw | `components/banking/reports/daily-financial-hs/DailyFinancialHsPage.tsx` |
| M5 | HIGH | Scrape / Smart-Organizer dialogs | `formatAmount` | balance/amounts raw | `ScrapeResultDialog.tsx`; `SmartOrganizerDialog.tsx` |
| M6 | MED | Transaction History | per-language date | fixed `DD-MM-YYYY` | `lib/api/mappers.ts` + columnRegistry.tsx |
| M7 | MED | Daily Cash, Daily Financial HS | no sort | inert sort glyphs (missing `sortable={false}`) | DailyCashPage.tsx, DailyFinancialHsPage.tsx |
| M8 | MED | Own Account Transfer | shared formatter | inline `Intl.NumberFormat("vi-VN")` | `OwnAccountTransferComposerDialog.tsx` |
| M9 | MED | Transaction History | `title` tooltip on long text | silent `truncate`, no tooltip | columnRegistry.tsx (File Name / Matched By) |

**Not bugs / out of scope:**
- Backend correctly returns **raw** values (no display strings) — formatting is a frontend concern. ✅
- **Exchange Rate (Inquiry / Notification / History) is not refactored under Banking** — feature gap, not a display bug. Only the payment-side `components/payment/overseas-payment/ExchangeRateInquiryPage.tsx` exists, using the shared `formatExchangeRate` (en-US); reconcile with legacy `format_amt_max` (id-ID) when Banking FX is built.
- Backend Excel export divergences are pre-existing documented follow-ups: `ExcelWorkbookWriter` uses fixed `#,##0.##` (not per-currency id-ID); `AmountFormatter.forDisplay` uses `en-US` for USD. See memory `reference_wecms_amount_format_idID.md`.

---

## 3. Fixes landed (HIGH + MEDIUM, frontend only)

All amount formatting routes through the shared **`formatAmount(value, ccy, includeSymbol)`**
([`lib/currency.ts`](../../lib/currency.ts)); locale-aware dates through
**`formatDateLang`** ([`lib/datetime.ts`](../../lib/datetime.ts)); long-text
clipping through the shared **`EllipsisTooltip`** ([`components/shared/EllipsisTooltip.tsx`](../../components/shared/EllipsisTooltip.tsx));
alignment + sort glyphs through the shared **`TableHeaderCell`** ([`components/shared/TableHeaderCell.tsx`](../../components/shared/TableHeaderCell.tsx)).

| Area | Change |
|---|---|
| Transaction History (M1/M2/M6/M9) | Deposit/Withdraw/Balance + footer totals → `formatAmount(..., currency, false)`, right-aligned via a new `align` field on the column registry; Date/Time → `formatDateLang(dateRaw, locale)` (raw `trsc_dt` carried on the row); File Name + Matched By wrapped in `EllipsisTooltip`. `currency` + `locale` threaded into the column-render context. |
| Daily Cash (M3/M7) | Debit/Credit/Balance ledger cells → `formatAmount(..., row.currency, false)`; all `TableHeaderCell` set `sortable={false}`. |
| Daily Financial HS (M4/M7) | Entry + subtotal + total amounts → `formatAmount(..., group.currency, false)` (preserving the `-` empty convention); all `TableHeaderCell` set `sortable={false}`. Values arrive raw from `fn_get_haengsung_daily_financial_report` (no double-format). |
| Dialogs (M5) | `ScrapeResultDialog` balance + `SmartOrganizerDialog` withdrawal/transfer amounts → `formatAmount`. |
| Own Account Transfer (M8) | `formatVndDigits` now delegates to `formatAmount(x, "VND", false)` — inline `Intl.NumberFormat` removed. |

### Before / After
```
Transaction History amount cell
- {row.deposit ?? "0"}                                  // "1000000"
+ {formatAmount(row.deposit, currency, false)}          // "1.000.000" (VND) / "10,00" (USD), right-aligned

Daily Financial HS
- {entry.balance || "-"}                                // "5000000"
+ {entry.balance ? formatAmount(entry.balance, group.currency, false) : "-"}   // "5.000.000", empty→"-"

Own Account Transfer
- new Intl.NumberFormat("vi-VN").format(n)
+ formatAmount(rawDigits, "VND", false)
```

---

## 4. Files changed

- [`components/banking/transaction-history/columnRegistry.tsx`](../../components/banking/transaction-history/columnRegistry.tsx)
- [`components/banking/transaction-history/TransactionTable.tsx`](../../components/banking/transaction-history/TransactionTable.tsx)
- [`components/banking/transaction-history/TransactionTableFooter.tsx`](../../components/banking/transaction-history/TransactionTableFooter.tsx)
- [`components/banking/transaction-history/TransactionHistoryPage.tsx`](../../components/banking/transaction-history/TransactionHistoryPage.tsx)
- [`components/banking/transaction-history/types.ts`](../../components/banking/transaction-history/types.ts)
- [`components/banking/transaction-history/SmartOrganizerDialog.tsx`](../../components/banking/transaction-history/SmartOrganizerDialog.tsx)
- [`components/banking/reports/daily-cash/DailyCashPage.tsx`](../../components/banking/reports/daily-cash/DailyCashPage.tsx)
- [`components/banking/reports/daily-financial-hs/DailyFinancialHsPage.tsx`](../../components/banking/reports/daily-financial-hs/DailyFinancialHsPage.tsx)
- [`components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx`](../../components/banking/own-account-transfer/OwnAccountTransferComposerDialog.tsx)
- [`app/(dashboard)/banking/credentials/ScrapeResultDialog.tsx`](../../app/(dashboard)/banking/credentials/ScrapeResultDialog.tsx)
- [`lib/api/mappers.ts`](../../lib/api/mappers.ts)

---

## 5. Verification

- `npx tsc --noEmit` → **0 errors**.
- `npx eslint` (changed files) → **0 errors**, 3 pre-existing warnings (unrelated to this change).
- `npm run build` → **success**.

---

## 6. Open questions / deferred

- **OQ-1 (LOW):** account numbers are rendered raw across Banking; legacy `bank_format` strips dashes. Deferred pending confirmation of whether the refactor API already returns dash-free account numbers.
- **OQ-2 (LOW):** page-specific inline-hex row tints (`bg-[#FFFEDB]` unconfirmed-row, `bg-[#EBF5FF]` selected-row) mirror legacy `yellow-bg` but are off-token — migrate to `wb-*` tokens in a future pass.
- **OQ-3 (GAP):** Exchange Rate (Inquiry / Notification / History) is not refactored under Banking. When built, reconcile the shared `formatExchangeRate` (en-US) with legacy `exch_0001_001` `format_amt_max` (id-ID) + the notification-round / sequence / latest-round / no-weekend-fallback rules.
- **OQ-4 (BACKEND):** align `ExcelWorkbookWriter` / `AmountFormatter.forDisplay` to per-currency id-ID (`reference_wecms_amount_format_idID.md`). Backend MR, out of this frontend pass.

---

## Related docs
- Per-screen specs: [current-savings-vnd/](../features/banking/current-savings-vnd/README.md) · [current-savings-fcy/](../features/banking/current-savings-fcy/README.md) · [internal-transfer-vnd/](../features/banking/internal-transfer-vnd/README.md) · [reports/](../features/banking/reports/README.md)
- Banking module index: [features/banking/README.md](../features/banking/README.md)
- Audit index: [../audits/README.md](README.md)
- Backend twin: [`wecms-api/docs/features/banking/`](../../../wecms-api/docs/features/banking/README.md)

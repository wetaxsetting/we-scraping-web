# Daily Financial — UI Specification

Implementation-accurate UI spec for both variants. Source files cited inline. Backend field shapes:
[wecms-api/.../interface-specification.md](../../../../../../wecms-api/docs/features/banking/reports/daily-financial/interface-specification.md).

---

## 1. CMC variant (`/banking/reports/daily-financial`)

Main component: [DailyFinancialPage.tsx](../../../../../components/banking/reports/daily-financial/DailyFinancialPage.tsx).
Client wrapper: [DailyFinancialClient.tsx](../../../../../components/banking/reports/daily-financial/DailyFinancialClient.tsx).

### 1.1 Search / filter area (`FilterRow`)

| Control | Type | Binding | Default |
|---|---|---|---|
| **As of** | `<DateField>` single-date picker (`DD-MM-YYYY`) | `asOfIsoDate` → backend `yyyyMMdd` via `toBackendDate` | today |
| **Currency** | `<CurrencyScopeToggle>` (All / VND / FCY) | `scope` → wire `ALL`/`VND`/`FCY` via `toWireScope` | All |
| **Show account nickname** | `<FilterCheckbox>` | `showNickname` (page-local; toggles the Account Nickname column) | on |
| **Show active accounts only** | `<FilterCheckbox>` | `activeOnly` → `activeAccountsOnly` | on |
| **Include internal transfers** | `<FilterCheckbox>` | `includeInternalTransfers` | on |
| **Search** | `<Button>` (lucide `Search`, `disabled={loading}`) | sets `hasSearched`, fires fetch | — |

- No `<SearchInput>` keyword field (report page — §7e). Search **button** only.
- Currency/Date/checkbox changes after the first Search auto-refetch (`bumpIfSearched`).

### 1.2 Empty state

Before first Search: centered placeholder, key `report.daily_financial.empty_message`
("Please click the Search button."). Occupies the same `flex-1 min-h-0` slot as `<ReportLayout>` so
flipping to results does not jump the layout (§7b).

### 1.3 Toolbar (only when `hasSearched`)

Excel + Print icon buttons (`ico-excel.svg` / `ico-print.svg` at `size-5`).
⚠️ **Divergence (flagged):** these sit in a separate right-aligned `<div>` below the filter row, not
in `<PageHeader>` — §7e says report actions belong in the title row (the HS variant does it
correctly). Track for a stabilisation pass.

### 1.4 Summary section — Financial Status

One `<FinancialStatusTable>` per visible currency (VND / USD / KRW). 2-column mini-table:

| Column | Source field (wire → mapped) |
|---|---|
| Current Accounts total | `CURRENT_ACCOUNTS` → `currentAccounts` |
| Saving Accounts total | `SAVING_ACCOUNTS` → `savingAccounts` |
| (table title) per-currency Total | `TOTAL` → `total` (= current + saving) |

Values formatted via `formatAmount` ([lib/currency.ts](../../../../../lib/currency.ts)) — VND `₫` suffix
(vi-VN), USD prefix (en-US), KRW `₩`. **No FX conversion** — amounts are native per currency.

> The legacy Cash / Time-Deposit / Loan total panels are **not rendered** (commented out in legacy —
> Redmine #42129). The legacy `CURRENCY_FLOW` (REC3) rollup is dropped. Do not add them.

### 1.5 Grid — Current Accounts / Saving Accounts (`<CurrentAccountsTable>`)

Wide table: `table-fixed`, `min-w` 1944 (with nickname) / 1764 (without). Wrapped in
`custom-scrollbar-x overflow-x-auto` (§7d). Columns (13 with nickname, 12 without):

| # | Column | i18n key | Notes |
|---|---|---|---|
| 1 | Bank | `col.bank` | `<CellLink>` → opens tx popup |
| 2 | Account No. | `col.account_no` | `<CellLink>` |
| 3 | Account Nickname | `col.account_nickname` | only when `showNickname`; `<CellLink>`; falls back to `bank` |
| 4 | Currency | `col.currency` | |
| 5 | No. of Debits | `col.num_debits` | `numDebits` |
| 6 | Debit | `col.debit` | `formatAmount` |
| 7 | No. of Internal Debits | `col.num_internal_debits` | renders `0` when `includeInternalTransfers` off |
| 8 | Internal Debit | `col.internal_debit` | masked to `0` when toggle off |
| 9 | No. of Credits | `col.num_credits` | |
| 10 | Credit | `col.credit` | |
| 11 | No. of Internal Credits | `col.num_internal_credits` | masked when toggle off |
| 12 | Internal Credit | `col.internal_credit` | masked when toggle off |
| 13 | Balance | `col.balance` | as-of end-of-day balance |

- **Account-type partition** ([DailyFinancialPage.tsx](../../../../../components/banking/reports/daily-financial/DailyFinancialPage.tsx)): Current = `03/04/07`; Saving = `05/06/08`. Codes `01` (loan) / `02` (time deposit) fall into neither.
- **Sort:** all headers `sortable={false}` — no sorting on this report.
- **Empty rows:** `common.no_rows` row spanning all columns.
- **Per-currency Total rows** at the bottom via `computeTotalsByCurrency`.
- **Internal-transfer masking** is **display-only** — when the toggle is off the internal columns render `0`, but the backend does not exclude internal transactions from the totals (P1/G-4, documented in the backend gap analysis).

### 1.6 Detail popup — `<TransactionHistoryDialog>`

[TransactionHistoryDialog.tsx](../../../../../components/banking/reports/daily-financial/TransactionHistoryDialog.tsx).
shadcn `<Dialog>` `stackLevel={2}`, `w-[1024px] max-w-[92vw] rounded-2xl` — modeled on the e-Invoice
Latest Inquiry History popup. **READY FOR SIT.**

- Header: As of / Bank + Account / Currency.
- Table columns: **Time · Debit · Credit · Balance · Remarks**. `inOutDiv === "2"` → Debit, `"1"` → Credit. `formatTime` converts `HHmmss → HH:mm:ss`; an empty `TRSC_TM` renders blank **by design** (source rows carry no time — verified, not a defect; see backend README §6).
- Empty: `tx_dialog.empty` (centered, fixed height). Loading: `common.loading` row.
- Footer summary: `tx_dialog.summary` → "Total {N} transaction(s) / Total Debit: … Total Credit: … Balance: …".
- Pagination: bespoke (popup-local), default size **10**, options **10/20/50/100**, page-size dropdown opens **upward**. Does **not** use the shared `<Pagination>` (intentional — popup-local).
- ⚠️ On fetch error the dialog falls back to an empty zeroed table rather than surfacing `useDialog()` — flagged for a stabilisation pass.

---

## 2. HS variant (`/banking/reports/daily-financial-hs`)

Main component: [DailyFinancialHsPage.tsx](../../../../../components/banking/reports/daily-financial-hs/DailyFinancialHsPage.tsx).

### 2.1 Header + filters

- `<PageHeader>`: title + right toolbar (list icon · print · **Download Excel** label button with `ico-excel.svg`) — §7e-compliant.
- `<FilterRow>`: "As of" + **static date chip `08-09-2025`** + `<FilterDropdown>` (All Accounts, static) + Search button **with no handler**. ⚠️ All HS filters are **non-functional** in the current static UI.

### 2.2 Ledger table (`<LedgerTable>` + `<BankGroupRows>`)

`table-fixed min-w-[1820px]`. 12 columns: Bank Name · Currency · Receipt Code · Payment Code ·
Description (English) · Description (Korean) · Customer/Supplier · Before Balance · Receipt · Payment ·
Balance · Memo. `rowSpan` cells for Bank Name (+ accent label / subtitle / due date) and Currency.
Sub-total row (`bg-wb-status-progress-bg`, colspan 7) per group; conditional TOTAL row
(`bg-wb-status-approved-bg`) when `group.closesTotal`. Empty numeric → `"-"`, empty text → `""`.

⚠️ Headers use `sortable` default (renders a glyph) but **no sort wiring** — inert glyphs (minor §13a anti-pattern, flagged).

---

## 3. Export & print

Both variants export **client-side** (`xlsx-js-style`), **not** via the backend `/export` endpoint
mandated by §13b. Documented as an intentional interim departure in
[lib/reportExcel.ts](../../../../../lib/reportExcel.ts) (most report backends are stubs / no
`DailyFinancialExportProvider` exists yet).

| Variant | Excel handler | Filename | Print |
|---|---|---|---|
| CMC | `DailyFinancialPage#handleExportExcel` — builds the workbook directly to mirror the legacy `rept_0015_001` layout (merged title, as-of subheader, per-currency Financial Status mini-tables, ledger sections + Total footers); honors `showNickname` + `includeInternalTransfers` | `DailyFinancial_${DDMMYYYY}.xlsx` | `handlePrint` → shared `printReport` (multi-section) |
| HS | `DailyFinancialHsPage#handleExportExcel` — shared `exportReportExcel`, flattens `BankGroup[]` → rows (inline Sub Total / TOTAL) | `DailyFinancialHS_${DDMMYYYY}.xlsx`, sheet "Daily Financial HS" | `handlePrint` → shared `printReport` (flat) |

> **Migration note:** when a backend `DailyFinancialExportProvider` + `POST …/daily-financial/export`
> lands (and the `WEB_SVC_ID = 'daily-financial'` View Setting seed is added), migrate both variants
> to the shared `useExcelExport()` hook per §13b and drop the `xlsx-js-style` import.

---

## 4. i18n

54 `report.daily_financial*` keys per locale across `locales/{en,ko,vi}.json`. Namespaces:
`report.daily_financial.*` (title, empty_message, scope.{all,vnd,fcy}, opt.{nickname,active_only,internal_transfers}, status_*, section.*, col.*),
`report.daily_financial.tx_dialog.*` (popup), `report.daily_financial_hs.*` (HS ledger).
Shared: `report.as_of`, `report.currency_label`, `report.download_excel`, `common.{search,print,loading,no_rows}`.

---

## 5. View Setting

Daily Financial is **not** registered in [lib/viewSettingScreens.ts](../../../../../lib/viewSettingScreens.ts) —
consistent with it being a report page (§7b), not a paginated list page (§13). Column visibility/order
is not user-configurable; the CMC "Show account nickname" checkbox is a page-local toggle, not View
Setting.

---

## 6. Known deviations (fix in a stabilisation pass — not feature gaps) {#known-deviations}

| Deviation | Location | Rule |
|---|---|---|
| Hardcoded `text-[36px]` title | `DailyFinancialPage.tsx` (sticky title card) | §5 — no `text-[Npx]`; add a token first |
| Inline `style={{ color: "#494949" }}` in `<CellLink>` | `DailyFinancialPage.tsx` | "No inline `style`" |
| CMC toolbar in a separate div, not `<PageHeader>` | `DailyFinancialPage.tsx` | §7e — report actions in the title row |
| HS inert sort glyphs | `DailyFinancialHsPage.tsx` `<LedgerTable>` | §13a — `sortable` only when wired |
| Popup swallows fetch errors into empty table | `TransactionHistoryDialog.tsx` | should route to `useDialog({type:"error"})` |
| Mock account-type bug | `daily-financial/mockData.ts` rows use `accountTypeCd:"11"` (neither current nor saving) → mock ledgers render empty if fallback hits | mock-only; real API rows use correct codes |

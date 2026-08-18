# Account Inquiry (VND) — UI Specification

**Route:** `/banking/account-inquiry` · **Screen ID:** `banking-account-inquiry-vnd` · **Hub:** [README.md](README.md)

Layout, columns, formatting, and states. This screen is an **approved UI baseline** — see
[architecture/components/main-page-ui-rule.md](../../../../architecture/components/main-page-ui-rule.md)
for the canonical typography/spacing/icon rules it sets.

---

## 1. Page chrome

- Standard menu-page shell: `<AppShell>` (sidebar + top nav) → `PageHeader` (title + `PageActionButtons` List/Print/Excel)
  → filter row → summary tiles → `DataTableShell` (table) → `Pagination`.
- Typography via WB365 tokens only (`text-wb-13` table cells, `text-wb-18` page title, etc.) — no inline px/font.

## 2. Filter row

| Control | Component | Binding |
|---|---|---|
| Bank dropdown | `BankFilterPopover` (in `AccountInquiryPage`) | `banks_available` → `serverPaging.onBankCdChange` |
| Keyword search | `SearchInput` | debounced → `serverPaging.onKeywordChange` |
| Date chip | `DateField` | balance-popup date context |
| Currency dropdown | `CurrencyFilterPopover` | **FCY only** — hidden on VND (`multiCurrencyMode=false`) |
| Update / Sync | button | opens `TransactionSyncDialog` for selected rows |

## 3. Summary tiles

`SummaryTile` × (per currency — single VND tile here): account-count chip · **Available Balance** · **Balance**.
Server totals preferred (`totals_by_ccy[VND]` → scalar `available_bal`/`balance`); client-side sum only as a
fallback. Amounts via `formatAmount(value, ccy, true)` (with `₫` symbol).

## 4. Table columns

Driven by the View Setting `COLUMN_REGISTRY` (FIELD_ID → header + width + align + `renderBody`). Visible set =
`USE_YN='Y'` items in `DISP_ORD` order. The selection checkbox is prepended in JSX (not part of View Setting).

| FIELD_ID | Header | Render | Align | Sortable |
|---|---|---|---|---|
| `CHECKBOX` | — | row select; disabled for manual/disconnected accounts (+ tooltip) | center | no |
| `BANK` | Bank | composite: `bankName` + ico-building + `VND • <type>` chip, with `accountNo` sub-line (Figma 87:13141 order) | left | yes |
| `ACCOUNT_NICKNAME` | Account / Nickname | formatted nickname | left | yes |
| `BALANCE` | Balance | `formatAmount(balance, ccy, false)` | right | yes |
| `AVAILABLE_BALANCE` | Available Balance | `formatAmount(available, ccy, false)` | right | yes |
| `LAST_UPDATE` | Last Update | `<LastUpdateCell>` — Success/Failed/datetime (see §6) | left | yes |
| `VAS_ACCOUNT` | VAS Account | placeholder `—` (hidden by default) | left | no |

Header text stays single-line (`whitespace-nowrap`); sort glyph via shared `<TableHeaderCell>` (inactive
`ico-sort.svg`, ASC/DESC = lucide chevron `text-brand`).

## 5. Amount formatting (VND)

`lib/currency.ts formatAmount(value, ccy="VND", includeSymbol)`:
- VND → vi-VN locale (period thousands), 0 decimals, `₫` **suffix** → `1.000.000₫`.
- Table cells: `includeSymbol=false`; summary tiles: `includeSymbol=true`.
- Null/empty balance renders `-`, never `0`. Mirrors backend `AmountFormatter.forDisplay` 1:1.

## 6. Last Update + status rendering {#last-update}

`<LastUpdateCell>` consumes the mapped row's `lastUpdate` (`acct_bal_upd_dtm` wire, sourced from
`ACCT_HIS_LST_INQ_DT` for online accounts since 2026-06-06 / FCY-A02 — `ACCT_BAL_LST_INQ_DTM`
fallback only for fixed-deposit-only banks; legacy parity) and `error` (mapped from `acct_bal_inq_stts`):

| Row state | Cell |
|---|---|
| Success (`acct_bal_inq_stts` ∈ `00000000`/`42110000`, `error=false`) | humanized datetime (`dd-MM-yyyy HH:mm:ss` via `lib/datetime.ts`); >72 h old → stale warning glyph + tooltip |
| Failed (`error=true`, code `ERR`/`ERROR`/other) | red **Failed** label |
| No data | blank / "No update information" |

The backend ships the raw status code; the mapper (`mapAccountRow`) derives the `error` boolean — the UI
owns the Success/Failed/datetime presentation (parity with JEX `fnsh_0001_001.ts`).

## 7. States

| State | Behaviour |
|---|---|
| Initial loading | sticky loading (`useStickyLoading`, min 400 ms) so fast responses don't flash |
| Sync loading | `TransactionSyncDialog` in-flight gate; challenge dialogs for OTP/CAPTCHA/QnA |
| Update-balance loading | row re-fetch after sync completes |
| Empty result (filtered) | friendly empty message |
| Empty (no accounts) | distinct empty message |
| Error | global `useDialog({type:"error"})` with `trace_id`; table stays on last stable data |

## 8. Responsive

Desktop-first; verified 375/768/1024/1440. Table scrolls horizontally below its min width; filter row wraps;
summary tiles stack; pagination reflows. Shared scrollbars (`custom-scrollbar*`).

---

## Cross-references

- Component/file index: [component-index.md](component-index.md)
- API consumption: [api-consumption.md](api-consumption.md)
- Backend interface spec: [wecms-api/docs/features/banking/current-savings-vnd/account-inquiry/interface-specification.md](../../../../../../wecms-api/docs/features/banking/current-savings-vnd/account-inquiry/interface-specification.md)

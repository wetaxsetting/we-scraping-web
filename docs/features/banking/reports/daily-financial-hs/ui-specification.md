# Daily Financial (HS) — UI Specification

> Verified against `DailyFinancialHsPage.tsx` / `columns.ts` / `projectRows.ts`. Figma reference:
> 9183:18510 (ledger) / 9183:18709 (header) / 291:7180 (list icon). Legacy visual reference:
> `dev.wecms.vn/rept_0017_001.act` (side-by-side screenshots reviewed during the 2026-07 fix
> loop — backend final audit §7).

---

## 1. Header (title row + filter row — §7e two-row contract)

| Zone | Content |
|---|---|
| Title row left | `<PageHeader>` title `t("report.daily_financial_hs.title")` — "Daily Financial (HS)" |
| Title row right | list-icon button (opens View Setting; captures its `DOMRect` as the popover anchor) + **Download Excel** button using `/assets/common/ico-excel.svg` (§8a — never lucide) |
| Filter row left | `t("report.as_of")` label + `<DateField>` (display `DD-MM-YYYY`, ISO state, custom `formatValue`) · `<BankFilterPopover>` multi-select · Search `<Button variant="outline">` with lucide `Search` icon + `t("common.search")`, `h-[var(--h-wb-filter-btn)]`, disabled while loading |
| Filter row right | **unused** — no `<SearchInput>` on this page (§7e; adding one is a regression) |

## 2. Table

- Wrapped in `<ReportLayout>` (single scroll viewport; `custom-scrollbar`; §7b height contract —
  no `<Pagination>`, no `<DataTableShell>`, no fixed pixel heights).
- `table-fixed` with a `<colgroup>` of the **visible** columns; runtime
  `min-width = Σ visible widthPx` so hiding columns never leaves a blank right strip and
  horizontal scroll stays correct (backend final audit fix 10).
- Sticky `<thead>`; each header cell renders **two lines: KO label over EN label**
  (`col_ko.*` + `col.*` keys) — mirroring the legacy bilingual header.
- No sort glyph wiring — all 12 columns are seeded `sort_yn='N'` (report page).

### 2.1 Column registry (12 columns, `COLUMN_REGISTRY` in [columns.ts](../../../../../components/banking/reports/daily-financial-hs/columns.ts))

| # | FIELD_ID | Header (EN / KO) | Width px | Kind | Align |
|---|---|---|---|---|---|
| 1 | `BANK` | Bank Name / 은행명 | 125 | `bank` — frozen, rowSpan | left |
| 2 | `CURRENCY` | Currency / 통화 | 78 | `currency` — frozen, rowSpan | left |
| 3 | `RECEIPT_CODE` | Receipt Code / 입금코드 | 170 | `input` (editable) | left |
| 4 | `PAYMENT_CODE` | Payment Code / 출금코드 | 170 | `input` (editable) | left |
| 5 | `DESCRIPTION_EN` | Description (English) / 적요(현지) | 200 | `input` (editable) | left |
| 6 | `DESCRIPTION_KO` | Description (Korean) / 적요(번역) | 200 | `input` (editable) | left |
| 7 | `COUNTERPARTY` | Customer / Supplier / 고객 / 거래처명 | 200 | `text` (read-only) | left |
| 8 | `BEFORE_BALANCE` | Before Balance / 전일잔고 | 135 | `number` | right |
| 9 | `RECEIPT` | Receipt / 입금 | 135 | `number` | right |
| 10 | `PAYMENT` | Payment / 출금 | 135 | `number` | right |
| 11 | `BALANCE` | Balance / 통장잔고 | 135 | `number` | right |
| 12 | `MEMO_NOTE` | Memo / 메모 | 285 | `input` (editable; TOTAL row shows the company actual-balance figure here) | left |

> `MEMO_NOTE`, not `MEMO` — `MEMO` is a reserved special View-Setting FIELD_ID the shared popover
> would hide. Widths mirror the legacy `sys_scr_option_wecms` seed (V249).

### 2.2 Row taxonomy & styling

| Row | Rendering |
|---|---|
| Group frozen cells | `BankCell`: bank name (`text-wb-13 font-semibold`) + optional account-type parenthetical + red accent label (e.g. BRANCH) + account number (muted) + optional red `Due Date` label/value — all parsed from the wire `bank_account` header string by `projectRows.parseBankHeader`. `rowSpan = entries + 1` (entries + SUB TOTAL; TOTAL rows sit **outside** the span). |
| BEFORE_BALANCE entry | plain cells; codes/descriptions blank (no input boxes); Before Balance amount only |
| TRANSACTION entry | `InputCell` on the five editable columns (`h-8` bordered input, placeholder = EN column label, `focus:border-brand`); plain cells elsewhere |
| SUB TOTAL | blue background row; `SummaryCells` — one `<td>` per visible column; the label sits in (or shares) the cell left of the first numeric column, values right-aligned |
| TOTAL | green background row when `group.closesTotal`; same per-column cell rule; Memo column carries `total.memo` (= `balance_company_actual`) |

- **Empty cells stay blank** — null amounts render `""`, never `"0"`, and text columns never echo
  the column label as placeholder text in read-only cells (§7c rule).
- **No spacer rows** — exactly one `<tr>` per data row (legacy tbody parity, `ΣTᵢ + 2A + C`).
- Amounts are **pre-formatted at projection time** via `formatAmount(value, ccy, false)`
  (id-ID grouping, no currency symbol) — cells never re-format at render.

## 3. Editable cells (per-field save UX)

- Editable **only** when `col.kind === "input" && entry.editable` (TRANSACTION rows).
- Commit on **blur or Enter**, only when the value changed (`savedRef` tracking); remount-keyed by
  the projected value so a refetch clears local drafts.
- Success is silent; failure opens the shared error dialog (`useDialog`, `type: "error"`).
- No spinner/checkmark, no optimistic totals, no auto-refetch — persisted context appears on the
  next Search (legacy parity).

## 4. View Setting

- Shared `<ViewSettingPopover>` + `useViewSetting(SCREEN_IDS.BANKING_REPORTS_DAILY_FINANCIAL_HS,
  DEFAULT_AREA_ID)`; draft-local editing; Save→PUT / Reset→DELETE / Close→discard.
- Labels resolved via the page's `FIELD_LABEL_KEY` registry (i18n), falling back to `field_nm`.
- All 12 columns are user-controllable (no locked columns; no CHECKBOX/ETC specials on this
  screen).
- Fallback: `DEFAULT_VIEW_SETTING_ITEMS` (all visible, registry order) while loading or when the
  environment is unseeded (`WBE2001`).

## 5. States

| State | Rendering |
|---|---|
| Loading | Search button disabled; table renders last data (initial mount: fallback columns prevent an empty flash) |
| Empty (no rows) | empty ledger body inside `<ReportLayout>` — page chrome (filters/buttons) stays interactive |
| Fetch error | `useApiData` surfaces the error path; bank-options fetch degrades silently (empty dropdown) |
| Save/download error | shared error dialog with `status.code` |

## 6. Responsive / scroll

- §7b viewport contract: only the report body scrolls (1440×900 and 1024×768 both required);
  horizontal scroll inside the `<ReportLayout>` wrapper when narrower than the visible-column sum
  (§7d single-table variant — wrapper directly inside `<ReportLayout>`, `overflow-x-auto`).
- Frozen Bank/Currency cells are **rowSpan** frozen (vertical grouping), not sticky-left frozen —
  they scroll horizontally with the table. (An always-visible sticky label column was attempted
  and reverted 2026-07-01 because a wide sticky colSpan cell overlaid the numeric cells; see the
  backend legacy-audit "Delivered" notes.)

## 7. Typography & tokens

Standard WB tokens throughout (`text-wb-13` cells, `text-wb-18` page title via `<PageHeader>`,
token-based status backgrounds for the blue/green summary rows). No `text-[Npx]`/inline font
styles in the feature folder. *(Exact token names per cell are in the component source; no
deviations were flagged for this page in the 2026-07 audits.)*

# Smart Organizer — UI Specification (Frontend)

Layout, controls, grid, and states for the Smart Organizer page (`SmartOrganizerPage`) and the
Organizer Settings dialog (`OrganizerSettingsDialog`). Functional truth: JEX `fnsh_0200_001` /
`fnsh_0200_002`.

---

## 1. Page layout

```
┌──────────────────────────────────────────────┐
│ Breadcrumb: Transaction History > Smart Organizer │  ← header (+ Back)
├──────────────────────────────────────────────┤
│ [DateRangePicker]  [Search]   [Organizer Settings] │  ← filter row
├──────────────────────────────────────────────┤
│ ┌ thead (2 rows) ───────────────────────────┐ │
│ │ Bank Transaction Data       │ Confirmation │ │  ← section headers
│ │ ✓ Date Acct# Deposit Withdraw Remarks │ Reporting Purpose VAS Contact │
│ ├────────────────────────────────────────────┤ │
│ │ rows (selectable, 60px high)               │ │
│ │ …or empty-state (wand + CTA)               │ │
│ └────────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│ (when ≥1 selected)  [Cancel]  [Save (n)]       │  ← selection footer
├──────────────────────────────────────────────┤
│ [10 ▼]  "x of y"   [← →]                       │  ← pagination
└──────────────────────────────────────────────┘
```

## 2. Filters (filter row)

| Control | Binding | Notes |
|---|---|---|
| Date range | `from_dt`/`to_dt` | Default Jan 1 – Dec 31 current year; ISO in-memory → `yyyyMMdd` on the wire |
| Search | `q` | Trimmed keyword; `ILIKE` substring on remark server-side |
| Organizer Settings | opens `OrganizerSettingsDialog` | Also reachable from the empty-state CTA |

There is **no currency filter and no account dropdown** — the account is fixed by `?account=` (R11),
and currency follows that account (R06).

## 3. Transaction grid

Two logical column groups under a two-row sticky header. View Setting (`screenId='smart-organizer'`)
governs visibility/order; sort uses `useTableSort` against the backend whitelist.

| # | Column | Section | Sort key | Align | Render |
|---|---|---|---|---|---|
| 0 | Checkbox | — | — | center | per-row + select-all |
| 1 | Date | Bank Transaction Data | `TRSC_DT` | left | `trsc_dt` → `YYYY-MM-DD` |
| 2 | Account No. | Bank Transaction Data | `ACCT_NO` | left | `acct_no` |
| 3 | Deposit | Bank Transaction Data | `IN_AMT` | right | `formatAmount(in_amt, ccy_cd, true)` |
| 4 | Withdrawal | Bank Transaction Data | `OUT_AMT` | right | `formatAmount(out_amt, ccy_cd, true)` |
| 5 | Remarks | Bank Transaction Data | `RMRK` | left | `rmrk` |
| 6 | Reporting Account | Confirmation | `CHART_ACCT_CD` | left | `chart_acct_nm ?? chart_acct_cd` (R07) |
| 7 | Purpose | Confirmation | `USE_USAG_CD` | left | `disp_usag_nm ?? use_usag_cd` (R07) |
| 8 | VAS Account | Confirmation | `VAS_ACCT_SEQ_NO` | left | `disp_vas_acct_nm ?? vas_acct_seq_no` (R07) |
| 9 | Contact | Confirmation | `TRCO_KEY` | left | `disp_trco_nm ?? trco_key` (R07) |

- **Match status** is implicit — only rule-matched, unconfirmed rows are returned, so every visible row
  is a match candidate (`matched_rmrk_seq_no` non-null).
- **Confirmation status** is implicit — confirmed rows have already left the list.
- **Currency display (R06):** amounts use `formatAmount(value, ccy_cd, includeSymbol)`; VND → `₫`,
  USD → `$`, KRW → `₩`. No per-currency code branch.
- Selected rows are tinted (`bg-[#EBF5FF]`); row height `--h-wb-table-row` (60px).

## 4. Selection footer + pagination

- The footer appears only when `selected.size > 0`: **Cancel** (clears selection) and
  **Save (n)** (`t("smart_organizer_page.save", { count })`).
- Pagination is client-side over the fetched page (`usePagination`, options 10/20/50/100, default 10).

## 5. Empty / loading states

| State | UI |
|---|---|
| No account / no matches | Centered wand icon + description + "Go to Organizer Settings" CTA |
| Loading | `useStickyLoading` (≥200 ms) prevents empty-flash |
| Saving | sticky saving state on the Save button |

## 6. Organizer Settings dialog (`OrganizerSettingsDialog`)

Portal modal (`w-[1140px]`, legacy-compatible). Two modes:

- **View mode** — read-only rule grid + search; **Edit** and **+ Add** buttons.
- **Edit mode** — inline-editable draft; per-row Delete; drag handle for reorder; **Save**/**Cancel**.

Columns (per legacy `fnsh_0200_002_view.jsp`):

| Column | Edit control |
|---|---|
| No. | (auto index) |
| Remark | `<input maxLength=500>` (required) |
| Type | two `FilterSelect`s stacked — Match (`C`/`E`) + Direction (`RCV`/`PAY`) |
| Reporting Account | `ReportingAccountSelect` |
| Purpose | `PurposeSelect` |
| VAS Account | `VasAccountSelect` |
| Contact Name | `ContactSelect` |
| Actions (edit only) | Delete |

**Validation:** every live (non-deleted) row must have a non-blank Remark before Save
(`organizer_settings.remark_required`). On Save the dialog issues DELETE (flagged rows) → POST (new) →
PUT (changed) and recomputes `disp_ord` from row position, then fires `onChanged()` so the page
refetches.

## 7. i18n

- `smart_organizer_page.*` — page: `breadcrumb`, `organizer_settings`, `go_to_organizer_settings`,
  `empty_description`, `save` (count), `confirm_success` (count), `col.*`, `section.*`.
- `organizer_settings.*` — dialog: `title`, `edit`, `add_rule`, `save_rule`, `delete`,
  `remark_required`, `col.*`, `match.contains`/`match.exact`, `direction.receive`/`direction.pay`.
- `txn_history.smart_organizer` — the launch button label.

See [component-index.md](component-index.md) for the component/file map and
[api-consumption.md](api-consumption.md) for endpoint contracts.

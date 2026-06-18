# Approval Box — UI Specification (Frontend)

Layout, tokens, and component rules for `/payment/approval-box`. Approval Box is the approved **tabbed-feature-page baseline** (root `CLAUDE.md` → UI Implementation Baseline #2). All sizing goes through the shared `text-wb-*` / `wb-status-*` tokens — no inline px.

---

## 1. Page layout

```
PageLayout
├── PageHeader  title="Approval Box"
│   └── PageActionButtons (showList · showPrint · showExcel)
├── ApprovalTabs           (All · Pending · In Progress · Approved · Rejected + counts)
├── FilterBar              (DateRangeFilter [left]  ·  SearchInput [right])
└── DataTableShell footerMode="paginationWithStickyFooter"
    ├── table:   ApprovalTable  (+ empty/loading placeholder)
    ├── footer:  ApprovalTableFooter
    └── pagination: Pagination
+ ApprovalDetailsDialog (shared) · ViewSettingPopover (shared)
```

The header/toolbar follows the single-top-control-block rule (root `CLAUDE.md` §11): title + toolbar on one row, tabs + filter below.

## 2. Toolbar (`PageActionButtons`)

`showList` (→ View Setting popover), `showPrint` (→ `printReport`), `showExcel` (→ `useExcelExport`). Icons from `/assets/common/` at `size-5`.

## 3. Tabs (`ApprovalTabs`)

5 tabs, `role="tablist"`. Active tab gets `border-b-2 border-brand-active`. Each shows `t("approval.tab.<key>")` + the count from `data.tabCounts`. `draft` is intentionally omitted.

## 4. Filter row (`FilterBar`)

Shared `DateRangeFilter` (preset 30/90/180-day or manual range, `relative z-20` so the dropdown sits above the sticky `thead`) on the left + `SearchInput` on the right; wraps below `md`. Status filtering is via the tabs, not the filter bar.

## 5. Table (`ApprovalTable`)

Bare `<table>` + shared colgroup pattern, `table-fixed`, sticky `thead`. Columns, order, width, and sortability are **View-Setting-driven** via `APPROVAL_COLUMN_REGISTRY` (keyed by `FIELD_ID`) — never a static N-column table. Column width from the wire `item.size` (e.g. `"120px"`) with a `FALLBACK_WIDTH_BY_FIELD` fallback; `FALLBACK_COLUMNS` (11 cols) paints before the View Setting resolves.

Registered FIELD_IDs: `REG_DTM` (Date) · `DOC_NM` (Type) · `DOC_NO` (Document No.) · `TITL` (Title) · `FILE_NM` (File Name) · `CURRENCY` · `TOT_PAY_AMT` (Amount, right-aligned) · `PAY_END_YN` (Approval Status) · `PAY_DATE` (Scheduled) · `DRAFT_USER_NM` (Requestor) · `APPRER_NM` (Approver). Plus the always-prepended row-selection / checkbox handling is omitted (bulk selection was removed 2026-05-17 — no checkboxes rendered).

- **Document No. cell** renders a `<button class="text-brand hover:underline">` — the entry point to the Approval Details dialog.
- **File Name** ellipsis-truncates (`TextSpan` `truncate`) and shows the full value on hover via the native `title` attribute.
- Table text is `text-wb-13`: header `font-semibold`, body `font-medium`.

## 6. Status display

### Status badge (`StatusBadge`)
`inline-flex rounded-[6px] border px-[7px] text-wb-14-loose font-medium`. Token map (`bg`/`text`/`border`): `draft → wb-status-draft-*`, `pending → wb-status-pending-*`, `in_progress → wb-status-progress-*`, `approved → wb-status-approved-*`, `rejected → wb-status-rejected-*`. Renders `"{label} {step}"` when a step (e.g. `1/3`) is present — e.g. "In Progress 1/3".

### Approver cell + popover (`ApprovalTable` internals)
First approver name + `X/Y` count chip (`rounded-[4px] bg-wb-ntrl-3 text-wb-10`) + chevron. Popover (`role="dialog"`, `w-[360px]`, 3-stop shadow) lists each approver: line # · avatar (`User`) · name + `actedAt` · status pill. `ApproverStatusPill` / `statusVisuals`:
| `apprvr_stts` | Icon | Tone | Label key |
|---|---|---|---|
| `A` | `CheckCircle2` | approved | `approval.approver_status.A` |
| `R` | `XCircle` | rejected | `approval.approver_status.R` |
| `P` | `Hourglass` | pending | `approval.approver_status.P` |
| `W` / `S` | `AlertCircle` | pending | `approval.approver_status.unable` |

## 7. Footer (`ApprovalTableFooter`)

Free-form summary bar (6-col CSS grid, not a `<table>`) rendered inside the shell but outside the horizontal-scroll container. Col 1 = `approval.document_count` (`{count}` = `footerDocumentCount`); cols 2–4 = per-currency `approval.total_label` + bold total (USD / VND / KRW = `footerCurrencyTotals`); cols 5–6 = spacers.

**Footer source (2026-06-16, G1/G4).** Both the document count and the three currency totals are **backend-provided** via `footer_totals` on the list response — **tab-unfiltered, computed over the full result set** (legacy `resl_0001_001` parity), not a client page-slice sum. The page binds `documentCount={footerDocumentCount}` and `totals={currencyTotals}` (from `data.footerCurrencyTotals`, with a three-currency zero fallback for the first paint before any response latches). The former page-slice `approvalBoxCurrencyTotal(displayRows)` was removed. Card-payment rows (`appr_dv='33'`) contribute `SUM(CARD_TRNS_HSTR.TRSC_AMT)` resolved server-side (G5). Note: `total_count` (tab-filtered) still drives **pagination**, not the footer count.

## 8. Approval Details dialog (shared `ApprovalDetailsDialog`)

Opened from the Document No. link. Shows: title, status badge, document no, content (`row.cont`, hidden when null), scheduled date, total amount (`formatAmount(amount, currency, true)`), withdrawal account, approver chips (`ApproverStatusCode` P/A/R/W/S/C/I), per-line transactions table (lazily loaded), requester / requested-at, and the action footer (Reject + Approve pair when actionable; kebab Edit/Delete/Re-submit when mutable). Edit mode swaps the approver chips for an inline `EditApprovalLinePicker` (no stacked modal).

## 9. Empty / loading

- Loading (initial): centered `common.loading`, `text-wb-13 font-medium text-wb-ntrl-6`.
- Empty: centered `approval.empty` ("Approval Box Not Found"), `flex flex-1 items-center justify-center px-3 py-12`.

## 10. Pagination

Shared `<Pagination>` outside the scroll container. Page-size default 10 (`PAGE_SIZE_OPTIONS[0]` — intentional project divergence from legacy 15); count text via `common.showing_of`.

## 11. i18n

All copy via `t(...)`. Key prefix `approval.*` (`approval.title`, `approval.empty`, `approval.tab.*`, `approval.col.*`, `approval.type.*`, `approval.approver_status.*`, `approval.action.*`, `approval.total_label`, `approval.document_count`, `approval.deeplink.not_found`). Dialog uses `payment.approval_details.*` + `payment.request_approval.type.*`.

> **Known locale gaps to fix** (see [test-scenarios.md](test-scenarios.md)): `ApprovalBoxPage` references `approval.action.approve_success` / `approve_failed` / `reject_success` / `reject_failed`, which are not in `en.json` (existing keys are `approval.success.*` / `approval.action.{edit,delete}_*`) — the raw key currently leaks on success. Also a duplicated `approval.col.file_name` key in `en.json`.

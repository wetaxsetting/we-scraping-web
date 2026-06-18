# Approval Box — Screen Flow (Frontend)

Route `/payment/approval-box` → `app/(dashboard)/payment/approval-box/page.tsx` (server component, `metadata.title = "Approval Box — WeCMS"`) → `<ApprovalBoxPage />` (`"use client"`, the orchestrator). Route protection is the `(dashboard)` layout guard (`fetchMe()` on mount, redirect to `/login` if no token). Menu-level access via `lib/menuAuth.ts` (`ROUTE_MENU_MAP` → `payment-approval-box`).

---

## 1. Initial load

1. `ApprovalBoxPage` calls `useApprovalBoxList()` (state) + `useViewSetting(SCREEN_IDS.PAYMENT_APPROVAL_BOX)` (column config) + `useTableSort()` (sort cycle) + `useExcelExport()`.
2. `useApprovalBoxList` fires `GET /api/v1/payment/approval-box` with the default filters (period preset, no keyword, `all` tab, page 0). The mapper computes per-row `actionable` from the signed-in user id.
3. While loading and no stable data yet, a centered `common.loading` placeholder shows (≥400ms min via `useStickyLoading`). On data, the table renders; a render-phase **stable-data latch** keeps prior rows visible across later refetches so the table never flashes empty.

## 2. Filtering & tabs

- **Tabs** (`ApprovalTabs`): All / Pending / In Progress / Approved / Rejected — `setTab` → `TAB_TO_APPR_TYPE_CD` → `appr_type_cd`. Counts from `data.tabCounts` (the "All" count = sum of the four; "Draft" is omitted).
- **Date range** (`FilterBar` → shared `DateRangeFilter`): preset `Last 30/90/180 Days` or "Enter Manually" (seeds the manual range from the active preset so chips never open empty). Derived ISO dates → `from_date`/`to_date` (`YYYYMMDD`).
- **Search** (`SearchInput`): `setSearch` → `srch_wd` (trimmed).
- Every filter setter resets `page` to 0 first (mirrors legacy `fn_loadData(input, true)`), then triggers a fresh GET (run-id "latest wins" cancellation guards out-of-order responses).

## 3. Sorting

Header click cycles `default → ASC → DESC → default` (`useTableSort`). The page pushes the cycle into the list hook (`setSort`), so the next fetch carries `sort_field`/`sort_direction` and the DB does the ORDER BY — never a client-side `Array.sort`. Sortable columns come from the View Setting `SORT_YN` flag; `CHECKBOX`/`ETC` and the Approver column are never sortable.

## 4. Approver popover (in-table)

The Approver cell shows the first approver name + an `X/Y` count chip + a chevron. Clicking opens an in-table popover (`role="dialog"`) listing each approver via line # · avatar · name + action date · status pill. ESC and outside-click close it. Empty chain → `—`.

## 5. Approval Details dialog (open)

Clicking the **Document No.** link → `openDocumentDetails(row)`:
1. Sets `detailsRow`; a `useEffect` lazily loads the per-line transactions via `pickDetailLoader(typeKey)` — Internal Transfer / Vendor / Expense / Payroll / Overseas use their module detail endpoint (keyed by `documentNo`); Corporate Card uses `fetchCardTransactionsByApproval(apprSeqNo)`. Errors → system error dialog.
2. Renders the shared `ApprovalDetailsDialog` with title, status, document no, content, scheduled date, total amount, withdrawal account, approvers, transactions, requester/requested-at, and the action handlers.

## 6. Approve / Reject flow

- Approve/Reject buttons are passed **only** when `detailsRow.actionable` (the current user is the pending approver) and no mutation is in flight and not in edit mode.
- **Approve** (`handleApprove`): guard → set in-flight → `approveApprovalBoxRow(apprSeqNo)` → success system dialog → close dialog → `list.refetch()`. Catch → error dialog with `err.code`.
- **Reject** (`handleReject`): same shape via `rejectApprovalBoxRow`. The backend cascades downstream waiting approvers to Stopped — no extra client work.

## 7. Kebab actions (Edit / Delete / Re-submit)

Shown only when the document is mutable (Pending / In Progress):
- **Edit** (change approval line): swaps the approver chips for an inline `EditApprovalLinePicker`; Save dispatches per kind — card → `changeCardApprovalLine`, else `changeApprovalBoxApprovalLine(apprSeqNo, apprLineNo)`. Save disabled until a line is picked.
- **Delete** (withdraw): a `confirmation` dialog → on confirm, card → `withdrawCardApproval`, else `withdrawApprovalBoxRow`. Success → success dialog → refetch.
- **Re-submit**: a `warning` placeholder dialog (`approval.action.resubmit_not_implemented`) — backend endpoint not landed.

## 8. Deep-link (notification click)

A notification click navigates here with `?appr_seq_no=<id>`. The page auto-opens the Approval Details dialog for that row and highlights it (fires once via `deepLinkHandledRef`). If the id is not in the current list slice → a `warning` dialog (`approval.deeplink.not_found`).

## 8a. Footer summary

The footer bar (`ApprovalTableFooter`) renders the document count + per-currency totals (USD / VND / KRW) **from the backend `footer_totals`** — tab-unfiltered, computed over the full result set (legacy `resl_0001_001` parity, G1/G4). The page binds `footerDocumentCount` + `footerCurrencyTotals` from the mapped response; it does **not** sum the visible page slice. Switching tabs leaves the footer unchanged (tab-unfiltered); only pagination's `total_count` is tab-filtered. Card-row amounts (`appr_dv='33'`) come from the server-side `SUM(CARD_TRNS_HSTR.TRSC_AMT)` (G5). See [ui-specification.md §7](ui-specification.md) + [refactor-gap-analysis.md](refactor-gap-analysis.md).

## 9. Toolbar actions

- **List icon** → opens the shared `ViewSettingPopover` (column visibility/order).
- **Print** → `printReport` of the on-screen columns (filtered rows, not the page slice).
- **Excel** → `useExcelExport` → `POST /api/v1/payment/approval-box/export` with live View-Setting columns ∩ the 10 export columns (Approver excluded) + filters `{fromDate,toDate,apprType,keyword}` + sort.

## 10. Loading / empty / error / refresh states

| State | Behaviour |
|---|---|
| Initial loading | centered `common.loading` (sticky ≥400ms) |
| Empty | centered `approval.empty` ("Approval Box Not Found") |
| Refetch (non-initial) | stable-data latch keeps previous rows; no flash |
| List error | `error` system dialog with `error.code` + `trace_id` |
| Action error | `error` system dialog with `err.code` (`WBE9999` fallback) |
| Mutation in flight | Approve/Reject/menu handlers withheld (disabled) |
| Deep-link miss | `warning` dialog `approval.deeplink.not_found` |

## 11. UI refresh after a mutation

There is no react-query/SWR (banned). After a successful approve/reject/withdraw/change-line the handler closes the dialog and calls `list.refetch()` (= a fresh GET), which re-derives the tab counts and row status. The stable-data latch prevents an empty flash during the refetch.

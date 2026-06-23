# Approval Box — Component Index (Frontend)

Files under `components/payment/approval-box/` plus the shared collaborators. Route entry: `app/(dashboard)/payment/approval-box/page.tsx`.

---

## Component tree (as actually rendered)

```
app/(dashboard)/payment/approval-box/page.tsx          (server; renders <ApprovalBoxPage/>)
└── ApprovalBoxPage                                     (components/payment/approval-box/ApprovalBoxPage.tsx)
    ├── PageLayout / PageHeader / PageActionButtons      (shared)
    ├── ApprovalTabs
    ├── FilterBar  →  DateRangeFilter (shared) + SearchInput (shared)
    ├── DataTableShell footerMode="paginationWithTotals"
    │   ├── ApprovalTable  →  TableHeaderCell (shared) · StatusBadge · ApproverCell/ApproverRow/ApproverStatusPill (internal)
    │   ├── ApprovalTableFooter
    │   └── Pagination (shared)
    ├── ApprovalDetailsDialog (components/payment/shared/) → EditApprovalLinePicker (edit mode)
    └── ViewSettingPopover (components/shared/view-setting/)
```

---

## Active components

| File | Role | Key props / state |
|---|---|---|
| `ApprovalBoxPage.tsx` | Main orchestrator (~1100 lines). Owns list state, View Setting, sort, print/export, deep-link, and the Approval Details approve/reject/edit/withdraw workflow. | state: `detailsRow`, `detailsTxns`, `detailsWithdrawal`, `deepLinkApprSeqNo`/`highlightApprSeqNo`, `vsDraft`/`vsAnchor`, `editMode`/`pickedLine`, `stableData`/`prevData`, `actionInFlight`. Helpers: `TYPE_KEY_TO_KIND`, `rowKind`, `statusToOutcome`, `toDialogApprovers`, `pickDetailLoader`, `APPROVAL_FALLBACK_COLUMNS` (11), `APPROVAL_BOX_EXPORT_COLUMNS` (10). |
| `ApprovalTable.tsx` | The active registry-driven table (no checkbox column, no trailing action column). Exports `APPROVAL_COLUMN_REGISTRY` (FIELD_ID → `{headerKey, align?, renderBody}`). | props: `rows`, `items` (visible+ordered cols), `onDocumentNoClick`, `sortField`/`sortDirection`/`onSort`, `highlightApprSeqNo`. Internal: `ApproverCell`, `ApproverRow`, `ApproverStatusPill`, `statusVisuals`, `resolveColumnWidth`. |
| `ApprovalTableFooter.tsx` | Summary bar (6-col grid): document count + per-currency totals. | `documentCount`, `totals: CurrencyTotal[]`. |
| `ApprovalTabs.tsx` | 5-tab strip + counts. | `active`, `counts`, `onChange`. |
| `FilterBar.tsx` | Date-range + search filter row. | `period`/`onPeriodChange`, `manualRange`/`onManualRangeChange`, `search`/`onSearchChange`. Composes shared `DateRangeFilter` + `SearchInput`. |
| `StatusBadge.tsx` | Approval-status pill. | `status`, `step?`, `label?`. `wb-status-*` token map. |
| `types.ts` | Feature types (see [api-consumption.md](api-consumption.md) §types). | — |
| `useApprovalBoxList.ts` | List state + fetch hook (no react-query). | returns state + controls (see api-consumption.md §hooks). |

## Dead / unused files (present but NOT mounted by the live page)

| File | Why dead |
|---|---|
| `ApprovalTableColumns.tsx` | Static 10-col `<colgroup>`; superseded by View-Setting widths in `ApprovalTable`. |
| `BulkActionBar.tsx` | Bulk selection removed 2026-05-17 — no checkboxes rendered; the bulk-approve endpoint + Zod schema exist but have no live UI. |
| `RowActionDialog.tsx` | Standalone approve/reject confirm dialog — superseded by `ApprovalDetailsDialog`. Renders the read-only approver chain via the shared `ApproverChainList` (`components/shared/approver`). |
| `DateRangePicker.tsx` | Thin re-export of the shared picker; `FilterBar` uses `DateRangeFilter` instead. |

> These remain in the tree as legacy code. New work should not import them; the approve/reject workflow is **dialog-driven** via `ApprovalDetailsDialog`, not the row-button path.

## Shared components consumed

| Component | Path | Use |
|---|---|---|
| `ApprovalDetailsDialog` | `components/payment/shared/ApprovalDetailsDialog.tsx` | The detail + approve/reject/edit/withdraw surface |
| `EditApprovalLinePicker` | `components/payment/corporate-card/EditApprovalLinePicker` | Inline approval-line picker (edit mode) |
| `DataTableShell` / `Pagination` / `PageLayout` / `PageHeader` / `PageActionButtons` / `SearchInput` / `TableHeaderCell` | `components/shared/` | Page chrome + table shell |
| `DateRangeFilter` | `components/shared/` (via `FilterBar`) | Date preset/manual range |
| `ViewSettingPopover` / `useViewSetting` | `components/shared/view-setting/` | Column visibility/order |
| `useDialog` | `components/shared/dialog/` | System dialogs (success/error/warning/confirmation) |

## Hooks & lib helpers

| Symbol | Path | Use |
|---|---|---|
| `useApprovalBoxList` | `components/payment/approval-box/useApprovalBoxList.ts` | list state + fetch |
| `useViewSetting` | `components/shared/view-setting/useViewSetting.ts` | View Setting |
| `useTableSort` | `hooks/useTableSort.ts` | header sort cycle |
| `useExcelExport` | `hooks/useExcelExport.ts` | XLSX export |
| `useStickyLoading` | `hooks/` | min-visibility loading gate |
| `approval-box.ts` | `lib/api/approval-box.ts` | API client (see api-consumption.md) |
| `mappers.ts` | `lib/api/mappers.ts` | `mapApprovalBoxRow`, `mapTabCounts`, `mapApprovalBoxFooterTotals` (backend footer totals — G1/G4; replaced the page-slice `approvalBoxCurrencyTotal` 2026-06-16), status maps. `MappedApprovalBoxList` carries `footerDocumentCount` + `footerCurrencyTotals`. |
| `lib/api/cardTransactions.ts`, `lib/api/vendorPayment.ts`, etc. | per-module detail loaders dispatched by `pickDetailLoader` |
| `lib/datetime.ts`, `lib/currency.ts`, `lib/print.ts` | date/amount/print helpers |
| `lib/menuAuth.ts`, `lib/viewSettingScreens.ts`, `components/layout/sidebarNav.ts` | route auth, `SCREEN_IDS.PAYMENT_APPROVAL_BOX`, sidebar registration |

# Payment > Approval Box — Frontend Page Design

**Module:** Payment → Approval Management · **Menu:** Approval Box
**Route:** `/payment/approval-box` · **Slug:** `approval-box` · **JEX:** `pymn_0001_001` (centralized approval inbox)

- API side (rich, 6-doc folder): `approval-box` _(wecms-api backend repo — not included in this clone)_ — see discovery.md _(wecms-api backend repo — not included in this clone)_, design-frontend.md _(wecms-api backend repo — not included in this clone)_

## Overview
Centralized approval inbox consumed by every Payment write flow (internal-transfer / vendor / expense / payroll / overseas). Lists pending items with approval status, scheduled date, requestor, approver chain; supports approve / reject and hover cards.

## Page Location
`app/(dashboard)/payment/approval-box/` → `components/payment/approval-box/`.

## UI Components
- Approval inbox table; status badge; requestor/approver columns; hover card (approval status / approver chain); approve / reject controls; detail drill-down.

## User Actions
- Filter/scan pending approvals; hover for approver chain; open a row → detail (withdrawal bank, total amount, scheduled date, approver chain); approve / reject.

## Table Columns
Approval Status (badge) · Scheduled Date · Requestor · Approver · amount. *(Confirm against Figma + `design-frontend.md`.)*

## Dialogs / Popups
- Approval detail; hover card for status/approver.

## API Integration
- See API folder; approval endpoints under `domain.payment.approvalbox`. snake_case wire ↔ camelCase mappers.

## Validation
- Approver must be authorized for the item; per the approval-line rules.

## Parity Fixes & Decisions (2026-06-02)
Confirmed frontend behaviors — full detail, deferred items, and SIT checklist in the API-side note
[parity-fixes-2026-06.md](../../../../wecms-api-main/docs/features/payment/approval-box/parity-fixes-2026-06.md):
- **Page size** default is **10** by project decision (intentional divergence from legacy 15); pagination/sort unchanged.
- **File Name** column renders the uploaded file name (`file_name` wire field ← `ORG_FILE_NM`, not `TITL`). Long names ellipsis-truncate (shared `TextSpan` `truncate`) and show the full value on hover via the native `title` attribute — same pattern as `ErpTransactionHistoryTable`. No custom tooltip component; row height / column width / layout unchanged.
- **Withdraw / Edit approval line** wired for every type via per-kind dispatch in `ApprovalBoxPage.tsx`: card → `withdrawCardApproval` / `changeCardApprovalLine`; all non-card types → `withdrawApprovalBoxRow` / `changeApprovalBoxApprovalLine` (`lib/api/approval-box.ts`).
- **Excel export** posts the current filter/sort/View-Setting context; the backend returns all matching rows (bounded by the shared 50k cap), not the current page.
- **Notifications (implemented):** approval **request / approve / reject** now create notifications, and a notification click deep-links back here (`?appr_seq_no={id}` → row highlight + Approval Details auto-open). See [notifications.md](../../../../docs/refactor-wecms/features/notifications.md). **Comment** notifications remain deferred.
- **Deferred / out of scope:** ERP synchronization · approval **comment** notification creation · uploader visibility branch · Vietnamese translated keyword search.

## Notes
Cross-feature surface — not a payment-batch sibling. Detailed backend design lives in the API
`approval-box/` folder (api-flow.md _(wecms-api backend repo — not included in this clone)_, database-impact.md _(wecms-api backend repo — not included in this clone)_).

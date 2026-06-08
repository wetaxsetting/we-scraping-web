# Payment > Approval Box — Frontend Page Design (design-history stub)

> **Superseded for status/structure.** The consolidated, code-accurate frontend docs now live in the feature folder:
> ➡️ **[approval-box/README.md](approval-box/README.md)** — overview · [screen-flow](approval-box/screen-flow.md) · [ui-specification](approval-box/ui-specification.md) · [component-index](approval-box/component-index.md) · [api-consumption](approval-box/api-consumption.md) · [test-scenarios](approval-box/test-scenarios.md).
> This file is kept as design history. Note the `JEX: pymn_0001_001` label below is the **known typo** — the canonical JEX id is `resl_0001_001` (see the backend README).

**Module:** Payment → Approval Management · **Menu:** Approval Box
**Route:** `/payment/approval-box` · **Slug:** `approval-box` · **JEX:** `resl_0001_001` (centralized approval inbox; legacy doc said `pymn_0001_001` — typo)

- API side (consolidated 9-doc folder): [../../../../../wecms-api/docs/features/payment/approval-box/README.md](../../../../../wecms-api/docs/features/payment/approval-box/README.md)

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

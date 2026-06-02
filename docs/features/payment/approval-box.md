# Payment > Approval Box — Frontend Page Design

**Module:** Payment → Approval Management · **Menu:** Approval Box
**Route:** `/payment/approval-box` · **Slug:** `approval-box` · **JEX:** `pymn_0001_001` (centralized approval inbox)

- API side (rich, 6-doc folder): [`../../../../wecms-api/docs/features/payment/approval-box/`](../../../../wecms-api/docs/features/payment/approval-box/) — see [discovery.md](../../../../wecms-api/docs/features/payment/approval-box/discovery.md), [design-frontend.md](../../../../wecms-api/docs/features/payment/approval-box/design-frontend.md)

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

## Notes
Cross-feature surface — not a payment-batch sibling. Detailed backend design lives in the API
`approval-box/` folder ([api-flow.md](../../../../wecms-api/docs/features/payment/approval-box/api-flow.md), [database-impact.md](../../../../wecms-api/docs/features/payment/approval-box/database-impact.md)).

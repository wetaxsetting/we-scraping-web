# Overseas Payment > Scheduled Payment Details — Web (Refactor)

**Module:** Payment → Overseas Payment · **Screen:** Scheduled Payment Details
**Route:** `/payment/overseas-payment/scheduled-payment/[id]` · **JEX:** `pymn_0007_*` (Scheduled family) · **Component:** `<OverseasScheduledPaymentDetailPage>` → shared `<PaymentDetailPage>`

> Screen-level doc. Shared family UI (shell, shared components) lives in the hub [README.md](./README.md).

## Overview
Drill-down detail of one scheduled payment batch — per-line beneficiary items, amounts, withdrawal account, approver chain, attachments, and reporting-account assignment. Live-wired (no mock).

## Route/Page
- `app/(dashboard)/payment/overseas-payment/scheduled-payment/[id]/page.tsx` → `<OverseasScheduledPaymentDetailPage id={id}>` ([ScheduledPaymentDetailPage.tsx](../../../../components/payment/overseas-payment/ScheduledPaymentDetailPage.tsx)).

## Components
- Composes shared `<PaymentDetailPage>` (CLAUDE.md §12 — breadcrumb header + DetailSummary + FileCard + inner table, no pagination footer). Columns are View-Setting-driven (`SCREEN_IDS.PAYMENT_OVERSEAS_PAYMENT_SCHEDULED_DETAIL`, FIELD_ID → column-key map).

## Filters
- None on the detail page (it is a single-batch drill-down).

## Table Columns
- Per-line: beneficiary name · beneficiary bank · beneficiary account · currency · transfer amount · fee payer · memo · reporting account. View-Setting-driven.

## Sorting
- Optional header sort over the in-page rows (enableSort).

## Pagination
- None — detail pages render `<Pagination hidden>` (CLAUDE.md §12a).

## Dialogs/Popups
- File-card download; reporting-account assignment (`saveOverseasReportingAccount`).

## API Integration
- `GET /api/v1/payment/overseas-payment/scheduled/{id}/details` (`fetchOverseasPaymentDetail`) → `ApiOverseasPaymentDetailResponse` (summary + `rows[]` + `attachments[]` + `legacy_mmode` flags). Reporting account via `PATCH /{id}/details/{ovrsPymnDetlNo}/reporting-account`. File via `GET /{id}/file`.

## Validation
- Reporting account code + seq_no sent together.

## Known Gaps
- **Legacy M-mode** (`OVRS_PYMN_MSTR`-only records): the backend now renders the real remittance line(s) (`legacy_mmode=false`); `WBE2045` is thrown only when the id resolves in neither table. The residual full per-line **parity-coverage** decision (Option A vs B) is PO/DBA-blocked on UAT/PROD M-mode counts — see API [refactor-gap-analysis.md](../../../../../wecms-api/docs/features/payment/overseas-payment/refactor-gap-analysis.md) G-OVRS-1.

## Related Docs
- Feature hub: [README.md](./README.md)
- Sibling screens: [scheduled-payment.md](./scheduled-payment.md) · [payment-result.md](./payment-result.md) · [payment-result-details.md](./payment-result-details.md)
- API counterpart: scheduled-payment-details.md _(wecms-api backend repo — not included in this clone)_
- Cross-sibling index: _payment-module-overview.md _(wecms-api backend repo — not included in this clone)_
- JEX reference: payments.md _(legacy JEX source reference only — not included in this repository)_ · payment.md _(legacy JEX source reference only — not included in this repository)_

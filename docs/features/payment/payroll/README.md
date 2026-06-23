# Payment > Payroll — Frontend Page Design

> **Backend counterpart:** [wecms-api/docs/features/payment/payroll/README.md](../../../../../wecms-api/docs/features/payment/payroll/README.md). API and WEB are refactored together; keep slugs and contracts in sync.

**Module:** Payment → Payroll · **Slug:** `payroll` (route base) / audit `WSVC_ID` `payroll-payment` (backend package + REST base)
**Routes:** `/payment/payroll/{scheduled-payment, payment-result}` (+ `…/[id]` detail per screen) · **JEX:** `pymn_0005_*` (Scheduled) / `pymn_0006_*` (Result) — detail pages `pymn_0005_003` / `pymn_0006_002`
**REST base:** `/api/v1/payment/payroll-payment` (note `-payment`, not `/payroll`)

## Per-screen docs (this feature)

| Screen | Route | JEX | Doc |
|---|---|---|---|
| Scheduled Payment | `/payment/payroll/scheduled-payment` | `pymn_0005_001` | [scheduled-payment.md](scheduled-payment.md) |
| Scheduled Payment Details | `…/scheduled-payment/[id]` | `pymn_0005_003` | [scheduled-payment-details.md](scheduled-payment-details.md) |
| Payment Result | `/payment/payroll/payment-result` | `pymn_0006_001` | [payment-result.md](payment-result.md) |
| Payment Result Details | `…/payment-result/[id]` | `pymn_0006_002` | [payment-result-details.md](payment-result-details.md) |

## Standard feature docs

| Doc | Scope |
|---|---|
| [screen-flow.md](screen-flow.md) | Navigation + state flow across the 4 screens |
| [ui-specification.md](ui-specification.md) | Filters, tabs, summary cards, tables/columns, pagination, sorting, empty states, dialogs, upload/download, approval actions, result inquiry |
| [component-index.md](component-index.md) | Components, hooks, lib, API client |
| [api-consumption.md](api-consumption.md) | Every endpoint the FE calls + mapping |
| [test-scenarios.md](test-scenarios.md) | FE test gap + suggested scenarios |

- Shared pattern baseline: [internal-transfer.md](../internal-transfer/README.md)

## Overview
Payroll batch payments — same shell as the other four payment families: a Scheduled Payment list + a Payment Result list, each with a per-row detail drill-down (route, not dialog — CLAUDE.md §12). Payroll mirrors the Internal Transfer / Vendor / Expense batch-file pattern (CLAUDE.md §12a) and adds a Payroll-only **Payroll Type** column (Salary / Bonus) on both list pages.

> **No salary masking.** Payroll amounts render with the same `formatAmount`/`formatNumber` helpers as every other payment family — there is no per-cell masking or product-type-gated hiding in the shipped frontend code. (Earlier doc text speculating "payroll amounts may be masked" was incorrect.)

## Page Location
`app/(dashboard)/payment/payroll/{scheduled-payment,payment-result}/` (+ `[id]/`) → `components/payment/payroll/`.

| Route | page.tsx export | Component |
|---|---|---|
| `scheduled-payment/page.tsx` | `PaymentPayrollScheduledPage` | [`<PayrollScheduledPaymentPage>`](../../../../components/payment/payroll/ScheduledPaymentPage.tsx) |
| `scheduled-payment/[id]/page.tsx` | `PaymentPayrollScheduledDetailRoute` | [`<PayrollScheduledPaymentDetailPage>`](../../../../components/payment/payroll/ScheduledPaymentDetailPage.tsx) |
| `payment-result/page.tsx` | `PaymentPayrollResultPage` | [`<PayrollPaymentResultPage>`](../../../../components/payment/payroll/PaymentResultPage.tsx) |
| `payment-result/[id]/page.tsx` | `PaymentPayrollResultDetailRoute` | [`<PayrollPaymentResultDetailPage>`](../../../../components/payment/payroll/PaymentResultDetailPage.tsx) |

## Menu sections
- **Scheduled Payment** · **Scheduled Payment Details** · **Payment Result** · **Payment Result Details**.

## Components (this feature folder)

| File | Role |
|---|---|
| [`ScheduledPaymentPage.tsx`](../../../../components/payment/payroll/ScheduledPaymentPage.tsx) | Scheduled list — composes the shared [`<PaymentScheduledBatchListPage>`](../../../../components/payment/shared/PaymentScheduledBatchListPage.tsx). Adds the Payroll-only Payroll Type column via `extraColumnAfterStatus` and re-uses the shared `extraColumn` slot for Scheduled Date. |
| [`ScheduledPaymentDetailPage.tsx`](../../../../components/payment/payroll/ScheduledPaymentDetailPage.tsx) | Scheduled detail — composes the shared [`<PaymentDetailPage>`](../../../../components/payment/shared/PaymentDetailPage.tsx) with the canonical `scheduledDetailColumns` projected to the Payroll 5-column legacy subset via View Setting. |
| [`PaymentResultPage.tsx`](../../../../components/payment/payroll/PaymentResultPage.tsx) | Result list — composes the shared [`<PaymentResultBatchListPage>`](../../../../components/payment/shared/PaymentResultBatchListPage.tsx). Adds Payroll Type via the shared `extraColumns` slot; wires Excel export + per-row download. |
| [`PaymentResultDetailPage.tsx`](../../../../components/payment/payroll/PaymentResultDetailPage.tsx) | Result detail — composes the shared [`<ResultDetailView>`](../../../../components/payment/shared/ResultDetailView.tsx) with the canonical `resultDetailColumns` projected to the Payroll 8-column legacy subset via View Setting; wires Banking Match (Match / Unmatch). |
| [`PayrollPaymentUploadDialog.tsx`](../../../../components/payment/payroll/PayrollPaymentUploadDialog.tsx) | Excel-upload dialog (Download template → Browse → preview → Save draft). |
| [`PayrollMatchDialog.tsx`](../../../../components/payment/payroll/PayrollMatchDialog.tsx) | Result-detail Banking Match popup (candidate bank transactions → Match). |
| `types.ts` | Local row types (`PayrollScheduledRow`, `PayrollResultRow`). |

## User Actions
- **Scheduled:** Excel Upload → (draft created) → select rows → Request Approval → Approve/Reject via the Approval Details popup → Transfer (dispatch). Per-row: Delete (draft only), download original Excel, click Approval Ref to open the Approval Details popup, inline edit/withdraw the approval line.
- **Result:** filter by period / Completed / In Progress; open a row → result detail; per-row download original Excel; Excel export of the list. On the result detail: Match / Unmatch a batch to a bank transaction.

## Filters
- **Scheduled:** period dropdown (30/90/180 days + manual range) + calendar chip + **approval-status dropdown** (`All / Not requested / Pending / In Progress / Approved / Rejected`) + SearchInput. Mirror of Internal Transfer Scheduled (Figma 1:9972) per CLAUDE.md §12a. The "Request Approval" CTA lives in the toolbar.
- **Result:** period dropdown + calendar chip + **Completed / In Progress checkboxes** (two-status filter — mapped to backend `trnf_stts` `C`/`P`) + SearchInput. Mirror of Internal Transfer Result (Figma 1:11730).

## Table Columns

**Scheduled list** (shared 11-column shell + Payroll Type extra column, View-Setting driven):
CHECKBOX · Date/Time (`REG_DTM`) · File Name (`FILE_NM`) · No. of Transactions (`TOT_TRNS_CNT`) · Total Transfer Amount (`TOTAL_TRAN_AMT`) · Scheduled Date (`PAY_DATE`) · Approval Status (`APPR_STTS`) · **Payroll Type (`APPR_FUND_TP`)** · Requestor (`DRAFT_USER_NM`) · Approver (`APPRVR_NM`) · Approval Ref. (`APPR_DOC_NO`) · Approval Title (`TITL`) · ETC (action).

**Result list** (shared 8-column shell + Payroll Type extra column):
Date/Time (`TRAN_DT`) · File Name (`FILE_NM`) · No. of Transactions (`SCDUL_PYMN_DETL_NO`) · Total Transfer Amount (`TRAN_AMT`) · **Payroll Type (`APPR_FUND_TP`)** · Transfer Status (`PROC_STAT`) · Approval Ref. (`APPR_DOC_NO`) · Approval Title (`TITL`) · trailing download glyph.

> **Payroll Type** value map (legacy `pymn_0005_001.ts` / `pymn_0006_001.ts`): `"0"` → Salary, `"1"` → Bonus, else blank. On the Approval Details popup the label resolves with extra parity (`9` → Other, withdrawal-bank `11704088` → "Salary/Allowance/Bonus") via `resolvePayrollTypeLabel`.

Both list pages render the totals footer (single- or multi-currency) and pagination — required for Payroll per CLAUDE.md §12a.

## Dialogs / Popups
- Excel-upload dialog (`<PayrollPaymentUploadDialog>`).
- Request Approval dialog (shared `<RequestApprovalDialog kind="payroll">`) — read-only withdrawal account.
- Approval Details popup (shared `<ApprovalDetailsDialog kind="payroll">`) — Approve / Reject / kebab Edit (change approval line) / Withdraw, combined attachment list, shared `APPR_SEQ_NO` download endpoint.
- Banking Match popup (`<PayrollMatchDialog>`) on the Result detail.
- System dialogs via `useDialog()`.

## API Integration
All calls go through [`lib/api/payrollPayment.ts`](../../../../lib/api/payrollPayment.ts). **REST base is `/api/v1/payment/payroll-payment`** (note `-payment`, not `/payroll`). snake_case wire ↔ camelCase mappers in the page components; wire types reused from `lib/types/api.ts` (Internal Transfer shapes — `ApiScheduledTransferListResponse`, `ApiTransferResultListResponse`, etc.).

| Action | Endpoint |
|---|---|
| Scheduled list | `GET /api/v1/payment/payroll-payment` |
| Scheduled detail | `GET …/{id}` |
| Result list | `GET …/results` |
| Result detail | `GET …/results/{id}` |
| Result Excel export | `POST …/results/export` |
| Create draft (Excel save) | `POST …` (multipart) |
| Parse Excel | `POST …/uploads/parse` (multipart) |
| Withdrawal accounts | `GET …/withdrawal-accounts` |
| Delete draft | `DELETE …/{id}` |
| Request approval | `POST …/{id}/request-approval` (multipart, attachments) |
| Approval action (Approve/Reject) | `POST …/{id}/approval-action` |
| Withdraw approval | `DELETE …/{id}/approval` |
| Change approval line | `PUT …/{id}/approval-line` |
| Update reporting account | `PATCH …/{id}/lines/{lineId}/reporting-account` |
| Dispatch (Transfer) | `POST …/{id}/dispatch` |
| Original Excel download (shared by Scheduled + Result) | `GET …/{id}/file` |
| Banking match candidates | `GET …/{id}/match/candidates` |
| Match / Unmatch batch | `POST …/{id}/match` · `DELETE …/{id}/match` |

## View Setting / Sorting / Export
- **View Setting** — all four screens wire the shared `useViewSetting` + `<ViewSettingPopover>` keyed by `lib/viewSettingScreens.ts` screenIds: `PAYMENT_PAYROLL_PAYMENT_SCHEDULED`, `PAYMENT_PAYROLL_PAYMENT_SCHEDULED_DETAIL`, `PAYMENT_PAYROLL_PAYMENT_RESULT`, `PAYMENT_PAYROLL_PAYMENT_RESULT_DETAIL`. Column order/visibility/width are DB-driven (`SYS_SCR_OPTION_WECMS`); each page ships a `FALLBACK_COLUMNS` mirror of its seed for first paint.
- **Sorting** — server-side via `useTableSort` (the list pages); detail pages sort client-side over the fetched line array.
- **Excel export** — Result list only, via shared `useExcelExport`.

## Validation
- Excel rows validated per-row at parse time (backend `PayrollPaymentExcelParser`); error cells highlighted in the upload preview.
- Path-segment guards on the backend controller: Scheduled id accepts numeric `scdul_pymn_no` **or** `VO_YYMMDD_NNN` doc-no; Result id accepts numeric `scdul_pymn_no` only.
- Pre-flight banking cut-off-time guard on Transfer (`validateBankingTime`).

## Notes
- `SCDUL_PYMN_TYPE_CD = "00"` discriminator (Payroll); shared `SCDUL_PYMN_SUMR` table with Internal Transfer / Vendor / Expense.
- Authorization: class-level `@menuAuthz.canAccess('payment-payroll-scheduled')`; Result endpoints add `payment-payroll-result`; the shared `/{id}/file` download accepts **either** menu (so a Result-only user can download from the Result detail).

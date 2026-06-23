# Payroll — UI Specification (Web)

> Frontend feature doc. Hub: [README.md](README.md). Per-screen detail lives in the four screen docs; this is the consolidated UI spec. Backend functional spec: [wecms-api/.../payroll/functional-specification.md](../../../../../wecms-api/docs/features/payment/payroll/functional-specification.md).

**Per-screen docs:** [scheduled-payment.md](scheduled-payment.md) · [scheduled-payment-details.md](scheduled-payment-details.md) · [payment-result.md](payment-result.md) · [payment-result-details.md](payment-result-details.md).

## Shared shell
All four screens compose shared components (`components/payment/shared/`): the family looks identical to Internal Transfer / Vendor / Expense, plus the Payroll-only **Payroll Type** column. Typography follows the global tokens (CLAUDE.md); no ad-hoc sizes.

## Filters

| Screen | Filters |
|---|---|
| Scheduled | period dropdown (30/90/180 days + manual range) + calendar chip + **approval-status dropdown** (`All / Not requested / Pending / In Progress / Approved / Rejected`) + SearchInput. "Request Approval" CTA in toolbar. |
| Result | period dropdown + calendar chip + **Completed / In Progress checkboxes** (→ backend `trnf_stts` `C`/`P`; neither/both = no filter) + SearchInput. |

## Tabs / summary
- **Result detail** status tabs: All / Success / Failed / In Progress (counts from backend `suc_cnt`/`err_cnt`/`prc_cnt`).
- Both list pages render a **totals footer** (single- or multi-currency) — required for Payroll.

## Tables / columns

**Scheduled list** (View-Setting driven): CHECKBOX · Date/Time · File Name · No. of Transactions · Total Transfer Amount · Scheduled Date · Approval Status · **Payroll Type** · Requestor · Approver · Approval Ref · Approval Title · ETC.

**Result list**: Date/Time · File Name · No. of Transactions · Total Transfer Amount · **Payroll Type** · Transfer Status · Approval Ref (clickable F4b) · Approval Title · download glyph.

**Scheduled detail** (5-column subset of canonical `scheduledDetailColumns`): Deposit Bank · Recipient Name · Transfer Amount · Remarks · Reporting Account (inline picker).

**Result detail** (8-column subset of canonical `resultDetailColumns`): Date/Time · Deposit Bank · Recipient Name · Transfer Amount · Remarks · Results · Result Date/Time · Reporting Account (read-only).

> **Payroll Type** map: `"0"` → Salary, `"1"` → Bonus, else blank. On the Approval Details popup, extra parity via `resolvePayrollTypeLabel` (`9` → Other; withdrawal-bank `11704088` → "Salary/Allowance/Bonus").
>
> **Detail-layout correction.** The Result detail is **not** a bespoke 5-column layout — it is the canonical `resultDetailColumns` projected to 8 columns by View Setting. The 5-column subset is the **Scheduled** detail.

## Pagination / sorting
- List pages: server-side `page`/`size` + `useTableSort` (whitelist → backend sort fields). `APPR_FUND_TP` + `APPRVR_NM` not sortable on the Scheduled list.
- Detail pages: client-side sort over the fetched line array; **pagination hidden** (CLAUDE.md §12a).

## Empty states
- No rows → shared empty-state row. Drafts without an approval request render with a `warning` highlight + Delete affordance.

## Dialogs / popups
- `<PayrollPaymentUploadDialog>` — Download template → Browse → preview (error cells highlighted) → Save draft.
- `<RequestApprovalDialog kind="payroll">` — read-only withdrawal account, captures Payroll Type + pay date.
- `<ApprovalDetailsDialog kind="payroll">` — Approve / Reject / kebab Edit (approval line) / Withdraw; combined attachments; shared `APPR_SEQ_NO` download.
- `<PayrollMatchDialog>` — Result-detail Banking Match (candidates pinned to pay date + total amount).
- System dialogs via `useDialog()`.

## Upload / download / approval / result actions
- **Upload**: parse → preview → create draft.
- **Download**: original Excel via `GET …/{id}/file` (shared by Scheduled detail, Result detail, Result list glyph).
- **Approval actions**: request / approve / reject / withdraw / change line.
- **Result inquiry**: status tabs + per-line Success/Failed; Excel export of the list.

## View Setting
All four screens key View Setting by SCREEN_IDS in `lib/viewSettingScreens.ts` (`PAYMENT_PAYROLL_PAYMENT_{SCHEDULED,SCHEDULED_DETAIL,RESULT,RESULT_DETAIL}`); column order/visibility/width DB-driven, each page ships a `FALLBACK_COLUMNS` mirror.

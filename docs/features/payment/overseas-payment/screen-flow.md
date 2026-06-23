# Overseas Payment — Screen Flow

> Navigation + interaction flow. Hub: [README.md](README.md). Backend flow: [`wecms-api/.../business-flow.md`](../../../../../wecms-api/docs/features/payment/overseas-payment/business-flow.md).
>
> **Per-screen docs:** [scheduled-payment.md](scheduled-payment.md) · [scheduled-payment-details.md](scheduled-payment-details.md) · [payment-result.md](payment-result.md) · [payment-result-details.md](payment-result-details.md) · [exchange-rate-inquiry.md](exchange-rate-inquiry.md).
>
> **Flow:** Scheduled Payment (list) → Scheduled Payment Details · Payment Result (list) → Payment Result Details · Scheduled ↔ Result are sibling lists over the same `OVRS_PYMN_*` batches · **Overseas Payment → Exchange Rate Inquiry** (sibling FX lookup under the same menu group).

## Screen map

```
Payment ▸ Overseas Payment
├── Scheduled Payment            /payment/overseas-payment/scheduled-payment
│     └── Detail                 /payment/overseas-payment/scheduled-payment/[id]
├── Payment Result              /payment/overseas-payment/payment-result
│     └── Detail                 /payment/overseas-payment/payment-result/[id]
└── Exchange Rate Inquiry       /payment/overseas-payment/exchange-rate-inquiry   (separate doc)
```

## Scheduled Payment flow
1. Land on list → period + Approval Status filters + keyword drive `fetchOverseasScheduledList`.
2. **Excel Upload** → `OverseasExcelUploadModal`: download template → pick file → preview (per-cell errors) → Step 3 withdrawal account → upload. On success refetch + success dialog.
3. Row → **Detail** ([id] page): per-line beneficiary/FX table + file card + approver chain + attachments; inline **Reporting Account** edit.
4. **Request Approval** (`<RequestApprovalDialog>`) → submit chain + attachments. **Change Approver** (`ChangeApproverDialog`) while pending. **Approve/Reject** via `<ApprovalDetailsDialog>`.
5. **Transfer** (dispatch) once approved → confirmation dialog → `dispatchOverseasPayment`.
6. **Delete** draft (pre-approval only).

## Payment Result flow
1. Land on list → period + **Completed / In Progress checkboxes** (→ `proc_stat`) + keyword drive `fetchOverseasResultList`.
2. **Approval Ref** cell is clickable (F4b, `appr_seq_no`) → `<ApprovalDetailsDialog>`.
3. Per-row **download** glyph (per-batch export); toolbar **export** (list XLSX) via `useExcelExport`.
4. Row → **Result Detail** ([id] page): status tabs + per-line result rows (Success/Failed/Pending derived from `proc_stat`); per-line **banking match / unmatch**, header **unmatch-all**.

## State derivation (FE)
- Approval status badge ← derived `appr_stts` (C/X/I/P) from backend.
- Result status pill ← `proc_stat`-derived (`deriveResultStatus`) + batch `trnf_stts` (C/F/P).
- Totals footer ← per-currency `totals[]` (Result footer is date+keyword only, never status-filtered).

## Cross-links
- [ui-specification.md](ui-specification.md) · [api-consumption.md](api-consumption.md) · [component-index.md](component-index.md)

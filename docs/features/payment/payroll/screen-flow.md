# Payroll — Screen Flow (Web)

> Frontend feature doc. Hub: [README.md](README.md). API flow: [wecms-api/.../payroll/business-flow.md](../../../../../wecms-api/docs/features/payment/payroll/business-flow.md).

## Navigation map

```
Payment ▸ Payroll
├─ Scheduled Payment  (/payment/payroll/scheduled-payment)
│   ├─ Excel Upload dialog → Save draft → row appears
│   ├─ Request Approval dialog → Approval Details popup (Approve/Reject/Edit/Withdraw)
│   ├─ Transfer (dispatch) → row flips to Complete
│   └─ row click → Scheduled Payment Details (/scheduled-payment/[id])
│         └─ inline Reporting Account picker · download original Excel
└─ Payment Result    (/payment/payroll/payment-result)
    ├─ filter Completed / In Progress · Excel export · per-row download
    └─ row click → Payment Result Details (/payment-result/[id])
          ├─ status tabs: All / Success / Failed / In Progress
          └─ Banking Match (Match / Unmatch — no Unmatch-All)
```

## State flow

1. **Draft** — Excel upload creates a `SCDUL_PYMN_SUMR` row (`SCDUL_PYMN_TYPE_CD="00"`), no `APPR_SEQ_NO`. Deletable.
2. **Requested** — Request Approval stamps `APPR_SEQ_NO` + `EXPT_RESOL_MSTR` (status In Progress, Payroll Type captured). Delete now blocked (`WBE2062`).
3. **Approved / Rejected** — derived via `wb_get_appr_stts` (`C`/`R`). Approved → Transfer enabled.
4. **Transferred** — `TRNF_YN='Y'`; the batch leaves the Scheduled actionable state and appears on Payment Result.
5. **Result** — per-line Success/Failed/In Progress; batch-level Banking Match available once complete.

## Detail navigation rules
- Scheduled detail accepts numeric `SCDUL_PYMN_NO` **or** `DOC_NO` (`VO_…`).
- Result detail accepts numeric `SCDUL_PYMN_NO` **only** (backend rejects `DOC_NO`).
- Unknown id → `notFound()` (`WBE2060`).

## Cross-links
Per-screen: [scheduled-payment.md](scheduled-payment.md) · [scheduled-payment-details.md](scheduled-payment-details.md) · [payment-result.md](payment-result.md) · [payment-result-details.md](payment-result-details.md).

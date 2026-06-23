# Payroll — Test Scenarios (Web)

> Frontend feature doc. Hub: [README.md](README.md). Backend coverage: [wecms-api/.../payroll/test-scenarios.md](../../../../../wecms-api/docs/features/payment/payroll/test-scenarios.md).

## Current state — MISSING (G-PAYR-3)
There are **no** `.test.*` files for any Payroll screen (the largest single FE coverage gap across all payment modules). Backend tests are strong; the frontend is untested.

## Suggested scenarios

### Scheduled Payment (list)
- Period + approval-status filter → correct query params.
- Payroll Type column renders Salary / Bonus / blank.
- Totals footer renders (single + multi-currency); server-side pagination.
- `APPR_FUND_TP` and `APPRVR_NM` columns render no sort glyph.
- Draft without approval → `warning` highlight + Delete; Delete blocked after request (`WBE2062`).

### Scheduled Payment Details
- 5-column subset render (Deposit Bank / Recipient / Amount / Remarks / Reporting Account).
- Inline Reporting Account picker save + optimistic rollback on error.
- Download original Excel; unknown id → `notFound()`.

### Payment Result (list)
- Completed / In Progress checkboxes → `trnf_stts` `C` / `P` (neither/both = no filter).
- Clickable Approval Ref (F4b) only when `appr_seq_no` present.
- Excel export triggers `POST /results/export`; per-row download.

### Payment Result Details
- 8-column subset render; status tabs All / Success / Failed / In Progress with correct counts.
- Banking Match: matched → Unmatch; complete → Match; processing → no action; no Unmatch-All.
- Result detail rejects `DOC_NO` navigation (numeric id only).

### Upload dialog
- Template download; parse preview highlights error cells; Save draft creates a row.

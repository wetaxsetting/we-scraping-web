# Expense Payment — Test Scenarios (Web)

> **Frontend doc.** Source of truth = latest code. Verified 2026-06-23.
> Backend counterpart: [wecms-api/docs/features/payment/expense-payment/test-scenarios.md](../../../../../wecms-api/docs/features/payment/expense-payment/test-scenarios.md) _(wecms-api repo)_.

## Current state
**No frontend tests** exist for the Expense Payment pages — all coverage is manual / backend-side.

## Manual / to-author scenarios

### Scheduled Payment
- Filter by date range / keyword / approval status; pagination + sort headers.
- Upload Excel → preview validation errors → save draft; verify per-row error display.
- Request Approval with + without attachments (multipart).
- Approval Details popup: Approve / Reject / Withdraw / Edit-line.
- Reporting Account picker (PATCH late-bind) on the detail page.
- Banking Match per line: candidates / match / unmatch / unmatch-all.
- Transfer (dispatch): cut-off pre-flight + approval-gate error surfacing (`WBE2063`).
- Delete draft; original-Excel download.

### Payment Result
- Status checkboxes → Completed (`C`) / In Progress (`P`); confirm totals footer stays full-set (not page-filtered).
- Clickable Approval Ref (F4b) navigation.
- Per-row download glyph (F2 `W` ERP audit) + list Excel export.
- Result detail header tabs (All / Success / Failed / In Progress) match the per-line chip distribution.

## Cross-cutting
- snake_case wire ↔ camelCase mapper round-trip.
- View Setting column visibility per the 4 screen ids.
- Typography via shared Tailwind tokens (no ad-hoc sizes).

---

Last verified: 2026-06-23. Gap classification: [wecms-api refactor-gap-analysis.md](../../../../../wecms-api/docs/features/payment/expense-payment/refactor-gap-analysis.md).

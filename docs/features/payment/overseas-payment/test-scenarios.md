# Overseas Payment — Frontend Test Scenarios

> Hub: [README.md](README.md). Backend tests: [`wecms-api/.../test-scenarios.md`](../../../../../wecms-api/docs/features/payment/overseas-payment/test-scenarios.md). Verified 2026-06-23.

## Current status — MISSING (G-OVRS-4)
No `*.test.tsx` / `*.spec.ts` exist for any overseas screen (consistent with every payment FE module — frontend tests are the largest payment-module coverage gap).

## Suggested baseline
| Area | Scenario |
|---|---|
| Scheduled list | Period + Approval Status + keyword → correct `fetchOverseasScheduledList` params; per-currency totals footer render. |
| Excel upload | Preview error cells highlighted + Upload disabled while `error_count > 0`; success path → refetch + success dialog. |
| Scheduled detail | Inline reporting-account save round-trip (`saveOverseasReportingAccount` with code+seq_no pair); file-card download. |
| Approval | Request Approval submit + attachments; Change Approver while pending; approve/reject via `<ApprovalDetailsDialog>`. |
| Dispatch | Transfer enabled only when approved; confirmation → `dispatchOverseasPayment`. |
| Result list | Completed/In-Progress checkboxes → `proc_stat` CSV; **Approval Ref click (F4b) → Approval Details popup**; export. |
| Result detail | Status tabs + per-line result derivation; banking match/unmatch + unmatch-all; per-batch export. |
| Error states | `WBE2045/2046/2063/2069/2127` → error dialog with `errorCode`; 404 → `notFound()`. |

## Cross-links
- [api-consumption.md](api-consumption.md) · [ui-specification.md](ui-specification.md)

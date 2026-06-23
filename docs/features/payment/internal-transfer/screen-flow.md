# Internal Transfer — Screen Flow (Frontend)

> **API counterpart:** [wecms-api/.../business-flow.md](../../../../../wecms-api/docs/features/payment/internal-transfer/business-flow.md) · **Hub:** [README.md](README.md)

Source-code-verified 2026-06-23. Navigation / screen flow per sub-screen. Granular per-flow detail in [scheduled-transfer-flow.md](scheduled-transfer-flow.md) · [transfer-result-flow.md](transfer-result-flow.md) · [upload-create-flow.md](upload-create-flow.md) · [approval-flow.md](approval-flow.md).

---

## Routes & sub-screens

| Route | Component | Screen-level doc | JEX |
|---|---|---|---|
| `/payment/internal-transfer/scheduled-transfer` | `<ScheduledTransferPage>` | [scheduled-transfer.md](scheduled-transfer.md) | `pymn_0009_001` |
| `/payment/internal-transfer/scheduled-transfer/[id]` | `<ScheduledTransferDetailPage>` | [scheduled-transfer-details.md](scheduled-transfer-details.md) | `pymn_0009_003` |
| `/payment/internal-transfer/transfer-result` | `<TransferResultPage>` | [transfer-result.md](transfer-result.md) | `pymn_0010_001` |
| `/payment/internal-transfer/transfer-result/[id]` | `<TransferResultDetailPage>` | [transfer-result-details.md](transfer-result-details.md) | `pymn_0010_002` |

**Flow:** Scheduled Transfer (list) → Scheduled Transfer Details · Transfer Result (list) → Transfer Result Details. Each list row → its `[id]` detail; Scheduled and Result are sibling lists over the same batches (Result = post-dispatch view).

Sidebar: "Internal Transfer" parent expands to **Scheduled Transfer** + **Transfer Result** under Payment (`components/layout/Sidebar.tsx` `paymentGroups`).

---

## Scheduled Transfer flow

```
Scheduled Transfer list
 ├─ "Excel Upload" → InternalTransferUploadDialog
 │     download template → browse → preview (per-cell errors) → Save Draft
 │     → list refetch + success dialog
 ├─ row click → /scheduled-transfer/[id]  (detail: master + lines + FileCard)
 │     ├─ line "Reporting Account" → updateReportingAccount (PATCH)
 │     └─ FileCard download → downloadOriginalExcel
 ├─ Request-Approval CTA → RequestApprovalDialog → submitInternalTransferApproval
 ├─ Approval-Ref cell click → ApprovalDetailsDialog
 │     → Approve / Reject (actOnInternalTransferApproval)
 │     → kebab Delete = Withdraw (withdrawInternalTransferApproval)
 │     → kebab Edit = Change line (changeInternalTransferApprovalLine)
 ├─ per-row Transfer chip → validateBankingTime → confirm → dispatchScheduledTransfer
 └─ per-row Delete chip (draft only) → confirm → deleteScheduledTransfer
```

Status badge from derived `appr_stts`; Scheduled Date column reads `scheduleDate` (`EXPT_RESOL_MSTR.PAY_DATE`).

---

## Transfer Result flow

```
Transfer Result list  (read-only)
 ├─ Completed / In Progress checkboxes → trnf_stts (C/P)
 ├─ per-row download glyph → export
 ├─ list export → useExcelExport → POST /results/export
 └─ row click → /transfer-result/[id]
       ResultDetailView: DetailStatusTabs (All/Success/Failed/In-Progress)
       + per-line result chips (deriveResultStatus.ts)
```

Totals footer is shown (`paginationWithTotals`) — the code passes a per-currency `totals` array (`<TransferResultPage>`). The earlier "no totals (Figma 1:11730)" carve-out was superseded by the canonical sticky-footer rollout, so Transfer Result now matches the other four Result lists.

---

## Cross-screen notes

- **Re-submit after reject** is not a real flow — the kebab "Re-submit" entry is an inert placeholder (no legacy basis; recommend removal). See [approval-flow.md](approval-flow.md).
- **Re-run** is DEAD LEGACY — no UI affordance ships.

## Cross-links

[ui-specification.md](ui-specification.md) · [component-index.md](component-index.md) · [api-consumption.md](api-consumption.md) · [test-scenarios.md](test-scenarios.md)

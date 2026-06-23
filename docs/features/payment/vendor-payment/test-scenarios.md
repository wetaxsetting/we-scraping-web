# Vendor Payment — Test Scenarios (Frontend)

Manual / integration scenarios for the Vendor Payment screens. Backend scenarios: [wecms-api/docs/features/payment/vendor-payment/test-scenarios.md](../../../../../wecms-api/docs/features/payment/vendor-payment/test-scenarios.md).

> **No automated frontend tests exist yet** for any Vendor screen (G-VEND-1, MISSING — the largest single coverage gap across all payment modules). The matrix below is the manual/SIT source of truth.

---

## 1. Scheduled Payment — list

| # | Scenario | Expected |
|---|---|---|
| SL1 | Page loads | live `GET /vendor-payment` (default preset, all-status); rows + totals footer |
| SL2 | Approval-status dropdown → Pending | `appr_type=04`; only pending rows; page resets |
| SL3 | Approval-status → Not Requested | `appr_type=00`; only drafts |
| SL4 | Period 30→90 days / manual range | new `from_date`/`to_date`; refetch; page resets |
| SL5 | Keyword | `srch_wd` (trimmed); page resets |
| SL6 | Sort a sortable header | cycle default→ASC→DESC; DB orders rows |
| SL7 | Click APPROVER header | glyph shows but rows unchanged (backend default ORDER BY — PARTIAL) |
| SL8 | Paginate | server page change |

## 2. Upload → approval → transfer

| # | Scenario | Expected |
|---|---|---|
| U1 | Upload a valid Excel | preview + per-line validation; confirm → draft created |
| U2 | Upload with invalid rows | flagged rows; cannot save until fixed |
| U3 | Request Approval with attachments | multipart submit; attachments persist (`EXPT_RESOL_FILE`) |
| U4 | Approve / Reject from Approval Details | `actOnVendorApproval`; refetch; status updates |
| U5 | Withdraw | `withdrawVendorApproval`; batch returns to Draft |
| U6 | Change approval line | `changeVendorApprovalLine`; chain rebuilt |
| U7 | Delete a batch already in approval | `WBE2062` error dialog |
| U8 | Transfer past cut-off | cut-off guard error |

## 3. Scheduled Payment — detail

| # | Scenario | Expected |
|---|---|---|
| SD1 | Open by `DOC_NO` and by numeric id | both resolve to the same batch |
| SD2 | Pick a reporting account | `updateVendorReportingAccount` persists; survives reload |
| SD3 | Reporting-account change once dispatched | `WBE2064` |
| SD4 | Download original Excel | file streams (RFC 5987 filename) |
| SD5 | Batch with no file | `WBE2069` |

## 4. Payment Result — list

| # | Scenario | Expected |
|---|---|---|
| RL1 | Load | `GET /results`; totals footer rendered |
| RL2 | Check "Completed" only | `trnf_stts=C`; only completed rows; **footer totals unchanged** |
| RL3 | Check "In Progress" only | `trnf_stts=P`; footer unchanged |
| RL4 | Neither / both checked | no status filter |
| RL5 | Click Approval Ref (has `appr_seq_no`) | Approval Details popup opens (F4b) |
| RL6 | Approval Ref without `appr_seq_no` | not clickable |
| RL7 | Export | `POST /results/export`; XLSX |
| RL8 | Download a dispatched batch | file streams + ERP 'W' audit row (F2) |

## 5. Payment Result — detail

| # | Scenario | Expected |
|---|---|---|
| RD1 | Open detail | canonical 11-col table; header tabs with counts `[success, failed, inProgress]` |
| RD2 | Switch header status tab | line list filters client-side |
| RD3 | Per-line status badge | success / failed / pending ramp from `proc_stat`/`rs_cd` |

## 6. Auth / errors

| # | Scenario | Expected |
|---|---|---|
| Z1 | No `payment-vendor-scheduled` grant | scheduled route blocked (frontend) / 403 (backend) |
| Z2 | No `payment-vendor-result` grant | result route blocked / 403 |
| E1 | List/action error | system `error` dialog with code + trace id |

## 7. Coverage gaps (MISSING — G-VEND-1)

No `.test.*` files for any Vendor screen. Establishing a payment FE test baseline (dev) is the priority follow-up.

## 8. SIT / UAT

Both sub-modules are SIT/UAT-ready. The one open SIT item is the Completed/In-Progress filter smoke against real `TB_PAY_*` data once a local bank daemon flips `PROC_STAT` (environmental, infra). `tsc --noEmit` green.

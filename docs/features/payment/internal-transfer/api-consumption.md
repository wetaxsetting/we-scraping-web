# Internal Transfer — API Consumption (Frontend)

> **API counterpart:** [wecms-api/.../interface-specification.md](../../../../../wecms-api/docs/features/payment/internal-transfer/interface-specification.md) · **Hub:** [README.md](README.md)

Source-code-verified 2026-06-23. Endpoints each screen calls + the consumed request/response shape. Wire format is lowercase snake_case (`project_api_naming_lowercase.md`); mappers in `lib/api/mappers.ts` convert to camelCase.

---

## Scheduled Transfer list (`<ScheduledTransferPage>`)

| Action | Client fn | Endpoint |
|---|---|---|
| Load list | `fetchScheduledTransferList(query)` → `mapScheduledTransferList` | `GET /api/v1/payment/internal-transfer?from_date&to_date&srch_wd&appr_type&sort_field&sort_direction&page&size` |
| Withdrawal picker (upload) | `fetchWithdrawalAccounts(ccyCd?)` | `GET /withdrawal-accounts` |
| Parse Excel | `parseInternalTransferExcel(file, bankCd)` | `POST /uploads/parse` (multipart `file_data` + `bank_cd`) |
| Create draft | `createScheduledTransfer(req, file)` | `POST /` (multipart `request` JSON + `file_data`) |
| Dispatch | `dispatchScheduledTransfer(id, {trnf_ccy_cd})` | `POST /{id}/dispatch` |
| Delete | `deleteScheduledTransfer(id)` | `DELETE /{id}` |
| Request approval | `submitInternalTransferApproval(id, req, files)` | `POST /{id}/request-approval` (multipart) |
| Approve / reject | `actOnInternalTransferApproval(id, {action, comment})` | `POST /{id}/approval-action` |
| Withdraw | `withdrawInternalTransferApproval(id)` | `DELETE /{id}/approval` |
| Change approval line | `changeInternalTransferApprovalLine(id, apprLineNo)` | `PUT /{id}/approval-line` |
| Approval-Details approvers | `fetchApprovalBoxApprovers(apprSeqNo)` | `GET /api/v1/payment/approval-box/{apprSeqNo}/approvers` |
| Next doc no | `fetchNextInternalTransferDocNo()` | `GET /next-doc-no` |
| Download Excel | `downloadOriginalExcel(id)` (blob) | `GET /{id}/file` |
| Download attachment | `downloadApprovalAttachment(id, apprSeqNo, fileId, fileType?)` (blob) | `GET /{id}/approval/{apprSeqNo}/attachments/{fileId}` |

---

## Scheduled Transfer detail (`<ScheduledTransferDetailPage>`)

| Action | Client fn | Endpoint |
|---|---|---|
| Load detail | `fetchScheduledTransferDetail(id)` → `mapScheduledTransferDetail` | `GET /{id}` |
| Edit reporting account | `updateReportingAccount(id, lineId, {chart_acct_seq_no, chart_acct_cd})` | `PATCH /{id}/lines/{lineId}/reporting-account` |
| Download Excel | `downloadOriginalExcel(id)` | `GET /{id}/file` |

Banking match (per-line): `fetchInternalTransferMatchCandidates` / `matchInternalTransferLine` / `unmatchInternalTransferLine` / `unmatchAllInternalTransferLines` → `GET/POST/DELETE /{id}/lines/{lineId}/match*` · `DELETE /{id}/matches`.

---

## Transfer Result list (`<TransferResultPage>`)

| Action | Client fn | Endpoint |
|---|---|---|
| Load list | `fetchTransferResultList(query)` | `GET /results?from_date&to_date&srch_wd&trnf_stts&sort_field&sort_direction&page&size` |
| Export | `useExcelExport` | `POST /results/export` |

`trnf_stts` = `C` Completed / `P` In Progress (route-aware; blank/unknown → no filter).

---

## Transfer Result detail (`<TransferResultDetailPage>`)

| Action | Client fn | Endpoint |
|---|---|---|
| Load detail | `fetchTransferResultDetail(id)` | `GET /results/{id}` |

Per-line dispatch fields (`proc_stat`, `rs_cd`, `rs_msg`, `proc_dttm`, `rslt_dttm`, banking-match read fields) consumed by `deriveResultStatus.ts` + `PaymentResultBadge`; tab counts from `suc_cnt`/`err_cnt`/`prc_cnt`.

---

## Error handling

`ApiCallError` (`lib/api/banking.ts`) surfaces backend codes. Relevant codes: `WBE2060` (missing), `WBE2061` (line), `WBE2062` (already requested — blocks delete + re-request), `WBE2063` (not approved), `WBE2064` (already transferred), `WBE2069` (attachment), `WBE2126`/`WBE2127` (approval guards), `WBE2018`/`WBE2017`/`WBE2120`/`WBE2121` (parse). See [api-spec](../../../../../wecms-api/docs/features/payment/internal-transfer/interface-specification.md).

## Cross-links

[screen-flow.md](screen-flow.md) · [ui-specification.md](ui-specification.md) · [component-index.md](component-index.md) · [test-scenarios.md](test-scenarios.md)

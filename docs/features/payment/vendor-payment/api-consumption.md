# Vendor Payment — API Consumption (Frontend)

> **Backend counterpart:** [wecms-api/…/interface-specification.md](../../../../../wecms-api/docs/features/payment/vendor-payment/interface-specification.md).

API client [`lib/api/vendorPayment.ts`](../../../../lib/api/vendorPayment.ts) (`const BASE = "/api/v1/payment/vendor-payment"`). All calls go through the shared `api` Axios instance (JWT interceptor); business errors (HTTP 200 + `status.error`) are unwrapped into `ApiCallError(code, message)`. Wire is lowercase snake_case ↔ camelCase; the client reuses the shared `internaltransfer` wire types from `lib/types/api.ts` (Vendor and Internal Transfer share the physical `SCDUL_PYMN_SUMR` table).

> The client file-level Javadoc still says "Phase A" — that comment is **stale**; the full surface below is shipped and wired.

---

## 1. Scheduled Payment screen

| Client function | Method | Endpoint | Notes |
|---|---|---|---|
| `fetchVendorScheduledList(q)` | GET | `/` | params `from_date, to_date, srch_wd?, appr_type?, sort_field?, sort_direction?, page, size` (default 10). `appr_type`: `00` Not Requested / `04` Pending / `03` In Progress / `01` Approved / `02` Rejected |
| `fetchVendorPaymentDetail(id)` | GET | `/{id}` | `id` = `scdul_pymn_no` or `DOC_NO` |
| `fetchVendorWithdrawalAccounts(ccyCd?)` | GET | `/withdrawal-accounts` | upload picker |
| `parseVendorPaymentExcel(file, bankCd)` | POST | `/uploads/parse` | multipart `file_data` + `bank_cd` |
| `createVendorPayment(file, request)` | POST | `/` | multipart `file_data` + `request` (JSON Blob) |
| `deleteVendorPayment(id)` | DELETE | `/{id}` | `WBE2062` when in approval |
| `requestVendorApproval(id, req, attachments?)` | POST | `/{id}/request-approval` | **multipart** (`buildApprovalForm` — attachments → `EXPT_RESOL_FILE`) |
| `actOnVendorApproval(id, req)` | POST | `/{id}/approval-action` | approve / reject |
| `withdrawVendorApproval(id)` | DELETE | `/{id}/approval` | client-side `trim()` guard |
| `changeVendorApprovalLine(id, apprLineNo)` | PUT | `/{id}/approval-line` | body `{ appr_line_no }` |
| `updateVendorReportingAccount(id, lineId, req)` | PATCH | `/{id}/lines/{lineId}/reporting-account` | inline picker persist; `WBE2064` once dispatched |
| `dispatchVendorPayment(id, req)` | POST | `/{id}/dispatch` | Transfer (cut-off + approval gated) |
| `downloadOriginalVendorExcel(id)` | GET | `/{id}/file` | blob download; RFC 5987 filename; blob-error → `ApiCallError` |

**Banking Match (per line):**

| Client function | Method | Endpoint |
|---|---|---|
| `getVendorMatchCandidates(id, lineId, srchWd?)` | GET | `/{id}/lines/{lineId}/match/candidates` |
| `matchVendorPaymentLine(id, lineId, req)` | POST | `/{id}/lines/{lineId}/match` |
| `unmatchVendorPaymentLine(id, lineId)` | DELETE | `/{id}/lines/{lineId}/match` |
| `unmatchAllVendorPaymentLines(id)` | DELETE | `/{id}/matches` |

## 2. Payment Result screen

| Client function | Method | Endpoint | Notes |
|---|---|---|---|
| `fetchVendorPaymentResultList(q)` | GET | `/results` | params incl. `trnf_stts?: "C" \| "P"` (Completed / In Progress; route-aware `PROC_STAT`). Footer totals come back **unfiltered** by status (R008) |
| `fetchVendorPaymentResultDetail(id)` | GET | `/results/{id}` | header counts `[success, failed, inProgress]` from `countByStatus` |
| (Excel export) | POST | `/results/export` | via shared `useExcelExport`; provider `payment-vendor-payment-result`, ERP `04` |
| `downloadOriginalVendorExcel(id)` | GET | `/{id}/file` | dispatched download → ERP 'W' / `VENDOR_PAYMENT_RESULT` audit (F2) |

---

## 3. Wire shapes (reused `internaltransfer` types from `lib/types/api.ts`)

- `ApiScheduledTransferListResponse` / `…DetailResponse` — Scheduled list/detail (row carries derived approval status, **Approval Ref = `doc_no`**, Approval Title, totals footer).
- `ApiTransferResultListResponse` / `…DetailResponse` — Result list/detail (route-aware transfer status; `appr_seq_no` for F4b; per-line `proc_stat`/`rs_cd`).
- `ApiCreateScheduledTransferRequest`/`Response`, `ApiRequestApprovalRequest`/`Response`, `ApiDispatchRequest`, `ApiApprovalActionRequest`, `ApiUpdateReportingAccountRequest`, `ApiParseExcelResponse`, `ApiWithdrawalAccountRow`, and the `ApiPaymentLineMatch*` family.

Local in-memory row types `VendorScheduledRow` / `VendorResultRow` live in `components/payment/vendor-payment/types.ts`.

## 4. Approval status & key facts

- **No `appr_stts` column** on the wire's source table — backend derives status via `wb_get_appr_stts` over `EXPT_RESOL_MSTR`; rejected = `R` (not `X`).
- **Approval Ref** is `EXPT_RESOL_MSTR.DOC_NO` (never `ERP_FILE_NUM`); clickable when `appr_seq_no` present (F4b → Approval Details popup).
- **Result footer** is status-unfiltered (R008); the row list narrows but the footer holds.

## 5. Validation & error handling

Client-side `trim()` guards (`WBE_VALIDATION`) on withdraw / change-line. Server errors surface as `ApiCallError(code, message)`: `WBE2060` not found · `WBE2062` already in approval · `WBE2064` reporting-account locked once dispatched · `WBE2069` no file · `WBE_VALIDATION` date/range. Blob-response errors are read back as text + JSON-parsed so blob downloads throw the same `ApiCallError` shape.

## 6. Menu / route auth

`lib/menuAuth.ts` maps `/payment/vendor-payment/scheduled-payment → payment-vendor-scheduled` and `…/payment-result → payment-vendor-result`. Note these differ from the View-Setting screenIds `payment-vendor-payment-*` — distinct surfaces, do not conflate. Frontend enforcement is presentation only; the backend `@menuAuthz` guard is the security boundary.

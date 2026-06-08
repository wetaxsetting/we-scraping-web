# Flow 1 — Upload / Create Internal Transfer (Frontend)

Source-code-verified 2026-06-08. Frontend authority: `components/payment/internal-transfer/` + `lib/api/internalTransfer.ts`. Backend authority: [wecms-api/.../upload-create-flow.md](../../../../../wecms-api/docs/features/payment/internal-transfer/upload-create-flow.md).

---

## Purpose

Let the user create a draft internal-transfer batch by uploading the Excel template: pick a withdrawal account, upload the populated file, review a per-cell-validated preview, then save. Output is a draft row on the Scheduled Transfer list (Flow 2), submittable for approval (Flow 4).

---

## User Actions

| Action | UI |
|---|---|
| **Account selection** | Withdrawal Bank/Account picker inside the upload dialog (loaded from `fetchWithdrawalAccounts`). |
| **File upload** | Download template (per-locale) → Browse / Re-Select → upload. |
| **Manual entry** | Not supported — lines come only from the Excel. |
| **Validation** | `parseInternalTransferExcel` → preview table red-highlights error cells with hover causes. |
| **Save** | `createScheduledTransfer(file, request)` → list refetches with the new row at top. |
| **Submit for approval** | Separate — Flow 4. |

---

## Main UI components

```
ScheduledTransferPage.tsx  (toolbar "Excel Upload")
└── InternalTransferUploadDialog.tsx       (components/payment/internal-transfer/)
    └── PaymentExcelUploadDialog            (components/payment/shared/)
        └── ExcelUploadDialog               (components/shared/excel-upload/, stackLevel=2)
            — Step 1 Download template · Step 2 Browse · preview table (per-cell errors) · Close/Upload footer
```
- `InternalTransferUploadDialog` (`components/payment/internal-transfer/InternalTransferUploadDialog.tsx`): owns the 8-column config (Recipient/Bank/Amount/Currency/Remarks/Reporting Account/Description/Document No.), per-locale template URLs under `public/templates/internal-transfer/WeCMS_Internal_Transfer_upload_{EN,KO,VI}.xlsx` (KM→EN), and an `extraStep` for the withdrawal-account selection. On `onSaved` → `onSaved(scdul_pymn_no)`.
- Templates are the JEX originals committed under `public/templates/`.

---

## API consumption (`lib/api/internalTransfer.ts`)

| Function | Method · endpoint | Request → Response |
|---|---|---|
| `fetchWithdrawalAccounts(ccyCd?)` | GET `…/withdrawal-accounts` | → `ApiWithdrawalAccountRow[]` |
| `parseInternalTransferExcel(file, bankCd)` | POST `…/uploads/parse` (multipart `file_data` + `bank_cd`) | → `ApiParseExcelResponse` (`tot_cnt`/`suc_cnt`/`err_cnt`/`lines[]` with `err_fld`/`err_fld_caus`) |
| `createScheduledTransfer(file, request)` | POST `…/` (multipart `request` JSON Blob + `file_data`) | `ApiCreateScheduledTransferRequest` → `ApiCreateScheduledTransferResponse` (`scdul_pymn_no`) |

All go through the shared `api` Axios instance (JWT) + `unwrap<T>` envelope helper (throws typed `ApiCallError`).

---

## Types (`lib/types/api.ts`)

`ApiWithdrawalAccountRow` (`bank_cd`/`bank_nm`/`acct_no`/`acct_type_cd`/`ccy_cd`/`acct_nick_nm`), `ApiParseExcelResponse` + `ApiParsedTransferLine`, `ApiCreateScheduledTransferRequest` (+ `lines[]` `ApiTransferLineInput`), `ApiCreateScheduledTransferResponse`.

---

## Backend / API involvement (summary)

`InternalTransferService.parseExcel` → real POI `InternalTransferExcelParser`; `createDraft` persists `SCDUL_PYMN_SUMR` + `SCDUL_PYMN_SUMR_DETL`, stores the file, copies to ERP Transaction History, writes audit. Full detail in the backend flow doc.

---

## Legacy mapping

`pymn_0009_002` upload popup → `InternalTransferUploadDialog` + `PaymentExcelUploadDialog`. `comm_1001_001` withdrawal picker → `fetchWithdrawalAccounts`.

## Legacy parity status — **MATCH**
## Refactor status — **Implemented** (live; the client's "stub" Javadoc for parse is stale).

## Open gaps (source-evidenced)
- None on the create path. The reporting-account on a saved line is edited later via Flow 2's PATCH.

# Overseas Payment — API Consumption

> Frontend → backend wiring. Hub: [README.md](README.md). Contract authority: [`wecms-api/.../interface-specification.md`](../../../../../wecms-api/docs/features/payment/overseas-payment/interface-specification.md). Verified 2026-06-23.

## API client — `lib/api/payment.ts`
All under `/api/v1/payment/overseas-payment` (single controller; `/result` **singular**).

| Function | Method | Endpoint |
|---|---|---|
| `fetchOverseasScheduledList(params)` | GET | `/scheduled` |
| `fetchOverseasScheduledById(id)` | GET | `/scheduled/{id}` |
| `fetchOverseasPaymentDetail(id)` | GET | `/scheduled/{id}/details` (shared by Result Detail) |
| `downloadOverseasPaymentFile(id)` | GET | `/scheduled/{id}/file` |
| `submitOverseasPaymentExcel(body, file)` | POST | `/excel-upload` (multipart) |
| `requestOverseasApproval(id, body, attachments?)` | POST | `/{id}/request-approval` (multipart) |
| `changeOverseasApprovalLine(id, body)` | PATCH | `/{id}/approval-line` |
| `removeOverseasApprovalLine(id)` | DELETE | `/{id}/approval-line` |
| `deleteOverseasDraftBatch(id)` | DELETE | `/{id}` |
| `actOnOverseasApproval(id, body)` | POST | `/{id}/approval-action` |
| `dispatchOverseasPayment(id)` | POST | `/{id}/dispatch` |
| `saveOverseasReportingAccount(id, trnSeq, rprtAcctCd, rprtAcctSeqNo)` | PATCH | `/{id}/details/{trnSeq}/reporting-account` |
| `fetchOverseasWithdrawalAccounts(ccyCd?)` | GET | `/withdrawal-accounts` |
| `fetchOverseasResultList(params)` | GET | `/result` |
| `fetchOverseasResultById(id)` | GET | `/result/{id}` |
| `exportOverseasResultList(params)` | GET | `/result/export` (blob) |
| `fetchOverseasMatchCandidates(no, detlNo, srchWd?)` | GET | `/{no}/lines/{detlNo}/match/candidates` |
| `matchOverseasPaymentLine(no, detlNo, request)` | POST | `/{no}/lines/{detlNo}/match` |
| `unmatchOverseasPaymentLine(no, detlNo)` | DELETE | `/{no}/lines/{detlNo}/match` |
| `unmatchAllOverseasPaymentLines(no)` | DELETE | `/{no}/matches` |

> Per-batch Result export (`POST /result/{id}/export`) goes through the shared `useExcelExport()` hook (not a bespoke client fn).

## FX — `lib/api/banking.ts` (separate doc)
`fetchExchangeRates`, `fetchExchangeRateBanks`, `fetchExchangeRateCurrencies` → `/api/v1/banking/exchange-rates*`. See [exchange-rate-inquiry.md](../exchange-rate-inquiry.md).

## Wire types & mappers
- Wire interfaces (`lib/types/api.ts` / `lib/api/payment.ts`): `ApiOverseasScheduledRow`, `ApiOverseasScheduledListResponse`, `ApiOverseasResultRow`, `ApiOverseasResultListResponse`, `ApiOverseasPaymentDetailResponse`, `ApiOverseasPaymentExcelDetailRow`, `ApiOverseasApprover`, `ApiOverseasCurrencyTotal`.
- snake_case wire ↔ camelCase via `lib/api/mappers.ts`; in-memory types in `components/payment/overseas-payment/types.ts`.
- F4b: `appr_seq_no` mapped to `approvalRefId` so the Result Approval Ref cell opens the Approval Details popup.

## Hooks
Reads via `useApiData`; sort `useTableSort`; columns `useViewSetting`; export `useExcelExport`; blocked chars `useBlockedChars`; dialogs `useDialog`.

## Cross-links
- [component-index.md](component-index.md) · [ui-specification.md](ui-specification.md) · [screen-flow.md](screen-flow.md)

# Corporate Card — API Consumption (Card Transactions)

Which endpoints each screen surface calls, and the shapes. Full contract: [`wecms-api/docs/features/payment/corporate-card/interface-specification.md`](../../../../../wecms-api/docs/features/payment/corporate-card/interface-specification.md). Base `/api/v1/payment/card-transactions`. All calls go through `lib/api/cardTransactions.ts` (unwrap envelope → `ApiCallError`); rows pass through `cardTransactionMappers.ts`.

## Per-screen endpoint map

| Screen surface | Endpoint | Client fn |
|---|---|---|
| Ledger table | `GET /` | `fetchCardTransactions` |
| Card dropdown | `GET /cards` | `fetchActiveCards` |
| Description / Purpose inline edit | `PATCH /{cardSeqNo}` | `patchCardTransaction` |
| Reporting account set / clear | `PUT \| DELETE /{cardSeqNo}/reporting-account` | `putCardTransactionReportingAccount` / `clearCardTransactionReportingAccount` |
| Excel export | `POST /export` | `useExcelExport` |
| Card Management | `GET /cards/management`, `PATCH …/active`, `PATCH …`, `DELETE …`, `POST /cards` | `fetchManagementCards`, `patchCardActive`, `patchCardInfo`, `deleteManagementCard`, `createScrapedCards` |
| Update Cards (scrape) | `POST /sync` (deprecated), `POST /sync-session`, `POST /sync-session/{id}/{qna,otp,captcha}`, `POST /period-limits` | `syncCardTransactions`, `startCardSyncSession`, `submitCardSyncQna`/`Otp`/`Captcha`, `fetchCardTranListPeriodLimits` |
| Request Approval | `POST /request-approval` (multipart), `GET /next-doc-no` | `requestCardApproval`, `fetchNextCardDocNo` |
| Approval Ref detail | `GET /by-approval/{apprSeqNo}`, `DELETE …`, `PUT …/approval-line` | `fetchCardTransactionsByApproval`, `withdrawCardApproval`, `changeCardApprovalLine` |
| Link Card Payments | `GET /links/e-invoices`, `GET /links/receipts`, `POST /links`, `DELETE /links/{cardSeqNo}` | `fetchLinkableEInvoices`, `fetchLinkableReceipts`, `linkCardExpenses`, `unlinkCardExpenses` |
| New Receipt | `POST /receipts`, `GET /purpose-options` | `createCardReceipt`, `fetchPurposeOptions` |
| Receipt detail | `GET /receipts/{docId}` | `fetchReceiptDetail` |
| Memo drawer | `GET/POST/DELETE /memos[/{seqNo}]` | `fetchMemos`, `createMemo`, `deleteMemo` |

## Ledger row shape (wire)

`CardTransactionListResponse` = `{ page, page_size, total_count, totals, rows[] }`. Each row (snake_case):

`card_seq_no`, `bank_cd`, `bank_nm`, `card_no`, `card_nm`, `card_nick_nm`, `card_hldr_nm`, `merch_nm`, `ccy_cd`, `trsc_amt`, `trsc_dt`, `trsc_tm`, `card_trns_usage_code`, `chart_acct_seq_no`, `chart_acct_cd`, `cont`, `appr_seq_no`, `appr_doc_no`, `stts`, `stts_key`, `linked_docs[]`, `approvers[]`, `reg_id`/`reg_dtm`/`mod_id`/`mod_dtm`, `using_type`, `auth_code`, `city`, `note`.

`linked_docs[]`: `doc_id`, `disp_doc_id`, `hand_doc_id`(null), `doc_type`, `einv_yn`(null), `totl_amt`.

## Display-name + approver notes (important)

- **`approvers[]` is ALWAYS empty on ledger rows** — the backend ships `List.of()`. The approver chain surfaces only inside the Approval Details popup via `GET /by-approval/{apprSeqNo}`.
- **Display names resolved client-side.** The row carries raw codes only (`card_trns_usage_code`, `chart_acct_cd`); there is no `card_trns_usage_nm` / `chart_acct_nm`/`_en`/`_level_nm` on the wire. Resolve from `GET /settings/chart-of-accounts/tree` + `GET /purpose-options` keyed by the raw codes (`accountNameByCd` / `purposeNameByCd` in `CardTransactionsPage`). APPROVED DEVIATION.
- **Do NOT expect** `appr_dv`, `post_seq_no`, `post_reg_id` — they are not emitted.
- Status renders via `t(row.stts_key)` with a fallback to the raw `stts` code on unknown values (OQ-3 — only `'1'` + null observed).

## Errors

`ApiCallError { code, message, traceId }`. Surface via `useDialog().open({ type: "error", errorCode, traceId })`. 401 handled by the global Axios interceptor.

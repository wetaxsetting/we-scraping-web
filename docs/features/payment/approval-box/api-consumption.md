# Approval Box — API Consumption (Frontend)

API client `lib/api/approval-box.ts` (base `const BASE = "/api/v1/payment/approval-box"`). All calls go through the shared `api` Axios instance (JWT interceptor); business errors (HTTP 200 + `status.error`) are unwrapped into `ApprovalBoxApiError(code, message, traceId?)`.

---

## 1. Endpoints consumed

| Client function | Method | Endpoint | Request | Response type | UI trigger |
|---|---|---|---|---|---|
| `fetchApprovalBoxList(q)` | GET | `/api/v1/payment/approval-box` | query: `from_date, to_date, appr_type_cd, srch_wd, sort_field, sort_direction, page, size` (default 15) | `ApiApprovalBoxListResponse` | `useApprovalBoxList` on mount + every filter/tab/page/sort change |
| `fetchApprovalBoxApprovers(apprSeqNo)` | GET | `…/{apprSeqNo}/approvers` | path (blank → `[]`) | `ApiApprovalBoxApprover[]` | used by Payment scheduled detail pages |
| `approveApprovalBoxRow(apprSeqNo)` | POST | `…/{apprSeqNo}/approve` | path | `ApiApprovalBoxActionResponse` | dialog **Approve** → `handleApprove` |
| `rejectApprovalBoxRow(apprSeqNo)` | POST | `…/{apprSeqNo}/reject` | path | `ApiApprovalBoxActionResponse` | dialog **Reject** → `handleReject` |
| `bulkApproveApprovalBoxRows(input)` | POST | `…/bulk-approve` | body `{ appr_seq_nos }` (Zod `approvalBoxBulkApproveSchema`, 1–100) | `ApiApprovalBoxBulkApproveResponse` | `BulkActionBar` — **not mounted (dead)** |
| `withdrawApprovalBoxRow(apprSeqNo)` | DELETE | `…/{apprSeqNo}/withdraw` | path | `void` (throws `ApiCallError`) | dialog kebab → Delete (non-card) → `handleWithdrawConfirmed` |
| `changeApprovalBoxApprovalLine(apprSeqNo, apprLineNo)` | PUT | `…/{apprSeqNo}/approval-line` | body `{ appr_line_no }` | `void` (throws `ApiCallError`) | dialog edit-mode Save (non-card) → `handleEditSave` |

**Other clients used by the dialog** (per `typeKey` via `pickDetailLoader`): `withdrawCardApproval` / `changeCardApprovalLine` / `fetchCardTransactionsByApproval` (`lib/api/cardTransactions`), `fetchScheduledTransferDetail`, `fetchVendorPaymentDetail`, `fetchExpensePaymentDetail`, `fetchPayrollPaymentDetail`, `fetchOverseasPaymentDetail`. Card uses `apprSeqNo` as the id; the rest use `documentNo`.

Error class: `ApprovalBoxApiError` (`code`, optional `traceId`). Withdraw/change-line deliberately throw `ApiCallError` (shared with the card branch) so the page's `instanceof ApiCallError` catch surfaces the code.

---

## 2. Wire types (`lib/types/api.ts`)

- `ApiApprovalBoxRow` — `appr_seq_no, doc_no, title, file_name, cont, appr_dv, type_label, reg_dtm, currency, tot_pay_amt, pay_date, draft_user_nm, appr_stts ("P"|"I"|"C"|"R"|"A"|"X"), apprvr_appr_tot_cnt, apprvr_tot_cnt, pay_end_yn, approvers[]`
- `ApiApprovalBoxApprover` — `apprvr_line_no, apprvr_id, apprvr_nm, apprvr_stts ("P"|"A"|"R"|"W"|"S"), appr_dtm: string|null`
- `ApiApprovalBoxTabCounts` — `pending, in_progress, approved, rejected`
- `ApiApprovalBoxListResponse` — `list, total_count, tab_counts, page_number, page_size, total_pages`
- `ApiApprovalBoxActionResponse` — `appr_seq_no, appr_stts, apprvr_appr_tot_cnt, apprvr_tot_cnt`
- `ApiApprovalBoxBulkApproveResponse` — `successes[], failures[]`

## 3. In-memory types (`components/payment/approval-box/types.ts`)

- `ApprovalStatus = "draft" | "pending" | "in_progress" | "approved" | "rejected"`
- `ApprovalTabKey = "all" | ApprovalStatus`
- `ApprovalType = "payroll" | "vendor" | "expense" | "corporate_card" | "overseas" | "internal_transfer"`
- `ApproverStatus = "P" | "A" | "R" | "W" | "S"`
- `ApprovalApprover = { lineNo, userId, userName, status, actedAt: string | null }`
- `ApprovalRow = { id, apprSeqNo, date, type, typeKey, documentNo, title, cont, fileName, currency: "VND"|"USD"|"KRW", amount (string), status, statusStep?, scheduledDate?, requestor, approver, approverCount?, approvers[], actionable, payEndYn }`
- `TabCounts = Record<ApprovalTabKey, number>` · `CurrencyTotal = { currency, total }` · `RowAction = "approve" | "reject"`

## 4. Mappers (`lib/api/mappers.ts`)

- `mapApprovalBoxRow(wire, userId)` — wire → `ApprovalRow`. Status map `APPR_STTS_TO_STATUS`: `P→pending, I→in_progress, C→approved, A→approved, R→rejected, X→rejected`. `statusStep`/`approverCount = "{appr}/{tot}"`. **`actionable` = the current user's approver row status === "P"**. `coerceTypeKey` validates `type_label`; `coerceApprovalCurrency` defaults VND. Date formats: `formatRegDate` (DD-MMM-YYYY), `formatScheduledDate` (DD-MM-YYYY), `formatActedAt` (DD-MM-YYYY HH:mm:ss).
- `mapTabCounts` — `all = pending+in_progress+approved+rejected` (NOT `total_count`), `draft = 0`.
- `approvalBoxCurrencyTotal(rows)` — always emits USD/VND/KRW (client-side sum of the page slice, for the footer).

## 5. List hook (`useApprovalBoxList.ts`)

- **No react-query/SWR** — plain `useState`/`useEffect`/`useRef` + manual fetch with a `runIdRef` "latest request wins" cancellation token.
- Returns state (`data`, `loading`, `error`) + controls (`tab/setTab`, `search/setSearch`, `period/setPeriod`, `manualRange/setManualRange`, derived `fromDateIso`/`toDateIso`, `page/setPage`, `pageSize/setPageSize` default `PAGE_SIZE_OPTIONS[0]`=10, `sortField`/`sortDirection`/`setSort`, `refetch`).
- `TAB_TO_APPR_TYPE_CD`: `all→"", draft→"", pending→"00", in_progress→"03", approved→"01", rejected→"02"`.
- `periodToDateWindow(period, manualRange)` derives the ISO window; `load()` builds the query (ISO→YYYYMMDD), fetches, then `mapApprovalBoxList(wire, userStorage.get()?.userId)`.
- **Page-reset boundary:** `setTab`/`setSearch`/`setPeriod`/`setManualRange`/`setSort` all `setPage(0)` first.
- **Refresh after mutation:** explicit — each mutation handler calls `void list.refetch()` on success. No query cache. The page also runs a render-phase **stable-data latch** (`stableData`/`prevData`) so the table keeps the prior rows during a refetch instead of flashing empty.
- **Sort sync:** the page's `useTableSort()` cycle is pushed into the hook via `setSort`, so the next fetch carries `sort_field`/`sort_direction` and the DB does the ORDER BY (no client-side sort).

## 6. Validation & error handling

- Client-side `apprSeqNo.trim()` guards in the API client (throws `WBE_VALIDATION`).
- Bulk path has Zod `approvalBoxBulkApproveSchema` (1–100, trimmed) — but bulk is unmounted.
- List error → `useDialog().open({ type:"error", description: error.message, errorCode: error.code, uuid: error.traceId })`.
- Action errors → `error` dialog with `err.code` (`WBE9999` fallback).
- Deep-link miss → `warning` dialog `approval.deeplink.not_found`.

> **Known locale gap:** the page references `approval.action.approve_success` / `approve_failed` / `reject_success` / `reject_failed` which are absent from `en.json` (existing keys are `approval.success.*` and `approval.action.{edit,delete}_*`), so the raw key string currently leaks on approve/reject feedback. Plus a duplicated `approval.col.file_name` key. Fix in a follow-up MR — see [test-scenarios.md](test-scenarios.md).

## 7. Menu / route auth (frontend)

`lib/menuAuth.ts` `ROUTE_MENU_MAP` maps `/payment/approval-box → "payment-approval-box"`; `isRouteAllowed` checks admin or section+leaf grant from `/api/v1/auth/me`. Registered in `components/layout/sidebarNav.ts` (`sidebar.payment.approvalBox`). `SCREEN_IDS.PAYMENT_APPROVAL_BOX = "approval-box"` in `lib/viewSettingScreens.ts`. Frontend enforcement is presentation only — the backend `@menuAuthz` guard is the security boundary.

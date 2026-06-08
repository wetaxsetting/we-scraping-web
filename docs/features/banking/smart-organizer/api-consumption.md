# Smart Organizer — API Consumption (Frontend)

Which backend endpoints the Smart Organizer frontend calls, the request params it sends, the response
shapes it consumes, and the wire → in-memory mapping. Backend contract of record:
[wecms-api/docs/features/banking/smart-organizer/interface-specification.md](../../../../../wecms-api/docs/features/banking/smart-organizer/interface-specification.md).

> All calls go through `lib/api/smartOrganizer.ts`. Wire is lowercase `snake_case`; in-memory params
> are camelCase and mapped at the client boundary. Responses are unwrapped from the `ApiResponse`
> envelope by the shared fetch helper.

---

## 1. List eligible transactions

```
GET /api/v1/banking/smart-organizer/eligible
fetchEligibleTransactions({ bankCd, acctNo, fromDt, toDt, keyword?, sortField?, sortDirection?, page?, size? })
```

| In-memory param | Wire |
|---|---|
| `bankCd` | `bank_cd` |
| `acctNo` | `acct_no` |
| `fromDt` / `toDt` | `from_dt` / `to_dt` (`yyyyMMdd`) |
| `keyword` | `q` |
| `sortField` | `sort_field` |
| `sortDirection` | `sort_dir` |
| `page` / `size` | `page` / `size` |

**Response** `ApiEligibleTransactionListResponse { total_count, rows: ApiEligibleTransactionRow[] }`.
`ApiEligibleTransactionRow` carries both codes and resolved display names (R07) plus `ccy_cd`/`bal`
(R06) — see the backend interface spec §1 for the full field list. The page renders display names with
a code fallback (`chart_acct_nm ?? chart_acct_cd`, etc.) and formats amounts via
`formatAmount(value, ccy_cd, true)`.

Called from `SmartOrganizerPage`'s effect, keyed on
`account, startDate, endDate, search, sortField, sortDirection, refreshKey`; a request counter discards
stale responses.

## 2. Confirm reviewed transactions

```
POST /api/v1/banking/smart-organizer/confirm
confirmEligibleTransactions({ bank_cd, acct_no, rows:[{ acct_seq_no, use_usag_cd?, vas_acct_seq_no?, trco_key?, chart_acct_cd?, chart_acct_seq_no? }] })
```

**Response** `ApiSmartOrganizerConfirmResponse { confirmed_count }`. On success the page shows
`smart_organizer_page.confirm_success` with the count, clears the selection, and bumps `refreshKey`
(confirmed rows drop out of the refetched list). On error it surfaces the backend error code/message
via `ApiCallError` (e.g. `WBE_SMART_ORGANIZER_ALREADY_CONFIRMED`,
`WBE_SMART_ORGANIZER_TRANSACTION_NOT_FOUND`).

## 3. Organizer Settings — rule CRUD

| Function | Endpoint | Body | Response |
|---|---|---|---|
| `fetchOrganizerRules()` | `GET …/rules` | — | `ApiOrganizerRuleListResponse { total_count, rows }` |
| `createOrganizerRule(body)` | `POST …/rules` | `ApiOrganizerRuleSaveRequest` | `ApiOrganizerRuleRow` |
| `updateOrganizerRule(rmrkSeqNo, body)` | `PUT …/rules/{rmrk_seq_no}` | `ApiOrganizerRuleSaveRequest` | `ApiOrganizerRuleRow` |
| `deleteOrganizerRule(rmrkSeqNo)` | `DELETE …/rules/{rmrk_seq_no}` | — | `void` |
| `reorderOrganizerRules(body)` | `POST …/rules/reorder` | `{ rows:[{ rmrk_seq_no, disp_ord }] }` | `void` |

`ApiOrganizerRuleSaveRequest` = `{ rmrk, match_type:"C"|"E", rcv_pay_dv:"RCV"|"PAY", disp_ord?, trco_key?, use_usag_cd?, vas_acct_seq_no?, chart_acct_seq_no?, chart_acct_cd? }`.

`OrganizerSettingsDialog.handleSave` orchestrates DELETE (flagged rows) → POST (new rows) → PUT
(changed rows), recomputing `disp_ord` from row position, then calls `onChanged()`. The standalone
`reorderOrganizerRules` client exists but the drag-save UI is **not yet wired** (tracked residual).

## 4. Picker option sources (settings dialog)

The four classification pickers load their options from the same shared endpoints used by Transaction
History detail (not from Smart Organizer endpoints):

| Picker | Source fn |
|---|---|
| Reporting Account | `fetchChartOfAccounts()` (`lib/api/chartOfAccounts`) |
| Purpose | `fetchPurposeSettings()` (`lib/api/purposeSettings`) |
| VAS Account | `fetchVasAccounts()` (`lib/api/vasAccount`) |
| Contact | `fetchContacts()` (`lib/api/contacts`) |

Each falls back to an empty option list on failure so the dialog stays usable.

## 5. Account scope (R11) on the wire

Every eligibility/confirm call includes `bank_cd` + `acct_no` taken from `?account={bankCd}_{acctNo}`.
If the query string is missing or malformed the page never calls the API — there is no tenant-wide
fallback. This mirrors the backend's mandatory-scope contract.

---

Backend endpoint reference:
[wecms-api/docs/features/banking/smart-organizer/interface-specification.md](../../../../../wecms-api/docs/features/banking/smart-organizer/interface-specification.md).

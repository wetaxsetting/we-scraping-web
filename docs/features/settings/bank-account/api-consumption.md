# Bank Account — API Consumption (Frontend)

Endpoints the panel calls, request/response wire shapes, and the error → dialog mapping. Backend
contract:
[wecms-api/docs/features/settings/bank-account/interface-specification.md](../../../../../wecms-api/docs/features/settings/bank-account/interface-specification.md).
All calls go through [lib/api/bankAccount.ts](../../../../lib/api/bankAccount.ts) (Axios `api` with JWT
interceptor); wire is lowercase snake_case, mapped to camelCase at the boundary in
[lib/api/mappers.ts](../../../../lib/api/mappers.ts).

---

## Endpoints

| Action | Client fn | Method + URL | Request | Response |
|---|---|---|---|---|
| List | `fetchBankAccounts(sort?)` | `GET /api/v1/settings/bank-account[?sortField&sortDirection]` | — | `ApiBankAccountListResponse` |
| Update | `updateBankAccount(bankCd, acctNo, body)` | `PATCH .../{bankCd}/{acctNo}` | `ApiBankAccountUpdateRequest` | `void` |
| Permission roster | `fetchBankAccountPermissions(bankCd, acctNo, kind)` | `GET .../{bankCd}/{acctNo}/permissions?type=VIEW\|WITHDRAWAL` | — | `ApiBankAccountPermissionResponse` |
| Permission save | `updateBankAccountPermissions(bankCd, acctNo, body)` | `PUT .../{bankCd}/{acctNo}/permissions` | `ApiBankAccountPermissionUpdateRequest` | `void` |
| Audit logs | `fetchBankAccountAuditLogs(bankCd, acctNo)` | `GET .../{bankCd}/{acctNo}/audit-logs` | — | `ApiBankAccountAuditResponse` |
| Register | (Login Credentials Add-chain client) | `POST .../register` | `{ bank_cd, items[] }` | `{ inserted, skipped }` |

`fetchBankAccounts` spreads `sort` (`{ sortField, sortDirection }`) into the query **only when both are
present** — the default (no-sort) state omits both keys so the backend uses its legacy default ORDER BY.

---

## Wire shapes (snake_case)

```ts
interface ApiBankAccountRow {
  bank_cd: string; bank_name: string; acct_no: string;
  currency: string | null; nickname: string | null; description: string | null;
  account_type_cd: string | null; maturity_date: string | null;       // ISO yyyy-MM-dd or null
  vas_acct_seq_no: number | null; vas_acct_cd: string | null; vas_acct_nm: string | null;
  vas_account_bank: string | null; prn_seq: number | null;
  bal: string | null; real_amt: string | null;
  last_modified_by: string | null; last_modified_at: string | null;   // yyyyMMddHHmmss
  view_permission_label: string | null; withdrawal_permission_label: string | null;
}
interface ApiBankAccountListResponse { items: ApiBankAccountRow[]; }

type ApiBankAccountUpdateRequest = {
  nickname?: string; description?: string;
  account_type_cd?: string;          // 2-char legacy code (FE translates from current/saving/fixed)
  maturity_date?: string;            // ISO yyyy-MM-dd; "" clears
  vas_acct_seq_no?: number;          // 0 clears the mapping; positive sets it
  vas_acct_cd?: string; vas_acct_nm?: string;   // echoes; omit all three to leave unchanged
};

interface ApiBankAccountPermissionMember {
  user_id: string; user_nm: string; user_type: "ADMIN" | "USER";
  phone_no: string | null; is_selected: boolean; is_locked: boolean;
  lock_reason: "ADMIN" | "SELF" | null;
}
interface ApiBankAccountPermissionResponse {
  kind: "VIEW" | "WITHDRAWAL"; account_label: string;
  members: ApiBankAccountPermissionMember[]; total_selected: number;
}
interface ApiBankAccountPermissionUpdateRequest { kind: "VIEW" | "WITHDRAWAL"; user_ids: string[]; }

interface ApiBankAccountAuditRow {
  audit_logs_seq_no: number; audit_logs_actv: string | null; audit_logs_actv_dtl: string | null;
  reg_id: string | null; reg_nm: string | null; reg_dtm: string | null;   // yyyyMMddHHmmss
}
interface ApiBankAccountAuditResponse { items: ApiBankAccountAuditRow[]; }
```

## Mapping (boundary)

- **`mapBankAccountRow`** → `BankAccountRow`: `bank_cd → bankCd`, `bank_name → bankName (|| bank_cd)`,
  `acct_no → accountNumber`, `currency` (coerced), `nickname/description (|| "")`,
  `account_type_cd → accountType` (lossy current/saving/fixed) + `accountTypeCd` (raw 2-char),
  `maturity_date → maturityDate (|| "")`, the VAS triple (`vas_acct_seq_no → vasAcctSeqNo (|| 0)`,
  `vas_acct_cd → vasCode`, `vas_acct_nm → vasAccountName`, `vas_account_bank → vasAccountBank`),
  `view_permission_label → viewPermissionLabel (|| "")`,
  `withdrawal_permission_label → withdrawalPermissionLabel (|| "")`,
  `last_modified_by → auditLogActor`, `last_modified_at → auditLogDate` (formatted). `id = bank_cd-acct_no`.
- **`mapBankAccountList`** → `BankAccountRow[]`.
- **`mapBankAccountAuditList`** → shared `AuditLogRow[]`: splits `reg_dtm` into date / time, actor =
  `reg_nm || reg_id || "-"`, passes `audit_logs_actv` / `audit_logs_actv_dtl` through verbatim
  (server-localized).

The `update` body is built by **diffing the edit dialog against the seed row** — only changed fields are
sent; the VAS triple rides together.

## Envelope + error handling

Every response is the standard `{ status: { error, code, message }, data, … }`. The client unwraps via
`unwrap<T>` and throws `ApiCallError` carrying `status.code`. `<BankAccountPanel>` / the dialogs map
codes to dialogs:

| Wire code | Dialog |
|---|---|
| `WBE_BANK_ACCOUNT_NOT_FOUND` | error |
| `WBE_BANK_ACCOUNT_INVALID_TYPE` / `_INVALID_DATE` / `_INVALID_VAS_ACCT` | error (edit dialog) |
| `WBE0452` | error (Withdrawal not available for this bank) |
| `WBE_USER_NOT_IN_TENANT` | error (permission dialog) |
| `WBE_CANNOT_REVOKE_SELF` | error (permission dialog) |
| `WBE_VALIDATION` | error |
| network | error (`NETWORK`) |

401s are handled globally by the Axios response interceptor (session-expired re-auth) — not per call.

## Notes

- The primary list read has **no mock fallback** — on error the panel surfaces an error dialog.
- Mutations bump `refreshKey`; `useApiData` refetches the full list (no optimistic source mutation).
- The Withdrawal-permission control is pre-disabled client-side via `isWithdrawalAllowedBank` on banks
  outside the 5-bank whitelist (mirrors the backend `WithdrawalBankPolicy` / `WBE0452` guard).
- There is **no** export endpoint consumed — Bank Account has no data export.

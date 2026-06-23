# Login Credentials — API Consumption (Frontend)

Endpoints the panel calls, request/response wire shapes, and the error → dialog mapping. Backend
contract:
[wecms-api/docs/features/settings/login-credentials/interface-specification.md](../../../../../wecms-api/docs/features/settings/login-credentials/interface-specification.md).
All calls go through [lib/api/loginCredentials.ts](../../../../lib/api/loginCredentials.ts) (Axios `api`
with the JWT interceptor); wire is lowercase snake_case, mapped to camelCase at the boundary. **The
frontend is fully wired — verified 2026-06-02, no mock fallback** for bank/GDT CRUD, Reveal, or Audit
Logs.

---

## Endpoints

| Action | Client fn | Method + URL | Request | Response |
|---|---|---|---|---|
| List | `fetchLoginCredentials()` | `GET /api/v1/login-credentials` | — | `ApiLoginCredentialListResponse` |
| Bank picker | `fetchLoginCredentialBanks(search?)` | `GET /api/v1/login-credentials/banks?search=` | — | `ApiLoginCredentialBankPickerResponse` |
| Per-bank form info | `fetchLoginCredentialBankFormInfo(bankCd)` | `GET /api/v1/login-credentials/banks/{bankCd}/form-info` | — | `ApiLoginCredentialBankFormInfoResponse` |
| Create bank | `createBankLoginCredential(body)` | `POST /api/v1/login-credentials/bank` | `ApiLoginCredentialBankCreateRequest` | `ApiLoginCredentialCreateResponse` |
| Atomic save | `createBankLoginCredentialWithAccounts(body)` | `POST /api/v1/login-credentials/bank/register` | `ApiBankCredentialRegisterRequest` | `ApiLoginCredentialCreateResponse` |
| Update bank | `updateBankLoginCredential(seqNo, body)` | `PUT /api/v1/login-credentials/bank/{seqNo}` | `ApiLoginCredentialBankUpdateRequest` | `void` |
| Verify new pw (no write) | `verifyBankPasswordUpdate(seqNo, password)` | `POST /api/v1/login-credentials/bank/{seqNo}/verify-update` | `{ password }` | `ApiScrapeSessionResponse` |
| Create GDT | `createGdtLoginCredential(body)` | `POST /api/v1/login-credentials/gdt` | `ApiLoginCredentialGdtCreateRequest` | `ApiLoginCredentialCreateResponse` |
| Update GDT | `updateGdtLoginCredential(seqNo, body)` | `PUT /api/v1/login-credentials/gdt/{seqNo}` | `ApiLoginCredentialGdtUpdateRequest` | `void` |
| GDT engine config | `fetchGdtEngineConfig()` | `GET /api/v1/login-credentials/gdt/engine-config` | — | `ApiGdtEngineConfigResponse` |
| Delete | `deleteLoginCredential(type, seqNo)` | `DELETE /api/v1/login-credentials/{type}/{seqNo}` | — | `void` |
| Reveal | `revealLoginCredential(type, seqNo, body)` | `POST /api/v1/login-credentials/{type}/{seqNo}/reveal` | `ApiLoginCredentialRevealRequest` | `ApiLoginCredentialRevealResponse` |
| Audit logs | `fetchLoginCredentialAuditLogs(type, seqNo)` | `GET /api/v1/login-credentials/{type}/{seqNo}/audit-logs` | — | `ApiLoginCredentialAuditResponse` |

`{type}` ∈ `bank` \| `gdt`. The Add-flow Coocon verify (`POST /api/v1/banking/scraping/verify` +
`/{sessionId}/otp`) is consumed from the **banking** scraping client, not this module's client.

---

## Wire shapes (snake_case) — `lib/types/api.ts`

```ts
// Requests
interface ApiLoginCredentialBankCreateRequest {
  bank_cd: string; login_id: string; password: string;
  extra?: string; login_type?: string; nxisas_gb_seq_no?: number;
}
interface ApiLoginCredentialBankUpdateRequest {
  login_id?: string; password?: string; extra?: string;
  login_type?: string; nxisas_gb_seq_no?: number;       // (+ old_password guard, wire: old_password)
}
interface ApiLoginCredentialGdtCreateRequest { login_id: string; password: string; extra?: string; }
interface ApiLoginCredentialGdtUpdateRequest { login_id?: string; password?: string; extra?: string; }
interface ApiLoginCredentialRevealRequest { user_password: string; }
// ApiBankCredentialRegisterRequest = bank create fields + accounts[] (the banking register entry shape)

// Responses
interface ApiLoginCredentialAccount {
  seq_no: number; login_id: string | null; nxisas_gb_seq_no: number | null; login_type: string | null;
}
interface ApiLoginCredentialBankAccount { bank_cd: string | null; acct_no: string; acct_nick_nm: string | null; }
interface ApiLoginCredentialGroup {
  type: "BANK" | "GDT"; bank_cd: string | null; institution: string;
  modified_by: string | null; modified_at: string | null;
  accounts: ApiLoginCredentialAccount[]; bank_accounts: ApiLoginCredentialBankAccount[];
}
interface ApiLoginCredentialListResponse { items: ApiLoginCredentialGroup[]; }
interface ApiLoginCredentialRevealResponse { login_id: string | null; password: string | null; }
interface ApiLoginCredentialCreateResponse { seq_no: number; }
interface ApiLoginCredentialAuditRow {
  audit_logs_seq_no: number; audit_logs_actv: string | null; audit_logs_actv_dtl: string | null;
  reg_id: string | null; reg_nm: string | null; reg_dtm: string | null;
}
interface ApiLoginCredentialAuditResponse { items: ApiLoginCredentialAuditRow[]; }
interface ApiLoginCredentialBankPickerRow { bank_cd: string; bank_nm: string; bank_img: string | null; }
interface ApiLoginCredentialBankPickerResponse { items: ApiLoginCredentialBankPickerRow[]; }
interface ApiLoginCredentialBankFormInfoSubType {
  bank_cd: string; seq_no: number; seq_nm: string | null; logo_url: string | null;
  id_label: string | null; password_label: string | null; confirm_label: string | null; extra_label: string | null;
}
interface ApiLoginCredentialBankFormInfoResponse { bank_cd: string; sub_types: ApiLoginCredentialBankFormInfoSubType[]; }
interface ApiGdtEngineConfigResponse { api_id: string; scrapping_module: string; scrapping_class: string; bank_cd: string; }
```

> The Coocon/NXiSAS gateway DTOs (`ApiScrapeSessionResponse` and friends) keep **vendor casing**
> outside the WeCMS lowercase rule — they bind an external integration contract.

---

## Mapping (boundary)

Each `ApiLoginCredentialGroup` → an in-memory `LoginCredentialRow` (camelCase: `type`, `bankCd`,
`institution`, `modifiedBy`, `modifiedAt`, `accounts[]`, `bankAccounts[]`). `buildRegisteredCredentialEntries`
([registeredCredentials.ts](../../../../components/settings/login-credentials/registeredCredentials.ts))
turns a bank group's `accounts` + `bankAccounts` into the per-login `RegisteredCredentialEntry` rows the
Registered dialog renders (login id + sub-type label + linked-account summary). Audit rows map via the
`auditLogs.ts` view types. **The password is never on the list/group wire** — only
`ApiLoginCredentialRevealResponse.password` carries it, after a successful re-auth.

---

## Envelope + error handling

Every response is the standard `{ status: { error, code, message }, data, … }`. The client checks
`status.error` (HTTP 200 ≠ success for business errors) and throws `ApiCallError` carrying
`status.code` + `trace_id`. `<LoginCredentialsPanel>` maps codes to `useDialog()` dialogs:

| Wire code | Dialog |
|---|---|
| `WBE2090` | error — credential not found |
| `WBE2091` | error — password confirmation failed (reveal / update guard) |
| `WBE_LOGIN_CREDENTIAL_GDT_EXISTS` | error — GDT already exists |
| `WBE_LOGIN_CREDENTIAL_GDT_VERIFY_FAILED` | error — `settings.login_credentials.gdt.login_failed` |
| `WBE_BANK_ACCOUNT_REGISTER_EMPTY` | error — `settings.login_credentials.bank_login.unknown_error` |
| scrape `error_code` (`WBE_NXISAS`, `WBE6121` captcha, `80000015` unlicensed origin, …) | resolved via `lookupScrapingResultMessage` / GDT engine keys, surfaced in the Add / challenge dialog |
| GDT engine probe (`WBE_NXISAS_ENGINE`, loading, unsupported OS) | error / warning per `settings.login_credentials.gdt.engine_*` |
| network / other | error · `dialog.error` / generic |

Success uses `type: "success"` (`delete_success` / `disconnect_success` / `edit_success` /
`reveal_success` / `select_bank_accounts.save_success` / `gdt.save_success`). 401s are handled
globally by the Axios response interceptor (session-expired re-auth) — not per call.

---

## Notes

- **No mock fallback** — bank/GDT CRUD, Reveal, and Audit Logs all call live endpoints (verified
  2026-06-02). The Select Bank Accounts mapper has a static mock data file
  (`selectBankAccountsMockData.ts`) used only for the static-UI shape, superseded by the live scrape.
- Every successful mutation bumps `refreshTick`; `useApiData` refetches the full grouped list.
- There is **no** export endpoint consumed — Login Credentials has no data export.

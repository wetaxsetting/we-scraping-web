# Firm Banking Settings — API Consumption (Frontend)

Endpoints the panel calls, request/response wire shapes, and the error → dialog mapping. Backend
contract: [wecms-api/docs/features/settings/firm-banking-settings/interface-specification.md](../../../../../wecms-api/docs/features/settings/firm-banking-settings/interface-specification.md).
All calls go through [lib/api/firmBankingSettings.ts](../../../../lib/api/firmBankingSettings.ts) (Axios
`api` with JWT interceptor); wire is lowercase snake_case, mapped to camelCase at the boundary.

**Wired status:** the panel consumes **all six** endpoints live (no mock-only paths) — list + delete from
the panel, detail + audit from the Details dialog, create from the Add dialog, update from the Edit
dialog. A mock fallback tree paints only when the list fetch fails.

---

## Endpoints

| Action | Client fn | Method + URL | Request | Response |
|---|---|---|---|---|
| List | `fetchFirmBankingSettings()` | `GET /api/v1/settings/firm-banking-settings` | — | `{ list: ApiFirmBankingSettingRow[] }` |
| Detail | `fetchFirmBankingSetting(outBankCd, wdrlActNo)` | `GET .../{out_bank_cd}/{wdrl_act_no}` | — | `ApiFirmBankingSettingDetail` (cleartext `wdrl_act_no`) |
| Audit | `fetchFirmBankingSettingAudit(outBankCd, wdrlActNo)` | `GET .../{out_bank_cd}/{wdrl_act_no}/audit` | — | `{ list: ApiFirmBankingAuditEntry[] }` |
| Create | `createFirmBankingSetting(body)` | `POST .../firm-banking-settings` | `ApiFirmBankingSettingCreateRequest` | `ApiFirmBankingSettingDetail` (echo) |
| Update | `updateFirmBankingSetting(outBankCd, wdrlActNo, body)` | `PUT .../{out_bank_cd}/{wdrl_act_no}` | `ApiFirmBankingSettingUpdateRequest` | `ApiFirmBankingSettingDetail` |
| Delete | `deleteFirmBankingSetting(outBankCd, wdrlActNo)` | `DELETE .../{out_bank_cd}/{wdrl_act_no}` | — | `void` (envelope only; `data` omitted) |

Path components are `encodeURIComponent`-ed so account-number characters round-trip. Automation toggles
call a **separate** Environment Settings endpoint (not in this client) via `useEnvironmentSettings`.

---

## Wire shapes (snake_case)

```ts
interface ApiFirmBankingSettingRow {            // list row — wdrl_act_no CLEARTEXT (backend never masks)
  biz_key: string; out_bank_cd: string;
  bank_nm: string | null; ccy_cd: string | null;
  bank_prtn_id: string; van_org_cd: string; org_stat: string;
  wdrl_act_no: string;                          // cleartext PK; mapper masks the DISPLAY only
  file_type: string; bat_tran_branch_div: string; bat_tran_branch_limit: number;
  reg_dttm: string; start_dttm: string | null; end_dttm: string | null;
  mod_dttm: string | null; last_edtr: string | null;
  bal: number | null; expi_dt: string | null;
}

interface ApiFirmBankingSettingDetail {         // detail — wdrl_act_no CLEARTEXT, no JOIN columns
  biz_key: string; out_bank_cd: string;
  bank_prtn_id: string; van_org_cd: string; org_stat: string;
  wdrl_act_no: string;                          // cleartext (edit round-trip)
  file_type: string; bat_tran_branch_div: string; bat_tran_branch_limit: number;
  reg_dttm: string; start_dttm: string | null; end_dttm: string | null;
  mod_dttm: string | null; last_edtr: string | null;
}

interface ApiFirmBankingAuditEntry {
  audit_logs_actv: string | null; audit_logs_actv_dtl: string;   // pre-localized; render verbatim
  reg_id: string; reg_nm: string; reg_dtm: string;               // yyyyMMddHHmmss
}

type ApiFirmBankingSettingCreateRequest = {     // file_type NOT on the wire (server-derived)
  out_bank_cd: string; wdrl_act_no: string;
  bank_prtn_id: string; van_org_cd: string; org_stat: string;    // org_stat defaults to "1"
};
type ApiFirmBankingSettingUpdateRequest = {     // editable fields only; PK in the path
  bank_prtn_id: string; van_org_cd: string; org_stat: string;
};
```

## Mapping (boundary)

- `mapFirmBankingSettingRow` → `FirmBankingLinkedAccount`: resolves the bank brand + short name by NAPAS
  code (falls back to `bank_nm`), **masks** `wdrl_act_no` for display and appends ` (ccy)` when `ccy_cd`
  is present, derives `status` from `org_stat === "1"`, composes `lastUpdated` from `mod_dttm ?? reg_dttm`
  + `last_edtr`. Keeps `outBankCd` / `wdrlActNo` cleartext as the PK for subsequent API calls. `id` is
  `${out_bank_cd}-${wdrl_act_no}`.
- `mapFirmBankingAuditEntry` → `FirmBankingAuditLogRow`: splits `reg_dtm` into `date`/`time`, renders
  `audit_logs_actv_dtl` verbatim (already locale-matched).
- `mapAccountLookupOption` → `AccountLookupOption`: composes the `<masked> (<ccy>)` display label for the
  Create autocomplete.

## Envelope + error handling

Every response is the standard `{ status: { error, code, message }, data, … }`. The client checks
`status.error` (HTTP 200 ≠ success for business errors) and throws `ApiCallError` carrying `status.code`.
The Delete path uses a dedicated unwrap (the success envelope carries no `data`). `<FirmBankingSettingsPanel>`
and the dialogs map codes to dialogs:

| Wire code | Dialog |
|---|---|
| `WBE0001` | error — bank outside the supported 3-set (Create) |
| `WBE0002` | error — bank not in `TB_FIRM_BANK_CODE` (Create) |
| `WBE2021` | error — binding already exists (Create) |
| `WBE2020` | error — binding not found (Detail / Update / Delete) |
| network | error — `NETWORK` |
| other | error — `WBE9999` |

401s are handled globally by the Axios response interceptor (session-expired re-auth) — not per call.

## Notes

- **Masking:** the backend ships `wdrl_act_no` **cleartext on both list and detail** — it is the PK the
  client addresses for Delete / Update / Detail / Audit (the backend's `@Pattern` guard rejects the `*`
  mask characters). `mapFirmBankingSettingRow` produces TWO fields from the one wire value: `wdrlActNo`
  (cleartext PK, used in API paths) and `accountNumber` (masked display string, `7000****5280 (VND)`,
  never sent back). Masking is therefore entirely frontend-side.
- **No export / import** endpoint is consumed.
- **Stale backend-comment cross-reference:** the audit-fetch Javadoc in `firmBankingSettings.ts` still
  reads `WSVC_ID='comm_0220_001'` — that comment is **stale**; the backend service reads/writes the audit
  rows with the slug `firm-banking-settings` (OQ-6 override). The frontend only renders pre-localized
  audit strings, so the value has no frontend impact. Logged in the backend
  [wecms-api/…/refactor-gap-analysis.md](../../../../../wecms-api/docs/features/settings/firm-banking-settings/refactor-gap-analysis.md).

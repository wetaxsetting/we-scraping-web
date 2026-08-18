# Contacts — API Consumption (Frontend)

Endpoints the panel calls, request/response wire shapes, and the error → dialog mapping. Backend
contract: [wecms-api/docs/features/settings/contacts/interface-specification.md](../../../../../wecms-api/docs/features/settings/contacts/interface-specification.md).
All calls go through [lib/api/contacts.ts](../../../../lib/api/contacts.ts) (`BASE = /api/v1/settings/contacts`,
Axios `api` + JWT interceptor); wire is lowercase snake_case, mapped to camelCase at the boundary
([mappers.ts](../../../../components/settings/contacts/mappers.ts)).

---

## Endpoints

| Action | Client fn | Method + URL | Request | Response |
|---|---|---|---|---|
| List / search | `fetchContacts(params)` | `GET {BASE}` | query: `search, trco_type, sort_field, sort_direction, page, size` | `ApiContactListResponse` (`rows[]`, `total_count`, `page`, `size`, `total_pages`) |
| Detail | `fetchContact(trcoKey)` | `GET {BASE}/{trcoKey}` | — | `ApiContactDetail` |
| Create | `createContact(body)` | `POST {BASE}` | `ApiContactCreateRequest` | `ApiContactDetail` |
| Update | `updateContact(trcoKey, body)` | `PUT {BASE}/{trcoKey}` | `ApiContactUpdateRequest` | `ApiContactDetail` |
| Delete | `deleteContact(trcoKey)` | `DELETE {BASE}/{trcoKey}` | — | void (`WBE1190` guard) |
| Bulk delete | `bulkDeleteContacts(body)` | `POST {BASE}/bulk-delete` | `{ trco_keys: string[] }` | void |
| Import | `bulkImportContacts(body)` | `POST {BASE}/excel/import` | `{ contacts: ApiContactCreateRequest[] }` | `{ total, imported, failed, errors[] }` |
| Import preflight | `preflightContactsImport(body)` | `POST {BASE}/excel/preflight` | `{ rows: { hand_trco_key, trco_tax_id? }[] }` | `{ results: { row_index, hand_trco_key_exists, trco_tax_id_exists }[] }` |
| Import resolve | `resolveContactsImportRecipients(body)` | `POST {BASE}/excel/resolve-recipients` | `{ rows: { row_index, bank_name?, acct_no?, currency? }[] }` | `{ results: { row_index, bank_found, ant_div_cd, napas_bank_cd, citad_bank_cd, finc_mda_owner_nm }[] }` |
| By codes | `fetchContactsByBeneficiaryCodes(codes)` | `POST {BASE}/by-codes` | `{ codes: string[] }` | `ApiContactDetail[]` (overseas batch-payment; not the panel) |
| Bank list | `fetchContactBanks()` | `GET {BASE}/banks` | — | `{ rows: ApiContactBankRow[] }` (NAPAS + CITAD) |
| Lookup recipient | `lookupContactRecipient(body)` | `POST {BASE}/lookup-recipient` | `{ napas_bank_cd?, citad_bank_cd?, acct_no }` | `{ recipient_name }` (stub) |
| List files | `listContactFiles(trcoKey)` | `GET {BASE}/{trcoKey}/files` | — | `{ rows: ApiContactFileRow[] }` |
| Upload file | `uploadContactFile(trcoKey, file)` | `POST {BASE}/{trcoKey}/files` | multipart `file` | `ApiContactFileRow` |
| Delete file | `deleteContactFile(trcoKey, fileId)` | `DELETE {BASE}/{trcoKey}/files/{fileId}` | — | void |
| Download URL | `contactFileDownloadUrl(trcoKey, fileId)` | (URL only) `GET {BASE}/{trcoKey}/files/{fileId}` | — | binary stream |
| Export (GAP-01) | `exportContacts({ type, keyword, t })` | `POST {BASE}/export` (via shared `lib/excel.ts exportExcel`) | screenId + columns + filters | XLSX blob |

All unwrap the `{ status, data }` envelope via `unwrap()`, throwing `ApiCallError(code, message)` on
`status.error`. Void endpoints bypass `unwrap`.

---

## Wire shapes (snake_case)

```ts
interface ApiContactRow {            // = ApiContactDetail
  trco_key: string; hand_trco_key: string;
  trco_cmnm: string; trco_cmenm: string; trco_tax_id: string | null;
  trco_type: "L" | "O"; trco_stts: string | null; mod_dtm: string | null;
  addresses: ApiContactAddressRow[];
  accounts: ApiContactAccountRow[];
  overseas_beneficiaries: ApiContactOverseasRow[];
}
interface ApiContactAddressRow  { trco_addr_key: string; trco_bsun_post_adrs: string | null; disp_ord: number | null; issu_dt: string | null; due_dt: string | null; }
interface ApiContactAccountRow  { trco_acct_key: string; acct_no: string | null; disp_ord: number | null; bank_nm: string | null; napas_bank_cd: string | null; citad_bank_cd: string | null; acct_ccy_cd: string | null; finc_mda_owner_nm: string | null; owac_addr: string | null; }
interface ApiContactOverseasRow { trco_ovrs_key: string; bene_name: string | null; bene_acct_no: string | null; bic_code: string | null; bene_bank_name: string | null; bene_bank_code: string | null; bene_addr: string | null; }

interface ApiContactListResponse { rows: ApiContactRow[]; total_count: number; page: number; size: number; total_pages: number; }

// Create/Update: child rows carry a discriminated `op` ("upsert" | "delete").
interface ApiContactCreateRequest {
  hand_trco_key: string; trco_cmnm: string; trco_cmenm: string;
  trco_tax_id?: string | null; trco_type: "L" | "O";
  addresses: AddressOp[]; accounts: AccountOp[]; overseas_beneficiaries: OverseasOp[];
}
interface ApiContactUpdateRequest extends ApiContactCreateRequest {
  trco_stts: string | null;
  accounts_to_delete: { trco_acct_key: string }[];
  overseas_to_delete: { trco_ovrs_key: string }[];
}

interface ApiContactBankRow { bank_cd: string; ant_div_cd: string; bank_nm: string; bank_eng_nm: string; eng_abrvat_nm: string; status: string; }
interface ApiContactFileRow { file_id: string; org_file_nm: string; file_size: string; reg_dtm: string; reg_nm: string; trco_infm_titl: string; }
```

## Mapping (boundary)

[mappers.ts](../../../../components/settings/contacts/mappers.ts):
- `toContactRow` — wire row → table row; sorts addresses by `disp_ord` (current=1, previous=2), `+N`
  badge for extras; `deposit` from `accounts[0]` (Local) or `overseas_beneficiaries[0]` (Overseas).
- `toFormValues` — detail → edit seed (accounts → bankDiv/bankCd from NAPAS/CITAD; recipient from
  `finc_mda_owner_nm`; current/previous addresses; `validTill` via `toIsoDate`).
- `toCreateRequest` / `toUpdateRequest` → `buildBody` — splits bank into `napas_bank_cd`/`citad_bank_cd`;
  builds address ops (`disp_ord` 1/2, delete op when previous cleared; `due_dt` from Valid Till or
  `FAR_FUTURE_DUE_DT=99991231`); generates client keys; update adds `trco_stts: null` +
  `accounts_to_delete` / `overseas_to_delete`.

Field-mapping chain (UI ↔ wire ↔ DB): see [ui-specification.md](ui-specification.md) and the backend
[wecms-api/…/database-mapping.md](../../../../../wecms-api/docs/features/settings/contacts/database-mapping.md).

## Envelope + error handling

Standard `{ status: { error, code, message }, data, … }`. Clients check `status.error` (HTTP 200 ≠
success) and throw `ApiCallError` carrying `status.code` + `trace_id`. `<ContactsPanel>` maps:

| Wire code | Surface |
|---|---|
| `WBE1190` | delete error → `settings.contacts.delete_error.in_use` |
| `WBE_CONTACTS_HAND_KEY_DUP` | inline `msg1` on Contact Code |
| `WBE_CONTACTS_TAX_ID_DUP` | inline `msg2` on Tax ID |
| `WBE_CONTACTS_ACCT_DUP` / `_BENE_DUP` | dialog / inline (account / beneficiary dup) |
| import errors (`errors[]`) | per-row highlight + success/error dialog from `imported`/`failed` |
| other | error dialog (`useDialog({ type: "error" })`) with the envelope message |

401s are handled globally by the Axios response interceptor (session-expired re-auth), not per call.

## Notes

- **No react-query** — `useContactsList`/`useContactsMutations` use plain React state; mutations bump a
  refresh key.
- **Export** posts the screen-id (`settings-contacts-local` / `settings-contacts-overseas`) + column
  spec + `filters.keyword` to `POST /export` via shared `lib/excel.ts`; backend is the single XLSX
  producer (GAP-01 closed 2026-06-08).
- Bank list is fetched once on dialog mount; recipient lookup is NAPAS-VND-only.

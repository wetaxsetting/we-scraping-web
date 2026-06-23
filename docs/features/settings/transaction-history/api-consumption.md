# ERP Transaction History — API Consumption (Frontend)

Endpoints the panel calls, request/response wire shapes, and the error → dialog mapping. Backend
contract: [wecms-api/.../interface-specification.md](../../../../../wecms-api/docs/features/settings/transaction-history/interface-specification.md).
All calls go through [lib/api/erpTransactionHistory.ts](../../../../lib/api/erpTransactionHistory.ts)
(Axios `api` with JWT interceptor); wire is lowercase snake_case, mapped to camelCase
`ErpTransactionHistoryRow` at the boundary via [lib/api/mappers.ts](../../../../lib/api/mappers.ts).

---

## Endpoints consumed

| Action | Client fn | Method + URL | Request | Response |
|---|---|---|---|---|
| List + 4 counts | `fetchErpTransactionHistory(params)` | `GET /api/v1/settings/erp-transaction-history` | query params (snake_case) | `ApiErpTransactionHistoryListResponse` |
| Download | `getErpTransactionHistoryDownloadUrl(seqNo)` → `downloadFile(url, name)` | `GET .../{seqNo}/download` | — | binary (blob) |
| Export | (toolbar, when wired) via shared `useExcelExport` | `POST .../export` | `ExcelExportRequest` | XLSX blob |

There is **no detail / create / update / delete call** — the list row carries every field, and the only
per-row read is the download. There is **no upload call** (write-path not ported, OQ-1).

The `fetchErpTransactionHistory` client strips empty/undefined params and marshals camelCase →
snake_case (`fromDate → from_date`, `erpType → erp_type`, `trnsTypeCd → trns_type_cd`,
`sortField → sort_field`, etc.). `from_date` / `to_date` are always sent (panel defaults to last-30-days).

---

## Wire shapes (snake_case)

```ts
// request params (FetchErpTransactionHistoryParams)
{
  fromDate: string;          // required, YYYYMMDD
  toDate: string;            // required, YYYYMMDD
  erpType?: "W" | "E" | "D";
  trnsTypeCd?: string;       // "01".."17"
  keyword?: string;          // matches reg_id
  page?: number;             // 0-based
  size?: number;             // clamped to 100; default 15
  sortField?: string;        // REG_DTM | ERP_TYPE | TRNS_TYPE_CD | REG_USER
  sortDirection?: "ASC" | "DESC";
}

// response row
interface ApiErpTransactionHistoryRow {
  seq_no: number;
  org_file_nm: string;
  save_file_nm: string;
  file_size: number;
  erp_type: string;              // "W" | "E" | "D"
  erp_type_key: string | null;   // settings.erp_transaction_history.direction.*
  trns_type_cd: string;          // "01".."17"
  trns_type_key: string | null;  // settings.erp_transaction_history.type.NN
  reg_dtm: string;               // yyyyMMddHHmmss
  reg_id: string;
  user_nm: string | null;        // LEFT JOIN UserInfm; null for SYSTEM / removed
}

// response envelope
interface ApiErpTransactionHistoryListResponse {
  list: ApiErpTransactionHistoryRow[];
  total_count: number;
  total_count_wecms: number;
  total_count_erp: number;
  total_count_deleted: number;
  page_number: number;   // 0-based
  page_size: number;
  total_pages: number;
}
```

## Mapping (boundary)

`mapErpTransactionHistoryRow` turns each wire row into an `ErpTransactionHistoryRow`: `seq_no → seqNo`,
`org_file_nm → orgFileNm`, `file_size → fileSize`, `erp_type → erpType` (narrowed to `ErpDirection`,
defaulting to `"D"` for any unknown code — type-safety only; backend already rejects unknowns),
`erp_type_key → erpTypeKey`, `trns_type_cd → trnsTypeCd`, `trns_type_key → trnsTypeKey`,
`reg_dtm → regDtm`, `reg_id → regId`, `user_nm → userNm`.

The table renders direction / type via `t(erpTypeKey)` / `t(trnsTypeKey)` and falls back to the raw
code when the key is `null`. The User cell renders `userNm ?? regId`.

## Tab-count mapping (4 tabs)

The single response carries all four counts; the panel maps them to the tab strip — the `erp_type`
filter (which tab is active) does **not** change the counts (server fan-out drops the predicate):

```ts
counts = {
  all: total_count,
  W:   total_count_wecms,
  E:   total_count_erp,
  D:   total_count_deleted,
};
```

The active tab sets the wire `erp_type` (`all` omits it). Switching to the **Deleted** tab narrows the
type dropdown to `DELETED_TAB_TYPE_SUBSET` and resets the type to `all` if the current selection is now
hidden — a frontend-only filter (the backend accepts any valid code on any tab).

## Download handling

```ts
await downloadFile(getErpTransactionHistoryDownloadUrl(row.seqNo), row.orgFileNm);
```

`downloadFile` (in `lib/file.ts`) fires an authenticated XHR (so the `Authorization: Bearer` header
rides along), reads the blob, and triggers a synthetic anchor save — a plain `<a href download>` would
not carry the JWT (which lives in localStorage). The server-side `Content-Disposition` (= `SAVE_FILE_NM`)
takes precedence over the suggested `orgFileNm`. Errors come back as a JSON envelope and surface through
the error dialog.

## Envelope + error → dialog mapping

Every response is the standard `{ status: { error, code, message }, data, … }`. The client unwraps it,
throwing `ApiCallError(code, message)` on `status.error`. `<ErpTransactionHistoryPanel>` maps codes to
dialogs (deduped by code via `lastSurfacedRef`):

| Wire code | Dialog |
|---|---|
| `WBE_VALIDATION` | **suppressed** (panel state guards it) |
| `WBE2014` | error · download — row not found / wrong tenant |
| `WBE2015` | error · download — file unavailable |
| `WBE9001` | error · thumbnail not implemented (not called by the panel today) |
| `WBE2010`/`WBE2011`/`WBE2013` | export errors (when export is wired; `WBE2013` is the current live seed-gap risk — see backend GAP-4) |
| network / other | error · backend code + message |

401s are handled globally by the Axios response interceptor (session-expired re-auth) — not per call.

## Notes

- **No mock fallback** — on fetch failure the panel surfaces the error dialog and renders an empty table
  (latched `stableData` keeps prior chrome until the next success).
- Mutations: none. The list refetches on any filter / tab / sort / page change via the `useApiData`
  dependency list.
- **No export endpoint consumed by the panel today** — the backend export provider is wired but the
  panel's toolbar export is gated on the View Setting seed (backend GAP-4). When seeded + wired it goes
  through the shared `useExcelExport` hook, not a bespoke call.

# Firm Banking History — API Consumption (Frontend)

Parent: [README.md](README.md). Authoritative REST contract: [wecms-api .../interface-specification.md](../../../../../wecms-api/docs/features/settings/firm-banking-history/interface-specification.md).

---

## 1. List API

```
GET /api/v1/settings/firm-banking-history
```

Client: [`fetchFirmBankingHistory(params)`](../../../../lib/api/firmBankingHistory.ts).

`FetchFirmBankingHistoryParams` (camelCase) → wire (snake_case), undefined/empty stripped:

| Param (camelCase) | Wire | Required | Notes |
|---|---|---|---|
| `fromDate` | `from_date` | ✅ | `YYYYMMDD` |
| `toDate` | `to_date` | ✅ | `YYYYMMDD` |
| `svcType` | `svc_type` | — | `"F" \| "S" \| "G" \| "B"` |
| `keyword` | `keyword` | — | seq-no partial match |
| `page` | `page` | — | zero-based |
| `size` | `size` | — | default 10 sent by the panel |
| `sortField` | `sort_field` | — | View Setting FIELD_ID |
| `sortDirection` | `sort_direction` | — | `"ASC" \| "DESC"` |

## 2. Wire types ([`lib/types/api.ts`](../../../../lib/types/api.ts))

```ts
interface ApiFirmBankingHistoryRow {
  tarn_dtm: string;          // YYYYMMDDHHmmss
  svc_type: string;          // F | S | G | B
  svc_type_key: string | null;
  svc_nm: string;
  svc_name_key: string | null;
  seq_no: string;
  dep_bank_cd: string;
  rslt_cd: string;
  rslt_msg: string;
  job: string;
  req_data: string | null;   // JSON (G/B legs)
  van_org_cd: string | null; // F leg
}

interface ApiFirmBankingHistoryListResponse {
  list: ApiFirmBankingHistoryRow[];
  total_count: number;
  page_number: number;       // zero-based
  page_size: number;
  total_pages: number;
}
```

## 3. Mapper ([`lib/api/mappers.ts`](../../../../lib/api/mappers.ts))

`mapFirmBankingHistoryRow(api)` → `FirmBankingHistoryRow` (camelCase):

| Wire | Frontend | Transform |
|---|---|---|
| `svc_type_key` | `serviceType` | `extractFirmBankingServiceType(svc_type_key)` → union; falls back to `firm_banking_transaction` |
| `svc_nm` | `serviceName` | verbatim |
| `svc_name_key` | `serviceNameKey` | verbatim (or null) |
| `tarn_dtm` | `date` + `time` | `formatLegacyDtmInDisplayTz(...)` (UTC → Asia/Ho_Chi_Minh; `{date, time}`) |
| `seq_no` | `seqNo` | verbatim |
| `dep_bank_cd` | `instCode` | verbatim |
| `rslt_cd` | `rsltCd` + `result` | verbatim + 3-state coercion (`00000000`/`0000` → `success`, else `failed`) |
| `rslt_msg` | `rsltMsg` | verbatim |
| `job` / `req_data` / `van_org_cd` | `job` / `reqData` / `vanOrgCd` | verbatim |
| (synthesized) | `id` | `${svc_type}-${job}-${seq_no}-${tarn_dtm}` — stable React key (S-leg spawns multiple jobs per seq) |

## 4. Detail API — none

There is no detail endpoint. The View Details popover renders from the already-fetched row.

## 5. Export API

```
POST /api/v1/settings/firm-banking-history/export   (XLSX)
```

**Frontend status: not wired.** The panel renders no Excel/list toolbar button and does not import
`useExcelExport` — there is currently no client call to this endpoint. The backend endpoint +
`FirmBankingHistoryExportProvider` exist and are ready; when the panel wires the trigger it must use
the shared `useExcelExport()` hook (`lib/excel.ts`) with the shared `ExcelExportRequest` (screenId
`firm-banking-history`, filters + sort + columns) — backend (Apache POI) is the single XLSX producer,
no frontend xlsx/CSV library.

## 6. Error handling

- Fetcher throws `ApiCallError` carrying `status.code` + `trace_id`.
- The panel surfaces non-validation errors via `useDialog().open({ type: "error", errorCode, … })`, de-duped via `lastSurfacedRef`; `WBE_VALIDATION` is suppressed (panel guarantees its own input shape).
- 401 → handled globally by the Axios session-expired interceptor.

## 7. Backend cross-reference

- REST contract + error registry: [wecms-api interface-specification.md](../../../../../wecms-api/docs/features/settings/firm-banking-history/interface-specification.md)
- Column → field mapping: [wecms-api database-mapping.md](../../../../../wecms-api/docs/features/settings/firm-banking-history/database-mapping.md)

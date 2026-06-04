# Operation Status Inquiry — API Consumption

How the frontend talks to the backend. All calls go through `api` (Axios + JWT interceptor in [lib/axios.ts](../../../../lib/axios.ts)), unwrap the `ApiResponse<T>` envelope, and throw `ApiCallError` (carrying the WBE `status.code` + `trace_id`) on `status.error`. Wire JSON is lowercase snake_case; in-memory rows are camelCase (translated in [lib/api/mappers.ts](../../../../lib/api/mappers.ts)).

Backend contract: [../../../../../wecms-api/docs/features/addon-service/operation-status-inquiry/interface-specification.md](../../../../../wecms-api/docs/features/addon-service/operation-status-inquiry/interface-specification.md).

---

## 1. Endpoints consumed

| Function ([lib/api/addon.ts](../../../../lib/api/addon.ts)) | Method + URL | Purpose |
|---|---|---|
| `fetchOperationStatus(params?)` | `GET /api/v1/addon/operation-status` | list (filter/sort/paginate) |
| `inquireOperationStatus(taxCode)` | `POST /api/v1/addon/operation-status/inquire` | Get Business Info (GDT lookup) |
| `createOperationStatus(body)` | `POST /api/v1/addon/operation-status` | Save looked-up row |
| `updateOperationStatus(taxCodes?)` | `POST /api/v1/addon/operation-status/update` | bulk re-poll |
| (via `useExcelExport`) | `POST /api/v1/addon/operation-status/export` | XLSX export |

## 2. Request params / bodies

```ts
// list — undefined/null/"" keys are stripped before the request
type FetchOperationStatusParams = {
    q?: string;                       // keyword (name OR tax code)
    companyStatus?: string;           // raw Vietnamese substring
    page?: number;                    // zero-based
    size?: number;                    // backend clamps to 100
    sortField?: string;               // View Setting FIELD_ID
    sortDirection?: "ASC" | "DESC";
};

// inquire
inquireOperationStatus(taxCode) → body { tax_code: taxCode }

// save
type CreateOperationStatusRequest = {
    tax_code: string; company_nm: string; company_status: string;
    office_add: string; search_datetime: string; representative_first_name: string;
};

// update — omit/empty re-polls whole tenant cache; non-empty targets a subset
updateOperationStatus(taxCodes?) → body (taxCodes?.length ? { tax_codes } : {})
```

## 3. Wire types ([lib/types/api.ts](../../../../lib/types/api.ts))

```ts
interface ApiOperationStatusRow {
    taxcode: string;
    company_nm: string;
    company_status: string;   // raw Vietnamese
    status_cd: string;        // canonical 3-state (server-derived)
    office_add: string;
    last_update: string;      // yyyyMMddHHmmss
}
interface ApiOperationStatusListResponse {
    rows: ApiOperationStatusRow[];
    total_count: number;
    page_number: number;      // zero-based
    page_size: number;        // post-clamp
    total_pages: number;
}

type InquireOperationStatusResponse = {
    tax_code; company_nm; company_status; status_cd;
    office_add; representative_first_name; search_datetime;
};
type UpdateOperationStatusResponse = { total_attempted; updated; failed };
```

## 4. Mapper ([lib/api/mappers.ts](../../../../lib/api/mappers.ts))

```ts
mapOperationCompanyRow(api): OperationCompanyRow = {
    id:          api.taxcode,                 // row key
    companyName: api.company_nm ?? "",
    taxCode:     api.taxcode ?? "",
    address:     api.office_add ?? "",
    status:      coerceOpStatus(api.status_cd),   // defensive → falls back to active_certificate_issued
    lastUpdate:  api.last_update ?? "",
};
```

The Inquire dialog reads the inquire response fields directly (snake_case, single-use) rather than through a mapper, stashing `company_status` + `representative_first_name` to re-send on Save.

## 5. State handling ([OperationStatusClient.tsx](../../../../components/addon/operation-status/OperationStatusClient.tsx))

- `useApiData(fetchOperationStatus(...), [refreshKey, sortField, sortDirection, debouncedKeyword, companyStatus, page, pageSize])` — refetch on any dep.
- **Latched `stableData`** — last non-null response retained so rows/count/pagination don't flicker on refetch; `useStickyLoading(loading && !stableData)` gates the first-load message only.
- **Keyword debounce** 300 ms (`debouncedKeyword` is the wire dep; `keyword` drives the input).
- **Selection** (`selectedIds: Set<string>` keyed by `taxcode`) — lifted to the client so Update can target the subset; persists across pages; cleared on full-batch Update success.
- **Mutation gates** — `updating` (+ sticky) disables Update/Inquire across the await; `exporting` (+ sticky) disables Print/Excel.

## 6. Validation

- **Tax ID** validated client-side `^\d{10}(-\d{3})?$` before Inquire (matches the backend regex); failure → `WBE_VALIDATION` system error dialog. Input is masked as the user types.
- **Save** enabled only when `hasResult && companyName.length > 0`.
- All other validation is server-authoritative; bad input returns a WBE code surfaced via the system dialog.

## 7. Error handling

- Page-level: non-401 errors surface once (deduped by code) via `useDialog({ type: "error", errorCode })`; `WBE_VALIDATION` suppressed at the page level; 401 handled by the global Axios session-expired interceptor.
- Dialog-level (Inquire/Save): each catch opens an error dialog with the `ApiCallError.code` (`WBE_OSMC_LOOKUP_FAILED`, `WBE_OSMC_NO_RESULT`, `WBE_OPERATION_STATUS_DUPLICATE`, etc.).
- Update: success → `operation.update.success` / `operation.update.partial`; failure → error dialog.

# Operation Status Inquiry — Screen Flow

Route `/addon/operation-status`. Page: [app/(dashboard)/addon/operation-status/page.tsx](../../../../app/%28dashboard%29/addon/operation-status/page.tsx) → [`<OperationStatusClient>`](../../../../components/addon/operation-status/OperationStatusClient.tsx) → [`<OperationStatusPage>`](../../../../components/addon/operation-status/OperationStatusPage.tsx). Auth + chrome inherited from the `(dashboard)` layout. Sidebar active state auto-resolves from `usePathname()` against `addonGroups`.

---

## 1. Load & list

1. `<OperationStatusClient>` owns server-side state: `keyword`/`debouncedKeyword` (300 ms), `companyStatus`, `page` (zero-based), `pageSize` (default 10), sort (`useTableSort`), `selectedIds`, `refreshKey`.
2. `useApiData(() => fetchOperationStatus({ q, companyStatus, ...sortParams, page, size }), [refreshKey, sortField, sortDirection, debouncedKeyword, companyStatus, page, pageSize])` fires on mount and on any dep change.
3. The latest non-null response is **latched** (`stableData`) so chrome (rows, total count, pagination) doesn't flicker between refetches; `useStickyLoading(loading && !stableData)` gates the first-load message only.
4. Rows pass through `mapOperationCompanyRow` (snake_case wire → camelCase `OperationCompanyRow`; `id = taxcode`).

## 2. Filter & search

- **Status dropdown** (`<FilterDropdown>` + inline `StatusFilterPopover`) — options All / Active / Suspended / Temporarily closed. Each option's `wireValue` is the raw Vietnamese substring (`null` / `đang hoạt động` / `ngừng` / `tạm`) sent as `companyStatus`; labels are localised. Selecting resets `page` to 0.
- **Keyword search** (`<SearchInput>`, right slot) — updates `keyword` immediately (no input lag), debounced 300 ms into `debouncedKeyword` for the wire `q`. Resets `page` to 0.

## 3. Sort

- `useTableSort()` cycles `default → ASC → DESC → default` per column. `<TableHeaderCell>` renders the glyph; columns are sortable when `col.sort_yn === "Y"` and not a special FIELD_ID.
- Sort happens **server-side** — `sortParams` is spread into the fetch; no client-side `Array.sort`.

## 4. Pagination

- Shared `<Pagination>` outside the scroll container (`paginationOnly` footer mode — no totals row). Display page is `page + 1`; selecting a page calls `onPageChange(p - 1)`. Page-size change resets `page` to 0.

## 5. Inquire Operation Status (dialog)

CTA opens [`<InquireOperationStatusDialog>`](../../../../components/addon/operation-status/InquireOperationStatusDialog.tsx):

```
[Enter Tax ID]  (masked input: digits only, hyphen after 10th, max 13 digits)
   │ click "Get Business Info"
   ▼
client-side validate ^\d{10}(-\d{3})?$  → invalid → system error dialog (WBE_VALIDATION)
   │ valid → inquireOperationStatus(taxCode)  → POST /operation-status/inquire
   ▼
success → fill read-only Customer Name + Address + status banner (colour by status_cd) + Last Update
          stash company_status + representative_first_name for Save
failure → clear fields, system error dialog (WBE_OSMC_LOOKUP_FAILED / WBE_OSMC_NO_RESULT)
   │ click "Save"  (enabled only when hasResult && companyName)
   ▼
createOperationStatus({ tax_code, company_nm, company_status, office_add, search_datetime, representative_first_name })
   → POST /operation-status
   ▼
success → success dialog → onSaved() (parent refreshKey++) → close + reset
duplicate → WBE_OPERATION_STATUS_DUPLICATE error dialog, popup stays open
```

The dialog uses `closeOnOutsideClick={false}` + `closeOnEscape={false}` so a layered system dialog's OK click can't bubble down and close it. Close discards all state.

## 6. Update (bulk re-poll)

- Toolbar "Update" → `handleRefresh`: targets = `selectedIds` if any, else `undefined` (whole tenant cache) → `updateOperationStatus(targets)` → `POST /operation-status/update`.
- On success: `refreshKey++` (refetch), clear selection on full success (keep on partial failure), and a success dialog: `operation.update.success` (all updated) or `operation.update.partial` (some failed) with `{updated, total, failed}`.
- No confirmation prompt; the button fires directly. A `updating` guard + `useStickyLoading` keep Update/Inquire disabled across the await window so a fast resolve can't double-fire.

## 7. Export & Print

- **Excel** → `handleExport` → `useExcelExport()` with `endpoint: /api/v1/addon/operation-status/export`, `screenId`, current `items` (View Setting), `columnConfig`, `filters: { q, companyStatus }`, and translated `sort` (`field`/`direction`). Filename `${operation.export_title}_${todayDmy()}`; in-sheet title `operation.title`.
- **Print** → `handlePrint` → shared `printReport` over the visible columns (minus checkbox) of the current in-memory rows.
- Both are gated by `exporting` + `useStickyLoading` so the chrome can't double-trigger.

## 8. Loading / empty / error

| State | Behaviour |
|---|---|
| First load | `loading && !stableData` → centered `common.loading` message in the table body (sticky-held ≥ 400 ms). |
| Empty result | centered `operation.empty` ("Operation Status Inquiry Not Found"). |
| Refetch (filter/sort/page) | previous rows stay visible via `stableData` — no flicker, no colSpan replacement. |
| Error | non-401 backend errors surface once (dedup by code) via `useDialog({ type: "error", errorCode })`; `WBE_VALIDATION` is suppressed; 401 handled by the global Axios interceptor. |

# Excel Export — API Consumption

**Part of:** Common → excel-export
**Last verified:** 2026-06-23

How the frontend builds and sends the export request, and how it consumes the
XLSX blob response. Citations to `wecms-web/`.

## 1. Per-page `columnConfig` → wire columns

The page declares `Record<FIELD_ID, { headerKey, format?, ccyCd?, align?, widthChars? }>`.
The hook resolves the **visible** column list at call time
(`hooks/useExcelExport.ts:100-122`):

```
visible = vs.items
  .filter(it => it.use_yn === "Y")              // only visible columns
  .filter(it => !isSpecialViewSettingField(it.field_id))  // drop CHECKBOX / ETC
  .filter(it => it.disp_yn !== "N")             // drop admin-hidden
  .filter(it => columnConfig[it.field_id])      // only registered FIELD_IDs
  .sort((a,b) => a.disp_ord - b.disp_ord)       // DISP_ORD order

columns = visible.map(it => ({
  fieldId:    it.field_id,
  header:     t(columnConfig[it.field_id].headerKey),  // resolved label
  format:     cfg.format ?? "text",
  ccyCd:      cfg.ccyCd,
  align:      cfg.align,
  widthChars: cfg.widthChars,
}))
```

So the wire ships **`vs.items ∩ columnConfig`** in current (possibly unsaved)
View Setting order. The backend re-intersects with the **persisted** visibility
as defence-in-depth — a hidden column can never leak even if the client sends it.

## 2. Request body (`lib/excel.ts:161-182`)

```jsonc
{
  "screenId":  "banking-account-inquiry-vnd",   // from SCREEN_IDS, not a literal
  "dymAreaId": "default",                        // opts.dymAreaId ?? "default"
  "fileName":  "Account Inquiry(VND)_02052026",  // filesystem form (date suffix)
  "title":     "Account Inquiry (VND)",          // on-screen title, or null
  "filters":   { "currency": "VND", "bankName": "...", "keyword": "..." },
  "sort":      { "field": "BALANCE", "direction": "DESC" },  // or null
  "columns":   [ { "fieldId": "...", "header": "...", "format": "amount",
                   "ccyCd": null, "align": null, "widthChars": null }, … ]
}
```

- **Filters + sort travel.** Filters are an opaque per-screen map; sort is
  emitted only when both `field` + `direction` are present, else `null`
  (`lib/excel.ts:168-171`). The provider re-runs the same filter+sort path the
  list endpoint uses.
- **title vs fileName are two strings.** `title` (on-screen, with spaces) →
  row 0; `fileName` (no inner space + `_DDMMYYYY`) → download filename. Never
  collapse them (CLAUDE.md §13b). `todayDmy()` produces the `DDMMYYYY` suffix
  (`lib/excel.ts:230-236`).
- **Amounts ship raw / formatted via `formatAmount`.** Amount data columns use
  `format: "amount"` and ship raw decimal — the backend applies `#,##0.##`. Any
  monetary string the page composes goes through `formatAmount` from
  `lib/currency.ts`; never a template literal (CLAUDE.md §13b forbidden list).

## 3. Transport & blob save (`lib/excel.ts:125-159`)

```
res = api.post<Blob>(endpoint, body, { responseType: "blob" })   // JWT auto-attached
```

- **JSON-error-on-200 sniff.** A `200` whose `Content-Type` includes
  `application/json` is a `BusinessException` envelope (e.g. `WBE2010` unknown
  screen, `WBE2011` >50k, `WBE2013` no columns) — the blob is read as text,
  parsed, and rethrown as `ApiCallError(status.code, status.message)`
  (`lib/excel.ts:147-152`, `maybeDecodeJsonError` :187-204).
- **Filename** parsed from `Content-Disposition` (RFC 5987 first, plain
  fallback), else `${fileName}.xlsx` (`lib/excel.ts:154-157, :209-220`).
- **Download** via object URL + `<a download>`, revoke deferred for Safari
  (`lib/excel.ts:238-250`).

## 4. Error handling (page side)

Pages wrap `await exportXlsx(...)` in try/catch and route non-401 `ApiCallError`
to `useDialog().open({ type: "error", errorCode: e.code, description })`. 401 is
handled by the global session-expired interceptor in `lib/axios.ts`
(`lib/excel.ts:119-121`). Network failures → `ApiCallError("NETWORK", …)`.

## 5. Endpoint binding

`endpoint` is passed by the page (e.g. `/api/v1/banking/accounts/export`) — the
hook does **not** derive the URL from `screenId`. Per-resource, never a generic
dispatcher (CLAUDE.md §13b).

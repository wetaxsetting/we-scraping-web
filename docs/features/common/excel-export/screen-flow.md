# Excel Export — Screen Flow

**Part of:** Common → excel-export
**Last verified:** 2026-06-23

## Flow

```
User clicks the toolbar Excel icon
   │  <PageActionButtons showExcel onExport={handleExportExcel} exporting={exporting} />
   ▼
Page handler (e.g. AccountInquiryPage#handleExportExcel)
   │  await exportXlsx({ endpoint, screenId, dymAreaId, fileName, title,
   │                     items: vs.items.length ? vs.items : FALLBACK_COLUMNS,
   │                     columnConfig, filters, sort, t })
   ▼
useExcelExport() returned fn                                   (hooks/useExcelExport.ts:98-135)
   1. visible = items.filter(use_yn==='Y')                     (:100-110)
                     .filter(!isSpecialViewSettingField)
                     .filter(disp_yn!=='N')
                     .filter(columnConfig[field_id] exists)
                     .sort(by disp_ord)
   2. columns = visible.map → { fieldId, header:t(headerKey),  (:112-122)
                  format, ccyCd, align, widthChars }
   3. exportExcel({ endpoint, screenId, dymAreaId, fileName,   (:124-133)
                    title, columns, filters, sort })
   ▼
exportExcel                                                    (lib/excel.ts:125-159)
   - buildRequestBody → JSON                                   (:161-182)
   - api.post<Blob>(endpoint, body, { responseType:'blob' })   (:129-131)
   - if 200 + Content-Type application/json → decode + throw   (:147-152)
   - else parse filename from Content-Disposition              (:154-157)
   - triggerDownload(blob, fileName)                           (:158, :238-250)
   ▼
Browser downloads the .xlsx
```

## Exporting state

While the request is in flight the page holds an `exporting` flag and passes it
to `<PageActionButtons exporting={exporting}>`:

- **Print + Excel** buttons become `disabled`, render `cursor-wait opacity-60`,
  and set `aria-busy` so a fast resolve cannot fire a duplicate download
  (`PageActionButtons.tsx:69-72, :94-129`).
- **List** stays interactive — it opens a local View Setting popover, not an API
  call (`PageActionButtons.tsx:36-37`).

## Error surfaces

| Condition | Handling | Source |
|---|---|---|
| HTTP 200 + JSON body (e.g. `WBE2010`/`WBE2011`/`WBE2013`) | blob read as text → `ApiCallError(code, message)` → page shows `useDialog({ type:"error" })` | `lib/excel.ts:142-152` |
| HTTP 401 | global session-expired interceptor in `lib/axios.ts` retries after re-auth | `lib/excel.ts:119-121` |
| Network failure | `ApiCallError("NETWORK", …)` | `lib/excel.ts:132-139` |

## Filename

The download filename comes from the server `Content-Disposition`
(RFC 5987 `filename*=UTF-8''…` preferred, plain `filename="…"` fallback), then
`${opts.fileName}.xlsx` as a last resort (`lib/excel.ts:154-157, :209-220`).

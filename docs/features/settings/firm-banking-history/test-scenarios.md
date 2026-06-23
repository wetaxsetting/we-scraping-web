# Firm Banking History — Test Scenarios (Frontend)

Parent: [README.md](README.md). Backend scenarios: [wecms-api .../test-scenarios.md](../../../../../wecms-api/docs/features/settings/firm-banking-history/test-scenarios.md).

---

## 1. Search / filter

| # | Scenario | Expected |
|---|---|---|
| F-1 | Open panel | default range = last 30 days; first page (size 10) loads |
| F-2 | Pick a custom range | refetch with new `from_date`/`to_date`; resets to page 0 |
| F-3 | Select service type F/S/G/B | wire `svc_type` sent; `all` omits the param |
| F-4 | Product type H | service-type dropdown hides GDT (`G`) + Vietnam Business (`B`) options |
| F-5 | Keyword type | 300 ms debounce, then one request with `keyword`; partial seq-no match |
| F-6 | No-result filter | localized empty-state row; pagination shows 0 |

## 2. Grid / sort / paginate

| # | Scenario | Expected |
|---|---|---|
| G-1 | Sort each sortable column | header cycles default → ASC → DESC → default; backend reorders (no client sort) |
| G-2 | Non-sortable columns | no glyph, no click |
| G-3 | Paginate | zero-based wire / one-based UI; latched data prevents flicker |
| G-4 | Status pill | success (green) for `00000000`/`0000`; failed (red) otherwise |
| G-5 | Long text cells | `<EllipsisTooltip>` shows full value on hover/focus |

## 3. Detail popover

| # | Scenario | Expected |
|---|---|---|
| D-1 | Open View Details | popover opens with NO extra HTTP call |
| D-2 | F-leg row | shows VAN code + inst code; message via `DICTIONARY_VAN` |
| D-3 | S-leg row | shows inst code; message via scraping registry |
| D-4 | G-leg row | shows e-Invoice No. parsed from `req_data`; message via scraping registry |
| D-5 | B-leg row | shows Tax ID parsed from `req_data.search` |
| D-6 | Service name | `t(serviceNameKey)` → raw `serviceName` → `job`; never blank |
| D-7 | Copy | copy-to-clipboard copies the full original value |
| D-8 | Close | ESC / outside-click / X dismiss; Settings modal stays open |

## 4. Export

> **Blocked — frontend export is not wired.** The panel renders no Excel toolbar button and does not
> import `useExcelExport`, so the scenarios below are not yet exercisable from the UI. They become
> live once the panel wires the export trigger (backend endpoint already exists).

| # | Scenario | Expected |
|---|---|---|
| E-1 | Export with data | `POST .../export`; XLSX downloads with server filename |
| E-2 | Export reflects filters | exported rows match current date/svc_type/keyword/sort |
| E-3 | No frontend workbook lib | export is backend-produced; browser only saves the blob |

## 5. Permissions

| # | Scenario | Expected |
|---|---|---|
| P-1 | Admin | panel visible + usable |
| P-2 | User with `settings-firm-banking-history` | panel visible |
| P-3 | User without the permission | nav item hidden |
| P-4 | Expired token | global session-expired dialog (401 interceptor) |

## 6. Error handling

| # | Scenario | Expected |
|---|---|---|
| ER-1 | Invalid input (shouldn't normally occur) | `WBE_VALIDATION` suppressed (no dialog) |
| ER-2 | Backend error | global error dialog with code + `trace_id`; de-duped |
| ER-3 | Empty result | empty-state row (not an error) |

## 7. i18n / typography / responsive

| # | Scenario | Expected |
|---|---|---|
| I-1 | EN / KO / VI | labels resolve; missing KO/VI keys fall back to EN (service-name to raw `svc_nm`) |
| I-2 | Tokens only | no raw `text-[*px]` / `font-[*]` / inline `fontFamily` |
| I-3 | Responsive | table scrolls horizontally on narrow laptops; panel inherits Settings modal sizing |

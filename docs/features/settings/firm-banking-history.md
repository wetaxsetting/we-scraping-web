# Firm Banking History

> Canonical Settings-menu entry for **Settings → Firm Banking → Firm Banking History** (frontend).
> Detailed implementation lives in the linked feature spec below.

## Overview
The Firm Banking History panel is a read-only, filterable log of firm-banking gateway transactions
(transfers, scraping module runs) with date/service/result filters, keyword search, sorting, and
pagination. Slug: `firm-banking-history`. **Frontend wired 2026-05-08.**

- Feature spec (full references): firm-banking-history.md _(wecms-api backend repo — not included in this clone)_
- API side: firm-banking-history.md _(wecms-api backend repo — not included in this clone)_

## Page Location
Settings modal panel (Firm Banking group) — `<FirmBankingHistoryPanel>`, mounted inside
`<SettingsModal>` via `<SettingsNav>` ("Firm Banking History"). **No standalone route** (Figma
9198:11718).

## UI Components
- `FirmBankingHistoryPanel` shell
- Filter bar (date range, service type, result, keyword)
- Result table + pagination
- Sortable column headers

## User Actions
- **Filter** by date range / service type / result / keyword.
- **Sort** by whitelisted columns (`TARN_DTM`, `SVC_TYPE`, `SVC_NM`, `SEQ_NO`, `DEP_BANK_CD`,
  `RSLT_CD`).
- **Paginate** results.

## Table Columns
| Column | Source |
|---|---|
| Transaction date/time | `TARN_DTM` (KR→VN time) |
| Service type / name | `SVC_TYPE` / `SVC_NM` |
| Bank | `DEP_BANK_CD` → NAPAS bank name |
| Result | `RSLT_CD` |
| Seq no | `SEQ_NO` |

## Dialogs / Popups
- None primary (read-only list). Confirm if a detail popup exists.

## API Integration
`GET /api/v1/settings/firm-banking-history` (snake_case `@RequestParam`). Response `{ list,
total_count, total_pages, page_number, page_size }`. snake_case wire ↔ camelCase mappers.

## Validation
- Required date params validated; missing → `WBE_VALIDATION` (inline message).
- `svc_type` constrained to known values.

## Notes
Read-only. Times are converted KR→VN via the backend `kr_to_vn_time` function; bank names resolved
via `wb_get_napas_bank_nm`.

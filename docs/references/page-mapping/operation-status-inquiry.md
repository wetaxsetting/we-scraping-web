# Operation Status Inquiry — JEX → Next.js Page Mapping

> **Consolidated feature docs:** see [../../features/addon-service/operation-status-inquiry/](../../features/addon-service/operation-status-inquiry/) (screen-flow · ui-specification · component-index · api-consumption · test-scenarios). This file remains the JEX → Next.js page-mapping reference.

**Slug:** `operation-status-inquiry` · **Route:** `/addon/operation-status` · **Refactor screen id:** `addon-operation-status`
**JEX counterpart:** `aosv_0001_001` (list) / `aosv_0001_002` (popup)

Frontend half of the migration mapping. Legacy source-of-truth analysis lives in
`docs/jex/features/operation-status-inquiry/` _(JEX tree)_; backend mapping in
`wecms-api/docs/migration/operation-status-inquiry.md` _(backend repo)_; full frontend page design
in `wecms-web/docs/features/addon-service/operation-status-inquiry.md`.

---

## 1. View → route

| JEX `_view.jsp` | JEX TS | Next.js route / component |
|---|---|---|
| `aosv_0001_001_view.jsp` (list) | `aosv_0001_001.ts` | `app/(dashboard)/addon/operation-status/page.tsx` → `<OperationStatusClient>` → `<OperationStatusPage>` |
| `aosv_0001_002_view.jsp` (popup) | `aosv_0001_002.ts` | `<InquireOperationStatusDialog>` (opened from the list action bar) |

> The JEX popup view lives under `pymn/` (legacy placement quirk); the refactor groups everything
> under `components/addon/operation-status/`.

---

## 2. Component map

| JEX element | Next.js |
|---|---|
| title-area + Excel/Print/Update/Add buttons (`view:93-103`) | `OperationStatusActionBar` (Print · Excel · Update · Inquire CTA) |
| status dropdown (`view:106-128`) | `StatusFilterPopover` (options All / "đang hoạt động" / "ngừng" / "tạm" — raw VN substrings) |
| keyword search (`view:129-137`) | `<SearchInput>` (debounced 300 ms → `q`) |
| grid `<thead>/<tbody>` (`view:141-169`) | `<OperationStatusPage>` table via `COLUMN_REGISTRY` (CHECKBOX · COMPANY · ADDRESS · OPERATION_STATUS · LAST_UPDATE) |
| status badge legend (`ts:58-72`) | `mapOperationCompanyRow` + `coerceOpStatus` (`lib/api/mappers.ts`) → 3-state `status_cd` |
| pagination 15/20/50/100 (`view:171-194`) | shared `<Pagination>` via `usePagination` (default 10; server-side `page`/`size`) |
| popup tax-ID mask + Inquire (`aosv_0001_002.ts:48-78`) | `InquireOperationStatusDialog` `formatTaxCodeInput` + "Get Business Info" |
| popup Save (`aosv_0001_002.ts:159-187`) | `InquireOperationStatusDialog.handleSave` — **persists via `createOperationStatus` → `POST /operation-status`**, then `onSaved?.()` refetch (2026-06-03) |

---

## 3. API-call map

| JEX AJAX | Next.js client (`lib/api/addon.ts`) | Endpoint |
|---|---|---|
| `aosv_0001_001_r001` | `fetchOperationStatus({ q, companyStatus, sort, page, size })` | `GET /api/v1/addon/operation-status` |
| `aosv_0001_001_u001` | `updateOperationStatus(taxCodes?)` | `POST /api/v1/addon/operation-status/update` |
| `aosv_0001_002_r001` | `inquireOperationStatus(taxCode)` | `POST /api/v1/addon/operation-status/inquire` |
| `aosv_0001_002_c001` | `createOperationStatus(body)` | `POST /api/v1/addon/operation-status` (2026-06-03) |
| (client-side Excel) | `useExcelExport()` | `POST /api/v1/addon/operation-status/export` |

Wire types: `lib/types/api.ts` (`ApiOperationStatusRow` = `taxcode, company_nm, company_status,
status_cd, office_add, last_update`; `ApiOperationStatusListResponse` = `rows, total_count,
page_number, page_size, total_pages`). Screen-id registry entry:
`SCREEN_IDS.ADDON_OPERATION_STATUS = "addon-operation-status"` (`lib/viewSettingScreens.ts`).

---

## 4. Field name translation (wire → in-memory)

| Wire (`snake_case`) | `OperationCompanyRow` (camelCase) |
|---|---|
| `taxcode` | `taxCode` |
| `company_nm` | `companyName` |
| `company_status` | (dropped after `status_cd` derivation) |
| `status_cd` | `status` (`active_certificate_issued` / `suspended` / `not_registered`) |
| `office_add` | `address` |
| `last_update` | `lastUpdate` |

---

## 5. Gaps / divergences (frontend)

- ~~**Save/persist**~~ **DONE 2026-06-03** — `InquireOperationStatusDialog.handleSave` now calls
  `createOperationStatus` → `POST /operation-status` (create-only; duplicate Tax IDs surface
  `WBE_OPERATION_STATUS_DUPLICATE` and keep the popup open), then `onSaved?.()` refetches the list.
- **`representative_first_name`** arrives on the inquire response; the dialog now stashes it and
  sends it on Save (required by `c001`) but still does not render it on screen (legacy parity).
- **Status default mismatch** — FE `coerceOpStatus` defaults unknown → `active_certificate_issued`
  whereas backend defaults → `not_registered`. Align FE to `not_registered`.
- **View Setting popover** intentionally not rendered (no list-view icon in Figma); hook still drives
  column visibility/order + export.

See the cross-cutting [test scenarios](../../../../docs/testing/operation-status-inquiry.md) for the
verification matrix.

# Operation Status Inquiry — Frontend Wiring Audit

> **Scope:** `wecms-web` only. **No source code was modified for this audit.**
> **Page:** `/addon/operation-status` (`http://localhost:3000/addon/operation-status`)
> **Backend counterpart:** `wecms-api` `OperationStatusController` (`/api/v1/addon/operation-status*`).
> **Date:** 2026-07-01.

## Result: **PASS**

The three UI actions map exactly to the three expected backend endpoints, the frontend never
contacts Coocon/GDT directly, and no legacy scraping identifiers (`TRCO_TRCO001_00003`, `BI09`,
`wecms.osmc`) exist in the frontend. Two **stale comments** were found (documentation only — no
behavioural impact); details in §Dead code / stale references.

---

## 1. Files inspected

| File | Role |
|---|---|
| [app/(dashboard)/addon/operation-status/page.tsx](../../app/(dashboard)/addon/operation-status/page.tsx) | Route entry (thin page → `<OperationStatusClient>`) |
| [components/addon/operation-status/OperationStatusClient.tsx](../../components/addon/operation-status/OperationStatusClient.tsx) | State owner: filter/page/sort/selection, Update handler, Inquire-open handler, data fetch |
| [components/addon/operation-status/OperationStatusPage.tsx](../../components/addon/operation-status/OperationStatusPage.tsx) | Presentational page (table + toolbar + pagination) |
| [components/addon/operation-status/OperationStatusActionBar.tsx](../../components/addon/operation-status/OperationStatusActionBar.tsx) | Toolbar: Print · Excel · **Update** · **Inquire Operation Status** buttons |
| [components/addon/operation-status/InquireOperationStatusDialog.tsx](../../components/addon/operation-status/InquireOperationStatusDialog.tsx) | Popup: **Get Business Info** (inquire) + **Save** (create) |
| [components/addon/operation-status/types.ts](../../components/addon/operation-status/types.ts) | Row/props types |
| [lib/api/addon.ts](../../lib/api/addon.ts) | **API client** — `inquireOperationStatus`, `createOperationStatus`, `updateOperationStatus`, `fetchOperationStatus` |
| [lib/api/mappers.ts](../../lib/api/mappers.ts) | `mapOperationCompanyRow` (wire → in-memory row) |
| [lib/axios.ts](../../lib/axios.ts) | Single Axios instance (JWT interceptor, `baseURL`) |

No React hooks are feature-specific to this screen beyond the shared `useApiData`, `useTableSort`,
`useStickyLoading`, and `useDialog` — all generic infrastructure.

---

## 2. UI → Backend flow

### Inquire ("Get Business Info" popup)
```
User clicks "Inquire Operation Status" (primary CTA)
  ↓  OperationStatusActionBar  onInquire
  ↓  OperationStatusPage       (passes through)
  ↓  OperationStatusClient     handleInquire → setInquireOpen(true)   [opens dialog only]
  ↓  InquireOperationStatusDialog
      User types Tax ID → clicks "Get Business Info"
  ↓  handleGetBusinessInfo   (regex-validates ^\d{10}(-\d{3})?$)
  ↓  inquireOperationStatus(taxCode)                     [lib/api/addon.ts:244]
  ↓  api.post("/api/v1/addon/operation-status/inquire", { tax_code })   [addon.ts:247]
  ↓  HTTP POST /api/v1/addon/operation-status/inquire
  ↓  OperationStatusController.inquire                   [wecms-api]
  ↓  OperationStatusService.inquire → OsmcGdtClient      [backend owns Coocon/GDT]
```

### Save (persist the inquired row)
```
Inside the popup, after a successful inquire → user clicks "Save"
  ↓  InquireOperationStatusDialog  handleSave           [dialog.tsx:193]
  ↓  createOperationStatus({ tax_code, company_nm, company_status, office_add,
                             search_datetime, representative_first_name })  [addon.ts:277]
  ↓  api.post("/api/v1/addon/operation-status", body)   [addon.ts:282]
  ↓  HTTP POST /api/v1/addon/operation-status
  ↓  OperationStatusController.create                    [wecms-api]
  ↓  OperationStatusService.create → OprtSttsInfoRepository (create-only)
```

### Toolbar Update / Re-poll
```
User clicks "Update"
  ↓  OperationStatusActionBar  onUpdate
  ↓  OperationStatusPage       (passes through as onRefresh)
  ↓  OperationStatusClient     handleRefresh            [OperationStatusClient.tsx]
        targets = selectedIds.size>0 ? [...selectedIds] : undefined
  ↓  updateOperationStatus(targets)                      [addon.ts:306]
  ↓  api.post("/api/v1/addon/operation-status/update", body)   [addon.ts:313]
        body = targets ? { tax_codes: targets } : {}
  ↓  HTTP POST /api/v1/addon/operation-status/update
  ↓  OperationStatusController.bulkUpdate                [wecms-api]
  ↓  OperationStatusService.bulkUpdate → OsmcGdtClient (re-poll) + upsert
  ↓  (client) setRefreshKey++  → fetchOperationStatus() re-runs → table re-renders
```

### List load (context — not one of the 3 audited actions)
```
Page mount / filter / sort / page change / refreshKey++
  ↓  fetchOperationStatus(params)                        [addon.ts:319]
  ↓  api.get("/api/v1/addon/operation-status", { params })   [addon.ts:335]
  ↓  HTTP GET /api/v1/addon/operation-status
  ↓  OperationStatusController.list
```

---

## 3. API mapping table

| UI Action | Component | Click handler | API client fn | HTTP method + endpoint | Backend controller | Backend service |
|---|---|---|---|---|---|---|
| **Inquire** (Get Business Info) | `InquireOperationStatusDialog` | `handleGetBusinessInfo` | `inquireOperationStatus` | **POST `/api/v1/addon/operation-status/inquire`** | `OperationStatusController.inquire` | `OperationStatusService.inquire` |
| **Save** | `InquireOperationStatusDialog` | `handleSave` | `createOperationStatus` | **POST `/api/v1/addon/operation-status`** | `OperationStatusController.create` | `OperationStatusService.create` |
| **Update** (toolbar) | `OperationStatusClient` (button in `OperationStatusActionBar`) | `handleRefresh` | `updateOperationStatus` | **POST `/api/v1/addon/operation-status/update`** | `OperationStatusController.bulkUpdate` | `OperationStatusService.bulkUpdate` |
| List load (context) | `OperationStatusClient` | `useApiData` | `fetchOperationStatus` | GET `/api/v1/addon/operation-status` | `OperationStatusController.list` | `OperationStatusService.list` |

---

## 4. Verification of the three action → endpoint bindings

- ✅ **Inquire button calls ONLY `POST /api/v1/addon/operation-status/inquire`.** `handleGetBusinessInfo` calls `inquireOperationStatus`, which posts to exactly that path ([addon.ts:247](../../lib/api/addon.ts)). No other endpoint is touched in that handler. (The top toolbar "Inquire Operation Status" CTA only *opens* the dialog — it fires no network call itself.)
- ✅ **Save button calls ONLY `POST /api/v1/addon/operation-status`.** `handleSave` → `createOperationStatus` → [addon.ts:282](../../lib/api/addon.ts).
- ✅ **Toolbar Update calls ONLY `POST /api/v1/addon/operation-status/update`.** `handleRefresh` → `updateOperationStatus` → [addon.ts:313](../../lib/api/addon.ts), followed by a client-side `setRefreshKey++` that re-fires the existing GET list. No other write endpoint is called.

---

## 5. Direct-integration confirmation

- ✅ **Frontend never calls Coocon directly.**
- ✅ **Frontend never calls GDT directly.**
- ✅ **Frontend only communicates with the Spring backend.** Every operation-status call goes through the shared `api` Axios instance ([lib/axios.ts](../../lib/axios.ts)), whose `baseURL` is `process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"` — a single Spring origin. No absolute external host, no `:8443`, no `dev2.coocon.co.kr`, no `webcashvietnam.com`, no `masothue`, no gov/tax URL appears anywhere in the frontend source.
- ✅ **`OsmcGdtClient` (backend) is the only component that calls Coocon/GDT.** Confirmed on the API side; the frontend has no OSMC/GDT client of any kind.

> **Note (out of scope, no action):** the strings "Coocon"/"OSMC"/"NXiSAS" appear elsewhere in `wecms-web`, but **only** in (a) comments, and (b) *different* features — Banking Own-Account Transfer, Card Transactions, and e-Invoice scrape use a **client-side local NXiSAS browser engine** for *bank/card* scraping. That is a separate subsystem and is **not** part of the Operation Status Inquiry data path. The Operation Status feature folder + its API client contain zero Coocon/GDT/NXiSAS runtime calls.

---

## 6. Required string searches

| # | Search | Result | Evidence |
|---|---|---|---|
| 5 | `TRCO_TRCO001_00003` | **ZERO references** ✅ | `grep -rn` over `app components lib hooks locales` → no match |
| 6 | `BI09` | **ZERO references** ✅ | No BI09 knowledge in the frontend — the service id lives only on the backend (`OsmcGdtClient.DEFAULT_API_ID`) |
| 7 | `wecms.osmc` | **ZERO config access** ✅ | The frontend never reads backend OSMC configuration. (Substring `osmc`/`OSMC` appears only in descriptive comments and unrelated legacy `*_osmc.jsp` / `_isOsmc` citations — never a `process.env`/config read of `wecms.osmc.*`.) |

Additional confirmatory searches (all clean in the frontend): `masothue`, `dev2.coocon`, `:8443`, `webcashvietnam.com`, `sgw.`, and the leaked DEV key `r2L7U6KnB4T51VokPlkg` → **all ZERO**.

---

## 7. Update behavior verification (requirement 8)

- ✅ **The Update button simply calls the backend endpoint and performs NO client-side manipulation of `OPRT_STTS_INFO`.**
  `handleRefresh` does exactly three things: (1) `await updateOperationStatus(targets)` (the POST), (2) `setRefreshKey((k) => k + 1)` to re-fetch the authoritative list, (3) clear the selection set on full-batch success + show a success/partial toast. There is **no** `rows.map/filter/splice`, no optimistic mutation of the row array, no local status rewrite. The refreshed data comes entirely from the backend re-fetch (`fetchOperationStatus`). The status source of truth stays server-side.

---

## 8. Dead code / stale references (documentation only — NOT modified)

These are **comment inaccuracies**, not wrong endpoints or dead code paths. No runtime impact; listed for a future cleanup pass (out of scope for this no-modification audit):

| Location | Issue |
|---|---|
| [OperationStatusActionBar.tsx](../../components/addon/operation-status/OperationStatusActionBar.tsx) (Javadoc on `updating`/`onUpdate`) | Comment references `POST /api/v1/addon/operation-status/refresh` — the real endpoint is `/update`. Stale name in a **comment only**; the actual call ([addon.ts:313](../../lib/api/addon.ts)) uses `/update`. |
| [OperationStatusClient.tsx](../../components/addon/operation-status/OperationStatusClient.tsx) (class Javadoc, ~line 39) | Comment says *"Inquire CTA → no-op for now (the GDT bridge is intentionally not wired — the button stays inert…)"*. **Stale:** the Inquire CTA opens `InquireOperationStatusDialog`, which calls the live `/inquire` endpoint. The button is fully wired, not inert. |

---

## 9. Mismatches

**None** between the audited UI actions and their expected endpoints. All three bindings are exact and 1:1.

---

## Summary

- **Frontend audit: PASS.**
- Inquire → `POST …/operation-status/inquire`; Save → `POST …/operation-status`; Update → `POST …/operation-status/update` — each exclusive, verified.
- No direct Coocon/GDT calls; single Spring `baseURL`; backend `OsmcGdtClient` is the sole Coocon/GDT caller.
- `TRCO_TRCO001_00003`, `BI09`, `wecms.osmc` → zero frontend references.
- Update performs no client-side `OPRT_STTS_INFO` manipulation.
- Two stale comments noted (no behavioural impact); **no source code modified**.

# WeInvoice — API Integration (frontend)

**Date:** 2026-11-03
**Type:** FEATURE
**Status:** PARTIAL
**Repository:** we-scraping-web
**Issue:** "API và dữ liệu WeInvoice" (The Lai, 2026-11-02) — handed over by the user in chat

**Investigation Status:** COMPLETE
**Approval Status:** NOT REQUIRED (class C — "kết nối api cho tôi")
**Implementation Status:** COMPLETE for the frontend — every P1 endpoint aligned with the PUBLISHED backend contract (`8823f7f`, 2026-11-05); real-API run BLOCKED on backend configuration
**Test Status:** PASS (executed checks) — see Test Evidence

## Purpose

Replace the mock data layer (`lib/api/weinvoice/*`, see
[weinvoice-p1-ui-transformation-2026-11-03.md](weinvoice-p1-ui-transformation-2026-11-03.md)) with
calls to the WeInvoice backend described in the user-supplied note *"API và dữ liệu WeInvoice"*
(file outside this repo: `~/Downloads/API và dữ liệu WeInvoice.md`).

## Requirement

Wire the WeInvoice screens to `/api/v1/weinvoice/*` of `we-scraping-api` (Spring Boot), following the
note's API table and conventions: envelope `{ status: { error, code, message }, data }`, snake_case on
the wire, `page` (0-based) + `size`, `sort_field` + `sort_direction`, tenant from JWT, working MST
sent as `company_mst`, engine jobs return `request_id` polled through `GET /requests/{request_id}`,
login through the existing `POST /api/v1/auth/login`.

## Current System Behavior

All 25 screens read / write an in-memory mock store. No HTTP client exists (`lib/axios.ts` was
removed with the WeCMS code). Login is a local mock.

## Target Behavior

Screens that have a P1 endpoint call the backend; screens whose endpoints are P2+ or "chưa chốt
nguồn" in the note keep the mock until the backend exists.

## Scope

This pass: authentication (`/api/v1/auth/login`, `/me`, `/logout`) + the shared HTTP transport.
Data endpoints (`/api/v1/weinvoice/*`, 40 per the note): **blocked** until the interface
specification is available (user decision).

## Out of Scope

Backend changes (separate repository); the engine worker (`weinvoice.winv_engn_rqst`); DBA scripts;
Partner API for WeCMS (machine-to-machine, not called by this frontend).

## Initial Evidence

- The note states the backend P1 (40 endpoints + 2 Partner endpoints, 84 unit tests) exists in
  `we-invoice/we-scraping-api`, module `domain/weinvoice`, **not committed**, with the detailed
  contract in that repo at `docs/features/addon-service/weinvoice/interface-specification.md`.
- Local checkout `../we-scraping-api` (branch `wecms-ui-fixes`, = `origin/main`) has **no**
  `domain/weinvoice`. No remote branch contains it (checked `git ls-remote` + `sit_scraping_data`
  on 2026-11-03).
- The note's own "Còn thiếu để chạy được": 3 DBA scripts not run; no engine worker → every
  engine job stays `queued`.

## Investigation Plan

1. Map every note endpoint to the screen / mock function it replaces.
2. Identify what the note does NOT define (response field names, error codes, enum values).
3. Decide with the user how to proceed without the interface specification.

### Decisions (user, 2026-11-03)

| Question | Decision |
|---|---|
| Wire data endpoints without the interface specification? | **No — wait for the real contract** (`interface-specification.md` or the pushed backend branch). Data stays on the mock layer until then. |
| Real login via `POST /api/v1/auth/login`? | **Yes — wire it now.** The endpoint already exists in the WeCMS-derived backend on `main`. |

### Findings

- The note defines paths, query params and conventions, **not** response field names, error codes
  or enum values → mapping data endpoints now would be guesswork (decision above).
- 2026-11-03 later: the user pointed to `we-scraping-api/docs/features/addon-service/weinvoice/weinvoice-api-and-data-2026-11-02.md`
  (backend branch `sit`, commit `6aa0c1f`). It is the **same note** (table formatting only differs);
  the backend repo still has **no** `domain/weinvoice` code and no `interface-specification.md`.
  The data-wiring decision stands: wait for the real contract.
- **Login contract — verified against backend source** (`domain/auth/controller/AuthController.java`,
  `dto/LoginRequest`, `LoginResponse`, `MeResponse`, on `sit`):
  - `POST /api/v1/auth/login` body `{ user_id, user_pw, biz_key? }`; `Accept-Language` picks the
    message language; per-IP rate limit 10/min (`WBE_TOO_MANY_REQUESTS`).
  - Response `data` is either **authenticated** (`access_token`, `token_type`, `expires_in`,
    `user_id`, `user_nm`, `biz_key`, `lang_cd`, `cmpn_nm`, `auth_gr_cd`, `prdt_type`, `tax_id`) or
    **chooser** (`user_id`, `user_nm`, `companies_available[]` of `{ biz_key, cmpn_nm, auth_gr_cd,
    prdt_type }`) — the user then re-posts with `biz_key`.
  - `GET /api/v1/auth/me` → `user_id, user_nm, biz_key, lang_cd, cmpn_nm, auth_gr_cd, prdt_type,
    tax_id, all_menus, allowed_menu_cds`. `POST /api/v1/auth/logout` revokes the token (no-op if
    already invalid).
  - Envelope `ApiResponse` = `{ status: { error, code, message }, data, timestamp?, path?, trace_id? }`.
  - CORS origins come from `WECMS_CORS_ALLOWED_ORIGINS` — must include `http://localhost:3000` locally.
- The WeCMS client code for this contract (`lib/axios.ts`, `lib/auth/client.ts`) is in git `HEAD`
  and is reused, trimmed to what WeInvoice needs.

### Dashboard request (user, 2026-11-04)

Request: *"gắn api cho giao diện dashboard đi"* — wire the Dashboard screen to the API.

Check on 2026-11-04 (orientation, before any code):
- `../we-scraping-api` on `sit` = `origin/sit` = `6aa0c1f` (docs only). `git fetch` + every remote
  branch searched: **no `domain/weinvoice` code anywhere**.
- `GET http://localhost:8080/api/v1/weinvoice/dashboard` on the running local backend → **404**.
- The note describes the endpoint only in prose: `GET /dashboard?company_mst=&year=` returning
  4 KPIs (cancelled + replaced excluded, amounts converted to VND), 12 months sales / purchase,
  data status (coded-but-no-XML, no-code-without-XML, no PDF, incomplete months got/total), last
  sync, and — per "Đã triển khai" — the top partners. **No field names, types or error codes.**

**Decision (user, 2026-11-04):** *"api theo file md này"* — wire the Dashboard against the note's
description now. Because the note gives no field names, the frontend defines a **draft wire
contract** (below, `### Dashboard — draft contract`) for the backend team to confirm, and the call is
behind a switch so the screen keeps working on mock data until the endpoint exists.

### Dashboard — draft contract (frontend proposal, 2026-11-04, NOT confirmed by backend)

Derived from the note's prose for `GET /dashboard` (§"03 Tổng quan") + "Top đối tác nằm trong
`GET /dashboard`", the conventions section (snake_case, envelope, tenant from JWT, `company_mst` per
request), and exactly the numbers the Dashboard screen renders. Backend team: confirm or rename —
only `lib/types/api.ts` + the mapper in `lib/api/weinvoice/dashboard.ts` change.

`GET /api/v1/weinvoice/dashboard?company_mst=0109876543&year=2026` → `ApiResponse<DashboardResponseRec>`:

```json
{
  "company_mst": "0109876543",
  "year": 2026,
  "kpis": {
    "invoice_count": 245, "sales_count": 65, "purchase_count": 180,
    "sales_total_vnd": 6200000000, "purchase_total_vnd": 2000000000,
    "output_vat_vnd": 539000000, "input_vat_vnd": 177000000
  },
  "months": [ { "month": 1, "sales_total_vnd": 0, "purchase_total_vnd": 0 } ],
  "data_status": {
    "coded_missing_xml": 4, "no_code_missing_xml": 0, "missing_pdf": 76,
    "incomplete_months": [ { "month": "2026-10", "got": 18, "total": 26 } ]
  },
  "last_synced_at": "2026-10-30T08:15:00",
  "last_sync_run": { "started_at": "2026-10-30T08:14:02", "new_count": 18 },
  "top_partners": [ { "tax_id": "0106111222", "name": "…", "total_vnd": 120000000, "invoice_count": 12 } ]
}
```

Rules the frontend assumes (from the note): KPIs and months exclude cancelled + replaced invoices;
all amounts already converted to VND; `months` has 12 entries (month 1–12); `top_partners` = top 5
purchase partners by total; `last_synced_at` / `last_sync_run` may be `null`.

### All endpoints request (user, 2026-11-05)

Request: *"gắn endpoint theo file md này đi"* — wire every endpoint of the note (pasted in chat).
Backend state unchanged: no `domain/weinvoice` in any branch; every `/api/v1/weinvoice/*` call
returns 404 on the local backend. Same approach as the Dashboard: **draft contract + switch**.

**Design (decided 2026-11-05):**

1. **Store = client cache in API mode.** Screens read state synchronously through `useStore`
   (10 readers of `invoices`, 15 of `activeTaxId`, …). In `api` mode the store starts **empty** (no
   mock seed) and is **hydrated from the API** after login (`/companies`, `/invoices` for the working
   MST + year, `/tags`, `/sync-runs`, `/email/messages`, `/mailboxes`, `/sub-accounts`). Every
   mutation calls its endpoint first, then updates the store from the response. Screens keep their
   call sites.
2. **Working MST** = the logged-in company's `tax_id` (from `/me`) unless `/companies` returns a
   different default — fixes the 2026-11-05 finding (mock MST sent to the real backend).
3. **Draft wire rule** — the note names paths, query params and a few fields only. Where it is
   silent, **wire field names = snake_case of the UI types in `lib/weinvoice/types.ts`** (that file
   already states "camelCase here → snake_case on the wire, WeCMS convention"). Fields the note does
   name (`rows`, `total_count`, `kpis`, `incomplete_periods`, `queued`, `skipped_no_code`, `quota`,
   `request_id`, `step`, `listed`, `xml_done`, `xml_total`, `outcome`, `upload_id`, …) are used as
   written.
4. **Engine jobs** (`Engine = Có` rows): `POST` returns `request_id` / run ids; the frontend polls
   `GET /requests/{request_id}` (or `GET /sync-runs/{run_id}` for sync progress).
5. **Files**: Excel (`POST /invoices/export/excel`) and ZIP (`POST /invoices/export/zip` — returns the
   ZIP directly, per "Đã triển khai") are downloaded from the backend in API mode; this lifts the
   "Excel not available" stub for API mode (CLAUDE.md §13b: the backend owns XLSX).
6. **Out of this pass** — rows the note marks P3–P6 (checks, supplier risk, taxpayer lookup, journal,
   tax portal), `/search`, `/notifications`, `/me/preferences`, Outlook OAuth, `/test-data/load`:
   stay on the mock; Partner API is backend-to-backend and never called by this frontend.

### All endpoints — draft contract summary (frontend proposal, 2026-11-05, NOT confirmed by backend)

Every call below is implemented in `lib/api/weinvoice/*` and used when
`NEXT_PUBLIC_WEINVOICE_DATA_SOURCE=api`. Paths are relative to `/api/v1/weinvoice`. Fields the note
does not name are marked `// DRAFT` in the code and listed here so the backend team can confirm or
rename them (only the module + its `*.api.test.ts` change).

| Area | Calls | Draft fields / assumptions beyond the note |
|---|---|---|
| Shell | `GET /requests/{id}` (`http.waitForRequest`) | `{ request_id, status: queued\|running\|done\|failed\|cancelled, step, result, error{code,message} }` |
| Dashboard | `GET /dashboard` | see § "Dashboard — draft contract" |
| Companies (06) | `GET/POST /companies`, `PATCH/DELETE /companies/{mst}`, `PUT /companies/{mst}/password` | list as `items`/`rows`/array; row `company_mst` (or `tax_id`), `company_name`, `label`, `gdt_username`, `status`, `last_sync_at`, `created_at`; `quota {used,max}`; **`gdt_username` = MST** (the form has no username field — open PO decision); engine error codes mapped by substring (`invalid_tax_id`, `exist`, `quota`, else wrong password) |
| Sync (10) | `POST /sync-runs`, `GET /sync-runs/{run_id}`, `POST …/cancel`, `GET /sync-runs` | POST returns `run_ids` (or `ids`); progress `step, month, batch, listed, xml_done, xml_total, status`; history rows = snake_case of `SyncRun` + `company_mst`, `reason`; bulk = one POST per MST (per-row progress) |
| Invoices (04) | `GET /invoices` (both directions, `page` 0 + `size` 500 until `total_count`), `POST /invoices/fetch-missing-xml`, `POST /invoices/export/excel`, `POST /invoices/export/zip`, `PUT /invoices/tags` | rows = snake_case of `Invoice`; `incomplete_periods[] {month, fetched, total}`; `company_mst` added to the Excel / ZIP bodies; list filters / KPIs computed client-side over the loaded year (screens are synchronous) |
| Invoice detail (05) | `GET /invoices/{id}`, `GET/POST /invoices/{id}/files`, `GET/DELETE /invoices/{id}/files/{file_id}`, `POST /invoices/{id}/original-pdf`, `PUT /invoices/{id}/lookup-code` | files `{id, kind, name, size, origin, added_at, url?, deletable}`; add-file response `{result: ok\|needs_confirm, reason: already_exists\|number_not_found\|xml_mismatch, file}`; one `confirm` value per call; engine step names containing "download"/"pdf" = download step |
| Email (07) | `GET /email/messages`, `GET /email/address` | rows = snake_case of `EmailMessage`; address `{ address }` |
| Mailboxes (08) | `GET /mailboxes`, `POST /mailboxes/gmail`, `GET /mailboxes/outlook/authorize`, `POST /mailboxes/{id}/scan`, `DELETE /mailboxes/{id}` | rows `tax_id, provider, address, method, connected_at, last_scan_at, invoice_count`; `company_mst` in the Gmail body; authorize `?company_mst` → `{ url }`; scan result `{ found }` |
| Uploads (09, 15) | `POST /uploads` (one multipart per batch, ZIPs sent as-is), `GET /uploads/{id}` (polled), `POST /uploads/{id}/adopt`, `DELETE /uploads/{id}` | `{ upload_id, status?, files[{ file_name, outcome, error, error_message, invoice{id,direction,template_no,symbol,number}, partner, total, buyer{tax_id,name}, pdf_status, pdf_url, pdf_error }] }`; the XML viewer's "add" sends one XML through the same endpoint |
| Tags / sub-accounts / providers (16, 18) | `GET/POST /tags`, `PATCH/DELETE /tags/{id}`; `GET/POST /sub-accounts`, `PUT /sub-accounts/{id}`, `PATCH …/status`, `POST …/invite`, `DELETE …`; `GET /providers?keyword&link_status` | lists as array or `{rows}`; tag `invoice_count`; sub-account = snake_case of `SubAccount`; provider rows = snake_case of `Provider` + `invoice_count`, `link_status` values `lookup\|captcha\|nolink\|verify` |

Still mock in API mode (out of this pass, per the note's phases): checks, supplier risk, taxpayer
lookup, journal, tax portal (P3–P6), `/search`, `/notifications`, `/me/preferences`, Outlook OAuth
callback, `/test-data/load`.

### Backend contract published (2026-11-05, user pulled the code)

Request: *"test lại thử, mình mới pull code về"*. `../we-scraping-api` (`sit`) now has commit
`8823f7f feat(weinvoice): P1 API (40 app + 2 partner endpoints), DB scripts, docs`:
`domain/weinvoice/**`, `src/main/resources/db/weinvoice/V1__winv_schema.sql`, and
`docs/features/addon-service/weinvoice/interface-specification.md` (backend repo). The running
backend process predates the commit (started 2026-11-04) → must be restarted to serve it.

Plan: reconcile every `// DRAFT` field with the published specification (findings below), then test
against a restarted backend.

**Findings (2026-11-05):**

- *Runtime blocker* — the backend's `.env` / `.env.local` define **none** of the 14
  `WECMS_WEINVOICE_*` keys `application.yml` requires (engine DB URL / user / password, engine + app
  schema, output dir, storage root, secret key, partner keys, enabled flag), and
  `db/weinvoice/V1__winv_schema.sql` must be applied by a DBA on the engine database. A restart
  alone cannot serve WeInvoice. These are credentials / shared-DB actions the frontend does not
  perform (§12g). → real-API test **BLOCKED** until the backend owner configures them.
- *Contract deltas vs the frontend draft* (published spec wins):

| Area | Draft (FE) | Published | Action |
|---|---|---|---|
| Shell | `/me` profile from `/api/v1/auth/me` only | **`GET /api/v1/weinvoice/me`** → `companies[CompanyItem], working_company_mst, max_companies, …` | hydrate from it |
| Requests | status queued/running/done/failed/cancelled | + **`partial`**; fields `type, company_mst, progress{}, result{}, error, cancel_requested, …` | treat `partial` as finished |
| Dashboard | `kpis{invoice_count, sales_total_vnd…}`, `top_partners`, `last_sync_run` | `kpis{count, sales_count, purchase_count, sales_total, purchase_total, out_vat, in_vat, vat_payable}`, `months[12]{month, sales, purchase, …}`, `data_status{missing_xml, no_code_no_xml, missing_pdf, incomplete_periods[]}`, `top_suppliers[{tax_id,name,count,total}]`, `last_sync{finished_at,status}` | remap |
| Invoices list | rows = full `Invoice` with `files[]`, `size` 500 | `InvoiceRow` (`has_xml, has_pdf, kind, partner_*, total_vnd, exchange_rate, needs_lookup_code, tag_ids`), **no items / files**; `size` max **200**; `incomplete_periods{month, got, total}` | map row → Invoice with synthetic xml/pdf file markers; page size 200 |
| Detail | — | `InvoiceDetail` (`seller{…}, buyer{…}, items[…vat_rate…], lookup{code, company_code, url, direct, manual, needs_code}, files[], related{…}, xml_task, pdf_task`) | map |
| Files | `{result, reason}` | `{status: ok·needs_confirm·duplicate, reasons[pdf_not_matched·pdf_exists·xml_key_mismatch], file, request_id}`; `confirm` repeatable | remap |
| Lookup code / fetch-missing-xml / export | — | lookup returns `{request_id}`; fetch-missing-xml body `{company_mst, ids}` → `{queued, skipped_no_code, skipped_other, request_id}`; Excel body = the `/invoices` filter (+ `ids`) | align |
| Companies | list `items/rows`, row `company_mst` | `{companies[CompanyItem], quota}`; `CompanyItem{tax_id, company_name, username, label, status (pending·connected·error·expired·need_password), status_message, has_password, default_company, last_sync_at, created_at}`; `gdt_username` optional | remap; errors `WBE3001/3003/3004` |
| Sync | POST → `run_ids` | POST → `[{request_id:"R<n>", subject}]`; `GET /sync-runs/{run_id}` → `{run_id, tax_id, status, step, month, listed, xml_done, xml_total, error, run}`; history page `{rows}` of `{id, request_id, tax_id, company_name, …, message, trigger}` | remap |
| Email | rows = `EmailMessage` | page `{rows}` of `{id, received_at, from, subject, attachments[], result (matched·duplicate·unmatched·no_invoice·error), engine_status, invoice_ref}`; address `{company_mst, address, configured}` | remap |
| Uploads | field `files[]`; file `{file_name, error, invoice{…}}` | multipart field **`files`**; file `{file_no, name, size, outcome, message, invoice_id, seller_tax_id, buyer_tax_id, partner_name, total, pdf_status, processed_at}` | remap |
| Providers | `link_status` lookup·captcha·nolink·verify | `ok · check · missing`; fields `stt, tax_id, name, full_name, web, lookup_url, captcha_url, alt_lookup_urls[], verify, link_status, invoice_count, auto_pdf` | remap |
| Mailboxes, sub-accounts | wired (P2) | **not in the published P1 API** | do not call in hydration; screens show empty + note |


## Root Cause

Not applicable (feature).

## Proposed Implementation

Restore a trimmed transport + typed wire layer from the WeCMS client in git `HEAD`, and replace the
mock `lib/weinvoice/auth.ts` with real calls; keep every screen's call sites unchanged.

## API Impact

Consumes `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout` (existing
backend endpoints, unchanged). No backend change.

## UI Impact

- Login: real credentials; inline backend message + code on failure; network failure message;
  company chooser for multi-company users; demo hint removed.
- Header / Settings: profile shows company name (+ MST) instead of the mock e-mail / login time;
  logout revokes the token server-side.
- App load: `AppShell` rehydrates the profile from `/me`; a rejected token goes back to `/login`.

## Integration Impact

Backend must allow `http://localhost:3000` in `WECMS_CORS_ALLOWED_ORIGINS` (verified: it does on the
local `sit` backend). `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8080`).

## Testing Plan

Unit tests for the auth client against the verified wire shapes; probe the running backend with
curl (envelope, CORS); drive the login page in the browser with an invalid account.

## Implementation

| File | Change |
|---|---|
| [lib/axios.ts](../../../lib/axios.ts) | New shared transport: Bearer token, `Accept-Language` (`vi`/`en`/`ko`, matching `AuthController.resolveLangCd`), 401 on non-auth endpoints → clear session + `/login?next=…` |
| [lib/types/api.ts](../../../lib/types/api.ts) | Wire types: `ApiResponse`, `LoginRequestRec`, `LoginResponseRec`, `CompanyOptionRec`, `MeResponseRec` |
| [lib/weinvoice/auth.ts](../../../lib/weinvoice/auth.ts) | Real `login` (two-step chooser), `fetchMe`, `logout`; `AuthError` (`WBExxxx` / `WBE_NETWORK` / `WBE_CLIENT_PARSE`); `session` reads `tokenStorage` + `userStorage` |
| [app/(auth)/login/page.tsx](../../../app/(auth)/login/page.tsx) | Calls the API; chooser card; error text = backend message + code |
| [components/layout/AppShell.tsx](../../../components/layout/AppShell.tsx) | `fetchMe()` once per load; rejected token → `/login` (network errors keep the cached profile) |
| `components/layout/{Header,CommandPalette}.tsx`, `components/settings/SettingsPage.tsx` | Logout via `logout()`; profile fields from the real session |
| `locales/*.json` | + `login.choose_company`, `login.back`, `login.network_error`, `set.company`; − `login.demo_hint`, `login.invalid` |
| [vitest.setup.ts](../../../vitest.setup.ts) | In-memory `localStorage` when Node's global shadows jsdom's (Node ≥ 22 without `--localstorage-file`) |
| [lib/weinvoice/auth.test.ts](../../../lib/weinvoice/auth.test.ts) | 6 tests on the auth client |
| `.env.example` | Only `NEXT_PUBLIC_API_BASE_URL` (+ CORS note); stale NXiSAS variable removed; + `NEXT_PUBLIC_WEINVOICE_DATA_SOURCE` (2026-11-04) |
| **2026-11-04 — Dashboard** | |
| [lib/api/weinvoice/source.ts](../../../lib/api/weinvoice/source.ts) | `DATA_SOURCE` switch from `NEXT_PUBLIC_WEINVOICE_DATA_SOURCE` (`api` / default `mock`) |
| [lib/api/weinvoice/dashboard.ts](../../../lib/api/weinvoice/dashboard.ts) | `getDashboard(companyMst, year)`: API path (`GET /api/v1/weinvoice/dashboard`, `DashboardError` with backend code / `HTTP_<n>` / `WBE_NETWORK`) or mock path (`computeFromStore`, the screen's previous in-component logic); `toDashboardSummary` mapper |
| `lib/types/api.ts` | + `DashboardResponseRec` (DRAFT) |
| [components/dashboard/Dashboard.tsx](../../../components/dashboard/Dashboard.tsx) | Reads `getDashboard()` instead of computing from the store; loading spinner, error card with code + Retry, stale data dimmed while reloading; mock mode re-reads on store changes |
| `locales/*.json` | + `dash.load_error`, `common.retry` |
| Tests | + `lib/api/weinvoice/dashboard.test.ts` (7), `components/dashboard/Dashboard.test.tsx` (2) |
| **2026-11-05 — all endpoints** | |
| `lib/api/weinvoice/{http,wire,remote}.ts` | New: WeInvoice HTTP helpers (envelope, coded errors, `waitForRequest`, `wiUpload`, `wiDownload`), snake↔camel key conversion, API-mode hydration (`hydrate`, `reloadForTaxId`, `refreshAfterSync`, `useHydration`) |
| `lib/api/weinvoice/store.ts` | API mode starts from `emptyState()` — no mock seed |
| `lib/api/weinvoice/{invoices,original,sync,mailbox,tags,subaccounts}.ts`, `lib/weinvoice/exporter.ts`, new `uploads.ts`, `providers.ts` | API branches for every endpoint in the table above; mock branches unchanged |
| `components/layout/AppShell.tsx` | Hydrates after `/me`; loading strip + error banner (endpoint, message, code, Retry); reloads MST-scoped data when the working MST changes |
| Screens | invoices (list, detail modal, download dialog, tag menu), connections, sync dialog + bulk page, upload, email, mailbox connect, tags, sub-accounts, providers, XML viewer, dashboard (no request without a working MST) — error toasts, no faked success, no fake captcha in API mode |
| `locales/*.json` | + `api.loading`, `api.load_failed` |
| Tests | + `http.test.ts` (6), `invoices.api.test.ts` (13), `original-exporter.api.test.ts` (8), `sync.api.test.ts` (14), `mailbox.api.test.ts` (11), `tags.api.test.ts` (6), `subaccounts.api.test.ts` (6), `uploads.api.test.ts` (6), `providers.api.test.ts` (2), `Dashboard.test.tsx` (+1) |
| Docs | `CLAUDE.md` Auth / Purpose / Run, `README.md`, module README, test-scenarios, skill fact list |

## Files Changed

See the table above.

## Verification

### Automated Tests

- Test: `npx vitest run` — PASS, 4 files / 24 tests (6 new in `lib/weinvoice/auth.test.ts`)
- Test: `npx tsc --noEmit` — PASS · `npm run build` — PASS (30 pages)
- Test: `npx eslint` — only the pre-existing errors in untouched shared components
- Test: `node scripts/check-doc-links.mjs` — PASS (0 in-repo broken)

### Test Scenarios

- Scenario: wrong credentials against the running backend (browser) — Expected backend message + code
  — Actual "ID or password does not match. (WBE1009)", request `POST localhost:8080/api/v1/auth/login`
  after a 200 CORS preflight — Result: PASS
- Scenario: successful login, company chooser, `/me` rehydrate, logout revoke — NOT RUN in the browser:
  no test account is documented for the local backend and real credentials are not entered by the
  assistant. Covered by unit tests at the client layer only.

### Regression Review

- Areas checked: `proxy.ts` gate unchanged (still keyed on the `wecms_token` cookie that
  `tokenStorage` writes); locale survives logout (unit test); mock data screens untouched.
- Result: no regression found.

### Manual Verification

- Environment: LOCAL (FE `localhost:3000`, BE `localhost:8080`, branch `sit`)
- Result: PASS for the executed failure path; success path NOT RUN (see above)

## Test Evidence

Test result:
[WeInvoice API Integration — Test Result](../../testing/results/weinvoice-api-integration-test-result-2026-11-03.md) (login, 2026-11-03) ·
[WeInvoice Dashboard API Wiring — Test Result](../../testing/results/weinvoice-dashboard-api-test-result-2026-11-04.md) (Dashboard, 2026-11-04) ·
[WeInvoice Dashboard — Real API Test Result](../../testing/results/weinvoice-dashboard-real-api-test-result-2026-11-05.md) (real API, 2026-11-05 — PARTIAL) ·
[WeInvoice All Endpoints — Test Result](../../testing/results/weinvoice-all-endpoints-test-result-2026-11-05.md) (all endpoints, 2026-11-05) ·
[WeInvoice Published Contract — Test Result](../../testing/results/weinvoice-published-contract-test-result-2026-11-05.md) (reconciled, 2026-11-05)

Final test result:    PASS (executed checks)
Regression coverage:  NOT APPLICABLE (feature; client contract tests added)

## Result

Login now goes through the real backend; the rest of the app still uses the mock data layer, by
decision, until the WeInvoice API contract is available. Not committed.

## Known Limitations / Follow-up

0c. **Published contract reconciled (2026-11-05):** all API branches follow `interface-specification.md`
   + DTOs (no `// DRAFT` left; `// OPEN:` marks spec gaps: engine step names for `fetch_pdf`,
   `progress{}` keys, upload batch status values, `line_kind`, ZIP missing-XML count, engine error
   codes are free text). `GET /api/v1/weinvoice/me` drives the working MST. Mailboxes and
   sub-accounts are not in the published API → their screens show "not available on the server yet"
   in API mode (no requests). KPIs now sum VND (`total_vnd` / `exchange_rate`). **Real-API run
   BLOCKED:** restart the backend on `8823f7f` with the 14 `WECMS_WEINVOICE_*` keys, DBA applies
   `db/weinvoice/V1__winv_schema.sql` (+ grants, 144-provider seed), and run the engine worker
   (`weinvoice.winv_engn_rqst`) — without it engine jobs (add MST, sync, PDF, lookup code, uploads)
   stay `queued` until the 10-minute client timeout.
0b. **All endpoints (2026-11-05):** wired to the draft contract; against the real local backend every
   `/api/v1/weinvoice/*` call returns 404 `WBE_NOT_FOUND` — the app shows an empty store + the error
   banner, no mock data. The working-MST gap of 0a is **fixed** (hydration uses the logged-in
   company's `tax_id`). The draft field names must be reconciled with the backend's
   `interface-specification.md` when it is published.
0a. **Real-API test (2026-11-05):** after the user enabled VPN the backend answered; real login +
   `/me` PASS; the Dashboard's real request returns **404 `WBE_NOT_FOUND`** (endpoint not
   implemented — no backend branch contains `domain/weinvoice`). **Frontend gap found:** in API mode
   the request sends the mock header MST (`0109876543`) instead of the logged-in company's
   `tax_id` (`1201496252`) — see the 2026-11-05 test result. Also: `lib/axios.ts` has no request timeout, so a hanging backend leaves the login spinner
   running forever (follow-up: add a timeout + the network-error message).
0. **Dashboard draft contract unconfirmed** (2026-11-04): the endpoint does not exist yet; with
   `DATA_SOURCE=api` the screen shows the error card (HTTP 404). When the backend publishes its
   contract, reconcile `DashboardResponseRec` + `toDashboardSummary` (and their tests) only. The
   working MST sent as `company_mst` still comes from the mock company list in the header — the
   companies endpoint (`GET /companies`) is not wired, so in API mode it must be a MST of the
   logged-in tenant. Browser check NOT RUN (backend not running; port 8080 held by another project).
1. **Data endpoints blocked** on the backend interface specification
   (`docs/features/addon-service/weinvoice/interface-specification.md` + the `domain/weinvoice` code,
   still uncommitted per the note). When it lands: one `lib/api/weinvoice/*` module at a time, wire
   types in `lib/types/api.ts`, mappers at the boundary, engine jobs via `request_id` polling.
2. **Successful-login path not exercised in a browser** — needs a backend test account (user to try,
   or provide one).
3. Backend returns English messages even with `Accept-Language: vi` on login (backend behaviour; noted).
4. `/me` menu grants (`all_menus`, `allowed_menu_cds`) are stored but not applied — WeInvoice menus
   are not registered in `USER_MENU_AUTH_INFM`.
5. Mock data is still scoped by the seed's MSTs, not by the logged-in company's `tax_id`.

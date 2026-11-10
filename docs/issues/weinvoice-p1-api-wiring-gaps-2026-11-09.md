# WeInvoice P1: Business Functions Still on the Mock — Wire Them to the Backend

**Date:** 2026-11-09
**Type:** ISSUE
**Current Work Classification:** ISSUE
**Status:** PARTIAL (FE done and tested; end-to-end with the running engine worker not run)
**Investigation Status:** COMPLETE · **Approval Status:** APPROVED (developer, 2026-11-09: "Viết worker" — engine worker + the two FE gaps) · **Implementation Status:** COMPLETE · **Test Status:** PASS (unit); end-to-end NOT RUN
**Repository:** wecms-web (checked out as `we-scraping-web`)
**Backend:** `we-scraping-api` — `docs/features/addon-service/weinvoice/interface-specification.md`

## Problem

Request (2026-11-09): from the business requirements (UI Spec v1.0 `02_Yeu_cau_nghiep_vu.md`), find which
WeInvoice functions on the front end are not yet connected to the backend API, and connect them.

## Scope

`lib/api/weinvoice/*` (data layer) against the published backend endpoints and the P1 scope of the spec.
Screens that the spec / Function List place in P2+ (checks, supplier risk, taxpayer lookup, journal,
filed returns, sub-accounts, mailboxes) stay on the mock unless the backend already serves them.

## Investigation Plan

1. List every exported data-layer function and whether its API branch exists.
2. Match each against the backend endpoint list and the P1 scope.
3. Wire the functions whose endpoint exists; list the rest with the missing backend piece.

## Findings

Traced 2026-11-09: every exported function of `lib/api/weinvoice/*` and `lib/weinvoice/exporter.ts`
against the 40 + 2 backend endpoints (`interface-specification.md`).

### Already wired (API mode calls the backend)

| Business function (spec) | Backend endpoint(s) | FE |
|---|---|---|
| Dashboard (screen 03) | `GET /dashboard` | `dashboard.getDashboard` |
| Invoice list / detail / files / lookup code / fetch missing XML / tags on invoices (04–05) | `GET /invoices`, `GET /invoices/{id}`, files, `PUT …/lookup-code`, `POST /invoices/fetch-missing-xml`, `PUT /invoices/tags` | `invoices.ts`, store hydrated by `remote.ts` |
| Excel / ZIP export (04) | `POST /invoices/export/excel`, `POST /invoices/export/zip` | `exporter.exportExcel`, `exporter.buildZip` |
| Original PDF on demand (05) | `POST /invoices/{id}/original-pdf` + `GET /requests/{id}` | `original.ts` |
| GDT connections (06) | `/companies*` | `sync.ts` (synchronous login test since 2026-11-06) |
| Mail invoices (07) | `GET /email/address`, `GET /email/messages` | `mailbox.ts` |
| Upload / adopt (09) | `/uploads*` | `uploads.ts`, `invoices.ts` |
| Sync runs, history, cancel (10) | `/sync-runs*` | `sync.ts` |
| Provider catalogue (16) | `GET /providers` | `providers.ts` |
| Tags (18) | `/tags*` | `tags.ts` |

Client-side on purpose (data already in the store): facets, "select all" ids, filters, KPIs —
the backend's `GET /invoices/facets` and `/invoices/ids` are not needed while the store holds the year.

### Not wired on the front end

| Function | Backend | Situation |
|---|---|---|
| Acceptance test data (M14) | `POST /test-data/load` (engine `TEST_DATA`) | `testdata.ts` always reports "unavailable" |
| User preferences (language, shortcuts) | `PUT /me/preferences`, `GET /me` (`lang_cd`) | language stays in `localStorage` only; `/me` is read only for the working MST |
| Mail detail | `GET /email/messages/{id}` | screen 07 has no detail view (spec) — nothing to wire |
| P2+ screens: checks, supplier risk, taxpayer lookup, journal, filed returns, sub-accounts, mailboxes | none | stay on the mock / "not available on the server yet" by design |

### The real gap is behind the API: no engine worker

Five backend endpoints only queue a request in `weinvoice.winv_engn_rqst`; **nothing in the engine
processes them yet** (only `LOGIN_TEST` was replaced by the synchronous engine call on 2026-11-06):

| Request | Screen / button | Effect today |
|---|---|---|
| `SYNC` | Đồng bộ (03, 04, 06, 10), bulk sync | `queued` until the FE gives up (`sync.ts` timeout) |
| `FETCH_XML` | "Lấy XML còn thiếu" (04, export pre-check) | same |
| `FETCH_PDF` | "Lấy PDF gốc" (05), lookup-code save | same (`waitForRequest`, 10 min) |
| `IMPORT` | Upload XML / ZIP / PDF (09), adopt | same (`uploads.ts` timeout) |
| `TEST_DATA` | test-data panel (09) | not wired on the FE either |

Wiring more FE code does not change this: these screens already call the right endpoints and wait
for a result the engine never writes — the same symptom as the add-MST spinner fixed on 2026-11-06.

## Recommended Implementation

1. Engine (we-scraping): a `winv-worker` command that claims `winv_engn_rqst` rows (`FOR UPDATE SKIP
   LOCKED`), runs `SYNC` / `FETCH_XML` / `FETCH_PDF` / `IMPORT` / `TEST_DATA` with the job's existing
   functions, writes `step` / `progress` / `result` / `error`, and `winv_sync_cvrg`. Contract: backend
   module `README.md` § "Engine contract". Runs next to the queue workers.
2. FE, small: wire `testdata.ts` to `POST /test-data/load` + `waitForRequest` (useful only after 1), and
   save the UI language through `PUT /me/preferences`.

Decision (2026-11-09): developer approved both — engine worker (backend record
`we-scraping-api/docs/issues/weinvoice-engine-request-worker-2026-11-09.md`) and the two FE gaps.

## Implementation

- `lib/api/weinvoice/testdata.ts` (API mode): `testDataAvailable` = `GET /me` → `test_data_enabled`
  (counts unknown before the engine runs); `loadTestData` = `POST /test-data/load?company_mst=<working MST>`
  → `waitForRequest` (progress "done/total") → `toTestDataReport(result)` (engine `created` + `merged` shown as
  created) → `refreshAfterSync(MST)`; a failed / cancelled request throws the engine message (`no_folder` keeps
  its localized text). Mock mode unchanged (unavailable).
- `lib/api/weinvoice/me.ts` (new): `rememberServerLang` (from `GET /me` `lang_cd`), `serverLocale`,
  `saveLanguage` (`PUT /me/preferences {lang_cd}`, skipped in mock mode or when unchanged).
- `lib/api/weinvoice/remote.ts`: the `/me` loader also remembers `lang_cd`.
- `components/layout/AppShell.tsx`: after hydration applies the backend language; later language changes are
  saved (best effort — `localStorage` still keeps the choice for this browser).
- `components/upload/TestDataPanel.tsx`: the XML / PDF counts line only when counts are known.
- Engine worker (other repositories): backend record
  `we-scraping-api/docs/issues/weinvoice-engine-request-worker-2026-11-09.md`.

## Files Changed

`lib/api/weinvoice/testdata.ts`, `lib/api/weinvoice/me.ts` (new), `lib/api/weinvoice/remote.ts`,
`components/layout/AppShell.tsx`, `components/upload/TestDataPanel.tsx`,
`lib/api/weinvoice/testdata-me.api.test.ts` (new).

## API Impact

Consumes `POST /test-data/load`, `GET /requests/{id}` (TEST_DATA result), `GET /me` `lang_cd` /
`test_data_enabled`, `PUT /me/preferences`. No contract change.

## UI Impact

Test-data card appears on Nguồn → Tải lên when the backend enables it; the UI language follows the user
across devices. No new strings.

## Database Impact

NONE (frontend) — database dependency only: engine `invoice_details_nguon_check` widening (engine
`db/schema.sql`, applied by `invoice_job.py init-db`), see the backend record.

## Verification

### Automated Tests

- `npx vitest run lib/api/weinvoice` — PASS, 12 files / 119 tests (new: test data available / mock /
  load + progress + report + reload / engine error; language remember / save / unchanged / unknown / mock).
- `npx vitest run` — PASS, 16 files / 137 tests.
- `npx tsc --noEmit` — 0 errors in source; `npx eslint` on the changed files — clean.

### Manual Verification

- Environment: LOCAL — NOT RUN: the screens with the backend and the engine worker running together
  (worker live run waits for the developer, see the backend record).

## Test Evidence

[weinvoice-test-data-language-test-result-2026-11-09.md](../testing/results/weinvoice-test-data-language-test-result-2026-11-09.md)

## Known Limitations / Follow-up

- End-to-end (upload, sync, fetch XML / PDF, test data) needs `web/weinvoice_worker.py` running.
- Changing the language before hydration finishes is not saved until the next change.

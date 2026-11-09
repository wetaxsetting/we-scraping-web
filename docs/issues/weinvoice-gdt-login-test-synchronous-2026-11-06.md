# WeInvoice: Add / Change a GDT Account Answers in One Call

**Date:** 2026-11-06
**Type:** ISSUE
**Current Work Classification:** ISSUE
**Status:** READY FOR MANUAL COMMIT (end-to-end with the backend not run)
**Approval Status:** APPROVED (developer, 2026-11-06) · **Implementation Status:** COMPLETE · **Test Status:** PASS (unit); end-to-end NOT RUN
**Repository:** wecms-web (checked out as `we-scraping-web`)
**Backend record:** `we-scraping-api/docs/issues/weinvoice-gdt-login-test-synchronous-2026-11-06.md`

## Problem

Screen "Kết nối Cục Thuế": adding a tax code or changing its password spun forever. The backend answered
`{request_id}` and the screen polled `GET /requests/{id}`, but nothing ever processed that request.

## Expected Behavior

The backend now logs in to the GDT portal through the scraping engine before saving, and answers
`POST /companies` / `PUT /companies/{mst}/password` with the saved `CompanyItem` (status `connected`).
Errors: `WBE3027` GDT rejected the account (message = the portal's text), `WBE3028` the account could not
be checked now. The screen must take the answer directly — no polling.

## Scope

`lib/api/weinvoice/sync.ts` (`addConnection`, `changePassword`, `toConnectError`), its API tests.

## Database Impact

NONE (frontend).

## Implementation

- `addConnection` (API mode): emits `onStep("login")`, `POST /companies` → `CompanyItem`; reloads
  `GET /companies` and returns the row (falls back to the answer when the reload fails). No more
  `waitForRequest` / `GET /requests/{id}`.
- `changePassword` (API mode): `PUT …/password` → `CompanyItem`, then the same reload; errors propagate
  as `WeInvoiceApiError` (`WBE3027` / `WBE3028`), shown by `ConnectionsPage` through `apiErrorText`.
- `toConnectError`: `WBE3027` → `wrong_password` (message = backend text, which carries the portal's
  reason); `WBE3028` stays `api`.
- Removed the now-unused `confirmLogin`, `requestFinished`, `engineError` and the `waitForRequest` /
  `EngineRequest` imports. Mock mode unchanged.

## Files Changed

`lib/api/weinvoice/sync.ts`, `lib/api/weinvoice/sync.api.test.ts`.

## API Impact

Consumes the new backend answers of `POST /companies` and `PUT /companies/{mst}/password`
(`CompanyItem`) and error codes `WBE3027` / `WBE3028`.

## UI Impact

The connection dialog shows "Đăng nhập cổng Cục Thuế" while the single call runs, then closes on success
or shows the portal's reason; it no longer spins indefinitely. No component changed.

## Verification

- `npx vitest run lib/api/weinvoice` — PASS, 11 files / 112 tests (add: one call, no polling; WBE3027 →
  wrong_password; reload failure still ok; password change; WBE3028 → api).
- `npx tsc --noEmit` — 0 errors in source (stale `.next/types` from an older build excluded).
- `npx eslint lib/api/weinvoice/sync.ts lib/api/weinvoice/sync.api.test.ts` — clean.
- UI run against the backend: NOT RUN (backend not started on this machine).

## Test Evidence

[weinvoice-gdt-login-test-synchronous-test-result-2026-11-06.md](../testing/results/weinvoice-gdt-login-test-synchronous-test-result-2026-11-06.md)

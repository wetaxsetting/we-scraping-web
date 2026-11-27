# WeInvoice — Tax24 Lookup Link Points to a Product Page — Fix

**Date:** 2026-11-27
**Type:** BUG FIX
**Current Work Classification:** BUG
**Status:** READY FOR MANUAL COMMIT
**Repository:** we-scraping-web
**Approval Status:** APPROVED (user, 2026-11-27: "Update link")
**Implementation Status:** COMPLETE
**Test Status:** PASS

Backend counterpart (catalogue row + DBA script): `we-scraping-api/docs/bugs/weinvoice-tax24-lookup-url-fix-2026-11-27.md`.

## Problem

`lib/weinvoice/providers.ts` › `PROVIDERS` entry stt 21 (Tax24, 0102454468) has
`lookupUrl: https://tax24.com.vn/thuedientu/san-pham-dich-vu/hoa-don-dien-tu` — the product marketing page, no lookup
form. The NCC catalogue screen (`components/tools/ProvidersPage.tsx`) and any fallback that reads `PROVIDERS` link there.

## Expected Behavior

`lookupUrl: https://tax24.com.vn/thuedientu/xac-minh-hoa-don` (public "Xác minh hóa đơn": "Mã xác minh hóa đơn" =
XML TTKhac "Mã Kiểm tra" + image captcha), `captchaUrl: https://tax24.com.vn/thuedientu/servlet/ImageServlet`,
`web: https://tax24.com.vn/thuedientu/trang-chu` (was the product page with a trailing `.`).

## Scope

The one `PROVIDERS` entry. Out of scope: UI changes, automatic lookup.

## Database Impact

NONE in this repository (the DB row is the backend record's script).

## Root Cause

The catalogue was copied from the UI Spec provider list, which recorded Tax24's product page as its lookup URL.

## Implementation

`PROVIDERS` Tax24 entry: `web` → `https://tax24.com.vn/thuedientu/trang-chu`, `lookupUrl` →
`https://tax24.com.vn/thuedientu/xac-minh-hoa-don`, `captchaUrl` → `https://tax24.com.vn/thuedientu/servlet/ImageServlet`.

## Files Changed

- `lib/weinvoice/providers.ts` (one entry)
- `lib/weinvoice/providers.test.ts` (new regression test)
- this record, the test-result record

## API Impact

None. In API mode the link comes from the backend catalogue row — that change is the backend record's DBA script
(backend: `we-scraping-api/docs/bugs/weinvoice-tax24-lookup-url-fix-2026-11-27.md`, READY FOR DBA).

## UI Impact

NCC catalogue screen (`/tools/providers`) and mock-mode lookup links for Tax24 open the verify page.

## Verification

### Automated Tests

- Test: `lib/weinvoice/providers.test.ts` — fails 2/2 on the old entry, passes 2/2 with the fix.
- Result: PASS · full suite 33 files / 247 tests PASS · eslint PASS · tsc: only pre-existing stale `.next/types` errors.

### Regression Test

Test file: `lib/weinvoice/providers.test.ts`
Test case: "sends Tax24 to its public invoice verify page"; "never links a provider's lookup to a product / service marketing page"
Behavior protected: Tax24's lookup link is the verify page; no catalogue lookup link points at a marketing page.

### Manual Verification

- Environment: LOCAL — NOT RUN (static data; the dev server needs the backend for login).

## Test Evidence

Test result:
[WeInvoice Tax24 Lookup Link (Web) — Test Result](../testing/results/weinvoice-tax24-lookup-url-test-result-2026-11-27.md)

Final test result: PASS · Regression coverage: PASS

## Result

READY FOR MANUAL COMMIT. In API mode the screen shows the new link only after the backend script has run.

## Known Limitations / Follow-up

None in this repository.

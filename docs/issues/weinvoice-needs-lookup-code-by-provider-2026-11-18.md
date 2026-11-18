# WeInvoice: "Needs a Lookup Code" Flag by Provider (Mock Parity)

**Date:** 2026-11-18
**Type:** ISSUE
**Status:** READY FOR MANUAL COMMIT
**Approval Status:** NOT REQUIRED (developer request 2026-11-18: "sửa luôn cờ cần mã tra cứu theo NCC")
**Implementation Status:** COMPLETE · **Test Status:** PASS (automated)
**Repository:** we-scraping-web
**Backend record:** `we-scraping-api/docs/issues/weinvoice-needs-lookup-code-by-provider-2026-11-18.md` (backend repository)

## Problem

API mode reads the backend flag (`needs_lookup_code`), which the backend now narrows (no "!" once the original PDF is stored
or when the provider looks up without a code). Mock mode computes its own rule in `needsLookupCode()`
(`lib/api/weinvoice/invoices.ts`: provider known AND no lookup code) and would keep the old behaviour.

## Expected Behavior

Mock rule = backend rule: provider known, no lookup code, no PDF yet, provider not in the "looks up without a code" list.

## Scope

`lib/api/weinvoice/invoices.ts` (`needsLookupCode` mock branch), tests.

## Database Impact

NONE (frontend).

## Implementation

`lib/api/weinvoice/invoices.ts`: `LOOKUP_WITHOUT_CODE` (same six MSTs as the backend `ProviderLookup.WITHOUT_CODE`);
mock `needsLookupCode` = catalogue provider AND no lookup code AND no PDF file AND not in that list. API mode unchanged
(backend flag).

## Files Changed

`lib/api/weinvoice/invoices.ts`, `lib/api/weinvoice/needsLookupCode.test.ts` (new), this record, the test-result record.

## Verification

- `npx vitest run` — PASS (26 files, 215 tests); `tsc`, `eslint` — PASS.

## Test Evidence

Test result: [WeInvoice Needs Lookup Code by Provider (Web) Test Result](../testing/results/weinvoice-needs-lookup-code-by-provider-web-test-result-2026-11-18.md)

Final test result: PASS

## Known Limitations / Follow-up

The provider list is duplicated in the web for the mock only; API mode always follows the backend.

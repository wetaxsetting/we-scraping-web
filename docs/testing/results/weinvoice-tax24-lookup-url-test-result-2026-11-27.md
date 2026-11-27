# WeInvoice Tax24 Lookup Link (Web) — Test Result

**Date:** 2026-11-27
**Type:** TEST RESULT
**Status:** PASS
**Repository:** we-scraping-web
**Related Record:** [WeInvoice — Tax24 Lookup Link Points to a Product Page — Fix](../../bugs/weinvoice-tax24-lookup-url-fix-2026-11-27.md)

## Scope

`lib/weinvoice/providers.ts` › `PROVIDERS` entry Tax24 (0102454468): `lookupUrl`, `captchaUrl`, `web`.

## Environment

LOCAL (Windows, Node from the repo, Vitest + jsdom).

## Code / Build Under Test

Branch: `scraping-data` · Commit: NOT COMMITTED.

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run lib/weinvoice/providers.test.ts` on the unfixed catalogue (`git stash` of `providers.ts`) | FAIL (expected) | 2/2 failed — Tax24 `lookupUrl` was the product page |
| `npx vitest run lib/weinvoice/providers.test.ts` with the fix | PASS | 2/2 |
| `npx vitest run` | PASS | 33 files, 247 tests |
| `npx eslint lib/weinvoice/providers.ts lib/weinvoice/providers.test.ts` | PASS | no output |
| `npx tsc --noEmit -p .` | PASS except pre-existing | only stale `.next/types/validator.ts` errors (old WeCMS routes), none in changed files |

## Regression Tests

Did a regression test cover the original defect? **YES** — `lib/weinvoice/providers.test.ts`:
"sends Tax24 to its public invoice verify page" and "never links a provider's lookup to a product / service marketing
page". Both fail on the old catalogue, pass on the new one.

## Existing Failures

Stale `.next/types` errors in `tsc` (generated files for removed WeCMS routes) — present before this change.

## Not Tested

- UI visual check of the NCC catalogue screen: NOT RUN — the link is static data; the dev server needs the backend for
  login.
- A real lookup on the Tax24 page: NOT RUN — it needs the image captcha, which the user types by hand.

## Final Result

PASS

## Recommendation

READY FOR MANUAL COMMIT

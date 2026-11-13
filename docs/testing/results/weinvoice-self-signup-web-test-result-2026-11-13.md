# WeInvoice Self Sign-up — Web Test Result

**Date:** 2026-11-13
**Type:** TEST RESULT
**Status:** PASS (sign-up) · dashboard follow-up
**Repository:** we-scraping-web
**Related Record:** [weinvoice-self-signup-2026-11-13](../../features/weinvoice/weinvoice-self-signup-2026-11-13.md)

## Scope

`/register` (`SignupForm`, `AuthShell`), `signup()` in `lib/weinvoice/auth.ts`, the `/login` link, `proxy.ts`.

## Environment

LOCAL (Windows, `node_modules`, `next dev` on :3000).

## Code / Build Under Test

Branch: `scraping-data` · Commit: NOT COMMITTED.

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run components/auth` | PASS | 4/4 |
| `npx vitest run` | PASS | 21 files, 197 tests |
| `npx tsc --noEmit -p .` (source; `.next/types` stale) | PASS | 0 errors |
| `npx eslint` on changed files | PASS | 0 problems |

## UI Verification

| Scenario | Expected | Actual | Result |
|---|---|---|---|
| Open `/register` without a session | Form in the login frame | Rendered, no redirect to `/login` | PASS |
| Submit empty | Required-field messages, no request | 3 messages under name / email / password | PASS |
| `/login` | Link to sign-up | "Chưa có tài khoản? Đăng ký" | PASS |
| 375 × 812 | No horizontal scroll | `scrollWidth` 375, form 327 px | PASS |
| Real sign-up | Account created, signed in | Redirected to `/dashboard`, `/auth/me` 200 | PASS |
| First dashboard of a new account | Empty state | Error banner `email/messages … companyMst must not be blank`, spinner | FAIL (pre-existing, follow-up) |

## Not Tested

`lamine@gmail.com` after the move (move not applied yet).

## Final Result

PASS for sign-up; the empty dashboard of a new account is a pre-existing follow-up.

## Recommendation

READY FOR MANUAL COMMIT; fix the empty dashboard of an account without an MST as a follow-up.

# WeInvoice: Self Sign-up Form

**Date:** 2026-11-13
**Type:** FEATURE
**Status:** READY FOR MANUAL COMMIT (sign-up works end to end on LOCAL)
**Approval Status:** APPROVED (developer, 2026-11-13: "giúp t tạo 1 form đc k?" — chose self sign-up on the login page,
accounts in a WeInvoice-owned table)
**Implementation Status:** COMPLETE · **Test Status:** PASS (automated + LOCAL end to end)
**Repository:** we-scraping-web
**Backend record:** `we-scraping-api/docs/features/addon-service/weinvoice/weinvoice-self-signup-2026-11-13.md` (backend repository)

## Requirement

A "Đăng ký" link on `/login` opening a public sign-up form; on success the user is signed in.

## Current System Behavior (before)

`/login` only (real `POST /api/v1/auth/login`); `proxy.ts` let only `/login` through without a token. No sign-up screen
in spec v1.0 — product addition approved by the developer.

## Implementation

- `components/auth/AuthShell.tsx` (new): the login page frame (navy band, locale switch) + `nextPath()`; `/login` now
  uses it (markup unchanged) and gains "Chưa có tài khoản? Đăng ký".
- `components/auth/SignupForm.tsx` (new) + `app/(auth)/register/page.tsx`: Họ và tên*, Email (login id)*, Số điện
  thoại, Tên công ty, Mật khẩu* (show/hide, hint), Nhập lại mật khẩu*. Client checks mirror the backend (email shape,
  ≥ 8 chars with letters + digits, confirmation); the backend re-checks (`WBE3038`–`WBE3040`) and its message is shown
  with the code. Success → `?next=` or `/dashboard`.
- `lib/weinvoice/auth.ts` `signup()` → `POST /api/v1/auth/signup` `{ email, user_nm, user_pw, clph_no?, cmpn_nm? }`;
  stores token + profile like `login()`. `lib/axios.ts`: sign-up is an auth path (a 401 does not redirect).
- `proxy.ts`: `/register` is public. Locales VI/EN/KO: `login.no_account`, `login.register`, `signup.*`.

## Files Changed

`components/auth/{AuthShell,SignupForm,SignupForm.test}.tsx` (new), `app/(auth)/register/page.tsx` (new),
`app/(auth)/login/page.tsx`, `lib/weinvoice/auth.ts`, `lib/axios.ts`, `proxy.ts`, `locales/{vi,en,ko}.json`,
`docs/features/weinvoice/test-scenarios.md` (scenario 32), this record, the test-result record.

## API Impact

Consumes the new public `POST /api/v1/auth/signup` (backend record above). A WeInvoice account's profile has
`biz_key = "WEINVOICE"`, `auth_gr_cd = "USER"`, no tax id — the app does not gate on those for WeInvoice screens.

## Database Impact

NONE (frontend) — database dependency only: `weinvoice.winv_user_infm` (`V4__winv_user.sql`) and the move script for
`lamine@gmail.com`, both in the backend record above, not executed yet.

## Verification

### Automated Tests

- `npx vitest run components/auth` — PASS (4/4: rule mirror, invalid form never posts, snake_case body + stored session,
  backend `WBE3040` message shown and the button re-enabled).
- `npx vitest run` — PASS (21 files, 197 tests). `tsc --noEmit` (source) and `eslint` on changed files — PASS.

### Manual Verification

- Environment: LOCAL (`next dev` :3000), 1280×860 and 375×812.
- `/register` renders in the login frame; empty submit shows "Vui lòng nhập thông tin này." under the 3 required
  fields; `/login` shows "Chưa có tài khoản? Đăng ký"; no horizontal scroll at 375 px — PASS.
- Real submit (backend rebuilt, V4 applied): test account signed up → redirected to `/dashboard` — PASS.
- Found: with no tax code yet the dashboard shows "GET /email/messages: companyMst must not be blank" and keeps
  spinning (`email/messages?company_mst=` is called for a user without an MST). Pre-existing for any user without an
  MST, now the first screen of every new account — fixed in [weinvoice-dashboard-without-tax-code-fix-2026-11-13](../../bugs/weinvoice-dashboard-without-tax-code-fix-2026-11-13.md).

## Test Evidence

Test result: [WeInvoice Self Sign-up Web Test Result](../../testing/results/weinvoice-self-signup-web-test-result-2026-11-13.md)

## Known Limitations / Follow-up

No email verification, forgot-password or change-password for WeInvoice accounts (backend follow-up).

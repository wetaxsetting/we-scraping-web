# WeInvoice: Dashboard Stuck for an Account Without a Tax Code

**Date:** 2026-11-13
**Type:** BUG FIX
**Status:** READY FOR MANUAL COMMIT
**Approval Status:** APPROVED (developer, 2026-11-13: "Sửa luôn")
**Implementation Status:** COMPLETE · **Test Status:** PASS
**Repository:** we-scraping-web
**Found by:** [weinvoice-self-signup-2026-11-13](../features/weinvoice/weinvoice-self-signup-2026-11-13.md) (end-to-end check)

## Problem

A signed-in user with no connected tax code (every account right after sign-up) opens `/dashboard` and sees the banner
"Không tải được một phần dữ liệu từ máy chủ — GET /email/messages: messages.companyMst: must not be blank
(WBE_VALIDATION)" and a spinner that never stops.

## Current Behavior (observed 2026-11-13, LOCAL)

Network: `GET /api/v1/weinvoice/email/messages?company_mst=&page=0&size=200` is sent (twice) although the user has no
MST; `companies`, `me`, `tags`, `sync-runs` answer 200.

## Expected Behavior

No MST-scoped request without an MST; the dashboard shows an empty state that leads to "Kết nối Thuế (MST)" instead of
a spinner and an error.

## Root Cause

Two independent gaps, both only visible for a user with zero tax codes (API mode):

1. `lib/api/weinvoice/mailbox.ts` `loadEmails(taxId)` had no empty-MST guard (unlike `loadInvoices`, which returns on
   `!taxId`), so `hydrate()` sent `GET /email/messages?company_mst=` and the backend's `@NotBlank` answered
   `WBE_VALIDATION` → the shell's "partial data" banner.
2. `components/dashboard/Dashboard.tsx` deliberately skips `getDashboard` while there is no working MST ("wait for the
   shell's hydration"), but nothing ever ends that wait when the user has no MST at all → spinner forever.

## Implementation

- `loadEmails`: return when `taxId` is empty (same rule as `loadInvoices`).
- `Dashboard`: when API mode, no working MST, no connection and hydration finished (`ready` / `error`, and
  `GET /companies` itself did not fail) → `EmptyState` "Chưa có MST nào" + hint + primary "Thêm MST" linking to
  `/sources/gdt?add=1` (the header's add-MST entry, opens the connect dialog). Otherwise unchanged (still the spinner
  while hydration runs).
- Locales VI/EN/KO: `dash.no_mst.title`, `dash.no_mst.hint` (button reuses `conn.add`).

## Files Changed

`lib/api/weinvoice/mailbox.ts`, `components/dashboard/Dashboard.tsx`, `components/dashboard/Dashboard.test.tsx`,
`locales/{vi,en,ko}.json`, `docs/features/weinvoice/test-scenarios.md` (scenario 33), this record, the test-result record.

## API Impact

Fewer requests: no `GET /email/messages` without an MST. No contract change.

## Database Impact

NONE (frontend).

## Regression Test

Test file: `components/dashboard/Dashboard.test.tsx` · Test case: "API source: an account without any tax code gets the
connect-MST empty state, and no MST-scoped request" · Behavior protected: after `hydrate()` with zero companies the
dashboard shows the empty state (no spinner) and no `/email/messages` or `/invoices` request is sent.
Fails on the unfixed `Dashboard.tsx` + `mailbox.ts` (stash run: "Unable to find … Chưa có MST nào"), passes after.

## Verification

### Automated Tests

- `npx vitest run components/dashboard` — PASS 4/4; `npx vitest run` — PASS 21 files, 198 tests.
- `tsc --noEmit` (source) and `eslint` on changed files — PASS.

### Manual Verification

- Environment: LOCAL (web :3000, backend :8080), test account `signup.test.57951b@example.com` (no MST).
- Login → `/dashboard`: no banner, "Chưa có MST nào" card; requests sent: `companies`, `me`, `tags`, `sync-runs` — no
  `email/messages`; "Thêm MST" → `/sources/gdt?add=1` with the "Kết nối MST mới" dialog open — PASS.

## Test Evidence

Test result: [WeInvoice Dashboard Without Tax Code Test Result](../testing/results/weinvoice-dashboard-without-tax-code-test-result-2026-11-13.md)

## Known Limitations / Follow-up

Other MST-scoped screens (invoice lists, mail, upload) for a user without an MST were not reviewed in this fix.

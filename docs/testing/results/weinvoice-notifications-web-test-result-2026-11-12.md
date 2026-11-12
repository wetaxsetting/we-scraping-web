# WeInvoice Notification Bell — Web — Test Result

**Date:** 2026-11-12
**Type:** TEST RESULT
**Status:** PARTIAL — automated checks PASS; browser and backend integration NOT RUN
**Repository:** we-scraping-web
**Related Record:** [weinvoice-notifications-2026-11-12.md](../../features/weinvoice/weinvoice-notifications-2026-11-12.md)

## Scope

Header notification bell: unread badge + 60 s poll, panel with three filters, item click (mark read + navigate + working-MST
switch), read-all, load more; data module `lib/api/weinvoice/notifications.ts` (mock + api); 204 handling in
`lib/api/weinvoice/http.ts`; `humanizeIso` in `lib/datetime.ts`; `notif.*` locale keys.

## Environment

LOCAL — Windows 11, Node via `npx`, Vitest 2.1.9 + jsdom. No browser, no backend.

## Code / Build Under Test

Branch: `scraping-data` · Commit: NOT COMMITTED · Build: not built · API: none (axios `api.request` mocked in tests).

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run lib/api/weinvoice/notifications.api.test.ts lib/api/weinvoice/http.test.ts` | PASS | 2 files, 19 tests (notifications 12, http 7) |
| `npx vitest run components/layout` | PASS (after one test fix, see below) | 1 file, 12 tests |
| `npx vitest run components lib/api/weinvoice` | PASS | 17 files, 174 tests |
| `npx vitest run` (whole suite) | PASS | 19 files, 186 tests |
| `npx tsc --noEmit` | PASS for changed code | 44 output lines, all under `.next/types` (pre-existing generated route types); 0 errors outside `.next/` |
| `npx eslint` on the 8 changed / new source + test files | PASS | exit 0, no findings |
| `node scripts/check-doc-links.mjs` | PASS (in-repo) | 44 files, in-repo broken 0, unsafe 0; out-of-repo broken 2 = `CLAUDE.md:1637`, `:1712` → `../CLAUDE.md` (pre-existing, not touched) |

First component run: 1 failure in this change's own test — it expected "15 phút trước" for an item 15 minutes old, but the
shared relative-time buckets (`lib/datetime.ts`, legacy parity) render 10–19 minutes as "10 phút trước". The test
expectation was corrected; the formatter was not changed.

## Regression Tests

New: `lib/api/weinvoice/notifications.api.test.ts`, `components/layout/NotificationBell.test.tsx`; one case added to
`lib/api/weinvoice/http.test.ts` (204 → success, no data). Existing suites that use `wiPost` / the header-adjacent code
(mailbox, tags, uploads, sync, dashboard, MailboxConnect) all still pass.

## Test Scenarios

| Scenario | Expected | Actual | Result |
|---|---|---|---|
| List, filter=mst | `GET /notifications` params `{filter:"mst", company_mst, page:0, size:20}`; page mapped to camelCase | as expected | PASS |
| List, filter=all / action | no `company_mst` | as expected | PASS |
| filter=mst without working MST | empty page, no request | as expected | PASS |
| Unread count | `GET /notifications/unread-count` → number | as expected | PASS |
| Read | `POST /notifications/read {ids}`; 204 accepted; empty list → no call | as expected | PASS |
| Read-all | with MST `{company_mst}`; without `{}` | as expected | PASS |
| Backend error | `WeInvoiceApiError` with backend code | `WBE3002` | PASS |
| Mapper | nulls → `[]` / `null`; `mailbox_id` → string; `action` defaults true for error types; bad direction → null | as expected | PASS |
| Targets | mua → purchase, ban → sales, XML/PDF unknown → purchase, GDT → `/sources/gdt`, mailbox → `/sources/mailbox` | as expected | PASS |
| Mock mode | deterministic ids, scoped filters, read state in memory, no HTTP | as expected | PASS |
| Badge | hidden at 0; "99+" at 150 | as expected | PASS |
| Poll | +1 call after 60 s; none while `document.hidden`; immediate call on `visibilitychange` back to visible | as expected | PASS |
| Filter chips | mst → all → action params | as expected | PASS |
| Item click | `POST read {ids:["n1"]}`, working MST switched to the item MST, `router.push("/invoices/sales")`, badge re-read | as expected | PASS |
| Read item click | no read call, no MST switch when same MST, `/sources/gdt` | as expected | PASS |
| Read call fails | navigation still happens | as expected | PASS |
| Read-all | `{company_mst: A}` on working-MST filter, `{}` on Tất cả MST | as expected | PASS |
| Load more | page 1, same filter, appended | as expected | PASS |
| Empty / error | "Chưa có thông báo", no footer; "Không tải được thông báo" + "Thử lại" | as expected | PASS |

## API Verification

Request shapes verified against the backend record's contract text only. The backend endpoints are being built in parallel —
**no call against a real backend was made** (NOT RUN).

## UI Verification

NOT RUN — the app was not started in a browser (visual layout, 375 / 1440 px, EN / KO rendering not inspected). Text and
behaviour are covered only through jsdom (VI).

## Database Verification

NOT APPLICABLE on this side — the read-state table `winv_ntfc_read` is owned by the backend record.

## Security / Permission Verification

No secrets handled. Items are owner-scoped by the backend; the web only sends the working MST. Mailbox / GDT messages are
shown as text (React-escaped).

## Performance / Concurrency Verification

One `unread-count` call per 60 s per open tab while visible; the list is fetched only when the panel opens or a filter /
page changes. A sequence counter drops answers to superseded list requests (fast filter switching).

## Existing Failures

None in the test suite. `tsc` errors under `.next/types` and the 2 out-of-repo doc links in `CLAUDE.md` predate this work.

## New Failures

None.

## Not Tested

- Browser rendering (desktop / 375 px, VI / EN / KO) — not run.
- Integration with the real backend endpoints — backend not available yet.

## Final Result

PARTIAL

## Recommendation

READY FOR MANUAL COMMIT after a browser check; integration test once the backend endpoints exist.

## Addendum — cross-check with the backend (2026-11-12)

The backend sends `direction` as `purchase` / `sales` (not `mua` / `ban`): `toNotification` now accepts both (new
assertions in `notifications.api.test.ts`). Re-run: `npx vitest run components lib/api/weinvoice` — 17 files, 174 passed;
`npx tsc --noEmit` — 0 source errors; eslint on `notifications.ts` + its test — clean. Browser: NOT RUN.

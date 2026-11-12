# WeInvoice Mailbox Connections (Web) — Test Result

**Date:** 2026-11-12
**Type:** TEST RESULT
**Status:** PARTIAL (automated PASS · browser + real backend NOT RUN)
**Repository:** we-scraping-web
**Related Record:** [weinvoice-mailbox-connections-2026-11-12](../../features/weinvoice/weinvoice-mailbox-connections-2026-11-12.md)

## Scope

`/sources/mailbox` rebuilt to the approved layout (4 tiles, Gmail / Microsoft / IMAP / forwarding panels, connected
list) and `lib/api/weinvoice/mailbox.ts` wired to `/api/v1/weinvoice/mailboxes*`.

## Environment

LOCAL, Vitest 2.1.9 (jsdom), Node, Windows. No browser, no backend.

## Code / Build Under Test

Branch `scraping-data` · Commit: NOT COMMITTED · API: mocked transport (`@/lib/axios` `api.request` spy).

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run components/upload lib/api/weinvoice` | PASS | 13 files, 143 tests |
| — `lib/api/weinvoice/mailbox.api.test.ts` | PASS | 24 tests (list, create IMAP, create Gmail, update without password, refused login, delete, scan + poll, failed scan, authorize ONE/ALL, not configured, mock-only consent refused, return params, strip URL, folders, validation, mock mode) |
| — `components/upload/MailboxConnect.test.tsx` (new) | PASS | 5 tests (tile switching, connected row actions, Gmail validation, IMAP validation + connect clears password, api-mode `?ms=error` return) |
| `npx vitest run` (whole suite) | PASS | 17 files, 161 tests |
| `npx tsc --noEmit` | PASS for source | 0 errors outside `.next/`; the only errors are in the stale generated `.next/types/validator.ts` (dated 2026-11-05, references removed WeCMS routes) — pre-existing |
| `npx eslint` on the 9 changed source / test files | PASS | no findings |
| `node scripts/check-doc-links.mjs` | PASS (in-repo) | 43 files, 300 links, in-repo broken 0; 2 out-of-repo findings pre-existing (`CLAUDE.md` lines 1637 / 1712 → workspace `../CLAUDE.md`) |
| locale key presence (node one-off) | PASS | 111 keys used by the 3 mailbox components exist in vi / en / ko |

## API Verification

Request shapes asserted against the contract in the backend record (wire snake_case, upper-case enum values):
`GET /mailboxes` · `POST /mailboxes` `{kind, address, password, imap_host, imap_port, tls_mode, login_id, folders,
company_scope, company_mst}` · `PUT /mailboxes/{id}` without `password` when blank · `DELETE /mailboxes/{id}` ·
`POST /mailboxes/{id}/scan` → `GET /requests/{request_id}` → `GET /mailboxes` ·
`GET /mailboxes/microsoft/authorize?company_scope=&company_mst=&folders=` (folders comma-joined). Response mapper
`toMailbox` covered for GMAIL / MICROSOFT / IMAP, ALL / ONE, CONNECTED / EXPIRED / unknown, `yyyyMMddHHmmss` and ISO
timestamps.

## Security / Permission Verification

Tests assert the password / app password never appears in the store after connect (api and mock) and the password
field is empty after an attempt.

## Existing Failures

None in the test suite. `tsc` errors in `.next/types/validator.ts` predate this work (generated file, 2026-11-05).

## New Failures

None.

## Not Tested

- UI in a browser (desktop and 375 px): NOT RUN — not started in this session (login needs the backend).
- Real backend: NOT RUN — the backend endpoints are being written in parallel; the contract was read from the backend
  record only. The "not configured" error code and the `?ms=error` reason codes are not fixed by the contract yet.
- Real Microsoft sign-in round trip: NOT RUN.

## Final Result

PARTIAL — automated PASS; browser and integration checks pending.

## Recommendation

READY FOR MANUAL COMMIT after the developer's browser check; integration check once the backend endpoints exist.

## Addendum — cross-check with the backend (2026-11-12)

After the backend was finished: `?ms=error&reason=` codes now follow the backend (`not_configured, denied, state, company,
exchange, no_refresh_token, no_address, refused, missing_folders, unavailable, error`; old `access_denied,
consent_required, invalid_state, login_failed` removed, VI/EN/KO); "not configured" is recognised by `WBE3032` (message
match kept as fallback); a raw `yyyyMMddHHmmss` is read as UTC (the DB stores UTC; the backend sends ISO anyway).
Re-run: `npx vitest run components/upload lib/api/weinvoice` — 13 files, 143 passed; `npx tsc --noEmit` — 0 source
errors; eslint on `mailbox.ts`, `MailboxConnect.tsx` — clean. Browser check: NOT RUN.

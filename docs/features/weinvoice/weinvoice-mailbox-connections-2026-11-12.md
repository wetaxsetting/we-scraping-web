# WeInvoice: Mailbox Connections — Web (Gmail · Microsoft · IMAP · forwarding)

**Date:** 2026-11-12
**Type:** FEATURE
**Current Work Classification:** FEATURE
**Status:** PARTIAL — code + automated tests done; browser check and backend integration pending
**Investigation Status:** COMPLETE · **Approval Status:** APPROVED (developer, 2026-11-12: "ok làm luôn theo layout này") · **Implementation Status:** COMPLETE · **Test Status:** PASS (automated) · browser / integration NOT RUN
**Repository:** we-scraping-web
**Evidence:** [audit](../../audits/weinvoice-email-connection-setup-audit-2026-11-12.md)
**Backend record (shared contract):** `we-scraping-api/docs/features/addon-service/weinvoice/weinvoice-mailbox-connections-2026-11-12.md` (backend repository)

## Purpose

Let a WeInvoice user connect their own mailboxes on `/sources/mailbox` so the engine collects invoice mails (XML / PDF /
links) for their MSTs, and wire the screen to the backend `/api/v1/weinvoice/mailboxes*` endpoints.

## Requirement

Approved layout (developer, 2026-11-12). Spec screen 08 has Gmail + Outlook; the layout adds a company-mail (IMAP) tile
(**outside spec v1.0** — developer-approved, to be reported to the PO) and folds the forwarding address (screen 07) in as a
fourth tile.

## Current System Behavior

- `MailboxConnect.tsx`: two tiles (Gmail form, Outlook demo sign-in). Mock mode only.
- `lib/api/weinvoice/mailbox.ts`: api mode has no mailbox endpoint — `loadMailboxes` empties the list,
  connect / scan / disconnect refuse with `WBE_CLIENT_NOT_ON_SERVER`; the screen and `MailboxSummary` show
  "not available on the server yet".

## Target Behavior

- **Header:** title "Kết nối email", subtitle naming the working MST, a "read only — never sends or deletes mail" pill.
- **4 tiles** in one row (wrap on narrow screens): Gmail (personal / Workspace) · Outlook / Microsoft 365 (Microsoft sign-in)
  · Company mail (IMAP) · Forwarding (no password).
- **Panels:**
  - Gmail: address, 16-letter app password (show/hide, spaces allowed), "Applies to MST" (working MST | all my MSTs),
    "Folders to scan" (default `INBOX`), "Check and connect", note "logs in once, saved only if it works; the password is
    never shown again", collapsible 4-step guide.
  - Outlook / M365: no password; MST select + folders; "Sign in with Microsoft" → `GET /mailboxes/microsoft/authorize` →
    `window.location.assign(url)`; admin-approval warning. On return `?ms=ok` / `?ms=error&reason=…` → toast / alert,
    reload the list, remove the query. Authorize answering "not configured" → info message.
  - Company mail (IMAP): address, IMAP server, port (993), security (SSL/TLS | STARTTLS), login name (defaults to the
    address), password, folders (comma separated), MST select, "Check and connect".
  - Forwarding: the per-MST address from `GET /email/address` with a copy button; `configured=false` → "receiving domain
    not set up yet".
- **Connected mailboxes list:** kind icon, address, last scan time + invoices found (or the error reason), status pill
  (Connected / Error / Expired), actions Scan now (engine request, polled), Edit (prefilled form, password optional),
  Disconnect (confirm → DELETE). Expired Microsoft → "Sign in again".
- Secrets live only in the input while typing (§3.10); mock mode keeps working (simulated, secrets never stored).

## Scope

`components/upload/MailboxConnect.tsx`, `MailboxPage.tsx`, `MailboxSummary.tsx`, `lib/api/weinvoice/mailbox.ts`,
`lib/api/weinvoice/mockData.ts` (`Mailbox` type), `lib/api/weinvoice/http.ts` (`EngineRequest.type`),
`lib/api/weinvoice/remote.ts` (comment), `locales/{vi,en,ko}.json`, tests.

## Out of Scope

Backend endpoints, the table and the OAuth callback (backend record); the engine scan (engine repository). Hosting the
receiving mail domain.

## API Impact

Consumes (contract in the backend record, wire snake_case; camelCased once in `toMailbox`):

| Call | Endpoint |
|---|---|
| list | `GET /api/v1/weinvoice/mailboxes` → `MailboxItem[]` |
| connect Gmail / IMAP | `POST /api/v1/weinvoice/mailboxes` |
| edit | `PUT /api/v1/weinvoice/mailboxes/{id}` (password omitted = keep) |
| disconnect | `DELETE /api/v1/weinvoice/mailboxes/{id}` |
| scan now | `POST /api/v1/weinvoice/mailboxes/{id}/scan` → `RequestAccepted` → `GET /api/v1/weinvoice/requests/{request_id}` |
| Microsoft sign-in | `GET /api/v1/weinvoice/mailboxes/microsoft/authorize?company_scope=&company_mst=&folders=` → `{url}` |
| forwarding | `GET /api/v1/weinvoice/email/address?company_mst=` (existing) |

## UI Impact

`/sources/mailbox` rebuilt to the approved layout; `/sources/email` summary card lists the connected mailboxes (with
status) in api mode too.

## Database Impact

NONE in this repository (§12g). The backend record owns `weinvoice.winv_mlbx_infm` and the `winv_engn_rqst` CHECK change.

## Validation / Business Rules

- Address: `local@domain.tld`. Gmail app password: 16 letters after removing spaces. IMAP: server required, port
  1–65535 (default 993), password required on connect, optional on edit.
- Folders: comma separated, trimmed, empty dropped, default `INBOX`.
- "Applies to MST": `ONE` + the working MST, or `ALL`.

## Testing Plan

- `lib/api/weinvoice/mailbox.api.test.ts`: request shapes for list / create IMAP / create Gmail / update without password /
  delete / scan / authorize; mapper; Microsoft return params; mock mode.
- `components/upload/MailboxConnect.test.tsx`: tile switching, validation errors.
- `npx tsc --noEmit`, `npx eslint <changed files>`, `node scripts/check-doc-links.mjs`.

## Implementation

- `lib/api/weinvoice/mailbox.ts`: `loadMailboxes` (GET), `connectMailbox` (POST), `updateMailbox` (PUT, blank password
  omitted), `disconnectMailbox` (DELETE), `scanMailbox` (POST scan → `waitForRequest` → reload; `found` =
  `last_scan_invoices`), `microsoftAuthorize` (GET authorize → `{ok, url}` or `not_configured`),
  `readMicrosoftReturn` / `stripMicrosoftReturn`, `toMailbox` (wire → `Mailbox`, once), `toMailboxBody`,
  `validateMailboxInput`, `parseFolders`, `appliesTo`. Mock branches kept (simulated; secrets never stored) plus
  `connectMicrosoftDemo` (mock only). `mailboxesAvailable` and the `WBE_CLIENT_NOT_ON_SERVER` path removed.
- `lib/api/weinvoice/mockData.ts`: `Mailbox` gains `scope`, `provider: "imap"`, `method` `oauth_ms` / `imap_password`
  (was `oauth_graph`), `status`, `statusMessage`, `lastScanInvoices`, IMAP fields, `folders`.
- `lib/api/weinvoice/http.ts`: `EngineRequest.type` gains `mail_scan`.
- `components/upload/MailboxConnect.tsx`: rewritten to the approved layout (4 tiles, 4 panels, connected list with
  Scan now · Edit · Disconnect · Sign in again). Loads the list on mount (api mode) with loading / error + retry; handles
  the `?ms=` return once and cleans the URL with `history.replaceState`.
- `components/upload/MailboxPage.tsx`: header = "Kết nối email" + working MST + read-only pill.
- `components/upload/MailboxSummary.tsx`: works in api mode (loads `/mailboxes`), shows status, IMAP included.
- `lib/api/weinvoice/remote.ts`: comment only (mailboxes are loaded by their screens, not in hydration).
- Locales VI / EN / KO: 66 `mbx.*` keys added, 8 reworded, 7 no longer used removed (`mbx.page_title`, `mbx.page_subtitle`,
  `mbx.subtitle`, `mbx.new`, `mbx.method.oauth_graph`, `mbx.gmail_safe`, `mbx.readonly`); every key the 3 components use exists in all 3 files.

### Deviations / decisions

- **Edit of a Microsoft mailbox** = sign in again with the chosen MST scope / folders (the contract's `PUT` takes
  only GMAIL / IMAP bodies).
- **Address is read-only when editing** (the backend keys a mailbox by address; a new address is a new connection).
- **"Not configured"** is recognised by the message (`not configured` / `chưa cấu hình` / KO) or an empty `url`,
  because the contract names no error code — OPEN for the backend.
- **`?ms=error&reason=`** codes known to the UI: `access_denied`, `consent_required`, `invalid_state`, `login_failed`;
  any other code shows a generic message with the code — OPEN: the backend should publish its reason list.
- Timestamps: ISO passed through; a `yyyyMMddHHmmss` value is read as Asia/Ho_Chi_Minh (the DB format), in case the
  backend returns it raw.
- `GET /mailboxes` accepts a bare array (contract) or `{rows}`.
- Mailboxes are not loaded during hydration (avoids a hydration-banner error while the backend endpoint is not
  deployed); the mailbox page and the email summary card load them.

## Files Changed

`components/upload/MailboxConnect.tsx`, `components/upload/MailboxPage.tsx`, `components/upload/MailboxSummary.tsx`,
`components/upload/MailboxConnect.test.tsx` (new), `lib/api/weinvoice/mailbox.ts`, `lib/api/weinvoice/mailbox.api.test.ts`,
`lib/api/weinvoice/mockData.ts`, `lib/api/weinvoice/http.ts`, `lib/api/weinvoice/remote.ts`, `locales/{vi,en,ko}.json`,
`CLAUDE.md` (data-layer note), `docs/features/weinvoice/README.md`, `docs/features/weinvoice/test-scenarios.md` (18b–18g).

## Verification

### Automated Tests

- `npx vitest run components/upload lib/api/weinvoice`: PASS — 13 files, 143 tests (`mailbox.api.test.ts` 24,
  `MailboxConnect.test.tsx` 5). Whole suite: PASS — 17 files, 161 tests.
- `npx tsc --noEmit`: PASS for source (only pre-existing errors in the stale generated `.next/types/validator.ts`).
- `npx eslint` (changed files): PASS.
- `node scripts/check-doc-links.mjs`: in-repo broken 0; 2 out-of-repo findings pre-existing (`CLAUDE.md` §15c/§16 → workspace `../CLAUDE.md`).

### Manual Verification

- Browser (desktop / 375 px): NOT RUN. Real backend and Microsoft round trip: NOT RUN (backend in progress).

## Test Evidence

Test result:
[WeInvoice Mailbox Connections (Web) — Test Result](../../testing/results/weinvoice-mailbox-connections-web-test-result-2026-11-12.md)

Final test result:    PASS (automated) · browser / integration NOT RUN

## Result

Web half implemented against the shared contract; ready for the developer's browser check and for integration once
the backend `/mailboxes*` endpoints and the engine `MAIL_SCAN` request exist.

## Known Limitations / Follow-up

- The IMAP tile is outside spec v1.0 (developer-approved) — to be reported to the PO.
- Confirm with the backend: the "not configured" error code, the `ms=error` reason codes, and the timestamp format of
  `connected_at` / `last_scan_at`.
- Browser check at 375 / 1440 px still to be done.

## Addendum — cross-check with the backend (2026-11-12)

After the backend was finished: `?ms=error&reason=` codes now follow the backend (`not_configured, denied, state, company,
exchange, no_refresh_token, no_address, refused, missing_folders, unavailable, error`; old `access_denied,
consent_required, invalid_state, login_failed` removed, VI/EN/KO); "not configured" is recognised by `WBE3032` (message
match kept as fallback); a raw `yyyyMMddHHmmss` is read as UTC (the DB stores UTC; the backend sends ISO anyway).
Re-run: `npx vitest run components/upload lib/api/weinvoice` — 13 files, 143 passed; `npx tsc --noEmit` — 0 source
errors; eslint on `mailbox.ts`, `MailboxConnect.tsx` — clean. Browser check: NOT RUN.

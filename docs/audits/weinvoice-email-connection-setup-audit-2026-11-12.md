# WeInvoice: "Kết nối email" — Mailbox Types and Setup Fields — Audit

**Date:** 2026-11-12
**Type:** AUDIT / INVESTIGATION (feature analysis)
**Current Work Classification:** AUDIT
**Finding Classification:** FEATURE requirement (mailbox connections are not built end to end)
**Status:** COMPLETE
**Investigation Status:** COMPLETE · **Approval Status:** PENDING · **Implementation Status:** NOT STARTED
**Repository:** we-scraping-web (with backend + engine references)

## Request

Developer (2026-11-12): list the mailbox kinds the "Kết nối email" screen must support (Gmail, Outlook, company mail…),
the information each needs to be set up, and whether it can be set up.

## Scope

Screen `/sources/mailbox` (`components/upload/MailboxConnect.tsx`, `MailboxPage.tsx`, `lib/api/weinvoice/mailbox.ts`),
the UI spec, the backend contract, the engine mail reader (`mail_reader.py`).

## Investigation Plan

1. Spec: what the PO asks for on this screen.
2. Web: current form fields and data layer.
3. Backend: existing mailbox endpoints / tables.
4. Engine: login modes `mail_reader.py` already supports.
5. Provider requirements (Gmail, Microsoft 365 / Outlook.com, self-hosted, others) from their official docs.

## Findings

### Spec (v1.0)

- `01_Dac_ta_UI.html` screen 08 `/sources/mailbox/`: two cards — **Gmail** (address + 16-character App Password,
  show/hide, "read only" note, 4-step guide) and **Outlook / Microsoft 365** ("Sign in with Microsoft"); connected state:
  Scan now, Disconnect; the app password is never shown again.
- Screen 07 `/sources/email/`: a per-MST receiving address `hd-<mst>@inbox…` (forwarding — no customer credentials).
- `02_Yeu_cau_nghiep_vu.md` §3.10: Gmail (App Password, read only) and Outlook / Microsoft 365 (Microsoft sign-in);
  secrets never returned to the UI. No "other IMAP / company mail" card.

### Web (current)

- `MailboxConnect.tsx`: Gmail form (address, App Password `^[A-Za-z]{16}$` after removing spaces) + guide links;
  Outlook card with a sign-in button only. `lib/api/weinvoice/mailbox.ts`: **api mode has no mailbox endpoint** —
  `loadMailboxes` returns empty, connect/scan/disconnect refuse with `WBE_CLIENT_NOT_ON_SERVER`, the screen shows
  "not available on the server yet". Mock mode simulates.

### Backend

- No mailbox endpoint and no mailbox table (the 11 `winv_*` tables have none). `GET /email/address` exists
  (`configured=false` when no mail domain).

### Engine (`mail_reader.py`)

- Reads **one** mailbox from `.env` (`INVOICE_MAIL_*`), IMAP SSL read-only (EXAMINE + BODY.PEEK), several folders.
- Auth modes: `password` (works today on Webcash's self-hosted Hanbiro), `oauth2_microsoft` = **app-only client
  credentials** (`IMAP.AccessAsApp`, needs the customer's tenant admin), `oauth2_google` = refresh token of our own
  Google client. No per-customer mailbox, no delegated Microsoft sign-in.

### Provider requirements (public docs, checked 2026-11-12)

| Kind | How it can connect | Notes |
|---|---|---|
| Gmail personal (`@gmail.com`) | IMAP `imap.gmail.com:993` + **App Password** | needs 2-Step Verification on the account; IMAP is always on since Jan 2025 (Google help 7126229). Google calls app passwords "not recommended" but they work. |
| Google Workspace (company domain on Google) | same App Password, **if the admin allows** | less-secure-app (plain password) sign-in ended for Workspace (Google admin help 10547014, May 2025); app passwords for 2SV users depend on admin policy — verify per customer. |
| Gmail via Google OAuth | `https://mail.google.com/` / `gmail.readonly` | **restricted scopes** → Google app verification + annual CASA assessment — not for P1. |
| Outlook.com / Hotmail / Live (personal) | **OAuth only** — Basic auth for IMAP retired 2024-09-16 | delegated sign-in, scope `https://outlook.office.com/IMAP.AccessAsUser.All` + `offline_access`; host `outlook.office365.com:993`. |
| Microsoft 365 (company domain on Microsoft) | delegated OAuth (same scope) | multi-tenant app; tenants that block user consent need **admin consent**; unverified multi-tenant apps are flagged risky → publisher verification. App-only (`IMAP.AccessAsApp`) needs admin consent + `New-ServicePrincipal` + mailbox permission in Exchange PowerShell per tenant — only for large customers. |
| Self-hosted / hosting company mail (Hanbiro, Zimbra, cPanel, Mắt Bão, PA Việt Nam…), Yahoo, Zoho, iCloud | IMAP host + port + username + password | Yahoo/Zoho/iCloud need their own app password; not in the spec. |
| Any mailbox | **forward** to `hd-<mst>@inbox…` (screen 07) | no credentials; needs a receiving domain + inbox on our side. |

## Recommended Implementation

1. **Fields per mailbox** (backend table, secret encrypted like `gdt_pw_enc`): owner, MST(s) it feeds, kind
   (`gmail` · `microsoft` · `imap`), address, auth (`app_password` · `password` · `oauth_microsoft`), IMAP host, port
   (993), SSL, username (default = address), folders (default `INBOX`), secret (app password / password / refresh token),
   status + last error, connected at, last scan at. Secrets never returned.
2. **Gmail / Workspace:** keep the spec form (address + App Password). Backend tests the login once (as for GDT) before
   saving.
3. **Outlook / Microsoft 365:** register one Entra app (any organisation + personal accounts), redirect URI on the
   backend, scopes `offline_access https://outlook.office.com/IMAP.AccessAsUser.All openid email`; backend stores the
   refresh token; engine gets a new access token per scan (new delegated mode in `mail_reader`). Publisher verification
   recommended.
4. **Company mail (IMAP):** a third card "Mail khác (IMAP)" — **spec change, ask the PO** (needed for customers like
   Webcash whose mail is self-hosted).
5. **Forwarding address** (screen 07): works for every provider without credentials; needs the receiving domain.
6. Engine: replace the single `.env` mailbox by the per-mailbox list from the DB; keep `.env` for Webcash.

## Affected Repositories

we-scraping-web (IMAP card if approved; wire `/mailboxes/*`), we-scraping-api (table + endpoints + OAuth callback),
engine (per-mailbox reader, delegated Microsoft token).

## DB Impact

New table in `weinvoice` (backend) — not prepared; only after approval.

## Sources

- https://support.google.com/mail/answer/7126229 · https://support.google.com/a/answer/10547014
- https://workspaceupdates.googleblog.com/2023/09/winding-down-google-sync-and-less-secure-apps-support.html
- https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth
- https://support.microsoft.com/en-us/help/5035414 · https://www.neowin.net/news/outlook-personal-email-accounts-will-do-away-with-basic-usernames-and-passwords-september-16/

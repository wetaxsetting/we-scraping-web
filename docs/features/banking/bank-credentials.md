# Banking > Bank Credentials & Scraping — Frontend Feature Spec

**Domain:** `banking`
**Refactor slug:** `bank-credentials`
**Route:** `/banking/credentials`
**Status:** Working (credential list + add + live scrape journey)
**Backend counterpart:** bank-credentials.md _(wecms-api backend repo — not included in this clone)_

> Created 2026-06-01 (documentation audit round 2). Documents an already-implemented page. No new scope.
>
> **See OQ-DOC-7** — relationship/overlap with Settings → Login Credentials
> ([../settings/login-credentials.md](../settings/login-credentials.md)) is pending PO confirmation (shared
> `BANK_CERT_INFO` + NXISAS scraping flow).

## Overview

The Credentials page lists a tenant's saved bank credentials and drives the multi-step bank-scraping
journey (start → challenge → result) against the Coocon/NXISAS gateway via the backend.

## Page / Components

- Route: `app/(dashboard)/banking/credentials/page.tsx` → `CredentialsClient.tsx`.
- Dialogs (`app/(dashboard)/banking/credentials/`): `AddCredentialDialog`, `OtpDialog`, `CaptchaDialog`,
  `QnaDialog`, `ScrapeResultDialog`.
- API client: `lib/api/bankCredentials.ts` (`fetchBankCredentials`, `deleteBankCredential`,
  `startScrape`, `submitScrapeOtp`, …). Result-code localization via `lib/i18n/scrapingResultCodes`.

## User journey

1. **Add** → enter credential → `POST /api/v1/banking/credentials`; row appears in the table.
2. **Update from bank** (per row) → `POST /api/v1/banking/scraping/account-list`:
   - `OTP_REQUIRED` → `OtpDialog` → `POST /{sessionId}/otp`
   - QNA challenge → `QnaDialog` → `POST /{sessionId}/qna`
   - CAPTCHA challenge → `CaptchaDialog` → `POST /{sessionId}/captcha`
   - `COMPLETED` → `ScrapeResultDialog` (scraped accounts/cards)
   - `ERROR` → inline banner (message via `lookupScrapingResultMessage`)
3. **Delete** → `DELETE /api/v1/banking/credentials/{seqNo}`.

## Notes

- Password is entered in the Add dialog and never re-displayed; the list shows username + status only.
- Tenant scope is server-side (JWT); the page sends no `bizKey`.
- Typography / tokens per workspace CLAUDE.md §"Global Typography".

## Related

- Backend spec: bank-credentials.md _(wecms-api backend repo — not included in this clone)_
- Settings → Login Credentials (shared backend; boundary OQ-DOC-7): [../settings/login-credentials.md](../settings/login-credentials.md)
- Open question: documentation-follow-up.md _(wecms-api backend repo — not included in this clone)_ (OQ-DOC-7)

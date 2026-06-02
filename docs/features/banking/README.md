# Banking — Frontend Feature Docs

Per-screen Next.js design docs for the **Banking** top-menu module, grouped to mirror the live WeCMS Banking menu and sidebar.

## Menu → folder map

| WeCMS Banking menu group | Folder | Screens |
|---|---|---|
| Current & Savings (VND) | [current-savings-vnd/](current-savings-vnd/) | Account Inquiry · Transaction History · Smart Organizer ⚠️ |
| Current & Savings (FCY) | [current-savings-fcy/](current-savings-fcy/) | Account Inquiry · Transaction History · Smart Organizer |
| Internal Transfer | [own-account-transfer/](own-account-transfer/) | Own Account Transfer · Transfer History |
| Reports | [reports/](reports/) | Daily Cash · Daily Financial · Cash Flow (Daily Financial HS ⚠️ stub — OQ-DOC-8) |
| Bank Credentials | [bank-credentials.md](bank-credentials.md) | Credentials list · Add · live scrape (OTP / QNA / CAPTCHA) |

Smart Organizer is **implemented** — backend `SmartOrganizerController` + `OrganizerRuleController` (+ migrations V172–V174) and the Next.js route `app/(dashboard)/banking/smart-organizer/`. The VND route is built; an FCY-specific page is not yet split out (the shared route serves it). Feature docs carry residual `Needs Confirmation` detail to reconcile against the shipped code.

## Related routes

- `/banking/account-inquiry` (VND, working — shell + mock data), FCY variant pending
- `/banking/transaction-history` (+ per-account `[accountId]` children)
- `/banking/reports/{daily-cash,daily-financial,daily-financial-hs,cash-flow}`

## Related components

- [`components/shared/AccountInquiryPage.tsx`](../../../components/shared/AccountInquiryPage.tsx) — approved baseline for standard menu pages
- [`components/banking/transaction-history/`](../../../components/banking/transaction-history/) · [`components/banking/internal-transfer/`](../../../components/banking/internal-transfer/) · [`components/banking/reports/`](../../../components/banking/reports/)
- Shared report shell [`components/shared/ReportLayout.tsx`](../../../components/shared/ReportLayout.tsx) (Reports group only — no pagination)

## Related backend docs (`wecms-api/`)

- Feature hubs: `banking` _(wecms-api backend repo — not included in this clone)_
- API contracts: `banking` _(wecms-api backend repo — not included in this clone)_
- DB schema: `banking` _(wecms-api backend repo — not included in this clone)_

Open questions touching this module: **OQ-DOC-4** (Smart Organizer scope), **OQ-DOC-5** (Transaction History API/DB contract), **OQ-DOC-6** (report JEX-id mapping) — tracked on the backend side; not resolved here.

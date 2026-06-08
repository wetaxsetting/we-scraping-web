# Banking — Frontend Feature Docs

Per-screen Next.js design docs for the **Banking** top-menu module, grouped to mirror the live WeCMS Banking menu and sidebar.

> **Cross-cutting:** Banking top-menu / sidebar / route-guard / active-state behavior across product
> types (F/M/H/W) and permission cases is documented once in
> **[menu-sidebar-route-guard-behavior.md](menu-sidebar-route-guard-behavior.md)** (verified 2026-06-07).
> Backend twin: [wecms-api/docs/features/banking/menu-authorization-and-product-types.md](../../../../wecms-api/docs/features/banking/menu-authorization-and-product-types.md).

## Menu → folder map

| WeCMS Banking menu group | Folder | Screens |
|---|---|---|
| **Account Inquiry (VND)** ✅ refactor complete | [account-inquiry-vnd/](account-inquiry-vnd/) | **Primary home** — README · screen-flow · ui-specification · component-index · api-consumption · test-scenarios |
| **Transaction History (VND)** ✅ refactor complete | [transaction-history-vnd/](transaction-history-vnd/) | **Primary home** — README · screen-flow · ui-specification · component-index · api-consumption · test-scenarios |
| **Account Inquiry (FCY)** ✅ refactor complete | [account-inquiry-fcy/](account-inquiry-fcy/) | **Primary home** — README · screen-flow · ui-specification · component-index · api-consumption · test-scenarios. Route `/banking/account-inquiry-fcy`; shares the VND shell (`multiCurrencyMode`). Preserved single-file spec: [current-savings-fcy/account-inquiry.md](current-savings-fcy/account-inquiry.md). |
| **Transaction History (FCY)** ✅ refactor complete | [transaction-history-fcy/](transaction-history-fcy/) | **Primary home** — README · screen-flow · ui-specification · component-index · api-consumption · test-scenarios. Route `/banking/transaction-history-fcy/[accountId]`; shares the `TransactionHistoryClient`/`Page` via `scope="FCY"`. Preserved single-file spec: [current-savings-fcy/transaction-history.md](current-savings-fcy/transaction-history.md). |
| **Smart Organizer** ✅ refactor complete | [smart-organizer/](smart-organizer/) | **Primary home** — README · screen-flow · ui-specification · component-index · api-consumption · test-scenarios. One page serves **VND + FCY** (route `/banking/smart-organizer?account=…`). Superseded single-file specs: [current-savings-vnd/smart-organizer.md](current-savings-vnd/smart-organizer.md), [current-savings-fcy/smart-organizer.md](current-savings-fcy/smart-organizer.md). |
| Current & Savings (VND) | [current-savings-vnd/](current-savings-vnd/) | Account Inquiry + Transaction History (preserved single-file specs → see `account-inquiry-vnd/` + `transaction-history-vnd/`) · Smart Organizer (→ see `smart-organizer/`) |
| Current & Savings (FCY) | [current-savings-fcy/](current-savings-fcy/) | Account Inquiry (preserved single-file spec → see `account-inquiry-fcy/`) · Transaction History · Smart Organizer (→ see `smart-organizer/`) |
| Internal Transfer | [own-account-transfer/](own-account-transfer/) | Own Account Transfer (✅ implemented — route `/banking/own-account-transfer`) · Transfer History |
| Reports | [reports/](reports/) | Daily Cash · Daily Financial · Cash Flow (Daily Financial HS ⚠️ stub — OQ-DOC-8) |
| Bank Credentials | [bank-credentials.md](bank-credentials.md) | Credentials list · Add · live scrape (OTP / QNA / CAPTCHA) |

Smart Organizer is **full-stack refactor complete** — backend `SmartOrganizerController` +
`OrganizerRuleController` (+ migrations V172–V174) and the Next.js page
`app/(dashboard)/banking/smart-organizer/` wired to the live API. **One page serves both VND and FCY**
(currency follows the selected account; there is no separate FCY page). The current docs live in the
**[smart-organizer/](smart-organizer/)** folder; the older `current-savings-*/smart-organizer.md`
single-file specs are superseded and banner-marked.

## Related routes

- `/banking/account-inquiry` (VND — ✅ full-stack complete, live API, no mock; see [account-inquiry-vnd/](account-inquiry-vnd/)), FCY variant shares the shell
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

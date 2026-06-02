# Banking › Current & Savings (VND)

Frontend design docs for the VND Current & Savings screens. Mirrors the WeCMS Banking sidebar group **Current & Savings (VND)**.

## Screens

| Doc | Route | Status |
|---|---|---|
| [account-inquiry.md](account-inquiry.md) | `/banking/account-inquiry` | Shell + mock data (approved baseline) |
| [transaction-history.md](transaction-history.md) | `/banking/transaction-history` (+ `[accountId]`) | Design — OQ-DOC-5 |
| [smart-organizer.md](smart-organizer.md) | — | ⚠️ Discovery scaffold — OQ-DOC-4 |

Supplementary: [account-inquiry-main-page-ui-rule.md](account-inquiry-main-page-ui-rule.md) — main-page UI rule notes for Account Inquiry (VND).

## Components

[`components/shared/AccountInquiryPage.tsx`](../../../../components/shared/AccountInquiryPage.tsx) · [`components/banking/transaction-history/`](../../../../components/banking/transaction-history/)

## Related backend docs

[`../../../../../wecms-api/docs/features/banking/`](../../../../../wecms-api/docs/features/banking/) · [`../../../../../wecms-api/docs/api-spec/banking/`](../../../../../wecms-api/docs/references/api-spec/banking/) · [`../../../../../wecms-api/docs/database/banking/`](../../../../../wecms-api/docs/references/database/banking/)

The FCY twin lives in [../current-savings-fcy/](../current-savings-fcy/) — VND/FCY screens share one page component; design changes apply to both.

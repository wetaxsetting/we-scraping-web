# Banking › Current & Savings (FCY)

Frontend design docs for the foreign-currency Current & Savings screens. Mirrors the WeCMS Banking sidebar group **Current & Savings (FCY)**.

## Screens

| Doc | Route | Status |
|---|---|---|
| [account-inquiry.md](account-inquiry.md) | `/banking/account-inquiry` (FCY variant) | Design — mirrors VND baseline |
| [transaction-history.md](transaction-history.md) | `/banking/transaction-history` (+ `[accountId]`) | Design — OQ-DOC-5 |
| [smart-organizer.md](smart-organizer.md) | — | ⚠️ Discovery scaffold — OQ-DOC-4 |

## Components

[`components/shared/AccountInquiryPage.tsx`](../../../../components/shared/AccountInquiryPage.tsx) · [`components/banking/transaction-history/`](../../../../components/banking/transaction-history/)

## Related backend docs

`banking` _(wecms-api backend repo — not included in this clone)_ · `banking` _(wecms-api backend repo — not included in this clone)_ · `banking` _(wecms-api backend repo — not included in this clone)_

VND twin: [../current-savings-vnd/](../current-savings-vnd/) — VND/FCY screens share one page component; the only sanctioned differences are currency scope, data, and `minWidth`.

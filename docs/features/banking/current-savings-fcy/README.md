# Banking › Current & Savings (FCY)

> ⚠️ This document is a high-level feature summary.
> The detailed source of truth is located in: [docs/features/banking/current-savings-fcy/](account-inquiry/README.md)

Frontend design docs for the foreign-currency Current & Savings screens. Mirrors the WeCMS Banking sidebar group **Current & Savings (FCY)**. The three screens (Account Inquiry, Transaction History, Smart Organizer) each have their own standardized module folder — this page is only a navigation index. The VND twin lives in [../current-savings-vnd/](../current-savings-vnd/); VND/FCY screens share one page component, with the only sanctioned differences being currency scope, data, and `minWidth`.

## See the authoritative module docs

- [Account Inquiry (FCY)](account-inquiry/README.md) — main account list page (`/banking/account-inquiry`, FCY variant).
- [Transaction History (FCY)](transaction-history/README.md) — per-account transaction history (`/banking/transaction-history` + `[accountId]`).
- [Smart Organizer](../smart-organizer/README.md) — full-stack smart-organizer feature (shared VND/FCY).

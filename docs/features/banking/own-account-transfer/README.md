# Banking › Internal Transfer (Own Account Transfer)

Frontend design docs for the Banking **Internal Transfer** group — moving funds between the tenant's own accounts and reviewing the transfer log. Mirrors the WeCMS Banking sidebar group **Internal Transfer**.

> Not to be confused with Payment › Internal Transfer (batch file approval flow). This Banking screen is the own-account NAPAS transfer + history.

## Screens

| Doc | Route | Status |
|---|---|---|
| [own-account-transfer.md](own-account-transfer.md) | `/banking/internal-transfer/own-account-transfer` | Design (read-only list landed Sprint 1) |
| [transfer-history.md](transfer-history.md) | `/banking/internal-transfer/transfer-history` | Design — NAPAS transfer history |

## Components

[`components/banking/internal-transfer/`](../../../../components/banking/internal-transfer/) — `TransferOwnAccountsTable`, `TransferHistoryTable`, `TransferDialog`, `OtpAuthDialog`.

## API integration

`GET /api/v1/banking/transfers/own-accounts` · `GET /api/v1/banking/transfers/history` (see [`lib/api/banking.ts`](../../../../lib/api/banking.ts)).

## Related backend docs

[`../../../../../wecms-api/docs/features/banking/`](../../../../../wecms-api/docs/features/banking/) · [`../../../../../wecms-api/docs/migration/banking/own-account-transfer.md`](../../../../../wecms-api/docs/references/migration/banking/own-account-transfer.md) · [`../../../../../wecms-api/docs/database/banking/own-account-transfer-db.md`](../../../../../wecms-api/docs/references/database/banking/own-account-transfer-db.md)

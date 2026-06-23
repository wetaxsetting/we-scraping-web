# Banking > Transaction History (FCY) — Frontend Page Design

**Module:** Banking → Current & Savings (FCY) · **Menu:** Transaction History (FCY)
**Route:** `/banking/transaction-history-fcy/[slug]` · **Slug:** `banking-transaction-history-fcy`
**Status:** early (FCY client still uncontrolled).

- API side: `../../../../wecms-api/docs/features/banking/transaction-history-fcy.md` (Needs Confirmation)
- Reached from: account-inquiry-fcy.md (Needs Confirmation)
- VND twin (mirror layout): transaction-history-vnd.md (Needs Confirmation)

## Overview
Per-account FCY transaction list — same capabilities as the VND twin with foreign-currency
formatting and multi-currency presentation.

## Page Location
`app/(dashboard)/banking/transaction-history-fcy/[slug]/page.tsx` → shared transaction client
(`components/banking/transaction-history/`); fetchers in `lib/api/banking.ts`.

## UI Components
Same shell as VND (table, summary, detail, filter bar, confirm control, Excel) with FCY currency formatting.

## User Actions
Open from Account Inquiry FCY → view transactions; filter; page/sort; confirm/undo; export.

## Table Columns
Date · description/remark · amount (FCY) · balance (FCY) · confirmed status. *(Confirm against JEX `fnsh_0006_001`.)*

## Dialogs / Popups
Row detail; confirm/undo.

## API Integration
`GET /api/v1/banking/accounts/{acctSeqNo}/transactions` (same endpoint as VND; FCY account drives currency); export `POST /api/v1/banking/accounts/transactions/export`.

## Validation
Date range; pagination clamp.

## Notes
Distinct menu entry / JEX screen from VND, but shares the frontend component shell and backend endpoint.

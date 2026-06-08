> **⚠️ Superseded — preserved for history (2026-06-06).** The primary frontend documentation home is
> now the folder **[transaction-history-vnd/](../transaction-history-vnd/README.md)** (README ·
> screen-flow · ui-specification · component-index · api-consumption · test-scenarios). The
> `Status: ~25% wired` line below is **stale** — the page is refactor-complete and wired to the live
> backend (filters, confirm/undo, classification pickers, View Setting, XLSX export all implemented).
> Kept for traceability only.

# Banking > Transaction History (VND) — Frontend Page Design

**Module:** Banking → Current & Savings (VND) · **Menu:** Transaction History (VND)
**Route:** `/banking/transaction-history` · **Slug:** `banking-transaction-history-vnd`
**Status:** ~25% wired (read list only; filters + confirm modal + bulk bar + export not yet wired).

- API side: `../../../../wecms-api/docs/features/banking/transaction-history-vnd.md` (Needs Confirmation)
- Reached from: account-inquiry-vnd.md (Needs Confirmation) (click an account)
- FCY twin: transaction-history-fcy.md (Needs Confirmation)

## Overview
Per-account VND transaction list: paged rows, summary totals, row detail, transaction confirmation
(confirm/undo), and Excel export.

## Page Location
Next.js App Router page `app/(dashboard)/banking/transaction-history/page.tsx` → client
`components/banking/transaction-history/TransactionHistoryClient.tsx`; fetchers in `lib/api/banking.ts`.

## UI Components
- Transaction client/page shell, result table, summary card, row-detail view, filter bar (date range, keyword, confirmed-status), confirm/undo control + (planned) bulk-confirm bar, Excel button.

## User Actions
- Open from Account Inquiry → view transactions; filter by date range / keyword / `cnfm_yn`; page/sort; confirm or undo a transaction (bulk-confirm planned); export to Excel.

## Table Columns
Date · description/remark · debit/credit amount · balance · confirmed status. *(Confirm exact set against the shipped table + JEX `fnsh_0002_001`.)*

## Dialogs / Popups
- Row detail; confirm/undo confirmation (planned modal).

## API Integration
- `GET /api/v1/banking/accounts/{acctSeqNo}/transactions` (list/summary/detail); confirm/undo; `POST /api/v1/banking/accounts/transactions/export`. snake_case wire ↔ camelCase mappers.

## Validation
- Date range `from ≤ to`; pagination clamp.

## Notes
Currently forwards neither `cnfm_yn`/`keyword`/`from-to` nor server pagination — see the AI/TH plan for the remaining wiring.

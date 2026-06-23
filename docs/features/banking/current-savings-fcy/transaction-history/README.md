# Banking > Transaction History (FCY) — Refactor Frontend Feature Hub

**Module:** Banking → Current & Savings (FCY)
**Route:** `/banking/transaction-history-fcy` → `/banking/transaction-history-fcy/[accountId]`
**Screen ID (View Setting `screenId`):** `banking-transaction-history` (`SCREEN_IDS.BANKING_TRANSACTION_HISTORY`) — one id shared by VND + FCY
**Feature-folder slug (matches JEX + backend):** `transaction-history-fcy`
**JEX counterpart:** `fnsh_0006_001` (VND twin `fnsh_0002_001`) — [docs/jex/features/transaction-history-fcy/](../../../../../../docs/jex/features/transaction-history-fcy/README.md)
**Backend counterpart:** [wecms-api/docs/features/banking/current-savings-fcy/transaction-history/](../../../../../../wecms-api/docs/features/banking/current-savings-fcy/transaction-history/README.md)

> **Status — Refactor complete (full-stack).** The page is wired to the live backend (no mock
> fallback): per-account FCY list + summary, date-range / type / confirmation-status / keyword
> filtering, the confirm / undo workflow, the four classification pickers (Reporting Account · Purpose
> · VAS · Contact), Smart Organizer match/unmatch, client-side pagination, View Setting column
> visibility/order, and XLSX export are all implemented. **Multi-currency FCY** (USD/KRW/JPY/EUR/…,
> one currency per selected account) is supported and PO-approved. Legacy parity verified against
> `fnsh_0006_001`; SIT/UAT completed. See the backend
> [refactor-gap-analysis.md](../../../../../../wecms-api/docs/features/banking/current-savings-fcy/transaction-history/refactor-gap-analysis.md).
>
> This folder is the **primary frontend documentation home**. The older single-file spec at
> [current-savings-fcy/transaction-history.md](../transaction-history/legacy-spec.md) predates
> this folder and is preserved + cross-linked but superseded by it.

VND and FCY share **one** client wrapper (`TransactionHistoryClient`) + **one** page component
(`TransactionHistoryPage`), differing only by a `scope` prop, the route folder, the empty-state
message key, and the export filename; this hub documents the FCY screen.

> **Two FCY screens — do not confuse them.** **Account Inquiry (FCY)** = legacy `fnsh_0005_001`
> (foreign-currency account list + Update Balance) — [account-inquiry-fcy/](../account-inquiry/README.md).
> **Transaction History (FCY)** = legacy `fnsh_0006_001` (per-account FCY ledger, this folder). The
> Account Inquiry (FCY) balance drill-down deep-links into this screen.

---

## Document map (this folder)

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | User journeys + interaction flows (enter via sidebar/account-inquiry FCY, filter, confirm, classify, match, paginate, export). |
| [ui-specification.md](ui-specification.md) | Layout (two-column header), filters, currency scoping, grid columns, row tinting, loading/empty/error states, detail surface. |
| [component-index.md](component-index.md) | Route, client wrapper, presentation, table, registry, hooks, API client, types — file-by-file. |
| [api-consumption.md](api-consumption.md) | Endpoints consumed, request params, response shapes, wire → in-memory mapping. |
| [test-scenarios.md](test-scenarios.md) | Frontend SIT/UAT scenarios (incl. multi-currency FCY parity). |

## Companion references (preserved — cross-linked)

| Doc | Location |
|---|---|
| Original frontend page spec (stale status) | [current-savings-fcy/transaction-history.md](../transaction-history/legacy-spec.md) |
| VND twin (shared shell) | [transaction-history-vnd/README.md](../transaction-history/README.md) |
| Account Inquiry (FCY) — upstream entry screen + sync owner | [account-inquiry-fcy/README.md](../account-inquiry/README.md) |
| Page mapping (JEX `_view.jsp` → route) | [references/page-mapping/page-mapping.md](../../../../references/page-mapping/page-mapping.md) |
| **Backend feature hub** | [wecms-api/docs/features/banking/current-savings-fcy/transaction-history/](../../../../../../wecms-api/docs/features/banking/current-savings-fcy/transaction-history/README.md) |
| **Backend interface spec (endpoints)** | [wecms-api/docs/features/banking/current-savings-fcy/transaction-history/interface-specification.md](../../../../../../wecms-api/docs/features/banking/current-savings-fcy/transaction-history/interface-specification.md) |
| **Backend parity audit (2026-06-06)** | [wecms-api/docs/audits/transaction-history-fcy-parity-audit.md](../../../../../../wecms-api/docs/audits/transaction-history-fcy-parity-audit.md) |
| JEX functional spec (source of truth) | [docs/jex/features/transaction-history-fcy/](../../../../../../docs/jex/features/transaction-history-fcy/README.md) |

---

## Quick facts

- **Route files:** `app/(dashboard)/banking/transaction-history-fcy/page.tsx` →
  `<TransactionHistoryIndexRedirect scope="FCY" />` (redirects to the first FCY account);
  `app/(dashboard)/banking/transaction-history-fcy/[accountId]/page.tsx` →
  `<TransactionHistoryClient acctSeqNo={accountId} scope="FCY" />`.
- **Shared shell:** `TransactionHistoryClient` (state/fetch) + `TransactionHistoryPage` (presentation)
  — both also serve the VND twin via `scope="VND"`.
- **Currency:** there is **no in-page currency dropdown** — the FCY currency is fixed by the selected
  account (`row.ccy_cd` from `fetchAccounts("FCY")`); the page title and footer total label show it.
- **API:** `GET /api/v1/banking/accounts/{acctSeqNo}/transactions` (list) ·
  `.../transactions/summary` (tab counts + totals) · `.../transactions/{trnsSeqNo}` (detail) ·
  `PUT/DELETE .../{trnsSeqNo}/confirm` · `PATCH/DELETE .../{reporting-account|purpose|vas-account|contact}` ·
  `POST /api/v1/banking/accounts/transactions/export`.
- **Pagination:** client-side (`usePagination`, 10/20/50/100).
- **Sort:** headers `sortable={false}` (grid most-recent-first) — PARTIAL.
- **View Setting:** shared `useViewSetting(SCREEN_IDS.BANKING_TRANSACTION_HISTORY, DEFAULT_AREA_ID)`.
- **Export:** shared `useExcelExport()` → backend XLSX (no client-side CSV); FCY filename key
  `txn_history.export_title`.
- **Sidebar:** nested expandable parent (Current & Savings > Transaction History FCY) → per-account
  children (WOORI 2308, BIDV 2913, SHINHAN 6946); accounts sourced from
  `components/banking/transaction-history/accounts.ts` via `useTransactionHistoryAccounts("FCY")`.
- **No sync button on this screen** — sync is owned by Account Inquiry.

## Migration status

**Refactor Status: 100% Complete (full-stack).** See the backend
[refactor-gap-analysis.md](../../../../../../wecms-api/docs/features/banking/current-savings-fcy/transaction-history/refactor-gap-analysis.md)
for the line-by-line parity table and the FCY-T01 multi-currency approval. The only frontend PARTIAL
is per-column header sort (rendered `sortable={false}`), shared with the VND twin.

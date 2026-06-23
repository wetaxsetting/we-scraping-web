# Banking > Transaction History (VND) — Refactor Frontend Feature Hub

**Module:** Banking → Current & Savings (VND)
**Route:** `/banking/transaction-history` → `/banking/transaction-history/[accountId]`
**Screen ID (View Setting `screenId`):** `banking-transaction-history` (`SCREEN_IDS.BANKING_TRANSACTION_HISTORY`) — one id shared by VND + FCY
**Feature-folder slug (matches JEX + backend):** `transaction-history-vnd`
**JEX counterpart:** `fnsh_0002_001` (FCY twin `fnsh_0006_001`) — [docs/jex/features/transaction-history-vnd/](../../../../../../docs/jex/features/transaction-history-vnd/README.md)
**Backend counterpart:** [wecms-api/docs/features/banking/current-savings-vnd/transaction-history/](../../../../../../wecms-api/docs/features/banking/current-savings-vnd/transaction-history/README.md)

> **Status — Refactor complete (full-stack), with documented enhancement stubs.** The page is wired
> to the live backend (no mock fallback): per-account list + summary, date-range / type /
> confirmation-status / keyword filtering, the confirm / undo workflow, the four classification
> pickers (Reporting Account · Purpose · VAS · Contact), client-side pagination, View Setting column
> visibility/order, and XLSX export are all implemented. Legacy parity verified; SIT/UAT completed.
> Two enhancement items remain **PARTIAL** (see [backend gap analysis](../../../../../../wecms-api/docs/features/banking/current-savings-vnd/transaction-history/refactor-gap-analysis.md)):
> per-column header sort is rendered `sortable={false}` (grid is most-recent-first by default), and
> five export columns are backend value-stubs. Neither blocks the core flow.
>
> This folder is the **primary frontend documentation home**. The older single-file spec at
> [current-savings-vnd/transaction-history.md](../transaction-history/legacy-spec.md) predates
> this folder and carries a **stale** "frontend ~25% (list only)" status line — it is preserved and
> cross-linked but superseded by this folder. (The wecms-web CLAUDE.md Feature-Status table also still
> labels `/banking/transaction-history` a "Placeholder" — that line predates the full wiring and is
> stale; flagged as a CLAUDE.md follow-up.)

VND and FCY share **one** client wrapper + **one** page component, differing only by a `scope` prop
and route; this hub documents the VND screen.

---

## Document map (this folder)

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | User journeys + interaction flows (enter via sidebar/account-inquiry, filter, confirm, classify, paginate, export). |
| [ui-specification.md](ui-specification.md) | Layout (two-column header), filters, grid columns, row tinting, loading/empty/error states, detail surface. |
| [component-index.md](component-index.md) | Route, client wrapper, presentation, table, registry, hooks, API client, types — file-by-file. |
| [api-consumption.md](api-consumption.md) | Endpoints consumed, request params, response shapes, wire → in-memory mapping. |
| [test-scenarios.md](test-scenarios.md) | Frontend SIT/UAT scenarios. |

## Companion references (preserved — cross-linked)

| Doc | Location |
|---|---|
| Original frontend page spec (stale status) | [current-savings-vnd/transaction-history.md](../transaction-history/legacy-spec.md) |
| Account Inquiry (VND) — upstream entry screen + sync owner | [banking/account-inquiry-vnd/README.md](../account-inquiry/README.md) |
| Smart Organizer (matching hand-off) | [current-savings-vnd/smart-organizer.md](../../smart-organizer/README.md) |
| Page mapping (JEX `_view.jsp` → route) | [references/page-mapping/page-mapping.md](../../../../references/page-mapping/page-mapping.md) |
| Backend feature hub | [wecms-api/docs/features/banking/current-savings-vnd/transaction-history/](../../../../../../wecms-api/docs/features/banking/current-savings-vnd/transaction-history/README.md) |
| Backend interface spec (endpoints) | [wecms-api/docs/features/banking/current-savings-vnd/transaction-history/interface-specification.md](../../../../../../wecms-api/docs/features/banking/current-savings-vnd/transaction-history/interface-specification.md) |
| JEX functional spec (source of truth) | [docs/jex/features/transaction-history-vnd/](../../../../../../docs/jex/features/transaction-history-vnd/README.md) |

---

## Quick facts

- **Route files:** `app/(dashboard)/banking/transaction-history/page.tsx` →
  `<TransactionHistoryIndexRedirect scope="VND" />` (redirects to the first account);
  `app/(dashboard)/banking/transaction-history/[accountId]/page.tsx` →
  `<TransactionHistoryClient acctSeqNo={accountId} scope="VND" />`.
- **Shared shell:** `TransactionHistoryClient` (state/fetch) + `TransactionHistoryPage`
  (presentation) — both also serve the FCY twin via `scope="FCY"`.
- **API:** `GET /api/v1/banking/accounts/{acctSeqNo}/transactions` (list) ·
  `.../transactions/summary` (tab counts + totals) · `PUT/DELETE .../{trnsSeqNo}/confirm` ·
  `PATCH/DELETE .../{reporting-account|purpose|vas-account|contact}` ·
  `POST /api/v1/banking/accounts/transactions/export`.
- **Pagination:** client-side (`usePagination`, 10/20/50/100).
- **Sort:** seed-ready, not yet wired (headers `sortable={false}`) — PARTIAL.
- **View Setting:** shared `useViewSetting(SCREEN_IDS.BANKING_TRANSACTION_HISTORY, DEFAULT_AREA_ID)`.
- **Export:** shared `useExcelExport()` → backend XLSX (no client-side CSV).
- **Sidebar:** nested expandable parent (Current & Savings > Transaction History) → per-account
  children; accounts sourced from `components/banking/transaction-history/accounts.ts`.

## Migration status

**Refactor Status: Core feature complete (full-stack); 2 enhancement items PARTIAL.** See the backend
[refactor-gap-analysis.md](../../../../../../wecms-api/docs/features/banking/current-savings-vnd/transaction-history/refactor-gap-analysis.md)
for the line-by-line parity table.

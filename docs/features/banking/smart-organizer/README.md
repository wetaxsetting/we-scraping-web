# Banking > Smart Organizer — Refactor Frontend Feature Hub

**Module:** Banking → Current & Savings (VND **and** FCY — one page, both currencies)
**Route:** `/banking/smart-organizer?account={bankCd}_{acctNo}`
**Screen ID (View Setting `screenId`):** `smart-organizer`
**Feature-folder slug (matches JEX + backend):** `smart-organizer`
**JEX counterpart:** `fnsh_0200_001` (page) + `fnsh_0200_002` (Organizer Settings popup) — [docs/jex/features/smart-organizer/](../../../../../docs/jex/features/smart-organizer/README.md)
**Backend counterpart:** [wecms-api/docs/features/banking/smart-organizer/](../../../../../wecms-api/docs/features/banking/smart-organizer/README.md)

> **Status — Refactor complete (full-stack).** The page is wired to the live backend (no mock
> fallback): account-scoped eligibility list, date-range + keyword search, whitelisted column sort,
> client-side pagination, per-row + select-all selection, bulk confirm, and the Organizer Settings rule
> CRUD dialog. VND and FCY run through the **same** page — amounts are formatted by the account's real
> currency (`ccy_cd`), so there is **no** currency dropdown and no FCY-specific route. Legacy parity
> verified against `fnsh_0200_001`/`fnsh_0200_002`; SIT/UAT completed. See the backend
> [refactor-gap-analysis.md](../../../../../wecms-api/docs/features/banking/smart-organizer/refactor-gap-analysis.md).
>
> This folder is the **primary frontend documentation home**. The older single-file specs at
> [current-savings-vnd/smart-organizer.md](../current-savings-vnd/smart-organizer.md) and
> [current-savings-fcy/smart-organizer.md](../current-savings-fcy/smart-organizer.md) predate this
> folder, carry stale "proposed/Needs Confirmation" status, and are preserved + cross-linked but
> superseded by it.

> **Two distinct dialogs share the "Smart Organizer" name — do not confuse them.**
> (1) **Organizer Settings** (`OrganizerSettingsDialog`) — the rule-CRUD popup launched from this page,
> mapping to legacy `fnsh_0200_002`. (2) **Smart Organizer (payment match)** (`SmartOrganizerDialog`,
> in `components/banking/transaction-history/`) — a *different* feature that matches a single bank
> transaction to a scheduled payment (legacy `comm_0196_001`), launched from the Transaction History
> grid. This hub documents (1) and the eligibility page; (2) is cross-referenced in
> [component-index.md](component-index.md).

---

## Document map (this folder)

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | User journeys — enter from Transaction History toolbar with `?account=`, search/filter, review, edit classification, select, confirm; open Organizer Settings → add/edit/delete/reorder rules. |
| [ui-specification.md](ui-specification.md) | Layout (header + filter row + two-section grid + selection footer + pagination), filters, grid columns, currency display, selection, empty/loading states, the settings dialog. |
| [component-index.md](component-index.md) | Route, page component, settings dialog, launch button, hooks, API client, types — file by file. |
| [api-consumption.md](api-consumption.md) | Endpoints consumed, request params, response shapes, wire → in-memory mapping. |
| [test-scenarios.md](test-scenarios.md) | Frontend SIT/UAT scenarios (search, matching display, classification, confirm, security, VND/FCY, errors). |

## Companion references (preserved — cross-linked)

| Doc | Location |
|---|---|
| Older single-file frontend spec (VND) | [current-savings-vnd/smart-organizer.md](../current-savings-vnd/smart-organizer.md) |
| Older single-file frontend spec (FCY, proposed) | [current-savings-fcy/smart-organizer.md](../current-savings-fcy/smart-organizer.md) |
| Transaction History (launch screen) | [transaction-history-vnd/README.md](../transaction-history-vnd/README.md) · [transaction-history-fcy/README.md](../transaction-history-fcy/README.md) |
| Page mapping (JEX `_view.jsp` → route) | [references/page-mapping/page-mapping.md](../../../references/page-mapping/page-mapping.md) |
| **Backend feature hub** | [wecms-api/docs/features/banking/smart-organizer/](../../../../../wecms-api/docs/features/banking/smart-organizer/README.md) |
| **Backend interface spec (endpoints)** | [wecms-api/docs/features/banking/smart-organizer/interface-specification.md](../../../../../wecms-api/docs/features/banking/smart-organizer/interface-specification.md) |
| **Legacy ↔ refactor parity audit** | [docs/jex/audits/smart-organizer-parity-audit.md](../../../../../docs/jex/audits/smart-organizer-parity-audit.md) |
| JEX functional spec (source of truth) | [docs/jex/features/smart-organizer/](../../../../../docs/jex/features/smart-organizer/README.md) |

---

## Quick facts

- **Route file:** `app/(dashboard)/banking/smart-organizer/page.tsx` → `<SmartOrganizerPage />`
  (`metadata.title = "Smart Organizer — WeCMS"`).
- **Account context:** read from `?account={bankCd}_{acctNo}` (client-side, prerender-safe). Missing /
  malformed → empty state, no fetch (R11 — never tenant-wide).
- **Currency:** no in-page currency dropdown; `formatAmount(value, ccy_cd, true)` formats by the
  account's currency (R06) — `₫` / `$` / `₩`.
- **API:** `GET /api/v1/banking/smart-organizer/eligible` (list) · `POST …/confirm` (bulk confirm) ·
  `GET/POST/PUT/DELETE …/rules` + `POST …/rules/reorder` (Organizer Settings).
- **Pagination:** client-side (`usePagination`, 10/20/50/100, default 10).
- **Sort:** header sort via `useTableSort` against the backend whitelist (`TRSC_DT`, `ACCT_NO`,
  `IN_AMT`, `OUT_AMT`, `RMRK`, `CHART_ACCT_CD`, `USE_USAG_CD`).
- **Selection:** `Set<acct_seq_no>`; per-row + select-all; a selection footer shows Cancel / Save(count).
- **i18n:** `smart_organizer_page.*` (page), `organizer_settings.*` (dialog),
  `txn_history.smart_organizer` (launch button).

## Migration status

**Refactor Status: 100% Complete (full-stack).** See the backend
[refactor-gap-analysis.md](../../../../../wecms-api/docs/features/banking/smart-organizer/refactor-gap-analysis.md)
for the parity table and R01/R03/R05/R06/R07/R11 verification. The one frontend residual is the rule
drag-reorder save (the `reorderOrganizerRules` client + backend endpoint exist; drag-save wiring in
`OrganizerSettingsDialog` is deferred).

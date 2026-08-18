# Daily Cash — Frontend Feature Package (Next.js)

**Status: CURRENT** — documents shipped frontend behaviour. Per-screen wiring detail is in the tables below. Vocabulary: [../../../../README.md § Status vocabulary](../../../../README.md#status-vocabulary).

> **Scope of this folder.** Frontend (Next.js / `wecms-web`) design documentation for the **Daily Cash**
> report. Every statement is backed by reading the actual component tree under
> `components/banking/reports/daily-cash/` plus `app/(dashboard)/banking/reports/daily-cash/`,
> `lib/api/banking.ts`, and `lib/dailyCashExport.ts`. The backend counterpart (legacy spec, DB mapping,
> REST contract, parity) lives at
> [`wecms-api/docs/features/banking/reports/daily-cash/`](../../../../../../wecms-api/docs/features/banking/reports/daily-cash/).
>
> **Created 2026-06-04** during the Daily Cash documentation consolidation. Replaces the thin stub at
> [`../daily-cash.md`](legacy-spec.md) (kept as a short pointer).

| Field | Value |
|---|---|
| Feature slug | `daily-cash` |
| Module | Banking → Reports |
| Route | `/banking/reports/daily-cash` (`(dashboard)` group) |
| Page file | `app/(dashboard)/banking/reports/daily-cash/page.tsx` (server component) |
| Client root | `components/banking/reports/daily-cash/DailyCashClient.tsx` |
| Presentation | `components/banking/reports/daily-cash/DailyCashPage.tsx` |
| Backend endpoint consumed | `GET /api/v1/banking/reports/daily-cash-report` |
| Export | `lib/dailyCashExport.ts` (frontend `xlsx-js-style` + print iframe) |
| View Setting | **Not adopted** (report page — no toolbar list-icon) |
| i18n prefix | `report.daily_cash.*` |
| Status | **Functionally complete & API-wired** (mock seed removed; API is single source of truth) |

---

## Documents in this package

| File | Purpose |
|---|---|
| [README.md](README.md) | This file — identity, index, status. |
| [screen-flow.md](screen-flow.md) | Page load → search → render → export flow; empty/loading/zero-data states. |
| [ui-specification.md](ui-specification.md) | Filter row, per-currency summary block, the two account grids (8 columns), alignment, empty state, removed Cash table & checkbox. |
| [component-index.md](component-index.md) | Every file: page, client, presentation, shared components, types, mappers, export helper — with what each owns. |
| [api-consumption.md](api-consumption.md) | The fetcher, endpoint, query params, wire→view mapping, currency-scope mapping, dead legacy fetcher. |
| [test-scenarios.md](test-scenarios.md) | SIT/UAT scenarios: load, search-by-date, summary, current/savings data, multi-currency, zero-data, export, permissions. |

---

## Related documents

- Backend package: [`wecms-api/docs/features/banking/reports/daily-cash/`](../../../../../../wecms-api/docs/features/banking/reports/daily-cash/) — legacy spec, DB mapping, REST contract, parity.
- [`../daily-cash.md`](legacy-spec.md) — one-line page-mapping stub (retained pointer).
- [`../README.md`](../README.md) — Banking → Reports frontend group index.
- Page mapping: [`../../../references/page-mapping/page-mapping.md`](../../../../references/page-mapping/page-mapping.md) (`reports/daily-cash` row).
- Deprecated origin: workspace-root [`docs/features/daily-cash/`](../../../../../../docs/features/daily-cash/) (read-only legacy).
- Typography / tokens: workspace [`CLAUDE.md`](../../../../../../CLAUDE.md) §"Global Typography".

---

## At a glance

- **One screen, one client component.** `page.tsx` (server) sets metadata and renders `<DailyCashClient />`;
  the client owns filter state + the keyed fetch; `DailyCashPage` is pure presentation.
- **Search-then-fetch.** The page boots empty; data loads only after the user clicks **Search**. After the
  first search, changing the **Currency scope** auto-refetches.
- **Per-currency summary**, not a flat Debit/Credit/Balance triple — each currency renders a
  *Total* heading with a two-column Current / Saving table.
- **Two ledgers** — Current Accounts (`acct_type_cd` 03/04) and Savings Accounts (05/06), each with the
  same 8 columns and **no checkbox column**.
- **Cash table removed** (Redmine #42096); some dead types/mock/legacy-fetcher remain (see
  [component-index.md](component-index.md) §"Dead/orphaned code").

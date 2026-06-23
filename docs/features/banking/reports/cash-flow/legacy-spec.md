# Banking > Cash Flow — Frontend Page (pointer)

**Module:** Banking → Reports · **Menu:** Cash Flow
**Route:** `/banking/reports/cash-flow` · **View Setting screenId:** `cash-flow-report`
**JEX twin:** `cash_0001_001` · **Status:** complete & API-wired (no mock fallback)

> **This stub is superseded in detail by the full feature package** at [`cash-flow/`]() —
> created 2026-06-04 during the Cash Flow documentation consolidation. Read the package for the screen
> flow, UI spec, component index, API consumption, and FE test scenarios.

## Full package

| Doc | Scope |
|---|---|
| [cash-flow/README.md](README.md) | Identity, index, status, at-a-glance |
| [cash-flow/screen-flow.md](screen-flow.md) | Mount → search → render → export; empty/loading states; quarter column-hide |
| [cash-flow/ui-specification.md](ui-specification.md) | Filter row, hierarchical matrix, special rows, monthly columns, sticky chrome, Excel structure |
| [cash-flow/component-index.md](component-index.md) | Every file: page, client, presentation, popover, types, mappers, export |
| [cash-flow/api-consumption.md](api-consumption.md) | Endpoints, query params (no `quarter`), wire→view mapping, live-wiring confirmation |
| [cash-flow/test-scenarios.md](test-scenarios.md) | FE SIT/UAT scenarios |

Backend package: [`wecms-api/docs/features/banking/reports/cash-flow/`](../../../../../../wecms-api/docs/features/banking/reports/cash-flow/).

> **Corrections to earlier stub text:** the matrix is the inline `CashFlowMatrix` **inside**
> `CashFlowPage.tsx` (not a separate file); there are **four** source aggregations, not five
> (`EXPT_RESOL_MSTR` is the approval-status join target, not a row source); the backend is a complete
> **Java reimplementation**, not "stub seed data"; and there is no Search-gated empty placeholder — the
> matrix chrome always renders. See [cash-flow/api-consumption.md §5](api-consumption.md) for
> the stale `wecms-web/CLAUDE.md` lines.

# Page Mapping — JEX `_view.jsp` → Next.js Route

Cross-feature index of JEX view pages translated (or planned) into Next.js App Router routes in `wecms-web`.

JEX is **read-only legacy reference**. This file exists for traceability only. The "JEX URL"
column points at the **legacy JEX live system** (read-only); it is not part of this repository,
and it is **not** one of the refactor environments (the refactor runs only on SIT / dev / local).

## Verified JEX-id mappings

Rows where the legacy JEX page id is confirmed. For every other implemented route the authoritative JEX counterpart lives in that route's feature doc under [docs/features/](../../features/) — this index does not fabricate WSVC ids.

| JEX View JSP | JEX URL | Next.js Route | Layout / Group | Refactor Doc |
|---|---|---|---|---|
| `logn_0001_001_view.jsp` | `https://dev.wecms.vn/logn_0001_001.act` | `/login` | `app/(auth)/login/` | [features/auth/login-auth.md](../../features/auth/login-auth.md) |
| `fnsh_0001_001_view.jsp` | `https://dev.wecms.vn/fnsh_0001_001.act` | `/banking/account-inquiry` | `app/(dashboard)/` | [features/banking/current-savings-vnd/account-inquiry.md](../../features/banking/current-savings-vnd/account-inquiry.md) |
| `pymn_0001_001_view.jsp` | `https://dev.wecms.vn/pymn_0001_001.act` | `/payment/approval-box` | `app/(dashboard)/` | [features/payment/approval-box.md](../../features/payment/approval-box.md) |
| `fnsh_0200_001_view.jsp` | `https://dev.wecms.vn/fnsh_0200_001.act` | `/banking/smart-organizer` | `app/(dashboard)/` | [features/banking/current-savings-vnd/smart-organizer.md](../../features/banking/current-savings-vnd/smart-organizer.md) |
| `comm_0108_001_view.jsp` (popover) | embedded | View Setting popover | shared component | [features/common/view-setting.md](../../features/common/view-setting.md) |

## Implemented routes (current)

The refactor is ~90% complete; the route set below is implemented. JEX counterparts for each are recorded in the per-feature docs (the authoritative traceability source). **Settings screens are not routes** — they are modal panels under `components/settings/` (consistent with JEX popups), so they have no `/settings/*` URL.

| Module (route prefix) | Implemented routes |
|---|---|
| Auth | `/login` |
| Banking (`/banking`) | `account-inquiry`, `account-inquiry-fcy`, `credentials`, `own-account-transfer`, `smart-organizer`, `transaction-history` (+ `[accountId]`), `transaction-history-fcy` (+ `[accountId]`), `transfer-history`, `transfer-own-accounts`, `reports/cash-flow`, `reports/daily-cash`, `reports/daily-financial`, `reports/daily-financial-hs` |
| Payment (`/payment`) | `approval-box`, `corporate-card/card-transactions`, `expense-payment/{scheduled-payment,payment-result}` (+ `[id]`), `internal-transfer/{scheduled-transfer,transfer-result}` (+ `[id]`), `overseas-payment/{exchange-rate-inquiry,scheduled-payment,payment-result}` (+ `[id]`), `payroll/{scheduled-payment,payment-result}` (+ `[id]`), `vendor-payment/{scheduled-payment,payment-result}` (+ `[id]`) |
| Add-on (`/addon`) | `sales-einvoices`, `expenses-einvoices`, `operation-status` |
| Settings (modal — no route) | approval-line, bank-account, chart-of-accounts, contacts, erp-transaction-history, firm-banking-history, firm-banking-settings, login-credentials, preferences, purpose, users, vas-account — all rendered as `components/settings/*` panels inside `<SettingsModal>` |

> Add a verified row above when a new page lands with a confirmed JEX id. Keep the kebab-case slug consistent across `features/`, `migration/`, and `database/`.

## Status

The refactor is ~90% complete; the routes listed above are implemented. Per-feature status (any residual mock-data / partial-wiring caveats) lives in each route's feature doc — this index is a route map, not a per-feature status board.

## Route conventions

- Auth routes: `/login` (under the `(auth)` route group — invisible in the URL)
- App routes: under the `(dashboard)` route group with sidebar + top nav chrome
- Module prefixes are kebab-case slugs (NOT legacy JEX WSVC ids): `/banking/...`, `/payment/...`, `/addon/...`
- **Settings has no route prefix** — Settings screens are modal panels inside `<SettingsModal>`, not pages. There is no `/settings/*` URL.
- Sub-page slugs are kebab-case English (e.g. `account-inquiry`, `approval-box`)
- Post-login landing: `HOME_ROUTE = /banking/account-inquiry` — change only via [lib/routes.ts](../../../lib/routes.ts)

## API integration

Each page's API integration is documented in its own frontend doc:
- Axios fetcher path
- `lib/api/mappers.ts` translation (lowercase `snake_case` wire ↔ camelCase in-memory — per the CTO 2026-05-08 cutover; the legacy `COMMON_HEAD` / `UPPER_SNAKE` envelope is retired)
- `useApiData()` hook usage
- Error handling (`ApiCallError` carrying `status.code` from the `{ status, data }` envelope)

## Reference

> The references below are **legacy JEX source / live-system pointers** kept for traceability only.
> None of these are part of the `wecms-web` clone — the JEX source trees and the JEX live system
> are external to this repository.

- JEX view JSPs (legacy source — not in this repo): `…/WECMS/web/view/jex/wabooks/<module>/`
- JEX TypeScript (legacy source — not in this repo): `…/WECMS_STATIC/ts-src/js/jex/wabooks/<module>/`
- JEX screen flows: legacy JEX source reference only — not included in this repository.
- Legacy JEX live system (read-only; not a refactor environment): `https://dev.wecms.vn/`

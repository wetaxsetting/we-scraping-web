# Features — Frontend Design Docs (feature-first)

Per-feature / per-screen Next.js design docs for `wecms-web`, organized to mirror the **live WeCMS top menu** so developers, QA, and new team members navigate by the product they see.

## Top menu → folder

| WeCMS top menu | Folder |
|---|---|
| _(system)_ Auth | [auth/](auth/) — login-auth (cross-cutting; not a top-menu group) |
| _(system)_ Common | [common/](common/) — view-setting (cross-cutting; not a top-menu group) |
| Banking | [banking/](banking/) — current-savings-vnd · current-savings-fcy · own-account-transfer · reports · [flow-process HTML](banking/banking-web-flow-process.html) |
| Payment | [payment/](payment/) — approval-box · internal-transfer · vendor/expense/payroll/overseas payment · exchange-rate-inquiry · card-transactions |
| Add-on Service | [addon-service/](addon-service/) — sales/expenses e-invoices · operation-status-inquiry |
| Settings | [settings/](settings/) — 12 Settings-modal panels |

Each folder has a `README.md` that maps the WeCMS menu → routes → components → backend docs, and links its child pages.

## What a feature doc covers

Overview · Route/Page · Components · Filters · Table Columns · Sorting · Pagination · Dialogs/Popups · API Integration · Validation · Related API docs · Related Web docs. (Cross-cutting architecture lives under [../architecture/](../architecture/); reference material under [../references/](../references/).)

## Conventions

- Feature slugs are kebab-case and **match the JEX + backend counterpart** for traceability (see [../../CLAUDE.md](../../CLAUDE.md) for the in-repo frontend conventions; cross-tree workspace rules live outside this repo).
- Routes are slug-based (`/banking/account-inquiry`), never legacy JEX WSVC ids.
- Backend counterparts live in the separate `wecms-api` backend repo (not included in this clone).

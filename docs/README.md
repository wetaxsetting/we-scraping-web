# wecms-web — Documentation

Frontend documentation for the **Next.js 16** side of the WeCMS JEX → Spring/Next.js refactor (`wecms-web`). Local-only R&D (GitLab); a SPA inside the App Router — no SSR data fetching, no Next.js API routes. Talks only to `wecms-api` _(external reference — not included in this repository)_ over HTTP.

> ⚠️ **Next.js 16 differs from earlier versions** — read [../AGENTS.md](../AGENTS.md) before writing code.

> **Reorganized 2026-06-01 — feature-first.** Docs are now organized by the **live WeCMS menu** so developers, QA, and new team members navigate by the product they see. Per-screen design lives under [features/](features/); reference material under [references/](references/); superseded docs under [archive/](archive/).

## Where things live

| Folder / file | Contents |
|---|---|
| [features/](features/) | **Per-feature / per-screen design**, grouped by the WeCMS top menu → [banking/](features/banking/) · [payment/](features/payment/) · [addon-service/](features/addon-service/) · [settings/](features/settings/) |
| [architecture/](architecture/) | Cross-cutting frontend architecture — [routes/](architecture/routes/) · [components/](architecture/components/) · [hooks/](architecture/hooks/) · [state-management/](architecture/state-management/) · [integrations/](architecture/integrations/) · [view-setting/](architecture/view-setting/) |
| [references/](references/) | Reference material — [page-mapping/](references/page-mapping/) (JEX `_view.jsp` → Next.js route) · [screen-flows/](references/screen-flows/) · [legacy/](references/legacy/) |
| [testing/](testing/) | Frontend-side refactor test plans |
| [archive/](archive/) | Superseded / deprecated docs, preserved for traceability |
| [tech-stack.md](tech-stack.md) | Stack & versions |
| [ui-component-guide.md](ui-component-guide.md) | Component / layout architecture guide |
| [WORKFLOW.md](WORKFLOW.md) · [prd.md](prd.md) · [permissions.md](permissions.md) | Shared-doc pointers (authoritative copies at workspace root) |
| [FRONTEND_PROJECT_RULES.md](FRONTEND_PROJECT_RULES.md) | Frontend rules (pointers to [../AGENTS.md](../AGENTS.md) + [../CLAUDE.md](../CLAUDE.md)) |

## Navigate by WeCMS menu

### Banking — [features/banking/](features/banking/)

| Group | Folder |
|---|---|
| Current & Savings (VND) | [current-savings-vnd/](features/banking/current-savings-vnd/) — account-inquiry · transaction-history · smart-organizer ⚠️ |
| Current & Savings (FCY) | [current-savings-fcy/](features/banking/current-savings-fcy/) — account-inquiry · transaction-history · smart-organizer |
| Internal Transfer | [own-account-transfer/](features/banking/own-account-transfer/) — own-account-transfer · transfer-history |
| Reports | [reports/](features/banking/reports/) — daily-cash · daily-financial · cash-flow |

Smart Organizer is implemented (backend `SmartOrganizerController` + `OrganizerRuleController` + V172–V174; Next.js route `/banking/smart-organizer`).

### Payment — [features/payment/](features/payment/)

[approval-box](features/payment/approval-box.md) · [internal-transfer/](features/payment/internal-transfer/) · [vendor-payment/](features/payment/vendor-payment/) · [expense-payment/](features/payment/expense-payment/) · [payroll/](features/payment/payroll/) · [overseas-payment/](features/payment/overseas-payment/) · [exchange-rate-inquiry](features/payment/exchange-rate-inquiry.md) · [card-transactions](features/payment/card-transactions.md)

### Add-on Service — [features/addon-service/](features/addon-service/)

[sales-e-invoices](features/addon-service/sales-e-invoices.md) · [expenses-e-invoices](features/addon-service/expenses-e-invoices.md) · [operation-status-inquiry](features/addon-service/operation-status-inquiry.md)

### Settings — [features/settings/](features/settings/)

Purpose · VAS Account · Contacts · Approval Line · Chart of Accounts · Login Credentials · Bank Account · Preferences · Users · Transaction History (ERP) · Firm Banking Settings · Firm Banking History — one canonical doc each (see the [settings README](features/settings/README.md) for the doc ↔ API-side cross-links).

## Related

- Backend docs, JEX functional spec, and backend-tracked open questions live **outside this repository** (the `wecms-api` backend repo and the legacy JEX source / shared workspace docs). They are not part of the `wecms-web` clone.
- Project rules (in-repo): [../CLAUDE.md](../CLAUDE.md) + [../AGENTS.md](../AGENTS.md). Cross-tree workspace rules are maintained outside this repo.

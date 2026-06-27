# wecms-web — Documentation

Frontend documentation for the **Next.js 16** side of the WeCMS JEX → Spring/Next.js refactor (`wecms-web`). Local-only R&D (GitLab); a SPA inside the App Router — no SSR data fetching, no Next.js API routes. Talks only to `wecms-api` _(external reference — not included in this repository)_ over HTTP.

> ⚠️ **Next.js 16 differs from earlier versions** — read [../AGENTS.md](../AGENTS.md) before writing code.

> **Reorganized 2026-06-01 — feature-first.** Docs are now organized by the **live WeCMS menu** so developers, QA, and new team members navigate by the product they see. Per-screen design lives under [features/](features/); reference material under [references/](references/). *(The `archive/` folder was removed 2026-06-23 by project decision — it held only an empty placeholder.)*

> **Field-name casing (project-wide standard).** Legacy JEX APIs used UPPER_SNAKE field names. The Spring/Next.js refactor intentionally uses lowercase snake_case JSON field names via global Jackson SNAKE_CASE configuration. This is an approved modernization under CTO directive dated 2026-05-08 and is not a legacy parity gap. The frontend mirrors this: snake_case wire types in `lib/types/api.ts`, camelCase in-memory after `lib/api/mappers.ts`. Source-verified inventory (backend + frontend): `wecms-api/docs/audits/field-casing-parity-audit-2026-06-06.md`.

## Start Here

> **You do not need JEX knowledge to begin development.** This is a **Next.js 16** codebase —
> start from the rules, the feature docs, and the code. JEX is **historical / functional reference only**
> (it tells you *what* a screen must do); you consult it only when porting a screen.
>
> **Source-of-truth split:** JEX is the **functional / behavioral** source of truth (*what* the screen does);
> the **Next.js code is the implementation source of truth** (*how* it is built). Build from the Next.js code,
> never from JEX.

**New to this frontend? Read in this order.** All documentation is in **English**. WeCMS is a refactor of the
legacy **JEX** system, so a few business terms are Korean (결재라인 → *approval line*, 사용용도 → *purpose*);
unfamiliar JEX/Korean terms are explained in the backend glossary (linked below) — you never have to read JEX
itself to get started. This guide is for new joiners, including developers in **Cambodia** and **Vietnam**.

1. **[../AGENTS.md](../AGENTS.md)** — ⚠️ Next.js 16 differs from earlier versions; read this first.
2. **[../CLAUDE.md](../CLAUDE.md)** + **[FRONTEND_PROJECT_RULES.md](FRONTEND_PROJECT_RULES.md)** — the frontend rules (components, tokens, dialogs, naming).
3. **[tech-stack.md](tech-stack.md)** — stack & versions · **[ui-component-guide.md](ui-component-guide.md)** — component/layout architecture.
4. **[README.md](README.md)** — *(this file)* — how the docs are organized.
5. **Feature/screen design** — open the screen you're working on: `features/<module>/<screen>/README.md`
   (e.g. [features/settings/contacts/README.md](features/settings/contacts/README.md)). Each screen folder has the
   same 6-doc set (README · screen-flow · ui-specification · component-index · api-consumption · test-scenarios).
6. **`screen-flow.md`** then **`ui-specification.md`** — the UX flow and the visual/layout spec.
7. **`api-consumption.md`** — which `wecms-api` endpoints the screen calls and how the wire data maps to UI state.
8. **Backend contract + parity history** — the API spec and audits live in the `wecms-api` repo
   (`wecms-api/docs/features/<…>` + the **audits index** `wecms-api/docs/audits/README.md`), and the term
   **glossary** is `wecms-api/docs/glossary.md`.

**Also useful:** [WORKFLOW.md](WORKFLOW.md) (dev flow) · [permissions.md](permissions.md) (roles) · [prd.md](prd.md) (product scope) · [tech-debt.md](tech-debt.md) (knowingly-deferred pre-existing issues).

## Where things live

| Folder / file | Contents |
|---|---|
| [features/](features/) | **Per-feature / per-screen design**, grouped by the WeCMS top menu → [banking/](features/banking/) · [payment/](features/payment/) · [addon-service/](features/addon-service/) · [settings/](features/settings/) |
| [architecture/](architecture/) | Cross-cutting frontend architecture — [routes/](architecture/routes/) · [components/](architecture/components/) · [hooks/](architecture/hooks/) · [state-management/](architecture/state-management/) · [integrations/](architecture/integrations/) · [view-setting/](architecture/view-setting/) |
| [references/](references/) | Reference material — [page-mapping/](references/page-mapping/) (JEX `_view.jsp` → Next.js route) · [screen-flows/](references/screen-flows/) · [legacy/](references/legacy/) |
| [testing/](testing/) | Frontend-side refactor test plans |
| [bug-reports/](bug-reports/) · [change-log/](change-log/) | Shared-pointer folders (cross-system) |
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
| Internal Transfer | [own-account-transfer/](./features/banking/internal-transfer-vnd/own-account-transfer) — own-account-transfer · transfer-history |
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

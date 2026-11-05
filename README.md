# WeInvoice Web

Next.js frontend for **WeInvoice** — an e-invoice hub in the WeCMS family (Webcash Global). It
gathers a customer's purchase / sales e-invoices from the GDT portal (list + XML), issuing
providers' lookup pages (original PDF), email and manual upload, de-duplicates them across
channels, and offers search, tags, ZIP download, pre-filing checks, supplier risk, taxpayer lookup,
filed tax returns and auto-journal (TT200 / TT133). UI in VI / EN / KO.

> **P1 status (2026-11-03): static UI on mock data.** Every P1 screen of the *WeInvoice UI Spec
> v1.0* is implemented. Login calls the real backend; the invoice data is still mock until the
> WeInvoice API contract is published. Do **not** deploy this
> build as a product. Details and open items:
> [docs/features/weinvoice/weinvoice-p1-ui-transformation-2026-11-03.md](docs/features/weinvoice/weinvoice-p1-ui-transformation-2026-11-03.md).

> ⚠️ **This is Next.js 16.** APIs, conventions, and file structure differ from earlier versions —
> read [AGENTS.md](AGENTS.md) before writing any code.

This repository previously held the WeCMS frontend (`wecms-web`); that code and its documentation
were removed on 2026-11-03 and remain available in git history.

## Tech Stack

Next.js 16.2 (App Router) · React 19 · TypeScript 5 (strict) · Tailwind CSS 4 (tokens in
`app/globals.css`, no `tailwind.config.js`) · shadcn/ui primitives in `components/ui/` ·
lucide-react · Vitest + Testing Library · `jszip` (ZIP upload / download).

## Prerequisites

| Need | Detail |
|---|---|
| **Node.js 22.x** | `>=22 <23` is enforced by `engines`; `.nvmrc` says `22`. |
| **npm** | The lock file is `package-lock.json` — do not switch to yarn/pnpm. |

No backend, database or Docker is needed for P1.

## Getting Started

```bash
npm ci
npm run dev        # http://localhost:3000
```

`/` redirects to `/dashboard`; unauthenticated requests go to `/login`. Demo account:
an account of the backend at `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8080`; copy
`.env.example` to `.env.local`). The backend must list `http://localhost:3000` in
`WECMS_CORS_ALLOWED_ORIGINS`. Invoice data is mock, generated in memory, and resets on every reload.

## Available Scripts

| Script | Does |
|---|---|
| `npm run dev` | Next dev server (Turbopack) |
| `npm run build` / `npm run start` | Production build / serve it |
| `npm run lint` | ESLint (flat config) |
| `npm test` | `vitest run` — collects `components/**` and `lib/**` tests only |

## Project Structure

```
app/(auth)/login              login page (POST /api/v1/auth/login, company chooser)
app/(dashboard)/<module>/…    one thin page per route; shared AppShell layout
components/layout             AppShell · Header (module tabs, working-MST switcher, language) · Sidebar · CommandPalette
components/<module>           screen UI: invoices, dashboard, connections, upload, sync, tax, checks, tools, settings, soon
components/shared · ui        shared primitives (dialog, Modal, Button, Select, Popover, Pagination, …)
lib/weinvoice                 domain: types, nav map, formatters, provider catalogue (138), XML parser
lib/api/weinvoice             data access — MOCK today (store.ts + mockData.ts); swap for REST later
lib/i18n · locales            in-house i18n, VI default, EN / KO
proxy.ts                      edge auth gate (presence cookie)
```

Module documentation: [docs/features/weinvoice/README.md](docs/features/weinvoice/README.md).

## Testing

```bash
npm test
npx vitest run lib/api/weinvoice      # targeted
```

Inventory and conventions: [docs/testing/testing-strategy.md](docs/testing/testing-strategy.md).
Manual scenarios: [docs/features/weinvoice/test-scenarios.md](docs/features/weinvoice/test-scenarios.md).

## Deployment

Deployment is managed outside this repository: [.gitlab-ci.yml](.gitlab-ci.yml) triggers a
downstream pipeline on pushes to `sit` / `uat`. **A push to those branches is a deployment** — and
this P1 build has no backend. Git and deployment steps are manual (CLAUDE.md §15).

## Documentation

- [docs/README.md](docs/README.md) — documentation index, docs-first workflow, status vocabulary
- [CLAUDE.md](CLAUDE.md) — project rules
- [docs/tech-debt.md](docs/tech-debt.md) — known deferred issues

## Contributing

- Read [AGENTS.md](AGENTS.md), then [CLAUDE.md](CLAUDE.md).
- Reuse before creating: `components/ui/` → `components/layout/` → `components/shared/` → the module folder.
- Use the `text-wb-*` tokens; no `text-[Npx]` or inline font styles.
- All user-visible text goes through `t(…)` with keys in `locales/vi.json`, `en.json`, `ko.json`.
- Run `npm run lint`, `npx tsc --noEmit`, `npm test` before opening an MR — CI runs none of them.

## License

**Proprietary — internal project of Webcash Global.** No open-source license is granted or implied.

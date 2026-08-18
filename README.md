# WeCMS Web

Next.js frontend for **WeCMS** (WebCash Management System) — the enterprise cash-management
platform by Webcash Global for mid/large companies in Vietnam and Southeast Asia (integrated
bank / tax / ERP / card / e-invoice connections, real-time cash-flow monitoring, role-based
approval workflows, multi-tenant, multi-language EN/KO/VI).

`wecms-web` is the **frontend half of the JEX → Spring Boot + Next.js refactor**. It renders every
screen and owns no business logic of its own: all business data comes from the
[`wecms-api`](#related-repository) Spring Boot backend over HTTP.

```text
Browser ──▶ Next.js App Router (this repo)
              │  proxy.ts        server-side auth gate (wecms_token cookie)
              │  lib/axios.ts    shared Axios instance + JWT interceptor
              ▼
           wecms-api  ──▶  PostgreSQL / bank / tax / ERP integrations
```

This is a **client-rendered SPA inside the App Router**: no SSR data fetching and no server actions
anywhere in the tree. The app persists only lightweight client state (auth token, profile, locale,
saved ID) in `localStorage`. One Next.js route handler exists in source and is **not** on the
runtime path — see [Application Architecture](#application-architecture).

> ⚠️ **This is Next.js 16.** APIs, conventions, and file structure differ from earlier versions —
> read [AGENTS.md](AGENTS.md) before writing any code.

> **You do not need JEX knowledge to start.** JEX is the legacy *functional* reference only; the
> Next.js + Spring Boot code is the implementation source of truth.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.2.3** (App Router) |
| UI runtime | **React 19.2.4** + `react-dom` 19.2.4 |
| Language | **TypeScript 5** (`strict: true`), path alias `@/*` → `./*` |
| Node | **22.x** — `package.json` declares `"engines": { "node": ">=22 <23" }`; `.nvmrc` pins `22` |
| Package manager | **npm** (`package-lock.json`) |
| Styling | **Tailwind CSS 4.2.4** via `@tailwindcss/postcss` — **no `tailwind.config.js`**; tokens live in `app/globals.css` under `@theme inline` |
| UI primitives | **shadcn/ui** copied into `components/ui/` (style `new-york`, base `neutral`, CSS variables — see [components.json](components.json)), on Radix (`dialog`, `checkbox`, `label`, `slot`) |
| Icons | `lucide-react` 1.8 + project SVGs under `public/assets/` |
| HTTP | **Axios 1.15** with a JWT request interceptor ([lib/axios.ts](lib/axios.ts)) |
| Forms | **React Hook Form 7.73** + **Zod 4.3** (`@hookform/resolvers`) |
| Fonts | `next/font/google` — **Inter + Noto Sans KR** (no other family) |
| i18n | In-house provider ([lib/i18n/](lib/i18n/)) — EN / KO / VI |
| Spreadsheets | `xlsx` 0.18 + `xlsx-js-style` — **upload parsing only**; exports are produced by `wecms-api` |
| PDF / capture | `jspdf` 4.2 · `html2canvas-pro` 2.2 · `qrcode-generator` 2.0 |
| Lint | **ESLint 9** + `eslint-config-next` 16.2.3 (flat config, [eslint.config.mjs](eslint.config.mjs)) |
| Tests | **Vitest 2.1** (jsdom) + `@testing-library/react` 16 + `jest-dom` ([vitest.config.ts](vitest.config.ts)) |

**Not used — do not introduce:** NextAuth, next-intl, react-i18next, Redux, Zustand, react-query,
SWR, Bootstrap, Material UI, Chakra, Heroicons, a second font family, or a frontend XLSX **writer**
on an export path.

## Prerequisites

| Need | Detail |
|---|---|
| **Node.js 22.x** | `>=22 <23` is enforced by `engines`; Node 23+ is deliberately excluded. `.nvmrc` says `22`, so `nvm use` picks the right line. Verify with `node -v`. |
| **npm** | Ships with Node. The lock file is `package-lock.json` — do not switch to yarn/pnpm. |
| **A running `wecms-api`** | Required for anything past `/login`. See [API Integration](#api-integration). |

No database and no Docker are needed — this repository contains neither.

## Getting Started

```bash
# 1. Clone
git clone https://git.kosign.dev/wecms/wecms-web.git

# 2. Enter the project
cd wecms-web

# 3. Install dependencies (lock-file exact install)
npm ci          # or: npm install

# 4. Configure environment
cp .env.example .env.local
#    then point NEXT_PUBLIC_API_BASE_URL at your running backend if it is not localhost:8080

# 5. Start the dev server
npm run dev

# 6. Verify — open http://localhost:3000
#    "/" redirects to /login; after login the landing route is /banking/account-inquiry
```

The same commands work on Windows (PowerShell or Git Bash); use `copy .env.example .env.local`
instead of `cp` in `cmd`.

> **The backend must be reachable.** Authentication is gated **server-side** in
> [proxy.ts](proxy.ts), and the dashboard layout calls `GET /api/v1/auth/me` on mount — so without a
> reachable `wecms-api` you cannot get past `/login`. There is **no query-string preview bypass**:
> the former client-side guard and its `?preview=1` escape hatch were removed deliberately (the
> guard was defeatable by disabling JS and the bypass was a real security hole — the rationale is in
> [proxy.ts](proxy.ts)'s own header).

## Environment Configuration

Both variables are `NEXT_PUBLIC_*`, so they are **inlined into the client bundle at `next build`
time and are public**. Never put a secret behind that prefix.

| Variable | Required | Description | Example |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | No — falls back to `http://localhost:8080` in [lib/axios.ts](lib/axios.ts) | Origin of the `wecms-api` backend the **browser** calls | `http://localhost:8080` |
| `NEXT_PUBLIC_NXISAS_DEBUG` | No — anything other than `"true"` leaves logging off | Enables masked NXiSAS scraping debug traces ([lib/nxisas/nxisas-debug.ts](lib/nxisas/nxisas-debug.ts)) | `false` |

Set them locally in a **gitignored `.env.local`** (`.gitignore` ignores `.env*` and un-ignores only
`.env.example`). Committed reference templates: [.env.example](.env.example) (local) and
[.env.uat.example](.env.uat.example) (UAT).

> **Next.js does not read a file called `.env.uat`.** On the UAT server the value goes into
> `.env.production` (what `next build` reads) or is exported in the build step.
> [.env.uat.example](.env.uat.example) documents the intended value — it is not a file Next.js loads.

**Never point `NEXT_PUBLIC_API_BASE_URL` at `dev.wecms.vn`, `test.wecms.vn`, or `www.wecms.vn`** —
those are the **live JEX system**, a different application that does not serve this REST contract.
The refactor's UAT backend is the separate host `https://test2-api.wecms.vn`.

**Dev-server config.** [next.config.ts](next.config.ts) sets `allowedDevOrigins:
["sample.coocon.co.kr"]` so HMR keeps working when a developer drives the local NXiSAS engine from a
licensed Coocon domain alias mapped to `127.0.0.1`. It is dev-only and does not weaken the
production build. Add your own licensed alias there if you use a different one.

## Running Locally

```bash
npm run dev     # http://localhost:3000  (Next.js default port)
```

Port 3000 is the Next.js default — this repository does not override it. To use another port,
`npm run dev -- -p 3001`.

### Running Web + API together

1. Start `wecms-api` on `:8080` (`./gradlew bootRun --args='--spring.profiles.active=local'`).
2. Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080` in this repo's `.env.local`.
3. `npm run dev` here, then open http://localhost:3000.

CORS is already configured on the backend side — its `.env.local.example` ships
`http://localhost:3000` in `WECMS_CORS_ALLOWED_ORIGINS`.

## Available Scripts

These five are the **only** scripts in [package.json](package.json):

```bash
npm run dev      # next dev   — dev server with HMR (http://localhost:3000)
npm run build    # next build — production build
npm run start    # next start — serve the production build
npm run lint     # eslint
npm test         # vitest run — single pass, jsdom
```

There is no `test:watch`, `test:coverage`, `typecheck`, or `format` script. For a watch loop run
`npx vitest`; for a type check run `npx tsc --noEmit`.

> ⚠️ **Nothing in CI runs lint, type-check, or tests** — [.gitlab-ci.yml](.gitlab-ci.yml) is a
> trigger only (see [Deployment](#deployment)). Running these locally before opening an MR is a
> manual responsibility.

## Project Structure

```text
wecms-web/
├── app/                          # Next.js App Router
│   ├── layout.tsx                #   fonts + <LocaleProvider><DialogProvider>
│   ├── globals.css               #   Tailwind 4 import + all design tokens (@theme inline)
│   ├── page.tsx                  #   redirects to /login
│   ├── (auth)/login/             #   login screen (route group — not in the URL)
│   ├── (dashboard)/              #   42 authenticated screens
│   │   ├── layout.tsx            #     session rehydrate + menu authorization + <AppShell>
│   │   ├── banking/              #     accounts, transactions, transfers, 4 reports, organizer
│   │   ├── payment/              #     5 payment modules + approval box + cards + FX
│   │   └── addon/                #     e-invoices, operation status
│   ├── api/                      #   one superseded route handler — see Application Architecture
│   └── memo-preview/             #   public static-UI preview (mock data only)
├── components/
│   ├── ui/                       # shadcn primitives (editable source)
│   ├── layout/                   # AppShell, Header, Sidebar, ProfileMenu
│   ├── shared/                   # cross-feature: PageHeader, DataTableShell, Pagination,
│   │                             #   dialogs, view-setting, excel-upload, filters
│   ├── banking/ payment/ addon/  # per-feature components
│   └── settings/                 # Settings panels (rendered in a modal, not routes)
├── hooks/                        # cross-feature hooks (useNavigation, useTableSort,
│                                 #   useExcelExport, useServerPagination, …)
├── lib/
│   ├── axios.ts                  # the single Axios instance + JWT interceptor
│   ├── api/                      # 33 per-domain API clients + mappers + common/unwrap()
│   ├── auth/                     # login/logout/fetchMe + token & user storage
│   ├── i18n/                     # in-house LocaleProvider + useTranslation
│   ├── types/api.ts              # snake_case wire types
│   ├── routes.ts                 # route constants
│   └── currency.ts datetime.ts excel.ts print.ts pdf.ts utils.ts …
├── locales/                      # en.json · ko.json · vi.json (flat dotted keys)
├── public/                       # assets/, images/, templates/ (ungated by design)
├── proxy.ts                      # Next.js 16 middleware convention — the auth gate
├── next.config.ts tsconfig.json eslint.config.mjs vitest.config.ts components.json
└── docs/                         # frontend documentation root — see docs/README.md
```

Route groups `(auth)` and `(dashboard)` are Next.js parenthesis grouping — they do **not** appear in
the URL. **Settings is a modal** (`<SettingsModal>`), not a route.

## Application Architecture

```text
Browser
  │
  ├─ proxy.ts                        server-side, runs before every non-static request.
  │                                  Public prefixes (/login, /memo-preview) pass through;
  │                                  otherwise a missing `wecms_token` cookie redirects to
  │                                  /login?next=<intended-url>.
  ▼
app/(dashboard)/layout.tsx           NOT a route guard any more — the edge already gated it.
  │                                  It rehydrates the user via GET /api/v1/auth/me, applies the
  │                                  menu-authorization route check, and mounts <AppShell>.
  ▼
Page (thin)  ──▶  Feature component  ──▶  hook  ──▶  lib/api/<domain>.ts
                                                        │
                                                        ▼
                                              lib/axios.ts  (baseURL = NEXT_PUBLIC_API_BASE_URL,
                                                             Authorization: Bearer <jwt>)
                                                        │
                                                        ▼
                                                    wecms-api
```

**Client-rendered by design.** `"use server"` appears nowhere in the tree; there is no SSR data
fetching and no server action. Only `app/layout.tsx`, `app/page.tsx`, and page-level metadata files
are server components.

**One route handler exists and is not on the runtime path.**
[`POST app/api/v1/payment/overseas-payment/excel-preview/route.ts`](app/api/v1/payment/overseas-payment/excel-preview/route.ts)
parses an uploaded overseas-payment XLSX. Its only would-be caller,
`previewOverseasPaymentExcel()` in [lib/api/payment.ts](lib/api/payment.ts), posts the identical
path through the shared Axios instance — so the request goes to the **`wecms-api` origin, not to
Next.js** — and then unwraps the `ApiResponse<T>` envelope, which this handler does not emit. Treat
it as a superseded local prototype. **`wecms-web` is not a backend and must not become one — new
endpoints belong in `wecms-api`.**

**Design system.** All typography, spacing, and color come from tokens declared in
`app/globals.css` under `@theme inline` and consumed as Tailwind classes. Arbitrary values
(`text-[14.5px]`, `font-[533]`, inline `style={{ fontFamily }}`) are not allowed — extend the token
list first. Shared UI concerns (page header, tables, pagination, dialogs, filters, view setting,
Excel upload) are implemented **once** in `components/shared/` and composed via props.

Full detail: [docs/architecture/](docs/architecture/) · [CLAUDE.md](CLAUDE.md).

## API Integration

The **in-repo** contract document is
[docs/references/api-contract.md](docs/references/api-contract.md) — read it for the consumption
rules (envelope, `unwrap()`, JWT, 401 handling, casing boundary, pagination, binary downloads).

**Base URL.** One Axios instance in [lib/axios.ts](lib/axios.ts) with
`baseURL = NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8080`). There is **no Next.js
rewrite or proxy for API traffic** — the browser calls the backend origin directly, so the backend
must allow that origin via CORS.

**Response envelope.** Every JSON endpoint returns
`{ status: { error, code, message }, data }`; errors add `timestamp`, `path`, `trace_id`.
**Always check `status.error` — HTTP 200 alone is not success**, because the backend returns 200 for
known business outcomes. The shared `unwrap()` performs that check and throws a typed error carrying
the `WBExxxx` code.

**Binary endpoints bypass the envelope.** Downloads and Excel exports return a blob — consume them
via `lib/file.ts` / `lib/excel.ts`, never through `unwrap()`.

**Field casing.** Three layers, three rules: the wire is lowercase `snake_case`; wire types in
`lib/types/api.ts` mirror it; everything else in the app uses camelCase semantic names. Translation
happens **once**, at the boundary, in `lib/api/mappers.ts` and `lib/auth/client.ts` — components
never read a snake_case property directly.

**Session handling (high level).** Login posts credentials, stores the JWT, and mirrors it into a
non-HttpOnly `wecms_token` cookie so the edge gate in `proxy.ts` can read it; Axios attaches
`Authorization: Bearer …` from `localStorage` on every request. A 401 is handled centrally by the
Axios response interceptor, which raises the global session-expired dialog — do not add per-call
401 handling. Logout clears the auth keys only; `wecms_locale` and `wecms_saved_user_id` are user
preferences and must survive it (never call `localStorage.clear()`).

| `localStorage` key | Owner | Cleared on logout? |
|---|---|---|
| `wecms_token` | `tokenStorage` | Yes |
| `wecms_user` | `userStorage` | Yes |
| `wecms_locale` | `LocaleProvider` | **No** |
| `wecms_saved_user_id` | `savedIdStorage` | **No** |

> The token cookie is non-HttpOnly **by design** (the edge must read it and Axios reads
> `localStorage`). That is a knowingly accepted trade-off for the current stage, not an oversight —
> it is revisited alongside action-level authorization before any production deploy.

Per-domain endpoint mappings live in
[docs/architecture/integrations/](docs/architecture/integrations/); the JEX `_view.jsp` → Next.js
route table is at
[docs/references/page-mapping/page-mapping.md](docs/references/page-mapping/page-mapping.md).

## Testing

```bash
npm test                       # vitest run — single pass, jsdom
npx vitest                     # watch mode (no npm script for this)
npx vitest run <path>          # a single file
npx tsc --noEmit               # type check (no npm script for this)
```

- **Runner:** Vitest 2.1 in a `jsdom` environment, with `@vitejs/plugin-react` so `.tsx` renders
  under `@testing-library/react`. Setup file: [vitest.setup.ts](vitest.setup.ts). The `@/*` alias
  mirrors `tsconfig.json` so imports resolve exactly as in the app build.
- **Scope:** [vitest.config.ts](vitest.config.ts) collects `components/**/*.test.{ts,tsx}` and
  `lib/**/*.test.{ts,tsx}` — component/regression tests and pure-logic tests. There is **no E2E
  layer** (no Playwright, no Cypress) and no coverage tooling configured.
- **Current state — the suite is not green.** Verified 2026-08-17: **14 test files, 152 tests, 11
  failing in 1 file** (`components/addon/sales-einvoices/useEInvoiceScrape.test.ts`) from a stale
  module mock missing a `decryptEInvoiceEngineData` export — a test-side defect, not an app
  regression. Cause and evidence:
  [docs/testing/testing-strategy.md](docs/testing/testing-strategy.md).

## Build

```bash
npm run build     # next build
npm run start     # next start — serve the build
```

Output goes to the **`.next/`** directory (gitignored). `next build` inlines every
`NEXT_PUBLIC_*` value into the client bundle at build time, so the build is environment-specific —
the target backend origin must be set **before** building, not at run time.

> If `next build` fails with a type error inside `.next/dev/types/routes.d.ts`, a `next dev` server
> is running concurrently. Stop it and rebuild.

## Deployment

**Deployment is managed outside this repository.**

[.gitlab-ci.yml](.gitlab-ci.yml) is a **trigger only**: it runs on the `sit` and `uat` branches and
hands off to a downstream pipeline in another GitLab project resolved from the `$URL` / `$FILE` CI
variables. The build and deploy steps themselves are **not in this repository**, and there is no CI
job here that lints, type-checks, tests, or builds. There is also **no Dockerfile and no
docker-compose**.

Evidenced environments — from [.gitlab-ci.yml](.gitlab-ci.yml), [.env.example](.env.example),
[.env.uat.example](.env.uat.example), and the `sit` / `uat` branches on `origin`:

| Env | Frontend | `NEXT_PUBLIC_API_BASE_URL` | Trigger |
|---|---|---|---|
| **LOCAL** | `http://localhost:3000` (`npm run dev`) | `http://localhost:8080` | Manual |
| **SIT** | `wecms.kosign.dev` — also the origin the NXiSAS engine is licensed against | Not committed to this repository | Push to branch `sit` |
| **UAT** | `https://test2.wecms.vn` (host `42.96.47.184`) | `https://test2-api.wecms.vn` | Push to branch `uat` |
| **PROD** | **Not evidenced in this repository** — no prod env file, CI rule, or branch exists here. Do not infer one. | — | — |

**How configuration differs per environment, conceptually:** only the build-time
`NEXT_PUBLIC_API_BASE_URL` (and optionally `NEXT_PUBLIC_NXISAS_DEBUG`) changes. There are no
per-environment code paths, no runtime config file, and no feature flags in this repository.

Because SIT and UAT are real deployments, **treat this codebase as pre-production, not a sandbox**:
`NEXT_PUBLIC_*` values are public once built, and the security posture has a real deployed surface.

## Troubleshooting

| Symptom | Cause & fix |
|---|---|
| `npm install` fails on an engine check | Wrong Node major. This project requires **22.x** (`>=22 <23`); Node 23+ is deliberately excluded. `nvm use` reads `.nvmrc`. |
| Redirected to `/login` immediately, in a loop | No `wecms_token` cookie, or the backend is unreachable so `GET /api/v1/auth/me` fails and the session is cleared. Start `wecms-api` and check `NEXT_PUBLIC_API_BASE_URL`. |
| Looking for `?preview=1` to skip login | **It does not exist** and must not be re-added. Point `NEXT_PUBLIC_API_BASE_URL` at a running backend instead. (`?preview=session-expired` and `?preview=nxisas` are unrelated dev hooks, not auth bypasses.) |
| Network error / CORS error in the console | The backend is not running, is on a different port, or has not allowed your origin. Check `NEXT_PUBLIC_API_BASE_URL`, then `WECMS_CORS_ALLOWED_ORIGINS` on the API side. |
| Every request returns 401 | Expired or missing JWT — the interceptor raises the session-expired dialog. Log in again. |
| An env change has no effect | `NEXT_PUBLIC_*` values are read at **build/start** time. Restart `npm run dev`; for a production build, rebuild. |
| `Port 3000 already in use` | Another dev server is running. Stop it, or `npm run dev -- -p 3001`. |
| Build fails in `.next/dev/types/routes.d.ts` | A concurrent `next dev` is running. Stop it (or restore the file) and rebuild. |
| HMR broken when serving from a Coocon domain alias | Add that alias to `allowedDevOrigins` in [next.config.ts](next.config.ts). |
| 11 tests fail on a clean checkout | Known — a stale mock in `useEInvoiceScrape.test.ts`, not an app regression. See [Testing](#testing). |
| A doc link resolves nowhere | Many documentation links point into a sibling `../wecms-api/` checkout or the multi-tree workspace root. See the note in [Documentation](#documentation). |

## Documentation

| Doc | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | ⚠️ Next.js 16 differences — **read first** |
| [CLAUDE.md](CLAUDE.md) | Frontend project rules — components, tokens, dialogs, naming, routing, shared-code policy |
| [docs/README.md](docs/README.md) | Documentation root + **Start Here** reading order |
| [docs/features/](docs/features/) | Per-feature / per-screen design, feature-first by WeCMS menu |
| [docs/architecture/](docs/architecture/) | Cross-cutting architecture — routes, components, hooks, state, integrations, view-setting |
| [docs/references/api-contract.md](docs/references/api-contract.md) | **Frontend API consumption contract** — envelope, `unwrap()`, JWT, 401, casing, pagination, downloads |
| [docs/references/page-mapping/page-mapping.md](docs/references/page-mapping/page-mapping.md) | JEX `_view.jsp` → Next.js route mapping |
| [docs/ui-component-guide.md](docs/ui-component-guide.md) · [docs/tech-stack.md](docs/tech-stack.md) | Component guide · stack notes |
| [docs/testing/testing-strategy.md](docs/testing/testing-strategy.md) | How to run and write tests; what tooling does and does not exist |
| [docs/audits/](docs/audits/README.md) | Frontend parity audits and gap analyses (point-in-time records) |
| [docs/tech-debt.md](docs/tech-debt.md) | Tracked debt, including known dead code |

> **Out-of-repo links.** Many links across the documentation tree point outside this repository —
> into a sibling `../wecms-api/` checkout (paired backend feature docs) and into the multi-tree
> workspace root (legacy JEX spec, shared references). They resolve only when those trees are
> present; in a standalone clone they will not. That is a documented dependency, not a broken link —
> every **in-repo** link resolves. For consumption-side questions read
> [docs/references/api-contract.md](docs/references/api-contract.md), which is the in-repo answer, so
> a standalone clone stays usable. Authoring rules:
> [docs/references/README.md](docs/references/README.md#out-of-repo-links--three-tiers).

## Related Repository

```text
Related backend: wecms-api  —  https://git.kosign.dev/wecms/wecms-api.git
```

The two repositories are refactored **together**: a contract change (DTO, endpoint, field name, key
format) has a matching change on the other side, and neither ships a change the other has not
accounted for. Keep feature slugs identical across both trees, and note the paired change in the MR
description.

## Contributing / Development Guidelines

- **Read [AGENTS.md](AGENTS.md), then [CLAUDE.md](CLAUDE.md).** `CLAUDE.md` is the authoritative
  ruleset for this tree — reuse-before-creating, the shared-component architecture, typography
  tokens, dialog and modal-stacking rules, naming layers, and routing.
- **Reuse before creating.** Walk `components/ui/` → `components/layout/` → `components/shared/` →
  the feature folder before adding anything. The second consumer of a piece of logic is the trigger
  to extract it into a shared module — never copy between features.
- **Use the tokens.** No `text-[Npx]`, `font-[N]`, `tracking-[…]`, or inline font styles. Extend the
  `@theme inline` token list first, then consume it.
- **All user-visible text goes through `t(…)`** with keys added to `locales/en.json`, `ko.json`, and
  `vi.json` in the same MR.
- **Verify four breakpoints** — 375 / 768 / 1024 / 1440. Authoring is desktop-first.
- Run `npm run lint`, `npx tsc --noEmit`, and `npm test` locally before opening an MR —
  **CI runs none of them.**
- Do not edit `wecms-api` as part of a frontend task, and do not write to the legacy JEX trees —
  they are read-only reference.
- Branch naming here is not formally documented; `main`, `sit`, and `uat` are the long-lived
  branches (`sit` / `uat` trigger the deployment pipelines). Follow the pattern already visible on
  `origin` and confirm the target branch with the team lead.

## License

**Proprietary — internal project.** This repository contains no license file, and no open-source
license is granted or implied. WeCMS is a commercial product of **Webcash Global**; all rights
reserved. Use, copying, and distribution are governed by your agreement with the company — direct
any licensing question to the project owner rather than assuming permission.

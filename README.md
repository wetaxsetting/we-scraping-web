# wecms-web

Frontend for the **WeCMS** (WebCash Management System) refactor — the Next.js client of the
JEX → Spring Boot + Next.js modernization. WeCMS is an enterprise cash management solution by
Webcash Global for mid/large companies in Vietnam and Southeast Asia (integrated bank / tax /
ERP / card / e-invoice connections, real-time cash-flow monitoring, role-based approval
workflows, multi-tenant, multi-language EN/KO/VI).

This app is a SPA inside the Next.js App Router. It talks **only** to the `wecms-api` Spring Boot
backend over HTTP and persists lightweight client state (auth token, profile, locale, saved ID)
in `localStorage`. Status: **local-only R&D** — no deploy target, no SSR data fetching, no
Next.js API routes.

> **You do not need JEX knowledge to begin development.** JEX is legacy *functional* reference
> only; the Spring Boot + Next.js code is the implementation source of truth.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.2.3** (App Router) |
| Runtime | React 19, Node 22 LTS |
| Language | TypeScript 5 (`strict`), path alias `@/*` |
| Styling | **Tailwind CSS 4** — tokens in `app/globals.css` `@theme inline` (no `tailwind.config.js`) |
| UI kit | **shadcn/ui** primitives in `components/ui/` (style `new-york`) |
| Icons | `lucide-react` + project SVGs in `public/assets/` |
| HTTP | Axios 1.x with a JWT interceptor (`lib/axios.ts`) |
| Forms | React Hook Form + Zod |
| Fonts | `next/font/google` — **Inter + Noto Sans KR** (no other font family) |
| i18n | In-house provider (`lib/i18n/`), EN / KO / VI |
| Package manager | npm |

**Not used (do not introduce):** NextAuth, next-intl, react-i18next, Redux/Zustand,
react-query/SWR, Bootstrap, Material UI, Chakra, Heroicons, a second font family.

> ⚠️ **This is Next.js 16** — APIs and conventions differ from earlier versions. Read
> [AGENTS.md](AGENTS.md) before writing any code.

## Local setup

```bash
npm install
```

The Spring Boot backend (`wecms-api`) must be running for live data; the login and dashboard
guard call it on mount. UI chrome can be previewed without the backend via `?preview=1`.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080` | Base URL of the `wecms-api` backend. **Never** point this at `dev.wecms.vn`, `test.wecms.vn`, or `www.wecms.vn` — this is local-only R&D. |

Set it in a `.gitignored` `.env.local` when the backend runs on a non-default host/port.

## Run

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # ESLint
```

Open [http://localhost:3000](http://localhost:3000) — `/` redirects to `/login`; after login the
default landing route is `/banking/account-inquiry`.

## Documentation

| Doc | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | ⚠️ Next.js 16 differences — read first |
| [CLAUDE.md](CLAUDE.md) | Frontend project rules — components, tokens, dialogs, naming, routing |
| [docs/README.md](docs/README.md) | Frontend documentation root + **Start Here** reading order |
| [docs/features/](docs/features/) | Per-feature / per-screen design (feature-first by WeCMS menu) |
| [docs/architecture/](docs/architecture/) | Cross-cutting architecture — routes, components, hooks, state, integrations, view-setting |

Backend docs and the legacy JEX functional spec live outside this repository (the `wecms-api`
backend repo and the shared workspace docs).

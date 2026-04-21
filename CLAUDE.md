@AGENTS.md

# CLAUDE.md — wecms-web-main (Next.js Refactor Target)

Next.js frontend for the WeCMS JEX → Spring refactor. **Status: R&D proof-of-concept** (8-day sprint, 2026-04-23 → 2026-05-06). Local-only, GitLab-only. **Read [AGENTS.md](AGENTS.md) first** — this is Next.js 16 with breaking changes from earlier versions.

Workspace-level layout, memory, and cross-tree rules are in the root [CLAUDE.md](../CLAUDE.md). The Spring Boot backend this app talks to is in [wecms-api-main/](../wecms-api-main/). JEX functional spec lives in [WECMS DEV/CLAUDE.md](../WECMS%20DEV/CLAUDE.md). Full roadmap: [docs/features/wecms-full-refactoring-roadmap.md](../docs/features/wecms-full-refactoring-roadmap.md) and [docs/features/wecms-menu-refactoring-timeline.md](../docs/features/wecms-menu-refactoring-timeline.md).

## Stack

- **Next.js:** 16.2.3 (App Router)
- **React:** 19.2.4
- **TypeScript:** ^5
- **Node:** 22 LTS
- **UI framework:** **Bootstrap 5 + react-bootstrap** (per Mr. Jung's directive — roadmap v2.1)
- **HTTP client:** Axios with JWT interceptor
- **Auth:** NextAuth credentials provider (consumes JWT access + refresh from `wecms-api-main`)
- **Validation:** React Hook Form + Zod
- **Package manager:** npm
- **Lint:** ESLint 9 + `eslint-config-next`
- **CI:** GitLab CI (`.gitlab-ci.yml`) — lint, type-check, unit tests

**Version control:** Git — `kosign-wecms/wecms-web-main` on GitLab.

### ⚠ Tailwind → Bootstrap conversion pending

The initial scaffold from `create-next-app` left **Tailwind 4** in `package.json` (`tailwindcss@^4`, `@tailwindcss/postcss@^4`). The refactor target is **Bootstrap 5 + react-bootstrap**. The swap is pending in Sprint 0 Day 1:

- Uninstall `tailwindcss` + `@tailwindcss/postcss`.
- Install `bootstrap`, `react-bootstrap`, `sass`.
- Remove Tailwind directives / imports from `app/globals.css`; replace with `_custom-variables.scss` + `import "bootstrap/dist/css/bootstrap.min.css"` in `app/layout.tsx`.
- Remove `postcss.config.mjs` if it exists only to support Tailwind.

**Until the swap is done, do NOT add Tailwind utility classes in new code.** Write plain classes + react-bootstrap components.

## Directory Layout (target)

```
app/
├── layout.tsx                — imports Bootstrap CSS + custom SCSS
├── globals.css / _custom-variables.scss
├── (auth)/
│   └── login/                — logn module UI
├── (dashboard)/
│   ├── banking/              — hero screens: account inquiry, transaction history
│   ├── payments/             — hero screens
│   └── settings/             — hero tabs
└── api/                       — Next.js API routes (auth only, if needed by NextAuth)
components/
├── {feature}/                — feature-specific components
└── shared/                    — cross-feature shared components
lib/
├── axios.ts                   — configured Axios client + JWT interceptor
├── auth.ts                    — NextAuth config
└── {utils}.ts
public/                        — static assets
```

Route groups `(auth)` and `(dashboard)` use Next.js parentheses grouping — shared layouts without adding to the URL path.

## Responsive Design — Bootstrap 5 Grid

**Every page must be responsive** across three target breakpoints: mobile (375 px), tablet (768 px), desktop (1440 px+).

| Target | Bootstrap tier | Breakpoint | Grid prefix | Key adaptations |
|---|---|---|---|---|
| Mobile (375 px) | `xs` / `sm` | `<576 px` / `≥576 px` | `col-` / `col-sm-` | Navbar → hamburger, card lists (no tables), full-screen modals, stacked forms |
| Tablet (768 px) | `md` | `≥768 px` | `col-md-` | Collapsible sidebar (Offcanvas), 2-col forms, centered modals |
| Desktop (1440 px) | `xl` / `xxl` | `≥1200 px` / `≥1400 px` | `col-xl-` / `col-xxl-` | Fixed sidebar, full tables, inline dialogs, multi-col forms |

**Mobile-first authoring** — every component starts with `col-12`, then adds `col-md-6`, `col-xl-4`, etc. Never retrofit a desktop-only layout.

**Shared responsive primitives** (in the `@wecms/ui` package — built in Sprint 0):
- `<ResponsiveTable>` — `<Table>` at md+, card list at xs/sm
- `<ResponsiveDialog>` — wraps `<Modal fullscreen="sm-down">`
- `<ResponsiveNav>` — wraps `<Navbar>` + `<Offcanvas>`

**AI responsive inference rule** — when Figma / screenshot is desktop-only, Claude applies these defaults automatically without asking:
- Wide tables → `<ResponsiveTable>` (card list below md)
- Multi-column forms → single column below md, 2 cols at md, design columns at xl+
- Sidebar → `<Offcanvas>` drawer below lg
- Dialogs → `fullscreen="sm-down"`
- Images / charts → `img-fluid` / `max-width: 100%`

If a non-default mobile layout is needed, Sonny supplies a mobile Figma frame explicitly.

## Design → Code Workflow (per screen)

```
1. DESIGN INPUT (Sonny)       Figma URL + node ID (preferred) or screenshot
2. LOGIC EXTRACTION (AI)      Read JEX WSVC / IDO / _act.jsp / .ts for FIELD MAPPING +
                              BUSINESS RULES only — not layout
3. IMPLEMENTATION (AI)        Spring Boot entity/repo/service/controller + Next.js page +
                              react-bootstrap components + responsive via Bootstrap grid +
                              @wecms/ui primitives + React Hook Form + Zod validation
4. REVIEW + LOCAL TEST        npm run dev / ./gradlew bootRun; verify desktop + tablet +
                              mobile; commit; open MR
```

**JEX `_view.jsp` is NOT the visual source of truth.** Use it only for field list / labels / business rules. Layout comes from Sonny's design.

## Reading JEX as the Functional Spec

Read these JEX artifacts (read-only) to inform frontend translation:

| JEX artifact | Path pattern | What to extract |
|---|---|---|
| Frontend TS | `WECMS DEV/WECMS_STATIC/ts-src/js/jex/wabooks/{module}/{id}.ts` | State transitions, error handling, client-side validation |
| View JSP | `WECMS DEV/WECMS/web/view/jex/wabooks/{module}/{id}_view.jsp` | Field list + labels (NOT layout) |
| API contract | `WECMS DEV/WECMS_ETC/xml/service/WSVC/WSVC.{service_id}.xml` | Input / output field IDs — must match the Spring Boot DTO |

Full JEX conventions (module codes, service naming, the three ML types) are in [WECMS DEV/CLAUDE.md](../WECMS%20DEV/CLAUDE.md). For the refactor, JEX's ML system is replaced by Next.js i18n (tool TBD — likely `next-intl`) — do **not** reuse JEX ML code IDs in Next.js code.

## Refactor Write Boundary

- Write only inside `wecms-web-main/`.
- JEX trees (`WECMS DEV/`, `SOURCE_CODE_ADMIN/`, ...) are **read-only**.
- The Spring Boot backend is in `wecms-api-main/` — don't edit from a Next.js session unless the task is explicitly full-stack.

## Full-Stack Ownership

Per roadmap Slide 3b: **each developer owns both frontend AND backend for their assigned menus.** If Sonny owns Login, she writes the Next.js login page *and* the Spring Boot `domain/auth/` code. Only foundation work (`@wecms/ui` primitives, shared backend config) is task-split. AI-generated matching DTOs/types land on both sides in the same commit.

## Run

```bash
npm install
npm run dev           # http://localhost:3000
npm run build
npm run lint
```

API base URL is read from `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8080`). Never point this project at `dev.wecms.vn`, `test.wecms.vn`, or `www.wecms.vn`.

@AGENTS.md

# CLAUDE.md — wecms-web

Living AI/developer guide for the Next.js frontend of the WeCMS JEX → Spring/Next.js refactor. Update this file whenever the real code moves.

**Read [AGENTS.md](AGENTS.md) first.** This is Next.js 16 — APIs, conventions, and file structure differ from earlier versions you may have seen in training data. Check `node_modules/next/dist/docs/` before writing anything non-trivial.

Workspace-level rules (cross-tree layout, write boundary, typography source of truth, asset rules) live in the root [CLAUDE.md](../CLAUDE.md). The Spring Boot API this client talks to is in [wecms-api/](../wecms-api/). JEX functional spec is read-only in [WECMS DEV/CLAUDE.md](../WECMS%20DEV/CLAUDE.md).

**Porting a feature?** The end-to-end procedural workflow (discovery → design docs → Flyway → backend → frontend → verify) is at [docs/refactor-wecms/MIGRATION_PLAYBOOK.md](../docs/refactor-wecms/MIGRATION_PLAYBOOK.md). Step 6 of the playbook is the frontend slice; the rules each step links to live in *this* file.

---

## Purpose

Frontend for the WeCMS refactor R&D. Talks only to `wecms-api` over HTTP, renders Figma-driven UI, and persists lightweight client state (auth token, user profile, locale, saved ID) in `localStorage`.

Status: **R&D proof-of-concept**, local-only, GitLab-only. No deploy target. No server-side session, no Next.js API routes (none are defined), no SSR data fetching — the app is effectively a SPA inside the Next.js 16 App Router.

## Documentation Structure Rules

All refactor frontend documentation lives under [`docs/refactor-wecms/`](../docs/refactor-wecms/). Never write refactor docs under `docs/jex/` — that tree is **read-only** functional reference for the live JEX system.

| Doc type | Path |
|---|---|
| Frontend page design (App Router routes, layouts, hooks, state, Axios mappers) | [docs/refactor-wecms/frontend/](../docs/refactor-wecms/frontend/) |
| Page mapping (JEX `_view.jsp` → Next.js route) | [docs/refactor-wecms/frontend/](../docs/refactor-wecms/frontend/) |
| API integration mapping (JEX WSVC → Spring REST → Next.js fetcher) | [docs/refactor-wecms/frontend/](../docs/refactor-wecms/frontend/) |
| Refactor feature specs (kebab-case must match the JEX counterpart) | [docs/refactor-wecms/features/](../docs/refactor-wecms/features/) |
| System architecture (cross-feature) | [docs/refactor-wecms/architecture/](../docs/refactor-wecms/architecture/) |
| Sprint / task plans | [docs/refactor-wecms/planning/](../docs/refactor-wecms/planning/) |
| Refactor-side test plans | [docs/refactor-wecms/testing/](../docs/refactor-wecms/testing/) |
| Bug reports (tag `System: Refactor`) | [docs/bug-reports/](../docs/bug-reports/) |

**JEX docs as read-only reference:** when designing a refactor page, read [docs/jex/screen-flows/](../docs/jex/screen-flows/), [docs/jex/business-rules/](../docs/jex/business-rules/), and the JEX feature spec under [docs/jex/features/](../docs/jex/features/) for the corresponding screen. Then design the Next.js equivalent — do not copy JEX JSP / TypeScript patterns mechanically.

**UI must follow the global typography rules** in the root [CLAUDE.md § Global Typography](../CLAUDE.md). The Tailwind tokens, font family, and semantic component classes (`text-page-title`, `text-section-title`, etc.) defined there are the only allowed surface for sizing/weighting text in this app — no arbitrary `text-[14.5px]` or inline `style={{ fontFamily: ... }}`.

**Naming traceability:** when a page exists on both sides, the JEX spec at `docs/jex/features/<slug>.md` and the refactor spec at `docs/refactor-wecms/features/<slug>.md` must share the same kebab-case `<slug>`.

## Project Overview

- **What works today:** `/login` (full Figma UI + real JWT auth), `/banking/account-inquiry` (mock data, real shell chrome), `/payment/approval-box` (mock data, real chrome, tabs/filter/table/footer), global system dialog, in-house i18n with EN/KO/VI, language + logout flows through the profile dropdown.
- **Implemented pages:** `/` (redirects to `/login`), `/login`, `/banking/account-inquiry`, `/payment/approval-box`. Every other route in the sidebar + top nav is a placeholder without an `href`.
- **Post-login redirect:** `HOME_ROUTE = /banking/account-inquiry`. `PAYMENT_HOME = /payment/approval-box`. When a real cross-module landing page exists, change only the constant in [lib/routes.ts](lib/routes.ts).
- **No NextAuth.** Auth is a plain Axios call + `localStorage`. Route protection is a client-side check inside `app/(dashboard)/layout.tsx`, backed by a `fetchMe()` call on mount.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.2.3** (App Router) |
| Runtime | React 19.2.4, Node 22 LTS |
| Language | TypeScript 5, `strict: true`, path alias `@/*` → `./*` |
| Styling | **Tailwind CSS 4** (utility-first, no `tailwind.config.js` — tokens live in `app/globals.css` `@theme inline`) |
| UI kit | **shadcn/ui** — primitives copied into `components/ui/` (not a package), style `new-york`, baseColor `neutral`, `cssVariables: true` — see [components.json](components.json) |
| Icons | `lucide-react` (shadcn default). No second icon library. Business icons are SVGs from `public/assets/`. |
| HTTP | Axios 1.x with a JWT interceptor — see [lib/axios.ts](lib/axios.ts) |
| Forms | React Hook Form + Zod (`@hookform/resolvers`) |
| Fonts | `next/font/google` — Inter + Noto Sans KR, attached to `<html>` in [app/layout.tsx](app/layout.tsx) as `--font-inter` / `--font-noto-kr` |
| Package manager | npm |
| Lint | ESLint 9 + `eslint-config-next` (flat config at [eslint.config.mjs](eslint.config.mjs)) |
| CI | GitLab CI (when added) — lint + type-check + build |

**VCS:** Git — `kosign-wecms/wecms-web` on GitLab.

**Explicitly NOT used:** NextAuth, next-intl, react-i18next, Redux/Zustand, react-query/SWR, Bootstrap, Material UI, Chakra, Heroicons. Do not introduce any of these without a written reason.

## API Naming & Serialization Standards

> **CTO directive (2026-05-08):** legacy JEX naming is retired. Three layers, three rules — each layer has one convention, no exceptions, no in-component overrides. Backend mirror: see [wecms-api/CLAUDE.md § API Naming & Serialization Standards](../wecms-api/CLAUDE.md#api-naming--serialization-standards).

### The three layers

| Layer | Convention | Where | Examples |
|---|---|---|---|
| **1. Wire JSON** (request + response) | lowercase `snake_case` | every HTTP call to `wecms-api` | `user_id`, `user_nm`, `access_token`, `bank_cd`, `field_id`, `total_count`, `banks_available`, `disp_ord` |
| **2. Frontend wire types** | `snake_case` property names matching wire | [lib/types/api.ts](lib/types/api.ts) | `ApiAccountRow.bank_cd`, `ApiScreenOptionItem.field_id` |
| **3. Frontend in-memory types** (storage, hooks, props, state) | **camelCase with semantic full words** | everything outside `lib/types/api.ts` | `StoredUser.userName` (not `user_nm`), `StoredUser.langCode` (not `lang_cd`), `StoredUser.companyName` (not `cmpn_nm`); `AccountInquiryRow.bankCd`, `EInvoiceRow.invoiceNo` |

**Stable identifier values stay UPPERCASE.** A View Setting `field_id` *property* is snake_case, but its *value* is `"BANK"` / `"ACCOUNT_NICKNAME"` / `"CHECKBOX"` — those are stable identifiers shared with the backend seed and the export contract, not wire keys. Same for `disp_yn === "Y"`, `status_cd === "ERR"`, currency codes (`"VND"`, `"USD"`), error codes (`"WBE1009"`).

### Translation happens at the boundary, exactly once

```
HTTP wire (snake_case)
        │
        ▼
  Mappers in lib/api/mappers.ts          ← translate snake_case wire row → camelCase frontend row
  Auth boundary in lib/auth/client.ts    ← translate snake_case wire user → StoredUser (camelCase semantic)
        │
        ▼
Frontend code (camelCase semantic)       ← components, hooks, storage, state — NEVER see snake_case
```

**Pages, hooks, components, storage helpers MUST NOT** directly read snake_case property names off a response. If you find yourself writing `response.data.user_id` or `body.user_nm` in a component, that means a mapper is missing — extend `lib/api/mappers.ts` first, then consume.

### Examples

```ts
// ✅ Correct — wire type lives in lib/types/api.ts
export interface LoginResponseRec {
    access_token: string;
    user_id:      string;
    user_nm:      string;
    lang_cd:      string;
    cmpn_nm:      string;
}

// ✅ Correct — in-memory type uses camelCase semantic names
export interface StoredUser {
    userId:      string;
    userName:    string;
    langCode:    string;
    companyName: string;
}

// ✅ Correct — translation at the boundary (lib/auth/client.ts)
function toStoredUser(rec: LoginResponseRec): StoredUser {
    return {
        userId:      rec.user_id,
        userName:    rec.user_nm,
        langCode:    rec.lang_cd,
        companyName: rec.cmpn_nm,
    };
}

// ✅ Correct — components read the camelCase shape
const userId = user?.userId ?? "";
const company = user?.companyName ?? "";

// ❌ Wrong — UPPER_SNAKE on the wire (reverted by the wire-type definition)
//   const res = api.post("/api/v1/auth/login", { USER_ID, USER_PW });

// ❌ Wrong — UPPER_SNAKE constants in component code
//   const USER_ID = "...";

// ❌ Wrong — component reading snake_case directly (mapper missing)
//   const userId = response.data.user_id;
```

### Response envelope (every endpoint)

```ts
interface ApiResponse<T> {
    status: { error: boolean; code: string; message: string };
    data?:  T;
    timestamp?: string;     // present on errors (ISO-8601)
    path?:      string;     // present on errors (request URI)
    trace_id?:  string;     // present on errors (JEX-style id; grepable in server logs)
}
```

- Always check `status.error` — HTTP 200 alone is not "success"; the backend returns 200 for known business errors.
- The `COMMON_HEAD` / `REC` envelope is **retired**. If you see it in old code, it predates the cutover — flip it.

### Storage keys

`localStorage` / `sessionStorage` keys live in `lib/auth/storage.ts` and use lowercase `snake_case` with the `wecms_` prefix to avoid collisions: `wecms_token`, `wecms_user`, `wecms_locale`, `wecms_saved_user_id`. **The values** stored under these keys are full camelCase JSON objects (e.g. `wecms_user` holds a `StoredUser` with `userId` / `userName` / `companyName`). Don't add a new storage key without registering it in the `localStorage keys (owned)` table further down — and never call `localStorage.clear()` on logout.

### Error handling (frontend side)

- Errors surface as `LoginError` / `ApiCallError` carrying `{ code, message, traceId }`. Read those, not the raw response.
- The `traceId` from the server response renders verbatim in the system error dialog so the user can quote it back to support. The frontend `localTraceId()` fallback (id ending `LOCL`) only fires on pure network failures where there's no response body — that id is browser-local and won't grep against server logs.
- Never display "UNKNOWN" / "Unexpected error" without a code. The auth client's `toLoginError(err)` funnel produces three meaningful codes: real backend code (e.g. `WBE1009`) when the server responded, `WBE_NETWORK` when Axios threw with no response, `WBE_CLIENT_PARSE` when the response shape was malformed (logged to `console.error` with the original error).

### Refactoring rules — when porting a JEX-shaped page

1. **Strip every UPPER_SNAKE field reference** in the page / hook / component. Replace with the camelCase in-memory type.
2. **If the matching backend DTO is still UPPER_SNAKE**, leave the wire type UPPER and the consumer reads UPPER — but flag it in the MR as a backend follow-up. **Don't half-migrate.**
3. **If the matching backend DTO has been migrated**, flip the wire type in `lib/types/api.ts` to snake_case + update the mapper + update every consumer of that type. The TypeScript compiler is your safety net — `tsc --noEmit` will surface every consumer.
4. **Form schemas use camelCase** field names internally (Zod schema, RHF register). The wire-name mapping happens in the API client wrapper.
5. **Storage** holds the camelCase in-memory shape. Never persist snake_case wire keys to localStorage.
6. **Update the matching backend DTO + mapper in the same MR.** Workspace full-stack ownership rule.

### Forbidden (caught at review)

- `response.data.USER_ID` / `body.COMMON_HEAD.CODE` / `data.REC` — that envelope and casing are retired.
- A new `Api*` wire type with UPPERCASE property names (Sprint 1 holdovers — Transaction, Transfer, Reports — are deliberately retained until their backend migrates; do not add new ones).
- A `const USER_ID = "..."` / `interface User { USER_NM: string }` declaration.
- Component code that reaches into `response.data.user_id` directly — extend the mapper, then consume.
- A second response envelope shape (e.g. a custom `ApiResult<T>` with a different field set) — there's one envelope, defined in `lib/types/api.ts`.

### Holdovers (still UPPER_SNAKE on the wire)

These wire types in [lib/types/api.ts](lib/types/api.ts) keep UPPER_SNAKE property names until their backend feature migrates:

- `ApiTransactionRow`, `ApiTransactionListResponse` (Banking > Transaction History)
- `ApiDailyCashReport`, `ApiDailyFinancialCmcReport`, `ApiDailyFinancialHsReport`, `ApiCashFlowReport` (Banking > Reports)

Banking > Internal Transfer (`ApiTransferHistoryRow` / `ApiTransferHistoryResponse`) flipped to lowercase snake_case on 2026-05-20 in the same MR that landed the spec-aligned backend endpoint `/api/v1/banking/internal-transfer/transfer-history`.

When the backend DTO flips, flip the wire type + every consumer in the same MR. Don't pre-migrate the frontend half.



## Architecture Rules

### Directory Layout (current)

```
app/
├── layout.tsx                  — next/font/google (Inter + Noto KR),
│                                  <LocaleProvider><DialogProvider>{children}</DialogProvider></LocaleProvider>
├── globals.css                 — Tailwind 4 import + shadcn semantic tokens +
│                                  WeCMS brand/neutral/status tokens + text-wb-* +
│                                  tracking-wb-* + shadow-wb-* + widths under @theme inline
├── page.tsx                    — redirect('/login')
├── (auth)/
│   ├── layout.tsx              — split-screen grid (marketing + form)
│   └── login/
│       ├── page.tsx            — composes MarketingPanel + LoginForm
│       └── loginSchema.ts      — Zod schema, messages = translation keys
└── (dashboard)/
    ├── layout.tsx              — client auth guard + fetchMe() + <AppShell>
    ├── banking/
    │   └── account-inquiry/
    │       └── page.tsx        — composes <AccountInquiryPage />
    └── payment/
        └── approval-box/
            └── page.tsx        — composes <ApprovalBoxPage />

components/
├── auth/
│   ├── FormField.tsx, IconInput.tsx, PasswordInput.tsx, LoginForm.tsx, MarketingPanel.tsx
├── layout/
│   ├── AppShell.tsx            — Header + Sidebar + <main>, scroll-lock for mobile drawer
│   ├── Header.tsx              — top nav (Banking, Payment, Add-on, Settings) + action icons + ProfileMenu
│   ├── HeaderIcons.tsx         — SVG icon components for top nav items (active/inactive variants)
│   ├── ProfileMenu.tsx         — avatar dropdown: user block, Languages (side popover), Change Password, Logout
│   ├── Sidebar.tsx             — company header + nav groups; drawer < lg, sticky ≥ lg
│   └── SidebarMenuItem.tsx     — reusable nav row: icon, label, optional chevron, active state
├── payment/
│   └── approval-box/
│       ├── ApprovalBoxPage.tsx — main page container (tabs, filter, table, footer, pagination)
│       ├── ApprovalTable.tsx   — bare <table> + colgroup, 11 columns, StatusBadge, approver badge
│       ├── ApprovalTableColumns.tsx — shared colgroup definition reused by table and footer
│       ├── ApprovalTableFooter.tsx  — summary row: doc count + currency totals with colspan
│       ├── ApprovalTabs.tsx    — tab strip (All/Draft/Pending/In Progress/Approved/Rejected) + counts
│       ├── DateRangePicker.tsx — UI-only date range display; no real picker wired yet
│       ├── FilterBar.tsx       — layout wrapper: DateRangePicker (left) + SearchInput (right)
│       ├── StatusBadge.tsx     — colored approval-status pill (wb-status-* tokens)
│       ├── mockData.ts         — static mock rows, tab counts, currency totals
│       └── types.ts            — ApprovalStatus, ApprovalRow, TabCounts, CurrencyTotal
├── shared/
│   ├── AccountInquiryPage.tsx  — full banking dashboard composite (mock rows)
│   ├── Logo.tsx                — "We" (blue) + "CMS" (black) wordmark
│   ├── PageHeader.tsx          — shared page title + right-side action slot
│   ├── PageActionButtons.tsx   — list view / print / export-to-excel buttons (no handlers yet)
│   ├── Pagination.tsx          — page-size dropdown + nav arrows + page buttons
│   ├── SearchInput.tsx         — search field with lucide Search icon, responsive width
│   └── dialog/
│       ├── DialogProvider.tsx  — <DialogProvider>, useDialog()
│       ├── SystemDialog.tsx    — portal-rendered modal, 4 types
│       ├── DialogIcon.tsx, types.ts, index.ts
└── ui/                         — shadcn primitives (editable source)
    ├── button.tsx, card.tsx, checkbox.tsx, input.tsx, label.tsx, table.tsx

lib/
├── auth/
│   ├── client.ts               — login(), fetchMe(), logout(), LoginError (axios → typed error)
│   └── storage.ts              — tokenStorage / userStorage / savedIdStorage (localStorage + cookie sync)
├── i18n/
│   ├── LocaleProvider.tsx      — in-house provider + useTranslation() + Locale type
│   └── index.ts                — re-exports
├── types/api.ts                — ApiResponse<T>, CommonHead, LoginResponseRec, MeResponseRec
├── axios.ts                    — api = axios.create({ baseURL }) + Bearer interceptor
├── routes.ts                   — HOME_ROUTE, BANKING_HOME, PAYMENT_HOME
└── utils.ts                    — cn(...) with extended tw-merge groups for text-wb-*

locales/                        — en.json, ko.json, vi.json (flat dotted keys)

public/
├── images/login/               — login logo, decorative SVGs
└── assets/                     — common/, header/, sidebar/, summary/, table/, pagination/
```

Route groups `(auth)` and `(dashboard)` are Next.js parenthesis grouping — they do **not** appear in the URL.

### Composition rules

- Pages (`app/**/page.tsx`) stay thin: set `metadata`, compose existing components from `components/shared/` or the feature folder.
- Feature UI lives in `components/{feature}/{screen}/` (see `components/payment/approval-box/`). Cross-feature composites live in `components/shared/`.
- Shell chrome (Header, Sidebar, ProfileMenu, AppShell) lives in `components/layout/` — reuse, do not rebuild per page.
- shadcn primitives (`components/ui/`) are editable in place. If a primitive is missing, add it via `npx shadcn@latest add <name>` — don't roll a bespoke Input/Button/Checkbox.

## Coding Rules

- **Client vs. server components.** Any component using hooks / browser APIs / event handlers must start with `"use client";`. Current codebase is effectively all-client — only `app/layout.tsx`, `app/page.tsx`, and the page-level metadata files are server components.
- **Path alias.** Always import with `@/…`. Never use relative `../../../` imports across folders.
- **`cn(...)` for class-name composition.** Exported from [lib/utils.ts](lib/utils.ts) — `twMerge(clsx(...))` extended to classify `text-wb-{number}` as font-size so it doesn't collide with `text-wb-{name}` color tokens.
- **No inline `style={{}}`** for anything Tailwind can express. The only sanctioned exceptions are computed pixel values that Tailwind genuinely cannot express (rare).
- **Never import a second font family** via `next/font/google`, `next/font/local`, or `<link>`. Inter + Noto KR (already wired in `app/layout.tsx`) is the whole allowance.
- **Never introduce a second UI / icon / form / styling library.** One system.
- **Naming convention** — three layers, three rules:
  1. **Wire** (request/response JSON over HTTP) — lowercase `snake_case` per the CTO directive (2026-05-08). The api side enforces this via a global Jackson `SNAKE_CASE` strategy on the auto-configured `ObjectMapper`.
  2. **Frontend wire types** in [lib/types/api.ts](lib/types/api.ts) — property names match the wire (`user_id`, `user_nm`, `field_id`, `disp_ord`, `total_count`, `banks_available`, …). Semantic *values* (e.g. `field_id === "BANK"`, `disp_yn === "Y"`) stay UPPERCASE since they're stable identifiers, not wire keys.
  3. **Frontend in-memory types** — camelCase with semantic full words (`StoredUser.userId` / `userName` / `bizKey` / `langCode` / `companyName`; `AccountInquiryRow.bankCd` / `accountNo` / `lastUpdate`; etc.). Wire ↔ in-memory translation happens once at the API boundary in `lib/auth/client.ts` and `lib/api/mappers.ts`; internal callers never see snake_case.
  
  **Out-of-scope wire types still UPPER_SNAKE** until their backend feature lands in scope: `ApiTransactionRow` / `ApiTransactionListResponse`, `ApiDailyCashReport` / `ApiDailyFinancialCmcReport` / `ApiDailyFinancialHsReport` / `ApiCashFlowReport`. Don't pre-migrate them — flip the wire type and its consumers in the same MR that flips the matching backend DTO. (`ApiTransferHistoryRow` / `ApiTransferHistoryResponse` was the most-recent type to flip — 2026-05-20.)
- **Translation keys live in the Zod message**, not the component. The caller runs `t(key)` when surfacing the message (see [loginSchema.ts](app/(auth)/login/loginSchema.ts) + `LoginForm`).
- **Comments** explain WHY, not WHAT. Existing files show the tone — keep it.

## Feature Status

| Route | Status | Notes |
|---|---|---|
| `/` | Redirect | → `/login` |
| `/login` | Working | Real login against `POST /api/v1/auth/login`, Save ID, show/hide password |
| `/banking/account-inquiry` | Shell + mock data | Real AppShell, real Sidebar active state, real Pagination; table rows are hardcoded in `AccountInquiryPage.tsx` |
| `/payment/approval-box` | Shell + mock data | Real ApprovalTabs, FilterBar, ApprovalTable with StatusBadge, ApprovalTableFooter, Pagination; all data from `mockData.ts` |
| `/banking/transaction-history`, `/banking` FCY variants, `/internal-transfer/**`, `/reports/**`, `/addon`, `/settings` | Placeholders | Sidebar/Header entries without `href` — disabled until the route exists |
| Change password dialog | Not implemented | ProfileMenu row exists, handler is empty |
| Print / Export / List view | Not implemented | `PageActionButtons` buttons exist, no handlers wired |
| DateRangePicker (real picker) | Not implemented | UI-only static display; no calendar popover |

## UI Implementation Baseline

### Approved reference set (source of truth)

Four screens are the **approved visual reference set** for `wecms-web`. Every new or re-implemented UI must match one of these patterns — do not invent a new look when a reference already covers the case, and do not create page-specific custom styles when an approved pattern already exists.

| # | Reference | Role | Source |
|---|---|---|---|
| 1 | **Banking > Account Inquiry (VND)** | Standard menu-page baseline — shell, page header, filter row, pagination, single-footer table | [AccountInquiryPage.tsx](components/shared/AccountInquiryPage.tsx) |
| 2 | **Payment > Approval Box** | Tabbed feature-page baseline — tabs, footer summary row, multi-column approval table with shared colgroup | [ApprovalBoxPage.tsx](components/payment/approval-box/ApprovalBoxPage.tsx) |
| 3 | **Add-on Service > Sales e-Invoices** (and its Expenses sibling) | Third approved menu-page baseline — multi-currency totals in the shared sibling-footer table; Sales/Expenses share one page shell via `translationPrefix` | [EInvoicesPage.tsx](components/addon/sales-einvoices/EInvoicesPage.tsx) |
| 4 | **Settings > Purpose modal** | Approved modal baseline — modal layout, settings-sidebar (expanded/collapsed), scroll behaviour, collapse-arrow behaviour | _link component path in this row when the page lands_ |

These four pages are the source of truth for:

- **page layout** · **font size** · **icon size** · **spacing**
- **table style** · **pagination** · **filter / search area**
- **button style** · **modal layout** · **modal sidebar** · **scroll behaviour**

**Which reference to follow**

- **Standard menu page** → Banking > Account Inquiry (VND), Payment > Approval Box, or Add-on Service > Sales e-Invoices — pick the closest.
- **Popup / modal UI** → Settings > Purpose modal.

### Pre-implementation check (required — every new screen)

Before writing UI for any new screen, do this in order:

1. Open the target Figma frame alongside all four approved references above.
2. Pick the **closest** match from the four and mirror its layout, tokens, components, and interactions.
3. Reuse shared components first — in this order:
   - [Header](components/layout/Header.tsx) · [Sidebar](components/layout/Sidebar.tsx) · [SidebarMenuItem](components/layout/SidebarMenuItem.tsx) · [ProfileMenu](components/layout/ProfileMenu.tsx)
   - [PageHeader](components/shared/PageHeader.tsx) · [PageActionButtons](components/shared/PageActionButtons.tsx)
   - [SearchInput](components/shared/SearchInput.tsx) · [Pagination](components/shared/Pagination.tsx)
   - shared table patterns — shadcn `<Table>` (no footer) or bare `<table>` + [ApprovalTableColumns](components/payment/approval-box/ApprovalTableColumns.tsx) colgroup (with footer)
4. Only build something new if none of the four approved references and none of the shared components fit — and call the decision out in the MR description.

### Legacy reference paragraphs (preserved)

**`/banking/account-inquiry` is the baseline layout reference.** Every future menu page must match its shell, page-header, filter-row, and pagination patterns. When in doubt, open [components/shared/AccountInquiryPage.tsx](components/shared/AccountInquiryPage.tsx).

**`/payment/approval-box` is the baseline for tabbed feature pages** — the first page with tabs, footer summary, and multi-column approval tables. Mirror [components/payment/approval-box/ApprovalBoxPage.tsx](components/payment/approval-box/ApprovalBoxPage.tsx) for any new tabbed screen.

### What the baseline defines

| Concern | Baseline decision (reuse, do not rebuild) |
|---|---|
| Page structure | `app/(dashboard)/{feature}/{screen}/page.tsx` → thin page composing one feature component |
| Shell | `<AppShell>` wraps every page from `app/(dashboard)/layout.tsx` |
| Top nav | [components/layout/Header](components/layout/Header.tsx) — Banking/Payment/Add-on/Settings, action icons, ProfileMenu |
| Left sidebar | [components/layout/Sidebar](components/layout/Sidebar.tsx) + [SidebarMenuItem](components/layout/SidebarMenuItem.tsx) — active state from `usePathname()` |
| Page header | [components/shared/PageHeader](components/shared/PageHeader.tsx) + right-aligned [PageActionButtons](components/shared/PageActionButtons.tsx) |
| Filter row | [components/shared/SearchInput](components/shared/SearchInput.tsx) + dropdowns on one row; DateRangePicker for date range screens |
| Tabs | [components/payment/approval-box/ApprovalTabs](components/payment/approval-box/ApprovalTabs.tsx) pattern — brand-active bottom border, count badge |
| Table (no footer) | shadcn `<Table>` wrapper from [components/ui/table](components/ui/table.tsx) — see `AccountInquiryPage` |
| Table (with colgroup/footer) | Bare `<table>` + `<colgroup>` pattern — see `ApprovalTable` / `ApprovalTableColumns` / `ApprovalTableFooter` |
| Status badge | [components/payment/approval-box/StatusBadge](components/payment/approval-box/StatusBadge.tsx) — `wb-status-*` tokens |
| Pagination | [components/shared/Pagination](components/shared/Pagination.tsx) |
| Dialogs | System messages (warning / error / success / confirmation) → `useDialog()`, max **500 px**. Feature dialogs (forms, edit-record, Settings shell) → shadcn `<Dialog>` primitive with Figma-driven `max-w-*` — see §3a |

### Known Inconsistency — two table patterns

`AccountInquiryPage` uses the shadcn `<Table>` wrapper from `components/ui/table.tsx`. `ApprovalTable`, `TransferOwnAccountsTable`, `TransferHistoryTable`, `TransactionTable`, and `EInvoiceTable` use a bare `<table>` with an explicit `<colgroup>` for precise column width control and a sibling footer table. Both are valid for their use case:

- **Use shadcn `<Table>`** when there is no summary row and no shared colgroup definition needed across multiple components.
- **Use bare `<table>` + shared colgroup component** when the table has a footer summary row. The footer is a sibling `<table>` that imports the same colgroup (see [ApprovalTableColumns](components/payment/approval-box/ApprovalTableColumns.tsx), [TransferOwnAccountsTableColumns](components/banking/internal-transfer/TransferOwnAccountsTableColumns.tsx), [TransferHistoryTableColumns](components/banking/internal-transfer/TransferHistoryTableColumns.tsx), [TransactionTableColumns](components/banking/transaction-history/TransactionTableColumns.tsx), [EInvoiceTableColumns](components/addon/sales-einvoices/EInvoiceTableColumns.tsx)) — not an inline `<tfoot>`, so the page can anchor the footer with `mt-auto` per §7a.

Do not unify these into a single pattern without a concrete need. Document the choice in the PR when adding a new table.

## Shared UI Rules

### Shell

Every authenticated route renders inside `<AppShell>` (applied automatically by `app/(dashboard)/layout.tsx`). New feature pages go under `app/(dashboard)/{feature}/…` — they inherit auth + chrome. **Do not re-mount `<Header>` / `<Sidebar>` per page.**

```
┌─────────────────────────────────────┐
│  Header  (components/layout/Header) │
├─────────┬───────────────────────────┤
│ Sidebar │  Main content (page body) │
│         │                           │
└─────────┴───────────────────────────┘
```

### Dialogs & modals

System-level message dialogs (warning / error / success / confirmation) go through the global `useDialog()` API — **never** render a bespoke per-page version of a system message. Feature dialogs (multi-field forms, edit-record dialogs, the Settings shell) are a distinct category — they use the shadcn [`<Dialog>`](components/ui/dialog.tsx) primitive directly with their own `max-w-*` cap from Figma. See §3a for the feature-dialog rhythm contract (`DialogHeader` / `DialogBody` / `DialogFooter` standard, only `max-w-*` may vary).

#### Dialog variant — choose the right `type` (project-wide rule, 2026-05-12)

Every `useDialog().open(...)` call picks one of four `type` values. The variant drives the icon colour, the chrome, and the title — they are not interchangeable. **Never use Warning chrome for API/network failures or validation errors** — that mismatched icon colour was the canonical regression caught on the VAS Account page that triggered this rule.

| `type` | Icon colour | Title (shared key) | Use for |
|---|---|---|---|
| `"error"` | **Red** | `t("dialog.error")` → "Error" / "오류" / "Lỗi" | API failures · Network errors · Server exceptions · Validation failures (Zod, file-type, row-error) · Unexpected system errors |
| `"warning"` | Orange / Yellow | `t("dialog.warning")` → "Warning" / "경고" / "Cảnh báo" | Non-fatal caution · Risk awareness before action · Feature-not-yet-implemented notice · Other purely informational warnings that are NOT errors |
| `"confirmation"` | Green / Teal | `t("dialog.confirmation")` → "Confirmation" / "확인" / "Xác nhận" | Delete / Submit / Reset / any destructive-or-irreversible user action that needs an explicit Continue |
| `"success"` | Blue (check) | `t("dialog.success")` → "Success" / "성공" / "Thành công" | Completed action — save / update / delete / import succeeded |

**Title rule.** Every system dialog MUST use the shared `dialog.{error,warning,confirmation,success}` keys for its title. Do **not** title an Error dialog with the module name (e.g. `t("settings.vas_account.error.title")` resolving to "VAS Account") — the title is the dialog variant, the module is implied by the trigger context. Per-feature `<feature>.error.title` keys that hold a module name are forbidden; resolve them to `t("dialog.error")` instead.

**Forbidden patterns (caught at review):**

- `type: "warning"` + an API / Zod / file-type error description → must be `type: "error"`.
- `title: t("settings.<feature>.error.title")` resolving to the module name for an Error dialog → must be `title: t("dialog.error")`.
- A bespoke red-icon dialog component built outside `useDialog()` to "look like" an error — go through the shared system dialog so the variant is correct.
- Mixing the variants on the same flow (success after upload, warning on duplicate, error on bad file) without checking the table above — file-type validation is an error, not a warning, even though it precedes the API call.

**Quick decision tree:**

```
Did an API/network/server call fail?              → "error"
Did Zod / file-type / row validation reject?      → "error"
Is this a "feature not implemented" notice?       → "warning"
Is this a "are you sure?" before destructive op?  → "confirmation"
Did the action just succeed?                      → "success"
```

When in doubt: if the user did something wrong or the system failed → **error**. If something happened that the user should pay attention to but is not broken → **warning**.

#### Dialog buttons — project-wide colour rule

The shared [`<SystemDialog>`](components/shared/dialog/SystemDialog.tsx) primitive enforces the button colours below. Pages MUST NOT pass custom button class names through `useDialog()` or bypass the primitive to "tweak" a dialog's CTA colour — the variant + the `destructive` flag are the only knobs.

| Role | Use for | Colour | Token |
|---|---|---|---|
| **Primary** | OK · Continue · Confirm · Save · Submit · Done · Okay | **Blue** background + **White** text | `bg-brand` + `hover:bg-brand-hover` + `text-white` + `font-semibold` |
| **Secondary** | Cancel · Close · Back | **White** background + **Grey** border + **Black** text | `bg-white` + `border border-wb-border-sidebar` + `text-black` + `hover:bg-black/5` |
| **Destructive primary** (rare — `destructive: true` on `confirmation` only) | Single-row Delete with an explicit red CTA in Figma | **Red** background + **White** text | `bg-destructive` + `hover:bg-destructive/90` + `text-white` |

**Per-variant button layout (already enforced by the primitive):**

| `type` | Buttons rendered | Default labels |
|---|---|---|
| `"error"` | **Single primary** | OK (override via `confirmText`) |
| `"warning"` | **Single primary** | OK (override via `confirmText`) |
| `"success"` | **Single primary** | OK (override via `confirmText` — e.g. "Done") |
| `"confirmation"` | **Secondary + Primary pair** — Cancel on the LEFT, Continue/Confirm on the RIGHT | Cancel + Continue (override via `cancelText` / `confirmText`) |

**Error dialog button rule** (single OK, blue):

```tsx
dialog.open({
  type: "error",
  title: t("dialog.error"),
  description: "Network Error",
  errorCode: "NETWORK",
  // confirmText defaults to "OK" — override only for project-wide
  // semantic vocabulary like "Okay" / "Done" / "Got it".
});
```

The primitive renders one `bg-brand` + `text-white` button — DO NOT pass `destructive: true` on an Error dialog (the flag is meaningful only on `"confirmation"`; the primitive ignores it on other types but the intent is wrong).

**Confirmation dialog button rule** (secondary + primary pair):

```tsx
dialog.open({
  type: "confirmation",
  title: t("dialog.confirmation"),
  description: "Are you sure?",
  confirmText: t("dialog.continue"),  // shared key — "Continue"
  cancelText:  t("dialog.cancel"),    // shared key — "Cancel"
  onConfirm: () => { /* … */ },
  // destructive: true            ← reserved for single-row delete CTAs only
});
```

The primitive renders the pair: `bg-white border-wb-border-sidebar text-black` Cancel on the left + `bg-brand text-white` Continue on the right. **Do NOT flag `destructive: true` for Excel-replace, bulk-reset, or any other "destructive-in-semantics-but-not-in-design" flow** — those keep the standard blue Continue per the shared "Confirmation" component (Figma standard). The danger-red destructive variant is only for explicit red-CTA designs (single-row delete confirmations match this).

**Forbidden patterns (caught at review):**

- Custom button colour via inline className or `style={{ background: ... }}` on a `useDialog()`-rendered dialog — every system dialog routes through `<SystemDialog>`'s pre-set classes.
- Per-page button shape (height, padding, radius) override — the primitive uses `px-[14px] py-[8px]` + `rounded-md` + `text-wb-13 font-semibold` for primary and `font-medium` for secondary. Pages must not re-style.
- Two primary buttons in one dialog (e.g. Save + Save & Continue) — the system dialog is a single-decision surface; multi-action flows belong in a feature dialog (shadcn `<Dialog>` per §3a).
- Hiding the primary button (`confirmText: ""`) — the primitive always renders the primary; setting an empty label is a UX bug. Every dialog needs an explicit dismiss affordance.
- A confirmation dialog with a red Continue when the design shows blue — drop `destructive: true`. Conversely, never re-skin the standard blue Continue red just because the action "feels destructive" — follow the Figma "Confirmation" component.

**Global enforcement:**

- One button system across every dialog in the app. Module / page / feature folders MUST NOT override.
- The Spring Boot backend (`wecms-api`) is HTTP-only and renders no UI; this rule applies to `wecms-web` (React) and any future Vue / Vanilla harness if introduced. The shared `<SystemDialog>` primitive is the single source of truth.

```tsx
const dialog = useDialog();

// Error / warning / success — single OK
dialog.open({ type: "error", title: t("dialog.error"), description: "...", errorCode: "WBE1009" });

// Confirmation — Yes/No
dialog.open({
  type: "confirmation",
  title: t("dialog.confirmation"),
  description: t("logout.confirm_description"),
  confirmText: t("dialog.yes"),
  cancelText: t("dialog.no"),
  onConfirm: () => { /* … */ },
});
```

- Mounted once in `app/layout.tsx` via `<DialogProvider>`. Only one `useDialog()` system dialog is visible at a time (it renders at `z-[100]` so it always sits above any open feature-dialog stack — see §"Modal stacking convention").
- Four types: `warning | error | success | confirmation`.
- Rendered via `createPortal()` at `document.body`. Tab traps inside, body scroll locks. **Close affordances are explicit-only** — OK / Confirm / Cancel / X (when provided) — per §"Modal stack — interaction & close behaviour". Outside / overlay click does NOT dismiss; ESC does NOT dismiss. The previous "ESC + overlay click closes" behaviour has been retired.

### Modal stacking convention (Settings → child popup → grandchild popup)

When a feature dialog is opened on top of another dialog, **always** declare its position in the stack via the `stackLevel` prop on shadcn [`<DialogContent>`](components/ui/dialog.tsx). Never rely on portal mount order, never invent a per-popup z-index override, never ship a transparent backdrop on a stacked level.

| Stack level | Where it's used | `stackLevel` | Overlay z-index | Content z-index | Overlay backdrop |
|---|---|---|---|---|---|
| 1 (root) | Standalone feature dialog (Edit Bank Account, Permission Dialog, Transfer Dialog) — and the [`<SettingsModal>`](components/settings/SettingsModal.tsx) shell, which paints its own `bg-black/45` backdrop directly | `1` (default) | `z-50` | `z-50` | `bg-black/45` |
| 2 | First child opened from inside Settings (Registered Login Credentials, Audit Logs) | `2` | `z-[60]` | `z-[61]` | `bg-black/20` |
| 3 | Sibling child opened from a level-2 popup (Login ID/PW, Select Bank, Select Bank Accounts, Password Confirmation) | `3` | `z-[70]` | `z-[71]` | `bg-black/20` |
| 4 | Top-of-stack feedback dialog over an already-stacked chain | `4` | `z-[80]` | `z-[81]` | `bg-black/20` |
| 5 | Reserved for a deeper child opened on top of a level-4 dialog (rare; future flows that genuinely stack five `<Dialog>` panels simultaneously) | `5` | `z-[90]` | `z-[91]` | `bg-black/20` |

**Why two z-indexes per level (overlay one notch below content):** if overlay and content share a z-index, they resolve their order by DOM order — which works most of the time, but inverts under Radix re-mounts or new ancestor stacking contexts and paints the overlay's `bg-black/20` *on top of* the panel's `bg-white`, producing a washed-out look. The +1 gap removes the ambiguity entirely. Higher levels' overlays still sit cleanly above lower levels' content (60 > 50, 70 > 61, 80 > 71, 90 > 81).

**Why `bg-black/20` per stacked level (not `bg-black/45`):** each level paints its own visible backdrop so the parent dims when a child opens, but compounding three or four `bg-black/45` layers reads as ~83-91 % black behind the topmost panel. With `bg-black/45` at L1 + `bg-black/20` per stacked level, cumulative dim grows gently:

```
L1 alone           ≈ 45 %
L1+L2              ≈ 56 %
L1+L2+L3           ≈ 65 %
L1+L2+L3+L4        ≈ 72 %
L1+L2+L3+L4+L5     ≈ 78 %
```

**Default close behaviour follows stack level too.** L1 keeps Radix's "click outside to dismiss" (standalone dialogs already rely on it). L2-4 default to `closeOnOutsideClick={false}` — clicks on the overlay near the panel edge would otherwise dismiss a nested popup by mistake. Both are overridable per-call via `closeOnOutsideClick` / `closeOnEscape` if a specific dialog needs different semantics.

**Rules (non-negotiable):**

- A new stacked dialog **must** declare `stackLevel` matching its position in the open chain. Never ship a feature dialog opened from inside Settings with `stackLevel={1}` (the default) — that gives it a `bg-black/45` overlay that compounds with Settings' own `bg-black/45` and reads as opaque.
- Never override `z-50/60/70/80/90` per-dialog — the gap is owned by the primitive, not the call site.
- Never set `bg-transparent` on the overlay of a stacked level — the parent will appear undimmed when the child opens (Figma + dev.wecms.vn require a visible step-change in dim per layer).
- A new dialog without a visible Figma description **must** pass `aria-describedby={undefined}` on `<DialogContent>` to opt out of Radix's a11y description requirement (avoids the "Missing Description" console warning).
- Any sixth-level need (rare) extends the primitive's `STACK_Z_OVERLAY` / `STACK_Z_CONTENT` / `STACK_OVERLAY_BG` arrays first, then consumes — never hand-rolls.
- The system feedback surface — `useDialog()` → [`<SystemDialog>`](components/shared/dialog/SystemDialog.tsx) — is **independent of `stackLevel`**: it renders to its own portal at `z-[100]`, intentionally above every shadcn `stackLevel` slot (current max L5 → `z-[91]`). This is what lets a Save success or validation error opened from inside a stacked chain (e.g. Settings → Registered → Select Bank Accounts → success) actually appear on top of the chain instead of behind it. If a future stackLevel goes higher than `z-[91]`, `SystemDialog`'s `z-[100]` must move past it too — never lower SystemDialog's z to "match" a deeper stack.

Reference implementations: [SettingsModal.tsx](components/settings/SettingsModal.tsx) (L1 root), [RegisteredLoginCredentialsDialog.tsx](components/shared/popups/RegisteredLoginCredentialsDialog.tsx) (L2), [LoginIdPasswordDialog.tsx](components/shared/popups/LoginIdPasswordDialog.tsx) / [SelectBankDialog.tsx](components/shared/popups/SelectBankDialog.tsx) / [PasswordConfirmationDialog.tsx](components/shared/popups/PasswordConfirmationDialog.tsx) (L3 siblings).

### Modal stack — interaction & close behaviour

The stacking convention above governs **z-index + backdrop dim**; this section governs **runtime interaction** — what is clickable, what dismisses what, and how events flow up and down a stacked chain. Both rule sets apply to every shadcn `<Dialog>`, every `useDialog()` system dialog, and every `<SettingsModal>`-hosted popup.

#### 1. Modal depth support

- The modal manager **must support up to 5 stacked feature-dialog levels safely**, with the `useDialog()` system-feedback layer (`z-[100]`) sitting above all of them as a 6th conceptual floor.
- Canonical 5-level chain currently in production:
  1. **L1** — Settings modal ([`<SettingsModal>`](components/settings/SettingsModal.tsx))
  2. **L2** — Registered Login Credentials modal
  3. **L3** — Select Bank modal
  4. **L4** — Login ID / PW modal
  5. **L5** — Select Bank Accounts modal
  6. **System feedback layer** — Success / Warning / Error / Confirmation via `useDialog()` may appear above any L1–L5 child without disturbing the chain (see §"Modal stacking convention" — `SystemDialog` renders to its own `z-[100]` portal precisely so this works).
- A sixth feature-dialog level is **not** supported today. If a future flow genuinely needs it, extend the primitive's `STACK_Z_OVERLAY` / `STACK_Z_CONTENT` / `STACK_OVERLAY_BG` arrays first (per §"Modal stacking convention" rules), then bump `SystemDialog`'s `z-[100]` past the new top so the system layer remains above every feature level.

#### 2. Top-most modal interaction rule

- **Only the top-most modal / dialog in the stack is interactive.** Every modal underneath stays visually visible (per the cumulative dim table in §"Modal stacking convention") but becomes a static, non-interactive layer until the top-most modal is dismissed.
- Background layers must block, at the modal-manager level, every form of user input that would otherwise reach the parent:
  - Mouse clicks (including ghost click-throughs from the overlay onto a parent button)
  - Scroll (mouse-wheel, touchpad, track-pad pinch / two-finger pan)
  - Keyboard (Tab / Shift-Tab focus traversal, Enter / Space activation, ESC, character input)
  - Form-control interaction — checkboxes, radios, text inputs, dropdowns, sliders, file pickers — including controls inside a parent `<table>` or filter row
- Focus is trapped inside the top-most modal; Tab / Shift-Tab cycle within its content only. Focus must NOT escape into the parent dialog or the underlying page.
- The overlay/backdrop element of the top-most modal is the single load-bearing surface for blocking these events. Per-component `onClick` / `onKeyDown` hacks on parent elements are forbidden — apply the rule once on the overlay, not screen-by-screen.

#### 3. Main Settings modal close behaviour

The Settings modal ([`<SettingsModal>`](components/settings/SettingsModal.tsx)) is a long-lived shell that hosts every Settings submenu. Accidentally dismissing it discards user work in every nested popup, so:

- **Outside / overlay click MUST NOT close the Settings modal.** Mouse-down on the dimmed backdrop is a no-op.
- The Settings modal closes ONLY via:
  - The **X close icon** at `top-4 right-4` on the shell.
  - The **ESC key**, ONLY when no child popup is open above it (ESC dismisses the top-most layer per the rule below — when L2+ is open, ESC closes that layer first).
- This is a deliberate departure from the legacy "overlay click dismisses" pattern. Do NOT add `onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}` (or any equivalent) to the Settings overlay.

#### 4. Common dialog (`useDialog()`) close behaviour

Applies to every system dialog: `success` / `warning` / `error` / `confirmation`.

- **Outside / overlay click MUST NOT close a common dialog.** Mouse-down on the dimmed backdrop is a no-op.
- A common dialog closes ONLY via:
  - **OK** (success / warning / error)
  - **Confirm** / **Cancel** (confirmation)
  - **X close icon** when the dialog renders one
- ESC dismissal is OFF by default for common dialogs. This is deliberate — a common dialog over a stacked chain (e.g. Settings → L2 → L3 → success) must not be ESC-dismissed in a way that also pops the parent layer.
- Re-entry: a second `useDialog().open(...)` while one is already visible **replaces** the current dialog (only one system dialog renders at a time per §"Dialogs & modals"); it never queues a second backdrop.

#### 5. Child popup / nested feature dialog close behaviour

- A child popup (L2-L5) **may** support outside-click dismiss when the design explicitly calls for it; the default is **off** (`closeOnOutsideClick={false}`) per the existing primitive — see §"Modal stacking convention" L2-4 default.
- When a child popup IS dismissible by outside-click, the click must dismiss **only that child**. Outside-click MUST NEVER cascade up to dismiss the parent modal underneath it. Event handling lives on the child's own overlay, not the page or the parent.
- ESC, when the child is dismissible by ESC, dismisses **only the top-most layer**. Pressing ESC three times in a Settings → L2 → L3 chain dismisses L3, then L2, then Settings — never two layers per keypress, never the whole chain at once.
- Only the top-most popup/dialog handles input events. Background popups must not respond to clicks, keyboard events, focus changes, or form interactions even when their visible chrome would normally do so.

#### 6. Modal layering / z-index (cross-reference)

- Every modal layer's z-index is owned by the primitive's `stackLevel` system in §"Modal stacking convention". Pages must NEVER override `z-50 / z-[60] / z-[70] / z-[80] / z-[90]` per call site, and MUST NOT introduce ad-hoc `z-[N]` literals in feature components.
- Dialogs must always paint above their parent modal — verify by opening the chain and confirming the top layer's content sits above its overlay AND above every lower-level overlay + content.
- The overlay/backdrop of every layer must block pointer events (`pointer-events: auto` on the overlay, never `pointer-events: none`). When the rule "only the top is interactive" is in effect, lower overlays continue to block — they don't pass clicks through to the parent dialog underneath.

#### 7. Focus & event handling

- **Focus trap** is preserved per layer — Radix's `<DialogContent>` already provides this; do not disable it. Tab / Shift-Tab cycle within the top-most modal only.
- **Event propagation** must not bubble out of a stacked layer into a parent layer's handlers. Use `e.stopPropagation()` on per-row click handlers inside a stacked dialog only when a row contains a nested clickable (icon button, link) that would otherwise fire the row's own activation.
- **Backdrop / pointer-events isolation** is per-modal-level. Each level paints its own `bg-black/N` overlay and owns its own pointer-event region. Do NOT share a single backdrop across multiple levels, do NOT set `pointer-events: none` on a stacked overlay to "let the parent stay clickable" — that violates the top-most-only rule.
- Body scroll lock activates on L1 mount and remains locked until the entire chain unmounts. Children do NOT each lock body scroll — the L1 lock covers the whole stack. (Settings modal + every `useDialog()` already do this; never add a second `document.body.style.overflow = "hidden"` inside a stacked level.)

#### 8. Root-cause guidance — apply at the common layer, not per-screen

- Modal behaviour rules above MUST be enforced at the **shared modal/dialog primitive layer** — [`<DialogContent>`](components/ui/dialog.tsx), [`<SystemDialog>`](components/shared/dialog/SystemDialog.tsx), [`<SettingsModal>`](components/settings/SettingsModal.tsx), and the `<DialogOverlay>` component — not in feature components.
- Per-screen custom modal handlers, per-popup overlay click overrides, per-dialog ESC re-bindings, and per-page focus traps are **forbidden**. If a specific Figma frame genuinely demands a deviation, extend the shared primitive's prop surface (e.g. add an opt-in `closeOnOutsideClick` for one specific child) and document the deviation in the MR description — never fork the primitive or re-implement the behaviour locally.
- A new modal-related bug is fixed **once, at the primitive**. Two patches in two feature files for the same symptom is the smell that the primitive needs the fix instead — do that work in the same MR.

### Shared components — reuse before creating

| Element | Source |
|---|---|
| Header / top nav | `components/layout/Header` |
| Header nav icons (SVG) | `components/layout/HeaderIcons` |
| Sidebar | `components/layout/Sidebar` |
| Sidebar nav row | `components/layout/SidebarMenuItem` |
| Profile dropdown | `components/layout/ProfileMenu` |
| System dialog | `useDialog()` from `components/shared/dialog` |
| Page title + action slot | `components/shared/PageHeader` |
| List/Print/Export buttons | `components/shared/PageActionButtons` |
| Search field | `components/shared/SearchInput` |
| Pagination | `components/shared/Pagination` |
| Paginated table shell (§7a) | `components/shared/DataTableShell` |
| Table footer (sibling-table) | `components/shared/DataTableFooter` |
| Report body (§7b) | `components/shared/ReportLayout` |
| Status pill | `components/payment/approval-box/StatusBadge` |
| Tabs strip | `components/payment/approval-box/ApprovalTabs` pattern |
| Form primitives (Input, Button, Checkbox, Label, Card, Table) | `components/ui/*` — shadcn |
| Auth form building blocks | `components/auth/FormField`, `IconInput`, `PasswordInput` |

Before building a new component: (1) check `components/ui/`, (2) check `components/layout/` + `components/shared/`, (3) check the existing feature folder. Create new only if nothing fits.

### Typography & tokens

Figma WB365 is the source of truth for `wecms-web`. The full scale lives in `app/globals.css` under `@theme inline`. Consume via:

**Text size** (`text-wb-{n}`)
```
text-wb-10  — 10px (micro pills)
text-wb-11  — 11px (sidebar group titles, helper text)
text-wb-12  — 12px (labels)
text-wb-13  — 13px (sidebar items, dropdowns, table cells, badges)
text-wb-14  — 14px / 1 (filters, inputs, buttons)
text-wb-14-tight   — 14px / 16px leading
text-wb-14-loose   — 14px / 28px leading
text-wb-14-relaxed — 14px / 22px leading (dialog body)
text-wb-15  — 15px (top nav menu labels)
text-wb-16  — 16px (summary card labels)
text-wb-18  — 18px (page title / form inputs)
text-wb-22  — 22px (login hero mobile)
text-wb-24  — 24px (large section headings)
text-wb-28  — 28px (login hero md)
text-wb-34  — 34px (login hero desktop)
```

**Brand & neutral tokens**
```
bg-brand, bg-brand-hover, bg-brand-active, bg-brand-soft, bg-brand-softer
text-brand, text-wb-ink, text-wb-dark, text-wb-muted, text-wb-ntrl-{5,6,8}
border-wb-{border,sidebar,ntrl-4}
bg-wb-bg-{active,sidebar,card}
```

**Approval status tokens** (wb-status-{variant}-{role})
```
wb-status-draft-bg / wb-status-draft-text
wb-status-pending-bg / wb-status-pending-text
wb-status-progress-bg / wb-status-progress-text
wb-status-approved-bg / wb-status-approved-text
wb-status-rejected-bg / wb-status-rejected-text
```

**Tracking, shadows, layout**
```
tracking-wb-tight, tracking-wb-tighter
shadow-wb-btn, shadow-wb-outline, shadow-wb-focus, shadow-wb-card, shadow-wb-brand-btn
w-wb-sidebar (211px), h-wb-header (48px), h-wb-table-head (40px), h-wb-table-row (60px)
w-wb-search (230px), w-wb-page-size (62px), h-wb-filter-btn (32px)
w-wb-col-{checkbox,bank,nickname,balance,available,last-update}  (banking table)
w-wb-ap-{date,type,docno,title,filename,currency,amount,status,scheduled,requestor,approver} (approval table)
w-wb-table-min (1058px), w-wb-ap-table-min (1834px)
```

**Forbidden** in component files: `text-[Npx]`, `leading-[Mpx]`, `font-[533]`, `tracking-[…]`, `style={{ fontFamily|fontSize|fontWeight|lineHeight }}`, and any class from JEX `_common.css` / `_ks-properties.css`. If a screen needs a new size, add the token to `@theme inline` first.

### Responsive rules

Desktop-first authoring. Every page must render correctly at **375 / 768 / 1024 / 1440**.

Shell behaviour:
- `< lg` (< 1024 px) — Header shows hamburger; Sidebar becomes a fixed-position drawer with backdrop; body scroll is locked when drawer is open.
- `≥ lg` — Sidebar is a sticky rail flush with the main area top; Header shows the full top-nav menu.

Standard patterns:
- Filter rows wrap to column layout below `md`.
- Tables scroll horizontally when narrower than `w-wb-table-min` / `w-wb-ap-table-min`.
- KPI / summary cards stack vertically below `md`.
- Pagination reflows from 2-row (mobile) to single-row (`md+`).

## Shared UI Component Architecture

Non-negotiable structural rule for this repo. Every cross-page UI concern that
reappears in more than one screen must be implemented **once** as a shared
component — pages compose those shared components via props/config and own
nothing but feature-specific data.

- **Top menu** must be the shared [Header](components/layout/Header.tsx). Active
  state is derived from `usePathname()`; entries are declarative and support
  per-module icons, `href`, and `activePrefix`. Do not reimplement top nav per
  page.
- **Sidebar menu** must be the shared [Sidebar](components/layout/Sidebar.tsx) +
  [SidebarMenuItem](components/layout/SidebarMenuItem.tsx). Groups, `VND` /
  `FCY` badges (and hidden-badge variants), per-item icons, and **nested
  `children`** (for expandable items like Transaction History's per-account
  list) are declarative config consumed by the component. Active state — for
  both leaf items and branches containing the active child — is derived from
  `usePathname()`. Do not reimplement the sidebar per module. Full rules for
  nested menus are in §2a.
- **Pagination** must be the shared [Pagination](components/shared/Pagination.tsx).
  It exposes `page`, `pageCount`, `pageSize`, `totalLabel`, `className`, and
  `hidden` — the last lets a page conditionally suppress pagination without
  wrapping the call site in a ternary. Do not build a page-specific
  pagination shape.
- **Table footer / total count** must be the shared
  [DataTableFooter](components/shared/DataTableFooter.tsx) sibling-table shell.
  Each feature footer (e.g. `ApprovalTableFooter`, `TransactionTableFooter`)
  passes in a shared `<colgroup>` + `minWidth` and renders its own `<tr>`
  content — supporting every summary variant (count-only · count + amounts ·
  multi-currency rows · column-aligned totals · no totals by omitting the
  footer prop altogether). Never inline the footer `<table>` chrome per page.
- **Data table layout** for paginated list/search pages must be the shared
  [DataTableShell](components/shared/DataTableShell.tsx) (CLAUDE.md §7a). It
  owns the outer flex stack, the shared scroll container, the `mt-auto`
  footer anchor, and the pagination slot. Configurable variants via props:
  paginated list · table with total row · table with multiple total rows ·
  horizontal scroll (always on) · no-pagination · no-footer. Never rebuild
  the `flex min-h-0 flex-1 flex-col gap-3 pb-3` / scroll / inner-flex chain
  per page.
- **Report pages** (Daily Cash, Daily Financial, Cash Flow) must use the
  shared [ReportLayout](components/shared/ReportLayout.tsx) (CLAUDE.md §7b).
  Multi-section reports pass `sectioned` to share the `gap-6` stack inside
  the same scroll container. Report pages MUST NOT render `<Pagination>` and
  MUST NOT use `<DataTableShell>`.
- **No page-specific duplicate implementation** of any of the above is
  allowed unless explicitly approved in the MR description. The fix for a
  new requirement is to extend the shared component or token first, then
  consume it — not to fork layout locally.

## Shared / Common Code Rules

Authoritative rules for **how reusable code is structured** in this repo.
Complements the [Shared UI Component Architecture](#shared-ui-component-architecture)
section above (which covers shared components specifically) and applies to
**every layer** — components, hooks, utilities, services, formatters,
session handling. Does NOT trigger a refactor of existing pages; the rules
govern current and future implementation only. Migrations of legacy pages
happen during their next stabilisation pass.

### 1. Common Reusability Rule (the two-call rule)

- Any logic, component, hook, formatter, or handler **used in two or more
  places MUST live in a shared module**. The second consumer is the
  trigger to extract — not the third, not the fifth.
- **Do not duplicate logic across pages.** If a page needs the same
  behaviour as another page, the answer is always "lift it once" — not
  "copy + adapt".
- The fix for a new requirement is to **extend the shared module first**,
  then consume it. Never fork a shared module per page.
- Single-use code may stay local to its feature folder; extract only when
  the second consumer materialises. Do not pre-emptively abstract.

### 2. What must live in shared / common

The following concerns are inherently cross-page and **must always**
route through a shared module — even on their first use, since they are
guaranteed to recur:

| Concern | Shared home (today) |
|---|---|
| Pagination UI + state logic | [components/shared/Pagination.tsx](components/shared/Pagination.tsx) — `<Pagination>` component, `usePagination` hook, `PAGE_SIZE_OPTIONS` |
| Table shell (paginated lists) | [components/shared/DataTableShell.tsx](components/shared/DataTableShell.tsx) |
| Table footer / totals row | [components/shared/DataTableFooter.tsx](components/shared/DataTableFooter.tsx) |
| Report layout (snapshot reports) | [components/shared/ReportLayout.tsx](components/shared/ReportLayout.tsx) |
| Table header cell + sort glyph | [components/shared/TableHeaderCell.tsx](components/shared/TableHeaderCell.tsx) |
| Table behaviours — sorting, row selection, checkbox state | extend the shared table components above; never inline a per-page selection map |
| Date range picker | [components/shared/DateRangePicker.tsx](components/shared/DateRangePicker.tsx) |
| Single-date input + calendar popup | [components/shared/DateField.tsx](components/shared/DateField.tsx) |
| Calendar trigger button | [components/shared/CalendarIconButton.tsx](components/shared/CalendarIconButton.tsx) |
| Search input | [components/shared/SearchInput.tsx](components/shared/SearchInput.tsx) |
| Filter row / dropdown | [components/shared/FilterRow.tsx](components/shared/FilterRow.tsx) · [FilterDropdown.tsx](components/shared/FilterDropdown.tsx) |
| Page header + action toolbar | [components/shared/PageHeader.tsx](components/shared/PageHeader.tsx) · [PageActionButtons.tsx](components/shared/PageActionButtons.tsx) |
| Page layout shell | [components/shared/PageLayout.tsx](components/shared/PageLayout.tsx) |
| System dialogs (warning/error/success/confirmation) | [components/shared/dialog](components/shared/dialog/) — `useDialog()` |
| Excel Upload preview modal (Download → Browse → Preview → Confirm) | [components/shared/excel-upload/ExcelUploadDialog.tsx](components/shared/excel-upload/ExcelUploadDialog.tsx) — `<ExcelUploadDialog>` shared shell. Per-feature wrappers supply `columns: ExcelUploadColumn[]` (with `widthPx` per column — sizes are configurable, NOT hardcoded), `rows: ExcelUploadRow[]` keyed by column id, plus translated chrome strings + handlers. See §3a "Excel Upload preview modals". |
| Print | [lib/print.ts](lib/print.ts) — `printReport`, `escapeHtml`, `PrintColumn` |
| Excel export | [lib/excel.ts](lib/excel.ts) — `exportExcel({ endpoint, screenId, dymAreaId, fileName, columns, filters, sort })` posts the View Setting + filter + sort context to the per-resource backend endpoint and saves the XLSX blob. Pages NEVER call it directly — they go through the shared [hooks/useExcelExport.ts](hooks/useExcelExport.ts) hook with a per-page `columnConfig` registry (FIELD_ID → `{ headerKey, format, ccyCd?, align? }`). Backend (Apache POI on the api side) is the single XLSX producer; frontend ships JSON, receives a blob, downloads. CSV export is **not** a sanctioned format — the legacy CSV path on Account Inquiry was removed when the shared XLSX path landed. See §13b for the binding contract. |
| HTTP transport + JWT interceptor | [lib/axios.ts](lib/axios.ts) — `api` Axios instance |
| API data fetch hook | [lib/api/useApiData.ts](lib/api/useApiData.ts) |
| API call wrappers (per-domain) | [lib/api/](lib/api/) — `banking.ts`, `addon.ts`, `mappers.ts`, etc. |
| Auth / token / user / saved-id storage | [lib/auth/storage.ts](lib/auth/storage.ts) — `tokenStorage`, `userStorage`, `savedIdStorage` |
| Session handling — login / logout / fetchMe / 401 → re-login | [lib/auth/client.ts](lib/auth/client.ts) + [lib/axios.ts](lib/axios.ts) (response interceptor) |
| i18n + `t(...)` | [lib/i18n/LocaleProvider.tsx](lib/i18n/LocaleProvider.tsx) |
| Routing constants | [lib/routes.ts](lib/routes.ts) |
| Currency / amount formatting | [lib/currency.ts](lib/currency.ts) |
| Date / time formatting (incl. "Last Update", "Inquired on", relative dates) | [lib/datetime.ts](lib/datetime.ts) |
| Class-name composition (`cn`) | [lib/utils.ts](lib/utils.ts) |

If a concern in this list does not yet have a home (e.g. Excel export),
the **first** consumer creates the shared module — the consumer page does
**not** ship inline logic with a "promise to extract later".

### 3. Folder Structure Rule

| Layer | Path | What goes here |
|---|---|---|
| Shared UI components | [components/shared/](components/shared/) | Cross-feature React components (page chrome, tables, filters, dialogs). Per-feature components live in `components/{feature}/{screen}/`. |
| Shadcn primitives | [components/ui/](components/ui/) | Editable shadcn copies (button, input, table, …). Add via `npx shadcn@latest add <name>`. |
| Layout / shell | [components/layout/](components/layout/) | Header, Sidebar, AppShell, ProfileMenu. |
| Reusable hooks (cross-feature) | `hooks/` | **Convention going forward.** Top-level `hooks/` folder hosts cross-feature React hooks (`useDebounce`, `useRefreshKey`, `useSelection`, future `useFilters`, etc.). Today the only existing hooks are `usePagination` (inside `components/shared/Pagination.tsx`) and `useApiData` (inside `lib/api/`) — both stay where they are; new cross-feature hooks land under `hooks/` from day one. |
| Common utilities / formatters | [lib/](lib/) | Pure helpers (`print.ts`, `currency.ts`, `datetime.ts`, `routes.ts`, `utils.ts`). Do **not** introduce a sibling `utils/` folder — `lib/` is the single home. |
| API call layer | [lib/api/](lib/api/) | Per-domain Axios wrappers (`banking.ts`, `addon.ts`, …) and mappers. Do **not** introduce a `services/` folder — `lib/api/` is the single home. |
| Auth / storage | [lib/auth/](lib/auth/) | `client.ts` (login/logout/fetchMe), `storage.ts` (token/user/savedId). |
| i18n | [lib/i18n/](lib/i18n/) | Provider + `useTranslation`. |
| Types | [lib/types/](lib/types/) | Shared wire DTO types — **lowercase snake_case property names** matching the Spring Boot contract. See "API Naming & Serialization Standards" above. (Sprint 1 holdovers — Transaction / Transfer / Reports DTOs — stay UPPER_SNAKE until their backend migrates.) |

The folder map is **closed**. Do not introduce `utils/`, `services/`,
`helpers/`, `common/`, or `shared/` at the project root — every concern
has exactly one home in the table above.

### 4. Page Responsibility Rule

- `app/**/page.tsx` files stay **thin** — set `metadata`, compose
  existing shared / feature components. No business logic, no inline
  table rendering, no per-page filter implementation.
- A page file must not contain duplicated business logic that already
  lives — or should live — in a shared module.
- If a page's local state grows beyond simple form / filter / pagination
  state (more than a couple of `useState`s plus event handlers), that is
  the signal to extract a hook or lift to a feature component.
- Per-feature business composites live under `components/{feature}/{screen}/`
  and remain feature-local; cross-feature concerns lift to
  `components/shared/` or `hooks/` per §3.

### 5. Event Function Rule

- Event handlers that recur across pages — pagination change, page-size
  change, filter reset, search debounce, refresh / refetch trigger —
  **must be abstracted** into a shared hook or shared handler. Do not
  paste the same `onChange` body across pages.
- Prefer **reusable hooks over inline functions** for any handler that
  carries non-trivial logic (page-1 reset on filter change, debounced
  search, refresh-key bump on data mutation).
- Canonical examples to reuse, not re-implement:
  - Page / page-size state → `usePagination` from
    [components/shared/Pagination.tsx](components/shared/Pagination.tsx).
    Filter `onChange` handlers must call `resetPage()` from the hook
    (mirrors the legacy `fn_loadData(input, option=true)` reset).
  - Data fetch on mount + refetch → `useApiData` from
    [lib/api/useApiData.ts](lib/api/useApiData.ts).
- New cross-cutting handler patterns (debounce, refresh key, selection)
  land in `hooks/` the first time a second page needs them.

### 6. Print / Export Rule

- **Never implement print or export per page.** The shared utility is
  the only sanctioned path.
- **Print** → [lib/print.ts](lib/print.ts) `printReport({ title, summary,
  columns, rows })`. Calling `window.print()` directly on the live DOM
  is forbidden — see [§6d Print](#6d-print) for the full contract.
- **Excel export** → [lib/excel.ts](lib/excel.ts) `exportExcel(...)`,
  consumed via the shared [hooks/useExcelExport.ts](hooks/useExcelExport.ts)
  hook. The hook walks the page's current View Setting items, drops
  special CHECKBOX/ETC + `USE_YN='N'` rows, sorts by `DISP_ORD`, and
  ships the resolved column list + filter map + `sortParams` to the
  per-resource backend endpoint. The backend (Apache POI) generates
  the XLSX and streams it back; the frontend saves the blob. **CSV
  export is not sanctioned** — pages must NOT roll their own CSV
  download (the legacy Account Inquiry CSV path was removed when the
  shared XLSX landed). See [§13b Excel export](#13b-excel-export--shared-helper-shared-hook-never-per-page)
  for the full contract.
- Toolbar buttons (List / Print / Excel) always go through
  [`<PageActionButtons>`](components/shared/PageActionButtons.tsx) per
  [§6a](#6a-shared-toolbar--pageactionbuttons). Never roll a bespoke
  toolbar to expose a non-shared print/export handler.

### 7. UI Consistency Rule

- Shared components own **spacing, font size, and interaction
  behaviour**. A page may not override these via inline classes, inline
  styles, or local CSS.
- Tables: header + body text are `text-wb-13` (per
  [§5 / Table typography](#table-typography-header--body)). Header
  weight `font-semibold`, body weight `font-medium`.
- Pagination: state + page-size logic + count format come from
  `usePagination` + `<Pagination>` (per
  [§4 Pagination](#4-pagination)). No page declares its own `useState`
  for `page` / `pageSize` or hardcodes a page-size options array.
- Buttons, dialogs, inputs, dropdowns, calendar triggers: shared
  components only. New visual variants extend the shared component or
  add a token to `app/globals.css` `@theme inline` first — never
  inline `text-[Npx]` / `font-[N]` / `style={{ fontSize: ... }}`.
- A page that needs a size, weight, or behaviour the shared component
  does not expose **extends the shared component first**, then consumes
  the new prop / variant. Forking is not permitted.

### 8. Scroll / UI Behaviour Rule

- Scrollbar styling is centralised in
  [app/globals.css](app/globals.css) under "Custom scrollbar — Figma
  WB365" — the three utility classes `custom-scrollbar`,
  `custom-scrollbar-y`, `custom-scrollbar-x`. Every scrollable surface
  in the app must use one of them.
- **No per-page or per-component scrollbar overrides.** No inline
  `::-webkit-scrollbar*` rules, no `scrollbar-width: none`, no
  `scrollbar-color` overrides. If a new variant is genuinely needed,
  extend the utility classes in `globals.css` once — then consume.
- **Native arrow buttons (up/down) are removed globally** via the
  shared rule `::-webkit-scrollbar-button { width: 0; height: 0;
  display: none }` in `globals.css`. Do not undo or override this. The
  WeCMS contract is "thin visible 6 px scrollbar, thumb + track only,
  no arrows".
- Full rules + adoption table live in
  [§6c Scrollbars](#6c-scrollbars). New scroll containers extend the
  shared utilities — they don't fork CSS.

### 9. Future Development Rule (the pre-flight checklist)

Before implementing **any** new feature, hook, helper, formatter, or
component, do this in order:

1. **Search shared first.** Walk [components/shared/](components/shared/),
   [components/ui/](components/ui/), [components/layout/](components/layout/),
   [lib/](lib/), `hooks/` (when it lands), and the relevant feature
   folder. Confirm what already exists.
2. **Reuse before creating.** If a shared module covers the use case
   exactly, consume it. If it covers it *almost*, **extend the shared
   module** with a new prop / variant — do not fork.
3. **Create new only if nothing fits**, and call the decision out in
   the MR description so reviewers can confirm the abstraction is
   correctly placed (folder per §3, naming per [Coding Rules](#coding-rules),
   exported once, consumed via path alias `@/...`).
4. **A second consumer is the trigger to extract.** The moment a
   second page needs the same logic / handler / formatter, the next
   MR lifts it to the shared layer per §1 — it does not copy.

### Migration & enforcement

- These rules are **not retroactive**. Existing pages that predate the
  rule set are not refactored as part of this change. They migrate
  during their next stabilisation pass — the same cadence already used
  for §4 (Pagination), §5 (Table typography), and §6d (Print).
- New code must follow these rules from day one. A reviewer flagging
  duplicated logic, an inline scrollbar override, a per-page print
  handler, or a `services/` / `utils/` / `helpers/` folder is
  authoritative — fix in the same MR or get explicit approval in the
  description.

## Global UI Consistency Rules

Authoritative cross-page norms. Every screen must obey these — if a new need doesn't fit, extend the shared component or token, don't fork locally. This section is the quick-reference ruleset; the detail lives in [UI Implementation Baseline](#ui-implementation-baseline), [Shared UI Rules](#shared-ui-rules), and [Typography & tokens](#typography--tokens).

### 1. Top Navigation Menu
- All top-menu items share the same height, padding, icon size, text size, and active/inactive style.
- Use [components/layout/Header](components/layout/Header.tsx) + [HeaderIcons](components/layout/HeaderIcons.tsx) only — never build a custom top-nav per page.
- Icons must match the Figma assets in `public/assets/header/`.
- Standard top-menu icon size: `size-5` unless Figma specifies otherwise.

### 2. Left Sidebar Menu
- All sidebars share layout, spacing, font size, icon size, and active state via [components/layout/Sidebar](components/layout/Sidebar.tsx) + [SidebarMenuItem](components/layout/SidebarMenuItem.tsx).
- No module-specific sidebar styles.
- Sidebar item icon size is consistent with existing WeCMS pages.
- Active menu background, text, and icon colors use the shared sidebar tokens (`bg-wb-bg-active`, `text-brand`, `border-wb-sidebar`).
- Prefer Figma assets from `public/assets/sidebar/` when available.

#### 2a. Nested sidebar menu (expandable parents)

- Sidebar menu items support nested children through the `children` field on
  `NavItem` in [components/layout/Sidebar.tsx](components/layout/Sidebar.tsx).
  A parent with `children` renders as an expand/collapse **toggle** — clicking
  it rotates the chevron, does **not** navigate. Each child row carries its
  own `href` and is the real link.
- When the current URL matches any descendant, the parent group auto-expands
  and the matched child is highlighted with `bg-wb-bg-active` + `text-brand`.
- Child rows must use [SidebarMenuItem](components/layout/SidebarMenuItem.tsx)
  with `indent` so labels align under the parent's label column (the indent
  slot replaces the parent's icon glyph).
- The nested structure must be declared in the shared `bankingGroups` /
  `paymentGroups` / `addonGroups` config — do **not** build a page-specific
  sidebar component. A new screen that needs a nested list extends the shared
  config; it never re-implements a sidebar.
- Canonical example: **Banking > Current & Savings > Transaction History**
  (both VND and FCY) expands to a list of account children (WOORI 2308, BIDV
  2913, SHINHAN 6946 in FCY; BIDV 0569, VCB 8210, HD BANK 0442 in VND). The
  accounts list is sourced from [accounts.ts](components/banking/transaction-history/accounts.ts)
  so the sidebar, the redirect stubs, and the `[accountId]` route share one
  source of truth.
- Routes for nested child pages follow `/<feature>/<screen>/<child-id>` with
  a dynamic `[childId]` segment under the screen folder. The parent index
  route (e.g. `/banking/transaction-history/page.tsx`) redirects to the
  first child so the sidebar parent never renders a blank landing page.

### 3. Setting Popup Sidebar Menu
- **Entry point**: the Settings modal opens from the top-nav **Settings** menu item ([components/layout/Header](components/layout/Header.tsx)). Do **not** add extra Settings icons or buttons inside page toolbars / action rows unless Figma explicitly requires it.
- Visual baseline is the approved **Settings > Purpose modal** — see [Approved reference set](#approved-reference-set-source-of-truth).
- Expanded width: `var(--w-wb-settings-nav)` (211 px). Collapsed width: `var(--w-wb-settings-nav-collapsed)` (65 px).
- The collapse arrow toggles **only** the sidebar width. It must **not** close the modal.
- Expanded state shows icons + text + section labels; collapsed state shows icons only.
- Bottom menu group is pinned at the bottom in this order:
  - Transaction History
  - Firm Banking Settings
  - Firm Banking History
- Icons must match Figma in both expanded and collapsed states.
- The sidebar implementation is [`<SettingsNav>`](components/settings/SettingsNav.tsx) — declarative `TOP_GROUPS` / `BOTTOM_GROUPS` config. Adding a Settings submenu means appending one entry to the right group's `items` array; never fork the component.

### 3a. Settings Popup — Modal Shell + Panel Composition

The Settings modal ([`<SettingsModal>`](components/settings/SettingsModal.tsx)) is the single shell every Settings submenu mounts inside. Each submenu is a `Panel` component under `components/settings/{feature}/{Feature}Panel.tsx`. The shell + panel contract is non-negotiable — extend the shared shape, do not fork per submenu.

**Shell rules (`SettingsModal`):**

- Fixed card size: `w-[var(--w-wb-settings-card)] h-[var(--w-wb-settings-card-h)]` (1300 × 760 — matches legacy `dev.wecms.vn` `.layerPopupWrap`). `max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)]` falls back gracefully on smaller viewports.
- Mounted via `createPortal()` to `document.body`. Body scroll lock + ESC dismiss live on the shell, NOT on individual panels.
- Layout: `flex min-h-0 flex-row` — `<SettingsNav>` left, panel column right (`flex min-w-0 flex-1 flex-col`).
- The Esc / X close affordance lives on the shell at `absolute right-4 top-4 z-10`. Panels MUST NOT render their own close button.
- Each panel owns its own internal scroll region — the shell does not scroll.

**Panel composition (every `*Panel.tsx` MUST follow this shape):**

```
<div className="flex min-h-0 flex-1 flex-col">
  <Header />                                           {/* shrink-0 */}
  <Filters />                                          {/* shrink-0, optional */}
  <ScrollRegion className="custom-scrollbar … " />     {/* min-h-0 flex-1 */}
  <Pagination /> | <AddButton />                       {/* shrink-0, OUTSIDE scroll */}
</div>
```

- **Header** — `flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-14` (or `pt-[calc(var(--spacing)*14)]` for explicit token clarity). Title is `text-wb-18 font-semibold tracking-wb-tight text-wb-dark`; description below is `mt-1 text-wb-13 font-normal text-wb-muted`. The `pt-14` drops the title row below the shell's absolute Esc/X group at `top-4 right-4` so a right-side action button can occupy the natural `px-8` right edge without overlap. When the panel header has NO right-side action button (e.g. Firm Banking History, Transaction History), keep `pr-24` to reserve clearance for the Esc/X group.
- **Scroll region** — must use `min-h-0 flex-1 overflow-hidden` outer + `custom-scrollbar h-full overflow-auto` (or `overflow-y-auto`) inner per §6c Scrollbars. The `min-h-0` is what lets the flex child shrink instead of pushing pinned-bottom content (pagination, "+ Add") off the modal.
- **Pinned-bottom row** — pagination, "+ Add" button, or any always-visible footer goes OUTSIDE the scroll container as a `shrink-0` sibling. Never render pagination inside a scroll container; never let the "+ Add" button scroll with the body.
- **Borders** — Settings panels use only the shared `border-wb-table-border` / `border-wb-ntrl-4` / `border-wb-border-sidebar` tokens. Do **not** wrap the panel in an extra `border` to "frame" the content; the shell already provides the card edge. Add a border only when Figma explicitly shows one (e.g. the Users toolbar `border-y` for continuous horizontal dividers).
- **Right-side action button** — when the header has one (Bank Account list-icon, Firm Banking Settings "+ Add", Preferences Edit), use the bare-icon style for icon-only buttons (`flex … cursor-pointer rounded-md p-1 hover:bg-black/5`) and the brand-pill style for primary actions (`inline-flex … bg-brand p-2 text-wb-14 font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover`). Match the existing panels (Firm Banking Settings + Bank Account); do NOT introduce a third style.

**Read mode vs. Edit mode (canonical: Preferences, Users):**

Some panels carry two visual states — a read-only view and an edit form — gated by a single `useState<boolean>` (e.g. `isEditing` in [`PreferencesPanel`](components/settings/preferences/PreferencesPanel.tsx); `isEditing` / `isAddingUser` in [`UsersPanel`](components/settings/users/UsersPanel.tsx)). Rules:

- **One panel component handles both states.** Never split read and edit into two routes / two panels — the same scroll region, same header layout, same column widths must persist across the toggle.
- **Header swaps button group only.** Read mode → single Edit button (`Pencil` icon + `t("settings.<feature>.edit")`). Edit mode → Cancel + Save pair (Cancel = white `shadow-wb-btn`, Save = `bg-brand shadow-wb-brand-btn`). Add mode (Users) → same Cancel + Save pair, identical styling.
- **Form fields render as plain text in read mode**, as inputs in edit mode — same column template, same row heights. Switching modes must NOT shift label positions or change the panel's vertical rhythm.
- **Cancel discards local state.** Cancel/Save handlers in static-UI panels are no-ops that flip back to read mode; once the API lands, Save fires the PATCH and Cancel still discards. Never mutate the source row optimistically before Save.
- **Forms are uncontrolled / unmounted-on-cancel** so dropping back to read mode reliably clears drafts (`{isEditing && <EditForm key={user.id} />}`) — see UsersPanel for the conditional-mount + key pattern.

**Feature dialogs inside Settings (canonical: Edit Bank Account):**

Some Settings flows open a secondary dialog above the modal (Edit Bank Account opens [`<EditBankAccountDialog>`](components/settings/bank-account/EditBankAccountDialog.tsx) on top of the Settings modal). Rules:

- **Use the shared shadcn primitive** [`<Dialog>`](components/ui/dialog.tsx) — never roll a bespoke modal. The standard rhythm is fixed:
  ```
  <DialogContent>          ← only `max-w-*` may vary
    <DialogHeader>            px-6 pt-6 pr-14, gap-1
      <DialogTitle />            text-wb-18 font-semibold
      <DialogDescription />      text-wb-13 font-normal text-wb-muted
    </DialogHeader>
    <DialogBody>            px-6 py-4
      … feature content …
    </DialogBody>
    <DialogFooter>          border-t, px-6 py-3, gap-2, justify-end
      Secondary (Back/Cancel)   white + shadow-wb-btn
      Primary (Save)            bg-brand + shadow-wb-brand-btn
    </DialogFooter>
  </DialogContent>
  ```
- **Only `max-w-*` is allowed to vary** between feature dialogs — pick the smallest cap that fits the Figma column template. Padding (`px-6` / `py-4` / `pt-6`), typography (`text-wb-18` / `text-wb-13`), button heights, and the footer separator (`border-t`) are inherited from the primitive — do **not** override per dialog.
- **Conditional mount + `key` re-seed** — when the dialog edits a per-row record, render it as `{editing && <FeatureDialog key={row.id} … />}` so opening row B after row A remounts the form with row B's seed values. Never wire up an imperative reset.
- **Static-UI Save is a no-op that closes the dialog** — overlay click / X / Back / Save all just clear the parent's `editing` state. Wire the real PATCH once the backend lands.

**System dialogs vs. feature dialogs — clarification of the 500 px cap:**

The `useDialog()` 500 px max-width cap applies ONLY to **system dialogs** (warning / error / success / confirmation) — short, message-driven prompts that should never grow wide. Feature dialogs (Settings shell at 1300 × 760, Edit Bank Account at `max-w-[1024px]`, future Settings forms) are a DIFFERENT category and route through the shadcn `<Dialog>` primitive directly with their own `max-w-*` cap from Figma. Do not collapse the two categories — and do not shrink a feature dialog to 500 px just because §"Dialogs & modals" mentions the cap.

**Static-UI mock data convention (every Settings submenu):**

Each panel folder ships its own `mockData.ts` + `types.ts`:

```
components/settings/{feature}/
├── {Feature}Panel.tsx        — composition (header + filters + table + footer)
├── {Feature}Table.tsx        — bare <table> + colgroup, sticky thead
├── mockData.ts               — exported mock rows + counts
├── types.ts                  — row + filter option types
└── (feature-specific subcomponents, e.g. EditDialog, FilterRow)
```

- **Mock data lives in its own file**, never inline in the panel component. Replace with a real fetcher (`useApiData` + `lib/api/settings.ts`) once the endpoint lands — the panel composition does not change.
- **Reuse shared filter / pagination primitives.** Filters compose [`<DateField>`](components/shared/DateField.tsx) / [`<DateRangePicker>`](components/shared/DateRangePicker.tsx) / [`<SearchInput>`](components/shared/SearchInput.tsx) / dropdowns from `components/ui/`. Pagination goes through `usePagination` + `<Pagination>` per §4. Do NOT roll a per-panel pagination shape.
- **Tables use real semantic markup** — bare `<table>` + `<colgroup>` + `<thead>` + `<tbody>` + `<tr>` + `<td>`. Sticky `<thead>` (`sticky top-0 z-10 bg-wb-bg-sidebar`) so the header stays visible as the body scrolls. Header text stays on a single line — never wrap header labels by default; if Figma shows a wrapped header, document the deviation in the PR. See §7 Tables for the global rule.
- **View Setting popover for a Settings panel** still goes through the shared [`<ViewSettingPopover>`](components/shared/view-setting/ViewSettingPopover.tsx) — Bank Account is the canonical example (`DEFAULT_BANK_ACCOUNT_VIEW_SETTING_ITEMS` static defaults; Save/Reset handlers are no-ops on static UI but route through the popover's confirmation + success dialogs so the chrome reads identical to the main-page popover). Once the backend `useViewSetting(webSvcId)` is wired, swap the static defaults for the hook — the panel shape does not change.

**Excel Upload preview modals — shared shell, configurable columns, never per-page:**

Every Settings (or other) submenu that needs a "Download Excel template → Browse / Re-Select file → preview rows with per-cell error highlights → confirm Upload" flow MUST consume the shared [`<ExcelUploadDialog>`](components/shared/excel-upload/ExcelUploadDialog.tsx). The shared component owns the modal shell (Dialog at `stackLevel=2`, header bar, two-pane body, footer with Close + Upload), the step panel chrome (Step 1 / Step 2 numbered badges, file chip, Download / Re-Select buttons), the fixed-450px three-table preview region (header / scrollable body / Total footer sharing one `<colgroup>`), and the Completed / Error summary chips. Forking a new dialog for a feature-specific upload flow is forbidden — extend the shared component first if a new prop is genuinely needed.

Per-feature wrappers under `components/settings/{feature}/ExcelUploadDialog.tsx` (or any other location) supply ONLY:

- **Translated chrome strings** (title, step titles + descriptions, button labels, summary labels, total-row label). The shared component is i18n-free; callers resolve `t(...)` and pass strings.
- **Columns** — `columns: ExcelUploadColumn[]` with `{ id, label, required?, widthPx, align? }`. **Column widths MUST come from the per-feature config**; the shared shell sums `widthPx` to drive horizontal scroll, so column counts and widths can vary freely between consumers (Chart of Accounts has 5 columns, future Bank Account import might have 7, User import might have 10 — the shell does not care).
- **Rows** — `rows: ExcelUploadRow[]` keyed by column id, each cell carrying `{ value, error? }`. Static-UI mocks live in the wrapper file; once the API lands, swap `rows` for the parsed-Excel response.
- **Counts + handlers** — `completedCount`, `errorCount`, `onDownload`, `onReSelect`, `onUpload`, `uploadDisabled`. Handlers are optional during static UI; the shared component renders inert buttons when they are omitted.

**First consumer (canonical example):** [`<ChartOfAccountsExcelUploadDialog>`](components/settings/chart-of-accounts/ExcelUploadDialog.tsx) — 5 columns, 6 mock rows, 5 error cells, default-disabled Upload. Mirror this wrapper shape exactly when adding a second feature: build the per-feature `columns` and `rows`, pass everything to `<SharedExcelUploadDialog>`, never re-implement the shell.

**Forbidden patterns (caught at review):**

- Hardcoded `<col className="w-[Npx]">` chains in a per-feature Upload dialog — column widths must come from `widthPx` on each `ExcelUploadColumn` so a new feature can declare its own column set.
- Forking the modal shell (`<Dialog>` + step panel + table region) into a per-feature copy because "this upload is different" — extend the shared component's prop surface instead.
- Leaving the shared shell at `stackLevel=1` while opening from inside Settings — Settings is L1, so Excel Upload must be L2 (the shared component's default).
- Routing per-feature i18n keys through the shared component — pass pre-translated strings; the shared module imports neither `useTranslation` nor any locale file.

**Pages currently implemented under the Settings popup:**

| Submenu | Panel | Status |
|---|---|---|
| Purpose | [`<PurposePanel>`](components/settings/purpose/PurposePanel.tsx) | Approved reference (modal baseline) |
| Bank Account | [`<BankAccountPanel>`](components/settings/bank-account/BankAccountPanel.tsx) | Static UI · ViewSetting popover (static defaults) · Edit dialog ([`<EditBankAccountDialog>`](components/settings/bank-account/EditBankAccountDialog.tsx)) |
| Preferences | [`<PreferencesPanel>`](components/settings/preferences/PreferencesPanel.tsx) | Static UI · read / edit mode toggle |
| User | [`<UsersPanel>`](components/settings/users/UsersPanel.tsx) | Static UI · empty / view / edit / add states |
| Transaction History | [`<TransactionHistoryPanel>`](components/settings/transaction-history/TransactionHistoryPanel.tsx) | Static UI · tabs + filters + pagination |
| Firm Banking Settings | [`<FirmBankingSettingsPanel>`](components/settings/firm-banking-settings/FirmBankingSettingsPanel.tsx) | Static UI · Automation toggles + Linked Accounts list |
| Firm Banking History | [`<FirmBankingHistoryPanel>`](components/settings/firm-banking-history/FirmBankingHistoryPanel.tsx) | Static UI · filters + table + pagination |
| Everything else | `<PanelPlaceholder>` | Not yet built — leave as placeholder until Figma + scope arrive |

When wiring a new submenu, mirror the closest existing panel (list-with-pagination → Firm Banking History; read/edit form → Preferences; multi-mode list/detail → Users; list with edit dialog → Bank Account). Do not invent a new panel shape if an approved one already covers the case.

### 3b. Settings UI Consistency Rules

Codifies the cross-Settings UI standards established in the Settings module stabilisation pass. **User Management's Cancel/Save pair is the reference standard for every action button in the Settings module** — every Settings panel, every Settings dialog, every shared popup that opens from inside Settings (Bank Account flow, Login Credentials flow, Audit Logs, Password Confirmation, etc.) must obey the rules below. Extend the shared rules first; never fork per panel.

#### A. Settings page typography

| Element | Token chain |
|---|---|
| Page title (panel header) | `text-wb-18 font-semibold tracking-wb-tight text-wb-dark` |
| Subtitle / description (under page title) | `mt-1 text-wb-13 font-normal text-wb-muted` (the `mt-1` keeps a uniform 4 px gap below the title — drop only when Figma stacks the subtitle inside an explicit `gap-N` flex column). Use `text-wb-ntrl-8` instead of `text-wb-muted` when contrast against a card background requires it. |
| Section title (sub-heading inside a panel — e.g. Preferences "Logo" / "Information" group headings) | `text-wb-15 font-semibold tracking-wb-tight text-wb-ink` (canonical example: [PreferencesPanel.tsx:118](components/settings/preferences/PreferencesPanel.tsx#L118)). Do **not** drop to `text-wb-14` for section titles; that token belongs to body copy and form fields. |
| Dialog title (compact dialog override via `DialogTitle asChild`) | `text-wb-16 font-semibold tracking-wb-tight text-wb-dark` (only when Figma calls for the smaller compact title — default `<DialogTitle>` is `text-wb-18`) |
| Dialog description (under dialog title) | `text-wb-13 font-medium text-wb-dark/70` (or `text-wb-ntrl-8`) |
| Table header cell | `text-wb-13 font-semibold text-wb-dark` (no `tracking-wb-tight` on Settings table headers — drop it; the panel headers carry it, the table cells do not) |
| Table body cell | `text-wb-13 font-medium text-wb-ink` |
| Table sub-line (account number, time-of-day, secondary descriptor) | `text-wb-13 font-medium text-wb-ntrl-6` |
| Form label (form-row label cell) | `text-wb-13 font-medium text-wb-ntrl-8` |
| Helper / micro text (count chips, sr-only required-label, ESC chip) | `text-wb-10` to `text-wb-12` `font-medium` with `text-wb-ntrl-{6,8}` per Figma |

Forbidden in Settings panels and dialogs: any `text-[Npx]`, `leading-[Npx]`, `font-[Nweight]`, or inline `style={{ fontFamily | fontSize | fontWeight | lineHeight }}`. The single sanctioned `leading-[18px]` exception is `text-wb-14 + leading-[18px]` for textarea body copy where the WB365 token list does not yet carry the 14/18 pairing — call out in the PR description and document at the top of the file.

#### B. Settings button system

The User Management Cancel/Save pair is the **reference standard** for every action button in Settings. Reproduce its token chain literally — do not adapt, do not omit:

```
flex h-8 cursor-pointer items-center justify-center
rounded-md
bg-{white | brand | wb-ntrl-4}
px-3
text-wb-14-tight font-medium
[tracking-wb-tight when Figma shows tighter tracking — default off for Settings]
text-{wb-dark | white | wb-ink | wb-ntrl-10}
shadow-{wb-btn | wb-brand-btn | none-when-disabled}
hover:{bg-black/[0.03] | bg-brand-hover}
```

**Button taxonomy:**

| Variant | Token chain | Where it's used |
|---|---|---|
| **Page CTA** (panel header "+ Add", "Edit", "Save", "Cancel") | white + `shadow-wb-btn` (secondary) **or** `bg-brand` + `shadow-wb-brand-btn` (primary) — always `h-8 px-3 text-wb-14-tight font-medium` | Settings panel right-side actions; dialog footers |
| **Dialog footer secondary** (Cancel, Back, Close) | `flex h-8 … bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]` | Every Settings dialog |
| **Dialog footer primary** (Save, Next, Login, Confirm) | `flex h-8 … bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover` | Every Settings dialog |
| **Disabled primary** (Next/Save while form incomplete) | `flex h-8 … bg-wb-ntrl-4 px-3 text-wb-14-tight font-medium text-white cursor-not-allowed` (no shadow) | GdtCredentials, SelectBank, SelectBankAccounts, PasswordConfirmation, SelectLoginInstitution, LoginIdPassword, EditLoginIdPassword |
| **Inline row Edit/Delete (text+icon pill)** (Approval Line table) | `inline-flex h-8 px-2.5 text-wb-13 font-medium rounded-md` — height stays 32 px to match the global system, but font drops one notch and padding tightens to clear the 60 px row | Per-row text+icon pills only |
| **Inline row Edit/Delete (icon-only square pair)** (Chart of Accounts table) | `flex size-7 cursor-pointer items-center justify-center rounded-md` — Edit uses `bg-white text-wb-ntrl-8 shadow-wb-btn`; Delete uses `bg-white text-wb-red-07 shadow-[0_0_0_1px_var(--color-wb-red-04)] hover:bg-wb-red-04/10`. **`size-7` is intentional here** — the established 28 px icon-only inline pair pattern, paired together via `gap-1.5`. Do not change to `size-6` to "match" the kebab convention. | Per-row icon-only Edit/Delete pair only (Chart of Accounts is the canonical example) |
| **Icon-only / kebab buttons** | `flex size-6 cursor-pointer items-center justify-center rounded-md bg-white text-wb-ink shadow-wb-btn hover:bg-black/[0.03]` with a `size-3.5` icon child | Per-row kebab menu trigger; per-row download glyph; per-row edit-pencil chip; Audit Logs / Registered Login Credentials inline body chips |
| **Destructive ghost button** (Delete a contact, remove an approver) | `inline-flex h-8 px-2 text-wb-14 font-medium text-wb-red-07 hover:bg-black/[0.03]` (no border) **or** `border border-wb-red-04 bg-white shadow-wb-warning-btn` when emphasised | AddNewContactDialog Delete; ApprovalLineDialog Remove approver |
| **Brand-asset buttons** (Excel-green Upload chips on Contacts / Chart of Accounts / VAS Account) | `bg-[#1f7a4d]` / `bg-[#15803d]` + matching hover hex — **the only sanctioned inline-hex chrome in Settings**, because the Figma asset color does not map cleanly to a wb token. New brand-asset chrome must follow the same exception rule and be called out in the PR description. |

**Rule against `p-2 + leading-4 = 36 px` antipattern.** Never size a button with `p-2` + `text-wb-14 leading-4` and rely on the line-height to control height — it produces 36 px buttons (8 + 16 + 8 + line-height padding) that read as oversized next to the canonical 32 px standard. Always declare the height explicitly via `h-8` (or `h-6` for compact pop chrome, or `h-9` only when Figma shows a 36 px input/button). The PermissionDialog footer + every shared popup footer were caught regressing into this antipattern — do not reintroduce it.

**Rule against `leading-*` for height control.** Line-height controls glyph rhythm inside the button; height controls box height. They are independent. Drop redundant `leading-4` when the button already has `h-8` and a single line of text — the line-height is implicit from the text token (`text-wb-14-tight` already pairs to 16 px leading).

#### C. Settings dialog system

Every Settings dialog routes through the shadcn [`<Dialog>`](components/ui/dialog.tsx) primitive. Inherit the rhythm from §3a and apply these Settings-specific defaults:

- **`DialogTitle` + `DialogDescription` are the canonical title/subtitle slots.** Use them on every Settings dialog so Radix's a11y wiring pairs the right `aria-labelledby` / `aria-describedby` automatically. When a Settings dialog has no description, pass `aria-describedby={undefined}` on `<DialogContent>` to opt out of the warning — never substitute a third-party heading element.
- **`asChild` overrides only when the compact-dialog 16 px title is required.** Default is the primitive's `text-wb-18`; Settings dialogs that mirror the legacy compact frame (PermissionDialog, ApprovalLineDialog, EditBankAccountDialog header) override via `<DialogTitle asChild><h2 className="text-wb-16 font-semibold tracking-wb-tight text-wb-dark">…</h2></DialogTitle>`. Do not `asChild`-wrap to inject a custom font weight or color when a token already covers it.
- **Header / Body / Footer spacing inherits from §3a** (header `px-6 pt-6 pb-4`, body `px-6 py-4`, footer `border-t px-6 py-3 gap-2 justify-end`). The Settings-specific Audit-Logs frame uses `px-6 py-4` for the footer instead of `py-3` — match Figma per dialog; do not invent a third footer rhythm.
- **Footer button order** — secondary (Cancel/Back/Close) on the LEFT, primary (Save/Next/Login/Confirm) on the RIGHT, separated by `gap-2`. Single-button footers (Audit Logs Close) right-align with `justify-end`.
- **Modal radius** — every Settings dialog uses `rounded-2xl` (16 px). The Settings shell itself uses `rounded-xl` (12 px) to match the legacy `.layerPopupWrap`. Do not introduce `rounded-[Npx]` literals; if Figma shows a different radius, add a token to `app/globals.css` first.
- **Close-icon and kebab-icon sizing** — the standard top-right X close icon comes from `<DialogContent>` at `size-4`. Header kebab triggers (FirmBankingDetailsDialog, etc.) use `size-6` with a `size-3.5` icon child — mirror the per-row kebab convention from §B.
- **`stackLevel` is non-negotiable.** Settings shell = 1 (the L1 root); first child opened from inside Settings = 2; sibling child opened from a level-2 popup = 3; rare deeper child = 4. Never ship a Settings child dialog with `stackLevel={1}` (the default) — the cumulative dim will compound to opaque.

**Excel Upload dialog (consumed by Settings flows — Chart of Accounts, Contacts, VAS Account):**

- The shared shell is [`<ExcelUploadDialog>`](components/shared/excel-upload/ExcelUploadDialog.tsx). It is the **only** sanctioned Excel upload modal — per-feature wrappers supply config (columns, rows, translated chrome) and never fork the shell.
- Footer **Close** + **Upload** buttons follow the §B canonical button system: `h-8 px-3 text-wb-14-tight font-medium`. The Upload button is the primary (`bg-brand` + `shadow-wb-brand-btn`) when enabled and `bg-wb-ntrl-4 cursor-not-allowed` when disabled — same rhythm as every other Settings dialog footer. **Never** size the Upload button at `h-9 px-4 text-wb-14` — that was the legacy variant before standardisation.
- Step-title labels (Step 1 / Step 2 / Step 3) use `text-wb-13 font-semibold text-wb-dark` per §A. Step badge chips use `rounded-sm bg-wb-ntrl-3 text-wb-dark`. The Total footer cell uses `bg-wb-bg-card text-wb-dark`. The file-name chip and body cells use `text-wb-dark`. **No `text-black`, no inline `#1b1b1b`, no `bg-[#fafafa]` / `bg-[#e9e6e6]`** — those were caught regressing during the V1–V6 cleanup pass and must not return.
- Excel-action **brand-green chips** on the page-level "Excel Upload" trigger button (Contacts `bg-[#15803d]`; Chart of Accounts / VAS Account `bg-[#1f7a4d]`) are documented intentional exceptions per §F — keep the inline hex; do not migrate to a wb token.
- Modal radius is `rounded-md` (the shared shell uses 6 px not 16 px because Figma 1797:21002 calls for the smaller corner). Do not change to `rounded-2xl` to "match" other Settings dialogs — the upload shell is a deliberate visual sibling of the institution picker, not the form-dialog family.
- `stackLevel={2}` when consumed from inside Settings (Chart of Accounts / Contacts / VAS Account); the shared shell defaults to it. Do not override to `stackLevel={1}`.

**Row action menus / popovers (canonical examples: `LoginCredentialsRowMenu`, `FirmBankingRowMenu`, `AddApproverPopover`):**

- Trigger button is the §B icon-only kebab (`size-6` wrapper + `size-3.5` icon). Never size the trigger at `size-7` or `size-8` — those were caught regressing and reduced.
- Menu container uses `bg-white rounded-md p-1 shadow-[layered-popup]` with the canonical 3-stop popup shadow (1 px hairline + 2 px crisp + 6 px diffuse). Do not invent a per-feature shadow.
- Each menu item is a `flex items-center gap-1 rounded p-2 text-wb-14 font-medium tracking-wb-tight` row with a `size-4` icon. Hover paints `bg-wb-bg-sidebar`. Destructive items keep the canonical red icon + label color (`text-[#bd1822]` until a dedicated `text-wb-red-deep` token lands per §F).
- Anchor positioning uses `createPortal` + `position: fixed` with `pointer-events-auto` — never inline-render inside the row, never let the menu clip on table-cell `overflow: hidden`.
- Inline body action chips (Edit pencil / Disconnect / Add Login on `RegisteredLoginCredentialsDialog`; Remove approver on `ApprovalLineDialog`) follow the §B icon-only kebab variant (`size-6` + `size-3.5` icon, `rounded`) — never size at `rounded-[4px]` literal.

#### D. Settings table system

- **Bare `<table>` + `<colgroup>` + sticky `<thead>`** — Settings tables use real semantic markup (per §3a + §7). Header row sticks to the top of the scroll region with `sticky top-0 z-10 bg-wb-bg-sidebar`.
- **Header cell** — `whitespace-nowrap border-b border-wb-table-border bg-wb-bg-sidebar px-3 py-3 text-left align-middle text-wb-13 font-semibold text-wb-dark`. Drop `tracking-wb-tight` from Settings table headers — it appears on panel page-headers, not table cells.
- **Body cell** — `px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink`. Multi-line stacks (Date/Time stack in Audit Logs, account-number sub-line) place the muted secondary on `text-wb-ntrl-6`. Never mix font sizes within a cell.
- **Body row** — `border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]` (or `bg-wb-bg-active` / `bg-brand-soft` for selected). Row height defaults to `h-16` for two-line cells; single-line tables follow `--h-wb-table-row` (60 px).
- **Status badge** — Settings status pills consume the existing `bg-wb-status-{variant}-{role}` tokens or, for non-status chips that match a Figma exact-match (e.g. `#cee9ff`/`#0069b9` = `bg-brand-softer`/`text-brand-active`), the brand softer/active pair. Never inline a hex when an exact-match token exists.
- **Action column rules** — kebab menu trigger sits in its own column (the last `<col>`) at `size-6` per §B. Inline Edit/Delete pairs are `h-8` with `text-wb-13` per §B.
- **No outer decorative `border` around the Settings table.** The panel scroll region and the row hairlines (`border-b border-wb-table-border`) are the only sanctioned visual edges. Add an extra outer border only when Figma shows one (Users toolbar `border-y` is the documented exception).

#### E. Token rules

- **No inline px sizes** in Settings panels or dialogs. `text-[Npx]`, `leading-[Npx]`, `rounded-[Npx]`, `size-[Npx]`, `h-[Npx]`, `w-[Npx]` are forbidden EXCEPT:
  - The two SettingsModal shell tokens (`w-[var(--w-wb-settings-card)]`, `h-[var(--w-wb-settings-card-h)]`) that consume CSS variables, not literals.
  - `var(--h-wb-filter-btn)` for filter chip heights so Settings filters line up with main-page filters.
  - The textarea `leading-[18px]` exception called out in §A.
- **No hardcoded hex** in Settings panels or dialogs. `bg-[#XXXXXX]`, `text-[#XXXXXX]`, `border-[#XXXXXX]` are forbidden EXCEPT:
  - The brand-asset Excel-green chrome (`bg-[#1f7a4d]` / `bg-[#15803d]`) called out in §B.
  - The Preferences logo-upload preview background (`bg-[#fefdf9]`) — Figma asset color, no token.
  - The Login Credentials delete-row red (`text-[#bd1822]`) — pending a `text-wb-red-{specific}` token; document the deviation in the file.
- **No `text-black` in Settings.** Use `text-wb-dark` (true ink), `text-wb-ink` (slightly off-black for body), or `text-wb-ntrl-{8,10}` for muted body — never raw `text-black` even for "obvious" cases like collapsed-shell headers or icon glyphs. The audit caught two regressions in `SettingsNav` and `ApprovalLineDialog`; do not reintroduce.
- **Prefer `wb` tokens over Tailwind defaults.** `bg-wb-bg-sidebar` not `bg-gray-50`; `text-wb-ntrl-6` not `text-gray-500`; `border-wb-table-border` not `border-gray-200`. The Tailwind default neutrals are not part of the WB365 system.
- **Status / brand exact-match swaps** — when a Figma hex maps cleanly to an existing wb token, swap. Documented exact matches:
  - `#cee9ff` / `#0069b9` → `bg-brand-softer` / `text-brand-active` (light blue active pill)
  - `#e9f5ee` / `#04662e` → `bg-wb-status-approved-bg` / `text-wb-status-approved-text`
  - `#fff7ed` / `#d97706` → `bg-wb-status-pending-bg` / `text-wb-status-pending-text`
  - `#edf7ff` / `#ebf7ff` → `bg-brand-soft` (selected row tint)

#### F. Intentional exceptions to document

Single source of truth for every sanctioned deviation from §A–§E. **Every entry below is intentional** — do not "fix" any of them in a stabilisation pass. New deviations require an entry in this table and a one-line PR description note.

| Exception | Where it lives | Reason |
|---|---|---|
| `bg-[#1f7a4d]` + `hover:bg-[#196439]` Excel-action chip | [VasAccountPanel.tsx:163](components/settings/vas-account/VasAccountPanel.tsx#L163) · [ChartOfAccountsPanel.tsx:117](components/settings/chart-of-accounts/ChartOfAccountsPanel.tsx#L117) | Figma Excel-action brand chrome — green-asset color does not map to a wb token |
| `bg-[#15803d]` + matching shadow Excel-action chip | [ContactsPanel.tsx:171](components/settings/contacts/ContactsPanel.tsx#L171) | Same Figma brand-asset chrome, slightly lighter green per the Contacts frame |
| `bg-[#fefdf9]` logo-upload preview background | [PreferencesPanel.tsx:142](components/settings/preferences/PreferencesPanel.tsx#L142) | Figma asset color (off-white card with cream tint), no wb token equivalent |
| `text-[#bd1822]` destructive row label + icon | [LoginCredentialsRowMenu.tsx:193,197](components/settings/login-credentials/LoginCredentialsRowMenu.tsx#L193) | Pending dedicated `text-wb-red-deep` token; document at file top |
| `rounded-[12px]` shell radius | [SettingsModal.tsx:111](components/settings/SettingsModal.tsx#L111) | Legacy `.layerPopupWrap` (`dev.wecms.vn`) compatibility — every Settings shell historically uses 12 px corners; do not migrate to `rounded-xl` without product approval |
| `text-wb-14 + leading-[18px]` textarea/input rhythm | [AddNewContactDialog.tsx:379,762](components/settings/contacts/AddNewContactDialog.tsx#L379) · [PreferencesPanel.tsx:301](components/settings/preferences/PreferencesPanel.tsx#L301) · [FirmBankingDetailsDialog.tsx:267,270,276,281](components/settings/firm-banking-settings/FirmBankingDetailsDialog.tsx#L267) | Figma input glyph rhythm — 14/18 pairing not yet in `@theme inline`. **Not a button-height control** — these are textareas / form values, not interactive button surfaces. |
| `h-9` tab strips | [PurposeTabs.tsx:32](components/settings/purpose/PurposeTabs.tsx#L32) · [TransactionHistoryTabs.tsx:46](components/settings/transaction-history/TransactionHistoryTabs.tsx#L46) | Tab navigation, not a button per the §B taxonomy. The 36 px tab-strip height is a separate primitive; do not collapse to `h-8`. |
| `size-7` icon-only Edit/Delete pair | [ChartOfAccountsTable.tsx:216,230](components/settings/chart-of-accounts/ChartOfAccountsTable.tsx#L216) | Established inline row-action pattern — paired together via `gap-1.5`, intentional 28 px to balance the 60 px row. Distinct from `size-6` kebabs (single trigger) and `h-8` Edit/Delete pills (Approval Line). |
| `size-7` UploadCloud glyph | [UserAvatarUpload.tsx:24](components/settings/users/UserAvatarUpload.tsx#L24) | Decorative SVG icon (not a button). Sized to fill the avatar drop-zone; the `lucide` cloud at `size-7` is the Figma spec. |
| `text-[9px]` close-icon badge | [SelectBankDialog.tsx:318](components/shared/popups/SelectBankDialog.tsx#L318) | Specific Figma micro-glyph; no `text-wb-9` token exists. Pending a `text-wb-09` token addition; document at file top until then. |
| `rounded-[16px]` + inline 3-stop shadow popover | [FirmBankingHistoryDetailPopover.tsx:223](components/settings/firm-banking-history/FirmBankingHistoryDetailPopover.tsx#L223) | Specific Figma 6270:25829 popover frame (not a `<DialogContent>`); awaiting `bg-wb-popup` + `shadow-wb-popup` tokens before migration. |
| `rounded-[6px]` + `rounded-[7px]` + `rounded-[4px]` micro-radii | [SelectBankDialog.tsx:190,244,260](components/shared/popups/SelectBankDialog.tsx#L190) | Specific Figma micro-corners on bank picker chip and dropdown; pending one-MR cleanup to `rounded-md` / `rounded`. Not blocking; queue for next stabilisation. |
| `rounded-[4px]` count badge / remove-approver / popover row | [ApprovalLineTable.tsx:85](components/settings/approval-line/ApprovalLineTable.tsx#L85) · [ApprovalLineDialog.tsx:345](components/settings/approval-line/ApprovalLineDialog.tsx#L345) · [AddApproverPopover.tsx:327](components/settings/approval-line/AddApproverPopover.tsx#L327) | Same as above — pending one-MR cleanup to `rounded`. Not blocking; queue for next stabilisation. |
| `h-12` approval-table inner rows | [ApprovalLineDialog.tsx:286,295](components/settings/approval-line/ApprovalLineDialog.tsx#L286) | Approval Line dialog's inner approver table — single-line row, 48 px is the Figma spec. Distinct from the panel-table `--h-wb-table-row` (60 px) which carries two-line cells. |
| `bg-black/15` border on Excel Upload file-name chip | [ExcelUploadDialog.tsx:459](components/shared/excel-upload/ExcelUploadDialog.tsx#L459) | 15 % black hairline reproduces the Figma chip border; the project carries no `border-wb-15` token and the existing neutral borders read too dark. |
| `border-[#e0e0e0]` / `border-[#d9d9d9]` structural dividers | [ExcelUploadDialog.tsx:254,357,405,440](components/shared/excel-upload/ExcelUploadDialog.tsx#L254) | Internal step-panel dividers per Figma; pending decision on whether to consolidate to `border-wb-border-sidebar` once the design system reviews. Not user-visible as inconsistency. |
| `text-[#04662e]` / `text-[#cb0d0d]` summary chip colors | [ExcelUploadDialog.tsx:584,588](components/shared/excel-upload/ExcelUploadDialog.tsx#L584) | Completed/Error chip text colors; map cleanly to `text-wb-status-approved-text` / a future `text-wb-status-error-text` once the latter token lands. Queue with the §E exact-match swap list. |

#### G. Scope rule

- These rules apply to **every page rendered inside `<SettingsModal>`** (every `components/settings/{feature}/{Feature}Panel.tsx`) and **every shared popup that opens from inside Settings** (`components/shared/popups/*Dialog.tsx`, `components/shared/excel-upload/ExcelUploadDialog.tsx` when consumed by a Settings flow).
- They do **not** apply to unrelated modules (Banking, Payment, Add-on, Reports) unless explicitly requested. Banking pages keep the Banking page-header conventions; Payment list/detail pages keep the §12 / §12a rules; etc. Do not migrate non-Settings pages into the Settings button height / radius / token system unless the user asks for that page-specific stabilisation pass.
- Cross-cutting components consumed by both Settings and non-Settings (e.g. `<DialogContent>`, `<SystemDialog>`, `<Pagination>`, `<DataTableShell>`, `<TableHeaderCell>`) stay governed by their own existing rule sets — Settings rules layer on top of the per-component primitives, never replace them.
- A new Settings panel or popup follows §A–§E from day one. A shared popup that may also be consumed outside Settings stays governed by §A–§E when used inside Settings; outside-Settings consumers may follow the parent module's rules instead.
- When extending — a new Settings dialog needing a new button variant, radius, or token MUST add the new token to `app/globals.css` first, then update §A–§E above to document it. Never inline a one-off in a Settings panel.

### 4. Pagination
- Always use [components/shared/Pagination](components/shared/Pagination.tsx). No bespoke pagination per page.
- Standard pagination button size: `size-7`.
- Alignment and spacing match existing approved pages.
- Page-specific variants require explicit approval before landing.
- **Pagination state and page-size logic must use the shared `usePagination` hook + `PAGE_SIZE_OPTIONS` constant exported from [components/shared/Pagination](components/shared/Pagination.tsx).** No page may declare its own `useState` for `page` / `pageSize`, slice items by hand, or hardcode a per-page options array — page-1 reset on size change, page-count clamping, and the `{shown, total}` count are owned by the hook and must not be re-implemented locally. Filter `onChange` handlers (search, bank, date, status, …) call `resetPage()` from the hook to mirror the legacy `fn_loadData(input, option=true)` reset.
- Page-size options are fixed: `[10, 20, 50, 100]` (`PAGE_SIZE_OPTIONS`). Default initial size is `10`. New pages must consume the constant — never inline a different option list. To clear row selection on a size change (legacy `$('#checkbox-all').prop('checked', false)` behaviour), pass an `onPageSizeChange` callback to the hook.
- Adoption status: Account Inquiry (VND) routes through `usePagination`. Other paginated pages in the repo predate the hook — migrate them in their next stabilisation pass; do not regress them in unrelated MRs.

### 5. Font and Font Size
- Use only the shared typography tokens (`text-wb-*`, `tracking-wb-*`) — see [Typography & tokens](#typography--tokens). No hardcoded pixel sizes or inline font styles.
- Page title, table header, table body, sidebar text, button text, and form labels stay consistent across all pages.
- Approved reference pages:
  - Account Inquiry (`/banking/account-inquiry`)
  - Approval Box (`/payment/approval-box`)
  - Sales / Expenses e-Invoices (`/addon/sales-einvoices`, `/addon/expenses-einvoices`)

#### Table typography (header + body)

- **All table components must use `text-wb-13` (13 px) for both header and body text.** Header weight is `font-semibold`; body weight is `font-medium` (or `font-normal` for explicit muted hierarchy lines such as the account-number sub-line). Font-family stays inherited from `<body>` (Inter / Noto Sans KR — never override per-cell).
- The shared [`<TableHeaderCell>`](components/shared/TableHeaderCell.tsx) defaults to `text-wb-14` for backward compatibility with pages that haven't migrated yet. Pages adopting the 13 px standard pass `textSizeClass="text-wb-13"`. New pages must adopt the 13 px standard out of the gate; never inline a different size token in a `<th>` / `<td>`.
- Do **not** mix font sizes within a single table — header, body cells, multi-line cell hierarchies (e.g. bank name + account number sub-line), and footer totals all stay at `text-wb-13`. The only sanctioned exception is when a Figma frame explicitly calls for a different size on a specific cell (e.g. a hero KPI row inside a report); document the deviation in the PR description.
- Vertical alignment, padding (`px-2.5`, `py-2.5` / `py-3` for headers), row height (`--h-wb-table-row`), and column widths are unaffected by the size change — only the inner `<span>` text token flips.
- Adoption status: Account Inquiry (VND) is migrated. Other paginated tables stay on `text-wb-14` until their next stabilisation pass; do not regress them in unrelated MRs.

### 6. Buttons
- Use [components/ui/button](components/ui/button.tsx) — do not roll bespoke button elements.
- Button height, padding, border radius, icon size, and text size stay consistent.
- Standard action icon inside a button: `size-5`.
- Small icon-only buttons may use `size-4` only when Figma specifies it.

### 6a. Shared Toolbar — `PageActionButtons`

[components/shared/PageActionButtons](components/shared/PageActionButtons.tsx) renders the list / print / export-to-Excel icon group that appears top-right on data-table pages.

**Rules (non-negotiable):**

- **Icons are opt-in.** `showList`, `showPrint`, `showExcel` all default to `false`. The component renders nothing if no flags are set. This prevents detail pages from silently inheriting the full list-page toolbar.
- **List pages** declare all three: `<PageActionButtons showList showPrint showExcel />`.
- **Detail pages** declare only list: `<PageActionButtons showList />` (Figma 8:599 — no print, no excel on detail). `PaymentDetailPage` already enforces this; do not override it per screen.
- **Never pass `onList={undefined}` to hide an icon.** That pattern only kills the handler — the button still renders. Use `showList={false}` (or simply omit the prop).
- **Do not fork or duplicate** `PageActionButtons` per page. If a page needs a non-standard action (e.g. Smart Organizer in Add-on), extend with an additional prop or create a named sibling that composes `PageActionButtons`.
- Pages with a fully custom toolbar (e.g. `SalesEInvoiceActionBar`, `OperationStatusActionBar`, `TransactionHistoryActions`) keep their own components — they predate this rule and document the divergence in a comment. Any **new** page must use `PageActionButtons` or get explicit approval in the MR.

### 6b. Icon Assets

- **Toolbar icons** come from `/assets/common/`: `ico-list.svg`, `ico-print.svg`, `ico-excel.svg`. Use with `<img>` at `size-5`. Never substitute lucide icons.
- **File card Excel type icon**: always `/assets/common/ico-excel.svg` at **`size-5`** (`aria-hidden`). Matches the toolbar standard icon size (20 px). Do NOT use `size-7` or any larger class — that was an earlier mistake. This icon marks the file type and is visually distinct from the toolbar "export" button even though both use the same asset.
- **File card download button**: the circle button wrapper is **`size-5`** (20 px — inline action size, matching the file-card text-block height). The icon inside is `/assets/common/ico-download.svg` at **`size-4`** (16 px) with `brightness-0 invert`, giving 2 px padding on each side. Never use `size-7` or larger — that produces an oversized circle that dominates the row. Never substitute a lucide icon here.
- **`brightness-0 invert` filter** is the canonical technique for rendering a dark-fill `public/assets/` SVG as white inside a solid-colored button. Apply it as a Tailwind utility class on the `<img>` tag — no inline `style`.
- **`lucide-react`** is approved for general UI glyphs (sort arrows, chevrons, info icons in table headers, etc.) — not for named business action icons (list, print, export, download). If a named icon exists in `public/assets/`, use it.
- **Per-row trailing icon buttons.** A list-row inline action (download / document chip on the right end of a list row) is **`size-4`** (16 px), wrapped in a `size-6` button — `flex size-6 cursor-pointer items-center justify-center rounded-md text-wb-ntrl-6 hover:bg-black/5`. This is **smaller** than the `size-5` (20 px) toolbar / page-header icons in §6b — list rows are 60 px tall and a 20 px glyph reads as "primary CTA". Figma 1:11730 (Transfer Result) and 1:9972 (Scheduled Transfer) both use the 16 px row glyph; if a Figma frame disagrees, follow Figma. Always `e.stopPropagation()` inside the click handler so the row's link doesn't fire when the icon is pressed.
- **Calendar trigger.** Every filter row that needs a calendar icon — whether it sits at the end of a `<DateRangePicker>` (Approval Box, e-Invoices, Transaction History, Reports) or as a sibling chip next to a period preset dropdown (Scheduled Transfer's "Last 30 Days", Transfer Result's "Last 30 Days") — must render the shared [`<CalendarIconButton>`](components/shared/CalendarIconButton.tsx). It owns the asset (`/assets/common/ico-calendar-outline.svg`), the icon size (`size-4`), the hit-area size (`size-8`), and the `aria-label` translation key. Do **not** inline `<img src="…/ico-calendar-outline.svg">`, do **not** substitute `lucide-react`'s `<Calendar>` (different stroke weight + proportions), and do **not** slot the calendar as a `leadingIcon` inside a period dropdown — it is always a sibling chip, never a leading affix. New filter rows extend the shared component before they fork.
- **Single-date input + calendar popup.** When a filter row needs a date chip whose text is the picked value AND a calendar icon that opens a picker (legacy `#TO_DT` pattern — Account Inquiry, Daily Cash, Daily Financial, future single-date filters), render the shared [`<DateField>`](components/shared/DateField.tsx). It owns the chip + `<CalendarIconButton>` + the Figma 77:12230 single-date popup (month/year dropdowns, prev/next nav, 6×7 grid with today/selected/outside-month states). One toggle is bound to BOTH the chip and the icon — clicking either opens the popup; ESC and outside-click close it; selecting a day commits an ISO `YYYY-MM-DD` value through `onChange` and the page calls its own filter-reset/refetch logic from there. Do **not** roll a per-page chip + native `<input type="date">` overlay, do **not** open a bespoke modal for a single-date pick, and do **not** duplicate the popup grid markup. New pages requiring a different display format pass `formatValue` to the shared component — extend the props before forking the file. Date-RANGE pickers (Approval Box, e-Invoices, Transaction History, Reports) keep their `<DateRangePicker>` for now; converging the two pickers onto one shared popup lands when the range picker becomes interactive.

### 6c. Scrollbars

The app ships **one** scrollbar utility, defined once in [app/globals.css](app/globals.css) under "Custom scrollbar — Figma WB365". Every scrollable surface in the app must use it; no per-component scrollbar CSS is allowed.

**Utility classes** (already defined — do not duplicate):

| Class | Use it for | Behaviour |
|---|---|---|
| `custom-scrollbar` | Containers that may scroll on either axis (e.g. `<DataTableShell>`'s shared scroll wrapper for table body + footer) | Thin 6 px track on both axes, no arrows, hover-darken thumb |
| `custom-scrollbar-y` | Vertical-only scroll containers (filter popovers, dropdown lists inside `<DateField>` / `<BankFilterPopover>`, settings sidebar nav) | Same as above + suppresses any ghost horizontal track |
| `custom-scrollbar-x` | Horizontal-only scroll containers (wide ledger tables in `<ReportLayout>` for Daily Financial / Cash Flow) | Same as above + suppresses any ghost vertical track |

**Visual contract** (Figma WB365 nodes 9184:17484 / 9184:10787):
- Track: 6 px wide, `#fafafa` bg with a `0.5 px #e5e5e5` inset border
- Thumb: `#a3a3a3` (fg-disabled); darkens to `#737373` on hover
- **No arrow buttons** — the track has only thumb + track, never up/down step buttons
- The shell-wide rule `::-webkit-scrollbar-button { width: 0; height: 0; display: none }` (in `globals.css`) also suppresses the OS-default scrollbar arrows for any plain `overflow: auto` surface that doesn't opt into `custom-scrollbar*`. Do not undo or override this.

**Rules (non-negotiable):**

- Every scrollable container must declare its scroll axis explicitly via the matching utility class. A `<div className="overflow-auto">` without `custom-scrollbar*` shows the OS-default scrollbar (still without arrows thanks to the global rule, but inconsistent thumb / track colour). Don't ship that.
- Do **not** write per-component `::-webkit-scrollbar*` rules in CSS / `globals.css` / styled blocks. If a new variant is needed (e.g. a darker thumb for a brand-blue panel), extend `custom-scrollbar*` in `globals.css` once and consume the new class — never inline.
- Do **not** hide the scrollbar entirely. The thumb + track must remain visible; only the arrow buttons are hidden.
- Do **not** apply `scrollbar-width: none` or `-webkit-scrollbar { display: none }` to make a scrollbar disappear; the WeCMS contract is "thin visible scrollbar, no arrows".
- New scroll containers in feature components extend the shared utilities — they don't fork CSS.

**Adoption** (current consumers — keep this list up to date when adding a new scroll container):

| Consumer | Class |
|---|---|
| [`<DataTableShell>`](components/shared/DataTableShell.tsx) shared table-scroll wrapper (Account Inquiry, Approval Box, e-Invoices, Operation Status, Transaction History, Internal Transfer, Card Transactions, Payment list / detail pages) | `custom-scrollbar` |
| [`<ReportLayout>`](components/shared/ReportLayout.tsx) report scroll viewport (Daily Cash, Daily Financial CMC / HS, Cash Flow) + the wide-table horizontal-scroll wrappers inside (`custom-scrollbar-x`) | `custom-scrollbar` + `custom-scrollbar-x` |
| [`<DateField>`](components/shared/DateField.tsx) month / year dropdowns | `custom-scrollbar-y` |
| [`AccountInquiryPage`](components/shared/AccountInquiryPage.tsx) bank-filter popover list | `custom-scrollbar-y` |
| [`<Sidebar>`](components/layout/Sidebar.tsx) banking-account nested list | `custom-scrollbar-y` |
| [`<SettingsNav>`](components/settings/SettingsNav.tsx) modal sidebar | `custom-scrollbar-y` |
| [`<TransferDialog>`](components/banking/internal-transfer/TransferDialog.tsx) account list | `custom-scrollbar-y` |
| [`<PurposePanel>`](components/settings/purpose/PurposePanel.tsx) settings tree | `custom-scrollbar-y` |
| [`<ExchangeRateInquiryPage>`](components/payment/overseas-payment/ExchangeRateInquiryPage.tsx) currency matrix | `custom-scrollbar` |

### 6d. Print

Every page that exposes a Print toolbar action must funnel through the shared [`printReport`](lib/print.ts) helper. **Calling `window.print()` directly on the live DOM is forbidden** — it would include the sidebar, top nav, page header buttons, filter row, checkbox column, and pagination in the print output, which never matches the legacy contract.

**Rules (non-negotiable):**

- **Use `printReport({ title, summary, columns, rows })` from `lib/print.ts`.** It opens a fresh popup window, writes a self-contained HTML document with title + optional summary + table, and triggers `window.print()` on that popup. The live page DOM is never printed. Mirrors the legacy `_v2common.app.setUpPrintTable(...)` contract.
- **Print source is the page's filtered, in-memory dataset** — bank-filter / search / status filters applied, but BEFORE pagination so the user gets the full result set. This matches `fnsh_0001_001.printAllTable` which clones the entire `tbody`, not the current page slice.
- **Columns must match the on-screen table** minus the checkbox column. Each `PrintColumn` carries `header`, optional `align: "right"`, and a `render(row): string` returning HTML. Untrusted strings inside `render` MUST go through the exported [`escapeHtml`](lib/print.ts) helper — the print pipeline does not auto-escape.
- **Built-in utility classes** for cell content: `.muted` (greyed sub-line), `.small` (12 px), `.err` (red error tag). Use them directly in `render` output. Page-specific classes are NOT supported — extend `lib/print.ts` first if the design needs more.
- **Default orientation is landscape** (`@page { size: landscape; margin: 10mm }`). Override via `orientation: "portrait"` only when a specific report needs it.
- **Do not write per-page print CSS in `globals.css` or component files.** No `@media print { … }` rules anywhere except the document the print helper itself emits — that document is the only print surface.
- **Popup blocked → graceful fallback to `window.print()`** is built into the helper. Pages must not catch the fallback themselves.

**Adoption** (current consumers — keep this list up to date):

| Consumer | Print source | Columns |
|---|---|---|
| Account Inquiry (VND) — `<AccountInquiryPage>` | `filtered` (bank + search applied) | Bank · Account Nickname · Balance · Available Balance · Last Update |

Other pages that currently expose a Print icon but still call `window.print()` (or have an inert handler) must migrate to `printReport(...)` in their next stabilisation pass; do not add new pages with raw `window.print()`.

### 7. Tables
- Use real semantic table elements: `<table>`, `<thead>`, `<tbody>`, `<tfoot>`, `<tr>`, `<td>`. Never simulate rows with `<div>`.
- Total/footer rows must align with the column widths of the body — share a `<colgroup>` across `<thead>` / `<tbody>` / `<tfoot>` (see [ApprovalTableColumns](components/payment/approval-box/ApprovalTableColumns.tsx)).
- For long tables:
  - body may scroll
  - total/footer rows stay visible when the design requires it
- Choice of shadcn `<Table>` vs. bare `<table>` + colgroup is covered in [Known Inconsistency — two table patterns](#known-inconsistency--two-table-patterns).
- **Headers stay on a single line by default.** Use `whitespace-nowrap` on header cells (the shared [`<TableHeaderCell>`](components/shared/TableHeaderCell.tsx) and the bare-table `<HeaderCell>` helpers already do this) and size the column wide enough to fit the longest header label per the §7 column-width-sizing math. Wrap a header label only when Figma explicitly shows it wrapped — and document the wrap in the PR description.
- **Do not wrap a table in a decorative outer `border`** to "frame" the data area. The shared shells (`<DataTableShell>`, `<ReportLayout>`, Settings panel scroll regions) and the row-separator hairlines (`border-b border-wb-table-border`) are the only sanctioned visual edges. Add an extra outer border only when Figma shows one — and use the existing `border-wb-*` token, never an inline `#hex`.

#### Column-width sizing math (non-negotiable)

Each `--w-wb-*-{col}` token must satisfy the **header-math** formula, not the body-math one. Headers render at `text-wb-14 font-semibold` and carry a 16 px sort glyph; bodies render at `text-wb-13 font-medium`. Sizing for the body alone produces cells that look fine until you load real header text, at which point labels collide with the sort glyph or wrap.

**Required width** (per column, in px):
```
ceil(label_width @ 14/600) + 4   // gap to sort glyph
                          + 16  // sort glyph
                          + 20  // px-2.5 padding × 2 (left + right)
                          // = ~22 px overhead on top of label width
```

Then take `max(required_header_width, longest_body_line @ 13/500 + 20px padding)`.

**Verification before landing a new token:**

- [ ] Sum of `<col>` widths === the table's `min-w-[…]` token (no implicit shrink)
- [ ] Each header label fits at 14/600 + 16 px sort + 4 px gap + 20 px padding, no overlap into the next cell
- [ ] Body text doesn't wrap or truncate inside the chosen width (numeric right-aligned cells especially — they sit closer to the right edge)
- [ ] When the design later adds a longer header label, **bump the token** before merging — do not eyeball with `min-w-fit`

The most common regression is "header text overflowing into the adjacent column" on a viewport narrower than the table's `min-w`. The cause is always a token sized for the body and not for the header. Fix the token, never paper over with `truncate` on the header — that hides the label entirely.

### 7a. Table footer + pagination layout — Approval Box is the canonical reference

Every data-table page (Banking, Payment, Add-on) must render the bottom of the table using the same pattern as [Payment > Approval Box](components/payment/approval-box/ApprovalBoxPage.tsx). The rules below are non-negotiable — if Figma shows a different bottom layout, follow CLAUDE.md.

**Global rules (apply to every data-table page):**

- All paginated list/search pages (Banking, Payment, Add-on) must use this unified table-shell / footer / pagination system. No page-specific footer or pagination layout is allowed. Report pages (Daily Cash, Daily Financial, Cash Flow) follow §7b instead — they do NOT use pagination.
- Table body must expand to fill available height using the flex stack defined below.
- Footer (total row) + pagination must be anchored at the bottom of the content area even when there are few rows. Never place the footer directly after the body rows in compact block flow — that creates the inconsistent "total floating halfway up the viewport" look the §7a refactor exists to prevent.
- Pages with totals must align total values with the matching body columns — totals share the main table's colgroup so debit / credit / amount / balance totals sit under the columns they summarise at every viewport width.
- Multi-currency totals (e.g. Sales / Expenses e-Invoices showing VND + USD simultaneously) are rendered as multiple `<tr>` rows inside the same sibling footer `<table>` — never as separate tables or as inline `<tfoot>` rows in the main table. The whole multi-row block is the "footer area" and `mt-auto` pins it as one unit.
- Footer and pagination are shared components — reuse [Pagination](components/shared/Pagination.tsx) and the feature's shared-colgroup footer table; never invent a new pagination or a new footer-row layout per page.
- Variant pages of the same screen must share one page component (same shell, same table, same footer). Current variant pairs: Banking Transaction History VND / FCY → one [TransactionHistoryPage](components/banking/transaction-history/TransactionHistoryPage.tsx); Add-on Sales / Expenses e-Invoices → one [EInvoicesPage](components/addon/sales-einvoices/EInvoicesPage.tsx). The only permitted differences between variants are `translationPrefix` / `titleKey`, `rows`, `totals`, `dateRange`, `pagination` state, and (when genuinely needed) the `minWidth` token. If a variant needs any other layout difference, extend the shared component — do not fork.

**Required page composition — always go through `<DataTableShell>`:**

```tsx
<PageLayout>
  <PageHeader … />
  <FilterRow … />

  <DataTableShell
    table={<FeatureTable … />}                 /* <thead> + <tbody> only */
    footer={<FeatureTableFooter className="mt-auto" … />} /* sibling <table> via <DataTableFooter> */
    pagination={<Pagination … className="shrink-0" />}
  />
</PageLayout>
```

`<DataTableShell>` encapsulates the DOM chain below — DO NOT re-create it
inline per page. Kept here as implementation reference so the invariants
(flex stack, shared scroll container, `mt-auto` footer anchor, pagination
outside the scroll container) are visible in one place:

```tsx
<div className="flex min-h-0 flex-1 flex-col gap-3 pb-3">
  <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
    <div className="flex min-h-full flex-col">
      {table}
      {footer}
    </div>
  </div>
  {pagination}
</div>
```

The outer flex chain works because [`PageLayout`](components/shared/PageLayout.tsx) already gives the page `flex min-h-0 flex-1 flex-col` — the block above inherits viewport height from `<main>`, the scroll container takes the remaining space, `min-h-full` on the inner stack makes it at least the container's height, and `mt-auto` on the footer pushes it to the bottom when rows are short.

**Vertical stack (top → bottom):**
1. Table body (`<thead>` + `<tbody>`)
2. Flexible empty space — `mt-auto` on the footer expands it when rows don't fill the viewport
3. Total footer row — sibling `<table>` sharing the main table's `<colgroup>` so column widths match exactly
4. Horizontal scrollbar — inside the shared scroll container (appears only when table width exceeds the container)
5. Pagination row — OUTSIDE the scroll container, separated by the page-level `gap-3`

**Total footer row:**
- Rendered as its own `<table>` that imports the same `<colgroup>` component as the main table (see [ApprovalTableColumns](components/payment/approval-box/ApprovalTableColumns.tsx), [TransferOwnAccountsTableColumns](components/banking/internal-transfer/TransferOwnAccountsTableColumns.tsx), [TransferHistoryTableColumns](components/banking/internal-transfer/TransferHistoryTableColumns.tsx), [TransactionTableColumns](components/banking/transaction-history/TransactionTableColumns.tsx), [EInvoiceTableColumns](components/addon/sales-einvoices/EInvoiceTableColumns.tsx)). Do not inline a `<tfoot>` inside the main table — that prevents `mt-auto` from anchoring it and forces pages into hacks like `sticky bottom-0`.
- Left cell: count label (e.g. `5 document(s)`, `Total 3 Accounts`) — `text-wb-13 font-medium text-wb-ink`, `px-2.5 py-3`
- Remaining cells: totals aligned to the columns they measure. Numeric values wrapped in `font-semibold`; the surrounding cell stays at `text-wb-13 font-medium text-wb-ink`
- Background + separator: `bg-white` with `border-t border-wb-table-border` — never a coloured or heavier divider
- `min-w-*` must match the main table's `min-w-*` so both tables scroll in lockstep inside the shared scroll container

**Shared scroll container:**
- One wrapper — `custom-scrollbar min-h-0 flex-1 overflow-auto` — holds both the table body and the footer so they scroll as a single unit (vertical when page content exceeds the viewport, horizontal when viewport is narrower than the tables' `min-w-*`).
- Inside it: `flex min-h-full flex-col` on the inner stack so `mt-auto` on the footer works.
- Do not pin the footer with `sticky bottom-0`. `mt-auto` is the anchor mechanism for every listing page.

**Pagination row:**
- Always [components/shared/Pagination](components/shared/Pagination.tsx). Never per-page.
- Left: page-size dropdown (`w-[var(--w-wb-page-size)]`, 32px tall) + count text (`text-wb-13 font-medium`) in the format `{shown} of {total}` via the `common.showing_of` translation key.
- Right: arrow + page buttons at `size-7`. Active page uses a dark border, inactive pages have no border per the shared component.
- Lives OUTSIDE the scroll container, inside the `flex min-h-0 flex-1 flex-col gap-3 pb-3` block. Uses `className="shrink-0"` so it never gets compressed.

**Verification checklist before landing a new data-table page:**
- [ ] Page composes `<DataTableShell>` — not a hand-rolled scroll/flex/pagination chain
- [ ] Footer goes through `<DataTableFooter>` (via the feature-specific footer component) — not an inline `<tfoot>`
- [ ] Feature footer shares the main table's `<colgroup>` component so column widths align
- [ ] Footer passes `className="mt-auto"` so the shell can anchor it at the bottom
- [ ] Pagination is `<Pagination>` (shared) with `className="shrink-0"`; count text uses `common.showing_of`
- [ ] With 1–3 rows of data the footer sits at the bottom of the viewport (not halfway up) and pagination stays flush below it
- [ ] With many rows the body scrolls vertically and the footer + body scroll together horizontally
- [ ] Count text + page-size selector match every other page byte-for-byte

### 7a.1 Table Footer Modes

Every table/list page must use the shared table shell with one of three
explicit footer modes. The vocabulary is normative — use these names in
code (`DataTableShell` `footerMode` prop), in PR descriptions, and when
discussing a new screen. Do not invent a fourth mode; if a design needs
something new, extend `DataTableShell` / `ReportLayout` and add the mode
to this section first.

| Mode | Shell | Use when | Canonical examples |
|---|---|---|---|
| `paginationOnly` | [`<DataTableShell footerMode="paginationOnly">`](components/shared/DataTableShell.tsx) | Page needs pagination but Figma has **no totals row** | Add-on > Operation Status Inquiry |
| `paginationWithTotals` | [`<DataTableShell footerMode="paginationWithTotals">`](components/shared/DataTableShell.tsx) | Page needs pagination **and** one or more total rows (single-row totals, multi-currency totals, count-only totals — all live in the sibling footer `<table>`) | Payment > Approval Box; Banking > Transaction History; Banking > Internal Transfer (Own Accounts / History); Add-on > Sales / Expenses e-Invoices |
| `noPaginationReport` | [`<ReportLayout>`](components/shared/ReportLayout.tsx) (§7b) — **not** `<DataTableShell>` | Page is an "as-of" snapshot report, not a paginated list | Banking > Daily Cash; Daily Financial; Cash Flow |

**Rules:**

- Do **not** add a total row if the design does not require it. If Figma shows pagination only, the page is `paginationOnly` — no exceptions, no "sum just in case".
- Do **not** remove pagination if the design requires pagination. `noPaginationReport` is reserved for snapshot reports; a list that can grow across pages is always paginated.
- Do **not** create a page-specific footer or pagination layout. Every footer goes through the feature's sibling footer `<table>` (via [`<DataTableFooter>`](components/shared/DataTableFooter.tsx)) and every pagination row is the shared [`<Pagination>`](components/shared/Pagination.tsx) — no inline `<tfoot>`, no bespoke page-size/arrow markup.
- Do **not** mix modes inside one page. A screen is exactly one of the three.
- `paginationOnly` is enforced by `DataTableShell`'s discriminated-union prop type — passing a `footer` prop with `footerMode="paginationOnly"` fails the TypeScript build. If you find yourself wanting to do that, switch to `paginationWithTotals`.
- Report pages route through `<ReportLayout>` (§7b); they must never import `<DataTableShell>` or `<Pagination>`.

Figma is the page-structure reference (does this screen have totals?);
this section is the UI-system source of truth (which shell + mode
implements that structure).

### 7b. Banking Report Pages — no pagination, continuous-scroll body

Report pages render an "as-of" snapshot. They are NOT list/search results, so they must not show pagination, page-size dropdowns, or "X of Y" counts. Pagination is reserved for list/search-result pages governed by §7a.

**Pages governed by this rule** (Banking > Reports):

| Route | Component |
|---|---|
| `/banking/reports/daily-cash` | [DailyCashPage](components/banking/reports/daily-cash/DailyCashPage.tsx) |
| `/banking/reports/daily-financial` | [DailyFinancialPage](components/banking/reports/daily-financial/DailyFinancialPage.tsx) — CMC variant (default) |
| `/banking/reports/daily-financial-hs` | [DailyFinancialHsPage](components/banking/reports/daily-financial-hs/DailyFinancialHsPage.tsx) — HAENGSUNG variant |
| `/banking/reports/cash-flow` | [CashFlowPage](components/banking/reports/cash-flow/CashFlowPage.tsx) |

**Rules:**

- Report pages must **not** render [`<Pagination>`](components/shared/Pagination.tsx). Never import it here.
- Report pages must **not** use the §7a paginated-table bottom block (`flex min-h-0 flex-1 flex-col gap-3 pb-3` wrapping a scroll container + pagination). That shape only makes sense when there's a pagination sibling — reports have none.
- Report pages must **not** reuse the sibling-footer-table pattern (`EInvoiceTableFooter`, `ApprovalTableFooter`, etc.). A report that has totals renders them inline in its own table body / `<tfoot>` / highlighted row (Daily Financial's sub-total + total rows, Cash Flow's end-balance row) — not via the paginated-page footer system.
- Report content must be wrapped in the shared [`<ReportLayout>`](components/shared/ReportLayout.tsx), which owns the single continuous-scroll container every report page uses:
  ```tsx
  <PageLayout>
    <PageHeader … />
    <FilterRow … />

    {/* Single-table report (Daily Financial, Cash Flow) */}
    <ReportLayout>
      <BigReportTable />
    </ReportLayout>

    {/* OR multi-section report (Daily Cash) */}
    <ReportLayout sectioned>
      {/* Optional: centered sub-title + "As of … Currency : …" card go
          here so they scroll with the report content, per Figma. */}
      <ReportSection title="…"><SectionTable … /></ReportSection>
      <ReportSection title="…"><SectionTable … /></ReportSection>
    </ReportLayout>
  </PageLayout>
  ```
- Multi-section reports (e.g. Daily Cash) pass `sectioned` to `<ReportLayout>` which wraps children in the shared `flex flex-col gap-6` stack. All sections share the same scroll context — do not give each section its own scrollbar, and do not re-create the scroll wrapper inline per page.

**Responsive height contract — viewport-driven, never hardcoded.**

The full chain that gives a report its height is:

```
AppShell h-screen
 └─ <main>             flex-1 min-h-0 flex-col
     └─ PageLayout     flex-1 min-h-0 flex-col gap-5 px-4 md:px-6
         ├─ PageHeader  shrink-0  pt-4 md:pt-6
         ├─ FilterRow   shrink-0
         └─ ReportLayout (outer)  flex-1 min-h-0 flex-col pb-3
             └─ scroll viewport   custom-scrollbar flex-1 min-h-0 overflow-auto
```

- The viewport is locked at `h-screen` on `<AppShell>`. Every flex container down the tree carries `min-h-0` so the scroll viewport shrinks correctly on a laptop instead of pushing the page taller than the window.
- `pb-3` lives on the **outer** ReportLayout wrapper (above the scroll container), matching §7a's `DataTableShell`. The scrollbar therefore reaches the bottom of the available space and the page has the same 12 px bottom rhythm as a paginated page.
- Default desktop (1440 × 900) and laptop (1024 × 768) must both render correctly without scrolling the whole page. Only the report viewport scrolls. **Both heights are required** — passing one and not the other is a regression. Verify by resizing the browser to 1024 × 768 and confirming: (a) the filter row stays pinned at the top, (b) the page does not push past the viewport, and (c) only the report body scrolls.
- No fixed pixel heights anywhere on the report page chain. Any temptation to add `h-[Npx]`, `max-h-[Npx]`, or `min-h-[Npx]` to the page / filter / scroll container is a smell — extend `<ReportLayout>` first. The single allowed pixel value is `h-[var(--h-wb-filter-btn)]` on the filter chips themselves, never on the report container.
- Every report page (CMC + HS variants alike) routes through `<ReportLayout>`. Do **not** hand-roll a `flex-1 min-h-0 overflow-auto` block in the page component — that produces drift between variants where one renders correctly at 1024 px and the other does not.
- An optional report header — centered Figma sub-title (`text-center text-wb-18 font-semibold`) and the "As of `<date>` Currency : `<scope>`" bordered card (`rounded-md border border-wb-ntrl-4 bg-white p-4`) — renders inside `<ReportLayout sectioned>`, before the first `<ReportSection>`, so it scrolls with the report. Daily Cash is the canonical example.

**Verification checklist before landing a new report page:**

- [ ] Page composes `<ReportLayout>` (or `<ReportLayout sectioned>` for multi-section). No inline `flex-1 overflow-auto` wrapper.
- [ ] No `<Pagination>`, no `<DataTableShell>`, no sibling footer `<table>` from §7a.
- [ ] No fixed pixel heights — search the diff for `h-[`, `min-h-[`, `max-h-[` outside `--h-wb-*` tokens.
- [ ] At default desktop (1440 × 900) the report fits without overflowing the page; the scrollbar appears only when content exceeds the viewport.
- [ ] At laptop (1024 × 768) the filter row stays pinned at the top, the page does not push past the viewport, and the report viewport scrolls vertically inside the content area.
- [ ] At the narrowest table width the report scrolls horizontally inside the same viewport (no nested second scrollbar).

**Empty-state / search-result flow.**

Some report pages mirror the live JEX behaviour where the report is **not** rendered until the user clicks Search — the page boots in an empty state and only the filter row + a placeholder are visible. Daily Cash is the canonical example.

- The two states (empty placeholder vs. full report) live in the **same page component**, gated by local React state. Never route to a separate URL for the result state — the filter values stay in memory, and the URL stays stable.
- The filter row's right-side slot holds a **Search button**, not a `<SearchInput>` text field. Use the shared `<Button variant="outline">` with the lucide `Search` icon and `t("common.search")` label, sized at `h-[var(--h-wb-filter-btn)]` so it matches the filter chips on the same row.
- When the page is in the empty state, render a centered placeholder that takes the same `flex-1 min-h-0` slot a `<ReportLayout>` would — this preserves the §7b height contract so flipping to the result state does not jump the layout. The placeholder copy goes through `t(…)` and is one of:
  - `report.daily_cash.empty_message` — `Please click the "Search" button.`
  - any equivalent key for new report pages; reuse the shape, do not invent local strings.
- Clicking Search flips a single piece of state (`const [hasSearched, setHasSearched] = useState(false)`) to `true`. From that point on the page renders `<ReportLayout>` with the mock report exactly as documented above. Never gate the result on a network request in the static UI — wire the real API later via the same flag.
- The flag must be local to the page (`useState`). Do not promote it to a context, store, or query param unless multi-page recall is a real product requirement.
- Report pages remain pagination-free in **both** states.

**Decision test** — when you're about to add a new menu page, ask: *"Is this a list of records that can grow indefinitely, potentially across pages?"*
- Yes → paginated list page, use §7a.
- No (it's an as-of report, a dashboard, a read-only snapshot) → use §7b.

### 7c. Banking Report Sidebar Variants

The Reports group in the Banking sidebar can carry **multiple variants of
the same report type** — different customers / business profiles need
different snapshots, even though they all live under "Daily Financial",
"Daily Cash", etc. The variants are distinct routes with distinct page
components, not a single configurable page.

**Current variant set — Daily Financial:**

| Sidebar label | Route | Component | Initial state | Source |
|---|---|---|---|---|
| Daily Financial | `/banking/reports/daily-financial` | [DailyFinancialPage](components/banking/reports/daily-financial/DailyFinancialPage.tsx) | **Empty placeholder** — boots with filters only; report renders only after the user clicks the Search button (`hasSearched` `useState` flag, no route change) | CMC — Figma 96:41637; result snapshot mirrors live JEX `rept_0015_001.act` (per-currency Financial Status + Current Accounts ledger) |
| Daily Financial (HS) | `/banking/reports/daily-financial-hs` | [DailyFinancialHsPage](components/banking/reports/daily-financial-hs/DailyFinancialHsPage.tsx) | **Eager render** — data is shown immediately; no empty state, no Search trigger | HAENGSUNG — Figma 9183:18510 (bank-grouped ledger with Receipt/Payment codes, EN/KO descriptions, sub-total + TOTAL rows) |

The CMC variant follows §7b's *empty-state / search-result flow* (Daily Cash is the other canonical user). The HS variant deliberately does **not** — its Figma shows the ledger as the landing view. Don't unify the two flows; the variant choice is the design contract.

**Daily Financial (HS) — HS-specific layout, never reuse CMC layout:**

- The HS page (`/banking/reports/daily-financial-hs`) is a **bank-grouped
  ledger** (Figma 9183:18510): one wide table grouped by bank account,
  with `rowSpan` cells for Bank Name + Currency, sub-total per group, and
  a TOTAL row closing each currency section.
- The CMC page (`/banking/reports/daily-financial`) is a **per-currency
  status snapshot** (Figma 96:41637): two stacked sections per currency
  (Financial Status summary table + Current Accounts ledger), gated by an
  empty-state Search trigger.
- These are **different data shapes and different page shells** — copying
  the CMC `Financial Status` summary or the empty-state placeholder into
  the HS page is a bug. The HS Figma frame does not show a centered
  sub-title card, does not show per-currency status tables, and does not
  show an empty placeholder. Do not introduce them.
- The HS header row is title + (list icon · Download Excel) — both pinned
  top-right via `<PageHeader>` `children` slot. The HS filter row is
  As-of date + bank dropdown + Search button on the left, **no
  `<SearchInput>` text field**, no checkboxes, no currency-scope toggle.
  Do not import any of those here — that is the CMC variant.
- The HS Excel button MUST use `/assets/common/ico-excel.svg` per §8a.
  The CMC variant uses the same asset in icon-only chrome buttons; both
  share the asset, both forbid lucide.
- Cell rendering for empty fields is **blank** — never echo the column
  label as italic placeholder text. Doing so makes a static report look
  like a per-column search-input strip, which the Figma never shows.
  Numeric columns may use `"-"` for explicit zero/null per the
  `mockData` convention; text columns render `""`.

**Rules:**

- The Reports group in [Sidebar.tsx](components/layout/Sidebar.tsx) is
  declarative — adding a variant means appending one more `NavItem` to
  the `Reports` group's `items` array. Never hard-code variant labels in
  a page component or branch on `pathname` inside one shared page.
- Each variant has its **own route** under `app/(dashboard)/banking/reports/{variant}/page.tsx`
  and its own page component under `components/banking/reports/{variant}/`.
  Active state derives from `usePathname()` per §2 — no per-variant
  Sidebar override.
- **Never merge two customer/report designs into one page** with a runtime
  toggle. The two Daily Financial variants have fundamentally different
  data shapes (status snapshot vs. ledger) and different user flows
  (search-then-show vs. always-show); a unifying abstraction would carry
  more conditionals than code.
- Both variants **must** route through `<ReportLayout>` (§7b) and **must
  not** render `<Pagination>` or `<DataTableShell>`. The shared height
  contract, scroll container, and `pb-3` rhythm are non-negotiable for
  every report variant — only the inner table/card composition differs.
- Variant naming convention: the **default / standard** variant gets the
  bare label and bare route slug (e.g. "Daily Financial",
  `/banking/reports/daily-financial`); customer- or profile-specific
  variants append a parenthesised tag and a kebab suffix (e.g. "Daily
  Financial (HS)" → `daily-financial-hs`). Locale keys mirror the slug:
  `report.daily_financial.*` for the default, `report.daily_financial_hs.*`
  for the variant. Don't reuse the default's keys for a variant — that
  blocks the two from diverging on column labels later.
- A new variant lands in the same MR as the sidebar entry, the route
  page, the locale keys, and the CLAUDE.md row above. Don't ship a
  half-wired variant.

### 7d. Wide Report Table Rules

Report pages may contain tables whose column count is fundamentally
wider than the viewport (Daily Financial CMC's Current Accounts ledger
is the canonical example: 13 columns, ≥ 1940 px). Those wide tables
need their own horizontal-scroll wrapper so they pan in place — the
report header, as-of card, and any narrower summary tables above
them must NOT pan sideways with the wide table.

**Rules:**

- A wide report table — column count or sum-of-`<col>` widths greater
  than the laptop content area (~765 px at 1024 viewport with the
  211 px sidebar and 24 px gutters) — must be wrapped in its own
  horizontal-scroll container:

  ```tsx
  <ReportSection title={…}>
      <div className="custom-scrollbar-x w-full overflow-x-auto">
          <WideReportTable … />
      </div>
  </ReportSection>
  ```

  The wrapper owns horizontal scroll; the `<ReportLayout>` outer
  scroll container keeps the existing single vertical-scroll contract
  from §7b.

- Every column on a wide report table must declare an explicit width
  via `<colgroup>` — use pixel widths sized for the longest header
  label rendered at `text-wb-14 font-semibold`, plus the 16 px sort
  glyph and 20 px cell padding. Headers must not overlap. If a label
  needs more room than a counter column would have, give it the
  pixels it needs — never compress the column to fit the viewport.

- The table's `min-w-[Npx]` must equal (or exceed) the sum of its
  `<col>` widths. A `min-w` smaller than the col sum forces
  `table-fixed` to scale columns down proportionally, which is the
  most common cause of "header text overlapping the next cell".
  Verify the math when the table changes.

- Use `table-fixed` so column widths are honored deterministically.
  Cell text uses `whitespace-nowrap` (via `<TableHeaderCell>` /
  `<CellLeft>` / `<CellRight>`) — column widths must be sized so this
  never overflows.

- Report result sections — including summary / "Financial Status" /
  totals cards — must use the **full available content width**. They
  are NOT card-style narrow components; the live JEX reports
  (`rept_0009_001.act`, `rept_0015_001.act`) deliberately stretch
  their summary tables so right-aligned header cells (e.g. "Saving
  Accounts") pin to the page's right edge and align with the wide
  ledger below. Do not constrain summary sections with `max-w-*`,
  `w-fit`, `w-[Npx]`, or `inline-block`. Width parity comes from the
  ledger's horizontal scroll living **inside its own wrapper** (the
  `overflow-x-auto` div above) — that's what prevents wide neighbours
  from dragging the rest of the report sideways. Without a
  per-ledger horizontal-scroll wrapper, narrow summary siblings
  would still get pulled to the outer scroll container's content
  width — the wrapper is the structural fix, not a `max-w` on the
  summary.

- Vertical scroll on a report page belongs to the page/report content
  area (the `<ReportLayout>` viewport from §7b) — never inside a
  random column or table cell. The wide-table wrapper above is
  `overflow-x-auto`, not `overflow-auto`, exactly so it adds a
  horizontal scrollbar without introducing a second vertical scroll.

- Report pages must remain pagination-free per §7b. A wide-column
  ledger that grows long enough to scroll vertically does so inside
  the `<ReportLayout>` viewport — do not introduce `<Pagination>`
  on a report just because the table got wider.

- Empty state still comes first per §7b: report renders only after
  the user clicks Search. Wide-table wrappers go inside the
  search-result branch — this rule applies to variants that have
  an empty state (CMC); HS-style variants render eagerly and the
  wrapper is the direct child of `<ReportLayout>`.

- **Single-table report variants** (Daily Financial HS, Cash Flow)
  use a non-`sectioned` `<ReportLayout>` and place the wide-table
  wrapper directly inside it — there is no `<ReportSection>` shell
  because there are no sibling sections to keep aligned. The
  wrapper rule is the same — `custom-scrollbar-x w-full
  overflow-x-auto`, never `overflow-auto`.

- Wide financial report tables MUST declare per-column pixel widths
  via `<colgroup>` and a `min-w-[Npx]` that equals or exceeds the
  sum of those widths. `table-fixed` is required so widths are
  honoured deterministically. Without all three (colgroup widths,
  matching min-w, table-fixed) the headers will overlap on
  narrower viewports — that is the most common HS/CMC ledger
  regression. Verify the column-width math when the table changes;
  do not eyeball it.

**Verification checklist for wide report tables:**

- [ ] Sum of `<col>` widths ≤ table's `min-w-[Npx]` (no implicit
      column compression by `table-fixed`).
- [ ] Each header label fits inside its column at
      `text-wb-14 font-semibold + 16px sort glyph + 20px padding`
      with no overlap into adjacent cells.
- [ ] Wide table is wrapped in
      `custom-scrollbar-x w-full overflow-x-auto` inside the
      `<ReportSection>` — not at the page level, not inside the
      `<ReportLayout>` viewport itself.
- [ ] Summary / "Financial Status" / totals sections render at
      full content width — no `max-w-*`, `w-fit`, or fixed-width
      wrapper. Right-aligned header cells should reach the page's
      right edge, mirroring the wide ledger below.
- [ ] No `<Pagination>`, no `<DataTableShell>`. Empty state mirrors
      §7b: placeholder until Search.

### 7e. Report Header Layout Rules

Report pages render the header as **two horizontal rows** —
`<PageHeader>` for the title row, `<FilterRow>` for the filter row.
Each row owns a left zone and a right zone; nothing stacks under
the action toolbar in a third right-column block. Daily Financial
(HS) is the canonical example — legacy `rept_0017_001.act` + Figma
9183:18709 (header) + Figma 9183:18725 (table).

**Required header zones:**

- **Title row (`<PageHeader>`):**
  - Left — page title (`text-wb-18 font-semibold tracking-wb-tight text-wb-dark`, supplied via the `title` prop).
  - Right — action toolbar: list icon + Download Excel button (and any other action icons), grouped as a single `flex items-center gap-2` block in the `children` slot.
- **Filter row (`<FilterRow>`):**
  - Left (children) — As-of date control, account/bank dropdown, any other filter chips, and the Search `<Button variant="outline">` (lucide `Search` icon + `t("common.search")` label) that re-runs the report. All chips share `h-[var(--h-wb-filter-btn)]` so they line up.
  - Right (`right` prop) — leave **unused** unless the design genuinely carries a separate right-aligned control. Daily Financial (HS) does not — do not invent a `<SearchInput>` for this page.

**Rules:**

- The Search **button** lives inside the filter row, on the left,
  next to the other filter chips — it is the action that re-runs
  the report for the current filter values.
- Do **not** add a keyword `<SearchInput>` text field to a report
  page unless the Figma frame and the legacy WeCMS page both show
  one. Daily Financial (HS), Daily Financial (CMC), and Daily Cash
  do not — only a Search button.
- The Search button must appear **once**. Never render two Search
  buttons (one in filters + one beside an input) on the same page.
- Excel / Download / print buttons must sit in the title row beside
  the list icon. Never place them inside the table container, the
  filter row, or beside the Search button.
- Filters and actions live on **separate rows** — title+actions on
  the `<PageHeader>` row, filters+Search button on the
  `<FilterRow>` row. Don't mix actions into the filter row or
  filters into the title row.
- Header elements must not be positioned with `absolute`, negative
  margins, or `float`. The `<PageHeader>` + `<FilterRow>` pair is
  the only sanctioned mechanism for this layout.
- Variant pages of the same report family share this same shape —
  Daily Financial CMC and Daily Financial (HS) both render the
  Search button inside `<FilterRow>` and neither has a SearchInput.
  Pick the layout from the Figma frame + the legacy live page,
  not from a sibling that carries a SearchInput for unrelated
  reasons.

### 8. Icons
- Icons must match Figma or existing approved WeCMS assets under `public/assets/`.
- Do not swap in Lucide/FontAwesome glyphs that do not visually match the Figma asset.
- Standard sizes:
  - General action icons: `size-5`
  - Small compact icons: `size-4`
  - Pagination icons: follow the pagination button size

#### 8a. Custom icons must be extracted from Figma when specified

When a Figma frame names a specific icon node (e.g. `ico_file`, `ico_excel`,
`ico_list`, `ico_print`, `ico_calendar`), that exact SVG is the icon — do
**not** substitute a generic `lucide-react` / FontAwesome / Heroicons glyph
even if a similarly-named one exists. The visual weight (filled vs. stroke,
brand colour, glyph proportions) is part of the design contract.

**Rules:**

- Extract the SVG once from Figma and commit it under
  `public/assets/{section}/ico-{name}.svg`. Add a brief comment at the top
  of the SVG with its Figma node id (e.g. `<!-- Figma 9183:14761 ico_file -->`)
  so future contributors can verify the source.
- Reference the asset via `<img src="/assets/{section}/ico-{name}.svg" />`.
  Do **not** import the icon as a lucide component or paste an inline
  `<svg>` body into the page.
- The Excel button on every report page (`Download Excel`) MUST use
  `/assets/common/ico-excel.svg` (Figma 9183:18722 → `ico_file`). Do **not**
  use `lucide-react`'s `FileSpreadsheet` / `FileDown` / `Download` here —
  those are stroke-only outlines and break visual parity with the
  filled-green Figma asset.
- Lucide stays allowed for **utility chrome** that has no Figma counterpart
  (e.g. `Search`, `ChevronDown`, `X`, `Check`). The split is: Figma names
  the icon → use the extracted SVG; Figma shows a generic glyph the design
  system already covers → lucide is fine.
- A new icon lands in the same MR as the page that uses it; never bulk-dump
  Figma icons.

#### 8b. Table cell composition must follow Figma exactly

A table cell is more than its column header. When Figma shows a multi-line
cell with mixed text + icon (Bank cell, Last Update cell, FileCard cell,
status-and-timestamp cells), the **placement, order, spacing, typography,
and icon choice** are all part of the design contract — none of them are
"developer's call". Eyeballing the order, swapping icons, or adopting a
"leading icon" pattern because it's what icon+text components default to
is a regression: the live JEX system + Figma decide the layout, not the
component library.

The bug this rule exists to prevent: shipping a Bank cell as
`[icon] [BankName] [VND • Current]` (icon as leading affix) when Figma
87:13141 is `[BankName] [icon] [VND • Current]` (icon as inline
separator between name and metadata). Same pieces, different reading
order, wrong design.

**Rules (non-negotiable):**

- **Open the Figma node for every cell pattern before writing the cell**
  — column header, body cell, footer cell, sub-line. Match the order
  of children, the gap, the alignment (`items-start` vs. `items-center`),
  and the per-element typography (size / weight / colour) byte-for-byte.
- **Icon placement follows Figma's child order**, not a "leading icon"
  default. If Figma puts the icon between two text spans, the JSX must
  put the icon between the same two spans — never before, never after.
- **Use the project's named asset**, not a guess. If Figma names an
  `ico_*` node, the asset under `public/assets/{section}/ico-*.svg`
  is the canonical source (per §8a). Do not substitute a `lucide-react`
  glyph just because the name sounds similar — visual weight differs
  (filled vs. stroke, glyph proportions, opacity).
- **Use the closest existing shared cell renderer when one exists.**
  If two pages render the same cell shape (e.g. bank-name-with-icon,
  account-number sub-line, last-update-with-error), the second consumer
  lifts the cell into a shared component (per the Common Reusability
  Rule §1) rather than copying. Single-use cells stay local until the
  second consumer materialises.
- **Typography tokens come from `app/globals.css` `@theme inline`**
  (per §5 / Typography & tokens). No `text-[Npx]` / `font-[N]` /
  `style={{ fontSize|fontWeight|color }}` inside a `<td>`. If the
  Figma cell uses a colour the token list doesn't carry, add the token
  to globals first, then consume — never inline the hex.
- **Sub-lines reuse the existing muted token vocabulary**: account
  numbers, "Last Update" relative timestamps, secondary descriptors all
  use `text-wb-muted` (`#828282`); error tags use `text-wb-error`. Do
  not invent a per-cell colour just because the design picker shows a
  pixel-precise hex — confirm against the token first.

**Canonical Bank cell** — reused by Account Inquiry (VND/FCY) and any
future screen that lists accounts (Figma 87:13141):

```tsx
<TableCell className="py-2.5 pr-2.5">
    <div className="flex flex-col items-start">
        {/* Row 1 — gap-1 (4px), items-start. Icon BETWEEN name and meta. */}
        <div className="flex items-start gap-1">
            <span className="whitespace-nowrap text-wb-13 font-medium leading-5 text-wb-ink">
                {bankName}
            </span>
            <img
                src="/assets/table/ico-building.svg"
                alt=""
                aria-hidden
                className="size-[var(--size-wb-icon-sm)] shrink-0 opacity-50"
            />
            <span className="whitespace-nowrap text-wb-13 font-medium leading-5 text-wb-ink">
                {currencyLabel /* "VND • Current" */}
            </span>
        </div>
        {/* Row 2 — account number, muted #828282, font-medium. */}
        <span className="whitespace-nowrap text-wb-13 font-medium leading-5 text-wb-muted">
            {accountNo}
        </span>
    </div>
</TableCell>
```

When a second page needs the Bank cell, lift this composition into a
shared `<BankAccountCell>` component under `components/shared/` and
consume it from both call sites — do not copy the JSX. The icon, the
order, the gap, and the muted account-number sub-line are part of the
shared contract; per-page deviations are not allowed.

### 9. Responsive Rule
- Every page must support desktop, laptop, tablet, and mobile — verified at 375 / 768 / 1024 / 1440.
- No fixed-width layouts that break on smaller screens.
- Use responsive fallbacks (`max-width` / `max-height`, wrapping, horizontal scroll) where needed.
- Shell/filter/table/pagination behaviour is defined in [Responsive rules](#responsive-rules).

### 10. Refactor Rule
- This repo is the WeCMS refactor from JEX to Spring Boot + Next.js.
- **Static-UI tasks update ONLY `wecms-web/`.** Do not touch `wecms-api/` (controllers, services, entities, DTOs, Flyway migrations, `application*.yml`) unless the user explicitly asks for a backend change. The api repo carries its own [Scope Guard](../wecms-api/CLAUDE.md#scope-guard--backend-changes-only-on-explicit-request) rule mirroring this — both sides agree.
- **Mock data lives in the frontend, in its own file**, never inline in the page/panel component. Convention is `components/{feature}/{screen}/mockData.ts` next to the component that consumes it (canonical examples: `components/settings/users/mockData.ts`, `components/payment/approval-box/mockData.ts`, `components/banking/transaction-history/mockData.ts`). Do not propose creating "matching" mock data on the backend or seeding the DB to fake out a static panel.
- **Reuse before creating.** Walk `components/ui/` → `components/layout/` → `components/shared/` → the relevant feature folder before adding any new component, hook, or formatter. The two-call rule (§"Common Reusability Rule") triggers extraction; never copy logic between feature panels.
- **Settings panels reuse the existing shell + composition.** Every Settings submenu mounts inside [`<SettingsModal>`](components/settings/SettingsModal.tsx) and follows the panel composition contract in §3a (Header → optional filters → custom-scrollbar region → pinned-bottom pagination/Add). Do not invent a new modal shell, do not bypass `<SettingsNav>`, and do not let pagination / Add buttons scroll with the body.
- **Match Figma + the live system.** When the user provides a Figma URL, always call `get_design_context` + `get_screenshot` per memory `feedback_figma_first.md` BEFORE writing the plan. Screenshots from the live `dev.wecms.vn` system are a valid second reference for behaviour Figma does not capture.
- Do not port legacy JSP/JEX code into this repo. The JEX trees are read-only functional reference.
- When Figma mirrors legacy behaviour, match visually; do not reimplement JEX internals.

### 11. Page header + action toolbar — single top control block

When a page's Figma shows a title, filter controls, an action toolbar (list / export / CTA), and tabs/search all above the table, those controls must render as **one top-level header block with two aligned columns** — never as a vertical stack of four separate `PageLayout` children.

**Required structure:**

```tsx
<PageLayout>
  {/* One header block — `items-start justify-between` so row 1 of each
      column sits on the same line (title ↔ toolbar). */}
  <div className="flex shrink-0 flex-wrap items-start justify-between gap-x-6 gap-y-4 pt-4 md:pt-6">
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <h1 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">…</h1>
      <FilterRow />                 {/* date range, flow radio, dropdowns */}
    </div>
    <div className="flex shrink-0 flex-col items-end gap-3">
      <ActionToolbar />             {/* list / export / Smart Organizer / etc. */}
      <TabsAndSearch />             {/* tabs + SearchInput */}
    </div>
  </div>

  <DataTableShell … />
</PageLayout>
```

**Rules:**

- The action toolbar (Excel, list view, Smart Organizer, etc.) MUST sit at the top-right of the header block, on the same line as the title — not in its own row below the filter row.
- The action toolbar must render **once, in the title-row right slot only**. Never re-render the same list/print/export icons inside the filter row — even when the page also shows an `Excel Upload` chip or a Search input in that row, those go alongside the filter chips, not duplicated next to a second copy of the title-row icons. The filter row's right side is the SearchInput slot and nothing else.
- The Search input is the only sanctioned right-side filter-row control. List / print / Excel / Excel Upload / CTA buttons all live in the title row's action group.
- Tabs + search input go directly below the toolbar in the right column — no empty vertical gap between them, no intervening row.
- The table must start immediately below the header block, separated only by `PageLayout`'s standard `gap-5`.
- No absolute positioning to lift the toolbar above other rows.
- Do not emit the title, filter row, and action toolbar as three separate `PageLayout` children — that produces the "toolbar pushed halfway down between filter and tabs" anti-pattern.
- `<PageHeader>` remains the default for simple pages (title + single right-slot). Inline this two-column block only when the page needs a two-row stack in both the left and right columns — which `<PageHeader>` cannot express. When you inline, keep the same title typography (`text-wb-18 font-semibold tracking-wb-tight text-wb-dark`) and the same top padding (`pt-4 md:pt-6`) so the visual rhythm matches other pages.
- Variant pages of the same screen (VND / FCY twins) share one page component and one header block — fix once, fix both.

**Canonical example:** Banking > Transaction History detail (VND and FCY) — see [TransactionHistoryPage.tsx](components/banking/transaction-history/TransactionHistoryPage.tsx). Matches Figma 6044:25536 / 6044:25523 / 6044:25526.

### 12. Payment Detail Page Rules

Payment Scheduled / Result list pages (Internal Transfer, Vendor Payment, Expense Payment, Payroll, Overseas Payment) must support row-click navigation to a per-row detail page. The detail screen is a route, not a dialog.

**Rules:**

- **Row-click → detail navigation.** Every Scheduled / Result list row navigates to its detail page via [PaymentListTable](components/payment/shared/PaymentListTable.tsx)'s `rowHref` prop. The list-page caller owns the URL builder (e.g. `(row) => /payment/vendor-payment/scheduled-payment/${row.id}`) and the table renders each row as `role="link"` with Enter/Space + `cursor-pointer` + `router.prefetch` on hover.
- **Route shape.** Detail routes live at `/payment/<feature>/<screen>/[id]` under `app/(dashboard)/payment/.../[id]/page.tsx`. The `[id]` segment param is awaited per Next.js 16's `params: Promise<{ id: string }>` shape. The feature component looks up the parent row in mock data and calls `notFound()` if the id is unknown.
- **Top menu + sidebar active state.** Both states inherit automatically — `Header` matches `activePrefix: /payment` and `Sidebar` matches `pathname.startsWith(item.href + "/")`. **Never** add a per-detail-page sidebar override or top-nav fork.
- **Breadcrumb header + Back button.** Detail pages render the title via [DetailHeader](components/payment/shared/DetailHeader.tsx) — `<list label> > <file/row identifier>` with a Back button on the top-right that links to the parent list route. Do not use `router.back()` (browser history) for the Back action — pin to the deterministic `backHref` so the user always returns to the right list, even on direct deep-links.
- **Reuse the shared detail layout.** Compose detail screens through [PaymentDetailPage](components/payment/shared/PaymentDetailPage.tsx) (Scheduled variant) or [ResultDetailView](components/payment/shared/ResultDetailView.tsx) (Result variant — adds `<DetailStatusTabs>` and the Date/Time + Results columns). Both wrap [DetailSummary](components/payment/shared/DetailSummary.tsx), [FileCard](components/payment/shared/FileCard.tsx), and the same `<DataTableShell footerMode="paginationOnly">` so the chrome stays identical across all 10 detail pages.
- **File card row layout.** The file chip and the toolbar (list-icon + search) share one flex row — file chip LEFT, toolbar RIGHT — per Figma 8:897. Do NOT put the search/list buttons in the page header or as a separate row. `<PaymentDetailPage>` owns this layout; never reimplement it per screen.
- **No pagination on detail pages.** Figma 8:599 has no pagination footer (the pagination frame is hidden). `<PaymentDetailPage>` always renders `<Pagination hidden>`. If a future detail screen genuinely needs pagination, add a `showPagination` prop — do not remove the `hidden` flag globally.
- **Detail summary typography.** [DetailSummary](components/payment/shared/DetailSummary.tsx) renders label + value pairs for Withdrawal Bank, Account No, Total Transfer Amount, Approval Ref., Requestor. Both the label AND the value must use **`text-wb-13`**. The value uses `font-semibold`; the label uses `font-medium text-wb-ntrl-6`. Do NOT bump the value to `text-wb-14` — detail summary data is 13 px throughout, matching table-cell body text.
- **Breadcrumb subtitle is the file name only.** Supply `subtitle={row.fileName}` — e.g. `"Internal_Transfer_241205"`. Do NOT prepend a hardcoded upload-name prefix or append `(approvalRef)`. The breadcrumb renders `<list label> > <fileName>`.
- **Account No. format.** Render as `"<accountNumber> (<currency>)"` — e.g. `"00500044787814 (USD)"`. Do NOT reverse the order to `"currency - accountNumber"`.
- **Column label type is `React.ReactNode`.** Use JSX composites for headers that require an inline icon (e.g. Remarks ⓘ) — pass a `<span className="flex items-center gap-1">…<Info …/></span>` as the label. Never substitute the icon with text.
- **File card icon sizes.** Excel type icon: `size-5` (20 px). Download button circle wrapper: `size-5` (20 px — inline action). Download icon inside: `size-4` (16 px) with `brightness-0 invert`. Do NOT use `size-7` for inline file / download actions — that was an earlier mistake. See §6b for the canonical sizes; do not override per screen.
- **Per-row highlighting via `getRowClass`.** When Figma shows row-level background tints (e.g. amber for rows with an assigned Reporting Account in Figma 8:599), pass `getRowClass={(row) => …}` to `<PaymentDetailPage>`. It threads through to `<PaymentListTable>`. Keep the logic in the feature detail component — never hardcode tints inside the shared table.
- **Inner table style matches Approval Box.** The detail transaction table goes through `<PaymentListTable>` with the standard `<colgroup>` widths, `text-wb-13 font-medium text-wb-ink` body cells, and the sticky `<thead>` from `<TableHeaderCell>`. If the table is wider than the viewport, the `<DataTableShell>` scroll container handles horizontal scroll — set `minWidth` ≥ sum of `<col>` widths per §7d.
- **Status badge vocabulary.** Scheduled details reuse [StatusBadge](components/payment/approval-box/StatusBadge.tsx); Result details and `<DetailStatusTabs>` use [PaymentResultBadge](components/payment/shared/PaymentResultBadge.tsx) with the `success / failed / pending / cancelled` ramp.
- **Result detail column set is canonical.** Every Result detail page (Internal Transfer, Vendor, Expense, Payroll, Overseas) uses [`resultDetailColumns`](components/payment/shared/detailColumns.tsx) — eleven columns matching Figma 1:13476: Date/Time, Deposit Bank, Recipient Name, Transfer Amount, Remarks ⓘ, Results, Result Date/Time, Reporting Account, Description, Document No., Banking Transaction ID. The Date/Time and Result Date/Time columns render as a two-line stack (date in ink + time in muted neutral). Reporting Account renders as a static text + breadcrumb stack — no chevron, no "Select Account" placeholder (those belong to Scheduled detail). Banking Transaction ID renders a Match CTA when `result === "success"` AND no `bankingTxnId` is set; populated rows render the ID as plain text.
- **No detail-as-dialog.** Detail views are routes, not modals. The only sanctioned exception is when the Figma frame explicitly shows a dialog (none of Sprint 2's pages do). `useDialog()` is reserved for system-level confirmations / errors / success / warnings per §"Dialogs & modals".
- **Static UI only for Sprint 2.** Detail tables run on mock sub-transactions from [detailMocks.ts](components/payment/shared/detailMocks.ts) — same id always produces the same rows so the static UI is stable across reloads. Real per-feature endpoints land later; the page shape does not change.

**Canonical example:** Payment > Vendor Payment > Scheduled Payment > Detail — see [VendorScheduledPaymentDetailPage](components/payment/vendor-payment/ScheduledPaymentDetailPage.tsx) (live JEX mirror: `pymn_0003_003.act`). Result twin: [VendorPaymentResultDetailPage](components/payment/vendor-payment/PaymentResultDetailPage.tsx) (live JEX mirror: `pymn_0004_002.act`).

**Pages governed by this rule (Sprint 2):**

| List route | Detail route | Detail component |
|---|---|---|
| `/payment/internal-transfer/scheduled-transfer` | `…/[id]` | [ScheduledTransferDetailPage](components/payment/internal-transfer/ScheduledTransferDetailPage.tsx) |
| `/payment/internal-transfer/transfer-result` | `…/[id]` | [TransferResultDetailPage](components/payment/internal-transfer/TransferResultDetailPage.tsx) |
| `/payment/vendor-payment/scheduled-payment` | `…/[id]` | [ScheduledPaymentDetailPage](components/payment/vendor-payment/ScheduledPaymentDetailPage.tsx) |
| `/payment/vendor-payment/payment-result` | `…/[id]` | [PaymentResultDetailPage](components/payment/vendor-payment/PaymentResultDetailPage.tsx) |
| `/payment/expense-payment/scheduled-payment` | `…/[id]` | [ScheduledPaymentDetailPage](components/payment/expense-payment/ScheduledPaymentDetailPage.tsx) |
| `/payment/expense-payment/payment-result` | `…/[id]` | [PaymentResultDetailPage](components/payment/expense-payment/PaymentResultDetailPage.tsx) |
| `/payment/payroll/scheduled-payment` | `…/[id]` | [ScheduledPaymentDetailPage](components/payment/payroll/ScheduledPaymentDetailPage.tsx) |
| `/payment/payroll/payment-result` | `…/[id]` | [PaymentResultDetailPage](components/payment/payroll/PaymentResultDetailPage.tsx) |
| `/payment/overseas-payment/scheduled-payment` | `…/[id]` | [ScheduledPaymentDetailPage](components/payment/overseas-payment/ScheduledPaymentDetailPage.tsx) |
| `/payment/overseas-payment/payment-result` | `…/[id]` | [PaymentResultDetailPage](components/payment/overseas-payment/PaymentResultDetailPage.tsx) |

**Pages explicitly excluded:**

- Payment > Approval Box — already routes to its own approval flow (out of Sprint 2 scope).
- Exchange Rate Inquiry — read-only rate lookup, no per-row detail. **Figma-specific UI**: currency-matrix table (rows = currencies, columns = bank rate types). Does NOT use `PaymentListPage`, `DataTableShell`, or any existing table pattern. See [ExchangeRateInquiryPage](components/payment/overseas-payment/ExchangeRateInquiryPage.tsx).
- Card Transactions — Sprint 2 ships as a list-only screen; row click is intentionally inert until the detail design lands.

**Verification checklist before landing a new Payment list / detail pair:**

- [ ] List page passes `rowHref={(row) => …}` to `<PaymentListPage>` — every visible row is keyboard-focusable and navigates on Enter / click
- [ ] Detail route is `app/(dashboard)/payment/.../[id]/page.tsx` with `params: Promise<{ id: string }>` and `notFound()` on unknown id
- [ ] Detail component composes `<PaymentDetailPage>` or `<ResultDetailView>` — never a hand-rolled summary / file / table layout
- [ ] Back button on the detail page returns to the parent list (deterministic `backHref`, not `router.back()`)
- [ ] Top nav Payment item is active on both list and detail; sidebar item is active on both list and detail
- [ ] Inner detail table goes through `<PaymentListTable>` with explicit `<colgroup>` widths and a matching `minWidth`
- [ ] All visible strings go through `t(…)` and exist in `en.json` / `ko.json` / `vi.json`
- [ ] Subtitle is `row.fileName` only — no prefix, no `(approvalRef)` suffix
- [ ] Account No. renders as `"accountNumber (currency)"` not `"currency - accountNumber"`
- [ ] File card and toolbar (list icon + search) are on the same flex row — `<PaymentDetailPage>` owns this, not the feature component
- [ ] Pagination is hidden (`<Pagination hidden>`) — detail pages never show a pagination footer
- [ ] Column header with icon uses `label: React.ReactNode` — no lucide substitution for the ⓘ icon

### 12a. Payment Module Pagination Rule (All 5 Modules)

**Global reusable rule.** Applies to every payment module: Internal Transfer, Vendor Payment, Expense Payment, Payroll Payment, Overseas Payment. Copy this section into any code review or MR description when adding or changing a payment list/detail page.

#### Rule summary

| Page type | Pagination | Total footer (VND / USD / KRW) | Total count |
|---|---|---|---|
| **List page — totals required by Figma** (Scheduled Transfer, all Scheduled Payment / Payment Result variants) | **REQUIRED** — `<Pagination>` outside the scroll container | **REQUIRED** — sibling footer `<table>` via `<PaymentListTableFooter>` | **REQUIRED** — `countLabelKey` label |
| **List page — no totals in Figma** (Internal Transfer > Transfer Result) | **REQUIRED** — `<Pagination>` outside the scroll container | **FORBIDDEN** — Figma 1:11730 shows no totals row, only pagination | **OPTIONAL** — page may still render `{shown} of {total}` in pagination |
| **Detail page** (any `…/[id]`) | **FORBIDDEN** — `<Pagination hidden>` always | **FORBIDDEN** — no footer row, no currency totals | **FORBIDDEN** — no count label |

#### How this is enforced in the codebase

- **Batch-file Scheduled list pages — ONE shared table.** Every Payment module's Scheduled list (Internal Transfer, Vendor, Expense, Payroll, Overseas) routes through [`<PaymentScheduledBatchListPage>`](components/payment/shared/PaymentScheduledBatchListPage.tsx). It owns the toolbar (Request Approval CTA + period dropdown + shared `<CalendarIconButton>` + status dropdown + SearchInput), the canonical 11-column `<th>/<td>` structure (checkbox + Date/Time + File Name + No. of Transactions + Total Transfer Amount + Approval Status + Requestor + Approver + Approval Ref + Approval Title + Action), the totals footer aligned under Total Transfer Amount, the action chip variants (`transfer` / `complete` / `document`), and the row highlight tints (`selected` / `warning`). Module-specific variation is supplied via props only — `title`, `rows`, `rowDetailHref`, `totals`, plus an optional `extraColumn` slot used today only by Overseas for the 12th-column Schedule Date insert (Figma 29:14947). **No module may hand-roll its own `<table>` / `<thead>` / `<colgroup>` / `<tbody>` for a Scheduled list.**
- **Batch-file Result list pages — ONE shared table.** Every Payment module's Result list routes through [`<PaymentResultBatchListPage>`](components/payment/shared/PaymentResultBatchListPage.tsx). It owns the toolbar (period dropdown + shared `<CalendarIconButton>` + Completed / In Progress checkboxes + SearchInput), the canonical 8-column `<th>/<td>` structure (Date/Time + File Name + No. of Transactions + Total Transfer Amount + Transfer Status + Approval Ref + Approval Title + trailing per-row download glyph), the status counter pills, and the totals footer. Pass a `totals` array for `paginationWithTotals` (Vendor / Expense / Payroll / Overseas) or omit it for `paginationOnly` (Internal Transfer Result — Figma 1:11730 shows pagination only). **No module may hand-roll its own Result list table.**
- **Per-transaction list pages with totals** still go through [`<PaymentListPage>`](components/payment/shared/PaymentListPage.tsx) — that template is for read-only per-transaction lookups (e.g. Card Transactions) where rows are individual transactions, not uploaded file batches. Never route a batch-file page through `<PaymentListPage>`.
- **Exchange Rate Inquiry is a Figma-specific UI** and must NOT use `PaymentListPage`. Its Figma frame (38:13376) shows a currency-matrix table (rows = currencies with flag icons, columns = bank rate types with two-line headers) that cannot be expressed through the shared transaction-list template. It uses a standalone custom component ([ExchangeRateInquiryPage](components/payment/overseas-payment/ExchangeRateInquiryPage.tsx)) with custom column tokens (`--w-wb-er-*`), no pagination, and an "Inquired on" timestamp footer. If a new screen has a similarly unique table shape, build a Figma-specific component rather than forcing it through an existing template.
- **Detail pages** go through [`<PaymentDetailPage>`](components/payment/shared/PaymentDetailPage.tsx) (Scheduled) or [`<ResultDetailView>`](components/payment/shared/ResultDetailView.tsx) (Result). Both hard-wire `<DataTableShell footerMode="paginationOnly">` + `<Pagination hidden>`. The footer prop is omitted entirely — `DataTableShell`'s TypeScript discriminated union prevents accidental footer injection when `footerMode="paginationOnly"`.

#### Filter chrome — Figma is the source of truth

`<PaymentListPage>` defaults to a `<DateRangePicker>` + `<SearchInput>` filter row because most Sprint 2 Figma frames show that pair. But Figma is the source of truth — when a screen's Figma shows a different filter shape (period dropdown + status checkboxes, status dropdown only, no filters at all), the page must build its own filter row from the same shared primitives. Forcing a screen through `<PaymentListPage>` and accepting an off-Figma date range is a bug, not a "good-enough simplification".

**Canonical filter shapes by screen:**

| Screen | Figma node | Filter row |
|---|---|---|
| Approval Box | 9184:10579 | DateRangePicker + SearchInput |
| Scheduled Transfer (Internal) | 1:9972 | "Request Approval" CTA + period dropdown + calendar chip + status dropdown + SearchInput |
| Transfer Result (Internal) | 1:11730 | period dropdown + calendar chip + Completed checkbox + In Progress checkbox + SearchInput |
| Scheduled Payment (Vendor) | 24:1398 | mirror Scheduled Transfer 1:9972 — "Request Approval" CTA + period dropdown + calendar chip + status dropdown + SearchInput |
| Payment Result (Vendor) | 24:5491 | mirror Transfer Result 1:11730 — period dropdown + calendar chip + Completed checkbox + In Progress checkbox + SearchInput |
| Scheduled Payment (Expense) | 25:7584 | mirror Scheduled Transfer 1:9972 — same chrome as Vendor 24:1398 |
| Payment Result (Expense) | 25:9221 | mirror Transfer Result 1:11730 — same chrome as Vendor 24:5491 |
| Scheduled Payment (Payroll) | 27:11294 | mirror Scheduled Transfer 1:9972 — same chrome as Vendor 24:1398 |
| Payment Result (Payroll) | 27:12877 | mirror Transfer Result 1:11730 — same chrome as Vendor 24:5491 |
| All other Scheduled / Result variants | (per Figma) | DateRangePicker + SearchInput unless the frame shows otherwise |

**Batch-file pattern — single shared table.** Every payment module whose list rows represent uploaded *batches* (one row = one file containing N transactions — Internal Transfer, Vendor, Expense, Payroll, Overseas) MUST compose [`<PaymentScheduledBatchListPage>`](components/payment/shared/PaymentScheduledBatchListPage.tsx) for the Scheduled screen and [`<PaymentResultBatchListPage>`](components/payment/shared/PaymentResultBatchListPage.tsx) for the Result screen. The shared components own the canonical `<th>/<td>` shape, the colgroup, the toolbar, the totals footer, and the row chrome — modules supply only data and per-module strings. **No module may define its own `<th>/<td>` structure**; if Figma demands a new column or a deviating chrome element, extend the shared component (e.g. via the `extraColumn` slot) and add a new prop — never fork. Do **not** route batch-file pages through `<PaymentListPage>` (per-transaction template).

**Totals footer rule for batch-file Result pages.** Internal Transfer Result is the only Result page exempt from the totals footer (Figma 1:11730 shows none). Every other Payment Result variant — Vendor, Expense, Payroll, Overseas — MUST render a totals footer (`paginationWithTotals` + `<DataTableFooter>` with the "Total (VND)" row aligned under Total Transfer Amount), even when its own Figma frame omits the row. The shared CLAUDE.md "Pages governed by this rule" table is authoritative; do not delete the totals footer to match an incomplete Figma frame.

#### Root cause — why pagination ends up on detail pages

The shared `<DataTableShell>` is the universal table wrapper. A developer adding a new detail page who copies a list page as a starting point will start with `footerMode="paginationWithTotals"` already in place, complete with a visible pagination row and currency totals. The fix is **always to go through `<PaymentDetailPage>` or `<ResultDetailView>`** — never compose a detail page directly from `<DataTableShell>` + `<Pagination>`. Those two detail shells exist precisely so the no-pagination, no-footer contract cannot be accidentally broken per-module.

Secondary risk: a developer who inherits `footerMode="paginationOnly"` (the correct mode for detail pages) but removes the `hidden` prop from `<Pagination>` will expose an empty pagination row. The `hidden` prop must always be present on the `<Pagination>` inside `<PaymentDetailPage>` — it is a permanent flag, not a conditional.

#### Pages governed by this rule

| Module | List pages (→ pagination + totals) | Detail pages (→ no pagination, no totals) |
|---|---|---|
| **Internal Transfer** | [ScheduledTransferPage](components/payment/internal-transfer/ScheduledTransferPage.tsx), [TransferResultPage](components/payment/internal-transfer/TransferResultPage.tsx) | [ScheduledTransferDetailPage](components/payment/internal-transfer/ScheduledTransferDetailPage.tsx), [TransferResultDetailPage](components/payment/internal-transfer/TransferResultDetailPage.tsx) |
| **Vendor Payment** | [ScheduledPaymentPage](components/payment/vendor-payment/ScheduledPaymentPage.tsx), [PaymentResultPage](components/payment/vendor-payment/PaymentResultPage.tsx) | [ScheduledPaymentDetailPage](components/payment/vendor-payment/ScheduledPaymentDetailPage.tsx), [PaymentResultDetailPage](components/payment/vendor-payment/PaymentResultDetailPage.tsx) |
| **Expense Payment** | [ScheduledPaymentPage](components/payment/expense-payment/ScheduledPaymentPage.tsx), [PaymentResultPage](components/payment/expense-payment/PaymentResultPage.tsx) | [ScheduledPaymentDetailPage](components/payment/expense-payment/ScheduledPaymentDetailPage.tsx), [PaymentResultDetailPage](components/payment/expense-payment/PaymentResultDetailPage.tsx) |
| **Payroll Payment** | [ScheduledPaymentPage](components/payment/payroll/ScheduledPaymentPage.tsx), [PaymentResultPage](components/payment/payroll/PaymentResultPage.tsx) | [ScheduledPaymentDetailPage](components/payment/payroll/ScheduledPaymentDetailPage.tsx), [PaymentResultDetailPage](components/payment/payroll/PaymentResultDetailPage.tsx) |
| **Overseas Payment** | [ScheduledPaymentPage](components/payment/overseas-payment/ScheduledPaymentPage.tsx), [PaymentResultPage](components/payment/overseas-payment/PaymentResultPage.tsx) | [ScheduledPaymentDetailPage](components/payment/overseas-payment/ScheduledPaymentDetailPage.tsx), [PaymentResultDetailPage](components/payment/overseas-payment/PaymentResultDetailPage.tsx) |

#### Verification checklist (copy into every MR that touches a payment page)

- [ ] Is this a per-transaction list page? → `<PaymentListPage footerMode="paginationWithTotals">` (default). Verify `totals` array includes all required currencies (USD / VND / KRW) and `countLabelKey` is set.
- [ ] Is this a batch-file Scheduled page (Internal Transfer / Vendor / Expense / Payroll / Overseas — one row = one uploaded file)? → compose [`<PaymentScheduledBatchListPage>`](components/payment/shared/PaymentScheduledBatchListPage.tsx) directly. Pass `title`, `rows`, `rowDetailHref`, `totals`. For Overseas pass the `extraColumn` slot for Schedule Date — never fork the table or `<colgroup>`.
- [ ] Is this a batch-file Result page? → compose [`<PaymentResultBatchListPage>`](components/payment/shared/PaymentResultBatchListPage.tsx) directly. Pass `totals` (omit only for Internal Transfer Result, the sole `paginationOnly` case per Figma 1:11730).
- [ ] No batch-file Payment page renders its own `<table>`, `<thead>`, `<colgroup>`, or `<tbody>` — those live exclusively inside the two shared components.
- [ ] Is this a detail page? → `<PaymentDetailPage>` or `<ResultDetailView>`. Verify `<Pagination hidden>` is present and no `totals` / `countLabel` is passed.
- [ ] No detail page renders any visible footer row, currency total, or pagination controls.
- [ ] Calendar icon goes through the shared [`<CalendarIconButton>`](components/shared/CalendarIconButton.tsx) — never inline `<img src="…/ico-calendar-outline.svg">` and never substitute `lucide-react`'s `<Calendar>` (per §6b).
- [ ] FileCard download wrapper is `size-5`; the `<img>` inside is `size-4` with `brightness-0 invert` (per §6b).
- [ ] Detail summary values use `text-wb-13 font-semibold` (per §12).
- [ ] Toolbar icons match the Figma frame — list/print on every list page; Excel Upload chip only when the frame shows it. Detail pages declare list only (`<PageActionButtons showList />`).
- [ ] A new module follows the same two-file split: one list component + one detail component per screen (Scheduled + Result = 4 components per module, 2 list + 2 detail).

### 13. View Setting (column visibility / order) — shared component, never per page

View Setting is a **global / common WeCMS main feature** — not a Sprint 1 deliverable, not a Banking module concern, not a per-page implementation. The list-view icon in any list page's toolbar opens the same "View Setting" popover (Figma 100:13382 / legacy `comm_0108_001`) where the user toggles which columns are visible and reorders them. **Every** list page in the entire WeCMS system that needs column visibility / order persistence routes through one shared component, one shared hook, and one backend endpoint set keyed by `WEB_SVC_ID`. New screens never write their own popover, never add a feature-folder copy of `useViewSetting`, and never call `/api/v1/screen-options` directly — they pass their `WEB_SVC_ID` and column registry to the shared system and inherit everything else.

**Pages governed by this rule** — every list page that shows the list-view icon button (`<PageActionButtons showList … />`), across every module (Banking, Payment, Add-on, Settings, future modules). The first wired page is **Banking > Account Inquiry (VND)** (`SCREEN_IDS.ACCOUNT_INQUIRY_VND` = `banking-account-inquiry-vnd`) — use it as the reference implementation. Other paginated pages keep their no-op list-icon click until adoption rolls out screen-by-screen; the order of adoption does not change the rule. Never add a page-specific View Setting implementation while waiting for the rollout — extend the shared system or wait.

**Rules (non-negotiable):**

- The popover is the shared [`<ViewSettingPopover>`](components/shared/view-setting/ViewSettingPopover.tsx). State + API persistence go through the shared [`useViewSetting(webSvcId)`](components/shared/view-setting/useViewSetting.ts) hook. Do **not** build a page-local popover, a per-page LocalStorage cache, a parallel API wrapper, or a feature-folder copy of either file. The shared component lives at `components/shared/view-setting/` precisely because it is reused across the whole product — Banking, Payment, Add-on, Settings, every future module — never inside a feature folder.
- API calls go through [`lib/api/screenOption.ts`](lib/api/screenOption.ts) (`fetchScreenOptions` / `fetchScreenAreas` / `saveScreenOptions` / `resetScreenOptions`). Endpoints live at `GET / PUT / DELETE /api/v1/screen-options/{screenId}/{dymAreaId}` (plus `GET .../areas` for the area aggregator). Do **not** call those URLs from page code directly. The wrapper is the only sanctioned consumer.
- Each page that adopts View Setting binds a stable **semantic route-based screenId** drawn from the central registry [`lib/viewSettingScreens.ts`](lib/viewSettingScreens.ts) — `SCREEN_IDS.ACCOUNT_INQUIRY_VND`, `SCREEN_IDS.BANKING_ACCOUNT_INQUIRY_FCY`, etc. Format is lowercase kebab-case `<module>-<page>[-<type>]` (`banking-account-inquiry-vnd`, `payment-approval-box`, `addon-sales-einvoices`). The id keys system defaults in `SYS_SCR_OPTION_WECMS` and per-user overrides in `USER_SCR_OPTION_WECMS`. **The registry is the single source of truth for refactor screenIds.**
- **Forbidden patterns** (caught at review):
  - **Raw URL paths** as screenIds: `useViewSetting("/banking/account-inquiry", …)` ❌. The id is *derived from* the route, not equal to it — VND/FCY twins live at the same route but resolve to distinct screenIds via the registry.
  - **Legacy JEX ids**: `useViewSetting("fnsh_0001_001", …)` ❌. Legacy IDs are read-only references inside `WECMS DEV/`; the refactor frontend never imports them.
  - **Duplicated tokens**: `banking-banking-account-inquiry-vnd` ❌, `banking-account-inquiry-account-inquiry-vnd` ❌.
  - **Too-short ids missing module**: `account-inquiry-vnd` ❌ — `<module>-<page>-<type>` is the minimum.
  - **Inline string literals at the call site**: `useViewSetting("banking-account-inquiry-vnd", …)` ❌ — even when the value is correct, importing it from `SCREEN_IDS` is mandatory so a typo doesn't silently spawn an unknown id.
- **Adding a new screen** — one entry in `SCREEN_IDS` + one row in `SCREEN_ID_TO_ROUTE` + one Flyway seed under the same value (see [wecms-api/CLAUDE.md](../wecms-api/CLAUDE.md)). The backend endpoint set is global — no controller / service / DTO change is needed.
- **`dymAreaId` is required** on every View Setting call. Single-area pages pass `DEFAULT_AREA_ID` (`"default"`) from `lib/viewSettingScreens.ts`; multi-area pages pass meaningful kebab-case names (`summary`, `detail`, `current-accounts`, etc.) — never legacy numeric names like `table1`/`table2`. The frontend hook signature is `useViewSetting(screenId, dymAreaId = "default")` so single-area callers can omit it; the network request always sends a non-empty area.
- Each page exposes a **column registry** keyed by `FIELD_ID` — uppercase, matching the seed (`BANK`, `ACCOUNT_NICKNAME`, `BALANCE`, `AVAILABLE_BALANCE`, `VAS_ACCOUNT`, `LAST_UPDATE` for Account Inquiry; per-screen for others). The registry maps each FIELD_ID to a `colClassName` (Tailwind width class), `headerKey` (i18n key), `align` (`"left" | "right"`), `cellClassName`, and a `renderBody` function that takes `(row, t, summaryCurrency, …)` and returns a `<TableCell>` body. The `<colgroup>` / `<thead>` / `<tbody>` iterate the *visible* registry entries in `DISP_ORD` order — never hand-roll a static N-column table. The registry is the page's only View Setting contribution; everything else (popover chrome, persistence, merge, locked-row enforcement, anchor positioning) is shared.
- The checkbox column (always-rendered selection cell) is **not** part of View Setting and stays prepended in JSX — it cannot be reordered or hidden by the user.
- **Special FIELD_IDs — `CHECKBOX` (`DISP_ORD=0`) and `ETC` (`DISP_ORD=99`)** — are admin-controlled rows that ride through the View Setting data so column ordering / Save / Reset preserve them, but they MUST NOT appear in the popover row list and the user MUST NOT be able to hide / reorder / edit them. The shared rule is enforced in three places, do not relax any of them: (1) [`useViewSetting.ts`](components/shared/view-setting/useViewSetting.ts) exports `VIEW_SETTING_SPECIAL_FIELD_IDS` + `isSpecialViewSettingField(fieldId)` — use these helpers, never inline a string-equality check; (2) [`<ViewSettingPopover>`](components/shared/view-setting/ViewSettingPopover.tsx) splits items into `userItems` (rendered, reorderable) and `specialItems` (preserved verbatim) — reorder normalisation renumbers user rows 1..N and merges specials back unchanged so `CHECKBOX.DISP_ORD` stays `0` and `ETC.DISP_ORD` stays `99` across every Save round-trip; (3) backend [`ScreenOptionService.SPECIAL_FIELD_IDS`](../wecms-api/src/main/java/com/kosign/wecms/domain/setting/service/ScreenOptionService.java) locks `USE_YN='Y'` and pins `DISP_ORD` to the system seed for these FIELD_IDs regardless of payload — a misbehaving frontend cannot relax the rule. Pages register a CHECKBOX/ETC column in their seed migration only when the page's table actually renders that column (Account Inquiry seeds `CHECKBOX` in V33; do NOT bulk-seed `ETC` across pages that don't have an action column).
- A `FALLBACK_COLUMNS` constant inside the page mirrors the V30 seed so the table renders the right shape on first paint while the API resolves. Once `vs.items` populates, the live merge takes over. Do not let the table flash empty.
- Locked columns carry `FIX_YN='Y'` from the system seed (Account Inquiry's `BANK` is the canonical example). The shared popover renders their checkbox `disabled` and skips them in the reorder buttons; the service rejects USE_YN='N' for them on save. Pages must not attempt to relax this on the client.
- Saving from the popover commits the working draft via the shared hook's `save()`; resetting wipes user overrides via `reset()`; cancel/outside-click/ESC discards local edits without a network call.
- The list-icon trigger sits inside [`<PageActionButtons showList onList={(rect) => …} />`](components/shared/PageActionButtons.tsx). Pages capture the icon's `DOMRect` from the callback and pass it to `<ViewSettingPopover anchorRect={rect} />` — never compute the rect with `document.querySelector`. The popover anchors right-edge-to-right-edge (extends LEFT) so it doesn't overflow the right viewport edge.
- Add a new column to a page in this order: (1) Flyway migration row in `SYS_SCR_OPTION_WECMS`; (2) registry entry in the page; (3) optional locale key. Never the other way round — frontend-only columns leak into Save payloads as silently-ignored unknown FIELD_IDs.

**Reference implementation:** Banking > Account Inquiry (VND) — see [components/shared/AccountInquiryPage.tsx](components/shared/AccountInquiryPage.tsx) (`COLUMN_REGISTRY`, `FALLBACK_COLUMNS`, `useViewSetting(SCREEN_IDS.ACCOUNT_INQUIRY_VND, DEFAULT_AREA_ID)` from [lib/viewSettingScreens.ts](lib/viewSettingScreens.ts), popover render block). Mirror this shape for every new screen that adopts View Setting — registry constant + fallback + hook call + popover render. Do not deviate.

**Do NOT** place View Setting logic inside a feature folder. The shared system at `components/shared/view-setting/` is the **only** location for popover, hook, and types — even though Banking > Account Inquiry happens to be the first consumer, the implementation is not Banking-owned. Future screens (Approval Box, Transaction History, e-Invoices, Operation Status, Settings tables, …) consume the same files; never copy them under `components/banking/…`, `components/payment/…`, etc.

### 13a. Table sorting — shared hook, DB-side ORDER BY, never per-page

Table-header sorting is a **global / common WeCMS feature** keyed by the same View Setting `FIELD_ID` registry that drives column visibility / order. Every list page that needs sortable columns routes through one shared hook, one shared header cell, and one common API contract — never a page-local sort implementation, never a frontend-only `Array.sort()`. The first wired page is **Banking > Account Inquiry (VND)**; other paginated pages migrate in their next stabilisation pass.

**Rules (non-negotiable):**

- **Use the shared [`useTableSort()`](hooks/useTableSort.ts) hook** for the cycle state. Pages must NOT declare their own `useState` for `sortField` / `sortDirection`, must NOT cycle direction inline, and must NOT mutate sort state in a column-specific click handler.
- **Cycle is fixed:** `default → ASC → DESC → default`. The first click on a column = ASC; second = DESC; third = back to default. Clicking a different column resets the cycle to ASC on the new column. Owned by `useTableSort.toggleSort(fieldId)` — pages pass the function down, never re-implement.
- **Default state means "no user sort"** — `sortField` and `sortDirection` are both `null`, and `sortParams` is `null`. The API request omits both query keys; the backend falls back to its legacy default ORDER BY.
- **Sorting happens on the backend, never on the frontend.** The hook's `sortParams` is spread into the API call (`fetchAccounts(currency, sortParams)`), the backend whitelist resolves the wire `FIELD_ID` against an entity property, and the database returns the rows already in the requested order. Do NOT call `rows.sort(...)` after fetching — that breaks pagination order, masks backend bugs, and forks the contract.
- **The wire `sortField` is the View Setting `FIELD_ID`** (uppercase semantic key — `BANK`, `BALANCE`, `LAST_UPDATE`, etc.) — the same key that lives in `SYS_SCR_OPTION_WECMS.field_id`. Never invent a sort key that isn't a View Setting `FIELD_ID`.
- **`sortable` derives from View Setting `SORT_YN`** for the column. The shared `<TableHeaderCell sortable={col.SORT_YN === "Y" && !isSpecialViewSettingField(col.FIELD_ID)}>` pattern is the canonical form. `SORT_YN === "N"` columns render with no glyph and no click handler; admin can flip the flag in the seed without touching page code.
- **Special FIELD_IDs are NEVER sortable.** `CHECKBOX` (row-selection column at `DISP_ORD=0`) and `ETC` (action column at `DISP_ORD=99`) are filtered out via `isSpecialViewSettingField(fieldId)` from `@/components/shared/view-setting`. The header for either column does not render a sort glyph and does not respond to clicks. Backend `AccountSortField` / equivalent whitelists also exclude them — defence in depth.
- **Hidden columns cannot be sorted.** `<AccountInquiryPage>` filters `visibleColumns` to `USE_YN === "Y"` items before rendering headers; a column hidden via View Setting therefore cannot fire a sort. If a user reverses the hide via the popover, the column reappears with the same default-state glyph — no special "remember last sort" logic is needed because sort cycle state lives at the page level, not per-column.
- **Sort glyphs use [`<TableHeaderCell>`](components/shared/TableHeaderCell.tsx)** with the `sortFieldId` / `activeSortField` / `activeSortDirection` / `onSort` props. The component renders:
  - inactive (default state, or column not currently sorted): `/assets/table/ico-sort.svg` at `h-3 w-2 opacity` (existing icon — do NOT swap).
  - ASC active: lucide `ChevronUp` at `size-3.5 text-brand` (utility chrome — lucide is approved per §6b).
  - DESC active: lucide `ChevronDown` at `size-3.5 text-brand`.
  Pages must NOT inline alternative glyphs, custom SVGs, or page-specific colour tokens.
- **Click target is the entire header cell.** When sort wiring is enabled, `<TableHeaderCell>` wraps its content in a `<button>` so keyboard users can sort via Enter / Space. `aria-sort` is set on the `<th>` (`"ascending" | "descending" | "none"`). Pages must NOT attach `onClick` to the `<TableHead>` directly.
- **Sort state owns at the data-fetching level**, not deep in the table. The shared client wrapper (`AccountInquiryClient` for Account Inquiry; the matching wrapper for any future page) calls `useTableSort()`, includes `sortField`/`sortDirection` in the `useApiData` deps so the loader re-fires on cycle changes, and forwards `sortField` / `sortDirection` / `toggleSort` down to the page's `<TableHeaderCell>` mapping. The `<AccountInquiryPage>` component is screen-of-use, not state-owner.
- **API client wrappers accept an optional [`ListSortParams`](lib/api/banking.ts) shape** — `{ sortField, sortDirection }` — and spread it into the `params` object only when both are present. The shape is shared with the wire contract; do not invent per-feature param names (`sort`, `order`, `bankSort`, etc.).
- **Backend whitelist is the second line of defence.** The frontend filters by `SORT_YN`, but a stale or buggy client could still POST an unknown `sortField`. The backend resolves it through the per-screen sort whitelist (e.g. `AccountSortField` for Account Inquiry — see [wecms-api/CLAUDE.md](../wecms-api/CLAUDE.md)) and falls back to the default ORDER BY when the value is unknown / blank — never echoes it into a SQL string.
- **Seed `SORT_YN` and the backend whitelist must agree.** A column with `SORT_YN='Y'` in `SYS_SCR_OPTION_WECMS` MUST have a matching entry in the backend whitelist enum (`AccountSortField` for Account Inquiry, equivalents for future pages). When a column has no backing entity field yet (e.g. `VAS_ACCOUNT` before its source data is ported), seed it with `SORT_YN='N'` — never with `SORT_YN='Y'` and rely on the backend's silent fallback. The mismatch produces visible-but-inert sort glyphs that mislead users (cycle UI animates, rows do not move). The seed flag is the single source of truth the frontend respects, so flip it in a Flyway migration whenever the whitelist coverage changes — see V41 for the canonical pattern (`UPDATE SYS_SCR_OPTION_WECMS SET SORT_YN='N' WHERE …; DELETE FROM USER_SCR_OPTION_WECMS WHERE WEB_SVC_ID=…;`). When the column gains a real backing field later, the same migration that adds it to the whitelist enum flips `SORT_YN` back to `'Y'`.
- **Adopting a new page** is the same shape as the View Setting adoption (§13): no new shared component, no new shared hook, no new API endpoint. Each new page passes its own `useTableSort()` instance to its existing `<TableHeaderCell>` mapping and updates its API client call to forward `sortParams`. The backend adds one row to its sort-whitelist enum per new sortable `FIELD_ID`; that's the only backend code change.

**Reference implementation:**

- Hook: [`hooks/useTableSort.ts`](hooks/useTableSort.ts).
- Header cell: [`components/shared/TableHeaderCell.tsx`](components/shared/TableHeaderCell.tsx) (sort props are opt-in — pages that haven't migrated still render the static glyph).
- API call: [`fetchAccounts(currency, sort)`](lib/api/banking.ts) accepts `ListSortParams`.
- Page wiring: [`AccountInquiryClient.tsx`](app/(dashboard)/banking/account-inquiry/AccountInquiryClient.tsx) calls `useTableSort()` and forwards state to [`<AccountInquiryPage>`](components/shared/AccountInquiryPage.tsx); the table-header mapping reads `col.SORT_YN` + `isSpecialViewSettingField(col.FIELD_ID)` to decide which headers wire the sort triplet.

**Forbidden patterns (caught at review):**

- Page-local `useState<{ sortField, sortDirection }>` — extract via `useTableSort()` instead.
- `rows.sort((a, b) => ...)` after the API call — sort is DB-side, frontend never reorders.
- Inline `onClick={() => setSort(...)}` on `<TableHead>` — go through `<TableHeaderCell sortFieldId={...} onSort={...}>`.
- Hardcoded sort-glyph imagery (`<img src="/assets/.../ico-sort-asc.svg">`) — the shared cell renders the canonical glyph.
- Concatenating `sortField` into a path or query: `?orderBy=${userInput}` — use the typed `params` object so axios serialises safely.

**Adoption status:**

| Screen | Status | Notes |
|---|---|---|
| Banking > Account Inquiry (VND) | ✅ Wired | Sort whitelist: `BANK`, `ACCOUNT_NICKNAME`, `BALANCE`, `AVAILABLE_BALANCE`, `LAST_UPDATE`. `VAS_ACCOUNT` is intentionally `SORT_YN='N'` (V41) — the column has no backing field yet, so the seed mirrors the whitelist coverage per the rule above. Default ORDER BY: `PRN_SEQ ASC, BANK_CD ASC, ACCT_NO ASC` (legacy `fnsh_0001_001` parity, NULLs last). |
| All other paginated list pages | ⏳ Pending | Migrate in next stabilisation pass — do not regress existing tables in unrelated MRs. |

### 13a-bis. Domain enum keys — backend ships codes + i18n keys, frontend localises

Domain code values (`acct_type_cd`, `svc_type`, `inout_dv`, …) are owned
**by the backend** — the Spring side defines a modernized enum under
`com.kosign.wecms.common.enums.*`, populates a sibling `<field>_key`
property on the wire DTO, and the frontend resolves the localized
string via `t(<key>)` against `locales/{en,ko,vi}.json`.

**Rules (non-negotiable):**

- **Pages NEVER hold a code → label map.** No `INOUT_DV_LABELS`,
  `ACCT_TYPE_LABELS`, `SVC_TYPE_LABELS`, etc. in component files. The
  `coerceFirmBankingServiceType` switch in `mappers.ts` was retired
  on 2026-05-08 — that pattern is the canonical mistake.
- **The wire ships two siblings per code field:** the raw legacy code
  (`acct_type_cd: "03"`, `svc_type: "F"`) AND a server-resolved i18n
  key (`acct_type_key: "bank.acct_type.03"`,
  `svc_type_key: "settings.firm_banking_history.service_type.firm_banking_transaction"`).
  The mapper passes the key through verbatim; pages render via
  `t(row.acctTypeKey)` and fall back to the raw legacy label
  (`acct_type_nm`, kept on the wire as a staging layer) when the key
  is `null`.
- **Frontend in-memory rows carry the camelCase semantic value**, not
  the wire code, when the page consumes the value as a discriminator
  (e.g. `FirmBankingHistoryRow.serviceType: "firm_banking_transaction"`).
  The translation from key → semantic suffix is a tiny shared helper
  (`extractFirmBankingServiceType` in `mappers.ts`); it validates the
  suffix against the union and falls back to the legacy default —
  never reintroduces an F/S/G/B switch.
- **Locale entries land verified.** EN labels come from the live
  refactor backend or the legacy WeCMS source verbatim. KO entries
  come from the legacy `wabooks/enums/*.java getLabel()` returns.
  **Never invent a translation.** If the verified value isn't
  available, omit the key in that locale file — `LocaleProvider`
  falls back to EN, and the wire's legacy English label
  (`acct_type_nm`) is the second-line fallback.
- **No `km.json`.** Khmer is not yet supported by `wecms-web`.
- **Adopting a new domain enum:** the backend MR adds the enum under
  `common/enums/`, extends the relevant DTO with `<field>_key`, and
  populates it in the service mapper. The frontend MR (same MR
  ideally — full-stack ownership rule) extends the wire type, deletes
  any local code → label map, and adds the locale entries.

**Domain-enum key namespaces currently in use:**

| Namespace | Backend enum | Wire field | Locale coverage |
|---|---|---|---|
| `bank.acct_type.*` | `AcctTypeCd` (codes 02–08; `01` LOAN intentionally unmapped) | `ApiAccountRow.acct_type_key` | `en.json` ✅ + `ko.json` ✅ + `vi.json` ⏳ deferred (no verified VI translation; falls back to `acct_type_nm`) |
| `settings.firm_banking_history.service_type.*` | `FirmBankingSvcType` (`F` / `S` / `G` / `B`) | `ApiFirmBankingHistoryRow.svc_type_key` | `en.json` ✅ + `ko.json` ✅ + `vi.json` ✅ (pre-existing, since the panel already used these keys) |
| `fb_history.service.*` | `TranTp` (codes 201–204; `204` has no key, frontend renders raw value) | `ApiFirmBankingHistoryRow.svc_name_key` | `en.json` ✅ + `ko.json` ⏳ + `vi.json` ⏳ (en-only today; missing-key fallback shows the raw legacy `svc_nm`) |
| `tx.inout.*` | `InoutDv` (codes 1, 2, 0) | _no wire field yet — internal service-layer use only_ | locale entries deferred (no consumer needs the label yet) |

**Forbidden patterns (caught at review):**

- `Map<string, string>` / `switch (code) { case "F": …  }` chains in
  component or mapper code that translate a wire code to a frontend
  category. The retired `coerceFirmBankingServiceType` switch is the
  canonical anti-pattern; do not re-introduce it under another name.
- Inline English labels in component files for codes that have an
  i18n namespace registered — go through `t(row.acctTypeKey)` and
  drop the `<th>` literal.
- A `lib/api/<feature>Status.ts` regex that matches localized strings
  to derive a logical state. (The existing
  `lib/api/einvoiceStatus.ts` is a documented BLOCKER pending
  backend IR-4 — do not propagate the pattern.)

### 13b. Excel export — shared helper, shared hook, never per-page

Excel / XLSX export is a **global / common WeCMS feature** keyed by the same View Setting `WEB_SVC_ID` registry that drives column visibility / order (§13) and table sort (§13a). Every list page that exposes the toolbar Excel icon (Banking, Payment, Add-on, Settings, every future module) routes through one shared frontend module + one shared hook — never a page-local CSV / XLSX implementation, never a frontend-side workbook generator. The first wired page is **Banking > Account Inquiry (VND)**; other paginated pages migrate in their next stabilisation pass.

**Rules (non-negotiable):**

- **Use [`lib/excel.ts`](lib/excel.ts) via the [`useExcelExport()`](hooks/useExcelExport.ts) hook.** Pages do NOT call `exportExcel(...)` directly — the hook owns the View Setting → wire-column translation. Pages declare a `columnConfig: Record<FIELD_ID, { headerKey, format?, ccyCd?, align? }>` next to their `COLUMN_REGISTRY`, hand the hook their current `vs.items` (or `FALLBACK_COLUMNS` while loading), filter / sort state, and a translated filename — the hook does everything else.
- **Never generate the workbook on the frontend.** No `xlsx`, no `exceljs`, no in-browser ZIP-of-XML hacks. The backend (Apache POI on the api side) is the single producer; the frontend POSTs JSON, receives an XLSX blob, and saves it via `<a download>`. This keeps a 50k-row export bounded server-side and locks formatting to one consistent contract across every screen.
- **CSV export is NOT sanctioned.** The legacy CSV path on Account Inquiry was removed when the shared XLSX path landed. New screens MUST NOT introduce a CSV download fallback "while waiting for backend support" — backend support already exists and is the only path.
- **Per-resource POST endpoints, never a generic dispatcher.** Each list resource gets its own `POST /api/v1/{module}/{resource}/export`. The frontend names the URL via the `endpoint` prop on the hook; the hook does not derive the URL from `screenId`.
- **Visible + ordered columns from the LIVE View Setting state, including unsaved popover reorders.** Pass `vs.items` directly — the backend re-intersects with the persisted View Setting visibility before emitting columns, so an unsaved reorder is honoured but a hidden column never leaks (defence in depth).
- **Special FIELD_IDs (`CHECKBOX`, `ETC`) are filtered out** by the hook via `isSpecialViewSettingField(...)` before the wire request leaves the browser. Backend's `ScreenOptionService.SPECIAL_FIELD_IDS` enforces the same rule on the receiving side. Pages must NOT register `CHECKBOX` / `ETC` in their `columnConfig` — even by accident.
- **All filters + current sort must travel with the request.** Bank / search / currency / date filters go in the `filters` map; sort goes in `sort` (or `null` when in default state). The backend provider re-runs the same filter+sort path the list endpoint uses so export and list draw from one source of truth.
- **Frontend ships translated headers.** Every column's `headerKey` is resolved via `t(...)` inside the hook; backend trusts the string. Locale-aware re-resolution does not happen server-side.
- **Amount values rendered in the workbook MUST go through the shared format function** — `formatAmount(value, ccyCd, includeSymbol)` from [`lib/currency.ts`](lib/currency.ts). The same call site that formats the on-screen summary card (e.g. `사용 가능 잔액 8.417.734.439₫`) is the one that should produce any amount string the page passes into the export pipeline. The Excel subheader is computed server-side via the matching `AmountFormatter.forDisplay(...)` (same locale + symbol rules — see [wecms-api/CLAUDE.md](../wecms-api/CLAUDE.md) → "Excel export"). Backend numeric data cells stay raw and get POI's `#,##0.##` cell-level format applied by the writer — never pre-format an `amount` cell value on the frontend, the page registry's `format: "amount"` is the contract. **Forbidden**: passing a pre-formatted `"19,886,030,287₫"` string into a numeric column, building amount strings via template literals (`${total} ₫`), or inlining `Intl.NumberFormat` per page — every monetary value must flow through `formatAmount(...)` so the page header, the print popup, and the Excel subheader read identically.
- **In-sheet title and filename are two separate strings.** The on-screen page title (with natural spacing — `계좌 조회 (VND)` / `Account Inquiry (VND)`) is what the spreadsheet's row 0 shows; the filename uses the legacy filesystem-friendly form (no inner Korean space + `_DDMMYYYY` suffix — `계좌조회(VND)_02052026`). Pages source the two from separate i18n keys (`<screen>.title` + `<screen>.export_title`) and pass both to the hook (`title` + `fileName`). Never collapse them into one string — the date suffix must NEVER appear in the row 0 cell.
- **File name is caller-supplied, no timestamp by default** — matches the legacy convention. Format is `<Page Title> (<scope>)`; the backend appends `.xlsx`. Non-ASCII (Korean / Khmer) round-trips via RFC 5987 UTF-8 `Content-Disposition`.
- **Errors surface through [`ApiCallError`](lib/api/banking.ts)** carrying `status.code` — same envelope as every other API call. Pages SHOULD wrap `await exportXlsx(...)` in try/catch and route non-401 errors to `useDialog().open({ type: "error", errorCode })`. 401s are handled automatically by the global session-expired interceptor in [`lib/axios.ts`](lib/axios.ts).
- **Adopting a new screen** is purely additive: declare a `columnConfig` registry next to the page's `COLUMN_REGISTRY`, wire `onExport` on `<PageActionButtons showExcel onExport={…} />`, pass the `endpoint` + `screenId` + filter / sort state to the hook. No changes to `lib/excel.ts`, no changes to `hooks/useExcelExport.ts`, no new dependency.

**Forbidden patterns (caught at review):**

- Inline `Blob` / `URL.createObjectURL` / `<a download>` chains in a page component — those primitives belong inside `lib/excel.ts` only.
- Per-page CSV `buildCsv` / `escapeCsv` helpers — XLSX via the shared path is the single export format.
- A frontend `xlsx` / `exceljs` / `xlsx-js-style` import — the backend produces the file.
- Importing `exportExcel` directly from a page component — pages go through `useExcelExport()`.
- Hard-coded column lists in the export call — the column set MUST come from `vs.items` ∩ `columnConfig`.
- Skipping the `filters` / `sort` arguments when the page has active filters / sort — the export must mirror what the user sees.
- Declaring `CHECKBOX` / `ETC` in a page's `columnConfig` — the hook drops them, but the entry shouldn't exist.
- Pre-formatting amount values into strings on the page (`String(total) + "₫"`, `total.toLocaleString()`, `Intl.NumberFormat(...).format(total)`) — every monetary string MUST come from `formatAmount(value, ccyCd, true)` from [`lib/currency.ts`](lib/currency.ts), and amount data cells (`format: "amount"`) ship raw decimal — the backend's POI writer applies `#,##0.##` at cell level.
- Combining `title` + `_DDMMYYYY` into a single string passed as `fileName` — the date suffix belongs to the filename only; pass the on-screen title via the separate `title` field on the hook so row 0 stays date-free.

**Reference implementation:**

- Helper: [lib/excel.ts](lib/excel.ts) — `exportExcel({ endpoint, screenId, dymAreaId, fileName, columns, filters, sort })`. Posts JSON, parses the response (JSON error envelope OR XLSX blob), saves the blob with the server-supplied filename.
- Hook: [hooks/useExcelExport.ts](hooks/useExcelExport.ts) — `useExcelExport()` returns a stable async function; consumers pass `{ endpoint, screenId, dymAreaId, fileName, items, columnConfig, t, filters, sort }`.
- Page registry: [`ACCOUNT_INQUIRY_EXPORT_COLUMNS`](components/shared/AccountInquiryPage.tsx) — `BANK · ACCOUNT_NICKNAME · BALANCE · AVAILABLE_BALANCE · VAS_ACCOUNT · LAST_UPDATE` with `format` + `align` per column.
- Page wiring: [`AccountInquiryPage#handleExportExcel`](components/shared/AccountInquiryPage.tsx) — pulls live `vs.items`, derives `sort`, hands `currency` / `bankName` / `keyword` to `filters`, calls the hook.
- Backend contract: see [wecms-api/CLAUDE.md](../wecms-api/CLAUDE.md) → "Excel export — `common/export/`".

**Adoption status:**

| Screen | Status | Endpoint | Notes |
|---|---|---|---|
| Banking > Account Inquiry (VND) | ✅ Wired | `POST /api/v1/banking/accounts/export` | First consumer. Replaces the legacy inline CSV path. |
| All other paginated list pages | ⏳ Pending | — | Migrate in next stabilisation pass — do not regress existing pages in unrelated MRs. |

## Rules for New Menu Pages

End-to-end checklist for adding any new feature page. Follow in order.

### 1. Before writing any code

1. Open the Figma frame for the target screen.
2. Open [components/shared/AccountInquiryPage.tsx](components/shared/AccountInquiryPage.tsx) (baseline) and [components/payment/approval-box/ApprovalBoxPage.tsx](components/payment/approval-box/ApprovalBoxPage.tsx) (tabbed baseline) side-by-side.
3. Walk existing components and confirm what already exists — `components/ui/`, `components/layout/`, `components/shared/`, any relevant feature folder.
4. Only build something new if nothing above fits. Extend or extract, do not fork.

### 2. Routing

- **Feature-based routes.** Path = `/{feature}/{screen}`, lowercase, kebab-case. `(dashboard)` is invisible.
- Canonical examples:

  | Screen | Route |
  |---|---|
  | Account Inquiry (VND) | `/banking/account-inquiry` |
  | Transaction History | `/banking/transaction-history` |
  | Approval Box (Payment) | `/payment/approval-box` ← tabbed baseline |
  | Firm Banking Settings | `/settings/firm-banking-settings` |

- Put the page at `app/(dashboard)/{feature}/{screen}/page.tsx` — inherits auth guard + `<AppShell>`.
- Add (or un-placeholder) the matching Sidebar/Header entry with a real `href` in the **same** MR as the page.
- Update `lib/routes.ts` if the new route is a module home.
- **Never derive routes from legacy JEX WSVC ids.** Legacy ids like `comm_0220_001`, `fnsh_0001_001`, `pymn_0010_002` are JSP-architecture artifacts inside `WECMS DEV/`; the refactor frontend never imports or echoes them. Routes carry slugs (`firm-banking-settings`, `account-inquiry`, `approval-box`); the corresponding View Setting `screenId` comes from the registry in [`lib/viewSettingScreens.ts`](lib/viewSettingScreens.ts) (see §13). Cross-tree summary: workspace [CLAUDE.md](../CLAUDE.md) §"Cross-Tree Rules → Refactor work"; backend rules: [wecms-api/CLAUDE.md](../wecms-api/CLAUDE.md) §"Refactor identifier naming". Legacy WSVC ids are preserved only in two buckets going forward: JEX file:line citations, and migration-traceability prose under `docs/refactor-wecms/migration/`. The earlier "audit DB constants" bucket was retired 2026-05-09 — `AUDIT_LOGS_INFM.WSVC_ID` now stores refactor slugs (e.g. `firm-banking-settings`); no frontend impact since the FE only renders pre-localized audit strings, not the `wsvc_id` value itself.

### 3. Stack & composition

- **No new UI / form / state library.** Next.js 16 + Tailwind 4 + shadcn/ui is the full allowed stack.
- Page file stays thin — one feature component, optional `metadata`.
- Reuse from `components/layout/`, `components/shared/`, `components/ui/` before creating anything new.
- Copy-paste between feature components is not allowed. Lift to `components/shared/` first.

### 4. UX rules

- `cursor-pointer` on every clickable icon, row, badge, or chevron — and only on those.
- Hover background only where Figma specifies it; use `hover:bg-wb-*` tokens.
- **System dialogs** (warning / error / success / confirmation) go through `useDialog()`, max width 500 px. **Feature dialogs** (forms, multi-column edit dialogs, the Settings shell itself) go through the shadcn [`<Dialog>`](components/ui/dialog.tsx) primitive directly with their own `max-w-*` cap from Figma — see §3a "Settings Popup — Modal Shell + Panel Composition" for the rhythm contract. Do not force feature dialogs into 500 px, and do not invent oversized custom modal shells outside the shared primitive.
- Language (`wecms_locale`) persists across logout — do not clear it.

### 5. Data rules

- **No new hardcoded mock arrays.** If an endpoint exists, wire it. If not, land it on the Spring Boot side in the same MR (full-stack ownership). Temporary mock is acceptable only if the PR description explicitly tracks the swap.
- Wire types in [lib/types/api.ts](lib/types/api.ts) use lowercase snake_case (`user_id`, `field_id`); in-memory frontend types use camelCase semantic names (`userId`, `userName`, `companyName`). See "API Naming & Serialization Standards" above for the full three-layer rule.
- All UI text via `t(…)` with keys in all three locale files.
- Company/user data from `userStorage` or `/api/v1/auth/me` — never inline.

### 6. Responsive rules

- Verify all four breakpoints: 375 / 768 / 1024 / 1440.
- Match the established responsive patterns (sidebar drawer, table scroll, filter wrap, card stack).

### 7. Verification before merge

1. Desktop (1440) and mobile (375) both render cleanly.
2. No `text-[…]`, `font-[…]`, `tracking-[…]`, `style={{ fontFamily|fontSize|fontWeight|lineHeight }}`, or `ks-*` anywhere in the diff.
3. Every user-visible string is behind `t(…)` and exists in all three locale files.
4. Sidebar/Header shows a real `href` for the new route; item highlights on visit.
5. Modals go through `useDialog()` and respect the 500px cap.
6. Company name / user name sourced from auth store, not hardcoded.

## Auth Rules

### Login

```
LoginForm → lib/auth/client.login(userId, password)
         → POST /api/v1/auth/login { user_id, user_pw }                          // wire — snake_case
         → { status: {error,code,message}, data: {                                // envelope
                 access_token, token_type, expires_in,
                 user_id, user_nm, biz_key, lang_cd, cmpn_nm
             }, timestamp, path, trace_id }
         → toStoredUser(...) translates snake_case wire → camelCase in-memory:
             { userId, userName, bizKey, langCode, companyName }
         → tokenStorage.set(rec.access_token)   (localStorage + cookie)
         → userStorage.set({ userId, userName, bizKey, langCode, companyName })
         → saveId ? savedIdStorage.set(rec.userId) : savedIdStorage.clear()
         → router.push(HOME_ROUTE)
```

- **Errors** surface through `LoginError(code, message)` shown via `useDialog().open({ type: "error", errorCode, … })`.
- **Save ID** — `wecms_saved_user_id` in `localStorage`. Rehydrated on mount; focus jumps to password when an ID is pre-filled.

### Route protection

`app/(dashboard)/layout.tsx` is a `"use client"` guard:

1. On mount, read `tokenStorage.get()`.
2. If token missing and URL does not contain `?preview=1`, `router.replace("/login")`.
3. Otherwise call `fetchMe()` (`GET /api/v1/auth/me`) to rehydrate user state. If it fails (expired/invalid token), clear storage + redirect to `/login`.
4. Mount `<AppShell>{children}</AppShell>` once the user is confirmed.

`?preview=1` is intentional — lets designers preview chrome without the backend running.

### Logout

Triggered from `ProfileMenu` → confirmation dialog → `lib/auth/client.logout()`:

1. Best-effort `POST /api/v1/auth/logout` (audit/symmetry; failure is swallowed).
2. `tokenStorage.clear()` + `userStorage.clear()`.
3. `router.replace("/login")`.

**Invariant — do NOT clear other keys.** `wecms_locale` and `wecms_saved_user_id` are user preferences and must survive logout. Never call `localStorage.clear()`.

### localStorage keys (owned)

| Key | Owner | Cleared on logout? |
|---|---|---|
| `wecms_token` | `tokenStorage` | Yes |
| `wecms_user` | `userStorage` | Yes |
| `wecms_locale` | `LocaleProvider` | **No** |
| `wecms_saved_user_id` | `savedIdStorage` | **No** |

### JWT transport

- [lib/axios.ts](lib/axios.ts) — request interceptor reads `wecms_token` and sets `Authorization: Bearer …` on every call. No refresh token logic (backend is stateless).
- `baseURL` from `NEXT_PUBLIC_API_BASE_URL`, default `http://localhost:8080`. Never point this at `dev.wecms.vn`, `test.wecms.vn`, or `www.wecms.vn`.

## i18n Rules

- In-house provider at [lib/i18n/LocaleProvider.tsx](lib/i18n/LocaleProvider.tsx). **No `next-intl`, no `react-i18next`.**
- **Supported locales: `EN | KO | VI`.** KM (Khmer) is not yet in the web — add `km.json` + extend `LOCALES` when copy lands.
- Messages are flat dotted keys (`login.login_button`, `nav.banking`, `approval.col.date`) in `locales/{en,ko,vi}.json`. EN is the fallback; missing keys return the key itself.
- `t("key", { var: "value" })` interpolates `{var}` placeholders.
- Selection persists to `localStorage` under `wecms_locale`. `<html lang>` is kept in sync for a11y.
- Language selection UI lives in `ProfileMenu` — switching triggers a confirmation dialog.
- **New UI text always goes through `t(…)`.** Update all three locale files in the same MR.

## API / DB Rules

### Response envelope

Every API call goes through [lib/axios.ts](lib/axios.ts) and returns:

```ts
interface ApiResponse<T> {
  status: { error: boolean; code: string; message: string };
  data?: T;
  timestamp?: string;     // present on errors
  path?: string;          // present on errors
  trace_id?: string;      // present on errors — JEX-style id grepable in server logs
}
```

- Success is `status.error === false` with a `data`. Always check `status.error` — HTTP 200 is not sufficient; the backend returns 200 for known business errors.
- DTO types in [lib/types/api.ts](lib/types/api.ts) carry **lowercase snake_case** property names matching the wire. Frontend in-memory types (`StoredUser`, `AccountInquiryRow`, `EInvoiceRow`, …) use **camelCase semantic** names; mappers in `lib/api/mappers.ts` translate at the boundary.

### Current API calls

| Endpoint | Method | Handler | Notes |
|---|---|---|---|
| `/api/v1/auth/login` | POST | `lib/auth/client.login()` | Payload: `{ user_id, user_pw }` |
| `/api/v1/auth/me` | GET | `lib/auth/client.fetchMe()` | Called by dashboard layout on mount to rehydrate user |
| `/api/v1/auth/logout` | POST | `lib/auth/client.logout()` | Best-effort; failure swallowed |
| `/api/v1/banking/accounts` | GET | `lib/api/banking.fetchAccounts(currency)` | Account Inquiry VND/FCY |
| `/api/v1/banking/accounts/{acctSeqNo}/transactions` | GET | `lib/api/banking.fetchTransactions()` | Per-account transaction history |
| `/api/v1/banking/transfers/own-accounts` | GET | `lib/api/banking.fetchOwnAccounts()` | Transfer landing list (read-only Sprint 1) |
| `/api/v1/banking/transfers/history` | GET | `lib/api/banking.fetchTransferHistory()` | NAPAS transfer history |
| `/api/v1/banking/reports/daily-cash` | GET | `lib/api/banking.fetchDailyCash()` | Real ledger; Sprint 2 adds the date/scope filter wiring |
| `/api/v1/banking/reports/daily-financial` | GET | `lib/api/banking.fetchDailyFinancial()` | Real CMC snapshot |
| `/api/v1/banking/reports/daily-financial-hs` | GET | `lib/api/banking.fetchDailyFinancialHs()` | **Stub backend + frontend mock** — contract mismatch documented in audit |
| `/api/v1/banking/reports/cash-flow` | GET | `lib/api/banking.fetchCashFlow()` | **Stub backend** — contract validated, falls back to mock |
| `/api/v1/addon/einvoices?type=SALES\|EXPENSE` | GET | `lib/api/addon.fetchEInvoices(type)` | Sales + Expenses share one endpoint |
| `/api/v1/addon/operation-status` | GET | `lib/api/addon.fetchOperationStatus()` | Tax-authority operation status |

**Architecture:** All fetchers go through `api` from `lib/axios.ts` (JWT auto-attached), unwrap the `ApiResponse<T>` envelope (reading `status.error` / `status.code` / `status.message`), and throw `ApiCallError` carrying `status.code` + the server-supplied `trace_id`. Pages use the lightweight `lib/api/useApiData()` hook to fetch on mount and fall back to the static mock seed when the response is empty / errors. snake_case wire → camelCase semantic translation lives in `lib/api/mappers.ts`.

**Known contract mismatches** (Sprint 1 — see `docs/refactor-wecms/audits/db-parity-audit-2026-04-30.md` and the Sprint 1 Prompt 3 audit):
- Transaction History: sidebar uses static slugs (e.g. `bidv-0569`); backend uses synthetic `BANK_CD_ACCT_NO`. `TransactionHistoryClient` bridges by matching bank-name prefix on the live `/accounts` list. Sprint 2 should drive the slug list from the API.
- Daily Cash: backend `ACCOUNTS` is a flat list with no Current/Savings discriminator. Wrapper puts the full list under "Current Accounts"; "Savings Accounts" stays on the mock seed until the backend adds an account-type field.
- Daily Financial HS: backend returns flat `DETAIL/SUBTOTAL/TOTAL` rows; frontend needs grouped sections with subtotals. Page stays on the mock seed; Sprint 2 ports the real ledger query.
- Transfer History totals: backend returns multi-currency totals array; frontend footer renders one currency only — mapper collapses to first bucket.

### Error codes

| Code | Meaning |
|---|---|
| `WBI0000` | Success |
| `WBE1009` | Bad credentials / user not in tenant |
| `WBE1010` | Account not activated |
| `WBE1011` | Account locked |
| `WBE1128` | Account deleted |
| `WBE_VALIDATION` | Bean-validation failure |
| `WBE9999` | Unexpected server error |

Surface through `useDialog().open({ type: "error", errorCode, description })`. Never render a bespoke error banner per page.

## Do / Don't

**Do**
- Build Desktop first (Figma Desktop frame), then adapt via Tailwind breakpoints.
- Reuse `components/ui/`, `components/layout/`, `components/shared/` before writing new UI. Extend via composition.
- Route everything through `useDialog()` for modals, `useTranslation()` for copy, `api` (Axios) for HTTP, `*Storage` helpers for `localStorage`.
- Add new routes under `app/(dashboard)/{feature}/…` — inherit auth + shell. Add Sidebar/Header entry with a real `href` in the same commit.
- Put shared constants (routes, keys) in `lib/`. One source of truth per concept.
- Keep wire types lowercase snake_case (matching Spring Boot's Jackson `SNAKE_CASE`); in-memory types stay camelCase. Translate at the boundary in `lib/api/mappers.ts` / `lib/auth/client.ts`. See "API Naming & Serialization Standards" above.

**Don't**
- Don't hardcode UI text — go through `t(…)` and update all locale files.
- Don't hardcode colors / fonts / sizes — use the Tailwind tokens in `app/globals.css`.
- Don't ship desktop-only UI. Every page must work at 375 / 768 / 1024 / 1440.
- Don't duplicate layout / shell / dialog / pagination across pages — reuse the shared components.
- Don't introduce Bootstrap, Material UI, Chakra, Heroicons, NextAuth, next-intl, Redux, Zustand, react-query, SWR, or a second font family.
- Don't mix JEX legacy typography (`ks-font-size-*`, `ks-fw-*`, `_common.css`) with the Figma token system.
- Don't add a `tailwind.config.js`. Tailwind 4 reads everything from `@theme inline` in `app/globals.css`.
- Don't call `localStorage.clear()` on logout — only the auth keys are ours to clear.
- Don't cross the write boundary: JEX trees are read-only.

## Known Issues / Inconsistencies

| Issue | Location | Status |
|---|---|---|
| Two table patterns | `AccountInquiryPage` (shadcn `<Table>`) vs. `ApprovalTable` (bare `<table>` + colgroup) | Documented above — use bare table only when shared colgroup + footer is needed |
| DateRangePicker not wired | `components/payment/approval-box/DateRangePicker.tsx` | UI-only; comment says "slot in real picker later" |
| PageActionButtons no handlers | `components/shared/PageActionButtons.tsx` | Component itself has no default handler — pages opt in via `onList` / `onPrint` / `onExport`. Account Inquiry (VND) wires all three (List → View Setting popover §13, Print → `printReport` §6d, Export → `useExcelExport` §13b); other adopters pending in their next stabilisation pass. |
| Change Password no handler | `components/layout/ProfileMenu.tsx` | Button exists, handler is empty |
| Mock data in feature pages | `AccountInquiryPage.tsx`, `mockData.ts` | Replace with real API calls when backend endpoints land |
| `localTraceId()` fallback in LoginForm | `components/auth/LoginForm.tsx` | Used only when the server didn't send a `trace_id` (pure network failure). Backend now ships a `trace_id` on every error envelope (`X-Trace-Id` header + body field) and the dialog renders that verbatim. |
| Figma icons not exported | `ProfileMenu`, header icons | `ico_spark`, `ico_world`, `ico_keylock`, `ico_power`, pencil avatar-edit fall back to lucide glyphs |

## Notes for future implementation

- **Menu / permission resolution** — sidebar + top nav are declarative arrays. When the backend returns a resolved menu tree in the login/me response, drive these from that payload instead of hardcoding `href` lists.
- **Change Password** — `ProfileMenu` row is wired but handler is empty. First pass is a `useDialog()` form; long-term a dedicated route (`/settings/security`).
- **Server-side auth guard** — the current client-only guard is fine for R&D. Before any non-local deploy, move to Next.js middleware + cookie-bound token so protected routes never flash.
- **Out-of-scope wire types still UPPER_SNAKE** — Transaction History, Internal Transfer, and Reports DTOs in `lib/types/api.ts` keep their UPPER_SNAKE property names until their matching backend feature is migrated to lowercase. Flip both sides in the same MR; don't pre-migrate.
- **Asset export** — extract assets page-by-page from Figma under `public/assets/{section|feature}/`. Never bulk-dump.
- **KM locale** — backend already speaks Khmer. Add `locales/km.json` and extend `LOCALES` once copy is available.
- **Dev tooling** — add Prettier + GitLab CI `lint` + `build` before the team scales past two devs.

## Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

API base URL — `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8080`). The Spring Boot backend must be running; see [../wecms-api/CLAUDE.md](../wecms-api/CLAUDE.md) for bring-up.

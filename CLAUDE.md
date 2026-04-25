@AGENTS.md

# CLAUDE.md — wecms-web-main

Living AI/developer guide for the Next.js frontend of the WeCMS JEX → Spring/Next.js refactor. Update this file whenever the real code moves.

**Read [AGENTS.md](AGENTS.md) first.** This is Next.js 16 — APIs, conventions, and file structure differ from earlier versions you may have seen in training data. Check `node_modules/next/dist/docs/` before writing anything non-trivial.

Workspace-level rules (cross-tree layout, write boundary, typography source of truth, asset rules) live in the root [CLAUDE.md](../CLAUDE.md). The Spring Boot API this client talks to is in [wecms-api-main/](../wecms-api-main/). JEX functional spec is read-only in [WECMS DEV/CLAUDE.md](../WECMS%20DEV/CLAUDE.md).

---

## Purpose

Frontend for the WeCMS refactor R&D. Talks only to `wecms-api-main` over HTTP, renders Figma-driven UI, and persists lightweight client state (auth token, user profile, locale, saved ID) in `localStorage`.

Status: **R&D proof-of-concept**, local-only, GitLab-only. No deploy target. No server-side session, no Next.js API routes (none are defined), no SSR data fetching — the app is effectively a SPA inside the Next.js 16 App Router.

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

**VCS:** Git — `kosign-wecms/wecms-web-main` on GitLab.

**Explicitly NOT used:** NextAuth, next-intl, react-i18next, Redux/Zustand, react-query/SWR, Bootstrap, Material UI, Chakra, Heroicons. Do not introduce any of these without a written reason.

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
- **DTO field names stay UPPER_SNAKE** (`USER_ID`, `USER_NM`, `BIZ_KEY`, `LANG_CD`, `CMPN_NM`, `COMMON_HEAD`, `REC`) to match the JEX/WSVC contract the Spring Boot side emits. See [lib/types/api.ts](lib/types/api.ts).
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

Four screens are the **approved visual reference set** for `wecms-web-main`. Every new or re-implemented UI must match one of these patterns — do not invent a new look when a reference already covers the case, and do not create page-specific custom styles when an approved pattern already exists.

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
| Dialogs | `useDialog()` — warning / error / success / confirmation. Max modal width **500px** |

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

All system-level modals go through the global `useDialog()` API — **never** render a bespoke modal per page.

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

- Mounted once in `app/layout.tsx` via `<DialogProvider>`. Only one dialog is visible at a time.
- Four types: `warning | error | success | confirmation`.
- Rendered via `createPortal()` at `document.body`. ESC closes (if dismissible), Tab traps inside, overlay click dismisses, body scroll locks.

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

Figma WB365 is the source of truth for `wecms-web-main`. The full scale lives in `app/globals.css` under `@theme inline`. Consume via:

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
- Expanded width: `211px` (use `w-wb-sidebar`). Collapsed width: `65px`.
- The collapse arrow toggles **only** the sidebar width. It must **not** close the modal.
- Expanded state shows icons + text + section labels; collapsed state shows icons only.
- Bottom menu group is pinned at the bottom in this order:
  - Transaction History
  - Firm Banking Settings
  - Firm Banking History
- Icons must match Figma in both expanded and collapsed states.

### 4. Pagination
- Always use [components/shared/Pagination](components/shared/Pagination.tsx). No bespoke pagination per page.
- Standard pagination button size: `size-7`.
- Alignment and spacing match existing approved pages.
- Page-specific variants require explicit approval before landing.

### 5. Font and Font Size
- Use only the shared typography tokens (`text-wb-*`, `tracking-wb-*`) — see [Typography & tokens](#typography--tokens). No hardcoded pixel sizes or inline font styles.
- Page title, table header, table body, sidebar text, button text, and form labels stay consistent across all pages.
- Approved reference pages:
  - Account Inquiry (`/banking/account-inquiry`)
  - Approval Box (`/payment/approval-box`)
  - Sales / Expenses e-Invoices (`/addon/sales-einvoices`, `/addon/expenses-einvoices`)

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

### 7. Tables
- Use real semantic table elements: `<table>`, `<thead>`, `<tbody>`, `<tfoot>`, `<tr>`, `<td>`. Never simulate rows with `<div>`.
- Total/footer rows must align with the column widths of the body — share a `<colgroup>` across `<thead>` / `<tbody>` / `<tfoot>` (see [ApprovalTableColumns](components/payment/approval-box/ApprovalTableColumns.tsx)).
- For long tables:
  - body may scroll
  - total/footer rows stay visible when the design requires it
- Choice of shadcn `<Table>` vs. bare `<table>` + colgroup is covered in [Known Inconsistency — two table patterns](#known-inconsistency--two-table-patterns).

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

### 9. Responsive Rule
- Every page must support desktop, laptop, tablet, and mobile — verified at 375 / 768 / 1024 / 1440.
- No fixed-width layouts that break on smaller screens.
- Use responsive fallbacks (`max-width` / `max-height`, wrapping, horizontal scroll) where needed.
- Shell/filter/table/pagination behaviour is defined in [Responsive rules](#responsive-rules).

### 10. Refactor Rule
- This repo is the WeCMS refactor from JEX to Spring Boot + Next.js.
- For frontend UI work, update **only** `wecms-web-main/` unless the backend is explicitly required.
- Do not modify backend/API to satisfy a static UI task — stay in this tree.
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
- Exchange Rate Inquiry — read-only rate lookup, no per-row detail.
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
- **Per-transaction list pages with totals** still go through [`<PaymentListPage>`](components/payment/shared/PaymentListPage.tsx) — that template is for read-only per-transaction lookups (e.g. Exchange Rate Inquiry, Card Transactions) where rows are individual transactions, not uploaded file batches. Never route a batch-file page through `<PaymentListPage>`.
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

- Put the page at `app/(dashboard)/{feature}/{screen}/page.tsx` — inherits auth guard + `<AppShell>`.
- Add (or un-placeholder) the matching Sidebar/Header entry with a real `href` in the **same** MR as the page.
- Update `lib/routes.ts` if the new route is a module home.

### 3. Stack & composition

- **No new UI / form / state library.** Next.js 16 + Tailwind 4 + shadcn/ui is the full allowed stack.
- Page file stays thin — one feature component, optional `metadata`.
- Reuse from `components/layout/`, `components/shared/`, `components/ui/` before creating anything new.
- Copy-paste between feature components is not allowed. Lift to `components/shared/` first.

### 4. UX rules

- `cursor-pointer` on every clickable icon, row, badge, or chevron — and only on those.
- Hover background only where Figma specifies it; use `hover:bg-wb-*` tokens.
- All modals through `useDialog()`. Max width 500px.
- Language (`wecms_locale`) persists across logout — do not clear it.

### 5. Data rules

- **No new hardcoded mock arrays.** If an endpoint exists, wire it. If not, land it on the Spring Boot side in the same MR (full-stack ownership). Temporary mock is acceptable only if the PR description explicitly tracks the swap.
- DTO fields stay UPPER_SNAKE matching the backend.
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
LoginForm → lib/auth/client.login(userId, userPw)
         → POST /api/v1/auth/login { USER_ID, USER_PW }
         → { COMMON_HEAD: {...}, REC: { TOKEN, TOKEN_TYPE, EXPIRES_IN, USER_ID, USER_NM, BIZ_KEY, LANG_CD, CMPN_NM } }
         → tokenStorage.set(TOKEN)   (localStorage + cookie)
         → userStorage.set({ USER_ID, USER_NM, BIZ_KEY, LANG_CD, CMPN_NM })
         → saveId ? savedIdStorage.set(USER_ID) : savedIdStorage.clear()
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
  COMMON_HEAD: { ERROR: boolean; CODE: string; MESSAGE: string };
  REC?: T;
}
```

- Success is `COMMON_HEAD.ERROR === false` with a `REC`. Always check `COMMON_HEAD.ERROR` — HTTP 200 is not sufficient; the backend returns 200 for known business errors.
- Keep DTO types in [lib/types/api.ts](lib/types/api.ts). UPPER_SNAKE field names matching Spring Boot DTOs.

### Current API calls

| Endpoint | Method | Handler | Notes |
|---|---|---|---|
| `/api/v1/auth/login` | POST | `lib/auth/client.login()` | Payload: `{USER_ID, USER_PW}` |
| `/api/v1/auth/me` | GET | `lib/auth/client.fetchMe()` | Called by dashboard layout on mount to rehydrate user |
| `/api/v1/auth/logout` | POST | `lib/auth/client.logout()` | Best-effort; failure swallowed |

All other feature pages (Account Inquiry, Approval Box) use mock data — no API calls wired yet.

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
- Keep DTO JSON field names in UPPER_SNAKE matching the Spring Boot contract.

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
| PageActionButtons no handlers | `components/shared/PageActionButtons.tsx` | Print/Export/List buttons render but do nothing |
| Change Password no handler | `components/layout/ProfileMenu.tsx` | Button exists, handler is empty |
| Mock data in feature pages | `AccountInquiryPage.tsx`, `mockData.ts` | Replace with real API calls when backend endpoints land |
| `makeMockUuid()` in LoginForm | `components/auth/LoginForm.tsx` | Mints a client-side UUID for error dialogs; replace with `COMMON_HEAD.UUID` when backend adds it |
| Figma icons not exported | `ProfileMenu`, header icons | `ico_spark`, `ico_world`, `ico_keylock`, `ico_power`, pencil avatar-edit fall back to lucide glyphs |

## Notes for future implementation

- **Menu / permission resolution** — sidebar + top nav are declarative arrays. When the backend returns a resolved menu tree in the login/me response, drive these from that payload instead of hardcoding `href` lists.
- **Change Password** — `ProfileMenu` row is wired but handler is empty. First pass is a `useDialog()` form; long-term a dedicated route (`/settings/security`).
- **Server-side auth guard** — the current client-only guard is fine for R&D. Before any non-local deploy, move to Next.js middleware + cookie-bound token so protected routes never flash.
- **Real COMMON_HEAD.UUID** — replace `LoginForm.makeMockUuid()` when the API adds the field.
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

API base URL — `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8080`). The Spring Boot backend must be running; see [../wecms-api-main/CLAUDE.md](../wecms-api-main/CLAUDE.md) for bring-up.

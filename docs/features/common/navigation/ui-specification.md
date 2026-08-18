# Navigation — UI Specification (Frontend)

**Part of:** Common → navigation
**Last verified:** 2026-06-23

Verified against `Sidebar.tsx`, `SidebarMenuItem.tsx`, `Header.tsx`, `AppShell.tsx`. Tokens are WB365 —
no inline px/font.

## Shell (`AppShell.tsx`)

`h-screen` column: `<Header>` (sticky), then a `flex min-h-0 flex-1` row of `<Sidebar>` + `<main>`. Body
scroll locks when the mobile drawer is open (`:13-21`). `SettingsModalProvider` wraps the shell so the
top-nav Settings item and any page can pop the modal.

## Header top nav (`Header.tsx`)

| Element | Spec |
|---|---|
| Bar | `sticky top-0 z-30 h-[var(--h-wb-header)] bg-brand`, logo block reserved `lg:w-[195px]` to align nav with the 211px sidebar edge. |
| Nav | `hidden md:flex`; each item `h-[var(--h-wb-header)] gap-2.5 px-4 text-wb-15 font-medium`; icon `size-6`. |
| Active item | `bg-white text-brand-active` + Active icon variant; label always shown. |
| Inactive item | `text-white hover:bg-white/10` (with route/Settings) or `text-white/70 cursor-default` (placeholder). |
| Tablet (md) | inactive labels collapse (`hidden lg:inline`); only the active item shows its label. |
| Settings | rendered as a `<button>` (no `href`) → `settingsModal.open()`. |
| Right cluster | `gap-2.5`: `NotificationPopup` + `ProfileMenu` (avatar `size-8`). |

## Sidebar rail (`Sidebar.tsx`)

| Element | Spec |
|---|---|
| Rail | `w-[var(--w-wb-sidebar)]` (211px), `bg-wb-bg-sidebar`, `border-r border-wb-border-sidebar`, `overflow-x-hidden`. `lg:sticky` rail; `< lg` fixed slide-in drawer (`-translate-x-full` ↔ `translate-x-0`). z-40 drawer over z-30 backdrop. |
| Company header | icon slot + `companyLabel` (`text-wb-13 font-semibold text-wb-ink`); drawer-only X close (`lg:hidden`). |
| Scroll region | `custom-scrollbar-y flex min-h-0 flex-1 overflow-y-auto pt-2 pb-3`, `gap-4` between groups. |
| Group heading | `text-wb-11 font-medium uppercase text-black/70`; optional VND/FCY badge (`bg-wb-ntrl-3 border-wb-ntrl-4`, `badgeHidden → opacity-0`). |
| MENU group | drawer-only (`lg:hidden`); mirrors the top nav with Active header icons. |

## `SidebarMenuItem` (`SidebarMenuItem.tsx`)

Single source of truth for every nav row. Three modes:

| Mode | Trigger | Behaviour |
|---|---|---|
| Link row | `href`, no `expandable` | `<Link>`; `aria-current="page"` when active. |
| Expandable parent | `expandable`, no `href` | `<button>` firing `onToggle`; chevron rotates `rotate-0` (open) / `-rotate-90` (closed); **no navigation**. |
| Button (no nav) | `onClick`, no `href` | drawer MENU → Settings opens the modal. |
| Disabled placeholder | neither | `disabled`, `opacity-60`. |

| Token | Value |
|---|---|
| Row | `flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left` |
| Active | `bg-wb-bg-active` + label `text-brand` |
| Interactive (inactive) | `cursor-pointer hover:bg-black/5` + label `text-wb-ink` |
| Icon slot | fixed `size-5` (`iconNode` ▶ `icon` ▶ `indent` spacer ▶ none) |
| Label | `min-w-0 flex-1 truncate text-wb-13 font-medium` |
| Chevron | `/assets/sidebar/ico-chevron.svg` `size-4`; child rows pass `indent` to align under the parent label |

## Active state derivation

No server-supplied active flag. From `usePathname()`:

- **Sidebar leaf** active when `pathname === href || pathname.startsWith(href + "/")` (keeps Payment
  detail pages highlighted — `Sidebar.tsx:380-382`).
- **Sidebar branch** active when any descendant `href` matches (`isBranchActive`).
- **Header item** active when `pathname === prefix || pathname.startsWith(prefix + "/")` (prefix =
  `activePrefix ?? href`).

## Presentation registry (look unchanged from the old hardcoded rails)

The API `label` (JWT-language-resolved) and `icon` (legacy export hint) are **not** rendered directly.
`sidebarNav.ts` maps the tree node id → `labelKey` (i18n via `locales/{en,ko,vi}.json`, so the client
language toggle works) + `icon` (`/assets/sidebar/*.svg`) + group `badge`. Structure, ordering (`seq`),
routes, and visibility all come from the API.

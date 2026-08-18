# Notification — UI Specification (Frontend)

**Part of:** Common → notification
**Last verified:** 2026-06-23

Visual + layout spec for the bell and slide-over. Source of truth:
`components/layout/notifications/{NotificationPopup,NotificationTabs,NotificationSearch,NotificationItem}.tsx`.
Figma: bell/panel `12346:43819`, tabs `12346:43825`, search `12346:43832`. All sizing via WB365 tokens.

## Bell trigger (`NotificationPopup.tsx`)

- Round icon button, `/assets/header/ico-bell.svg` at `size-6`. Hover `bg-white/10`, focus ring
  `ring-white/60`. `aria-haspopup="dialog"`, `aria-expanded`.
- Unread badge: top-right pill, `bg-wb-red-07` + white, `h-[18px] min-w-[18px]`, `text-wb-10 font-bold`.
  `> 99` ⇒ `99+`. Hidden when `unreadCount === 0`.

## Slide-over panel

- `role="dialog"`, right-docked: `fixed right-0 top-[var(--h-wb-header)] bottom-0 z-50`, `w-[405px]
  max-w-[calc(100vw-16px)]`. `border-l border-wb-border-sidebar`, `bg-white`, soft shadow, fade/slide-in
  animation. Internal vertical scroll only.
- **Title bar** — `px-5 py-3`, title `text-wb-18 font-bold text-wb-ink`, X close button (lucide `X`
  `size-5`).
- **Tabs + Read All** — `border-b`, `px-5 py-2.5`, tabs left + Read All button right. Read All:
  `bg-brand` pill, `text-wb-14 font-medium`, white, `shadow-wb-brand-btn`, hover `bg-brand-hover`,
  `disabled:opacity-50` when busy / no unread.
- **Search** — `px-5 pt-[13px] pb-[13px]`, the shared `<SearchInput>` widened to full width.
- **List** — the only scroll area: `custom-scrollbar-y min-h-0 flex-1 overflow-y-auto`. Loading =
  centered `Loader2` spinner; error = `notification.load_error`; empty = `notification.empty`
  (both `text-wb-13 font-medium text-wb-muted`, `px-5 py-10`).

## Tabs (`NotificationTabs.tsx`)

- Two buttons, `gap-[30px]`. Active: `font-bold text-wb-ink` + a `bg-wb-ink` underline (`h-0.5`, animated
  opacity). Inactive: `font-medium text-wb-ink/60`, hover `text-wb-ink`. Both `text-wb-13`.
- Keys: `notification.tab.unread`, `notification.tab.all`.

## Search (`NotificationSearch.tsx`)

- Wraps the sanctioned shared `<SearchInput>` (`md:w-full`). Placeholder `notification.search_placeholder`.
  Controlled by the parent (`value`/`onChange`).

## Item row (`NotificationItem.tsx`)

- Full-width `<button>`, `flex items-start gap-3 border-b px-5 py-3 text-left`.
- **Read tint:** unread = `bg-brand-soft` (hover `bg-brand-softer`); read = `bg-white` (hover `bg-brand-soft`).
- **Avatar:** `size-9` white circle, `border-wb-border-sidebar`, `/assets/header/logo-mark.svg` (`h-4`).
- **Content column** (`gap-1`):
  - Row 1: sender name `truncate text-wb-13 font-semibold text-wb-ink` (fallback
    `notification.sender_fallback`) + time `text-wb-13 font-medium text-wb-muted` (right, `whitespace-nowrap`).
  - Title (when present): `text-wb-13 font-medium text-wb-ink`.
  - Content (when present): `text-wb-13 font-normal text-wb-muted` (approval notifications store `""` so
    this line is usually absent).
  - Fallback (only when BOTH title + content empty): `notification.untitled`, so a row never renders blank.

## i18n keys used

`notification.title`, `notification.close`, `notification.read_all`, `notification.search_placeholder`,
`notification.tab.unread`, `notification.tab.all`, `notification.empty`, `notification.load_error`,
`notification.sender_fallback`, `notification.untitled`, `notification.deleted_message`,
`notification.no_detail`, `nav.notifications`, plus shared `dialog.error` / `dialog.warning`. All three
locales (`en`/`ko`/`vi`) must carry them.

## Constraints

- Typography is WB365 `text-wb-*` tokens only — no `text-[Npx]` / inline font styles.
- The scroll surface uses the shared `custom-scrollbar-y` utility — no per-component scrollbar CSS.
- System messages (deleted / no-detail / errors) go through the shared `useDialog()` — never a bespoke
  per-panel banner.

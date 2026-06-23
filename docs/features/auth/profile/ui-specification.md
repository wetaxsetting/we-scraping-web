# Auth > Profile — UI Specification (Frontend)

The implemented ProfileMenu dropdown UI. Figma node **65:21424** (Sonny-Dev). Lives in the shell chrome
([`components/layout/`](../../../../components/layout/)) and reuses the shared typography tokens + the
shared `useDialog()` confirmation surface. Backend reference (tenant directory):
[wecms-api/docs/features/auth/profile/functional-specification.md](../../../../../wecms-api/docs/features/auth/profile/functional-specification.md).

---

## Trigger button (header)

[`<ProfileMenu>`](../../../../components/layout/ProfileMenu.tsx) renders inside
[`Header.tsx`](../../../../components/layout/Header.tsx) as the right-most action.

- Round button `flex size-8 cursor-pointer items-center justify-center rounded-full`, hover
  `hover:opacity-90`, focus ring `focus-visible:ring-2 focus-visible:ring-white/60`.
- Holds `<img src={avatarSrc} className="size-8 rounded-full">` — default `avatarSrc =
  "/assets/header/avatar.svg"` (overridable via the `avatarSrc` prop).
- a11y: `aria-label={t("nav.account_menu")}`, `aria-haspopup="menu"`, `aria-expanded={open}`.

## Dropdown card

```
absolute right-0 top-full z-40 mt-2 w-[280px] max-w-[calc(100vw-16px)]
rounded-[10px] bg-white shadow-wb-popup
```

- **No `overflow-hidden`** — would clip the floating language submenu. Rounded corners are applied to
  the first child (`rounded-t-[10px]`) and last child (`rounded-b-[10px]`) instead.
- `role="menu"`, `aria-label={t("nav.account_menu")}`.

## User identity block

```
flex flex-col items-center gap-[10px] rounded-t-[10px]
border-b border-wb-ntrl-4 px-[10px] pt-4 pb-[14px]
```

| Element | Styling | Source |
|---|---|---|
| **Avatar** | `size-16` round container `bg-brand-soft`, soft shadow + `ring-white/10`; `<img>` `size-full object-cover` | `avatarSrc` (default `/assets/header/avatar.svg`) |
| **Edit pencil** | absolute `-bottom-1 -right-1`, `bg-white p-[6px]` round chip, soft shadow; `lucide` `Pencil size-4 text-wb-ntrl-6`; `aria-label={t("profile.edit_photo")}` | **UI-only — no `onClick`** (MISSING) |
| **Name** | `text-wb-16 font-semibold tracking-wb-tight text-wb-ink` | `user?.userName ?? t("profile.guest")` |
| **Secondary (user id)** | `text-wb-13 font-medium tracking-wb-tight text-wb-ink opacity-50` (rendered only when non-empty) | `user?.userId ?? ""` |

> The name uses the popup-title scale (16 / 600) matching the compact Settings dialog title; the user id
> is one step down (13) and muted via `opacity-50`. These are intentional per the Figma node — they sit
> just above the global "Body text" token and are documented here so future passes don't "correct" them.

## Language row + submenu

**Languages row** — `flex w-full items-center justify-between px-4 py-[14px]`, bottom border
`border-wb-ntrl-4`:

- Left: `lucide` `Globe size-[18px] text-wb-ntrl-6` + `t("profile.languages")` at `text-wb-14 font-medium
  tracking-wb-tight text-wb-ink`.
- Right: active locale label `t(LOCALE_LABEL_KEY[locale])` (same text token) + `lucide` `ChevronDown
  size-[18px]` that rotates `180°` when `langOpen`.
- a11y: `role="menuitem"`, `aria-haspopup="menu"`, `aria-expanded={langOpen}`.

**Submenu** (absolutely positioned, floats over the rows below):

```
absolute top-full right-4 z-50 w-[152px] overflow-hidden
rounded-[10px] bg-white py-1 shadow-wb-popup
```

- One radio button per `LOCALES` entry (`EN` / `KO` / `VI`): `flex h-8 w-full items-center
  justify-between px-3`; `role="menuitemradio"`, `aria-checked={active}`.
- Label `text-wb-14 tracking-wb-tight`; active → `font-semibold text-brand` + trailing `lucide` `Check
  size-4 text-brand`; inactive → `font-medium text-wb-ink`.
- Hover: active row `hover:bg-brand/5`, inactive `hover:bg-black/5`.
- Labels come from `LOCALE_LABEL_KEY`: `profile.language_english` ("English"),
  `profile.language_korean` ("한국어"), `profile.language_vietnamese` ("Tiếng Việt"). These native names
  are identical across all three locale JSON files.

## Change Password row

`flex w-full items-center gap-[10px] px-4 py-[14px]`; `role="menuitem"`:

- `lucide` `Lock size-[18px] text-wb-ntrl-6` + `t("profile.change_password")` at `text-wb-14 font-medium
  tracking-wb-tight text-wb-ink`.
- Click → `setOpen(false)` + `setPwOpen(true)` (opens `<ChangePasswordDialog>`).

## Logout rail

`flex w-full items-center gap-[10px] rounded-b-[10px] border-t border-wb-ntrl-4 bg-wb-bg-sidebar px-4
py-[14px]`; `role="menuitem"`; `disabled={isPending}` → `disabled:cursor-wait disabled:opacity-60`:

- Power glyph `<img src="/assets/header/ico-power.svg" className="size-[18px]">` (Figma SVG — not lucide)
  + `t("profile.logout")` / `t("profile.signing_out")` while `isPending`, at `text-wb-14 font-medium
  tracking-wb-tight text-wb-ink`.

## Dialog variants & buttons (project-wide rules)

- Both confirmations (language switch, logout) use `useDialog()` `type:"confirmation"` — green chrome,
  Cancel + Continue pair, titled with the shared `dialog.confirmation` key (never the module name).
- Buttons: `confirmText: t("dialog.yes")`, `cancelText: t("dialog.no")` (shared keys).
- `useDialog()` feedback renders at `z-[100]`, above the dropdown's `z-40` card and the submenu's `z-50`.
- The avatar-edit pencil, if/when wired, would open a feature dialog (shadcn `<Dialog>`), not a system
  dialog — but it is currently inert.

## States

Open / close / submenu / dialog behaviour per [screen-flow.md](screen-flow.md). The dropdown has no
loading / empty / error states of its own — the identity block simply falls back to `profile.guest`
when `userStorage.get()` returns `null`.

## i18n keys

| Key | EN value |
|---|---|
| `nav.account_menu` | "Account menu" (trigger + card aria-label) |
| `profile.guest` | "Guest" (name fallback) |
| `profile.edit_photo` | "Edit profile photo" (pencil aria-label) |
| `profile.languages` | "Languages" |
| `profile.language_english` | "English" |
| `profile.language_korean` | "한국어" |
| `profile.language_vietnamese` | "Tiếng Việt" |
| `profile.change_password` | "Change Password" |
| `profile.logout` | "Logout" |
| `profile.signing_out` | "Signing out…" |
| `language.confirm_description` | "Would you like to use {language} as the default language for WeCMS?" |
| `logout.confirm_description` | "Are you sure you want to exit WeCMS?" |
| `dialog.confirmation` / `dialog.yes` / `dialog.no` | shared confirmation dialog chrome |

All present in `locales/{en,ko,vi}.json`. `profile.back` exists in the locale file but is not consumed
by ProfileMenu.

> **Known fallback (per `wecms-web/CLAUDE.md` § Known Issues):** the Figma `ico_world` / `ico_keylock`
> / pencil avatar-edit icons are not yet exported — the language `Globe`, change-password `Lock`, and
> avatar `Pencil` glyphs fall back to `lucide-react`. Only the power glyph uses the exported Figma SVG
> (`/assets/header/ico-power.svg`).

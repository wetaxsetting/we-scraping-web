# Auth > Profile — Screen Flow (Frontend)

Interaction flow for the ProfileMenu dropdown (the frontend "profile" surface). There is **no route** —
the surface opens from the top-nav avatar button. Backend identity contract:
[wecms-api/docs/features/auth/profile/business-flow.md](../../../../../wecms-api/docs/features/auth/profile/business-flow.md)
(tenant directory) and the `/me` flow in
[session-management](../session-management/screen-flow.md).

```
Header (top nav) → avatar button → ProfileMenu dropdown opens
   (visible to every authenticated session — no menu permission gate)
      │
      ▼
On first render: setUser(userStorage.get())   ← StoredUser populated by login + /api/v1/auth/me
      │
      ▼
Dropdown card renders:
  ┌─────────────────────────────────┐
  │ [avatar] + ✎ edit (UI-only)     │  ← user identity block
  │   userName (or "Guest")         │
  │   userId                        │
  ├─────────────────────────────────┤
  │ 🌐 Languages   <current> ▾      │  → language submenu
  ├─────────────────────────────────┤
  │ 🔒 Change Password              │  → <ChangePasswordDialog>
  ├─────────────────────────────────┤
  │ ⏻ Logout                        │  → confirmation → logout()
  └─────────────────────────────────┘
```

---

## States

| State | Trigger | UI |
|---|---|---|
| **Closed** | initial / outside-click / ESC | only the avatar button (`size-8`, `/assets/header/avatar.svg`) shows in the header |
| **Open** | click avatar button | dropdown card (`w-[280px]`, `shadow-wb-popup`); `aria-expanded=true` |
| **User block** | dropdown open | avatar (`size-16`) + edit pencil + `userName` + `userId`; `profile.guest` ("Guest") when `userStorage.get()` is `null` |
| **Avatar edit (pencil)** | hover / click pencil | **no-op** — UI-only placeholder, no handler, no upload dialog (**MISSING**) |
| **Language submenu closed** | dropdown open | "Languages" row shows the active locale label + chevron-down |
| **Language submenu open** | click "Languages" row | floating radio submenu (`w-[152px]`) anchored bottom-right of the row; EN / KO / VI; active row marked with a `Check` glyph + `text-brand`; `aria-checked` set |
| **Language switch — confirm** | click a non-active locale | `useDialog()` `type:"confirmation"` (`language.confirm_description`, interpolating the target language native name) → **Yes** → `setLocale(next)` + close submenu |
| **Language switch — cancel** | confirmation **No** / dismiss | no locale change; submenu stays as-is |
| **Language re-select active** | click the already-active locale | **no-op** (early `return` — no dialog) |
| **Change Password** | click "Change Password" row | closes dropdown (`setOpen(false)`) + opens `<ChangePasswordDialog>` (`setPwOpen(true)`) — see [change-password](../change-password/screen-flow.md) |
| **Logout** | click "Logout" row | closes dropdown + `useDialog()` `type:"confirmation"` (`logout.confirm_description`) → **Yes** → `logout()` then `router.replace("/login")`; row shows `profile.signing_out` while `isPending` — see [logout](../logout/screen-flow.md) |

---

## Open / close behaviour

- **Open / toggle** — the avatar button toggles `open`. The card is conditionally rendered (`{open && …}`).
- **Outside click** — a `pointerdown` listener on `document` closes the dropdown when the click is
  outside `wrapperRef`.
- **ESC** — when the language submenu is open, ESC closes **only the submenu**; otherwise ESC closes the
  whole dropdown (one layer per keypress).
- **Submenu auto-collapse** — closing the dropdown resets `langOpen` to `false`, so the next open starts
  with the submenu collapsed.
- **No `overflow-hidden` on the card** — the language submenu is absolutely positioned and would be
  clipped; rounded corners are applied to the first/last children instead.

> The ProfileMenu dropdown is a **bespoke header popover**, not a `<SettingsModal>` / shadcn `<Dialog>`
> stack — it does not participate in the §"Modal stacking convention" `stackLevel` system. The only
> shared modal surfaces it triggers are the `useDialog()` confirmation dialogs (language switch, logout)
> at `z-[100]` and the `<ChangePasswordDialog>` feature dialog.

---

## Language persistence

Selecting a locale through the confirmation dialog calls `setLocale(next)`, which:

1. Updates the React locale state (re-renders all `t(...)` consumers immediately).
2. Persists `next` to `localStorage` under `wecms_locale`.
3. Keeps `<html lang>` in sync via `LocaleProvider`'s effect.

`wecms_locale` **survives logout** (the logout flow never calls `localStorage.clear()` and only clears
`wecms_token` + `wecms_user`). The locale is read back on next mount by `LocaleProvider`. This is a
purely **client-only** change — no API call (**MATCH**).

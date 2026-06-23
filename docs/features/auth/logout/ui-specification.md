# Logout — UI Specification (Frontend)

The implemented logout UI. Logout has no page or dialog of its own — it is a row inside the
shared profile dropdown plus the shared system confirmation dialog. Backend reference:
[wecms-api/docs/features/auth/logout/functional-specification.md](../../../../../wecms-api/docs/features/auth/logout/functional-specification.md).

---

## ProfileMenu logout row

Rendered by [`<ProfileMenu>`](../../../../components/layout/ProfileMenu.tsx) as the bottom
**Logout rail** of the avatar dropdown (Figma node 65:21424). The dropdown card carries the
user block, Languages submenu, Change Password row, and the Logout rail in that order.

- **Container:** bottom rail of the dropdown card, `rounded-b-[10px] border-t border-wb-ntrl-4
  bg-wb-bg-sidebar px-4 py-[14px]` — the `rounded-b-*` clips the card's bottom corners (the
  card itself must not use `overflow-hidden`, which would clip the Languages submenu).
- **Icon:** `/assets/header/ico-power.svg` at `size-[18px]` (`aria-hidden`) — the Figma red
  power glyph. Falls back to lucide elsewhere but the power asset is committed.
- **Label:** `text-wb-14 font-medium tracking-wb-tight text-wb-ink`.
- **Role / a11y:** `role="menuitem"`, inside the `role="menu"` dropdown.
- **Click:** `onClick={handleLogout}` — closes the dropdown (`setOpen(false)`) then opens the
  confirmation dialog.

## Confirmation dialog (variant: confirmation)

`handleLogout` opens the shared [`useDialog()`](../../../../components/shared/dialog/) system
dialog — **not** a bespoke dialog. The variant is fixed:

```tsx
dialog.open({
  type: "confirmation",
  title: t("dialog.confirmation"),          // shared key — never the module name
  description: t("logout.confirm_description"),
  confirmText: t("dialog.yes"),
  cancelText: t("dialog.no"),
  onConfirm: () => {
    startLogout(async () => {
      await logout();
      router.replace("/login");
    });
  },
});
```

- **Variant:** `type: "confirmation"` (green/teal icon) per `wecms-web/CLAUDE.md` §"Dialog
  variant" — logout is a "are you sure?" prompt, not an error/warning. Renders the secondary
  + primary pair: **No** (white, left) + **Yes** (`bg-brand`, right).
- **Title:** the shared `dialog.confirmation` key ("Confirmation"). It is **not** titled with
  the module name — per the project-wide title rule.
- **`destructive` flag:** NOT set — logout uses the standard blue Yes (not a red CTA).
- **Buttons:** labelled with shared `dialog.yes` / `dialog.no` keys, inheriting the
  `<SystemDialog>` button colours; the call site passes no custom classes.
- **Close behaviour:** OK/Confirm/Cancel/X only — outside-click and ESC do **not** dismiss
  (per §"Modal stack — interaction & close behaviour"). On **No** / dismiss the session is
  untouched and no network call fires.

## Signing-out transition state

The confirm path runs inside [`useTransition()`](../../../../components/layout/ProfileMenu.tsx)
(`const [isPending, startLogout] = useTransition()`):

- While `isPending`, the Logout rail label flips from `profile.logout` ("Logout") to
  `profile.signing_out` ("Signing out…").
- The rail is `disabled={isPending}` with `disabled:cursor-wait disabled:opacity-60` — a
  second click can't re-fire logout while the POST + redirect resolve.

```tsx
<button … disabled={isPending} onClick={handleLogout}
  className="… disabled:cursor-wait disabled:opacity-60">
  <img src="/assets/header/ico-power.svg" … className="size-[18px]" />
  <span className="text-wb-14 font-medium tracking-wb-tight text-wb-ink">
    {isPending ? t("profile.signing_out") : t("profile.logout")}
  </span>
</button>
```

> Note: because the dialog closes on confirm, the rail is only briefly visible in the pending
> state before `router.replace("/login")` unmounts the dashboard shell. The disabled + label
> swap still guard against a fast double-trigger.

## i18n keys

| Key | EN value | Used for |
|---|---|---|
| `logout.confirm_description` | "Are you sure you want to exit WeCMS?" | confirmation dialog body |
| `profile.logout` | "Logout" | Logout rail label (idle) |
| `profile.signing_out` | "Signing out…" | Logout rail label (pending) |
| `dialog.confirmation` | "Confirmation" | dialog title (shared) |
| `dialog.yes` / `dialog.no` | "Yes" / "No" | confirm / cancel buttons (shared) |

All present in `locales/{en,ko,vi}.json`. No `km.json` (Khmer not yet supported by
`wecms-web`).

## What logout has no UI for

- **No logout page / route** — it is a dropdown row + shared dialog only.
- **No error dialog** on a failed logout POST — the error is swallowed (the local cleanup is
  the effective logout). This is intentional and differs from login / change-password.
- **No success dialog** — the redirect to `/login` is the only confirmation.

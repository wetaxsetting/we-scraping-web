# Auth > Change Password — Frontend Feature (Refactor)

**Status:** ✅ Working — the profile dropdown "Change Password" row opens a wired feature dialog
(shadcn `<Dialog>`, `max-w-[400px]` `rounded-2xl`) that validates client-side (Zod), calls
[`lib/auth/client.changePassword(...)`](../../../../lib/auth/client.ts) →
`POST /api/v1/auth/change-password`, and surfaces success / error through the shared system dialog.
Verified against the live frontend code (2026-06-23). Classification: **MATCH**.
**Menu:** Header → **ProfileMenu** (avatar dropdown) → **Change Password** row (no standalone route)
**Slug:** `change-password` (matches the JEX-traceability + backend counterparts)
**Backend endpoint:** `POST /api/v1/auth/change-password` (authenticated; legacy `comm_0400_001_u001` mirror)

> **Stale-fact correction.** The old root docs (and `wecms-web/CLAUDE.md` "Feature Status" table)
> claimed Change Password is *"Not implemented / handler is empty"*. That is **STALE** — the feature is
> **fully built**: [`<ChangePasswordDialog>`](../../../../components/layout/ChangePasswordDialog.tsx)
> is mounted in [`<ProfileMenu>`](../../../../components/layout/ProfileMenu.tsx) and the
> [`changePassword`](../../../../lib/auth/client.ts) client wraps the live endpoint. Document as
> **Working / MATCH**.
>
> This folder is the frontend documentation home for **Auth > Change Password**. The matching backend
> docs are at
> [wecms-api/docs/features/auth/change-password/](../../../../../wecms-api/docs/features/auth/change-password/README.md).

---

## What this is

A self-service password change for the signed-in user. There is no page or route — it is a **feature
dialog** opened from the **Change Password** row inside
[`<ProfileMenu>`](../../../../components/layout/ProfileMenu.tsx). The dialog has three password fields
(Current / New / Confirm), validates with a Zod schema (each required ≤ 100; **new must equal confirm**),
and on a clean submit calls [`changePassword(current, new, confirm)`](../../../../lib/auth/client.ts),
which POSTs `{ current_password, new_password, confirm_password }`. Success shows a `type: "success"`
system dialog and then closes the popup; failures show a `type: "error"` dialog with the mapped backend
code. The fields clear on every close (Cancel / X / outside-click suppressed / success) so a typed
password never leaks into the next open.

It is a standalone (`stackLevel` 1) feature dialog — NOT a `useDialog()` system dialog. Validation and
result *messages* route through the shared system dialog (same pattern as `LoginForm`); the form chrome
itself is the shadcn primitive.

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Open from ProfileMenu → fill → Zod validate → submit → success/error → close; fields-clear-on-close |
| [ui-specification.md](ui-specification.md) | Feature-dialog spec (`max-w-[400px]` `rounded-2xl`, header/body/footer rhythm), field layout, button system, error/success dialog variants, i18n keys |
| [component-index.md](component-index.md) | `ChangePasswordDialog`, `ProfileMenu` trigger, `lib/auth/client.changePassword`, Zod schema, shared `ModalField`/`ModalInput` (paths + roles) |
| [api-consumption.md](api-consumption.md) | Request/response, wire type `ChangePasswordRequestRec`, error code → message mapping |
| [test-scenarios.md](test-scenarios.md) | Mismatch / wrong-current / reuse / success / blank scenarios; automated-test gap |

---

## Quick facts

| Aspect | Value |
|---|---|
| Trigger | [`<ProfileMenu>`](../../../../components/layout/ProfileMenu.tsx) — Change Password row (`setPwOpen(true)`) |
| Dialog | [`<ChangePasswordDialog>`](../../../../components/layout/ChangePasswordDialog.tsx) — shadcn `<Dialog>`, `max-w-[400px]` `rounded-2xl` `p-0` |
| Stack level | `1` (standalone, opened from the header ProfileMenu — not from inside Settings) |
| Fields | Current Password · New Password · Confirm Password (each `type="password"`, required ≤ 100) |
| Validation | Zod (`changePasswordSchema`) — per-field required + `newPassword === confirmPassword` (`refine` on `confirmPassword`) |
| Client fn | [`changePassword(current, new, confirm)`](../../../../lib/auth/client.ts) |
| Endpoint | `POST /api/v1/auth/change-password` — body `{ current_password, new_password, confirm_password }` |
| Wire type | [`ChangePasswordRequestRec`](../../../../lib/types/api.ts) (snake_case) |
| Success | `useDialog()` `type: "success"` (`change_password.success`) → on confirm/close → `onOpenChange(false)` |
| Error codes | `WBE2091` · `WBE_CHANGE_PASSWORD_MISMATCH` · `WBE_CHANGE_PASSWORD_REUSED` · `WBE_VALIDATION` (+ `WBE1401`, network/parse) |
| Close behaviour | Cancel / X close; `closeOnOutsideClick={false}`; ESC enabled; **fields cleared on close** (`reset()` on `!open`) |
| Frontend tests | **MISSING** — no `*.test.tsx` / `*.spec.tsx` cover this dialog |
| Parity vs legacy | **MATCH** — mirrors `comm_0401_001` popup / `comm_0400_001_u001` action |

---

## Related docs

- **Backend feature folder:** [wecms-api/docs/features/auth/change-password/](../../../../../wecms-api/docs/features/auth/change-password/README.md)
- **Sibling — profile:** [../profile/README.md](../profile/README.md)
- **Sibling — login:** [../login/README.md](../login/README.md)
- **Sibling — logout:** [../logout/README.md](../logout/README.md)
- **Auth feature index:** [../README.md](../README.md)

# Change Password — Screen Flow (Frontend)

Interaction flow for the Change Password feature dialog. Backend flow:
[wecms-api/docs/features/auth/change-password/business-flow.md](../../../../../wecms-api/docs/features/auth/change-password/business-flow.md).

```
Header → avatar → <ProfileMenu> opens → "Change Password" row
   (setOpen(false); setPwOpen(true) — profile popup closes, dialog opens)
      │
      ▼
<ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen}>  (shadcn <Dialog>, stackLevel 1)
      │  three password fields — Current / New / Confirm (RHF + Zod)
      ▼
User fills + submits (Save)
      │
      ├── Zod invalid ─────────────► system error dialog (first error, top-to-bottom)
      │                              onClose → setFocus(field); API never fires
      │
      ▼ Zod valid
changePassword(current, new, confirm)
      │  POST /api/v1/auth/change-password {current_password, new_password, confirm_password}
      │
      ├── status.error = true ─────► system error dialog (mapped code: WBE2091 /
      │                              WBE_CHANGE_PASSWORD_MISMATCH / WBE_CHANGE_PASSWORD_REUSED /
      │                              WBE_VALIDATION / WBE1401 / network / parse)
      │
      ▼ status.error = false
system success dialog (change_password.success)
      │  onConfirm / onClose → onOpenChange(false)
      ▼
dialog closes → reset() clears all three fields → next open starts blank
```

---

## States

| State | Trigger | UI |
|---|---|---|
| **Closed (idle)** | initial mount | dialog not rendered (`open=false`); `<ChangePasswordDialog>` always mounted in `<ProfileMenu>`, gated by `pwOpen` |
| **Open** | ProfileMenu → Change Password row | dialog renders blank; title `change_password.title`; three empty password fields |
| **Editing** | user types | RHF tracks values; no live network call; `aria-invalid` flips per field on a failed submit |
| **Submitting** | Save pressed, Zod passed | Save button `disabled` + `aria-busy`, spinner (`Loader2`), label → `change_password.saving`; POST in flight |
| **Client-validation error** | Save pressed, Zod failed | API does **not** fire; `useDialog()` `type:"error"` shows the first error in `FIELD_ORDER`; `onClose` → `setFocus(field)` |
| **Backend error** | `status.error === true` | `useDialog()` `type:"error"`; description = backend message, `errorCode` = `status.code`, `uuid` = `trace_id` |
| **Success** | `status.error === false` | `useDialog()` `type:"success"` (`change_password.success`); `onConfirm`/`onClose` → `onOpenChange(false)` |
| **Closed (post-success / cancel)** | success ack, Cancel, X | `reset()` fires (the `!open` effect) so the three fields clear |

---

## Validation order (client-side, Zod)

`changePasswordSchema` ([ChangePasswordDialog.tsx](../../../../components/layout/ChangePasswordDialog.tsx)):

1. **Per-field required** — `currentPassword` / `newPassword` / `confirmPassword` each `min(1)`
   (keys `change_password.current_required` / `new_required` / `confirm_required`) and `max(100)`
   (`login.password_max`).
2. **New ≠ Confirm** — `.refine(d => d.newPassword === d.confirmPassword)` attaches the error to
   `confirmPassword` (key `change_password.mismatch`) so it surfaces *after* the per-field required
   checks.

On an invalid submit, the handler walks `FIELD_ORDER` (`currentPassword → newPassword → confirmPassword`)
and opens **one** error dialog for the first message found, focusing that field on close. The new ≠
confirm check is a frontend backstop for the backend `WBE_CHANGE_PASSWORD_MISMATCH` — the client catches
it before the request leaves the browser. The backend reuse-history check (`WBE_CHANGE_PASSWORD_REUSED`)
and wrong-current check (`WBE2091`) have **no** client backstop — they surface from the API response.

---

## Close & field-clearing model

- The dialog dismisses via the **X** close icon (shadcn default) or the **Cancel** button
  (`onOpenChange(false)`). **Outside / overlay click does not dismiss** (`closeOnOutsideClick={false}`)
  so a stray backdrop click never discards a typed password. **ESC stays enabled** (primitive default).
- A `useEffect` watches `open`; when it goes `false`, `reset()` clears all three fields. This covers
  every close path — Cancel, X, ESC, and the success-ack `onOpenChange(false)` — so the next open is
  always blank. Passwords are never persisted to `localStorage` / `sessionStorage`; they live only in
  React Hook Form state for the open lifetime.

---

## Authorization & visibility

The Change Password row is always present in `<ProfileMenu>` for any signed-in user — there is no
per-grant gate (it is self-service, not an admin action). The backend enforces authentication on the
endpoint; an unauthenticated/expired session yields `WBE1401`, handled by the global Axios
session-expired interceptor (see [api-consumption.md](api-consumption.md)).

# Change Password — Component Index (Frontend)

Component / trigger / client / schema / shared-primitive file map. Backend mirror:
[wecms-api/docs/features/auth/change-password/source-code-index.md](../../../../../wecms-api/docs/features/auth/change-password/source-code-index.md).

---

## Component

| File | Role |
|---|---|
| [components/layout/ChangePasswordDialog.tsx](../../../../components/layout/ChangePasswordDialog.tsx) | The feature dialog. Owns the Zod schema (`changePasswordSchema`), the React Hook Form instance, the `FIELD_ORDER` first-error walk, the submit handler (calls `changePassword(...)`), the success/error → `useDialog()` mapping, and the `reset()`-on-close effect. Renders the shadcn `<Dialog>` shell + three `PasswordField` rows + Cancel/Save footer. Props: `{ open, onOpenChange }`. |
| `PasswordField` (local helper inside the same file) | One password row — composes shared `<ModalField>` (label + required `*`) + `<ModalInput>` (`type="password"`), spreading `{...register(field)}`. |

---

## Trigger (opener)

| File | Role |
|---|---|
| [components/layout/ProfileMenu.tsx](../../../../components/layout/ProfileMenu.tsx) | Header avatar dropdown. Holds `const [pwOpen, setPwOpen] = useState(false)`. The **Change Password** menu row's `onClick` runs `setOpen(false); setPwOpen(true)` (closes the profile popup, opens the dialog). Mounts `<ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />` at the end of its tree. Row label = `t("profile.change_password")`, lucide `Lock` icon. |

---

## API client

| File | Role |
|---|---|
| [lib/auth/client.ts](../../../../lib/auth/client.ts) | `changePassword(currentPassword, newPassword, confirmPassword): Promise<void>` — translates the camelCase args to the snake_case `ChangePasswordRequestRec`, POSTs `/api/v1/auth/change-password`, checks `env.status.error`, and rejects with `LoginError(code, message, traceId)` on any failure (via the shared `toLoginError` funnel). Resolves `void` on success. `LoginError` is the same typed error class used by `login` / `fetchMe`. |

---

## Schema + wire type

| File | Role |
|---|---|
| `changePasswordSchema` (in [ChangePasswordDialog.tsx](../../../../components/layout/ChangePasswordDialog.tsx)) | Zod object — `currentPassword` / `newPassword` / `confirmPassword` each `min(1)` (required) + `max(100)`, plus a `.refine(newPassword === confirmPassword)` cross-field check attached to `confirmPassword`. Messages are translation keys (resolved by the caller via `t(...)`), per the `loginSchema` convention. **The schema is local to this dialog** — there is no separate `changePasswordSchema.ts` file (unlike login's `loginSchema.ts`). |
| [lib/types/api.ts](../../../../lib/types/api.ts) | `ChangePasswordRequestRec { current_password; new_password; confirm_password }` (snake_case wire type). |

---

## Shared primitives consumed

| File | Role |
|---|---|
| [components/ui/dialog.tsx](../../../../components/ui/dialog.tsx) | shadcn `<Dialog>` / `<DialogContent>` / `<DialogTitle>` primitive (`stackLevel`, `closeOnOutsideClick`, default X). |
| [components/shared/modal-form/ModalField.tsx](../../../../components/shared/modal-form/ModalField.tsx) | Shared feature-dialog field row (label + required `*`). |
| [components/shared/modal-form/ModalInput.tsx](../../../../components/shared/modal-form/ModalInput.tsx) | Shared feature-dialog text input (`h-8`, brand focus ring; `forwardRef` so RHF `register` reaches the native input). |
| [components/shared/dialog](../../../../components/shared/dialog/) | `useDialog()` — the shared system dialog for validation / success / error messages. |
| [lib/i18n/LocaleProvider.tsx](../../../../lib/i18n/LocaleProvider.tsx) | `useTranslation()` → `t(...)`. |
| [lib/utils.ts](../../../../lib/utils.ts) | `cn(...)` class composition (Save button state classes). |

---

## i18n

`locales/{en,ko,vi}.json` — namespace `change_password.*` (13 keys: `title`, `current_label`,
`new_label`, `confirm_label`, `current_placeholder`, `new_placeholder`, `confirm_placeholder`,
`current_required`, `new_required`, `confirm_required`, `mismatch`, `success`, `saving`) plus the shared
`dialog.*` keys, the `login.password_max` reuse, and the `profile.change_password` trigger label. Full
key list: [ui-specification.md § i18n keys](ui-specification.md#i18n-keys-namespace-change_password--shared-dialog).

---

## Not used

- **No route** — feature dialog only (no `/settings/security` page; long-term route is a future
  `wecms-web/CLAUDE.md` "Notes for future implementation" item).
- **No mapper** — the request is a 3-field write, translated inline in `changePassword(...)`; no list
  shape to map back.
- **No View Setting / no export** — there is no table or list surface.
- **No automated tests** — see [test-scenarios.md](test-scenarios.md) ("Automated test coverage").

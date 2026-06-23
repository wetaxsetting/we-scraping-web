# Change Password — UI Specification (Frontend)

The implemented Change Password feature dialog. It is a **feature dialog** (shadcn `<Dialog>`
primitive), NOT a `useDialog()` system dialog — the form chrome is the primitive; only the
validation / success / error *messages* route through the shared system dialog. Backend reference:
[wecms-api/docs/features/auth/change-password/functional-specification.md](../../../../../wecms-api/docs/features/auth/change-password/functional-specification.md).

Component: [`<ChangePasswordDialog>`](../../../../components/layout/ChangePasswordDialog.tsx).

---

## Dialog shell

```
<Dialog open onOpenChange>
  <DialogContent className="max-w-[400px] rounded-2xl p-0" closeOnOutsideClick={false}>
    <div className="flex w-full flex-col gap-6 px-4 py-6">   {/* inner column */}
      [ Title    — DialogTitle asChild → <h2> ]
      [ Form     — three PasswordField rows ]
      [ Footer   — Cancel + Save, justify-end ]
    </div>
  </DialogContent>
</Dialog>
```

- **Category — feature dialog, not system dialog.** The 500 px `useDialog()` system-dialog cap does
  NOT apply; this dialog uses its own Figma `max-w-[400px]` cap per `wecms-web/CLAUDE.md` §3a / §"Dialogs
  & modals". It mirrors the compact **New Firm Banking** popup reference so every compact modal form
  reads as one product.
- **Width / radius:** `max-w-[400px]` `rounded-2xl` `p-0`. The inner column owns the padding
  (`px-4 py-6`) and the vertical rhythm (`gap-6` between title / form / footer).
- **Stack level:** default `1` — it is a standalone dialog opened from the header ProfileMenu, not a
  child of the Settings modal. Default close X is rendered by `<DialogContent>`.
- **Close contract:** `closeOnOutsideClick={false}` (a backdrop click must not discard a typed
  password); ESC enabled (primitive default); Cancel + X both call `onOpenChange(false)`.
- **Title:** `DialogTitle asChild` wrapping `<h2 className="text-wb-16 font-semibold leading-[18px]
  text-wb-dark">` → `change_password.title` ("Change Password"). The `text-wb-16` compact-dialog title
  is the §3b sanctioned override for this compact frame (default `<DialogTitle>` is `text-wb-18`).

---

## Field layout

Three rows in a `<form id="change-password-form" noValidate className="flex flex-col gap-4">`, each
rendered by the local `PasswordField` helper which composes the shared
[`<ModalField>`](../../../../components/shared/modal-form/ModalField.tsx) +
[`<ModalInput>`](../../../../components/shared/modal-form/ModalInput.tsx) primitives:

| Field | `id` | Label key | Placeholder key | `autoComplete` |
|---|---|---|---|---|
| Current Password | `currentPassword` | `change_password.current_label` | `change_password.current_placeholder` | `current-password` |
| New Password | `newPassword` | `change_password.new_label` | `change_password.new_placeholder` | `new-password` |
| Confirm Password | `confirmPassword` | `change_password.confirm_label` | `change_password.confirm_placeholder` | `new-password` |

- Each control is `type="password"` and spreads `{...register(field)}` (React Hook Form).
- `ModalField` renders the Figma label rhythm (`text-wb-14 / 500 text-wb-ntrl-8`) with a required red
  `*` (default `required=true`).
- `ModalInput` is the shared input chrome — `h-8`, `text-wb-14 / 500`, `rounded-md`, `shadow-wb-outline`,
  brand focus ring (`focus:shadow-[0px_0px_0px_1px_var(--color-brand)]`), `placeholder:text-wb-ntrl-5`.
- On a failed submit, the field's `aria-invalid` is set from `errors.<field>` (the inline control does
  not render its own message text — the message surfaces in the system error dialog).

---

## Button system (footer)

`<div className="flex items-center justify-end gap-2">` — secondary on the LEFT, primary on the RIGHT,
per the §3b Settings button standard (applies here as the canonical compact-dialog footer):

| Button | Role | Classes | Behaviour |
|---|---|---|---|
| **Cancel** | secondary | `h-8 px-3 text-wb-14-tight font-medium bg-white text-wb-ink shadow-wb-btn hover:bg-black/[0.03]` | `type="button"` → `onOpenChange(false)` |
| **Save** | primary | `h-8 px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn bg-brand hover:bg-brand-hover` | `type="submit" form="change-password-form"` |

- Both are 32 px (`h-8`) per the no-`p-2`-line-height-height antipattern rule.
- **Submitting state:** Save is `disabled` + `aria-busy`, swaps to `cursor-wait bg-brand opacity-60`,
  shows a `Loader2` `size-4 animate-spin` glyph, and the label flips `dialog.save` → `change_password.saving`.

---

## System dialog variants (validation / result)

All three result surfaces go through the shared `useDialog()` per `wecms-web/CLAUDE.md` §"Dialog variant"
— never Warning chrome for validation/API failures, and titles always use the shared `dialog.*` keys
(never the module name):

| Outcome | `type` | Title key | Description | Extra |
|---|---|---|---|---|
| Client (Zod) validation failure | `"error"` | `dialog.error` | first error in `FIELD_ORDER`, via `t(key)` | `onClose` → `setFocus(field)` |
| Backend business error | `"error"` | `dialog.error` | backend `status.message` (or `dialog.unexpected_error`) | `errorCode` = `status.code`; `uuid` = `trace_id` |
| Success | `"success"` | `dialog.success` | `change_password.success` | `onConfirm` + `onClose` → `onOpenChange(false)` |

The system dialog renders at `z-[100]` (above the feature dialog) so a success/error message opened
from inside the open `<ChangePasswordDialog>` sits on top of it.

---

## Typography & token compliance

- Title `text-wb-16 font-semibold` (compact-dialog override); labels `text-wb-14 / 500`; inputs
  `text-wb-14 / 500`; buttons `text-wb-14-tight font-medium`. No `text-[Npx]` / `font-[N]` / inline
  font styles — all via WB365 tokens.
- The one pixel-literal in the file is `leading-[18px]` on the title `<h2>` and `max-w-[400px]` on the
  shell — both are the §3b/§3a sanctioned compact-dialog exceptions (Figma 14/18 title rhythm + the
  Figma 400 px cap), consistent with the New Firm Banking reference.

---

## i18n keys (namespace `change_password.*` + shared `dialog.*`)

`title` · `current_label` · `new_label` · `confirm_label` · `current_placeholder` · `new_placeholder` ·
`confirm_placeholder` · `current_required` · `new_required` · `confirm_required` · `mismatch` ·
`success` · `saving`. Plus the shared `dialog.error` · `dialog.success` · `dialog.cancel` · `dialog.save`
· `dialog.unexpected_error`, the `login.password_max` reuse (≤ 100 message), and the trigger label
`profile.change_password`. **All 13 `change_password.*` keys are present in `locales/{en,ko,vi}.json`**
(verified: 13 in en / 13 in ko / 13 in vi). KM (Khmer) is not yet supported by `wecms-web`.

# Dialog & Popup — Component Index

**Part of:** Common → dialog-popup
**Last verified:** 2026-06-23

All paths relative to `wecms-web/`.

## System dialog primitives — `components/shared/dialog/`

| Symbol | File | Role |
|---|---|---|
| `useDialog()` | [`DialogProvider.tsx`](../../../../components/shared/dialog/DialogProvider.tsx) | Hook returning `DialogApi { open, close }`; throws if used outside `<DialogProvider>` (`:30-36`) |
| `<DialogProvider>` | [`DialogProvider.tsx`](../../../../components/shared/dialog/DialogProvider.tsx) | Context provider; holds the single `DialogOptions \| null` state; mounted **once** in app layout; renders at most one `<SystemDialog>` (`:38-63`) |
| `<SystemDialog>` | [`SystemDialog.tsx`](../../../../components/shared/dialog/SystemDialog.tsx) | Portal-rendered modal (`createPortal` → `document.body`, `z-[100]`); 4 variants; focus trap + body scroll lock + ESC gating via `modalStack` |
| `<DialogIcon>` | [`DialogIcon.tsx`](../../../../components/shared/dialog/DialogIcon.tsx) | 38×38 inline SVG glyph per type; colours `warning #F5A524` / `error #D64545` / `success #0060B9` / `confirmation #22A88B` (`:14-19`) |
| `DialogType` | [`types.ts`](../../../../components/shared/dialog/types.ts) | `"warning" \| "error" \| "success" \| "confirmation"` (`:3`) |
| `DialogOptions` | [`types.ts`](../../../../components/shared/dialog/types.ts) | `open()` argument — `type` + optional `title`/`description`/`errorCode`/`uuid`/`confirmText`/`cancelText`/`dismissible`/`destructive`/`onClose`/`onConfirm`/`onCancel` (`:17-38`) |
| `DialogApi` | [`types.ts`](../../../../components/shared/dialog/types.ts) | `{ open(options), close() }` (`:41-44`) |
| barrel | [`index.ts`](../../../../components/shared/dialog/index.ts) | re-exports `DialogProvider`, `useDialog`, `SystemDialog`, `DialogApi`, `DialogOptions`, `DialogType` |

**Usage:**

```tsx
const dialog = useDialog();
dialog.open({ type: "error", title: t("dialog.error"), description: "...", errorCode: "WBE1009" });
dialog.open({
  type: "confirmation",
  description: t("logout.confirm_description"),
  confirmText: t("dialog.continue"),
  cancelText: t("dialog.cancel"),
  onConfirm: () => signOut(),
});
```

## Stacked feature-dialog primitive — `components/ui/dialog.tsx`

| Symbol | Role |
|---|---|
| `<DialogContent stackLevel={1..5}>` | Radix-backed content panel; resolves overlay/content z + backdrop bg + default outside-click from the level (`:153-282`) |
| `DialogStackLevel` | `keyof typeof STACK_Z_OVERLAY` (1–5) (`:136`) |
| `STACK_Z_OVERLAY` / `STACK_Z_CONTENT` / `STACK_OVERLAY_BG` | the z-index / backdrop ladder tables (`:109-134`) |
| props: `closeOnOutsideClick` / `closeOnEscape` / `hideClose` / `overlayClassName` | per-call overrides of the level defaults (`:157-188`) |
| `<Dialog>` `<DialogOverlay>` `<DialogHeader>` `<DialogBody>` `<DialogFooter>` `<DialogTitle>` `<DialogDescription>` | shell + rhythm parts; only `max-w-*` varies per feature |

`<DialogContent>` registers itself in the shared modal stack on mount and pops on unmount
(`useEffect`, `:218-226`); ESC is gated by `modalStack.isTop(...)` (`:251-267`).

## ESC stack — `lib/modalStack.ts`

| Symbol | Role |
|---|---|
| `modalStack.push()` | register an open modal, returns its stack id (`:27-31`) |
| `modalStack.pop(id)` | remove on unmount/close (`:33-36`) |
| `modalStack.isTop(id)` | whether this modal is top-most — every ESC handler checks this before dismissing (`:38-40`) |

Module-level singleton (one stack per window) shared by `<SystemDialog>`, every `<DialogContent>`,
and `<SettingsModal>` so a single ESC keypress closes only the top-most layer (`:1-21`).

## Representative feature dialogs — `components/shared/popups/`

These consume `<DialogContent stackLevel>` and demonstrate the stacked usage. They are documented in
their own feature docs (Settings / login-credentials flows); listed here only as `dialog-popup`
consumers.

| Component | File | Default `stackLevel` |
|---|---|---|
| `<SelectBankDialog>` | [`SelectBankDialog.tsx`](../../../../components/shared/popups/SelectBankDialog.tsx) | `3` (`:35-40`) — `2` when opened directly from a Settings panel |
| `<PasswordConfirmationDialog>` | [`PasswordConfirmationDialog.tsx`](../../../../components/shared/popups/PasswordConfirmationDialog.tsx) | `3` (`:41-45`) — `5` for the global `<SessionExpiredDialog>` |
| `<RegisteredLoginCredentialsDialog>` | [`RegisteredLoginCredentialsDialog.tsx`](../../../../components/shared/popups/RegisteredLoginCredentialsDialog.tsx) | `2` (first child opened inside Settings) |
| `<LoginIdPasswordDialog>` / `<EditLoginIdPasswordDialog>` | `LoginIdPasswordDialog.tsx` / `EditLoginIdPasswordDialog.tsx` | `4` (sibling in the canonical chain) |
| `<SelectBankAccountsDialog>` | `SelectBankAccountsDialog.tsx` | `5` (deepest in the canonical chain) |
| `<SelectLoginInstitutionDialog>`, `<GdtCredentialsDialog>`, `<AuditLogsDialog>`, `<RevealPasswordConfirmDialog>` | `components/shared/popups/` | per their flow position |

> Full directory: `components/shared/popups/*Dialog.tsx` (10 files as of 2026-06-23).

## Where the rules live

`wecms-web/CLAUDE.md` — §"Dialogs & modals", §"Dialog variant — choose the right `type`",
§"Dialog buttons — project-wide colour rule", §"Modal stacking convention",
§"Modal stack — interaction & close behaviour".

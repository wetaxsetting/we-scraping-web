# Settings > Login Credentials — Frontend Feature (Refactor)

**Status:** ✅ Wired full-stack — the panel consumes the live `/api/v1/login-credentials` API; bank +
GDT credential CRUD, password Reveal, and Audit Logs all call live endpoints (verified 2026-06-02,
**no mock fallback**). Atomic credential-plus-accounts Save + account registration landed 2026-06-17.
**Menu:** Settings → **Login Credentials** (Settings modal panel — **no standalone route**)
**Slug:** `login-credentials` (matches the JEX-traceability + backend counterparts)
**Panel key:** `login-credentials` · **Menu permission:** `settings-core-login-credentials`
**Backend base path:** **`/api/v1/login-credentials`** (NOT `/settings/...`)

> This folder is the **primary frontend documentation home** for Login Credentials. It consolidates
> and indexes the material previously in the single-file [../login-credentials.md](../login-credentials.md)
> (preserved, cross-linked). The matching backend docs are at
> [wecms-api/docs/features/settings/login-credentials/](../../../../../wecms-api/docs/features/settings/login-credentials/README.md).

---

## What this screen is

The per-tenant master list of **bank login credentials** (and a single **GDT** tax-portal credential)
the firm-banking gateway uses to scrape balances/transactions on the user's behalf. It is the only
Settings panel that drives a live external system (Coocon/NXiSAS) through a multi-step
**verify-before-save** flow. Rendered as a **panel inside `<SettingsModal>`** (mounted via
`<SettingsNav>`) — there is no `/settings/login-credentials` URL.

A tenant administrator can:

- **List** credentials grouped by institution (one bank row per `BANK_CD` with its logins + linked
  accounts; one GDT row when configured).
- **Add a bank credential** through the Figma dialog chain: pick institution → pick bank → enter login
  id / password → server-side Coocon **verify** (no credential created during the scrape) → OTP / Q&A
  / CAPTCHA challenge follow-ups → pick accounts → **atomic Save** (writes credential + accounts in one
  backend transaction).
- **Add a GDT credential** through the GDT dialog (server-side verify-before-save, flag-gated on the
  backend).
- **Edit** a registered credential's password (re-verifies against the bank, then PUT with an
  `old_password` guard).
- **Reveal** a stored password — confirmation dialog re-auths against the credential's own password,
  then the server returns the decrypted value.
- **Delete / Disconnect** a credential (audit-logged on the backend; accounts are not cascade-deleted).
- **Audit Logs** per row — live history, latest-first.

View Setting (column-visibility popover) is **not adopted** — the panel has no toolbar list-icon
button (same precedent as `erp-transaction-history`, `approval-line`, `chart-of-accounts`); the slug
is reserved in `lib/viewSettingScreens.ts` for log/audit consistency only.

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Open → fetch list → grid → Add chain (institution → bank → id/pw → verify → challenge → accounts → save) → Registered/Edit chain → Reveal → Delete → Audit Logs; modal stack levels |
| [ui-specification.md](ui-specification.md) | Panel layout, grid columns, the two popup chains + every dialog, loading/empty/error states, dialog-variant + button rules, i18n keys |
| [component-index.md](component-index.md) | Component / hook / API-client / type / popup file map |
| [api-consumption.md](api-consumption.md) | Endpoints consumed, request/response wire shapes, mappers, error-code → dialog mapping |
| [test-scenarios.md](test-scenarios.md) | SIT/UAT scenarios (list, add bank, add GDT, edit, delete, reveal, audit-logs, challenge) |

---

## Quick facts

| Aspect | Value |
|---|---|
| Panel | [`<LoginCredentialsPanel>`](../../../../components/settings/login-credentials/LoginCredentialsPanel.tsx) |
| Mount | [`SettingsModal.tsx`](../../../../components/settings/SettingsModal.tsx) + [`SettingsNav.tsx`](../../../../components/settings/SettingsNav.tsx) |
| Data hook | `useApiData(fetchLoginCredentials, [refreshTick])` (lightweight project hook — no React Query) |
| API client | [lib/api/loginCredentials.ts](../../../../lib/api/loginCredentials.ts) |
| Grid columns | Institution / bank · Login ID · Bank Account (+N) · Modified · (actions: kebab → Edit / Reveal / Delete / Audit Logs) |
| Add chain | `SelectLoginInstitutionDialog` → (bank: `SelectBankDialog` → `LoginIdPasswordDialog` → challenge → `SelectBankAccountsDialog`) / (gdt: `GdtCredentialsDialog`) |
| Registered chain | `RegisteredLoginCredentialsDialog` → `LoginIdPasswordDialog` / `EditLoginIdPasswordDialog` / `SelectBankAccountsDialog` / `RevealPasswordConfirmDialog` |
| Modal stack | Settings shell L1 · Registered / Audit Logs / GDT / Select-Institution L2 · Login-ID-PW / Select-Bank / Select-Bank-Accounts / Edit L3 · challenge / reveal-confirm L4; `useDialog()` feedback at `z-[100]` |
| Verify-before-save | Coocon scrape via `POST /api/v1/banking/scraping/verify` (+ `/{sessionId}/otp`) — **no credential created during the scrape** |
| Wire convention | lowercase snake_case → camelCase mapping at the API boundary |
| View Setting | **not adopted** |

---

## Related docs

- **Backend feature folder:** [wecms-api/docs/features/settings/login-credentials/](../../../../../wecms-api/docs/features/settings/login-credentials/README.md)
- **Preserved single-file spec (frontend):** [../login-credentials.md](../login-credentials.md)
- **Backend flat spec (deep narrative + OQ log):** [wecms-api/docs/features/settings/login-credentials.md](../../../../../wecms-api/docs/features/settings/login-credentials.md)
- **Settings feature index:** [../README.md](../README.md)
- **Source audit:** `docs/audits/login-credentials-legacy-vs-refactor-audit.md` _(workspace root; backend-owned)_

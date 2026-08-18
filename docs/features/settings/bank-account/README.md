# Settings > Bank Account — Frontend Feature (Refactor)

**Status:** ✅ Wired full-stack — the panel consumes the live `bank-account` API: list + sort via
`useApiData(fetchBankAccounts)`, Edit dialog → `PATCH`, View/Withdrawal Permission dialogs → `GET`/`PUT`,
Audit Logs popup → `GET …/audit-logs`. No mock fallback on the primary list read. Legacy `comm_0183_*`
parity verified against source 2026-06-23.
**Menu:** Settings → **Bank Account** (Settings modal panel — **no standalone route**)
**Slug:** `bank-account` (matches the JEX-traceability + backend counterparts)
**Panel key:** `bank-account` · **Menu permission:** `settings-core-bank-account`
**Backend:** `/api/v1/settings/bank-account` (list · update · register · permissions GET/PUT · audit-logs GET)

> This folder is the **primary frontend documentation home** for Bank Account. It consolidates and
> indexes the single-file [../bank-account.md](../bank-account.md) (preserved, cross-linked). The matching
> backend docs are at
> [wecms-api/docs/features/settings/bank-account/](../../../../../wecms-api/docs/features/settings/bank-account/README.md).

> **Status note vs. `wecms-web/CLAUDE.md` §3a:** the CLAUDE.md Settings-panel table still lists Bank
> Account as "Static UI · ViewSetting popover (static defaults)". **That is stale** — the panel is
> wired to live endpoints (`lib/api/bankAccount.ts`), the View Setting popover uses the live
> `useViewSetting(SCREEN_IDS.SETTINGS_BANK_ACCOUNT)` hook, and every dialog Save calls a real endpoint
> and bumps `refreshKey`. This folder reflects the wired reality.

---

## What this screen is

The per-tenant master list of registered **bank accounts**, rendered as a table inside the Settings
modal. The admin can sort, edit one account's maintenance fields (nickname, description, account type,
maturity, VAS mapping), manage per-user **View / Withdrawal permissions**, read a per-account **audit
log**, and **register** accounts pulled from a Coocon scrape (the Login Credentials Add-chain).

It renders as a **panel inside `<SettingsModal>`** (mounted via `<SettingsNav>`) — there is **no**
`/settings/bank-account` URL. View Setting (column visibility popover) **is** adopted
(`SCREEN_IDS.SETTINGS_BANK_ACCOUNT = "bank-account"`).

There is **no create-from-scratch**, **no delete/de-register**, and **no data export** on this screen
(see [test-scenarios.md](test-scenarios.md) for the explicit non-existent-ops list).

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Open → fetch list → table → sort → edit dialog → permission dialog (View/Withdrawal) → audit-logs popup → register Add-chain |
| [ui-specification.md](ui-specification.md) | Header/actions, table columns, edit dialog + VAS picker, permission dialog, audit-logs popup, View Setting popover, loading/empty/error states, i18n keys |
| [component-index.md](component-index.md) | Component / hook / API-client / type / i18n file map |
| [api-consumption.md](api-consumption.md) | Endpoints, request/response wire shapes, mappers, error-code → dialog mapping |
| [test-scenarios.md](test-scenarios.md) | SIT/UAT scenarios (list, edit, permissions, audit-logs, register) + which ops do NOT exist |

---

## Quick facts

| Aspect | Value |
|---|---|
| Panel | [`<BankAccountPanel>`](../../../../components/settings/bank-account/BankAccountPanel.tsx) |
| Mount | [`SettingsModal.tsx`](../../../../components/settings/SettingsModal.tsx) (`panel === "bank-account"`) + [`SettingsNav.tsx`](../../../../components/settings/SettingsNav.tsx) |
| Data hook | `useApiData(() => fetchBankAccounts(sort.sortParams), [sortField, sortDirection, refreshKey])` (project's lightweight hook — **no** React Query) |
| API client | [lib/api/bankAccount.ts](../../../../lib/api/bankAccount.ts) |
| Table columns | Bank (logo + name) · Account No · Currency · Nickname · Description · Account Type · Maturity · VAS Code · VAS Account Name · Balance / Available · View Permission · Withdrawal Permission · Audit Logs |
| Edit dialog | [`<EditBankAccountDialog>`](../../../../components/settings/bank-account/EditBankAccountDialog.tsx) — nickname, description, account type, maturity, VAS mapping → `PATCH` |
| Permission dialog | [`<PermissionDialog>`](../../../../components/settings/bank-account/PermissionDialog.tsx) — View / Withdrawal roster → `GET`/`PUT` (Figma 166:24840 / 166:25059) |
| Audit-logs popup | shared audit-log dialog → `GET …/audit-logs` |
| Withdrawal gate | [`withdrawalPolicy.ts`](../../../../components/settings/bank-account/withdrawalPolicy.ts) — 5-bank whitelist mirrors backend `WithdrawalBankPolicy` (disables the Withdrawal control on other banks) |
| View Setting | **adopted** — `useViewSetting(SCREEN_IDS.SETTINGS_BANK_ACCOUNT)` + shared `<ViewSettingPopover>` |
| Wire convention | lowercase snake_case → camelCase mapping at the API boundary (`lib/api/mappers.ts`) |

---

## Open items and deliberate non-gaps

*Migrated here 2026-08-17 from the superseded flat summary, which was the only place carrying them.*

| Item | State |
|---|---|
| **Audit Logs dialog body** | Renders **mock rows** — there is no backend audit-read endpoint for this panel yet. The dialog chrome is real; the contents are not. |
| **VAS-name composite column** | Echoes the VAS name; the full `BANK_NM(CCY)` form lands when the backend ships it. |
| **`BankBrandLogo`** | Brand-coloured placeholder until the real PNG asset exists. Cosmetic. |
| **`AUTH_TYPE = 'F'`** | ❓ **Needs confirmation.** A third auth type exists in the DDL; the Permission dialog currently handles View (`V`) and Withdrawal (`W`) only. Confirm whether the UI should expose it. |
| **Maturity datepicker disabled for current accounts** (`ACCT_TYPE` 03/04) | ✅ **Intentional — JEX parity, not a gap.** Do not "fix" it. |

---

## Related docs

- **Backend feature folder:** [wecms-api/docs/features/settings/bank-account/](../../../../../wecms-api/docs/features/settings/bank-account/README.md)
- **Preserved single-file spec (frontend):** [../bank-account.md](../bank-account.md)
- **Settings feature index:** [../README.md](../README.md)

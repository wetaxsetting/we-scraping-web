# Settings > Firm Banking Settings — Frontend Feature (Refactor)

**Status:** ✅ Wired full-stack — the panel consumes the live `firm-banking-settings` API for list /
detail / create / update / delete + per-row audit log; the two Automation toggles route through the
separate Environment Settings hook. Mock fallback retained for offline dev.
**Menu:** Settings → Firm Banking → **Firm Banking Settings** (Settings modal panel — **no standalone route**)
**Slug:** `firm-banking-settings` (matches the JEX-traceability + backend counterparts)
**Panel:** [`<FirmBankingSettingsPanel>`](../../../../components/settings/firm-banking-settings/FirmBankingSettingsPanel.tsx) · **Menu permission:** `settings-firm-banking-settings`
**Backend:** `/api/v1/settings/firm-banking-settings` (list · detail · `/audit` · create · update · delete)

> This folder is the **primary frontend documentation home** for Firm Banking Settings. It consolidates
> and indexes the small single-file [../firm-banking-settings.md](../firm-banking-settings.md)
> (preserved, cross-linked). The matching backend docs are at
> [wecms-api/docs/features/settings/firm-banking-settings/](../../../../../wecms-api/docs/features/settings/firm-banking-settings/README.md).

---

## What this screen is

A Settings-modal panel that configures a tenant's **firm-banking channel bindings** — which withdrawal
account is bound to which bank channel, under which partner id / VAN code, with what status. The panel
renders two sections:

1. **Automation Settings** — two immediate-save toggles (Auto Match `00079`, Auto Transfer `00078`)
   that drive tenant-level environment flags. These belong to the **Environment Settings** feature
   (`BUSI_ENV_SET_INFM`), not to firm-banking config — they route through `useEnvironmentSettings`.
2. **Linked Accounts** — the live list of firm-banking bindings, each with a bank logo, masked account
   number + currency, status, last-updated line, and a kebab row menu (Edit / Delete). Clicking a row
   opens the Firm Banking Details dialog (with the per-row audit log).

It mounts as a **panel inside `<SettingsModal>`** (via `<SettingsNav>`, Firm Banking group) — there is
**no** `/settings/firm-banking-settings` URL. View Setting (column-visibility popover) is **not** adopted.

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Open → fetch list + env → render → row click (details + audit) → add / edit (dialogs) → delete (confirm) → automation toggle |
| [ui-specification.md](ui-specification.md) | Header, Automation toggles, Linked Accounts list, Add/Edit/Details dialogs, row menu, states, i18n keys |
| [component-index.md](component-index.md) | Component / hook / API-client / type / mapper / i18n file map |
| [api-consumption.md](api-consumption.md) | Endpoints, request/response wire shapes, mappers, error-code → dialog mapping, masking |
| [test-scenarios.md](test-scenarios.md) | SIT/UAT scenarios (list, details+audit, create, edit, delete, automation, authz, errors) |

---

## Quick facts

| Aspect | Value |
|---|---|
| Panel | [`<FirmBankingSettingsPanel>`](../../../../components/settings/firm-banking-settings/FirmBankingSettingsPanel.tsx) |
| Mount | [`SettingsModal.tsx`](../../../../components/settings/SettingsModal.tsx) + [`SettingsNav.tsx`](../../../../components/settings/SettingsNav.tsx) (Firm Banking group) |
| Data hook | `useApiData(fetchFirmBankingSettings, [refetchToken])` (list) + `useEnvironmentSettings(AUTOMATION_CODES)` (toggles) |
| API client | [lib/api/firmBankingSettings.ts](../../../../lib/api/firmBankingSettings.ts) |
| List columns | Bank (logo + name) · Withdrawal account (**masked** + currency) · Status · Last updated · (kebab) |
| Dialogs | Add ([`NewFirmBankingDialog`](../../../../components/settings/firm-banking-settings/NewFirmBankingDialog.tsx)) · Details + audit ([`FirmBankingDetailsDialog`](../../../../components/settings/firm-banking-settings/FirmBankingDetailsDialog.tsx)) · Edit ([`EditFirmBankingDetailsDialog`](../../../../components/settings/firm-banking-settings/EditFirmBankingDetailsDialog.tsx)) · row menu ([`FirmBankingRowMenu`](../../../../components/settings/firm-banking-settings/FirmBankingRowMenu.tsx)) |
| Delete | kebab → destructive confirmation → live `DELETE` → refetch; `WBE2020` → error dialog; per-row in-flight guard |
| View Setting | **not adopted** |
| Excel / export | **none** |
| Wire convention | lowercase snake_case → camelCase mapping at the API boundary (`lib/api/mappers.ts`) |

---

## Open item

*Migrated here 2026-08-17 from the superseded flat summary, which was the only place carrying it.*

- **Create follows OQ-8a Option (c)** — a provisional / bounded-bank set. Mr. Jung (PO) may override
  this; treat the current bank set as provisional until he confirms.

## Related docs

- **Backend feature folder:** [wecms-api/docs/features/settings/firm-banking-settings/](../../../../../wecms-api/docs/features/settings/firm-banking-settings/README.md)
- **Preserved single-file spec (frontend):** [../firm-banking-settings.md](../firm-banking-settings.md)
- **Sibling panel:** [../firm-banking-history/](../firm-banking-history/README.md) (read-only dispatch log)
- **Environment Settings** (owns the Automation toggles): the `useEnvironmentSettings` hook + `lib/api/environmentSettings.ts`
- **Settings feature index:** [../README.md](../README.md)

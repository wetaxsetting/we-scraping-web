# Firm Banking Settings — Screen Flow (Frontend)

Interaction flow for the Firm Banking Settings panel. Backend flow:
[wecms-api/docs/features/settings/firm-banking-settings/business-flow.md](../../../../../wecms-api/docs/features/settings/firm-banking-settings/business-flow.md).

```
Top nav → Settings → <SettingsModal> opens → SettingsNav → "Firm Banking Settings"
      │   (visible only when the session has the settings-firm-banking-settings grant or is admin)
      ▼
<FirmBankingSettingsPanel> mounts
      │  env  = useEnvironmentSettings(["00079","00078"])         → Automation toggles
      │  list = useApiData(fetchFirmBankingSettings, [refetchToken])
      ▼
GET /api/v1/settings/firm-banking-settings
      │  map ApiFirmBankingSettingRow[] → FirmBankingLinkedAccount[]  (mask wdrl_act_no, resolve bank brand/name)
      ▼
Panel renders: Automation Settings (2 toggles) + Linked Accounts list (kebab per row)
```

---

## States

| State | Trigger | UI |
|---|---|---|
| **List (idle)** | panel mount, GET resolves | linked-accounts list (bank logo · masked account+currency · status · last updated · kebab) |
| **Loading (list)** | list GET in flight | `settings.firm_banking_settings.list.loading` notice (sticky-smoothed) |
| **Loading (env)** | env GET in flight | `settings.firm_banking_settings.automation.loading` notice |
| **Empty** | GET resolves with no rows | `settings.firm_banking_settings.list.empty` |
| **List error** | list GET fails | error dialog via `useDialog()` (de-duped by code) + `…list.load_failed` notice |
| **Env error** | env GET fails | `…automation.load_failed` notice |
| **Row click → Details** | click a linked-account row | `<FirmBankingDetailsDialog>` opens (stackLevel 2); fetches detail (cleartext PK) + audit by PK |
| **Add** | click "+ Add" | `<NewFirmBankingDialog>` (pick bank → withdrawal-account autocomplete → 5 fields → Save → POST → refetch) |
| **Edit** | kebab → Edit (row or details modal) | `<EditFirmBankingDetailsDialog>` (PUT editable fields → refetch); stackLevel 2 (or 3 over Details) |
| **Delete** | kebab → Delete | destructive confirmation → live `DELETE` → success dialog + refetch; `WBE2020` → error dialog |
| **Delete (in flight)** | confirm Delete | per-row `deletingAccountIds` guard blocks a duplicate kebab Delete until the refetch lands |
| **Automation toggle** | click a toggle | optimistic flip via `env.setEnabled(envCd, next)`; revert + error dialog on backend rejection |

---

## Refresh model

- The list re-fetches whenever `refetchToken` bumps — bumped after a successful Create, Update, or Delete.
- `useApiData` re-fires its loader when a `deps` entry changes; the panel passes `[refetchToken]`.
- Dialogs do not optimistically mutate the list — they call the live endpoint and bump `refetchToken`.
- Automation toggles use optimistic update inside `useEnvironmentSettings` (immediate flip; revert on error).

---

## Modal stacking

- Settings modal = **L1**. The Details / Add / Edit dialogs open at **stackLevel 2**.
- When **Edit opens from inside Details**, Edit stacks at **L3** (Details stays mounted underneath); when
  Edit opens from a row kebab (no Details), it stays at **L2**.
- The destructive **Delete confirmation** is a `useDialog()` system dialog at `z-[100]` — above every
  feature stack level — so it covers the chain without collapsing it. On success the confirmation closes
  Details/Edit and refetches; on Cancel the user returns to the still-open Details modal.
- The kebab **row menu** (`<FirmBankingRowMenu>`) portals to `document.body` at `z-[95]` (above L5 dialogs,
  below the system dialog) and dismisses on ESC / outside-click — only itself, never the underlying chain.

---

## Authorization & visibility

The Firm Banking Settings entry appears in `<SettingsNav>` only when the session is admin or the granted
menu codes include `settings-firm-banking-settings`. The backend independently enforces
`@menuAuthz.canAccess('settings-firm-banking-settings')` on every endpoint — the frontend gate is UX, the
backend gate is the security boundary.

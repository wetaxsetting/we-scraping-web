# Firm Banking Settings — UI Specification (Frontend)

The implemented Firm Banking Settings panel UI. Follows the Settings shell + panel-composition contract
and the Settings UI consistency rules in `wecms-web/CLAUDE.md` §3a / §3b. Backend behaviour:
[wecms-api/docs/features/settings/firm-banking-settings/functional-specification.md](../../../../../wecms-api/docs/features/settings/firm-banking-settings/functional-specification.md).

---

## Panel layout

[`<FirmBankingSettingsPanel>`](../../../../components/settings/firm-banking-settings/FirmBankingSettingsPanel.tsx)
— Figma 134:17061. Composition (top → bottom, inside the modal's right column):

- **Header** (`shrink-0`, `px-8 pt-14 pb-5`): title `settings.firm_banking_settings.title` +
  description `…description` (left); brand "+ Add" button (right, `bg-brand` pill). The `pt-14` drops the
  title below the shell's Esc/X group.
- **Scroll region** (`custom-scrollbar`, `min-h-0 flex-1`): Automation Settings + Linked Accounts stack
  and scroll together. The "+ Add" button stays in the header, outside the scroll region.

There is no search box, no filter row, and no pagination on this panel.

## Automation Settings

[`<FirmBankingAutomationSettings>`](../../../../components/settings/firm-banking-settings/FirmBankingAutomationSettings.tsx)
— two immediate-save toggles. **These are Environment Settings, not firm-banking config** — they write
`BUSI_ENV_SET_INFM` env codes via `useEnvironmentSettings`, not `TB_FIRM_CONF`.

| Toggle | `envCd` | Label key |
|---|---|---|
| Match payment after history | `00079` (Auto Match) | `settings.firm_banking_settings.automation.match_payment_after_history` |
| Transfer after full approval | `00078` (Auto Transfer) | `settings.firm_banking_settings.automation.transfer_after_full_approval` |

Toggle = optimistic flip via `env.setEnabled(envCd, next)`; backend rejection reverts + opens an error dialog.

## Linked Accounts list

[`<FirmBankingLinkedAccounts>`](../../../../components/settings/firm-banking-settings/FirmBankingLinkedAccounts.tsx)
→ [`<FirmBankingAccountItem>`](../../../../components/settings/firm-banking-settings/FirmBankingAccountItem.tsx)
per row, with [`<BankLogo>`](../../../../components/settings/firm-banking-settings/BankLogo.tsx).

| Element | Source field (in-memory) | Notes |
|---|---|---|
| Bank logo | `bank` (brand) / `outBankCd` | `<BankLogo>` resolves brand by NAPAS code (Shinhan/VCB/Woori), falls back to initials |
| Bank name | `bankName` | short EN name by NAPAS code, falls back to wire `bank_nm` |
| Withdrawal account | `accountNumber` | **masked** `1009****0384` + ` (VND)`/`(USD)` currency suffix |
| Status | `status` (`active`/`inactive`) | from `org_stat === "1"` |
| Last updated | `lastUpdated` | `mod_dttm` (or `reg_dttm`) + `last_edtr` actor, e.g. `30-10-2024, Krong` |
| (kebab) | — | opens `<FirmBankingRowMenu>` (Edit / Delete) |

Row click → Firm Banking Details dialog.

## Firm Banking Details dialog

[`<FirmBankingDetailsDialog>`](../../../../components/settings/firm-banking-settings/FirmBankingDetailsDialog.tsx)
— Figma 5936:24464, `stackLevel=2`, `max-w-[640px]`.

- Fetches the live **detail** (`fetchFirmBankingSetting` — cleartext `wdrl_act_no` for the edit
  round-trip) and **audit** (`fetchFirmBankingSettingAudit`) by composite PK; falls back to the row's
  display fields while in flight (no blank flash).
- **Details section** — 6 label/value rows: Bank Name (logo), Partner ID, VAN Code, Withdrawal Account,
  Firm Banking Status (green active / red inactive), Last Updated.
- **Audit Logs section** — fixed-header + scrolling-body sibling-table (Date/Time stack · User · Activity
  Details), capped at ~3 rows (192px) then scrolls. Activity Details rendered **verbatim** (server
  pre-localized — never passed through `t(...)`).
- Header kebab reopens `<FirmBankingRowMenu>` (Edit / Delete) anchored to the kebab.
- Footer: outlined **Close** button.

## Add dialog

[`<NewFirmBankingDialog>`](../../../../components/settings/firm-banking-settings/NewFirmBankingDialog.tsx)
— pick bank → **withdrawal-account autocomplete** (loads per bank change, client-side filter, displays
masked + currency-suffixed account) → fill the five required fields → Save → `POST` → on success bumps the
panel's `refetchToken`. `file_type` is **never** entered — server-derived. `org_stat` defaults to `"1"`.

## Edit dialog

[`<EditFirmBankingDetailsDialog>`](../../../../components/settings/firm-banking-settings/EditFirmBankingDetailsDialog.tsx)
— edits the three editable fields (`bank_prtn_id`, `van_org_cd`, `org_stat`); the PK + `file_type` are
fixed. Save → `PUT` → bumps `refetchToken`. Keyed remount on `account.id` so opening row B after row A
starts fresh. Stacks at L3 when opened from inside Details, L2 from a row kebab.

## Row menu

[`<FirmBankingRowMenu>`](../../../../components/settings/firm-banking-settings/FirmBankingRowMenu.tsx)
— Figma 5936:24741. Portal-rendered (`z-[95]`), anchored right-edge to the kebab. Two items: **Edit**
(pencil) and **Delete** (`text-destructive`). Delete routes through the shared destructive confirmation.

## Delete flow

- Kebab → Delete (row menu or details-modal kebab) → `useDialog()` `type:"confirmation"`
  (`…confirm_delete.description`) → Continue → live `deleteFirmBankingSetting(outBankCd, wdrlActNo)`.
- Success → success dialog (`…delete_success`) + refetch; closes any Details/Edit pinned to the row.
- `WBE2020` (or any error) → `type:"error"` dialog with the mapped code.
- Per-row `deletingAccountIds` guard prevents a duplicate delete in flight.

## States

Loading / empty / error per [screen-flow.md](screen-flow.md). Error dialogs use `type:"error"`; delete
prompt uses `type:"confirmation"`; success uses `type:"success"` — per the project dialog-variant rule.

## i18n keys (namespace `settings.firm_banking_settings.*`)

`title` · `description` · `add` · `status.{active,inactive}` ·
`automation.{match_payment_after_history,transfer_after_full_approval,loading,load_failed}` ·
`list.{loading,empty,load_failed}` · `confirm_delete.{description,cancel}` · `delete_success` ·
`row_menu.{edit,delete,aria_edit,aria_delete}` ·
`new_firm_banking.{bank_name,partner_id,van_code,withdrawal_account,...}` ·
`edit_firm_banking_details.firm_banking_status` ·
`firm_banking_details.{title,more_actions,last_updated,audit_logs.title,audit_logs.description,audit_logs.col.{datetime,user,details},audit_logs.{loading,empty}}`
· plus the nav label `settings.nav.firm_banking_settings`. All in `locales/{en,ko,vi}.json`.

| Wire error code | Surfaced as |
|---|---|
| `WBE0001` / `WBE0002` / `WBE2021` | Create error dialog (mapped message + code) |
| `WBE2020` | Detail / Update / Delete error dialog |
| network / other | error dialog (mapped message / `WBE9999`) |

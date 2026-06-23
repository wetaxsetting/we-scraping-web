# Bank Account — Test Scenarios (Frontend)

Manual SIT/UAT scenarios for the Bank Account panel. Backend scenarios:
[wecms-api/docs/features/settings/bank-account/test-scenarios.md](../../../../../wecms-api/docs/features/settings/bank-account/test-scenarios.md).

The feature is **list + edit + permissions + audit-logs + register**. The table at the end lists the
operations that explicitly do NOT exist.

---

## List & sort

| # | Scenario | Expected |
|---|---|---|
| L1 | Open the Bank Account panel | table loads active accounts, default order PRN_SEQ → Bank → Account No |
| L2 | Bank cell | bank logo + bank name render; account number beneath |
| L3 | Click a sortable header (e.g. Nickname) | cycles default → ASC → DESC → default; list refetches in the new order |
| L4 | Click a non-sortable header (View/Withdrawal/Audit) | no sort glyph, no reorder |
| L5 | Permission cell | shows "X + N more" or a placeholder link when no grantee |
| L6 | Backend error on load | error dialog (`type: "error"`); no silent blank table |

## Edit

| # | Scenario | Expected |
|---|---|---|
| E1 | Open Edit on a row | dialog seeds from the row (account type, maturity, nickname, description, VAS) |
| E2 | Change nickname + Save | `PATCH` with only the changed field; success dialog; list refetches |
| E3 | Account type = current | maturity input disabled/cleared |
| E4 | Account type = saving/fixed + set maturity | maturity persists (ISO `yyyy-MM-dd` on the wire) |
| E5 | Pick a VAS account via the picker | seqNo/cd/nm ride together in the PATCH; server FK-validates |
| E6 | Clear the VAS mapping | `vas_acct_seq_no = 0` sent; mapping cleared |
| E7 | Unknown account type / bad date / invalid VAS | error dialog (`WBE_BANK_ACCOUNT_INVALID_TYPE` / `_INVALID_DATE` / `_INVALID_VAS_ACCT`) |
| E8 | Cancel / X / outside-click | draft discarded, no network call |

## Permissions

| # | Scenario | Expected |
|---|---|---|
| P1 | Open View Permission dialog | `GET …/permissions?type=VIEW` roster; admins absent; selected boxes reflect active grants |
| P2 | Open Withdrawal Permission dialog | same for `type=WITHDRAWAL` |
| P3 | Withdrawal on a non-whitelisted bank | control disabled in the table (`withdrawalPolicy`); a server `WBE0452` still maps to an error dialog |
| P4 | Toggle grantees + Save | `PUT …/permissions` with the full desired set; success; table "X + N more" labels refresh |
| P5 | Non-admin caller, own row selected | own row locked (`lock_reason="SELF"`) |
| P6 | want-id not in tenant | `WBE_USER_NOT_IN_TENANT` error dialog |
| P7 | Non-admin tries to revoke self | `WBE_CANNOT_REVOKE_SELF` error dialog |
| P8 | No-op save (same set) | succeeds; no backend audit row written |

## Audit logs

| # | Scenario | Expected |
|---|---|---|
| AL1 | Open Audit Logs popup on a row with history | rows latest-first; date/time split; actor = display name |
| AL2 | Empty history | popup paints "no history", not an error |
| AL3 | Shared-DB coexistence | rows written by the live JEX system appear alongside refactor rows |

## Register (Add-chain)

| # | Scenario | Expected |
|---|---|---|
| RG1 | Pick scraped accounts in the Login Credentials Add-chain | `POST …/register`; success; list refetches with the new rows |
| RG2 | Re-register an already-present account | silently skipped (`skipped` count) |

## View Setting

| # | Scenario | Expected |
|---|---|---|
| VS1 | Click the list icon | shared `<ViewSettingPopover>` anchors to the icon |
| VS2 | Hide / reorder columns + Save | persists via `useViewSetting`; table re-renders the visible set in order |
| VS3 | Reset | restores system defaults |
| VS4 | CHECKBOX / ETC | never editable in the popover |

## Operations that do NOT exist (negative coverage)

| # | Scenario | Expected |
|---|---|---|
| N1 | "+ Add" a single hand-typed account | no such affordance — accounts come from `register` |
| N2 | Delete / de-register an account | no delete affordance, no `DELETE` endpoint |
| N3 | Export the list to Excel | no export icon — Bank Account has no data export |
| N4 | Excel import / upload | no Excel-upload dialog — `register` is the only bulk path |

## Error handling

| # | Scenario | Expected |
|---|---|---|
| ER1 | Backend unreachable on load | error dialog (`NETWORK`); no blank table |
| ER2 | API failure on a mutation | `type: "error"` dialog with the mapped message/code |
| ER3 | Session expired (401) | global Axios interceptor triggers the re-auth dialog |

## Cross-cutting

- Verify modal stack: Edit / Permission dialogs open at `stackLevel=2` over the Settings shell; nested
  pickers at `stackLevel=3`; dim compounds correctly; only the top layer is interactive.
- Verify all visible strings resolve via `t(...)` in EN / KO / VI.
- Verify the bank-logo cell renders a brand-coloured placeholder when the real PNG asset is absent
  (cosmetic, not a data gap).

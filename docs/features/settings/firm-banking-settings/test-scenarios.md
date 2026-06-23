# Firm Banking Settings — Test Scenarios (Frontend)

Manual SIT/UAT scenarios for the Firm Banking Settings panel. Backend scenarios + JUnit coverage:
[wecms-api/docs/features/settings/firm-banking-settings/test-scenarios.md](../../../../../wecms-api/docs/features/settings/firm-banking-settings/test-scenarios.md).

---

## List

| # | Scenario | Expected |
|---|---|---|
| L1 | Open the panel | Automation toggles + Linked Accounts list render; rows show bank logo, masked account+currency, status, last-updated |
| L2 | Verify masking | every account number is masked (`1009****0384`), never the full number |
| L3 | Empty tenant | `settings.firm_banking_settings.list.empty` |
| L4 | List fetch fails | error dialog (de-duped) + `…list.load_failed`; mock fallback may paint |

## Details + audit

| # | Scenario | Expected |
|---|---|---|
| DT1 | Click a row | Details dialog opens at stackLevel 2; 6 detail rows populate from the live detail fetch |
| DT2 | Detail shows cleartext account | the withdrawal account renders in full (detail endpoint), not masked |
| DT3 | Audit log loads | Date/Time · User · Activity Details rows latest-first; Activity Details rendered verbatim |
| DT4 | Row with no audit | audit-empty notice; details still render |

## Create

| # | Scenario | Expected |
|---|---|---|
| C1 | "+ Add", pick bank, pick account via autocomplete, fill fields, Save | success dialog; list refetches with the new row |
| C2 | Pick a supported bank (Shinhan/VCB/Woori) | accepted; `file_type` is server-derived (never entered) |
| C3 | Bank outside the 3-bank set | `WBE0001` error dialog |
| C4 | Bank not in the dictionary | `WBE0002` error dialog |
| C5 | Duplicate binding | `WBE2021` error dialog |
| C6 | Missing required field / bad `org_stat` | client `WBE_VALIDATION` / Save disabled |
| C7 | Cancel | dialog closes, no network call, no list change |

## Edit

| # | Scenario | Expected |
|---|---|---|
| U1 | Kebab → Edit, change Partner ID / VAN / Status, Save | success; list refetches with the updated row |
| U2 | Open Edit from inside Details | Edit stacks at L3 over Details; ESC returns to Details |
| U3 | Verify PK + file_type immutable | bank / account are not editable in the Edit form |
| U4 | Update a now-deleted row | `WBE2020` error dialog |

## Delete

| # | Scenario | Expected |
|---|---|---|
| D1 | Kebab → Delete → Continue | destructive confirmation → success dialog → row gone after refetch |
| D2 | Delete from the Details modal kebab | confirmation appears above Details; on success Details closes + list refetches |
| D3 | Delete a missing row | `WBE2020` error dialog |
| D4 | Double-click Delete | per-row `deletingAccountIds` guard blocks the duplicate request |
| D5 | Cancel the confirmation | returns to the still-open Details modal; no delete |

## Automation toggles

| # | Scenario | Expected |
|---|---|---|
| AT1 | Toggle "Match payment after history" (`00079`) | optimistic flip; persisted via Environment Settings |
| AT2 | Toggle "Transfer after full approval" (`00078`) | optimistic flip; persisted |
| AT3 | Backend rejects a toggle | flip reverts + error dialog |
| AT4 | Env fetch fails on mount | `…automation.load_failed` notice |

## Export / Import

N/A — Firm Banking Settings has no Excel export, import, or file-download flow.

## Authorization

| # | Scenario | Expected |
|---|---|---|
| A1 | User with `settings-firm-banking-settings` | panel appears in `<SettingsNav>`; all actions work |
| A2 | User without the grant | entry hidden from `<SettingsNav>`; direct API attempts 403 server-side |

## Error handling

| # | Scenario | Expected |
|---|---|---|
| E1 | Backend unreachable on load | error dialog + mock fallback (panel never blank) |
| E2 | API failure on a mutation | `type:"error"` dialog with the mapped message/code |
| E3 | Session expired (401) | global Axios interceptor triggers the re-auth dialog |

## Cross-cutting

- Verify modal stack: Details/Add/Edit open at stackLevel 2 (Edit at L3 over Details); the delete
  confirmation (`useDialog`) sits above the chain at `z-[100]`; the kebab row menu at `z-[95]`; only the
  top layer is interactive and dim compounds correctly.
- Verify ESC closes the top-most layer only; the Settings shell does not close on overlay click.
- Verify all visible strings resolve via `t(...)` in EN / KO / VI; audit Activity Details render verbatim.

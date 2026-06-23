# Bank Account — Screen Flow (Frontend)

Interaction flow for the Bank Account panel. Backend flow:
[wecms-api/docs/features/settings/bank-account/business-flow.md](../../../../../wecms-api/docs/features/settings/bank-account/business-flow.md).

```
Top nav → Settings → <SettingsModal> opens → SettingsNav → "Bank Account"
  (visible only when the session has the settings-core-bank-account grant or is admin)
      │
      ▼
<BankAccountPanel> mounts
      │  useApiData(() => fetchBankAccounts(sort.sortParams ?? {}), [sortField, sortDirection, refreshKey])
      ▼
GET /api/v1/settings/bank-account[?sortField&sortDirection]
      │  map ApiBankAccountRow[] → BankAccountRow[]  (snake_case → camelCase; mapBankAccountList)
      ▼
<BankAccountTable> renders (View-Setting-aware columns), default order PRN_SEQ → BANK → ACCT_NO
```

---

## States

| State | Trigger | UI |
|---|---|---|
| **List (idle)** | panel mount, GET resolves | table with View-Setting-driven columns; bank logo + name; per-row View / Withdrawal permission cells; audit-log cell |
| **Loading** | GET in flight | loading notice + chrome |
| **Empty** | GET resolves with no rows | empty-state notice |
| **Error** | GET fails | error dialog via `useDialog()` (`type: "error"`, mapped `errorCode`) |
| **Sort** | click a sortable header | `useTableSort` cycles default→ASC→DESC→default; the hook's `sortParams` flow into the `fetchBankAccounts` call; `useApiData` refetches |
| **Edit** | click a row / edit affordance | `<EditBankAccountDialog>` opens (re-seeded per row via `key`); Save → `PATCH /{bankCd}/{acctNo}` → success → `setRefreshKey(+1)` (list refetch); Cancel → discard |
| **Map VAS account** | inside the edit dialog | `<VasAccountPicker>` selects a VAS row; the seqNo/cd/nm ride in the PATCH body; backend FK-validates |
| **Manage View permission** | open Permission dialog (`type=V`) | `<PermissionDialog>` → `GET …/permissions?type=VIEW` roster; toggle checkboxes; Save → `PUT …/permissions` → `setRefreshKey(+1)` |
| **Manage Withdrawal permission** | open Permission dialog (`type=W`) | same dialog with `kind=WITHDRAWAL`; the Withdrawal control is disabled on banks outside the 5-bank `withdrawalPolicy` whitelist |
| **Permission blocked** | server returns `WBE0452` / `WBE_USER_NOT_IN_TENANT` / `WBE_CANNOT_REVOKE_SELF` | error dialog with the mapped message |
| **Audit logs** | open Audit Logs popup | `GET …/audit-logs` → `mapBankAccountAuditList` → shared audit-log dialog (latest-first; empty list paints "no history") |
| **Register (Add-chain)** | pick accounts after a scrape (Login Credentials flow) | `POST /register` (via the Add-chain dialogs) → success → `setRefreshKey(+1)` |
| **View Setting** | click the list icon | shared `<ViewSettingPopover>` anchored to the icon; Save/Reset persist through `useViewSetting(SCREEN_IDS.SETTINGS_BANK_ACCOUNT)` |

---

## Refresh model

Mutations (Edit, Permission Save, Register) bump a `refreshKey` that `useApiData` watches, re-running
the list fetch. There is no optimistic source-row mutation before the server confirms. The full list is
re-fetched after every successful Edit / Permission change / Register so the per-row permission label
aggregates (`"X + N more"`) and maintenance fields reflect the new state.

The sort state (`useTableSort`) is also in the `useApiData` deps, so toggling a header re-runs the fetch
with the new `sortField` / `sortDirection`.

---

## Modal stacking

- `<SettingsModal>` is the L1 shell.
- `<EditBankAccountDialog>` and `<PermissionDialog>` open over the shell at **`stackLevel=2`**; nested
  pickers (VAS picker / Select Bank Accounts in the Add-chain) sit at **`stackLevel=3`**.
- The `useDialog()` system feedback layer (success / error / confirmation) renders at `z-[100]`, above
  the whole stack.

---

## Authorization & visibility

The Bank Account entry appears in `<SettingsNav>` only when the session is admin or the granted menu
codes include `settings-core-bank-account`. The backend independently enforces
`@menuAuthz.canAccess('settings-core-bank-account')` on every endpoint — the frontend gate is UX, the
backend gate is the security boundary.

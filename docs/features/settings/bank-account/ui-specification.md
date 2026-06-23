# Bank Account — UI Specification (Frontend)

The implemented Bank Account panel UI. Follows the Settings shell + panel-composition contract and the
Settings UI consistency rules in `wecms-web/CLAUDE.md` §3a / §3b. Figma: 142:18741 (panel), 166:24840 /
166:25059 (permission dialogs).

---

## Main panel

- **Header:** title "Bank Account" + description; right-side action = the **list icon** (opens the View
  Setting popover). No "+ Add" button — accounts arrive via the scrape Add-chain, not a hand-typed create.
- **Filters:** the Figma read-state shows **no filter row** in the panel header. (`BankAccountFilter`
  exists on the backend wire for a future filter row / the export-request shape, but no visible filter is
  rendered today.)
- **Scroll:** the table scrolls inside `custom-scrollbar`; the header/action row stays pinned outside the
  scroll region per the panel composition rule.

## Table

[`<BankAccountTable>`](../../../../components/settings/bank-account/BankAccountTable.tsx) — bare `<table>`
+ shared `<colgroup>`, View-Setting-aware column set. Columns iterate the visible View Setting entries in
`DISP_ORD` order.

| Column | Source (`BankAccountRow`) | Notes |
|---|---|---|
| Bank | `bankCd` / `bankName` | logo ([`<BankBrandLogo>`](../../../../components/settings/bank-account/BankBrandLogo.tsx)) + bank name |
| Account No | `accountNumber` | |
| Currency | `currency` | VND / USD / KRW |
| Nickname | `nickname` | |
| Description | `description` | blank cell when empty (never `-` / `null`) |
| Account Type | `accountType` (`accountTypeCd` → current / saving / fixed) | |
| Maturity Date | `maturityDate` | blank for current accounts |
| VAS Code | `vasCode` | |
| VAS Account Name | `vasAccountName` / `vasAccountBank` | |
| Balance / Available | (from the wire `bal` / `real_amt`) | echoed read-only |
| View Permission | `viewPermissionLabel` | link / "X + N more" / placeholder |
| Withdrawal Permission | `withdrawalPermissionLabel` | disabled control on non-whitelisted banks (`withdrawalPolicy`) |
| Audit Logs | `auditLogActor` / `auditLogDate` | opens the audit-logs popup |

> Column visibility/order/sort is governed by **View Setting** (`SCREEN_IDS.SETTINGS_BANK_ACCOUNT`).
> Sortable columns mirror the backend `BankAccountSortField` whitelist (Bank · Nickname · Description ·
> Account Type · Maturity · VAS Code · VAS Name); the permission/audit columns carry `SORT_YN='N'`.

## Edit dialog

[`<EditBankAccountDialog>`](../../../../components/settings/bank-account/EditBankAccountDialog.tsx) —
shadcn `<Dialog>`, opens per row (re-seeded via `key`).

| Field | Editable | Notes |
|---|---|---|
| Account Type | ✅ | dropdown seeded from `accountTypeCd` (authoritative 2-char code); maturity input is disabled when the type is **current** |
| Maturity Date | ✅ (saving / fixed only) | date input; cleared/disabled for current accounts |
| Nickname | ✅ | |
| Description | ✅ | |
| VAS Account | ✅ | [`<VasAccountPicker>`](../../../../components/settings/bank-account/VasAccountPicker.tsx) — searchable selector; the picked `{ seqNo, code, name }` rides in the PATCH body |

- **Save** dispatches a minimal `PATCH` — only the changed fields are included (the dialog diffs against
  the seed before building the body); VAS triple rides together. Success → success dialog + `refreshKey++`.
- **Cancel / outside-click / X** discards the draft.

## Permission dialog

[`<PermissionDialog>`](../../../../components/settings/bank-account/PermissionDialog.tsx) — one component,
two kinds (`PermissionKind` = `VIEW` | `WITHDRAWAL`):

- On open, `GET …/permissions?type=` loads the roster (every active non-admin tenant user with
  `is_selected` / `is_locked` flags).
- Checkbox list; admins do not appear; a non-admin caller's own row is locked when currently selected
  (`lock_reason = "SELF"`).
- **Save** sends the full desired user-id set via `PUT …/permissions` (replace semantics). Success →
  `refreshKey++` so the table's "X + N more" labels refresh.
- The **Withdrawal** kind's control is disabled in the table for banks outside the 5-bank
  `WITHDRAWAL_ALLOWED_BANK_CDS` whitelist; a server-side `WBE0452` is still mapped to an error dialog as
  defence in depth.

## Audit-logs popup

`GET …/audit-logs` → `mapBankAccountAuditList` → the shared audit-log dialog. Rows are latest-first;
`reg_dtm` (`yyyyMMddHHmmss`) is split into date / time lines; the actor is `reg_nm` (fallback `reg_id`);
the activity / detail strings are pre-localized server-side. Empty history paints a "no history" body.

## View Setting popover

Shared [`<ViewSettingPopover>`](../../../../components/shared/view-setting/ViewSettingPopover.tsx) driven
by `useViewSetting(SCREEN_IDS.SETTINGS_BANK_ACCOUNT, DEFAULT_AREA_ID)`. The list icon's `DOMRect` anchors
the popover (right-edge aligned). Save/Reset persist through the shared hook. `CHECKBOX` / `ETC` special
fields are never user-editable.

## States

Loading / empty / error per [screen-flow.md](screen-flow.md). Error dialogs use `type: "error"` with the
mapped `errorCode`; success uses `type: "success"`; destructive confirmations (if any) use
`type: "confirmation"` — per the project dialog-variant rule.

## i18n keys (namespace `settings.bank_account.*`)

`title` · `description` · `col.{bank,account_no,currency,nickname,description,account_type,maturity,vas_code,vas_name,balance,available,view_permission,withdrawal_permission,audit_logs}`
· edit-dialog field labels · permission-dialog chrome · audit-logs chrome · plus the nav label
`settings.nav.bank_account`. All present in `locales/{en,ko,vi}.json`.

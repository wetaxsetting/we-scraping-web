# Settings — Legacy Display-Rule Parity Audit & Fixes (2026-06-27)

> **STATUS — Tier-1 frontend fixes ACCEPTED 2026-06-27.**
> The approved Tier-1 legacy-parity fixes (B1, B2, B3, B5, B6, B7, B8, B9, B10 +
> approved native-`title`→`EllipsisTooltip` replacements) are implemented and
> verified (`tsc --noEmit` ✅ · ESLint 0 errors on changed files, 3 pre-existing
> warnings · `next build` ✅). **No datetime changes, no backend changes, no
> P1–P11 product/design changes, no D3–D6 shared-component refactor, and no
> Banking / Payment / Add-on business-logic changes** were made.
>
> Deferred items are documented in [§Deferred / remaining items](#deferred--remaining-items)
> below — they are intentionally **out of the accepted Tier-1 scope**.

- **Method:** Analyze → Compare with Legacy → Root cause → Impact → Approve →
  Implement → Verify (project workflow). Legacy JEX = source of truth.
- **Scope:** Settings top menu — Master Data (Purpose, VAS Account, Contacts,
  Approval Line, Chart of Accounts), Banking Settings (Login Credentials, Bank
  Account, Preferences), User Management (Users), ERP (Transaction History),
  Firm Banking (Settings, History) + shared dialogs / tables / formatters /
  backend / export.
- **Companion audit:** the Banking-module equivalent is
  [../banking/display-rule-parity-audit.md](../banking/display-rule-parity-audit.md).

---

## Tier-1 — implemented & accepted

Frontend-only; legacy parity. Files are under `components/settings/**` plus two
`lib/api/` mappers (in `mappers.ts`, only `mapLoginCredentialAuditRow` — a
Settings concern — was touched).

| ID | Item | What changed | File(s) | Legacy ref |
|---|---|---|---|---|
| **B1** | Approval Line count badge | Badge now shows the **total** approver count (was extras `len-1`) and renders even for a single-approver line. | [ApprovalLineTable.tsx](../../../components/settings/approval-line/ApprovalLineTable.tsx) (`approverCount`) | `comm_0222_001.ts:139,150` |
| **B2** | Contacts Type/Location case *(see naming note below)* | Removed the `uppercase` CSS from the Contacts list text cell so the value renders in its stored/mixed case, matching legacy `null2void` output. | [ContactsTable.tsx:221](../../../components/settings/contacts/ContactsTable.tsx) | `comm_0184_001.ts:264,269` |
| **B3** | Login Credentials audit Activity column | Mapper passes the per-row `audit_logs_actv` through **verbatim** (was a hardcoded `"login_credentials"` constant that made every row identical); panel renders it directly (no `t()` on already-localized text). Mirrors the firm-banking audit path. | [mappers.ts](../../../lib/api/mappers.ts) `mapLoginCredentialAuditRow`; [auditLogs.ts](../../../components/settings/login-credentials/auditLogs.ts) (`activity: string`); [LoginCredentialsPanel.tsx](../../../components/settings/login-credentials/LoginCredentialsPanel.tsx) | `comm_0218_005_view.jsp:81-85` |
| **B5** | Bank Account VAS Account Name | VAS_NAME cell renders the raw `vasAccountName` (was the combined `vasAccountBank` `"Test(VND)"` form). | [BankAccountTable.tsx](../../../components/settings/bank-account/BankAccountTable.tsx) VAS_NAME case | `comm_0183_001.ts:782` |
| **B6** | Firm Banking History Service Name prefix | New feature-local helper adds the legacy `"NNN : "` numeric prefix for mapped firm-banking codes (201/202/203; 204 stays raw). Used by **both** the list cell and the detail popover. | [serviceName.ts](../../../components/settings/firm-banking-history/serviceName.ts); [FirmBankingHistoryTable.tsx](../../../components/settings/firm-banking-history/FirmBankingHistoryTable.tsx); [FirmBankingHistoryDetailPopover.tsx](../../../components/settings/firm-banking-history/FirmBankingHistoryDetailPopover.tsx) | `comm_0221_001.ts:639-647` |
| **B7** | Firm Banking History Response Code fallback | Detail Response Code shows `"9999"` when empty. | [FirmBankingHistoryDetailPopover.tsx](../../../components/settings/firm-banking-history/FirmBankingHistoryDetailPopover.tsx) | `comm_0221_001.ts:606` |
| **B8** | Firm Banking History Response Message fallback | S/G/B legs with an empty response code fall back to "Data Not Found" (via the existing verified key `common.no_data_found`) instead of the F-leg "Failed" label. | [FirmBankingHistoryDetailPopover.tsx](../../../components/settings/firm-banking-history/FirmBankingHistoryDetailPopover.tsx) | `comm_0221_001.ts:618-619` (j024) |
| **B9** | Bank Account edit — account number hyphen preservation | Account No. rendered verbatim (removed `.replace(/-/g,"")`). | [EditBankAccountDialog.tsx](../../../components/settings/bank-account/EditBankAccountDialog.tsx) | `comm_0183_003.ts:265` |
| **B10** | Purpose Description empty value | Empty description maps to `""` (blank cell), not the `"-"` placeholder. Both `"-"` consumers already guard `!== "-"`, so save behavior is unchanged. | [purposeSettings.ts](../../../lib/api/purposeSettings.ts) `mapPurposeSettingRow` | `comm_0187_001.ts:731` (null2void) |
| — | Native `title` → `EllipsisTooltip` (approved subset) | Replaced native `title` with the shared `EllipsisTooltip` on the **plain-text** cells only: Purpose Description, Login ID/PW sub-type label, Bank Account Description. | [PurposeRow.tsx](../../../components/settings/purpose/PurposeRow.tsx); [LoginIdPwPopover.tsx](../../../components/settings/login-credentials/LoginIdPwPopover.tsx); [BankAccountTable.tsx](../../../components/settings/bank-account/BankAccountTable.tsx) | CLAUDE.md tooltip rule |

### B2 naming note (important — read before editing)

The accepted-items list names B2 **"Contacts Type/Location case"** (carried over
from the original audit text, which described the Local/Overseas *Type* column).
The **code reality** is:

- The **only** `uppercase` class in the Contacts table was on the cell at
  [ContactsTable.tsx:221](../../../components/settings/contacts/ContactsTable.tsx),
  which wraps `<EllipsisTooltip text={row.contactName} />` — i.e. the **Contact
  Name** column. That is the cell the fix changed.
- The **Type/Location** cell (`:233-236`, rendering
  `t("settings.contacts.location.<local|overseas>")` → "Local"/"Overseas") never
  carried `uppercase` and already matched legacy.
- Legacy `comm_0184_001.ts` renders **both** the name (`:264`) and the type
  (`:269`) via `null2void` with **no** uppercase. So removing the spurious
  `uppercase` is the correct legacy-parity fix regardless of column label, and no
  change is needed on the Type/Location column.

**Net effect is exactly what was approved** (remove the spurious uppercase from
the Contacts list). The original "Type/Location" wording was a column mislabel in
the source audit. If the Type/Location column is ever required to render in a
specific forced case, that would be a **new** request (it currently matches
legacy mixed-case).

---

## Deferred / remaining items

These are intentionally **out of the accepted Tier-1 scope**. None were
implemented. Listed separately by category.

### A. Datetime decision — B4, B11, and all datetime rendering (BLOCKED)

The single biggest open question. Five Settings screens shift `REG_DTM` /
`MOD_DTM` / `MOD_DTTM` from **UTC → Asia/Ho_Chi_Minh (+7h)** via
`formatUtcDtmByLanguage`, while legacy renders the stored digits **verbatim (no
shift)**. This is anchored to the refactor backend writing
`OffsetDateTime.now(UTC)`, but the app runs against the **live JEX DB** whose
legacy rows are wall-clock — so shifting those would be wrong. **Resolve the
storage-zone-per-column question (PO + DBA) before any datetime change.**

| ID / area | Refactor (shifts +7h) | Legacy (no shift) |
|---|---|---|
| Approval Line — Create Date | `ApprovalLineTable.tsx` `formatRegDtm` | `comm_0222_001.ts:132-135` |
| **B4** Login Credentials — list date vs audit dialog inconsistency | list `formatAuditDate` (fixed `DD-MM-YYYY`, locale-blind, no shift) ≠ dialog `formatUtcDtmByLanguage` (shift + locale) | `comm_0218_001.ts:343` / `comm_0218_005.ts:97` |
| **B11** Bank Account — audit-list column date | `formatAuditDate` (fixed `DD-MM-YYYY`, locale-blind) | `comm_0183_001.ts:834` (`formatDateLang`) |
| Bank Account — audit dialog | `AuditLogsDialog.tsx` `formatUtcDtmByLanguage` | `comm_0183_004.ts:42` (verbatim) |
| Firm Banking Settings — Last Updated + audit | `lastUpdated.ts` / `mappers.ts` (UTC instant) | `comm_0220_001.ts:253-257` (date-only, no shift) |
| ERP Transaction History — Date | `ErpTransactionHistoryTable.tsx` `formatUtcDtmByLanguage` | `comm_0219_001.ts:316` |

> Firm Banking **History** `tarn_dtm` is correctly **not** shifted (the view's
> `kr_to_vn_time` already converted) — it matches legacy and is not part of this
> item. See memory `project_settings_datetime_tz_locale.md`.

### B. Product / design decisions — P1–P11 (PO sign-off required)

| ID | Screen / dimension | Legacy | Refactor |
|---|---|---|---|
| P1 | Purpose — group tabs | Sale/Cashbook/Expenses/Banking/Cash-Advance + Deleted/Unused tabs (`comm_0187_001.ts:342-407`) | single flat tree (scoped to `USAG_GRP_CD IS NULL`) |
| P2 | VAS Account — Excel template columns | 7 cols (`comm_0217_002_r001_act.jsp:57-86`) | 2-col preview (PO trim 2026-05-11) |
| P3 | VAS Account — Active badge | light-blue **with border** `#7CC1FD/#B9DCFE/#0152A3`, 14px (`_common.css:9300`) | `bg-brand-softer text-brand-active`, no border, 13px |
| P4 | Chart of Accounts — Active badge | **gray** (`comm_0223_001_view.jsp:91`) | **blue** `bg-brand-softer` |
| P5 | Chart of Accounts — default sort | flat `ORDER BY CHART_ACCT_CD ASC` | restricted-roots-first DFS tree (PO directive 2026-05-25) |
| P6 | Bank Account — permission popup ADMINs | shown, pre-checked + disabled (`comm_0183_002.ts:239`) | all ADMIN rows filtered out (`PermissionDialog.tsx:100`) |
| P7 | Product-type **"H"** hiding | H hides Bank Account VAS columns, Preferences toggle section, ERP Deleted tab + code 15 + E-tab File column | not reproduced (deliberate, OQ-2) |
| P8 | Firm Banking Settings — account number | unmasked (`comm_0220_001.ts:290`) | masked `7000****5280` (OQ-4) |
| P9 | Preferences — logo MIME (security) | JPG/PNG only (`wabooks.comm.ts:4680`) | allow-list adds `svg+xml`, gif — **stored-XSS smell; recommend dropping SVG regardless of parity** |
| P10 | Default page size | 15 (Contacts/ERP/Firm-Banking-History) | 10 (shared `PAGE_SIZE_OPTIONS`; 15 not offered) |
| P11 | Contacts — header labels / footer | "Type" / "Bank Name" + "Total N Contact(s)" footer | "Contact Location" / "Deposit Account"; no total footer (`ContactsPanel.tsx:409`) |

### C. Shared-component refactors — D3–D6 (excluded scope)

| ID | Item |
|---|---|
| D3 | Two near-identical tooltip components (`components/shared/Tooltip.tsx` ≈ `EllipsisTooltip.tsx`, ~130 dup lines). Extract a shared positioning core. **Also the prerequisite for §D below.** |
| D4 | Bespoke searchable dropdowns duplicating `SearchSelect`: `chart-of-accounts/InlineDropdown.tsx`, `purpose/ParentPurposePicker.tsx`, `bank-account/VasAccountPicker.tsx`, `users/PhoneCountryPicker.tsx`, `firm-banking-settings/NewFirmBankingDialog.tsx`, `shared/popups/LoginIdPasswordDialog.tsx`, `SelectBankAccountsDialog.tsx`. |
| D5 | Duplicate local `toIso(Date)` builder in `ErpTransactionHistoryPanel.tsx:116` + `FirmBankingHistoryPanel.tsx:64` — lift to `lib/datetime.ts`. |
| D6 | Inconsistent empty placeholders (`""` vs `—` vs raw-blank vs `"-"`). Bank Account alone uses both `""` and `—`. Standardize via a shared helper. |

### D. Interactive native-`title` cases (need shared tooltip enhancement)

Native `title` was **not** replaced on these because they are **interactive
elements** — nesting `EllipsisTooltip` (which makes its trigger span focusable
when truncated) inside a `<button>` / clickable `<li>` is invalid HTML. They
require a `Tooltip`/`EllipsisTooltip` enhancement that supports an interactive
(non-focusable-trigger) mode — which is the **D3** shared-component work above.

| File:line | Element | Field |
|---|---|---|
| [LoginCredentialsTable.tsx:109](../../../components/settings/login-credentials/LoginCredentialsTable.tsx) | `<button>` | Institution |
| [LoginCredentialsTable.tsx:139](../../../components/settings/login-credentials/LoginCredentialsTable.tsx) | `<button>` | Login ID |
| [LoginCredentialsTable.tsx:170](../../../components/settings/login-credentials/LoginCredentialsTable.tsx) | `<button>` | Audit Logs date |
| [ErpTransactionHistoryTable.tsx:127](../../../components/settings/erp-transaction-history/ErpTransactionHistoryTable.tsx) | `<button>` | File name (download) |
| [AddNewContactDialog.tsx:1048](../../../components/settings/contacts/AddNewContactDialog.tsx) | `<li>` option | bank dropdown option |

### E. Backend (no change required for Tier-1)

Backend ships raw values across Settings; `AmountFormatter` is absent from
`domain/setting`. Two minor response-side shapes are deferred follow-ups, not
parity bugs: `BankAccountRow.maturityDate` ISO reshape and
`PreferencesResponse.modifiedAt` ISO-offset. No backend change is needed for any
Tier-1 fix.

---

## Verification (Tier-1)

- `npx tsc --noEmit` → **0 errors**.
- `npx eslint <14 changed files>` → **0 errors**, 3 warnings — all pre-existing
  (`POPUP_WIDTH`, `ApiCurrencyTotal`, `_total`; see [../../tech-debt.md](../../tech-debt.md)).
- `npx next build` → **success**, all routes compiled.
- Scope confirmed: changes only under `components/settings/**` + `lib/api/{mappers,purposeSettings}.ts`;
  no Banking / Payment / Add-on business logic touched.

## Related

- Backend Settings docs: see the per-item API-side links in
  [./README.md](README.md).
- Memory: `project_settings_tier1_parity_fixes`,
  `project_settings_datetime_tz_locale`.

# Select Bank Accounts — Account Type auto-fill (frontend parity)

**System:** Refactor frontend (wecms-web) vs. Legacy JEX
**Feature:** `login-credentials` → "Select bank accounts" popup ([SelectBankAccountsDialog](../../components/shared/popups/SelectBankAccountsDialog.tsx))
**Date:** 2026-07-16
**Verdict:** **FIXED (Tier-2, 2026-07-16)** — the Account Type dropdown now opens pre-selected to
**Current** for the row currency, matching legacy. Full correctness for banks whose mapping table
encodes Savings/Fixed additionally needs the backend Tier-1 seed (PO-pending). Backend counterpart +
full mechanism analysis:
[wecms-api/docs/audits/legacy-parity/select-bank-accounts-account-type-autofill-parity-audit.md](../../../wecms-api/docs/audits/legacy-parity/select-bank-accounts-account-type-autofill-parity-audit.md).

---

## Symptom

After Login-bank scraping, the "Select bank accounts" popup opens with **Account Type = "Select"**
on every row. Legacy JEX auto-fills it (e.g. VCB → `Current (VND)`, `Current (VND)`,
`Current (USD)`).

## Legacy mechanism (two tiers)

1. **Server mapping** — legacy `fnsh_0101_001_r001` maps the bank's raw scrape string →
   `ACCT_TYPE_CD` via `NXISAS_ACCT_TYPE_MAPPING (BANK_CD, CCY_CD, NXISAS_ACCT_TYPE)`.
2. **Client fallback** — legacy `comm_0218_nxisas.ts:1317-1332`: when the server left it blank,
   default to the **first option for the currency** (always **Current** — `03`/`04`/`07`), and set
   `ACCT_DV_CD="1"` when the resolved code is `02` (Fixed).

Dropdown option set per currency (matches [SelectBankAccountsDialog `acctTypeCodeFor`](../../components/shared/popups/SelectBankAccountsDialog.tsx)):
VND `03/05/02`, USD `04/06/02`, KRW `07/08/02` (Current / Savings / Fixed Deposit).

## Refactor state (why it's blank)

- **Server mapping is inert** — the wire field `acct_type_cd` exists
  ([bankCredentials.ts `ApiScrapedAccount`](../../lib/api/bankCredentials.ts)) and the API
  resolves it, but the `NXISAS_ACCT_TYPE_MAPPING` table is **off-inventory and unseeded**, so the
  API returns `acct_type_cd: null` today. (Backend detail in the paired audit.)
- **Client fallback is missing** —
  [`mapScrapedToBankRow`](../../components/shared/popups/selectBankAccountsMockData.ts)
  calls `normalizeAcctTypeCd(acc.acct_type_cd ?? acc.acct_type)`, which returns a value **only**
  when it is already `02–08`; `null`/free-text → `""`. The dialog's `AccountTypeSelect` then shows
  the "Select" placeholder. There is **no** "default to Current" fallback.
- The `normalizeAcctTypeCd` comment claims *"legacy parity: blank when unmappable"* — this is a
  **misreading**. Legacy is not blank-when-unmappable; it defaults to Current.

With both tiers absent, every row is blank — exactly the reported symptom.

## FE fix applied (2026-07-16, no contract change)

`mapScrapedToBankRow` now, when `normalizeAcctTypeCd(...)` yields `""`, falls back to the first
option for the row currency (Current: `03` VND / `04` USD / `07` KRW) via the new exported
`defaultCurrentAcctTypeCd`, mirroring legacy `comm_0218_nxisas.ts:1317-1332`. The misleading
"blank when unmappable" comment was corrected. `tsc --noEmit` clean.

This restores the legacy screenshot behaviour immediately, independent of the backend seed. Full
correctness (distinguishing Savings/Fixed for banks whose mapping table encodes them) additionally
needs the backend `NXISAS_ACCT_TYPE_MAPPING` seed — a PO/DBA decision tracked in the paired
backend audit.

**Not done (out of scope / pre-existing):** legacy also sets `ACCT_DV_CD="1"` for Fixed-Deposit
(`02`) rows. The refactor backend `AccountEntry`/`ACCT_MSTR` register path does **not** carry
`ACCT_DV_CD` at all today, so this is a separate backend-contract gap, not part of the display
auto-fill — leave to a dedicated MR with PO input if fixed-deposit sub-classification is needed.

> ⚠️ **Legacy quirk:** an account with a maturity date still auto-fills **Current** if unmapped
> (legacy does not infer Fixed from a maturity date). Keep bug-for-bug unless the PO asks to change it.

## References

- Dialog: [SelectBankAccountsDialog.tsx](../../components/shared/popups/SelectBankAccountsDialog.tsx)
- Mapper: [selectBankAccountsMockData.ts](../../components/shared/popups/selectBankAccountsMockData.ts)
- Wire type: [bankCredentials.ts](../../lib/api/bankCredentials.ts) (`ApiScrapedAccount.acct_type_cd`)
- Host panel: [LoginCredentialsPanel.tsx](../../components/settings/login-credentials/LoginCredentialsPanel.tsx)
- Legacy: `comm_0218_nxisas.ts:1227-1372`, `fnsh_0101_001_r001_act.jsp:128-206`, `osmc.ui.ts:945-975`

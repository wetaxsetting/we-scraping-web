# Bank Account — SUPERSEDED

**Status: SUPERSEDED** *(reduced to a pointer 2026-08-17)*

**Authoritative documentation:** [./bank-account/README.md](bank-account/README.md)

The 6-doc folder — README · [screen-flow](bank-account/screen-flow.md) ·
[ui-specification](bank-account/ui-specification.md) ·
[component-index](bank-account/component-index.md) ·
[api-consumption](bank-account/api-consumption.md) ·
[test-scenarios](bank-account/test-scenarios.md) — describes the shipped panel, with legacy
`comm_0183_*` parity verified 2026-06-23 (this file's own verification was dated 2026-06-01).

## What happened to this file's content

The standard Overview / Page Location / UI Components / User Actions / Table Columns / Dialogs /
API Integration / Validation sections are **all covered in the folder** and were removed rather than
maintained twice.

The **open items and deliberate non-gaps** were not covered elsewhere and have been **migrated** to
[bank-account/README.md § Open items and deliberate non-gaps](bank-account/README.md):

- Audit Logs dialog body still renders mock rows (no backend audit-read endpoint yet)
- VAS-name composite column echoes the VAS name pending the full `BANK_NM(CCY)` form
- `BankBrandLogo` is a brand-coloured placeholder (cosmetic)
- ❓ `AUTH_TYPE = 'F'` exists in the DDL — confirm whether the UI should expose it
- ✅ Maturity datepicker disabled for current accounts (`ACCT_TYPE` 03/04) is **intentional JEX
  parity**, not a gap

This stub is kept so existing links and bookmarks do not 404. Do not add content here.

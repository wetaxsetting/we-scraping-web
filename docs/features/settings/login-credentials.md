# Login Credentials — SUPERSEDED

**Status: SUPERSEDED** *(reduced to a pointer 2026-08-17)*

**Authoritative documentation:** [./login-credentials/README.md](login-credentials/README.md)

The 6-doc folder — README · [screen-flow](login-credentials/screen-flow.md) ·
[ui-specification](login-credentials/ui-specification.md) ·
[component-index](login-credentials/component-index.md) ·
[api-consumption](login-credentials/api-consumption.md) ·
[test-scenarios](login-credentials/test-scenarios.md) — describes the shipped panel and is five times
the size of what this file held.

## What happened to this file's content

It carried the standard Overview / Page Location / UI Components / User Actions / Table Columns /
Dialogs / API Integration / Validation sections. **All of it is covered in the folder**, so it was
removed rather than maintained in two places.

One section was **not** covered anywhere else and has been **migrated**, not deleted:

- The **Select Bank Accounts remediation readiness + operational follow-ups** (2026-06-17) — the
  `NXISAS_ACCT_TYPE_MAPPING` DBA seed, the `VAS_ACCT_SEQ_NO` PO/DBA confirmation, and the SIT
  live-gateway verification, plus the SIT-Ready / UAT-Not-Ready verdict. It now lives in
  [login-credentials/README.md § Readiness — operational follow-ups](login-credentials/README.md).

The one standing caveat this file used to close on is also preserved in the folder: **GDT credentials
are manual-only** — do not confuse them with the server-side bank scraping flow.

This stub is kept so existing links and bookmarks do not 404. Do not add content here.

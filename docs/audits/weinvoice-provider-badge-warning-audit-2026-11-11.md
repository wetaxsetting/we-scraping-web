# WeInvoice: "Phát hành qua" Badge Shows "!" Although XML and PDF Are Present — Audit

**Date:** 2026-11-11
**Type:** AUDIT / INVESTIGATION
**Current Work Classification:** AUDIT
**Finding Classification:** BUG (web list cell ignores the backend flag)
**Status:** COMPLETE (investigation)
**Investigation Status:** COMPLETE
**Approval Status:** APPROVED (developer, 2026-11-11: "Duyệt, sửa cả hai") — implemented in [weinvoice-list-provider-badge-lookup-flag-2026-11-11](../issues/weinvoice-list-provider-badge-lookup-flag-2026-11-11.md) and the backend record `we-scraping-api/docs/issues/weinvoice-list-row-lookup-code-2026-11-11.md`
**Implementation Status:** see the implementation records
**Repository:** we-scraping-web (backend we-scraping-api may be involved)

## Observed Behavior

Sales list (Webcash 1201496252), invoices 1C26TWE-2, -3, -4: XML and PDF chips are both lit, but the "Phát hành
qua" badge reads "MISA !" (warning). 1C26TWE-1 reads "MISA ↗". The developer asks what the warning means and how
the status changes when an XML / PDF is imported or uploaded.

## Expected Behavior

"!" (spec §3.4) means: the provider is known and supports opening the original invoice by **lookup code**, but no
code / link is known for this invoice (the XML did not carry one, none typed by the user) → click asks for the code.
It is **not** about XML / PDF presence. With a code, the badge is "↗" (opens the original on the provider portal).

## Scope

Invoice list "Phát hành qua" column; the backend field(s) behind it; effect of import / upload on them.

## Initial Evidence

Screenshot from the developer, 2026-11-11.

## Investigation Plan

1. Web: which field drives "!" vs "↗" in the provider badge.
2. Backend: how that field is computed for the list row.
3. DB: the values for 1C26TWE-1..4.

## Database Trace (read-only, 2026-11-11)

| Invoice | id | MSTTCGP | `invoice_xml.ma_tra_cuu` | PDF source |
|---|---|---|---|---|
| 1C26TWE-1 | 10359 | 0101243150 (MISA) | 6KF9HZ4PGVP9 | email |
| 1C26TWE-2 | 10433 | 0101243150 | A9FGHZ_12ZVQ | email |
| 1C26TWE-3 | 10434 | 0101243150 | EPF5HRV83WJA | email |
| 1C26TWE-4 | 10435 | 0101243150 | EPF5HRV8KB2X | misa_meinvoice |

All four have a lookup code → the backend list flag `needs_lookup_code` is **false** for all
(`InvoiceQueryRepository` ROW_MAPPER: `hasCode = manual_code || ma_tra_cuu || lookup_url`).

## Frontend Trace

- `InvoiceListPage.tsx` ≈ line 675: `needCode = hasFile(inv, "xml") && !inv.lookupCode && supportsDeepLink(...)`.
- In api mode a list row carries **no lookup code** (`fromRow`: `lookupCode: prev?.lookupCode ?? ""`); it is filled
  only after the invoice detail was opened in this session. So every MISA row with XML whose detail was not opened yet
  shows "!", whatever the DB holds. 1C26TWE-1 shows "↗" only because its detail had been loaded.
- `needsLookupCode(inv)` in `lib/api/weinvoice/invoices.ts` already reads the backend flag, but the list cell does not
  use it. For the same reason "↗" from the list cannot deep-link (no code) and opens the portal page instead.

## Root Cause

Web list cell computes "!" from `inv.lookupCode`, which list rows never carry in api mode, instead of the backend
`needs_lookup_code` flag.

## Status When Importing / Uploading (answer to the developer)

| Action | Lookup code | "!" |
|---|---|---|
| GDT XML / mail XML / bulk import XML that **creates or completes** the record (NEW / MERGED) | engine reads it from the XML into `invoice_xml.ma_tra_cuu` (if the XML has one) | gone once the code is in the XML |
| Bulk import or detail upload that only **restores a missing file** (record already parsed) | unchanged (already in DB) | unchanged |
| Upload / import a **PDF** | not touched | unchanged — PDF does not carry the code |
| User types the code / link in the detail ("Nhập mã tra cứu") | `winv_lkup_cd` | gone |
| XML without a code (e.g. BKAV) | none | stays until the code is typed |

## Recommended Implementation

- web (required): the list cell uses `needsLookupCode(inv)` (backend flag) instead of `!inv.lookupCode`.
- api (optional): add `lookup_code` / `lookup_url` to `InvoiceRow` so "↗" in the list opens the original directly
  without opening the detail first.

## Required Regression Tests

- web: row with `needs_lookup_code=false` and no `lookupCode` → no "!" ; `needs_lookup_code=true` → "!".

## Affected Repositories

we-scraping-web (required); we-scraping-api (optional `lookup_code` in the list row).

## DB Impact

NONE.

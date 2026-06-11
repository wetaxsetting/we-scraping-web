# Contacts — Test Scenarios (Frontend)

SIT/UAT scenarios for the Contacts Settings panel. Backend scenarios:
[wecms-api/docs/features/settings/contacts/test-scenarios.md](../../../../../wecms-api/docs/features/settings/contacts/test-scenarios.md).

---

## Search
| # | Scenario | Expected |
|---|---|---|
| FS1 | Type a keyword | Grid refetches (`resetToFirstPage`); matches contact code / name / Tax ID; previous rows stay visible while fetching |
| FS2 | Check Local only | `trco_type="L"` sent; only Local rows |
| FS3 | Check Overseas only | `trco_type="O"`; only Overseas rows |
| FS4 | Both checked | No `trco_type` filter; all rows |
| FS5 | Both unchecked | Sentinel "show none" — empty grid, no rows |
| FS6 | Sort Contact Code / Name / Location / Tax ID | Header cycles default→ASC→DESC→default; server reorders |
| FS7 | Change page size | List reloads; selection cleared |

## Create
| # | Scenario | Expected |
|---|---|---|
| FC1 | Add Local contact (code + name + one deposit account) | Dialog validates; `POST /` succeeds; grid refreshes; new row visible |
| FC2 | Add Overseas contact (beneficiary block) | `trco_type="O"`; beneficiary persisted |
| FC3 | Add with whitespace in Contact Code | Whitespace stripped on input/paste before submit |
| FC4 | Add with Tax ID = 11 digits | Inline format error `msg3` (must be 10 or 13) |
| FC5 | Add duplicate Contact Code | Inline `msg1` from `WBE_CONTACTS_HAND_KEY_DUP` |
| FC6 | Add Local with current address only | Valid (Local requires current address; bank optional) |
| FC7 | Staged attachments on create | Files upload sequentially after the contact is created |

## Update
| # | Scenario | Expected |
|---|---|---|
| FU1 | Edit general info | `loadDetail` seeds the form; `PUT /` saves; grid refreshes |
| FU2 | Edit address (add changed/old + Valid Till) | Current → `disp_ord=1`, changed → `disp_ord=2`; popover shows both |
| FU3 | Edit bank account (add / remove) | Account upsert/delete; `accounts_to_delete` populated for removed saved rows |
| FU4 | Switch Local ↔ Overseas | Confirmation; leaving side's keys queued for delete |
| FU5 | Cancel edit | Draft discarded; no mutation |

## Delete
| # | Scenario | Expected |
|---|---|---|
| FD1 | Single delete (free) | Confirm → `DELETE /{trcoKey}` → row gone after refresh |
| FD2 | Single delete (in use) | `WBE1190` → `settings.contacts.delete_error.in_use` dialog |
| FD3 | Bulk delete selected | "Delete Selected" visible only when rows selected → confirm → `POST /bulk-delete` |
| FD4 | Bulk delete with an in-use row | `WBE1190`; no rows deleted (backend rolls back) |

## Export (GAP-01)
| # | Scenario | Expected |
|---|---|---|
| FE1 | Download → Local Contacts | XLSX with 9 columns; only Local rows; respects active keyword |
| FE2 | Download → Overseas Contacts | XLSX with 11 columns; only Overseas rows |
| FE3 | Export with no matching rows | Valid XLSX, header + `0 contact(s)` subheader, no data rows |
| FE4 | Filename | Localized "Local Contacts" / "Overseas Contacts" + `.xlsx` |

## Import
| # | Scenario | Expected |
|---|---|---|
| FI1 | Download template (Local/Overseas, per locale) | Correct static template (KM falls back to EN) |
| FI2 | Browse wrong-variant file | Template-signature gate → `settings.upload.template_mismatch` error |
| FI3 | Parse + preflight | Duplicate code / tax id cells painted red, their `apiRequest` nulled |
| FI4 | Resolve recipients (Local) | Recipient cell populated; unknown bank flagged red (`bank_found=false`) |
| FI5 | Upload 10 rows, 1 dup | `POST /excel/import` partial success; success/error dialog from `imported`/`failed`/`errors[0]` |
| FI6 | Upload button enable rule | Disabled when no file, no rows, any error cell, or busy |

## Validation
| # | Scenario | Expected |
|---|---|---|
| FV1 | Missing Contact Code / Name | Inline required error before submit |
| FV2 | Local with no accounts at submit | Zod `superRefine` requires ≥1 account card (UI rule); half-filled card requires bank + acct |
| FV3 | Overseas without beneficiary name | Zod requires `beneficiaryName` |
| FV4 | Duplicate overseas (BIC, account) | Guarded at submit before the API call |
| FV5 | Attachment > 10 MB / bad extension | Client-side error dialog before upload |

## Error handling
| # | Scenario | Expected |
|---|---|---|
| FE-1 | API failure | `useDialog({ type: "error" })` with the envelope code/message |
| FE-2 | 401 | Global Axios interceptor → session-expired re-auth (not per-call) |
| FE-3 | Export failure | Error dialog; no blob saved |
| FE-4 | Backend dup codes on create | Mapped back to inline `msg1` / `msg2` |

## Notes

- The panel uses plain React state (no react-query) — verify the grid refetches after every mutation
  via the refresh key.
- Verify the on-screen grid is the fixed 8-column layout (Checkbox · Contact Code · Contact Name ·
  Location · Tax ID · Deposit Account · Address · kebab) — there is no English-Name / Phone / Email
  column and no View Setting popover for this grid.

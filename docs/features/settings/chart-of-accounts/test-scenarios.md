# Chart of Accounts — Frontend Test Scenarios (SIT / UAT)

UI-level scenarios for the shipped panel. Backend/API scenarios: [../../../../../wecms-api/docs/features/settings/chart-of-accounts/test-scenarios.md](../../../../../wecms-api/docs/features/settings/chart-of-accounts/test-scenarios.md).

---

## 1. Search

| # | Scenario | Expected |
|---|---|---|
| S1 | Search by account code | Child rows matching `accountCode` shown; group row stays if a child matches |
| S2 | Search by account name (EN/VI/KO) | In-memory match across name columns |
| S3 | Search clears | Full tree restored |
| S4 | "Search by status" | No status filter control — verify only keyword search exists (status visible per-row badge) |

## 2. Create

| # | Scenario | Expected |
|---|---|---|
| C1 | Valid create under a parent | Success dialog; row appears in tree; list refetched |
| C2 | Duplicate account code | Error dialog `WBE_CHART_OF_ACCOUNTS_DUPLICATE_CODE` |
| C3 | Invalid parent (deleted/unknown) | Error dialog `WBE_CHART_OF_ACCOUNTS_PARENT_NOT_FOUND` |
| C4 | Blank required field (code / name_en / parent) | Client validation blocks Save |
| C5 | Code > 10 chars | Input capped at 10 (counter) |
| C6 | Calc Rule on non-level-3 parent | Calc Rule dropdown disabled (prospective level ≠ 3) |
| C7 | Self / cyclic / over-depth parent | Parent picker excludes self, descendants, orphans, level-4; backend rejects edge cases via error dialog |

## 3. Update

| # | Scenario | Expected |
|---|---|---|
| U1 | Edit name fields | Success; refetch |
| U2 | Parent change | Success; tree reflows; parent options refreshed |
| U3 | Status change (active↔inactive) | Success; status badge updates (single-row (de)activation route) |
| U4 | Code field in edit mode | Disabled (immutable) |
| U5 | Edit a restricted root (ACC-0x) | Edit/Delete buttons disabled; backend also guards |

## 4. Activation / Deactivation

| # | Scenario | Expected |
|---|---|---|
| A1 | Single activation | Edit row → Status = active → Save |
| A2 | Single deactivation | Edit row → Status = inactive → Save |
| A3 | Bulk deactivation | Select child rows → Deactivate → confirmation → result dialog `{processed, failed}` |
| A4 | Bulk activation | **No Activate button** — confirm absence by design; re-activate via single edit |
| A5 | Selection of restricted root | Not selectable (checkbox absent on group rows) |

## 5. Excel Import

| # | Scenario | Expected |
|---|---|---|
| E1 | Download template (EN/VI/KO) | Correct per-locale .xlsx |
| E2 | Valid import | Preview clean → Upload → success `{created}` → list refetch |
| E3 | Duplicate account code in file | Both rows flagged (`code_duplicate`); Upload disabled |
| E4 | Invalid parent / missing parent | `parent_required` cell error |
| E5 | Invalid hierarchy depth (> 3) | `depth_exceeded` ({max:3}) cell error; Upload disabled |
| E6 | Missing required field (code/name_en) | `code_required` / `name_en_required` cell error |
| E7 | Wrong template / non-xlsx | Template-shape error dialog; state reset |
| E8 | Partial DB-duplicate on upload | Result dialog partial `{created, failed}` |

## 6. Excel Export

| # | Scenario | Expected |
|---|---|---|
| X1 | Look for an export button | **None exists** — confirm only the import-template download is present |

## 7. Validation

| # | Scenario | Expected |
|---|---|---|
| V1 | Parent validation | Picker constrains options; backend errors surface in dialog |
| V2 | Depth validation | FE blocks >3 in import; backend `DEPTH_EXCEEDED` on create/update |
| V3 | Duplicate validation | FE in-file; backend live-code |

## 8. Error handling

| # | Scenario | Expected |
|---|---|---|
| H1 | API failure | Error dialog with `errorCode` + `traceId` (not a banner) |
| H2 | Network 401 | Global session-expired re-auth dialog |
| H3 | Import row errors | Per-cell highlight + tooltip; Upload disabled until clean |
| H4 | Delete confirmation | Bulk delete = red destructive; single delete confirmation shows code+name |

## 9. Shell / a11y

| # | Scenario | Expected |
|---|---|---|
| L1 | Settings modal Esc / X | Closes shell; inline edit drafts discarded |
| L2 | No View Setting popover | Confirm absent (OQ-6) |
| L3 | Restricted rows | Edit/Delete disabled with tooltip; no checkbox |

Cross-link to the audit master SIT checklist: [final parity audit §5](../../../../../wecms-api/docs/audits/chart-of-accounts-final-parity-audit.md).

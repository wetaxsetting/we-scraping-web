# Internal Transfer — Test Scenarios (Frontend)

> **API counterpart:** [wecms-api/.../test-scenarios.md](../../../../../wecms-api/docs/features/payment/internal-transfer/test-scenarios.md) · **Hub:** [README.md](README.md)

Source-code-verified 2026-06-23.

---

## 1. FE test inventory

**No automated frontend test framework is configured** in `wecms-web` (no `vitest`/`jest`/`playwright`/`cypress` dependency; `package.json` scripts are `dev`/`build`/`start`/`lint` only). There are no `*.test.tsx` / `*.spec.tsx` files for Internal Transfer. All FE verification today is **manual / SIT**. Automated FE coverage is an open item.

---

## 2. Manual / SIT scenarios

### Scheduled Transfer list
- Period + manual range + keyword filters reset page 0 and re-fetch.
- Approval-Status dropdown maps to `appr_type`; each tab shows the correct derived status.
- Currency totals footer aggregates the full filtered set (not page slice).
- Server sort + pagination; stable-data latch avoids flicker.
- Transfer chip → `validateBankingTime` pre-flight → confirm → dispatch; success → refetch.
- Delete chip hidden/blocked once `approvalRef` set (server `WBE2062`).

### Upload / create
- Template download per locale (EN/KO/VI).
- Parse shows per-cell red highlights for `err_fld`; header mismatch → `WBE2018`; mixed currency/network → `WBE2120`/`WBE2121`.
- Save Draft requires Title + withdrawal account; success → list refetch + success dialog.

### Scheduled detail
- Master summary + lines render; FileCard downloads original Excel.
- Reporting Account unassigned cell shows "Select Account" with cream highlight.

### Approval (Flow 4)
- Request-Approval dialog submits; Approval-Ref click opens `ApprovalDetailsDialog`.
- Approve / Reject gated to the active approver (`isCurrentUserActiveApprover`); reject is terminal.
- Withdraw returns batch to draft; Change-line resets to pending.

### Transfer Result
- Completed / In Progress checkboxes → `trnf_stts` C/P.
- Detail tabs (All/Success/Failed/In-Progress) counts match backend; per-line chips via `deriveResultStatus.ts`.
- Export streams XLSX.

---

## 3. Missing coverage

| Gap | Note |
|---|---|
| No FE unit/integration test framework | manual/SIT only — automated coverage not set up |
| `deriveResultStatus.ts` chip mapping | no unit test (must stay consistent with backend `countByStatus`) |
| Mapper round-trips (`mapScheduledTransfer*`) | no test |
| Re-submit placeholder | inert kebab — recommend removal; not test-covered |
| Result chips on fresh local DB | degrade to "In Progress" when backend counts empty (documented) |

## Cross-links

[screen-flow.md](screen-flow.md) · [ui-specification.md](ui-specification.md) · [component-index.md](component-index.md) · [api-consumption.md](api-consumption.md)

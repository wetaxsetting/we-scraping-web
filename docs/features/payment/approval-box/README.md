# Approval Box — Frontend Feature (wecms-web)

**Module:** Payment → Approval Management
**Route:** `/payment/approval-box`
**View Setting screen ID:** `SCREEN_IDS.PAYMENT_APPROVAL_BOX` = `approval-box`
**Feature folder:** `components/payment/approval-box/`
**API client:** `lib/api/approval-box.ts`
**JEX counterpart (read-only reference):** `resl_0001_001` (list) · `comm_0195_001` (detail/approve/reject popup)
**Status:** ✅ **Completed** — list with live data, tabs, date-range + keyword filter, header sort, approver popover, Approval Details dialog with approve / reject / withdraw / change-approval-line, deep-link auto-open, View Setting, print, and Excel export all wired against live backend endpoints. Legacy parity verified; SIT/UAT done.

> Consolidated, code-accurate home for the **completed** Approval Box frontend. It supersedes the *status* claim in the old workspace `CLAUDE.md` ("mock data") and the thin design stub [../approval-box.md](../approval-box.md) — the page runs on live data now. The stub is kept as design history and cross-linked below.

---

## What the page does

`/payment/approval-box` is the cross-feature approval inbox. It lists Payment approval documents (Internal Transfer, Vendor, Expense, Payroll, Overseas, Corporate Card), grouped into status tabs, and lets the signed-in approver act on the items where it is their turn.

Capabilities, all wired:

- **List** — server-side date-range filter (preset 30/90/180 days or manual range), keyword search (`srch_wd`), status tabs (`appr_type_cd`), header-click sort, pagination. Tab counts come from the backend.
- **Approver popover** — per-row chip opens an in-table popover showing the full approver chain (line · name · status · action time).
- **Approval Details dialog** — clicking the Document No. opens the shared `ApprovalDetailsDialog`, which lazily loads the per-line transactions from the originating module's detail endpoint and hosts the action footer.
- **Approve / Reject** — shown only when the current user is the pending approver; calls the backend and refetches the list.
- **Withdraw / Change approval line / Re-submit** — kebab actions in the dialog (per-kind dispatch: card vs. non-card endpoints; Re-submit is a placeholder).
- **Deep-link** — `?appr_seq_no=<id>` (from a notification click) auto-opens the dialog and highlights the row.
- **View Setting / Print / Excel** — toolbar icons via the shared popover / `printReport` / `useExcelExport`.

---

## Documents in this folder

| Doc | Focus |
|---|---|
| [screen-flow.md](screen-flow.md) | Page behaviour & user flows: list/filter/sort/tabs/paginate, approver popover, Approval Details dialog open, approve/reject/withdraw/change-line flows, deep-link, loading/empty/error states. |
| [ui-specification.md](ui-specification.md) | Layout, toolbar, tabs, filter row, table columns (View-Setting-driven), status badge + approver status pill rules, footer summary, dialog spec. |
| [component-index.md](component-index.md) | Every component file (active + dead/legacy), the component tree, hooks, shared components, lib helpers. |
| [api-consumption.md](api-consumption.md) | Backend endpoints consumed, API-client functions, wire types, mappers, the `useApprovalBoxList` hook, refetch/refresh behaviour, validation, error handling. |
| [test-scenarios.md](test-scenarios.md) | Frontend test scenarios. |

---

## Related docs (kept in place — cross-references)

- Design-history stub: [../approval-box.md](../approval-box.md)
- Parity fixes (2026-06, current behaviour-delta source of truth): [../../../../../wecms-api/docs/features/payment/approval-box/parity-fixes-2026-06.md](../../../../../wecms-api/docs/features/payment/approval-box/parity-fixes-2026-06.md)
- Page mapping (JEX `_view.jsp` → Next.js route): [../../../references/page-mapping/page-mapping.md](../../../references/page-mapping/page-mapping.md)
- **Backend counterpart:** [../../../../../wecms-api/docs/features/payment/approval-box/README.md](../../../../../wecms-api/docs/features/payment/approval-box/README.md)
  - REST contract: [interface-specification.md](../../../../../wecms-api/docs/features/payment/approval-box/interface-specification.md)
  - Business flow: [business-flow.md](../../../../../wecms-api/docs/features/payment/approval-box/business-flow.md)

> **Approval Box is the approved tabbed-feature-page baseline** (root `CLAUDE.md` → UI Implementation Baseline #2). Mirror this page for any new tabbed list screen.

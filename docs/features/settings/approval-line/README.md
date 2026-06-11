# Settings > Approval Line — Frontend Feature (Refactor)

**Status:** ✅ Wired full-stack — the panel consumes the live `/api/v1/settings/approval-line` API (no mock fallback); approver picker consumes `/api/v1/users`; native HTML5 drag-and-drop reorder implemented (AL-GAP-01 resolved); legacy parity + SIT/UAT verified.
**Menu:** Settings → **Approval Line** (Settings modal panel — **no standalone route**)
**Slug:** `approval-line` (matches the JEX-traceability + backend counterparts)
**Panel key:** `approval_line` · **Menu permission:** `settings-core-approval-line`
**Backend:** `/api/v1/settings/approval-line` (list · detail · create · update · delete)

> This folder is the **primary frontend documentation home** for Approval Line. It consolidates and
> indexes the material previously in the single-file [../approval-line.md](../approval-line.md)
> (preserved, cross-linked). The matching backend docs are at
> [wecms-api/docs/features/settings/approval-line/](../../../../../wecms-api/docs/features/settings/approval-line/README.md).
> The JEX-side spec set lives at [docs/jex/features/approval-line/](../../../../../docs/jex/features/approval-line/README.md).

---

## What this screen is

A per-tenant list of **named, ordered approver chains (1–5 approvers each)**, rendered as a table
inside the Settings modal. The user can search by name, add a line, edit a line (rename + add / remove
/ **drag-reorder** approvers), and delete a line. It renders as a **panel inside `<SettingsModal>`**
(mounted via `<SettingsNav>`) — there is no `/settings/approval-line` URL.

The created line is later attachable to a payment / transfer request (the consumer side snapshots the
approver list — out of this screen's scope). View Setting (column-visibility popover) is **not**
adopted (the panel has no toolbar list-icon button).

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Open → fetch list → grid (with inline chain chip) → add/edit dialog → pick approvers → drag-reorder → validate → save → refetch; delete with confirm |
| [ui-specification.md](ui-specification.md) | Search/filter, grid columns + count chip, Add/Edit dialog, approver picker, **drag-and-drop reorder**, validation, loading/empty/error states, i18n keys, typography tokens |
| [component-index.md](component-index.md) | Component / hook / schema / mapper / API-client / type / i18n file map |
| [api-consumption.md](api-consumption.md) | Endpoints, request/response wire shapes, mappers, error-code → dialog mapping |
| [test-scenarios.md](test-scenarios.md) | SIT/UAT scenarios (search, create, edit, reorder, validation, delete, errors) |

---

## Quick facts

| Aspect | Value |
|---|---|
| Panel | [`<ApprovalLinePanel>`](../../../../components/settings/approval-line/ApprovalLinePanel.tsx) |
| Mount | [`SettingsModal.tsx`](../../../../components/settings/SettingsModal.tsx) (`panel === "approval_line"`) + [`SettingsNav.tsx`](../../../../components/settings/SettingsNav.tsx) (slug `settings-core-approval-line`) |
| Data hooks | `useApprovalLineList(params)` + `useApprovalLineMutations()` ([useApprovalLine.ts](../../../../components/settings/approval-line/useApprovalLine.ts)) — built on the project's `useApiData`; **no React Query** |
| API client | [lib/api/approvalLine.ts](../../../../lib/api/approvalLine.ts) |
| Grid columns | Approval Line Name · Approver name (primary + "+N" count chip) · Create Date · Actions |
| Search / sort | **client-side** over the loaded set (`params` stays empty; endpoint returns the full tenant set) |
| Dialog | one [`<ApprovalLineDialog>`](../../../../components/settings/approval-line/ApprovalLineDialog.tsx) with `mode: "add" \| "update"`; `stackLevel={2}`, `max-w-[880px]` |
| Approver picker | [`<AddApproverPopover>`](../../../../components/settings/approval-line/AddApproverPopover.tsx) — sources tenant users from `fetchTenantUsers` (`/api/v1/users`) |
| Reorder | **native HTML5 drag-and-drop** on approver rows; persisted purely by array order (wire omits `apprvr_disp_ord`; server re-numbers `1..N`) |
| Validation | Zod [schema.ts](../../../../components/settings/approval-line/schema.ts) — name 1..100, approvers 1..5, duplicate-approver `superRefine` |
| Mock data | **none** — fully wired to the real backend |
| View Setting | **not adopted** |
| Wire convention | lowercase snake_case → camelCase mapping in the feature [mappers.ts](../../../../components/settings/approval-line/mappers.ts) |

---

## Related docs

- **Backend feature folder:** [wecms-api/docs/features/settings/approval-line/](../../../../../wecms-api/docs/features/settings/approval-line/README.md)
- **Preserved single-file spec (frontend):** [../approval-line.md](../approval-line.md)
- **JEX legacy spec set (read-only):** [docs/jex/features/approval-line/](../../../../../docs/jex/features/approval-line/README.md)
- **Page mapping:** [references/page-mapping/page-mapping.md](../../../references/page-mapping/page-mapping.md)
- **Settings feature index:** [../README.md](../README.md)

# Approval Line — Screen Flow

User-facing flow for the Settings → Approval Line panel. Backend flow:
[wecms-api/docs/features/settings/approval-line/business-flow.md](../../../../../wecms-api/docs/features/settings/approval-line/business-flow.md).

---

## Entry

Top-nav **Settings** → `<SettingsModal>` opens → `<SettingsNav>` → select **Approval Line** →
`<ApprovalLinePanel>` mounts (`panel === "approval_line"`). No URL change — it is a modal panel.

---

## List / search

```
ApprovalLinePanel mounts
  → useApprovalLineList(params)            params = {} (stable) → fetch fires once on mount
      → fetchApprovalLines({})             GET /api/v1/settings/approval-line
      → rows: ApprovalLineRow[]            each row carries its full approver chain (approvers[])
  → render <ApprovalLineTable>
```

- **Search is client-side.** The search box filters the already-loaded `rows` by
  `apprLineNm.toLowerCase().includes(needle)` — the endpoint returns the whole tenant set, so no
  refetch on keystroke. (The API client *supports* a server `q` param but the panel does not use it.)
- **Sort is client-side** too — `useTableSort()` cycles default → ASC → DESC across `APPR_LINE_NM`,
  `APPRVR_NM` (sorts on `approvers[0].name`), and `REG_DTM`, using an `Intl.Collator`.
- Each grid row shows the line name, the **primary approver** (`approvers[0].name`) plus a `+N` count
  chip when there is more than one approver, the create date (`yyyy-MM-dd`), and Edit / Delete actions.
  Clicking the count chip toggles `<ApproverListPopover>` (a read-only hover card of the full chain).

---

## Add

```
"+ Add Approval line" → <ApprovalLineDialog mode="add">
  → on mount: useApiData(fetchTenantUsers)  GET /api/v1/users  → directory for the picker
  → name input
  → "+ Add Approver" → <AddApproverPopover>  multi-select from directory (minus already-chained)
       → "Add N Approver" appends rows (capped at MAX_APPROVERS - current = remaining capacity)
  → drag-reorder rows (native HTML5 DnD)     # column re-numbers live (index + 1)
  → remove approver (per-row Remove)
  → Save → validateApprovalLine(values)       Zod: name 1..100, approvers 1..5, no duplicate id
       valid → mutations.create(values)        POST /api/v1/settings/approval-line
  → onSuccess: clear dialog, refetch list, success dialog
```

The `approvers[]` array order **is** the approval order — the wire omits `apprvr_disp_ord` and the
server re-numbers `1..N` from array position.

---

## Edit (update)

```
row "Edit" → <ApprovalLineDialog mode="update" apprLineNo loadDetail>
  → on mount: loadDetail(apprLineNo)          GET /api/v1/settings/approval-line/{appr_line_no}
       seeds name + full approver chain (panel row only had the primary + count)
  → same add / remove / drag-reorder / validate as Add
  → Save → mutations.update(apprLineNo, values)   PUT /api/v1/settings/approval-line/{appr_line_no}
  → onSuccess: clear dialog, refetch, success dialog
```

The backend **diff-syncs** the approver set (UPDATE survivors, INSERT new, DELETE removed) and
re-numbers `apprvr_disp_ord` from the submitted array order — so reorder + add + remove all persist in
one PUT. Reopening shows the saved order (read path orders `APPRVR_DISP_ORD ASC`).

---

## Delete

```
row "Delete" → useDialog confirmation (type: "confirmation")
  → onConfirm: mutations.remove(apprLineNo)   DELETE /api/v1/settings/approval-line/{appr_line_no}
  → await refetch → success dialog
  (per-row re-entry guard `deletingNos` keyed by apprLineNo; cleared in finally)
```

Hard delete — no in-use guard. A stale delete (row already removed) surfaces
`WBE_APPROVAL_LINE_NOT_FOUND` via the error dialog.

---

## Error surfacing

All API errors funnel through `useDialog({ type: "error" })`. The panel's `resolveBackendMessage`
maps the backend `WBE_APPROVAL_LINE_*` codes to localized strings; Zod validation errors render inline
in the dialog (per-field) before any request is sent. See
[api-consumption.md §Error mapping](api-consumption.md#error-code--dialog-mapping).

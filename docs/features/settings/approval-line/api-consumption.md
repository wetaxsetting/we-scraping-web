# Approval Line — API Consumption

How the frontend talks to the backend. Backend contract:
[wecms-api/docs/features/settings/approval-line/interface-specification.md](../../../../../wecms-api/docs/features/settings/approval-line/interface-specification.md).
Client: [lib/api/approvalLine.ts](../../../../lib/api/approvalLine.ts).

---

## Endpoints consumed

| Frontend fn | Method · URL | Used by |
|---|---|---|
| `fetchApprovalLines(params)` | `GET /api/v1/settings/approval-line` (query `q` / `sort_field` / `sort_dir`) | `useApprovalLineList` (panel list) |
| `fetchApprovalLine(apprLineNo)` | `GET /api/v1/settings/approval-line/{apprLineNo}` | dialog `loadDetail` (Edit pre-fill) |
| `createApprovalLine(body)` | `POST /api/v1/settings/approval-line` | `useApprovalLineMutations.create` |
| `updateApprovalLine(apprLineNo, body)` | `PUT /api/v1/settings/approval-line/{apprLineNo}` | `useApprovalLineMutations.update` |
| `deleteApprovalLine(apprLineNo)` | `DELETE /api/v1/settings/approval-line/{apprLineNo}` | `useApprovalLineMutations.remove` |
| `fetchTenantUsers()` | `GET /api/v1/users` (separate shared client) | dialog approver picker directory |

All read/write fns route through `unwrap()` which reads the `{ status, data }` envelope and throws
`ApiCallError(code, message)` on `status.error`. `deleteApprovalLine` checks `status.error` directly
(void responses omit `data`). JWT is attached by the `lib/axios` interceptor.

> The panel passes an **empty** `params` (`{}`) — search + sort are applied client-side over the
> loaded set, so the GET fires once on mount. The `q` / `sort_field` / `sort_dir` params exist for a
> future server-side switch but are unused today.

---

## Wire shapes (lib/types/api.ts)

```ts
interface ApiApprovalLineApproverRow {
  apprvr_disp_ord: number;
  apprvr_id: string;
  apprvr_nm: string;
  apprvr_posi: string | null;
  apprvr_dept: string | null;
  user_img_url: string | null;     // slug "/api/v1/users/{id}/image" or null
}

interface ApiApprovalLineRow {
  appr_line_no: number;
  appr_line_nm: string;
  reg_dtm: string;                  // yyyyMMddHHmmss
  approvers: ApiApprovalLineApproverRow[];   // always ordered apprvr_disp_ord ASC
}

interface ApiApprovalLineListResponse {
  total_count: number;
  approval_lines: ApiApprovalLineRow[];
}

interface ApiApprovalLineApproverInput {
  apprvr_id: string;
  apprvr_nm: string;
  apprvr_posi: string | null;
  apprvr_dept: string | null;       // NO apprvr_disp_ord — server assigns 1..N
}

interface ApiApprovalLineCreateRequest {
  appr_line_nm: string;
  approvers: ApiApprovalLineApproverInput[];
}
type ApiApprovalLineUpdateRequest = ApiApprovalLineCreateRequest;
```

The **create/update request omits `apprvr_disp_ord`** — the order of the `approvers` array is the
approval order, and the backend re-numbers `1..N` from array position. This is what makes drag-reorder
persist without a dedicated reorder field/endpoint.

---

## Wire ↔ in-memory mapping (feature `mappers.ts`)

Translation lives in [components/settings/approval-line/mappers.ts](../../../../components/settings/approval-line/mappers.ts)
(the feature folder — **not** `lib/api/mappers.ts`):

```ts
toApproverRow(wire)   → { id: apprvr_id, name: apprvr_nm, position: apprvr_posi ?? "",
                          department: apprvr_dept ?? "", dispOrd: apprvr_disp_ord,
                          userImgUrl: user_img_url ?? undefined }
toApprovalLineRow(w)  → { apprLineNo: appr_line_no, apprLineNm: appr_line_nm,
                          regDtm: reg_dtm, approvers: w.approvers.map(toApproverRow) }
toApproverInput(row)  → { apprvr_id, apprvr_nm, apprvr_posi: position.trim() || null,
                          apprvr_dept: department.trim() || null }
toCreateRequest(v)    → { appr_line_nm: v.apprLineNm.trim(), approvers: v.approvers.map(toApproverInput) }
toUpdateRequest = toCreateRequest
```

Components never read snake_case directly — they consume the camelCase `ApprovalLineRow` / `ApproverRow`.

---

## Error code → dialog mapping

Backend business errors return HTTP 200 with `status.error = true`; the client throws `ApiCallError`
carrying `status.code`. The panel's `resolveBackendMessage` maps the code to a localized string shown
in a `useDialog({ type: "error" })` dialog:

| Backend code | i18n key | EN |
|---|---|---|
| `WBE_APPROVAL_LINE_NOT_FOUND` | `settings.approval_line.error.not_found` | Approval line not found. |
| `WBE_APPROVAL_LINE_TOO_MANY_APPROVERS` | `settings.approval_line.error.too_many_approvers` | Cannot have more than 5 approvers. |
| `WBE_APPROVAL_LINE_DUP_APPROVER` | `settings.approval_line.error.duplicate_approver` | Cannot add the same approver twice. |
| `WBE_APPROVAL_LINE_APPROVER_NOT_IN_TENANT` | `settings.approval_line.error.approver_not_in_tenant` | Approver does not belong to this company. |
| `WBE_APPROVAL_LINE_EMPTY_APPROVERS` | `settings.approval_line.error.empty_approvers` | At least one approver is required. |
| `WBE_APPROVAL_LINE_NAME_BLANK` | `settings.approval_line.error.name_blank` | Approval line name is required. |

Most of these are caught by the Zod schema first (name, count, duplicate, empty) — the backend codes
are the backstop for races / direct-API edge cases. 401 (session expired) is handled by the global
`lib/axios` interceptor, not this feature.

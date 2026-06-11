# Approval Line — Component Index

File map for the frontend feature. Backend mirror:
[wecms-api/docs/features/settings/approval-line/source-code-index.md](../../../../../wecms-api/docs/features/settings/approval-line/source-code-index.md).

---

## Components / hooks / schema / mappers (`components/settings/approval-line/`)

| File | Export | Role |
|---|---|---|
| [ApprovalLinePanel.tsx](../../../../components/settings/approval-line/ApprovalLinePanel.tsx) | `ApprovalLinePanel` | Panel host — search, client-side sort, list, delete-confirm, dialog routing, error mapping |
| [ApprovalLineTable.tsx](../../../../components/settings/approval-line/ApprovalLineTable.tsx) | `ApprovalLineTable` | 3-data-column + actions table; primary-approver + `+N` count chip; `yyyy-MM-dd` date |
| [ApprovalLineDialog.tsx](../../../../components/settings/approval-line/ApprovalLineDialog.tsx) | `ApprovalLineDialog` | Add/Update dialog — name + approver chain + **native HTML5 drag-reorder** + validation |
| [AddApproverPopover.tsx](../../../../components/settings/approval-line/AddApproverPopover.tsx) | `AddApproverPopover` | Multi-select picker from the tenant directory (capacity-capped) |
| [ApproverListPopover.tsx](../../../../components/settings/approval-line/ApproverListPopover.tsx) | `ApproverListPopover` | Read-only hover card listing the full chain (order / avatar / name) |
| [useApprovalLine.ts](../../../../components/settings/approval-line/useApprovalLine.ts) | `useApprovalLineList`, `useApprovalLineMutations` | List fetch (via `useApiData`) + create/update/remove/loadDetail mutations |
| [schema.ts](../../../../components/settings/approval-line/schema.ts) | `approvalLineSchema`, `validateApprovalLine` | Zod validation (name 1..100, approvers 1..5, dup-id `superRefine`); messages are i18n keys |
| [mappers.ts](../../../../components/settings/approval-line/mappers.ts) | `toApproverRow`, `toApprovalLineRow`, `toCreateRequest`, `toUpdateRequest`, `toApproverInput` | wire ↔ in-memory translation (in the **feature folder**, not `lib/api/mappers.ts`) |
| [types.ts](../../../../components/settings/approval-line/types.ts) | `ApprovalLineRow`, `ApprovalLineFormValues` | in-memory row + form types |
| [approver.ts](../../../../components/settings/approval-line/approver.ts) | `ApproverRow`, `MAX_APPROVERS` (= 5) | approver in-memory type + the 5-cap constant |

> **No `mockData.ts` / `APPROVER_POOL`.** The feature is fully wired to the real backend — the panel
> fetches `/api/v1/settings/approval-line` and the dialog's picker fetches `/api/v1/users` via
> `fetchTenantUsers`.

### In-memory type shapes

```ts
// types.ts
type ApprovalLineRow   = { apprLineNo: number; apprLineNm: string; regDtm: string; approvers: ApproverRow[] };
type ApprovalLineFormValues = { apprLineNm: string; approvers: ApproverRow[] };

// approver.ts
type ApproverRow = { id: string; name: string; position: string; department: string; dispOrd?: number; userImgUrl?: string };
const MAX_APPROVERS = 5;
```

---

## API client + wire types (`lib/`)

| File | Contents |
|---|---|
| [lib/api/approvalLine.ts](../../../../lib/api/approvalLine.ts) | `fetchApprovalLines(params)` · `fetchApprovalLine(apprLineNo)` · `createApprovalLine(body)` · `updateApprovalLine(apprLineNo, body)` · `deleteApprovalLine(apprLineNo)` (all over `BASE = "/api/v1/settings/approval-line"`; `unwrap()` envelope handling; `ApiCallError`) |
| [lib/types/api.ts](../../../../lib/types/api.ts) | `ApiApprovalLineRow` · `ApiApprovalLineApproverRow` · `ApiApprovalLineListResponse` · `ApiApprovalLineApproverInput` · `ApiApprovalLineCreateRequest` · `ApiApprovalLineUpdateRequest` |
| [lib/api/useApiData.ts](../../../../lib/api/useApiData.ts) | shared fetch hook used by the list hook + the dialog's directory query |

> The approver-picker directory comes from `fetchTenantUsers` (the shared `/api/v1/users` client) —
> mapped to `ApproverRow` by a small `toApproverRow(ApiTenantUserRow)` helper local to the dialog,
> distinct from the wire `toApproverRow` in `mappers.ts`.

---

## Settings shell wiring

| File | Role |
|---|---|
| [components/settings/SettingsNav.tsx](../../../../components/settings/SettingsNav.tsx) | nav entry `{ key: "approval_line", labelKey: "settings.nav.approval_line", … }`; panel slug `settings-core-approval-line` |
| [components/settings/SettingsModal.tsx](../../../../components/settings/SettingsModal.tsx) | mounts `<ApprovalLinePanel>` when `panel === "approval_line"` |

---

## i18n

`settings.approval_line.*` + `settings.nav.approval_line` in
[locales/en.json](../../../../locales/en.json) · [ko.json](../../../../locales/ko.json) ·
[vi.json](../../../../locales/vi.json). Full key list:
[ui-specification.md §8](ui-specification.md#8-i18n-keys).

---

## Shared primitives reused (not rebuilt)

`<SettingsModal>` / `<SettingsNav>` shell · shadcn `<Dialog>` (feature-dialog rhythm) ·
`<Checkbox>` / `<Input>` (picker + name) · `useDialog()` system dialog (confirm / success / error) ·
`useApiData` · `useTableSort` · `lib/axios` `api` · `lib/i18n` `useTranslation` · `lucide-react`
(`Pencil` / `Trash2` / `ChevronDown` / `GripVertical`).

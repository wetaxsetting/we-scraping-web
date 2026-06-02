# Approval Line — Frontend Design (Next.js)

| Field | Value |
|---|---|
| Slug | `approval-line` |
| Feature folder | [`wecms-web/components/settings/approval-line/`](../../../components/settings/approval-line/) |
| Feature spec | [docs/refactor-wecms/features/approval/approval-line.md](approval-line.md) |
| Backend design | approval-line.md _(wecms-api backend repo — not included in this clone)_ |

This document is the wire-up blueprint for `wecms-web`. The static UI (panel + dialog + popover + table) is **already shipped** — this MR replaces the mocks with real API calls and locks in the wire types. **No new visual components.**

---

## 1. Route surface

**No new route added.** Approval Line is a Settings panel — it renders inside `<SettingsModal>` and is reached via the global header's Settings icon. The relevant route surface:

| Route | Renders | Source |
|---|---|---|
| Any authenticated route — e.g. `/banking/account-inquiry` | The global header's Settings icon opens `<SettingsModal>` | [`components/layout/Header.tsx`](../../../components/layout/Header.tsx) |
| Inside the modal | `<SettingsNav>` left rail switches between settings panels | [`components/settings/SettingsNav.tsx`](../../../components/settings/SettingsNav.tsx) |
| Selecting "Approval Line" in the nav | `<ApprovalLinePanel>` | [`components/settings/approval-line/ApprovalLinePanel.tsx`](../../../components/settings/approval-line/ApprovalLinePanel.tsx) |

The Settings nav entry already exists and is wired to render the panel. No App Router page file changes.

> **Slug rule.** The feature folder under `components/settings/approval-line/` matches the kebab-case slug `approval-line` — never `comm_0222`, never `approvalLine`, never `ApprLine`. Per [`wecms-web/CLAUDE.md` § Routing](../../../CLAUDE.md) and the workspace [`CLAUDE.md`](../../../CLAUDE.md) Refactor Identifier Naming rules.

---

## 2. Server vs client components

Every component in `components/settings/approval-line/` is a **client component** (`"use client"` at the top). This matches the rest of `wecms-web` (per [`wecms-web/CLAUDE.md` § Coding Rules](../../../CLAUDE.md) — "Current codebase is effectively all-client"). The Settings modal manages its own state, and the data hooks live client-side via `useApiData`.

No SSR, no Next.js API routes, no server actions.

---

## 3. Component tree (final, post-wire-up)

```
<ApprovalLinePanel>                         components/settings/approval-line/ApprovalLinePanel.tsx
├── <SearchInput>                            (inline, lucide Search icon + <Input>)
├── "+ Add Approval line" <button>           (brand-blue, opens dialog mode="add")
├── <ApprovalLineTable>                      components/settings/approval-line/ApprovalLineTable.tsx
│   ├── thead — Name · Approver · Create Date · Action
│   └── tbody rows
│       ├── name cell                          (text-base font-medium)
│       ├── approver cell + count chip          (renders row.approvers[0].apprvrNm + chip if approvers.length > 1)
│       ├── createDate cell                     (regDtm formatted client-side via i18n date util)
│       └── row Edit / Delete kebab menu
└── conditional <ApprovalLineDialog>          components/settings/approval-line/ApprovalLineDialog.tsx
    ├── mode="add" — empty
    ├── mode="update" — fetched via getApprovalLine(apprLineNo)
    ├── name <Input>
    ├── approver chain table (1..5 rows)
    │   ├── row N — "{disp_ord} | {name} | {position} | {department} | Remove"
    │   └── reorder handles (drag) [static-UI ships this; verify with Figma]
    └── conditional <AddApproverPopover>     components/settings/approval-line/AddApproverPopover.tsx
        ├── search <Input>
        ├── selection rows (Checkbox per directory user)
        └── "Add N Approver" button → onAdd
```

All four components already exist; the MR's job is wiring, not building.

---

## 4. State, hooks, data flow

### 4.1 List query

`<ApprovalLinePanel>` replaces its `mockApprovalLineRows` import with:

```ts
import { useApiData } from "@/lib/api/useApiData";
import { fetchApprovalLines } from "@/lib/api/approvalLine";

const { data, error, isLoading, refetch } =
    useApiData(fetchApprovalLines, []);

const filteredRows = useMemo(() => {
    if (!data) return [];
    const needle = keyword.trim().toLowerCase();
    if (!needle) return data;
    return data.filter(row => row.apprLineNm.toLowerCase().includes(needle));
}, [data, keyword]);
```

**Client-side search** stays — matches the static UI today and the feature spec § 4.3 (no pagination). Server-side `q` is supported by the API but the panel doesn't use it; we don't double-filter (one source of truth). If the row count ever spikes, flip to server-side search by passing `keyword` into the hook's deps array and letting the API filter.

### 4.2 Detail pre-fill for the Edit dialog

The panel row only carries the primary approver's name (and a count chip). The Edit dialog needs the full approver chain — fetched on dialog mount:

```ts
// inside <ApprovalLineDialog>, mode === "update"
const { data: line, isLoading } = useApiData(
    () => getApprovalLine(props.apprLineNo),
    [props.apprLineNo]
);
```

While loading, the dialog renders a skeleton (or a single spinner row in the approver table). The static UI doesn't currently have this state — Phase 3 adds it.

The current `seedApproversFromRow(row)` helper at [`ApprovalLinePanel.tsx:23`](../../../components/settings/approval-line/ApprovalLinePanel.tsx) (which seeds a 1-row chain from the panel row) is **removed** — the dialog owns its own fetch.

### 4.3 Approver picker source

`<AddApproverPopover>` replaces its `APPROVER_POOL` static import with:

```ts
import { fetchTenantUsers } from "@/lib/api/users";   // shipped in a sibling MR — see backend doc § 8

const { data: directory } = useApiData(fetchTenantUsers, []);

const available = useMemo(() => {
    if (!directory) return [];
    return directory.filter(u => !selectedIds.has(u.apprvrId));
}, [directory, selectedIds]);
```

If the tenant-users endpoint is not ready when this MR lands, fall back to `APPROVER_POOL` and document it in the MR description (see backend doc § 8).

### 4.4 Mutation hooks

No new "mutation hook" library. Each dialog onSubmit calls the API client directly + handles outcomes via the system dialog:

```ts
// inside ApprovalLineDialog, mode === "add"
async function handleSave(values: FormValues) {
    try {
        await createApprovalLine({
            apprLineNm: values.name.trim(),
            approvers: values.approvers.map((a, i) => ({
                apprvrId:   a.id,
                apprvrNm:   a.name,
                apprvrPosi: a.position,
                apprvrDept: a.department,
            })),
        });
        onSuccess();                       // panel handler — invalidates list + shows success toast
        onClose();
    } catch (err) {
        dialog.open({
            type:        "error",
            title:       t("dialog.error"),
            description: toMessage(err),    // resolves ApiCallError → user-facing string
            errorCode:   toCode(err),       // surfaces WBE_APPROVAL_LINE_* / WBE_VALIDATION codes
            traceId:     toTraceId(err),
        });
    }
}
```

The panel's `onSuccess` triggers `refetch()` on the list and surfaces a success system dialog:

```ts
dialog.open({
    type: "success",
    title: t("dialog.success"),
    description: t("settings.approval_line.save.success"),
});
```

Delete follows the same pattern but is gated by a confirmation dialog first:

```ts
function handleDelete(row: ApprovalLineRow) {
    dialog.open({
        type:        "confirmation",
        title:       t("dialog.confirmation"),
        description: t("settings.approval_line.delete.confirm_body", { name: row.apprLineNm }),
        confirmText: t("dialog.continue"),
        cancelText:  t("dialog.cancel"),
        onConfirm:   async () => {
            try {
                await deleteApprovalLine(row.apprLineNo);
                await refetch();
                dialog.open({ type: "success", title: t("dialog.success"),
                              description: t("settings.approval_line.delete.success") });
            } catch (err) {
                dialog.open({ type: "error", /* … */ });
            }
        },
    });
}
```

**No `destructive: true`** on the delete confirmation — the Figma uses the standard blue Continue per [`wecms-web/CLAUDE.md` § Dialog buttons](../../../CLAUDE.md).

---

## 5. API client functions

New file: [`lib/api/approvalLine.ts`](../../../lib/api/approvalLine.ts) (to be created).

```ts
import { api } from "@/lib/axios";
import type {
    ApiApprovalLineRow,
    ApiApprovalLineListResponse,
    ApiApprovalLineCreateRequest,
    ApiApprovalLineUpdateRequest,
    ApiResponse,
} from "@/lib/types/api";
import { mapApprovalLineRow } from "@/lib/api/mappers";
import type { ApprovalLineRow } from "@/components/settings/approval-line/types";

export async function fetchApprovalLines(
    query?: { q?: string; sortField?: string; sortDir?: "ASC" | "DESC" }
): Promise<ApprovalLineRow[]> {
    const res = await api.get<ApiResponse<ApiApprovalLineListResponse>>(
        "/api/v1/settings/approval-line",
        { params: {
            q:          query?.q,
            sort_field: query?.sortField,
            sort_dir:   query?.sortDir,
        } }
    );
    return (res.data.data?.approval_lines ?? []).map(mapApprovalLineRow);
}

export async function getApprovalLine(apprLineNo: number): Promise<ApprovalLineRow> {
    const res = await api.get<ApiResponse<ApiApprovalLineRow>>(
        `/api/v1/settings/approval-line/${apprLineNo}`
    );
    if (!res.data.data) throw toApiCallError(res.data);
    return mapApprovalLineRow(res.data.data);
}

export async function createApprovalLine(req: CreateInput): Promise<ApprovalLineRow> {
    const body: ApiApprovalLineCreateRequest = {
        appr_line_nm: req.apprLineNm,
        approvers: req.approvers.map(a => ({
            apprvr_id:   a.apprvrId,
            apprvr_nm:   a.apprvrNm,
            apprvr_posi: a.apprvrPosi,
            apprvr_dept: a.apprvrDept,
        })),
    };
    const res = await api.post<ApiResponse<ApiApprovalLineRow>>(
        "/api/v1/settings/approval-line", body
    );
    return mapApprovalLineRow(res.data.data!);
}

export async function updateApprovalLine(apprLineNo: number, req: UpdateInput): Promise<ApprovalLineRow> { /* same shape */ }
export async function deleteApprovalLine(apprLineNo: number): Promise<void> {
    await api.delete(`/api/v1/settings/approval-line/${apprLineNo}`);
}
```

Notes:

- All wire fields use **lowercase snake_case** matching the backend (per [`wecms-web/CLAUDE.md` § Naming convention](../../../CLAUDE.md) layer 1).
- Translation to camelCase happens **exactly once** at the boundary, inside `mapApprovalLineRow`. Component code never reads `row.appr_line_nm` directly.

---

## 6. Wire types — [`lib/types/api.ts`](../../../lib/types/api.ts) additions

```ts
export interface ApiApprovalLineApproverRow {
    apprvr_disp_ord: number;
    apprvr_id:       string;
    apprvr_nm:       string;
    apprvr_posi:     string;
    apprvr_dept:     string;
    user_img_url:    string | null;
}

export interface ApiApprovalLineRow {
    appr_line_no: number;
    appr_line_nm: string;
    reg_dtm:      string;
    approvers:    ApiApprovalLineApproverRow[];
}

export interface ApiApprovalLineListResponse {
    total_count:    number;
    approval_lines: ApiApprovalLineRow[];
}

export interface ApiApprovalLineApproverInput {
    apprvr_id:   string;
    apprvr_nm:   string;
    apprvr_posi: string;
    apprvr_dept: string;
}

export interface ApiApprovalLineCreateRequest {
    appr_line_nm: string;
    approvers:    ApiApprovalLineApproverInput[];
}
export type ApiApprovalLineUpdateRequest = ApiApprovalLineCreateRequest;
```

---

## 7. Mappers — [`lib/api/mappers.ts`](../../../lib/api/mappers.ts) additions

```ts
import type {
    ApiApprovalLineRow, ApiApprovalLineApproverRow,
} from "@/lib/types/api";
import type {
    ApprovalLineRow, ApproverRow,
} from "@/components/settings/approval-line/types";

export function mapApprovalLineRow(wire: ApiApprovalLineRow): ApprovalLineRow {
    return {
        apprLineNo: wire.appr_line_no,
        apprLineNm: wire.appr_line_nm,
        regDtm:     wire.reg_dtm,
        approvers:  wire.approvers.map(mapApprovalLineApprover),
    };
}

export function mapApprovalLineApprover(wire: ApiApprovalLineApproverRow): ApproverRow {
    return {
        id:         wire.apprvr_id,
        name:       wire.apprvr_nm,
        position:   wire.apprvr_posi,
        department: wire.apprvr_dept,
        dispOrd:    wire.apprvr_disp_ord,
        userImgUrl: wire.user_img_url ?? undefined,
    };
}
```

---

## 8. In-memory types — [`components/settings/approval-line/types.ts`](../../../components/settings/approval-line/types.ts) extension

Existing static-UI type:

```ts
export type ApprovalLineRow = {
    id: string;
    name: string;
    approverName: string;
    approverCount?: number;
    createDate: string;
};
```

Extended for the real API (additive — keeps backward compatibility with any code that still references the static shape; refactor away the old fields in this same MR):

```ts
import type { ApproverRow } from "./approverMockData";    // re-uses the existing ApproverRow

export type ApprovalLineRow = {
    apprLineNo: number;                                    // surrogate id (replaces string `id`)
    apprLineNm: string;                                    // replaces `name`
    regDtm:     string;                                    // yyyyMMddHHmmss raw — UI formats on render
    approvers:  ApproverRow[];                             // full chain — table renders primary + count chip
};

// ApproverRow stays in approverMockData.ts; extended with two optional fields for parity with the API:
export type ApproverRow = {
    id:         string;            // === apprvr_id
    name:       string;            // === apprvr_nm
    position:   string;            // === apprvr_posi
    department: string;            // === apprvr_dept
    dispOrd?:   number;            // === apprvr_disp_ord — optional in-memory; required by API mapper
    userImgUrl?: string;           // === user_img_url — optional, frontend falls back to <Avatar>
};
```

The `<ApprovalLineTable>` derives the primary name + chip count from `row.approvers[0].name` + `row.approvers.length - 1`. The `approverName` + `approverCount` fields are removed.

---

## 9. Shared components to reuse — do NOT rebuild

| Shared component | Import | Role |
|---|---|---|
| [`<Input>`](../../../components/ui/input.tsx) | shadcn primitive | search field + dialog name field |
| [`<Checkbox>`](../../../components/ui/checkbox.tsx) | shadcn primitive | popover row selection |
| `<Dialog>` (shadcn) — wrapped by the existing `ApprovalLineDialog` | feature dialog rhythm (`<DialogHeader>` / `<DialogBody>` / `<DialogFooter>`) per [`wecms-web/CLAUDE.md` § 3a](../../../CLAUDE.md) | Add / Edit dialog shell |
| `useDialog()` system dialog | [`components/shared/dialog/`](../../../components/shared/dialog/) | confirmation / success / error / warning |
| [`<Logo>`](../../../components/shared/Logo.tsx) | — | not used here |
| [`<SearchInput>`](../../../components/shared/SearchInput.tsx) | — | the panel today uses a bare `<Input>` with a Search icon inline (Figma-driven); confirm at Phase 3 whether to consolidate onto `<SearchInput>`. **Do not switch unilaterally** — keeping the bare layout is fine if the Figma matches. |
| `useApiData` hook | [`lib/api/useApiData.ts`](../../../lib/api/useApiData.ts) | list + detail fetches |
| `api` axios instance | [`lib/axios.ts`](../../../lib/axios.ts) | HTTP client + JWT interceptor |
| [`useTranslation`](../../../lib/i18n/LocaleProvider.tsx) | in-house i18n | all user-facing strings |
| `cn(...)` | [`lib/utils.ts`](../../../lib/utils.ts) | class composition |

**Forbidden in this MR** (per [`wecms-web/CLAUDE.md`](../../../CLAUDE.md)):

- New UI library, new icon library, new form library.
- New table primitive (the static-UI table is bare `<table>` + `<colgroup>` — keep that pattern).
- Inline `style={{ ... }}` for anything Tailwind can express.
- Raw `text-[14.5px]` / `font-[533]` / hardcoded font-family strings.

---

## 10. Typography token usage

Per the workspace [`CLAUDE.md` § Global Typography](../../../CLAUDE.md), every text surface uses semantic Tailwind tokens or `text-wb-*` brand utilities. **No raw px sizes.**

| Surface | Token / utility | Equivalent |
|---|---|---|
| Panel title — "Approval Line" | `text-wb-18 font-semibold tracking-wb-tight text-wb-dark` (already wired at [`ApprovalLinePanel.tsx:81`](../../../components/settings/approval-line/ApprovalLinePanel.tsx)) | `text-xl font-medium` per the global tokens table (page-title slot) |
| Panel description | `text-wb-13 font-normal text-wb-muted` (already wired at [`ApprovalLinePanel.tsx:84`](../../../components/settings/approval-line/ApprovalLinePanel.tsx)) | `text-base font-normal` (body slot) |
| Search input + Add button | `text-wb-14-tight font-medium` | `text-md font-medium` (matches Figma 14px / 500) |
| Table header | `text-wb-13 font-semibold text-wb-dark` | `text-base font-semibold` (table-header slot) |
| Table body cells | `text-wb-13 font-normal` | `text-base font-normal` (table-cell slot) |
| Dialog title | `text-wb-18 font-semibold` | page-title slot |
| Dialog field labels | `text-wb-13 font-medium` | body-medium |
| Popover row name | `text-wb-13 font-normal` | body slot |
| Popover "Add N Approver" CTA | `text-wb-13 font-medium` (matches table-cell button rhythm) | button slot |

**Never** introduce a new `font-family` declaration anywhere — Inter + Noto Sans KR is attached globally via `next/font/google` at [`app/layout.tsx`](../../../app/layout.tsx). No `<link>`, no second `next/font/google` call.

**Never** use `tracking-wb-tight` outside the page-title surface — it's a brand token reserved for headings. The body surface uses the default Tailwind tracking (already `letter-spacing: -0.03em` via `--font-sans` defaults).

---

## 11. View Setting integration

**Not adopted in MVP.** See feature § 11. The Approval Line list panel has no toolbar list-icon button; no `ViewSettingPopover` instance is mounted, and no `WEB_SVC_ID` is registered. The Settings nav entry stays at the kebab-case slug `"approval-line"` (already correct in [`SettingsNav.tsx`](../../../components/settings/SettingsNav.tsx)).

If/when adopted in a follow-up MR:

- Register the screen in [`wecms-web/lib/viewSettingScreens.ts`](../../../lib/viewSettingScreens.ts) with `id: "approval-line"`, `defaultDymAreaId: "default"`.
- Mount `<ViewSettingPopover screenId="approval-line" dymAreaId="default" />` in the panel filter row.
- **Never** register the screen as `comm_0222_001` — the View Setting screen-id surface is slug-based per [`wecms-web/CLAUDE.md` § 13](../../../CLAUDE.md) and the workspace [`CLAUDE.md`](../../../CLAUDE.md) Refactor identifier naming rule.

---

## 12. i18n keys — additions to [`locales/en.json`](../../../locales/en.json) (+ `ko.json`, `vi.json`)

All keys live under the `settings.approval_line.*` prefix (the slug, snake_case for compatibility with the in-house dot-key resolver). KM omitted per workspace policy.

```json
{
  "settings": {
    "approval_line": {
      "title": "Approval Line",
      "description": "Set up the chain of approvers for payment and transfer requests.",
      "search_placeholder": "Search by name",
      "add": "+ Add Approval Line",

      "column": {
        "name":        "Name",
        "approver":    "Approver",
        "create_date": "Create Date",
        "action":      "Action"
      },

      "row": {
        "edit":   "Edit",
        "delete": "Delete"
      },

      "dialog": {
        "add_title":           "Add Approval Line",
        "edit_title":          "Edit Approval Line",
        "name_label":          "Name",
        "name_placeholder":    "Enter approval line name",
        "approver_chain":      "Approvers (max 5)",
        "add_approver":        "+ Add Approver"
      },

      "popover": {
        "search_placeholder": "Search approvers",
        "empty":              "No matching approvers",
        "selected_count":     "{n} of {N} selected",
        "clear_all":          "Clear all",
        "add_button":         "Add {n} Approver"
      },

      "empty":  "No approval lines configured.",
      "delete": {
        "confirm_body": "Are you sure you want to delete \"{name}\"?",
        "success":      "Approval line deleted."
      },
      "save": {
        "success": "Approval line saved."
      }
    }
  }
}
```

Locale parity:

- `ko.json` — translate all keys above. Use the existing in-product Korean voice for adjacent surfaces (`settings.firm_banking_settings.*`, `settings.contacts.*`) as the tone reference.
- `vi.json` — translate all. Tone reference: `settings.purpose.*`.
- `km.json` — **do not add** (workspace policy — no KM translations on the refactor side).

---

## 13. Error rendering contract

Every API error funnels through `useDialog()` with `type: "error"` per [`wecms-web/CLAUDE.md` § Dialog variant](../../../CLAUDE.md). The dialog title is the **shared `t("dialog.error")` key** — never module-specific.

| Backend code | Frontend message (resolved via `messages_*.properties` round-trip) | UI surface |
|---|---|---|
| `WBE_APPROVAL_LINE_TOO_MANY_APPROVERS` | "Approval line cannot have more than 5 approvers." | system dialog `type="error"` |
| `WBE_APPROVAL_LINE_DUP_APPROVER` | "Approval line cannot have the same approver more than once." | same |
| `WBE_APPROVAL_LINE_APPROVER_NOT_IN_TENANT` | "Approver does not belong to the current company." | same |
| `WBE_APPROVAL_LINE_NAME_BLANK` | "Approval line name is required." | same (in practice, caught by Zod first — see § 14) |
| `WBE_APPROVAL_LINE_EMPTY_APPROVERS` | "Approval line must have at least one approver." | same |
| `WBE_APPROVAL_LINE_NOT_FOUND` | "Approval line not found." | same — triggered on stale edit / delete after another user deleted the line |
| `WBE_VALIDATION` | "Validation failed." (fallback — Zod should catch first) | same |
| Network failure (`WBE_NETWORK` from `lib/auth/client.ts` funnel) | "Network error. Please try again." | same |

**Never** render a green-icon dialog for an error. **Never** title a delete-confirmation dialog "Approval Line — Delete" — title is `t("dialog.confirmation")`; the body carries the contextual message.

---

## 14. Form validation — Zod schema

Add `components/settings/approval-line/approvalLineSchema.ts` (new file):

```ts
import { z } from "zod";

export const approverInputSchema = z.object({
    apprvrId:   z.string().min(1).max(100),
    apprvrNm:   z.string().min(1).max(100),
    apprvrPosi: z.string().max(100).default(""),
    apprvrDept: z.string().max(100).default(""),
});

export const approvalLineFormSchema = z.object({
    apprLineNm: z.string()
        .trim()
        .min(1, "settings.approval_line.dialog.name_required")
        .max(100, "settings.approval_line.dialog.name_too_long"),
    approvers:  z.array(approverInputSchema)
        .min(1, "settings.approval_line.dialog.approver_required")
        .max(5, "settings.approval_line.dialog.approver_too_many"),
}).superRefine((value, ctx) => {
    // Duplicate apprvr_id guard — must match backend WBE_APPROVAL_LINE_DUP_APPROVER
    const seen = new Set<string>();
    value.approvers.forEach((a, i) => {
        if (seen.has(a.apprvrId)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["approvers", i, "apprvrId"],
                message: "settings.approval_line.dialog.approver_duplicate",
            });
        }
        seen.add(a.apprvrId);
    });
});

export type ApprovalLineFormValues = z.infer<typeof approvalLineFormSchema>;
```

Notes:

- Messages are **translation keys**, not literal strings — per [`wecms-web/CLAUDE.md` § Coding Rules](../../../CLAUDE.md) ("Translation keys live in the Zod message"). The dialog runs `t(key)` when surfacing the error.
- Duplicate-approver guard fires client-side; backend re-checks (`WBE_APPROVAL_LINE_DUP_APPROVER`) and the dialog renders that code via § 13 if it somehow slips through (concurrent edit).
- Add the corresponding translation keys to all locales:
  - `settings.approval_line.dialog.name_required`
  - `settings.approval_line.dialog.name_too_long`
  - `settings.approval_line.dialog.approver_required`
  - `settings.approval_line.dialog.approver_too_many`
  - `settings.approval_line.dialog.approver_duplicate`

---

## 15. Files modified or created (Phase 3 checklist)

| File | Status | What changes |
|---|---|---|
| [`lib/types/api.ts`](../../../lib/types/api.ts) | modified | Add `ApiApprovalLineRow`, `ApiApprovalLineApproverRow`, `ApiApprovalLineListResponse`, `ApiApprovalLineCreateRequest`, `ApiApprovalLineUpdateRequest`, `ApiApprovalLineApproverInput`. |
| `lib/api/approvalLine.ts` | **NEW** | `fetchApprovalLines`, `getApprovalLine`, `createApprovalLine`, `updateApprovalLine`, `deleteApprovalLine`. |
| [`lib/api/mappers.ts`](../../../lib/api/mappers.ts) | modified | Add `mapApprovalLineRow`, `mapApprovalLineApprover`. |
| `lib/api/users.ts` | **NEW** *(sibling MR — see backend doc § 8)* | `fetchTenantUsers()` for the approver picker. May land before this MR. |
| [`components/settings/approval-line/types.ts`](../../../components/settings/approval-line/types.ts) | modified | Extend `ApprovalLineRow` per § 8 — drop static-UI fields, add `apprLineNo` / `apprLineNm` / `regDtm` / `approvers[]`. |
| `approverMockData.ts` (removed Sprint 1 — Needs Confirmation if still referenced) | modified | Keep `MAX_APPROVERS = 5` and `ApproverRow` type. Extend `ApproverRow` with `dispOrd?` and `userImgUrl?`. Demote `APPROVER_POOL` to offline-dev affordance only. |
| `mockData.ts` (removed Sprint 1 — Needs Confirmation if still referenced) | modified | Demote to offline-dev only. |
| [`components/settings/approval-line/ApprovalLinePanel.tsx`](../../../components/settings/approval-line/ApprovalLinePanel.tsx) | modified | Replace mock import with `useApiData(fetchApprovalLines)`. Wire delete confirmation + dialog onSuccess to `refetch()`. Drop `seedApproversFromRow`. |
| [`components/settings/approval-line/ApprovalLineTable.tsx`](../../../components/settings/approval-line/ApprovalLineTable.tsx) | modified | Render `row.approvers[0].name` + chip-count from `row.approvers.length`. Accept `onDelete` prop. Format `regDtm` (yyyyMMddHHmmss) via a date util on render. |
| [`components/settings/approval-line/ApprovalLineDialog.tsx`](../../../components/settings/approval-line/ApprovalLineDialog.tsx) | modified | Fetch detail on `mode="update"` mount; wire onSubmit to `createApprovalLine` / `updateApprovalLine`; apply Zod schema. |
| [`components/settings/approval-line/AddApproverPopover.tsx`](../../../components/settings/approval-line/AddApproverPopover.tsx) | modified | Replace `APPROVER_POOL` static import with `useApiData(fetchTenantUsers)`. Filter by `selectedIds`. |
| `components/settings/approval-line/approvalLineSchema.ts` | **NEW** | Zod schema per § 14. |
| [`locales/en.json`](../../../locales/en.json) | modified | Add `settings.approval_line.*` keys per § 12. |
| [`locales/ko.json`](../../../locales/ko.json) | modified | Same keys, Korean translation. |
| [`locales/vi.json`](../../../locales/vi.json) | modified | Same keys, Vietnamese translation. |

**Not changed:** `app/(dashboard)/layout.tsx`, `lib/routes.ts`, `lib/axios.ts`, any other feature folder. The Approval Line MR is contained to the eight component files + the four `lib/` files + three locale files above.

---

## 16. Manual test plan (Phase 3 verification)

Smoke tests after wire-up, against a local backend with the V{N} migrations applied + a seeded user in `USER_BUSI_CONN_INFM` for the current tenant:

1. **Open Settings → Approval Line.** Panel renders, list shows whatever V{N} seeded (probably empty for local DB).
2. **Add — happy path.** Click "+ Add Approval line". Type a name. Click "+ Add Approver" → pick 2 users from the popover. Save. Dialog closes, list refreshes, the new row shows with the primary approver name + "+1" chip.
3. **Add — 6 approvers.** Try to add a 6th — popover should still allow selection (popover doesn't enforce) but the dialog's Zod schema rejects on Save with `WBE_APPROVAL_LINE_TOO_MANY_APPROVERS` (or the local Zod message).
4. **Add — duplicate approver.** Try to submit the same `apprvrId` twice. Zod rejects.
5. **Add — empty name.** Submit with blank name. Zod rejects.
6. **Edit.** Click Edit on a row. Dialog fetches `getApprovalLine` and shows the full chain (not just the seed). Rename + remove one approver + add another. Save. List refreshes; row reflects changes.
7. **Edit — disp_ord re-numbering.** Reorder approvers via drag. Save. Open Edit again — confirm the order is preserved 1..N.
8. **Delete.** Click Delete on a row. Confirmation dialog appears with the line name interpolated. Confirm. Row disappears.
9. **Delete — not found (race).** Open two browser tabs. Delete the same row in tab A, then attempt to delete in tab B — system dialog surfaces `WBE_APPROVAL_LINE_NOT_FOUND`.
10. **Search.** Type into the search input — list filters in-place.
11. **Network error.** Stop the backend mid-Add. Save → error dialog with `trace_id` shown (the local `LOCL` id is fine).
12. **Locale switch.** Switch the language (via profile dropdown). Every Approval Line surface re-renders in the new locale.

For UI-correctness verification, run the dev server (`npm run dev` in `wecms-web/`) and exercise the flows manually per [`wecms-web/CLAUDE.md`](../../../CLAUDE.md) ("For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete").

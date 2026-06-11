# Purpose Settings — Next.js frontend design

> **Primary documentation home moved to [purpose/](purpose/README.md)** (feature folder — README,
> screen-flow, ui-specification, component-index, api-consumption, test-scenarios). **This file is
> preserved as the deep design narrative** and remains authoritative for the static-UI design
> rationale. The feature folder reflects the **as-built, live-wired** state (panel now consumes the
> real `purpose-settings` API — no mock fallback in normal operation).

**Refactor slug:** `purpose-settings`
**Sibling docs:** [feature spec](purpose.md) · JEX → Spring mapping _(wecms-api backend repo — not included in this clone)_ · backend design _(wecms-api backend repo — not included in this clone)_ · [DB schema](purpose.md) · task plan _(wecms-api backend repo — not included in this clone)_.
**Static UI status:** Already shipped — [`<PurposePanel>`](../../../components/settings/purpose/PurposePanel.tsx) + child components ([PurposeTable](../../../components/settings/purpose/PurposeTable.tsx), [PurposeRow](../../../components/settings/purpose/PurposeRow.tsx), [PurposeFormRow](../../../components/settings/purpose/PurposeFormRow.tsx), [PurposeTableColumns](../../../components/settings/purpose/PurposeTableColumns.tsx), [RowActions](../../../components/settings/purpose/RowActions.tsx), [ExcelUploadDialog](../../../components/settings/purpose/ExcelUploadDialog.tsx)) are wired with `mockPurposeTree` in [mockData.ts](../../../components/settings/purpose/mockData.ts). Phase 3 swaps mock for live API.
**Figma source:** 9438:19204 (read-only state) + 9448:19960 (inline add / edit). The Purpose panel is the approved **Settings modal baseline** ([wecms-web/CLAUDE.md §UI Implementation Baseline](../../../CLAUDE.md)).

This document is the Phase 3 frontend wiring contract. No TS code in Phase 1.

> Per memory `feedback_figma_first.md`: if a new Figma URL is provided that changes any state covered here (error state, loading skeleton, search input, etc.), call `get_design_context` + `get_screenshot` BEFORE editing this doc.

---

## 1. Route + placement

**No new route.** The Purpose panel mounts inside the existing [`<SettingsModal>`](../../../components/settings/SettingsModal.tsx) shell — the Settings modal opens from the top-nav Settings entry; `<SettingsNav>` already lists "Purpose" and routes its click to `<PurposePanel>`. No `app/(dashboard)/settings/purpose-settings/page.tsx`, no `usePathname()` wiring. The Settings modal is the single host for every Settings submenu (per [wecms-web/CLAUDE.md §3a](../../../CLAUDE.md)).

The refactor slug `purpose-settings` is used for:
- i18n namespace prefix: `settings.purpose_settings.*` (panel chrome) and `audit.purpose_settings.*` (audit log messages).
- Log / MDC tags inside the Axios interceptor when debugging this feature.
- Backend `WSVC_ID` value — never appears on the frontend wire, but matches the `purpose-settings` slug used in path parameters.

No `app/(dashboard)/settings/...` route exists because Settings is modal-only (matches the firm-banking-settings + erp-transaction-history pattern). When the future "deep-link to Settings → Purpose" requirement lands (it isn't in scope), it'll add a `/settings/purpose-settings` route that opens the Settings modal pre-focused on Purpose — not a new route taking over from the modal.

---

## 2. Component breakdown

The static-UI components already exist; Phase 3 modifies them. New components are limited to the API client + mappers.

### 2.1 Existing components (modified in Phase 3)

| Component | Path | Phase 3 change |
|---|---|---|
| `<PurposePanel>` | [components/settings/purpose/PurposePanel.tsx](../../../components/settings/purpose/PurposePanel.tsx) | Replace `useState<PurposeNode[]>(mockPurposeTree)` with `useApiData(fetchPurposeSettings, [])`; fall back to `mockPurposeTree` on fetch failure (per the firm-banking-settings precedent). |
| `<PurposeTable>` | [components/settings/purpose/PurposeTable.tsx](../../../components/settings/purpose/PurposeTable.tsx) | No prop change; consumer hands it the resolved `PurposeNode[]`. The drag-and-drop hook (if any) fires `reorderPurposeSettings(...)` on drop. |
| `<PurposeRow>` | [components/settings/purpose/PurposeRow.tsx](../../../components/settings/purpose/PurposeRow.tsx) | Toggle handler (`onEnabledChange`) fires `updatePurposeSetting(useUsagCd, { dispYn })` and refetches on success. |
| `<PurposeFormRow>` | [components/settings/purpose/PurposeFormRow.tsx](../../../components/settings/purpose/PurposeFormRow.tsx) | `onSave` becomes async: POST for add, PUT for edit; on success close form + refetch; on error open `useDialog({ type: "error", errorCode: status.code })`. |
| `<RowActions>` | [components/settings/purpose/RowActions.tsx](../../../components/settings/purpose/RowActions.tsx) | Delete handler opens a confirmation dialog, then fires `deletePurposeSetting(useUsagCd)`. On 409 / `WBE1199`, dialog flips to error with the broadened message (per OQ-8 — `WBE1199` covers both legacy "has children" and OQ-5 transaction-reference cases). |
| `<ExcelUploadDialog>` | [components/settings/purpose/ExcelUploadDialog.tsx](../../../components/settings/purpose/ExcelUploadDialog.tsx) | Upload button fires `uploadPurposeSettings(parsedRows)`. Returns `PurposeUploadResult`; on `errors[]` non-empty, dialog stays open with per-row error highlights from the shared shell. |
| `mockData.ts` | [components/settings/purpose/mockData.ts](../../../components/settings/purpose/mockData.ts) | **Keep** — offline-dev / failed-fetch fallback. Shape mirrors the live mapper output. |
| `types.ts` | [components/settings/purpose/types.ts](../../../components/settings/purpose/types.ts) | Extend `PurposeNode` with the missing wire fields (`useUsagCd` for the system PK, `modId`, `modDtm`) — keeping the existing `id`, `code`, `name`, `description`, `enabled`, `usedInTransactions`, `children` shape. See §6 for the mapper. |

### 2.2 New files

| Path | Role |
|---|---|
| [lib/api/purposeSettings.ts](../../../lib/api/purposeSettings.ts) | Wire types (`ApiPurposeSettingRow`, `ApiPurposeSettingListResponse`, …) + Axios wrappers (`fetchPurposeSettings()`, `createPurposeSetting()`, `updatePurposeSetting()`, `deletePurposeSetting()`, `reorderPurposeSettings()`, `uploadPurposeSettings()`). |

### 2.3 Modified shared files

| Path | Change |
|---|---|
| [lib/api/mappers.ts](../../../lib/api/mappers.ts) | Add `mapPurposeSettingRow(api: ApiPurposeSettingRow): PurposeNode`. |
| [locales/en.json](../../../locales/en.json) | Add `settings.purpose_settings.*` (panel chrome) + `audit.purpose_settings.*` (audit log copy). |
| [locales/ko.json](../../../locales/ko.json) | Same keys, KO copy verified from JEX `dictionary_ko.properties` only. If no verified KO translation exists for a key, omit it and let EN fall through. |
| [locales/vi.json](../../../locales/vi.json) | Same keys, VI copy verified from JEX `dictionary_vi.properties` only. |

Per `wecms-web/CLAUDE.md` §13a-bis, never invent translations. KM is not yet supported in `wecms-web` — skip.

No changes to [lib/viewSettingScreens.ts](../../../lib/viewSettingScreens.ts) (the Purpose panel does not adopt View Setting per [feature spec OQ-FE-1](purpose.md#oq-fe-1--view-setting-adoption)).

No changes to [SettingsNav.tsx](../../../components/settings/SettingsNav.tsx) (entry already exists — the Purpose panel is the approved baseline).

No changes to [Header.tsx](../../../components/layout/Header.tsx) / [Sidebar.tsx](../../../components/layout/Sidebar.tsx) — Settings is modal-only.

---

## 3. API client functions

All live in `lib/api/purposeSettings.ts`. Same shape as `lib/api/firmBankingSettings.ts`.

### 3.1 Wire types (snake_case property names — matches the Spring DTO records)

```ts
// New file: lib/api/purposeSettings.ts (Phase 3)

import { api } from "@/lib/axios";
import type { ApiResponse } from "@/lib/types/api";
import { ApiCallError } from "@/lib/api/banking"; // shared envelope-error helper

export interface ApiPurposeSettingRow {
    use_usag_cd: string;
    hand_use_usag_cd: string;
    use_usag_nm: string;
    use_usag_cont: string | null;
    parent_use_usag_cd: string | null;
    disp_yn: "Y" | "N";
    disp_ord: number;
    used_in_transactions: boolean;
    mod_id: string | null;
    mod_dtm: string | null;            // yyyyMMddHHmmss UTC
    children: ApiPurposeSettingRow[] | null;
}

export interface ApiPurposeSettingListResponse {
    list: ApiPurposeSettingRow[];
}

export interface ApiPurposeSettingDetail {
    use_usag_cd: string;
    hand_use_usag_cd: string;
    use_usag_nm: string;
    use_usag_cont: string | null;
    parent_use_usag_cd: string | null;
    disp_yn: "Y" | "N";
    disp_ord: number;
    used_in_transactions: boolean;
    mod_id: string | null;
    mod_dtm: string | null;
}

export interface ApiPurposeSettingCreateRequest {
    hand_use_usag_cd: string;
    use_usag_nm: string;
    use_usag_cont?: string | null;
    parent_use_usag_cd?: string | null;
    disp_yn?: "Y" | "N";
}

export interface ApiPurposeSettingUpdateRequest extends ApiPurposeSettingCreateRequest {}

export interface ApiPurposeReorderItem {
    use_usag_cd: string;
    disp_ord: number;
}

export interface ApiPurposeReorderRequest {
    items: ApiPurposeReorderItem[];
}

export interface ApiPurposeUploadRow {
    hand_use_usag_cd: string;
    use_usag_nm: string;
    use_usag_cont?: string | null;
    parent_use_usag_cd?: string | null;
}

export interface ApiPurposeUploadRequest {
    rows: ApiPurposeUploadRow[];
}

export interface ApiPurposeUploadError {
    row: number;
    field: "hand_use_usag_cd" | "use_usag_nm" | "parent_use_usag_cd" | "use_usag_cont";
    code: string;
}

export interface ApiPurposeUploadResult {
    inserted: number;
    skipped: number;
    errors: ApiPurposeUploadError[];
}
```

### 3.2 API client functions

```ts
const BASE = "/api/v1/settings/purpose-settings";

function unwrap<T>(resp: ApiResponse<T>, path: string): T {
    if (resp.status.error) {
        throw new ApiCallError(resp.status.code, resp.status.message, resp.trace_id);
    }
    if (resp.data === undefined) {
        throw new ApiCallError("WBE_CLIENT_PARSE", `Missing data on ${path}`, resp.trace_id);
    }
    return resp.data;
}

export async function fetchPurposeSettings(keyword?: string): Promise<ApiPurposeSettingListResponse> {
    const params = keyword ? { keyword } : undefined;
    const res = await api.get<ApiResponse<ApiPurposeSettingListResponse>>(BASE, { params });
    return unwrap(res.data, BASE);
}

export async function fetchPurposeSetting(useUsagCd: string): Promise<ApiPurposeSettingDetail> {
    const res = await api.get<ApiResponse<ApiPurposeSettingDetail>>(`${BASE}/${useUsagCd}`);
    return unwrap(res.data, `${BASE}/${useUsagCd}`);
}

export async function createPurposeSetting(
    body: ApiPurposeSettingCreateRequest,
): Promise<ApiPurposeSettingDetail> {
    const res = await api.post<ApiResponse<ApiPurposeSettingDetail>>(BASE, body);
    return unwrap(res.data, BASE);
}

export async function updatePurposeSetting(
    useUsagCd: string,
    body: ApiPurposeSettingUpdateRequest,
): Promise<ApiPurposeSettingDetail> {
    const res = await api.put<ApiResponse<ApiPurposeSettingDetail>>(`${BASE}/${useUsagCd}`, body);
    return unwrap(res.data, `${BASE}/${useUsagCd}`);
}

export async function deletePurposeSetting(useUsagCd: string): Promise<void> {
    const res = await api.delete<ApiResponse<void>>(`${BASE}/${useUsagCd}`);
    unwrap(res.data, `${BASE}/${useUsagCd}`);
}

export async function reorderPurposeSettings(
    body: ApiPurposeReorderRequest,
): Promise<ApiPurposeSettingListResponse> {
    const res = await api.put<ApiResponse<ApiPurposeSettingListResponse>>(`${BASE}/order`, body);
    return unwrap(res.data, `${BASE}/order`);
}

export async function uploadPurposeSettings(
    body: ApiPurposeUploadRequest,
): Promise<ApiPurposeUploadResult> {
    const res = await api.post<ApiResponse<ApiPurposeUploadResult>>(`${BASE}/upload`, body);
    return unwrap(res.data, `${BASE}/upload`);
}
```

JWT attaches automatically via the [`api`](../../../lib/axios.ts) Axios interceptor. The shared response interceptor handles `WBE1009` (401 session expired) → re-login dialog; this file doesn't reimplement that.

---

## 4. i18n key prefix

Namespace: **`settings.purpose_settings.*`** (panel chrome) and **`audit.purpose_settings.*`** (audit log copy).

| Key | EN copy | Notes |
|---|---|---|
| `settings.purpose_settings.title` | `Purpose` | Panel header. |
| `settings.purpose_settings.description` | `Manage transaction purposes used across payments, transfers, and reports.` | Panel sub-header (mt-1 line per CLAUDE.md §3a). |
| `settings.purpose_settings.add` | `+ Add Purpose` | "+ Add Purpose" button label. |
| `settings.purpose_settings.column.code` | `Code` | Table header for `hand_use_usag_cd`. |
| `settings.purpose_settings.column.name` | `Name` | Table header for `use_usag_nm`. |
| `settings.purpose_settings.column.description` | `Description` | Table header for `use_usag_cont`. |
| `settings.purpose_settings.column.parent` | `Parent` | Inline-form parent dropdown / input. |
| `settings.purpose_settings.column.enabled` | `Enabled` | Toggle column. |
| `settings.purpose_settings.column.actions` | `Actions` | Row actions column. |
| `settings.purpose_settings.form.code_placeholder` | `e.g. BD01` | Inline form `hand_use_usag_cd` placeholder. |
| `settings.purpose_settings.form.name_placeholder` | `e.g. Operating Expenses` | |
| `settings.purpose_settings.form.description_placeholder` | `Free-form description` | |
| `settings.purpose_settings.form.parent_placeholder` | `Optional — pick a parent purpose` | |
| `settings.purpose_settings.form.save` | `Save` | |
| `settings.purpose_settings.form.cancel` | `Cancel` | |
| `settings.purpose_settings.confirm.delete.title` | `Delete purpose` | |
| `settings.purpose_settings.confirm.delete.description` | `Are you sure you want to delete "{name}"? This cannot be undone.` | |
| `settings.purpose_settings.confirm.delete.confirm_text` | `Delete` | |
| `settings.purpose_settings.success.created` | `Purpose added.` | Toast / inline confirmation. |
| `settings.purpose_settings.success.updated` | `Purpose updated.` | |
| `settings.purpose_settings.success.deleted` | `Purpose deleted.` | |
| `settings.purpose_settings.success.reordered` | `Purposes reordered.` | |
| `settings.purpose_settings.success.uploaded` | `{inserted} purposes uploaded.` | |
| `settings.purpose_settings.list.loading` | `Loading purposes…` | |
| `settings.purpose_settings.list.empty` | `No purposes yet. Click "+ Add Purpose" to create one.` | |
| `settings.purpose_settings.error.delete_blocked` | `Cannot delete — this purpose or one of its sub-purposes is in use.` | Maps to `WBE1199`. Covers BOTH the legacy "has active children" case AND the OQ-5 transaction-reference case under one localized message. OQ-8 decided 2026-05-12 — single i18n key per wire code; no new `WBE_PURPOSE_*` family. |
| `settings.purpose_settings.error.duplicate_code` | `A purpose with this code already exists.` | Maps to `WBW1152`. |
| `settings.purpose_settings.error.duplicate_name` | `A purpose with this name already exists.` | Maps to `WBW1138`. |
| `settings.purpose_settings.error.validation` | `Validation failed: {field} — {reason}.` | Maps to `WBE_VALIDATION`. Covers Bean-Validation failures (length / required) AND every Purpose-specific service-layer validation failure (parent invalid / self-parent / demote-blocked / reorder-invalid). The contextual `{field}` + `{reason}` come from the wire `status.message` (resolved server-side via `MessageResolver` args). |
| `settings.purpose_settings.excel_upload.title` | `Upload Purposes` | Excel dialog title. |
| `audit.purpose_settings.create` | `Added purpose {0} ({1}).` | Args: `hand_use_usag_cd`, `use_usag_nm`. |
| `audit.purpose_settings.update` | `Updated purpose {0} ({1}).` | |
| `audit.purpose_settings.delete` | `Soft-deleted purpose {0}.` | |
| `audit.purpose_settings.reorder` | `Reordered {0} purposes.` | |
| `audit.purpose_settings.upload` | `Bulk-uploaded {0} purposes.` | |

**Locale matrix:**
- `en.json` — author all keys EN.
- `ko.json` — port only entries verified from the legacy JEX dictionary `dictionary_ko.properties` (legacy JEX source — not included in this repository). If an entry has no verified translation, omit it and the provider falls back to EN.
- `vi.json` — same rule against `dictionary_vi.properties`.
- `km.json` — not used in `wecms-web`.

---

## 5. Typography tokens used

Per the in-repo frontend guide [CLAUDE.md §3b Settings UI consistency](../../../CLAUDE.md) (which documents the typography tokens):

| Element | Token chain |
|---|---|
| Panel title (`<PurposePanel>` header `<h2>`) | `text-wb-18 font-semibold tracking-wb-tight text-wb-dark` |
| Panel description (mt-1 below title) | `mt-1 text-wb-13 font-normal text-wb-muted` |
| Table header cell (`<thead> <th>`) | `text-wb-13 font-semibold text-wb-dark` + `bg-wb-bg-sidebar sticky top-0 z-10 border-b border-wb-table-border whitespace-nowrap` |
| Table body cell | `text-wb-13 font-medium text-wb-ink` + `border-b border-wb-table-border` |
| Inline-form input (`<PurposeFormRow>` text inputs) | shadcn `<Input>` defaults (the input primitive already pairs `text-wb-14 + leading-[18px]` per the documented Settings input exception in [wecms-web/CLAUDE.md §3b.F](../../../CLAUDE.md)) |
| Button text (Save / Cancel / + Add Purpose) | `h-8 px-3 text-wb-14-tight font-medium` — Save = `bg-brand text-white shadow-wb-brand-btn`, Cancel = `bg-white text-wb-ink shadow-wb-btn` |
| Excel Upload chip (panel toolbar) | `bg-[#1f7a4d]` per §3b.F exception (Chart of Accounts / Contacts / VAS Account share this color; Purpose follows the same Figma asset) |
| Status toggle (per row) | shadcn `<Switch>` primitive defaults; brand-blue track on enabled |
| Confirmation dialog | `useDialog({ type: "confirmation" })` — 500px max width per global rule |
| Excel upload dialog | shared `<ExcelUploadDialog>` at `stackLevel={2}` with Figma-driven width |

**No inline `text-[Npx]`, `font-[N]`, `style={{ fontFamily }}`** anywhere in `<PurposePanel>` or its children. The static UI already satisfies this; Phase 3 must preserve it.

---

## 6. Wire ↔ in-memory mapper

The existing `PurposeNode` type ([types.ts](../../../components/settings/purpose/types.ts)) keeps its current shape, with two new optional camelCase fields for the system PK + audit display:

```ts
// types.ts — Phase 3 modification
export type PurposeNode = {
    /** Frontend stable id — used for React keys. Matches use_usag_cd 1:1 after wire. */
    id: string;

    /** System code (use_usag_cd) — opaque 10-char zero-padded PK. */
    useUsagCd: string;

    /** User-visible code (e.g. "BD01"). Wire field hand_use_usag_cd. */
    code: string;

    /** Display name. Wire field use_usag_nm. */
    name: string;

    /** Description. Wire field use_usag_cont; renders "-" when empty. */
    description: string;

    /** Toggle state. Wire field disp_yn === "Y". */
    enabled: boolean;

    /** Pre-resolved on the server. Disables the trash button. */
    usedInTransactions?: boolean;

    /** Last editor login id. Optional. */
    modId?: string;

    /** Last modification timestamp (yyyyMMddHHmmss). Optional. */
    modDtm?: string;

    /** Two-level hierarchy only. Children carry no children. */
    children?: PurposeNode[];
};
```

```ts
// lib/api/mappers.ts — added in Phase 3

import type { ApiPurposeSettingRow } from "@/lib/api/purposeSettings";
import type { PurposeNode } from "@/components/settings/purpose/types";

export function mapPurposeSettingRow(api: ApiPurposeSettingRow): PurposeNode {
    return {
        id: api.use_usag_cd,
        useUsagCd: api.use_usag_cd,
        code: api.hand_use_usag_cd,
        name: api.use_usag_nm,
        description: api.use_usag_cont ?? "-",
        enabled: api.disp_yn === "Y",
        usedInTransactions: api.used_in_transactions,
        modId: api.mod_id ?? undefined,
        modDtm: api.mod_dtm ?? undefined,
        children: api.children?.map(mapPurposeSettingRow),
    };
}
```

The mapper is the boundary — components never read `use_usag_cd` / `hand_use_usag_cd` directly. When the form `Save` handler fires, the page sends camelCase → wire-snake_case via the create / update wrappers' typed parameters.

**Reverse mapping** (form draft → wire) happens inline in `<PurposeFormRow>`'s save handler:

```ts
async function handleSave(draft: PurposeDraft) {
    const body: ApiPurposeSettingCreateRequest = {
        hand_use_usag_cd: draft.code.trim(),
        use_usag_nm: draft.name.trim(),
        use_usag_cont: draft.description.trim() || null,
        parent_use_usag_cd: draft.parentCode.trim() || null,
        disp_yn: "Y",
    };
    try {
        await createPurposeSetting(body);
        dialog.open({ type: "success", title: t("settings.purpose_settings.success.created") });
        refetch();
        onClose();
    } catch (err) {
        const e = err as ApiCallError;
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: t(errorKeyFor(e.code)),
            errorCode: e.code,
        });
    }
}
```

`errorKeyFor(code)` is a tiny local helper that maps wire error codes to the `settings.purpose_settings.error.*` i18n keys above.

---

## 7. State + interaction flows

### 7.1 List load (mount)

```
PurposePanel mount
  → useApiData(fetchPurposeSettings, []) — fires on mount
  → resp.list.map(mapPurposeSettingRow) → setNodes(tree)
  ↓
  if fetch errored:
      setNodes(mockPurposeTree)  // offline-dev fallback
      dialog.open({ type: "error", errorCode: status.code })
  ↓
  render PurposeTable + "+ Add Purpose" button
```

### 7.2 Create (inline add)

```
Click "+ Add Purpose"
  → setInlineMode({ kind: "add" })
  → <PurposeFormRow> renders at the bottom (sticky)
  → user fills code / name / description / parent
  → click Save
  → createPurposeSetting({ hand_use_usag_cd, use_usag_nm, ... })
  → success: dialog.open({ type: "success" }), inline mode cleared, refetch
  → error: dialog.open({ type: "error", errorCode })
```

### 7.3 Edit (inline)

```
Click row pencil
  → setInlineMode({ kind: "edit", node, parentCode })
  → <PurposeFormRow> mounts at the bottom seeded from the node
  → user edits, clicks Save
  → updatePurposeSetting(node.useUsagCd, { hand_use_usag_cd, use_usag_nm, ... })
  → success: dialog.open({ type: "success" }), refetch, clear inline mode
  → error: dialog.open({ type: "error", errorCode })
```

### 7.4 Delete (with confirmation)

The trash button is pre-disabled by `node.usedInTransactions` — that boolean is **recursive on the server side** (OQ-5 decided 2026-05-12). The backend's `used_in_transactions` wire field is `true` when the row itself OR any of its active children is referenced by an active banking-transaction-history / payment / transfer record, so the frontend never needs to re-check the children manually. Pre-disabling the button is purely a UX optimization — even if the user bypasses it (e.g. via a stale list), the DELETE call still hard-fails with `WBE1199` (per OQ-8 — single wire code, broadened i18n message).

```
Click row trash (disabled when node.usedInTransactions === true)
  → dialog.open({
        type: "confirmation",
        title: t("settings.purpose_settings.confirm.delete.title"),
        description: t("settings.purpose_settings.confirm.delete.description",
                       { name: node.name }),
        confirmText: t("settings.purpose_settings.confirm.delete.confirm_text"),
        cancelText: t("dialog.no"),
        onConfirm: async () => {
            try {
                await deletePurposeSetting(node.useUsagCd);
                dialog.open({ type: "success", title: t("settings.purpose_settings.success.deleted") });
                refetch();
            } catch (err) {
                const e = err as ApiCallError;
                dialog.open({ type: "error", errorCode: e.code,
                              description: t(errorKeyFor(e.code), { name: node.name }) });
            }
        },
    })
```

### 7.5 Reorder (drag-and-drop)

```
User drags a row, drops at a new position
  → frontend mutates local DISP_ORD for visual feedback
  → reorderPurposeSettings({ items: [{ use_usag_cd, disp_ord }, ...] })
  → success: refetch (server-authoritative ordering)
  → error: revert to pre-drag state, dialog.open({ type: "error", errorCode })
```

Reorder is debounced — wait 300ms after the last drop to coalesce rapid reorder bursts.

### 7.6 Toggle (`disp_yn`)

```
Click row switch
  → optimistic UI flip
  → updatePurposeSetting(node.useUsagCd, { hand_use_usag_cd, use_usag_nm,
                                            use_usag_cont, parent_use_usag_cd,
                                            disp_yn: enabled ? "Y" : "N" })
  → success: refetch (to pick up mod_dtm + canonical state)
  → error: revert switch, dialog.open({ type: "error", errorCode })
```

The Update request requires `hand_use_usag_cd` + `use_usag_nm` per legacy parity (see backend §5.3 _(wecms-api backend repo — not included in this clone)_), so the toggle handler must include all required fields. Alternative is a dedicated `PATCH .../toggle` endpoint — discussed in [feature spec OQ-Backend-4](purpose.md) deferred for Phase 2 simplicity.

### 7.7 Excel upload

```
Click panel Excel chip
  → setExcelUploadOpen(true)
  → <ExcelUploadDialog> opens at stackLevel={2}
  → user downloads template (Step 1)
  → user selects XLSX (Step 2 — frontend parses)
  → preview renders with per-cell error highlights
  → click Upload
  → uploadPurposeSettings({ rows: parsedRows })
  → result.errors.length > 0: dialog stays open with error per row
  → success: dialog closes, panel refetches, success toast
```

---

## 8. Reuse before creating

Per [wecms-web/CLAUDE.md §"Common Reusability Rule"](../../../CLAUDE.md), every cross-cutting concern below MUST go through the existing shared module — never re-implement.

| Concern | Shared module | Notes |
|---|---|---|
| HTTP transport + JWT | [lib/axios.ts](../../../lib/axios.ts) | Already wired. |
| API fetch hook | [lib/api/useApiData.ts](../../../lib/api/useApiData.ts) | Fetches on mount + on deps change; exposes `loading` / `data` / `refetch`. |
| Confirmation / success / error dialogs | `useDialog()` from [components/shared/dialog](../../../components/shared/dialog) | All three states route through this. |
| Excel Upload modal shell | [components/shared/excel-upload/ExcelUploadDialog.tsx](../../../components/shared/excel-upload/ExcelUploadDialog.tsx) | Per-feature wrapper supplies columns + handlers; never fork the shell. |
| Settings modal shell | [components/settings/SettingsModal.tsx](../../../components/settings/SettingsModal.tsx) | Hosts the panel. |
| Settings nav | [components/settings/SettingsNav.tsx](../../../components/settings/SettingsNav.tsx) | "Purpose" entry already present. |
| i18n | [lib/i18n/LocaleProvider.tsx](../../../lib/i18n/LocaleProvider.tsx) | `t(...)` consumes the locale files. |
| Class composition | [lib/utils.ts](../../../lib/utils.ts) `cn(...)` | |
| Form primitives | [components/ui/](../../../components/ui/) | shadcn `<Input>`, `<Button>`, `<Switch>`, `<Label>`. |

---

## 9. Responsive rules

Per [wecms-web/CLAUDE.md §Responsive rules](../../../CLAUDE.md) — desktop-first, verified at 375 / 768 / 1024 / 1440.

The Settings modal is fixed at `1300 × 760` per [§3a](../../../CLAUDE.md); it falls back gracefully on smaller viewports via `max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)]`. The `<PurposePanel>` inherits this — no per-breakpoint variants are needed inside the panel. The table inside the scroll region handles horizontal scroll via the panel's `custom-scrollbar` utility when columns exceed the panel width (rare for this 5-6 column table).

---

## 10. Open questions (frontend-specific)

### OQ-FE-Frontend-1 — Parent dropdown vs. free text — **DECIDED 2026-05-12**

**Resolution (from Sonny, 2026-05-12):** the current static-UI implementation is correct as-is. The parent selector must show **only parent-level (level-1) Purpose items** — child (level-2) rows are never selectable as a parent. This matches the Figma two-level direction.

**Phase 3 wiring (no static-UI change):** populate the candidate list from the same `fetchPurposeSettings()` call, filtered to `nodes.filter(n => n.parentUseUsagCd === undefined && n.enabled)` (or the equivalent server-side derived `parent_use_usag_cd === null AND use_yn === 'Y'`). Never include level-2 rows in the selector. The backend `validateParent(...)` still hard-rejects a level-2 parent with `WBE_VALIDATION` (per OQ-8 — no `WBE_PURPOSE_*` family) as defence in depth, but the frontend MUST not show those rows.

### OQ-FE-Frontend-2 — Toggle endpoint shape

Current design: the row toggle uses the full `PUT /{useUsagCd}` with the row's current required fields restated. Alternative: dedicated `PATCH .../{useUsagCd}/toggle` for clarity. Phase 3 default: **full PUT** — keeps the backend smaller. Re-evaluate if the wire surface gets noisy.

### OQ-FE-Frontend-3 — Reorder debounce

`reorderPurposeSettings` fires after a 300ms debounce. Alternative: fire on every drop. Phase 3 default: **300ms** — avoids server thrash when the user rearranges several rows in a row. Confirm during Phase 3 manual testing.

### OQ-FE-Frontend-4 — Empty / loading skeleton

The Figma frame does NOT show a loading skeleton or empty state. Phase 3 default: **simple skeleton rows** (3-5 placeholder `<tr>` with `bg-wb-bg-sidebar/40 animate-pulse`) matching the firm-banking-settings precedent. Empty state shows the `settings.purpose_settings.list.empty` copy in the table body when the API returns `list: []`.

---

## 11. References

- [docs/refactor-wecms/features/settings/purpose-settings.md](purpose.md) — functional spec.
- purpose-settings.md _(wecms-api backend repo — not included in this clone)_ — backend contract (wire shapes, validation, codes).
- purpose-settings.md _(wecms-api backend repo — not included in this clone)_ — JEX → refactor mapping.
- [docs/refactor-wecms/frontend/settings/erp-transaction-history.md](transaction-history.md) — closest Settings-panel precedent (live wire-up against the Spring backend).
- [wecms-web/CLAUDE.md](../../../CLAUDE.md) — §3a Settings Modal Shell + Panel Composition, §3b Settings UI Consistency, §10 Refactor Rule.
- [wecms-web/AGENTS.md](../../../AGENTS.md) — Next.js 16 reminder.

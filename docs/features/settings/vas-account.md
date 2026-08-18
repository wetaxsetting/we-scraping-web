# VAS Account — Frontend Design (Next.js)

> **⚠️ Superseded — preserved for traceability.** The primary, as-built frontend documentation home is
> now the folder **[vas-account/](vas-account/README.md)** (6 docs). This single file predates the
> folder and describes the *planned* surface — it shows a routed `VasAccountPage`, a
> `useVasAccountExcel.validateCell` hook, `ACTIVE`/`INACTIVE` in-memory enums, and the legacy
> `tot_cnt`/`suc_cnt`/`rec` Excel-preview shape, none of which match the shipped code (the panel is a
> Settings-modal panel, status is `active`/`inactive`, there is no `validateCell`, and the preview
> shape is `rows`/`total_count`/`completed_count`/`error_count`). Read the folder first — especially
> [vas-account/component-index.md](vas-account/component-index.md) and
> [vas-account/api-consumption.md](vas-account/api-consumption.md). This file is kept only for
> migration history.

Slug: `vas-account`. **Host: Settings modal panel** (mounted inside `<SettingsModal>`; not a standalone Next.js route — see audit F4 / migration doc §2). Backend: `/api/v1/settings/vas-account` (lowercase snake_case wire). Wire ↔ in-memory translation happens once at `lib/api/mappers.ts`. Typography is Tailwind tokens only (`text-wb-*`, `font-{medium,semibold,bold}`) — no raw px.

> AGENTS.md reminder: Next.js 16. Confirm any non-trivial App Router / Server Component / data-fetching choice against `node_modules/next/dist/docs/` before writing.

---

## 1. Host + panel composition

VAS Account renders as a Settings submenu **inside the shared
`<SettingsModal>` shell** — one panel per submenu, mounted via the
side-nav (`components/settings/SettingsNav.tsx`). There is **no
top-level Next.js route** for the screen; the original
`/settings/vas-account` plan was retired during implementation in
favour of the modal-host shape so the feature lives alongside other
Settings submenus (Bank Account, Approval Line, Chart of Accounts,
Contacts, …) inside one common chrome.

```
components/settings/
├── SettingsModal.tsx                — modal shell + side-nav router
├── SettingsNav.tsx                  — side-nav with the VAS Account entry
└── vas-account/
    ├── VasAccountPanel.tsx          — composition root (Header → filters → table)
    ├── VasAccountTable.tsx          — bare <table> + colgroup
    ├── VasAccountTableColumns.tsx   — shared <colgroup>
    ├── AddVasAccountDialog.tsx      — Add + Edit (shared, `mode` prop)
    ├── ExcelUploadDialog.tsx        — Settings wrapper around shared excel-upload shell
    ├── VasAccountRowMenu.tsx        — per-row kebab popover (Edit / Delete)
    ├── useVasAccount.ts             — list + mutations hooks
    ├── mappers.ts                   — wire ↔ in-memory + tree builder
    └── types.ts                     — in-memory VasAccountRow + form values
```

The panel mounts inside `<SettingsModal>` so it inherits the modal's
auth guard (the modal is reachable only from authenticated routes),
the Esc/X close affordance, and the modal-stack z-index management.
No new layout file, no new route file. The View Setting `SCREEN_ID_TO_ROUTE`
entry (`lib/viewSettingScreens.ts`) points at the modal's host route
(`/banking/account-inquiry`) so deep links opening the popover anchor
on a valid page.

---

## 2. Component tree

```
components/settings/vas-account/
├── VasAccountPage.tsx                — composition root (client component)
├── VasAccountTable.tsx               — bare <table> + colgroup; reuses ApprovalTableColumns pattern
├── VasAccountTableColumns.tsx        — shared <colgroup> definition (no footer for this page)
├── VasAccountFilterBar.tsx           — SearchInput + Active/Inactive checkboxes
├── VasAccountAddDialog.tsx           — shadcn <Dialog> stack level 1
├── VasAccountEditDialog.tsx          — shadcn <Dialog> stack level 1; loads detail by seq_no
├── VasAccountExcelUploadDialog.tsx   — shadcn <Dialog> stack level 1; multi-step:
│                                       (1) file picker · (2) preview grid · (3) confirm + save
├── VasAccountStatusBadge.tsx         — wraps <StatusBadge> with the {ACTIVE, INACTIVE} variant map
├── useVasAccountList.ts              — list hook (Axios + mapper)
├── useVasAccountMutations.ts         — create / update / delete hooks
├── useVasAccountExcel.ts             — preview / cell-validate / import hooks
└── types.ts                          — in-memory camelCase types (NOT wire types)
```

Wire types live in `lib/types/api.ts` (snake_case). Mappers in `lib/api/mappers.ts` (or a new `lib/api/vasAccount.ts` if the file gets long). Pages and hooks never read snake_case property names directly.

### `VasAccountPage.tsx` (skeleton)

```tsx
"use client";
export default function VasAccountPage() {
  // local state: searchWd, statuses (Set<"A" | "I">), sortField, sortDirection,
  //              page (0-based), size (20 default)
  // hook: useVasAccountList({ searchWd, statuses, sortField, sortDirection, page, size })
  // hook: useViewSetting("vas-account", "default")   — shared View Setting hook
  // dialog state: { mode: "add" | "edit" | "upload" | null, editingSeqNo?: string }
  return (
    <>
      <PageHeader title={t("settings.vas_account.page_title")}
                  description={t("settings.vas_account.subtitle")}
                  right={<PageActionButtons … />} />
      <VasAccountFilterBar … />
      <VasAccountTable rows={rows} viewSetting={viewSetting} onEdit={…} onDelete={…} />
      <Pagination
        pageNumber={pageNumber}        // zero-based; <Pagination> displays one-based
        pageSize={pageSize}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
      />
      {/* dialogs (one at most open via reducer) */}
    </>
  );
}
```

`<Pagination>` is the shared component already used by Banking Account Inquiry and ERP Transaction History — page-size dropdown + nav arrows + page buttons.

`PageHeader`, `PageActionButtons` (List View · Print · Export), `SearchInput`, `Pagination` (if needed), `StatusBadge`, and `useDialog()` come from the existing shared library — no new shells.

---

## 3. Wire types (in `lib/types/api.ts`)

```ts
export interface ApiVasAccountRow {
  vas_acct_seq_no:    string;   // string — backend ships as string per feature spec
  vas_acct_cd:        string;
  vas_acct_nm:        string;
  vas_acct_enm:       string | null;
  vas_acct_type:      "0" | "1" | "2";
  vas_acct_type_key:  string;   // i18n key
  stts:               "A" | "I";
  stts_key:           string;   // i18n key
  cont:               string | null;
  mod_id:             string;
  mod_dtm:            string;   // legacy varchar(14) yyyyMMddHHmmss
}

export interface ApiVasAccountListResponse {
  /** Rows on the requested page. */
  list:         ApiVasAccountRow[];
  /** Unpaged filtered total (after search_wd + stts). */
  total_count:  number;
  /** Zero-based page index (Spring Data convention). Frontend converts
   *  to one-based for display. */
  page_number:  number;
  /** Rows per page actually used by the server (after clamp). */
  page_size:    number;
  /** Total page count for the unpaged filtered set. */
  total_pages:  number;
}

export interface ApiVasAccountExcelPreview {
  tot_cnt: number;
  suc_cnt: number;
  err_cnt: number;
  rec: ApiVasAccountExcelPreviewRow[];
}

export interface ApiVasAccountExcelPreviewRow {
  row_index:     number;
  vas_acct_cd:   string | null;
  vas_acct_nm:   string | null;
  vas_acct_type: string | null;
  vas_acct_enm:  string | null;
  cont:          string | null;
  stts:          string | null;
  errors:        Record<string, { code: string; message: string }>;
}

export interface ApiVasAccountImportResult {
  inserted_count: number;
  replaced_count: number;
}
```

`vas_acct_seq_no` is a string on the wire — TypeScript types must reflect that. Numeric coercion happens nowhere in the frontend; the value is treated as an opaque identifier throughout.

---

## 4. In-memory types (`components/settings/vas-account/types.ts`)

```ts
export type VasAccountStatus = "ACTIVE" | "INACTIVE";
export type VasAcctType      = "DUAL"   | "CREDIT" | "DEBIT";

export interface VasAccountRow {
  vasAcctSeqNo:    string;
  vasAcctCd:       string;
  vasAcctName:     string;
  vasAcctEnglish:  string | null;
  vasAcctType:     VasAcctType;
  vasAcctTypeKey:  string;    // i18n key from backend
  status:          VasAccountStatus;
  statusKey:       string;    // i18n key from backend
  description:     string | null;
  modifiedBy:      string;
  modifiedAt:      string;    // raw legacy yyyyMMddHHmmss — formatted at render
}

// hierarchy view derives at render — not part of the wire shape
export interface VasAccountTreeNode extends VasAccountRow {
  children: VasAccountTreeNode[];
  depth: number;
}
```

Mapper (`lib/api/mappers.ts`):

```ts
export function toVasAccountRow(w: ApiVasAccountRow): VasAccountRow {
  return {
    vasAcctSeqNo:   w.vas_acct_seq_no,
    vasAcctCd:      w.vas_acct_cd,
    vasAcctName:    w.vas_acct_nm,
    vasAcctEnglish: w.vas_acct_enm,
    vasAcctType:    w.vas_acct_type === "0" ? "DUAL" : w.vas_acct_type === "1" ? "CREDIT" : "DEBIT",
    vasAcctTypeKey: w.vas_acct_type_key,
    status:         w.stts === "A" ? "ACTIVE" : "INACTIVE",
    statusKey:      w.stts_key,
    description:    w.cont,
    modifiedBy:     w.mod_id,
    modifiedAt:     w.mod_dtm,
  };
}
```

---

## 5. Hooks

### `useVasAccountList`

```ts
function useVasAccountList(params: {
  searchWd?:      string;
  statuses:       Set<VasAccountStatus>;     // {} = empty list returned
  sortField?:     string;
  sortDirection?: "ASC" | "DESC";
  page:           number;                    // zero-based
  size:           number;                    // default 20, max 100
}): {
  rows:        VasAccountRow[];
  totalCount:  number;
  pageNumber:  number;     // zero-based (echoed from server after clamp)
  pageSize:    number;     // echoed from server after clamp
  totalPages:  number;
  isLoading:   boolean;
  refetch:     () => void;
}
```

- Axios `GET /api/v1/settings/vas-account?search_wd=...&stts=A&stts=I&sort_field=...&sort_direction=...&page=0&size=20`.
- Maps wire rows via `toVasAccountRow`.
- Returns the **flat list** for the current page — `VasAccountTable` builds the prefix-tree view on render.
- Initial fetch on mount + on any dependency change (including `page` / `size`).
- Empty `statuses` set → return immediately with `rows=[]`, all counts `0` (don't hit the wire — backend would return empty anyway, but the early-out avoids a spinner flash).
- Mirrors the existing `useErpTransactionHistoryList` shape — same pagination contract end-to-end.

### `useVasAccountMutations`

```ts
function useVasAccountMutations(): {
  create: (req: VasAccountCreateInput) => Promise<VasAccountRow>;
  update: (seqNo: string, req: VasAccountUpdateInput) => Promise<VasAccountRow>;
  remove: (seqNo: string) => Promise<void>;
}
```

Each mutation maps the in-memory request → wire shape, posts, returns the parsed wire response. Errors propagate as `ApiCallError` ({ code, message, traceId }) — the page wires them to `useDialog()`:

```ts
try { await mutations.create(input); refetch(); }
catch (e: any) { dialog.open({ type: "error", title: t("dialog.error"),
                                description: e.message, errorCode: e.code }); }
```

### `useVasAccountExcel`

```ts
function useVasAccountExcel(): {
  preview:        (file: File)                                        => Promise<ExcelPreview>;
  validateCell:   (fieldId: string, value: string, seqNo?: string)    => Promise<FieldError | null>;
  import_:        (upldOptn: "A" | "R", rows: ExcelPreviewRow[])      => Promise<{ insertedCount: number; replacedCount: number }>;
}
```

The Excel upload dialog manages a 3-step internal state machine: `picker → preview → confirm`. The `validateCell` call is debounced (200 ms) on inline edits to avoid a flood of round-trips.

### `useViewSetting` (shared — already exists for Banking)

Reuse as-is. Called with `("vas-account", "default")`. Returns `{ columns, refresh, save, reset }`. The popover component is the global one in [`components/shared/view-setting/ViewSettingPopover.tsx`](../../../components/shared/view-setting/ViewSettingPopover.tsx) — no per-screen build.

---

## 6. View Setting integration

Add the constant to the registry:

```ts
// lib/viewSettingScreens.ts (edit existing file)
export const SCREEN_IDS = {
  …existing…,
  VAS_ACCOUNT: "vas-account",
} as const;

export const SCREEN_ID_TO_ROUTE: …= {
  …existing…,
  [SCREEN_IDS.VAS_ACCOUNT]: "/settings/vas-account",
};
```

Fallback columns (paint-time stand-in only; backend seed is the runtime authority):

```ts
const FALLBACK_COLUMNS: ViewSettingColumn[] = [
  { fieldId: "VAS_ACCT_CD",   fieldNm: "VAS Code",         dispOrd: 1, useYn: "Y", fixYn: "Y", dispYn: "Y", sortYn: "Y", size: "185px" },
  { fieldId: "VAS_ACCT_NM",   fieldNm: "VAS Account Name", dispOrd: 2, useYn: "Y", fixYn: "N", dispYn: "Y", sortYn: "Y", size: "600px" },
  { fieldId: "VAS_ACCT_TYPE", fieldNm: "Type",             dispOrd: 3, useYn: "N", fixYn: "N", dispYn: "Y", sortYn: "Y", size: "140px" },
  { fieldId: "STTS",          fieldNm: "Status",           dispOrd: 4, useYn: "Y", fixYn: "N", dispYn: "Y", sortYn: "Y", size: "120px" },
  { fieldId: "ETC",           fieldNm: "",                 dispOrd: 99, useYn: "Y", fixYn: "Y", dispYn: "N", sortYn: "N", size: "45px" },
];
```

The page's toolbar list-icon button toggles the popover via the shared `ViewSettingPopover` — no bespoke version.

---

## 7. Excel export integration

`PageActionButtons` exposes a `<button>` that calls a small `useExportToExcel` hook:

```ts
function useExportToExcel(screenId: ScreenId): { exportNow: (req: ExcelExportRequest) => Promise<void> }
```

(That hook is already implemented for Banking Account Inquiry and is reused as-is.) The page constructs the request from `{ filters: { searchWd, statuses }, sort: { field, direction }, columns: viewSetting.columns.filter(c => c.useYn === "Y") }` and calls `exportNow`. The backend produces the XLSX; the hook saves the blob via `URL.createObjectURL` + a temporary `<a>`.

---

## 8. Typography tokens used (no raw px)

| Element | Tailwind token | Source |
|---|---|---|
| Page title `VAS Account` | `text-wb-18 font-semibold` | Figma WB365 page-title spec |
| Subtitle `Set up VAS account for the transaction` | `text-wb-14 text-wb-muted` | matches AppShell secondary text |
| Filter row labels (`Active`, `Inactive`) | `text-wb-14 font-medium` | matches other filter checkboxes |
| Search input text | `text-wb-14 font-normal` | shared `<SearchInput>` |
| Table header | `text-wb-14 font-semibold text-wb-ink` | matches `AccountInquiryPage` table baseline |
| Table cell — VAS code (parent) | `text-wb-14 font-medium text-brand` | parent rows render the code as a button-like link |
| Table cell — VAS code (child) | `text-wb-14 font-normal` | indented child rows |
| Table cell — name | `text-wb-14 font-normal` | |
| Status pill | reuse `<StatusBadge>` token map (`wb-status-approved-*` for ACTIVE, `wb-status-rejected-*` for INACTIVE — pending Figma confirmation, DN-7) | |
| Dialog title | `text-wb-18 font-semibold` | matches Settings Purpose modal |
| Dialog body labels | `text-wb-14 font-medium` | matches form-dialog precedent |
| Dialog body inputs | `text-wb-14 font-normal` | shadcn `<Input>` |
| Button (primary) | `text-wb-14 font-medium` | shadcn `<Button>` |

No `text-[Npx]` literals, no `style={{ fontFamily: ... }}`, no `font-[NNN]` inline. Any new size required → add a `text-wb-{n}` token in `app/globals.css` first.

---

## 9. Dialog stacking

- Add / Edit / Upload dialogs are **stackLevel 1** (root) — they open from the page, not from inside another dialog.
- Delete confirmation goes through `useDialog({ type: "confirmation" })` (system-level, separate from the feature-dialog stack).
- Replace-all confirmation inside the Excel Upload dialog goes through `useDialog({ type: "confirmation" })` too — system dialogs render at `z-[100]`, above any open feature dialog (`stackLevel ≤ 5`), per the modal-stacking rules.
- The Excel preview grid (inside `VasAccountExcelUploadDialog`) is part of the same dialog — no nested popups. Inline cell edits write back into the dialog's local state, debounced through `validateCell`.

---

## 10. Loading / empty / error states

- Loading — table shows shadcn `<Skeleton>` rows (existing pattern from `AccountInquiryPage`).
- Empty (`rows.length === 0`) — single row spanning the table: `t("settings.vas_account.empty")` ("No Data Found"). Matches the legacy comm_0217_001 empty state.
- Error — `ApiCallError` lifts into `useDialog({ type: "error", errorCode, description })`. The dialog's `traceId` is the verbatim `trace_id` from the wire envelope so the user can quote it.

---

## 11. Accessibility

- Search input — `aria-label="Search VAS accounts"`.
- Status checkboxes — paired with `<label>` (existing shadcn `<Checkbox>` already wires this).
- Table — `<th scope="col">`; row action menu uses `<button aria-haspopup="menu">` + Radix-style popover (existing pattern, no DIY popover code).
- Confirmation dialogs — focus auto-traps inside the dialog; ESC closes top-most only (modal-stacking rule).

---

## 12. Out of scope (this MR)

- VAS picker popup for cross-feature reuse (e.g. inside a Bank Account edit form) — ships when the first refactor consumer of the picker lands.
- Bulk-select / bulk-delete — no current UX requirement.
- Drag-to-reorder on the tree (the legacy click-to-toggle ASC/DESC on parent rows is `comm_0217_001.ts:84-117`; refactor adopts the standard `<TableHeader>` sort glyph driven by the common-sort hook, not a custom parent-row toggle).
- Hierarchical print view — page-level print uses the standard `<PageActionButtons>` Print icon (browser print stylesheet), same as Banking Account Inquiry. No specialized "tree print" mode.

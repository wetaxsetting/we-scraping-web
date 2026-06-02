# Chart of Accounts — Next.js Frontend Design

**Slug:** `chart-of-accounts`
**Tree:** [wecms-web/](../../../)
**Panel home:** [`components/settings/chart-of-accounts/`](../../../components/settings/chart-of-accounts/)
**Related docs:** [feature spec](chart-of-accounts.md) · migration map _(wecms-api backend repo — not included in this clone)_ · backend design _(wecms-api backend repo — not included in this clone)_ · database _(wecms-api backend repo — not included in this clone)_ · plan _(wecms-api backend repo — not included in this clone)_.

This document specifies the Next.js implementation for the refactor — what state the panel owns, which shared components it composes, what wire types ship in `lib/types/api.ts`, where the fetchers live, and how typography / View Setting / Settings-modal rules apply. It does not write code.

The static UI for this panel **already exists** in the repo (`ChartOfAccountsPanel`, `ChartOfAccountsTable`, `ExcelUploadDialog`, `mockData.ts`, `types.ts`) — Phase 1 of the refactor wires the real backend endpoints into that existing shell. The doc below treats the static UI as the baseline and calls out exactly what changes.

---

## 1. Route + composition

Settings panels do NOT live at a top-level Next.js route. The Chart of Accounts panel mounts inside [`<SettingsModal>`](../../../components/settings/SettingsModal.tsx) via `<SettingsNav>` — same pattern as Contacts / Approval Line / VAS Account / Purpose Settings.

```
Top nav → "Settings"
    └─ <SettingsModal> opens (L1 stack)
        ├─ <SettingsNav>           — left rail; "Chart of Accounts" entry routes selection state
        └─ <ChartOfAccountsPanel>  — right pane
```

The tooling-only entry in [`SCREEN_ID_TO_ROUTE`](../../../lib/viewSettingScreens.ts) follows the same precedent as Contacts / Approval Line — points at `/banking/account-inquiry` because there's no top-level route, and View Setting tooling walks the registry not the URL.

---

## 2. Panel composition (Settings panel rules)

Conforms to [wecms-web/CLAUDE.md](../../../CLAUDE.md) §3a "Settings Popup — Modal Shell + Panel Composition" — Header + Filters + Scroll region + pinned-bottom "+ Add A New Account" / Excel Upload chip.

```
<div className="flex min-h-0 flex-1 flex-col">
  {/* Header — shrink-0 — px-8 pt-14 pb-5 (Settings panel rhythm) */}
  <ChartOfAccountsHeader />

  {/* Filter row — shrink-0 — SearchInput + Excel Upload chip on the right */}
  <ChartOfAccountsFilterRow />

  {/* Scroll region — min-h-0 flex-1 custom-scrollbar */}
  <ChartOfAccountsTable />     {/* bare <table> + colgroup, sticky thead, inline edit row */}

  {/* Pinned-bottom "+ Add A New Account" CTA — shrink-0 */}
  <ChartOfAccountsAddButton />
</div>
```

The table itself follows [§7](../../../CLAUDE.md) — bare `<table>` + `<colgroup>` + sticky `<thead>` + `text-wb-13` for header AND body, header `font-semibold`, body `font-medium`. Action column carries the established `size-7` Edit/Delete icon-only pair from [§3b Settings exception table](../../../CLAUDE.md) (Chart of Accounts IS the canonical example for this exception, do not change to `size-6`).

### 2.1 Column set

| Column | FIELD_ID | Width | Typography | Notes |
|---|---|---|---|---|
| Checkbox | — | 38px | — | Row selection (always rendered, NOT View Setting controlled) |
| Account Code | `CHART_ACCT_CD` | 160px | `text-wb-13 font-medium text-wb-ink` | Sortable; ASC default |
| Account Name (English) | `CHART_ACCT_NM_EN` | 232px | same | Sortable |
| Account Name (Vietnamese) | `CHART_ACCT_NM_VN` | 250px | same | Not sortable (Phase 1) |
| Account Name (Korean) | `CHART_ACCT_NM_KO` | 220px | same | Not sortable (Phase 1) |
| Parent Account | `PARENT_CHART_ACCT_CD` | 230px | same | Renders the parent's `code - name_en`; null = `—` for roots |
| Cal Rule | `CAL_RULE` | 105px | same | Renders `+` (P) / `-` (M) / `—` (null) |
| Status | `STTS` | 150px | `<StatusBadge>` for Active / Inactive | Active = `bg-wb-status-approved-bg / text-wb-status-approved-text`; Inactive = `bg-wb-status-rejected-bg / text-wb-status-rejected-text` (or `wb-status-pending` per Figma — confirm in screenshot) |
| Actions | — | 120px | — | Per-row `size-7` Edit pencil + Delete trash; restricted-code rows show the buttons disabled with a tooltip |

### 2.2 Inline create / edit row

Matches the legacy `<tfoot>` block in comm_0223_001_view.jsp:226-322 _(external reference — not included in this repository)_. React state in `ChartOfAccountsPanel`:

```tsx
const [editingSeqNo, setEditingSeqNo] = useState<number | null | "new">(null);
// null      → no row in edit mode
// "new"     → inline create row visible at the table bottom
// <number>  → editing the row with that seq_no
```

- Clicking **+ Add A New Account** sets `editingSeqNo = "new"` and renders the `<CreateRow>` form at the bottom of `<tbody>`.
- Clicking the per-row pencil sets `editingSeqNo = row.chartAcctSeqNo` and replaces that row's `<td>` content with the `<EditRow>` form. Other rows stay static.
- Cancel resets `editingSeqNo = null` and discards local state. Save fires the appropriate API call and resets on success.
- Saving an edit on a restricted-code row is a no-op (the form is never opened for those rows — pencil is disabled).

### 2.3 Parent picker

Uses the `GET /api/v1/settings/chart-of-accounts/tree` response. Renders as a dropdown with breadcrumb-style labels (`ACC-01 - REVENUE`, `ACC-01 - REVENUE / 1007009 - Collection 4`, …) — matches legacy `CHART_ACCT_DIPS_NAME`.

Disabled options:
- The row being edited (no self-parent).
- Any descendant of the row being edited (no cycle).
- Any node already at level 4 (creating a child would breach the depth cap).

These are advisory client-side gates — the backend validators in `ChartOfAccountsValidator` _(wecms-api backend repo — not included in this clone)_ are the source of truth and reject malformed Save attempts with the proper error code routed through `useDialog()`.

---

## 3. Shared component reuse

Per [wecms-web/CLAUDE.md](../../../CLAUDE.md) §"Shared / Common Code Rules", every cross-cutting concern goes through the shared module. Inventory for this panel:

| Concern | Shared module | Notes |
|---|---|---|
| Panel chrome | [`<SettingsModal>`](../../../components/settings/SettingsModal.tsx) | Already mounts the panel. No change. |
| Sidebar entry | [`<SettingsNav>`](../../../components/settings/SettingsNav.tsx) | One new entry in the appropriate group. |
| Search input | [`<SearchInput>`](../../../components/shared/SearchInput.tsx) | Filter by code or EN name. |
| Status pill | [`<StatusBadge>`](../../../components/payment/approval-box/StatusBadge.tsx) | Active / Inactive variants. |
| System dialogs | [`useDialog()`](../../../components/shared/dialog/) | Confirmation on delete; error / success on save. |
| Excel upload modal | [`<ExcelUploadDialog>`](../../../components/shared/excel-upload/ExcelUploadDialog.tsx) | Phase-2 wiring; Phase-1 keeps the inert wrapper at [`components/settings/chart-of-accounts/ExcelUploadDialog.tsx`](../../../components/settings/chart-of-accounts/ExcelUploadDialog.tsx) (already canonical for the shared shell). |
| Table header cell w/ sort | [`<TableHeaderCell>`](../../../components/shared/TableHeaderCell.tsx) | Sort glyph + click-to-cycle wiring. |
| Sort hook | [`useTableSort()`](../../../hooks/useTableSort.ts) | Cycle state owned by the panel. |
| HTTP transport | [`api`](../../../lib/axios.ts) | JWT auto-attached. |
| API fetch hook | [`useApiData()`](../../../lib/api/useApiData.ts) | Initial load + refetch on filter/sort change. |
| Currency / date helpers | not needed (no monetary or date inputs on this panel) | — |

**Do not** introduce new shared components. The static UI is already shaped to consume all of the above.

**Do not** adopt View Setting (per OQ-6 default — skip; legacy panel has no list-icon button, same precedent as Approval Line). The `SCREEN_IDS.SETTINGS_CHART_OF_ACCOUNTS = "chart-of-accounts"` entry should still be reserved in [`viewSettingScreens.ts`](../../../lib/viewSettingScreens.ts) so log tags / audit slugs / a possible future popover share one canonical id.

---

## 4. State, hooks, fetchers

### 4.1 New fetchers in `lib/api/settings.ts`

```ts
// snake_case wire types — match the backend DTOs exactly.
export interface ApiChartOfAccountRow {
    chart_acct_seq_no:    number;
    chart_acct_cd:        string;
    chart_acct_nm_en:     string;
    chart_acct_nm_vn:     string | null;
    chart_acct_nm_ko:     string | null;
    chart_acct_type:      string | null;
    parent_chart_acct_cd: string | null;
    cal_rule:             "P" | "M" | null;
    stts:                 "A" | "I";
    chart_acct_level:     number | null;   // 1..4 or null for orphaned rows
    has_children:         boolean;
    restricted:           boolean;
    reg_id:               string;
    reg_dtm:              string;          // ISO-8601
    mod_id:               string;
    mod_dtm:              string;          // ISO-8601
}

export interface ApiChartOfAccountListResponse {
    items:            ApiChartOfAccountRow[];
    total_count:      number;
    restricted_codes: string[];            // ["ACC-01","ACC-02","ACC-03"]
}

export interface ApiChartOfAccountTreeNode {
    chart_acct_seq_no:    number;
    chart_acct_cd:        string;
    chart_acct_nm_en:     string;
    parent_chart_acct_cd: string | null;
    chart_acct_level:     number;          // 1..4
    has_children:         boolean;
    restricted:           boolean;
    breadcrumb:           string;
}

export interface ApiChartOfAccountTreeResponse {
    nodes: ApiChartOfAccountTreeNode[];
}

// Fetchers
export async function fetchChartOfAccounts(params: {
    search?:         string;
    stts?:           "A" | "I";
    sortField?:      string;
    sortDirection?:  "ASC" | "DESC";
}): Promise<ApiChartOfAccountListResponse> { /* GET … */ }

export async function fetchChartOfAccountsTree(): Promise<ApiChartOfAccountTreeResponse> { /* GET .../tree */ }

export async function createChartOfAccount(payload: {
    chart_acct_cd:        string;
    chart_acct_nm_en:     string;
    chart_acct_nm_vn?:    string;
    chart_acct_nm_ko?:    string;
    chart_acct_type?:     string;
    parent_chart_acct_cd?: string | null;
    cal_rule?:            "P" | "M" | null;
    stts:                 "A" | "I";
}): Promise<ApiChartOfAccountRow> { /* POST */ }

export async function updateChartOfAccount(
    seqNo:   number,
    payload: /* same shape as create */,
): Promise<ApiChartOfAccountRow> { /* PUT .../{seqNo} */ }

export async function deleteChartOfAccount(seqNo: number): Promise<void> { /* DELETE .../{seqNo} */ }
```

These live in `lib/api/settings.ts` next to the existing `fetchContacts*` / `fetchApprovalLine*` families.

### 4.2 In-memory types in `components/settings/chart-of-accounts/types.ts`

Per the three-layer naming rule in [wecms-web/CLAUDE.md](../../../CLAUDE.md) §"API Naming & Serialization Standards" — frontend in-memory types are camelCase with semantic full words:

```ts
export interface ChartOfAccountRow {
    chartAcctSeqNo:     number;
    chartAcctCd:        string;
    chartAcctNmEn:      string;
    chartAcctNmVn:      string | null;
    chartAcctNmKo:      string | null;
    chartAcctType:      string | null;
    parentChartAcctCd:  string | null;
    calRule:            "P" | "M" | null;   // value stays UPPERCASE per the stable-identifier rule
    stts:               "A" | "I";          // same
    chartAcctLevel:     number | null;
    hasChildren:        boolean;
    restricted:         boolean;
    regId:              string;
    regDtm:             string;
    modId:              string;
    modDtm:             string;
}
```

`mappers.ts` (in `lib/api/`) holds the snake → camel translation — extend it with `toChartOfAccountRow(api: ApiChartOfAccountRow): ChartOfAccountRow`.

### 4.3 Panel state

```ts
const ChartOfAccountsPanel = () => {
    const { t } = useTranslation();
    const dialog = useDialog();

    const [search, setSearch]                 = useState("");
    const [stts, setStts]                     = useState<"A" | "I" | undefined>(undefined);
    const { sortField, sortDirection, toggleSort } = useTableSort();
    const [editingSeqNo, setEditingSeqNo]     = useState<number | "new" | null>(null);
    const [refreshKey, setRefreshKey]         = useState(0);

    const { data, loading, error } = useApiData(
        () => fetchChartOfAccounts({ search, stts, sortField, sortDirection }),
        [search, stts, sortField, sortDirection, refreshKey],
    );
    const { data: tree } = useApiData(
        () => fetchChartOfAccountsTree(),
        [refreshKey],   // refetch on every mutation so parent picker stays current
    );
    ...
};
```

`refreshKey` bumps after every successful Create / Update / Delete so the list AND the tree re-fetch — keeps the parent picker honest about `has_children` after a re-parent.

---

## 5. Mutation handlers

### 5.1 Save (Create OR Update)

```ts
async function handleSave(form: ChartOfAccountFormState) {
    try {
        if (editingSeqNo === "new") {
            await createChartOfAccount(form);
        } else if (typeof editingSeqNo === "number") {
            await updateChartOfAccount(editingSeqNo, form);
        }
        setEditingSeqNo(null);
        setRefreshKey((k) => k + 1);
        dialog.open({
            type: "success",
            title: t("dialog.success"),
            description: t("settings.chart_of_accounts.saved"),
        });
    } catch (e) {
        if (e instanceof ApiCallError) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: e.message,         // backend ships the localized string
                errorCode: e.code,              // WBE_CHART_OF_ACCOUNTS_*
                traceId: e.traceId,
            });
        } else {
            throw e;                            // network / parse → global handler
        }
    }
}
```

The frontend does NOT pre-validate cycles / depth / restricted codes — the backend is the source of truth. Client-side disables on the parent picker are visual hints only.

### 5.2 Delete

Confirmation through `useDialog()` per [§3a Dialog variant rule](../../../CLAUDE.md):

```ts
function handleDelete(row: ChartOfAccountRow) {
    if (row.restricted) return;     // pencil/trash are already disabled, defensive

    dialog.open({
        type: "confirmation",
        title: t("dialog.confirmation"),
        description: t("settings.chart_of_accounts.delete_confirm", {
            code: row.chartAcctCd,
            name: row.chartAcctNmEn,
        }),
        confirmText: t("dialog.continue"),
        cancelText:  t("dialog.cancel"),
        onConfirm: async () => {
            try {
                await deleteChartOfAccount(row.chartAcctSeqNo);
                setRefreshKey((k) => k + 1);
                dialog.open({
                    type: "success",
                    title: t("dialog.success"),
                    description: t("settings.chart_of_accounts.deleted"),
                });
            } catch (e) {
                if (e instanceof ApiCallError) {
                    dialog.open({
                        type: "error",
                        title: t("dialog.error"),
                        description: e.message,
                        errorCode: e.code,
                        traceId: e.traceId,
                    });
                } else { throw e; }
            }
        },
    });
}
```

`destructive: true` is intentionally NOT set — Settings → Chart of Accounts delete is a soft-delete that auto-cascades child re-parenting. The standard blue Continue matches the Figma "Confirmation" component pattern. Restricted-code rows would have already been gated client-side, but the backend defense-in-depth (`WBE_CHART_OF_ACCOUNTS_RESTRICTED_CODE`) still surfaces correctly via `useDialog().open({ type: "error", … })` if a malformed request slips through.

---

## 6. i18n keys

Add to [`locales/en.json`](../../../locales/en.json) / `ko.json` / `vi.json` in the same MR as the panel wiring. EN strings are normative; KO from the legacy dictionary; VI from existing translator pass (omit the locale entry rather than guess per [§13a-bis](../../../CLAUDE.md)).

```json
{
  "settings.chart_of_accounts.title":              "Chart of Accounts",
  "settings.chart_of_accounts.subtitle":           "Setup Reporting Accounts to record financial data",
  "settings.chart_of_accounts.search_placeholder": "Search",
  "settings.chart_of_accounts.add_button":         "Add A New Account",
  "settings.chart_of_accounts.excel_upload":       "Excel Upload",

  "settings.chart_of_accounts.column.account_code":    "Account Code",
  "settings.chart_of_accounts.column.name_en":         "Account Name (English)",
  "settings.chart_of_accounts.column.name_vn":         "Account Name (Vietnamese)",
  "settings.chart_of_accounts.column.name_ko":         "Account Name (Korean)",
  "settings.chart_of_accounts.column.parent_account":  "Parent Account",
  "settings.chart_of_accounts.column.cal_rule":        "Cal Rule",
  "settings.chart_of_accounts.column.status":          "Status",
  "settings.chart_of_accounts.column.actions":         "Actions",

  "settings.chart_of_accounts.status.active":          "Active",
  "settings.chart_of_accounts.status.inactive":        "Inactive",

  "settings.chart_of_accounts.placeholder.code":       "Enter Code*",
  "settings.chart_of_accounts.placeholder.name_en":    "Enter Name* (English)",
  "settings.chart_of_accounts.placeholder.name_vn":    "Enter Name (Vietnamese)",
  "settings.chart_of_accounts.placeholder.name_ko":    "Enter Name (Korean)",
  "settings.chart_of_accounts.placeholder.parent":     "Select Parent Account *",

  "settings.chart_of_accounts.button.save":            "Save",
  "settings.chart_of_accounts.button.cancel":          "Cancel",

  "settings.chart_of_accounts.delete_confirm":         "Delete account \"{code} - {name}\"? Children will be re-parented to the deleted account's parent.",
  "settings.chart_of_accounts.saved":                  "Account saved.",
  "settings.chart_of_accounts.deleted":                "Account deleted.",

  "settings.chart_of_accounts.restricted.acc_01":      "REVENUE",
  "settings.chart_of_accounts.restricted.acc_02":      "EXPENSES",
  "settings.chart_of_accounts.restricted.acc_03":      "INVESTMENT"
}
```

The wire's `restricted: true` flag on a list row + the row's `chart_acct_cd` are enough — the frontend looks up the matching `restricted.<lowercased_code_with_underscore>` key for the localized display name when rendering the row, falling back to the wire `chart_acct_nm_en` if the key is missing.

---

## 7. Typography + tokens

Every text surface goes through the WB365 tokens in [`app/globals.css`](../../../app/globals.css) `@theme inline` — no `text-[Npx]`, no inline `style`. Per [§3b Settings page typography](../../../CLAUDE.md):

- Panel header title: `text-wb-18 font-semibold tracking-wb-tight text-wb-dark`
- Subtitle: `mt-1 text-wb-13 font-normal text-wb-muted`
- Table header cells: `text-wb-13 font-semibold text-wb-dark`
- Table body cells: `text-wb-13 font-medium text-wb-ink`
- Buttons (Save / Cancel + Add CTA): `h-8 px-3 text-wb-14-tight font-medium` per [§3b button taxonomy](../../../CLAUDE.md). Primary `bg-brand + shadow-wb-brand-btn + text-white`; secondary `bg-white + shadow-wb-btn + text-wb-ink`.
- Excel Upload chip uses the documented exception `bg-[#1f7a4d]` + `hover:bg-[#196439]` (Figma brand-asset green, per [§3b §F intentional exceptions](../../../CLAUDE.md)).

Verified: no new tokens are required for this panel.

---

## 8. Responsive

Settings modal shell at 1300×760 (fixed per [§3a](../../../CLAUDE.md)). On smaller viewports the modal falls back to `max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)]` — the panel's `custom-scrollbar` scroll region absorbs the height delta, the table scrolls horizontally inside the same region when the column sum exceeds the panel width.

No special breakpoint logic in `ChartOfAccountsPanel` — the shell + shared scrollbar utilities handle it.

---

## 9. Loading / optimistic state

- **Initial load:** `useApiData` returns `{ data: null, loading: true }` until the first response. Render an empty `<tbody>` + a centered skeleton (or just spinner — match existing Settings panels) inside the scroll region. The header + filter row stay rendered.
- **Mutation in flight:** disable the Save button + show a small spinner glyph next to it. Do NOT optimistically prepend / patch the list row — the success dialog + `refreshKey` bump is fast enough and avoids drift when the backend rejects.
- **Error from `useApiData`:** render a small "Failed to load — try again" inline message in the empty `<tbody>`. The error code (if `ApiCallError`) is logged to console for debugging; not surfaced as a dialog (matches the existing Settings panel UX — only mutations surface system dialogs).

---

## 10. Excel bulk upload (Phase 2)

The static-UI wrapper `<ChartOfAccountsExcelUploadDialog>` already exists at [`components/settings/chart-of-accounts/ExcelUploadDialog.tsx`](../../../components/settings/chart-of-accounts/ExcelUploadDialog.tsx) — it's the canonical example for the shared `<ExcelUploadDialog>` per [§3a](../../../CLAUDE.md).

Phase 1: no change. Upload button stays default-disabled.

Phase 2:
1. Wire `onDownload` → static template download (Excel file shipped under `public/assets/templates/chart-of-accounts.xlsx`; columns: code, name_en, name_vn, name_ko, parent_code, cal_rule, stts).
2. Wire `onReSelect` → file picker.
3. Wire `onUpload` → `POST /api/v1/settings/chart-of-accounts/bulk-import` (multipart). Response is `BulkImportResult { processed: number; failed: { row_index, code, error_code, error_message }[] }`. Render `completedCount` / `errorCount` chips in the dialog footer.
4. Per-cell error highlighting renders via the existing `rows[i].column.error` shape on the shared dialog.

---

## 11. View Setting + Sort

- **View Setting:** NOT adopted (OQ-6 default). The panel toolbar has no list-icon button — same as Approval Line / Contacts / VAS Account / Purpose Settings. `SCREEN_IDS.SETTINGS_CHART_OF_ACCOUNTS = "chart-of-accounts"` is still reserved in `viewSettingScreens.ts` so audit-log MDC tags + future popover wiring share one canonical slug.
- **Sort:** wires via [`useTableSort()`](../../../hooks/useTableSort.ts) + [`<TableHeaderCell sortable={…}>`](../../../components/shared/TableHeaderCell.tsx). Whitelist: `CHART_ACCT_CD`, `CHART_ACCT_NM_EN`, `STTS`, `MOD_DTM`. The cycle is `default → ASC → DESC → default`; default state ships no `sort_field` / `sort_direction` query params and the backend falls back to `CHART_ACCT_CD ASC`.

---

## 12. Verification checklist (pre-merge)

- [ ] Panel composes `<SettingsModal>` shell + `<SettingsNav>` entry — no top-level Next.js route added.
- [ ] All wire types in `lib/api/settings.ts` are lowercase snake_case; in-memory types in `types.ts` are camelCase semantic.
- [ ] No raw `response.data.chart_acct_seq_no` access inside `ChartOfAccountsPanel` — the mapper does the translation.
- [ ] Save errors surface through `useDialog().open({ type: "error", errorCode, traceId })` — never as inline banners.
- [ ] Delete confirmation goes through `useDialog({ type: "confirmation", destructive: false })` — soft-delete is not destructive design.
- [ ] No `text-[Npx]` / `font-[N]` / inline `style={{ fontFamily | fontSize | fontWeight | lineHeight }}` anywhere in the panel.
- [ ] Restricted-code rows (ACC-01/02/03) render with disabled Edit + Delete buttons + a tooltip.
- [ ] Parent-picker dropdown disables self, descendants of editing row, and any node at level 4.
- [ ] Sort glyphs only appear on the four whitelisted columns; clicking cycles default → ASC → DESC → default.
- [ ] All visible strings flow through `t(…)` and exist in `en.json` (KO/VI optional in Phase 1 per existing precedent).
- [ ] Excel Upload chip is rendered but Upload button is disabled (Phase 1 — Phase 2 wires the real endpoint).
- [ ] View Setting popover is NOT rendered (OQ-6).
- [ ] Settings modal Esc / X dismiss still works while the panel is mounted; the panel doesn't trap focus outside the modal shell.

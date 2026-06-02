# ERP Transaction History — Next.js frontend design

**Refactor slug:** `erp-transaction-history`
**Sibling docs:** [feature spec](transaction-history.md) · migration map _(wecms-api backend repo — not included in this clone)_ · DB schema _(wecms-api backend repo — not included in this clone)_ · backend design _(wecms-api backend repo — not included in this clone)_ · plan _(wecms-api backend repo — not included in this clone)_.
**Frontend stack:** Next.js 16 (App Router) + Tailwind 4 + shadcn/ui (per [wecms-web/CLAUDE.md](../../../CLAUDE.md)).
**Placement:** Settings modal panel — NOT a standalone `/settings/erp-transaction-history` route. Mirrors `<FirmBankingHistoryPanel>` precedent.

---

## 1. Folder rename

The current static-UI panel lives at `components/settings/transaction-history/`. The slug rule in workspace CLAUDE.md §"Cross-Tree Rules → Refactor work" _(external reference — not included in this repository)_ requires the kebab-case slug on both sides to match the JEX counterpart. The JEX counterpart is `comm_0219_001` ("ERP Transaction History") — distinct from the Banking > Transaction History feature (`/banking/transaction-history` → JEX `comm_0220_001` family) which also has a folder under `components/banking/transaction-history/`.

To avoid the slug collision:

| Module | Slug | JEX | Frontend folder |
|---|---|---|---|
| Banking > Transaction History | `transaction-history` | `comm_0220_001` (Account transaction history) | `components/banking/transaction-history/` |
| Settings > ERP Transaction History | **`erp-transaction-history`** | `comm_0219_001` | **`components/settings/erp-transaction-history/`** (rename) |

The Phase 3 MR renames the folder + files in one atomic commit:

```
components/settings/transaction-history/ → components/settings/erp-transaction-history/
  TransactionHistoryPanel.tsx           → ErpTransactionHistoryPanel.tsx
  TransactionHistoryFilters.tsx         → ErpTransactionHistoryFilters.tsx
  TransactionHistoryTable.tsx           → ErpTransactionHistoryTable.tsx
  TransactionHistoryTabs.tsx            → ErpTransactionHistoryTabs.tsx
  mockData.ts                           → mockData.ts (renamed exports inside)
  types.ts                              → types.ts (renamed types inside)
```

`SettingsNav` entry (the row that mounts this panel inside `<SettingsModal>`) flips from importing `<TransactionHistoryPanel>` to `<ErpTransactionHistoryPanel>` — verify in [components/settings/SettingsNav.tsx](../../../components/settings/SettingsNav.tsx).

Localisation keys move from `settings.transaction_history.*` → `settings.erp_transaction_history.*` in `locales/{en,ko,vi}.json` (delete the old keys in the same MR; the existing static-UI strings are direct ports of the JEX `comm_0219_001_m*` labels, but the namespace was wrong for the slug).

---

## 2. Route / placement

This screen is a **Settings modal panel**, not a route. The Settings modal already mounts every panel via `<SettingsNav>` + `<SettingsModal>`. No `app/` changes required for Phase 3 — only the panel component and its dependencies.

The legacy JEX page (`comm_0219_001.act`) is also a settings sub-page in the live system (Settings → ERP Transaction History tab); the refactor preserves the same modal placement, mirroring `<FirmBankingHistoryPanel>`.

---

## 3. Component tree

```
<SettingsModal>
└── <ErpTransactionHistoryPanel>                                  (state owner)
    ├── Header row    — title + description + (no right-side action button)
    ├── Tabs          — <ErpTransactionHistoryTabs>               (All / WeCMS → ERP / ERP → WeCMS / Deleted)
    ├── Filters       — <ErpTransactionHistoryFilters>            (date range + type dropdown + search)
    ├── Scroll region — flex-1 custom-scrollbar
    │   └── <ErpTransactionHistoryTable>                          (bare <table> + colgroup + sticky thead)
    └── Pagination    — shared <Pagination> (outside scroll region per §3a)

All four tabs are always visible — refactor is product-agnostic (OQ-2,
2026-05-11). No `prdtType` branching anywhere in the panel.
```

State owner is `<ErpTransactionHistoryPanel>`. Filter / tab / sort / pagination state lives there; the child components are presentational and forward events back via callbacks. Mirrors the `<FirmBankingHistoryPanel>` ownership shape.

---

## 4. Panel composition

Per [wecms-web/CLAUDE.md §"3a. Settings Popup — Modal Shell + Panel Composition"](../../../CLAUDE.md):

```tsx
<div className="flex min-h-0 flex-1 flex-col">
    <Header />                                                     {/* shrink-0; pr-24 to clear shell Esc/X (no right-side action button) */}
    <Tabs />                                                       {/* shrink-0 */}
    <Filters />                                                    {/* shrink-0 */}
    <div className="min-h-0 flex-1 overflow-hidden">               {/* scroll container — owns vertical scroll */}
        <div className="custom-scrollbar h-full overflow-auto">
            <Table />
        </div>
    </div>
    <Pagination className="shrink-0" />                            {/* outside scroll region */}
</div>
```

Tokens:
- Header — `text-page-title` (18 / 500) per workspace typography rules, leading `pt-14 pr-24` per the panel shell contract.
- Description — `text-wb-13 font-normal text-wb-muted`.
- Filter chips — `h-[var(--h-wb-filter-btn)]`.
- Table — bare `<table>` + `<colgroup>` + sticky `<thead>` per [§7](../../../CLAUDE.md).

---

## 5. Wire types (`lib/types/api.ts`)

```ts
export interface ApiErpTransactionHistoryRow {
    seq_no:         number;
    org_file_nm:    string;
    save_file_nm:   string;
    file_size:      number;
    erp_type:       "W" | "E" | "D";
    erp_type_key:   string;          // "settings.erp_transaction_history.direction.<…>"
    trns_type_cd:   string;          // "01".."17"
    trns_type_key:  string;          // "settings.erp_transaction_history.type.<NN>"
    reg_dtm:        string;          // yyyyMMddHHmmss
    reg_id:         string;
    user_nm:        string | null;   // null for SYSTEM / removed users → frontend falls back to reg_id
}

export interface ApiErpTransactionHistoryListResponse {
    list:                ApiErpTransactionHistoryRow[];
    total_count:         number;
    total_count_wecms:   number;
    total_count_erp:     number;
    total_count_deleted: number;
    total_pages:         number;
    page_number:         number;    // 1-based
    page_size:           number;
}
```

Per [wecms-web/CLAUDE.md §"API Naming"](../../../CLAUDE.md) — wire properties stay snake_case; the codes (`"W"` / `"01"`) are stable identifier values that remain UPPERCASE.

---

## 6. API client (`lib/api/erpTransactionHistory.ts`)

```ts
import { api } from "@/lib/axios";
import { unwrapData, type ApiCallError } from "./errors";
import type {
    ApiErpTransactionHistoryListResponse,
} from "@/lib/types/api";

export type ErpDirection = "all" | "W" | "E" | "D";

export interface FetchErpTransactionHistoryParams {
    fromDt: string;                 // YYYYMMDD
    toDt:   string;                 // YYYYMMDD
    direction?: ErpDirection;       // tab — "all" omits erp_type
    trnsTypeCd?: string;            // "" or undefined → omit
    keyword?: string;
    page?: number;                  // 1-based
    pageSize?: number;
    sortField?: string;             // uppercase FIELD_ID
    sortDirection?: "ASC" | "DESC" | null;
}

export async function fetchErpTransactionHistory(
    p: FetchErpTransactionHistoryParams,
    signal?: AbortSignal,
): Promise<ApiErpTransactionHistoryListResponse> {
    const params: Record<string, string | number> = {
        from_dt: p.fromDt,
        to_dt:   p.toDt,
    };
    if (p.direction && p.direction !== "all") params.erp_type = p.direction;
    if (p.trnsTypeCd)                          params.trns_type_cd = p.trnsTypeCd;
    if (p.keyword?.trim())                     params.srch_wd = p.keyword.trim();
    if (p.page)                                params.page = p.page;
    if (p.pageSize)                            params.page_size = p.pageSize;
    if (p.sortField && p.sortDirection) {
        params.sort_field     = p.sortField;
        params.sort_direction = p.sortDirection;
    }
    const res = await api.get<unknown>("/api/v1/settings/erp-transaction-history", { params, signal });
    return unwrapData<ApiErpTransactionHistoryListResponse>(res.data);
}

export function getErpTransactionHistoryDownloadUrl(seqNo: number): string {
    /* OQ-FE-1 resolved 2026-05-11: download is dispatched via `lib/file.ts`
       `downloadFile(url, filename)` — axios + blob + synthetic <a> click.
       This helper returns the canonical URL (relative path is fine; the axios
       baseURL prefixes it). The caller passes the URL + the row's orgFileNm
       as the fallback filename; the real filename comes from the backend's
       `Content-Disposition` header. */
    return `/api/v1/settings/erp-transaction-history/${seqNo}/download`;
}
```

Errors surface through `ApiCallError` per the project convention.

---

## 7. Mapper (`lib/api/mappers.ts`)

```ts
import type { ApiErpTransactionHistoryRow } from "@/lib/types/api";
import type { ErpTransactionHistoryRow } from "@/components/settings/erp-transaction-history/types";

export function mapErpTransactionHistoryRow(
    wire: ApiErpTransactionHistoryRow,
): ErpTransactionHistoryRow {
    return {
        seqNo:       wire.seq_no,
        orgFileNm:   wire.org_file_nm,
        saveFileNm:  wire.save_file_nm,
        fileSize:    wire.file_size,
        erpType:     wire.erp_type,
        erpTypeKey:  wire.erp_type_key,
        trnsTypeCd:  wire.trns_type_cd,
        trnsTypeKey: wire.trns_type_key,
        regDtm:      wire.reg_dtm,
        regId:       wire.reg_id,
        userNm:      wire.user_nm,
    };
}
```

Pages consume `ErpTransactionHistoryRow` (camelCase semantic) exclusively;
the wire shape stays inside `lib/types/api.ts` + this mapper.

---

## 8. Frontend in-memory types (`components/settings/erp-transaction-history/types.ts`)

```ts
export type ErpDirection = "W" | "E" | "D";
export type ErpTransactionHistoryTabKey = "all" | "W" | "E" | "D";

export interface ErpTransactionHistoryRow {
    seqNo:       number;
    orgFileNm:   string;
    saveFileNm:  string;
    fileSize:    number;
    erpType:     ErpDirection;
    erpTypeKey:  string;
    trnsTypeCd:  string;
    trnsTypeKey: string;
    regDtm:      string;            // raw yyyyMMddHHmmss; format via lib/datetime.ts at render time
    regId:       string;
    userNm:      string | null;
}

export interface ErpTransactionHistoryCounts {
    all:     number;
    wecms:   number;
    erp:     number;
    deleted: number;
}
```

Tab key matches the JEX `data-option` attribute (`comm_0219_001_view.jsp:103-129` _(external reference — not included in this repository)_) — empty / `""` becomes `"all"` here for type safety.

---

## 9. View Setting integration

**Not adopted (OQ-FE-2, resolved 2026-05-11).** The legacy JEX panel
has no toolbar action group, and the refactor mirrors that contract. No
list-icon button, no `<ViewSettingPopover>` mount, no
`SCREEN_IDS.ERP_TRANSACTION_HISTORY` registry entry, no
`SYS_SCR_OPTION_WECMS` seed.

Column visibility / order / size are hardcoded in the panel's static
`<colgroup>` (see §13). If a future product requirement adds the toolbar
list-icon button, adoption becomes a single MR that follows the pattern in
[wecms-web/CLAUDE.md §13](../../../CLAUDE.md) — adds
`SCREEN_IDS.ERP_TRANSACTION_HISTORY`, declares `COLUMN_REGISTRY` + `FALLBACK_COLUMNS`,
seeds `SYS_SCR_OPTION_WECMS` in the same MR, mounts `<ViewSettingPopover>`,
and adds `<PageActionButtons showList onList={…} />` above the tabs.
Table sort (§10) does not change — `<TableHeaderCell sortable={true/false}>`
already declares the per-column flag directly.

---

## 10. Table sort

Per [wecms-web/CLAUDE.md §13a](../../../CLAUDE.md) — go through `useTableSort()` + `<TableHeaderCell sortable={true|false} sortFieldId={…} activeSortField={…} activeSortDirection={…} onSort={toggleSort}>`. The sort cycle is fixed (`default → ASC → DESC → default`); state lives at the panel level; the API call forwards `sortField` + `sortDirection` to the backend; rows are never re-sorted on the frontend.

Because View Setting is not adopted for this panel (§9), the `sortable`
flag per column is declared directly in the table component — no
`SORT_YN` lookup. Sortable FIELD_IDs (matches backend
`ErpTrnsHistorySortField`):

| FIELD_ID | Column | `sortable` prop |
|---|---|---|
| `REG_DTM` | Date | `true` |
| `ERP_TYPE` | Type | `true` |
| `TRNS_TYPE_CD` | Transaction Type | `true` |
| `FILE` | File | `false` (OQ-5 — JEX shows glyph but no IDO column to sort on) |
| `REG_USER` | User | `true` |

---

## 11. Filters (`<ErpTransactionHistoryFilters>`)

Mirror the JEX filter row (comm_0219_001_view.jsp:166-331 _(external reference — not included in this repository)_):

| Control | Component |
|---|---|
| Date range — Last 30 / 90 / 180 days + Enter Manually | Shared [`<InteractiveDateRangePicker>`](../../../components/shared/InteractiveDateRangePicker.tsx) — the same component `<FirmBankingHistoryPanel>` uses. Default seed = last 30 days (mirrors JEX `setDatePicker(30)`). |
| Transaction Type dropdown (1 + 17 options; product-agnostic) | shadcn `<Select>` + a per-tab visible-option list computed via `useMemo(visibleTransactionTypes(tab), [tab])` |
| Keyword search (`reg_id` ILIKE %X%) | shared `<SearchInput>` with `useDebounce(value, 400)` |

Per OQ-2 (2026-05-11), the refactor is product-agnostic — no `prdtType` is
read or branched on. The only universal filter preserved from
comm_0219_001.ts:482-510 _(external reference — not included in this repository)_
is the Deleted-tab scheduled-payment subset:

```ts
function visibleTransactionTypes(tab: ErpTransactionHistoryTabKey): readonly string[] {
    if (tab === "D") return ["", "02", "03", "12", "13", "16"];   // legacy universal filter
    return ALL_TRANSACTION_TYPES;                                  // every other tab shows all 17 codes
}
```

When the active selection is hidden by a tab switch (only happens when
flipping into the Deleted tab while a non-scheduled-payment type is
selected), reset to `""` (All) — same as JEX.

---

## 12. Tabs (`<ErpTransactionHistoryTabs>`)

Four tabs: All / WeCMS → ERP / ERP → WeCMS / Deleted. **All four always visible** — refactor is product-agnostic (OQ-2, 2026-05-11).

Each tab carries a count chip wired to `counts.{all|wecms|erp|deleted}`. Counts always come from the backend's same response (one round trip per filter change).

---

## 13. Table (`<ErpTransactionHistoryTable>`)

Bare `<table>` + `<colgroup>` + sticky `<thead>` + `<tbody>` per [§7](../../../CLAUDE.md). Five columns:

| Width | Header | Body |
|---|---|---|
| `146px` | Date | Two-line stack: `formatDate(regDtm, langCode)` + `time` muted |
| auto | Type | `t(row.erpTypeKey)` → falls back to legacy `ErpType.getLabel()` if key not registered |
| `280px` | Transaction Type | `t(row.trnsTypeKey)` |
| `280px` | File | When `fileSize > 0`: render `<button type="button" onClick={() => downloadFile(getErpTransactionHistoryDownloadUrl(row.seqNo), row.orgFileNm)}>` styled as a blue link with 2-line ellipsis (`line-clamp-2` Tailwind utility). The element is a button (not an `<a href>`) because OQ-FE-1 chose XHR+blob — the JWT lives in `localStorage` and a plain anchor would not carry it. Otherwise: empty cell. |
| `125px` | User | `row.userNm ?? row.regId` |

The File column is **always present** in the layout — refactor is
product-agnostic (OQ-2). Per-row visibility still depends on `fileSize > 0`
(rows representing batch runs with no physical file render an empty `<td>`),
but the column header and `<col>` are never hidden.

Empty state: `<tr><td colspan={5}>{t("settings.erp_transaction_history.empty")}</td></tr>` — centered, muted, no border.

---

## 14. Pagination

Shared `<Pagination>` + `usePagination` per [§4](../../../CLAUDE.md). Page-size options `[10, 20, 50, 100]` (project default); JEX legacy used `[15, 20, 50, 100]` but the refactor follows the global `PAGE_SIZE_OPTIONS` constant — no per-page override.

`usePagination`'s `resetPage()` is wired into every filter `onChange` handler (date range / tab / type dropdown / debounced keyword) so a filter change always returns to page 1.

---

## 15. Data fetching

```ts
const debouncedKeyword = useDebounce(keyword, 400);
const tabToDirection: Record<ErpTransactionHistoryTabKey, ErpDirection | "all"> = {
    all: "all", W: "W", E: "E", D: "D",
};

const params = useMemo<FetchErpTransactionHistoryParams>(() => ({
    fromDt:       toYYYYMMDD(dateRange.start),
    toDt:         toYYYYMMDD(dateRange.end),
    direction:    tabToDirection[activeTab],
    trnsTypeCd:   transactionType === "all" ? undefined : transactionType,
    keyword:      debouncedKeyword,
    page:         pagination.page,
    pageSize:     pagination.pageSize,
    sortField:    sort.sortField ?? undefined,
    sortDirection:sort.sortDirection ?? undefined,
}), [dateRange, activeTab, transactionType, debouncedKeyword, pagination.page, pagination.pageSize, sort]);

const { data, error, isLoading } = useApiData(
    () => fetchErpTransactionHistory(params),
    [params]
);

const rows = useMemo(() => (data?.list ?? []).map(mapErpTransactionHistoryRow), [data]);
const counts = useMemo<ErpTransactionHistoryCounts>(() => ({
    all:     data?.total_count         ?? 0,
    wecms:   data?.total_count_wecms   ?? 0,
    erp:     data?.total_count_erp     ?? 0,
    deleted: data?.total_count_deleted ?? 0,
}), [data]);
```

Errors → `useDialog().open({ type: "error", errorCode: error.code, description: error.message })` — never render a bespoke error banner per page.

Mock fallback: keep the existing `mockData.ts` exports available as the
"offline-dev affordance" pattern from `<FirmBankingHistoryPanel>`, but
flip the active path to the live API — the mock is consulted only when
the API errors / returns empty during local dev with no backend.

---

## 16. Zod schema

Filter inputs are mostly controlled by shared components (date picker, dropdowns) and don't require a Zod schema. The only freeform input is the keyword:

```ts
const KeywordSchema = z.string().max(100, { message: "settings.erp_transaction_history.errors.keyword_too_long" });
```

Used inside the search input handler to validate before queuing the API call — failure shows `useDialog()` error with the message key.

---

## 17. i18n keys

Adds the `settings.erp_transaction_history.*` namespace to `locales/{en,ko,vi}.json`. Full list in migration doc §8 _(wecms-api backend repo — not included in this clone)_.

Verified translations:
- EN — `ErpType.getLabel()` + `ErpTypeCd.getLabel()` (ErpType.java _(external reference — not included in this repository)_, ErpTypeCd.java _(external reference — not included in this repository)_).
- KO / VI — pending verified translation per `dictionary_{ko,vi}.properties` review. Where verified entries do not exist, omit the key in that locale file and rely on the EN fallback (wecms-api/CLAUDE.md §"Domain enums" _(wecms-api backend repo — not included in this clone)_).

---

## 18. Typography & token usage

All text follows the global typography tokens per the in-repo frontend guide [CLAUDE.md §"Typography & tokens"](../../../CLAUDE.md):

| Element | Token chain |
|---|---|
| Panel title | `text-wb-18 font-semibold tracking-wb-tight text-wb-dark` (≡ `text-page-title`) |
| Description | `text-wb-13 font-normal text-wb-muted` |
| Tab label | `text-wb-13 font-medium` |
| Tab count chip | `text-wb-10` to `text-wb-12 font-medium` |
| Filter chip text | `text-wb-14-tight font-medium` |
| Table header | `text-wb-13 font-semibold text-wb-dark` |
| Table body | `text-wb-13 font-medium text-wb-ink` |
| Sub-line (time) | `text-wb-13 font-medium text-wb-ntrl-6` |
| File link | `text-wb-13 font-medium text-brand` (blue label) with `line-clamp-2` |
| Empty state | `text-wb-13 font-medium text-wb-ntrl-6` |

No arbitrary `text-[Npx]` / `font-[N]` / inline `style={{ fontFamily }}` anywhere in the panel.

---

## 19. Behaviour spec — key flows

### 19.1 Initial mount

1. `<SettingsModal>` opens; `<SettingsNav>` selects "ERP Transaction History"; panel mounts.
2. Date range defaults to last-30-days; activeTab = `"all"`; transactionType = `"all"`; keyword = `""`. No `prdtType` read (OQ-2 — refactor is product-agnostic).
3. `useApiData` fires the initial fetch; counts populate the tab chips; rows populate the table.
4. All four tabs render with their count chips, even when a count is `0`.

### 19.2 Tab switch

1. User clicks a tab → `activeTab` flips → `direction` recomputes → `params` changes.
2. Page resets to 1 via `resetPage()`.
3. If the new tab is Deleted (`D`), the visible transaction-type dropdown options re-filter to the scheduled-payment subset (`""`, `02`, `03`, `12`, `13`, `16`); if the currently-selected type is no longer visible, reset to `"all"`. Flipping *back out* of Deleted restores the full 17-code list.
4. New fetch fires; counts come back in the same response.
5. File column stays visible across every tab.

### 19.3 Filter change

- Date range / type dropdown / keyword (debounced 400 ms) — same flow as tab switch, minus the visibility recalc.

### 19.4 Sort

- Click sortable header → `useTableSort.toggleSort(fieldId)` cycles → `params.sortField` / `params.sortDirection` updates → new fetch → counts unchanged, rows reorder server-side.

### 19.5 File download

1. User clicks the File cell button (it renders as a styled link but the handler is a `<button>` with `onClick`, not a real `<a href>`).
2. Handler calls `downloadFile(getErpTransactionHistoryDownloadUrl(row.seqNo), row.orgFileNm)` from `lib/file.ts`.
3. `downloadFile` issues an axios `GET` with `responseType: "blob"`; the global Bearer interceptor attaches the JWT.
4. Backend resolves the path, streams the bytes with `Content-Disposition: attachment; filename*=UTF-8''<savedName>`.
5. `downloadFile` reads the response `Content-Disposition` header for the canonical filename (falls back to the caller's `orgFileNm`), wraps the body in `URL.createObjectURL(blob)`, triggers a synthetic anchor click, and revokes the blob URL on the next tick.
6. On `WBE2014` / `WBE2015`, the JSON envelope is parsed inside `lib/file.ts` (when the response `Content-Type` is `application/json`); the helper throws `ApiCallError`. The caller routes the error to `useDialog().open({ type: "error", errorCode: e.code, description: e.message })`.

### 19.6 Pagination

- Standard shared `<Pagination>`; page-size change resets to page 1 via the hook.

### 19.7 Session expiry

- Global Axios 401 interceptor in `lib/axios.ts` handles `WBE1009` → opens the re-auth dialog. No per-page handling.

---

## 20. Responsive behaviour

Settings modal is always at desktop / tablet sizes (the modal itself is `1300 × 760` per the shell). Confirm by resizing the parent viewport:

- **≥ 1024 px** — full layout as drawn.
- **768–1023 px** — `<SettingsModal>` falls back to `max-w-[calc(100vw-32px)]` per the shell; filter row wraps via `flex-wrap`; table scrolls horizontally inside its container.
- **< 768 px** — `<SettingsModal>` collapses to full-screen via the shell; filter row stacks; table scrolls horizontally.

Mirrors `<FirmBankingHistoryPanel>` — no per-panel responsive tweaks needed.

---

## 21. Tests

| Layer | Test |
|---|---|
| Component (Jest + React Testing Library) | tab switch resets page; HAENGSUNG hides Deleted tab; HAENGSUNG + `E` tab hides File column; transaction-type dropdown filters per tab; keyword debounce; empty-state renders with correct `colspan`. |
| Mapper unit | `mapErpTransactionHistoryRow` translates every wire field; `user_nm: null` → `userNm: null`. |
| API client unit (msw) | parameter shape — `direction = "all"` omits `erp_type`; empty keyword omits `srch_wd`; sort triplet only included when both ends are present. |
| Manual smoke (Phase 3 sign-off) | mirrors backend §11 manual smoke from the UI; verify File column download fires correctly for `FILE_SIZE > 0` rows. |

---

## 22. Frontend open questions

**OQ-FE-1. Download flow — `<a download>` vs. XHR + blob.** ✅ **Resolved
2026-05-11 (Sokny).** Introduce a shared `lib/file.ts` helper with the
signature `downloadFile(url, filename)`:

- Fires an axios `GET` so the global Bearer interceptor in `lib/axios.ts`
  attaches the JWT from `localStorage`.
- `responseType: "blob"` on the request.
- Triggers a synthetic `<a>` click against `URL.createObjectURL(blob)`,
  then revokes the blob URL after a 1-tick `setTimeout` so the download
  completes before the URL goes away.
- Filename comes from the response `Content-Disposition` (preferred — the
  backend already emits RFC 5987 `filename*=UTF-8''…`); falls back to the
  caller-supplied `filename` when the header is missing.
- Errors propagate as `ApiCallError` per the project convention; the
  caller routes failures to `useDialog().open({ type: "error", … })`.

The `?token=<jwt>` URL-query alternative was rejected — the JWT would leak
into server access logs and browser history. The in-memory buffering cost
of the blob approach is acceptable for the file sizes seen in
`erp_trns_hstr` (max ~36 KB in the DEV sample set).

First consumer is the ERP transaction history `File` cell; subsequent
consumers (Payment file downloads, Smart Organizer attachments, future
upload-feature audit-row downloads) reuse the same helper unchanged.

**OQ-FE-2. List-icon toolbar button.** ✅ **Resolved 2026-05-11 (Sokny).**
The panel does **not** adopt View Setting. JEX has no toolbar action group
for this screen (comm_0219_001_view.jsp:91-98 _(external reference — not included in this repository)_)
and the refactor mirrors that contract — no list-icon button, no
popover, no SCREEN_IDS registry entry, no `SYS_SCR_OPTION_WECMS` seed, no
CHECKBOX special row. Column visibility / order / size are hardcoded in
the panel's static `<colgroup>` per §13 of this doc; the table sort still
ships (per §10) but `sortable` is declared directly on each
`<TableHeaderCell>` rather than derived from `SORT_YN`.

**OQ-FE-3. `prdtType` source.** ✅ **Resolved 2026-05-11 (Sokny) — folded
into OQ-2.** No auth wire change; no `StoredUser.prdtType`. Refactor is
product-agnostic; the legacy HAENGSUNG branches are intentionally not
mirrored.

---

## 23. Changelog

- 2026-05-11 — v0.1 — initial frontend design (Sokny, AI-assisted).

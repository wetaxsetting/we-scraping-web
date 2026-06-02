# Add-on Service > Operation Status Inquiry — Frontend Page Design

**Module:** Add-on Service
**Refactor screen ID (proposed):** `addon-operation-status`
**JEX counterpart:** `aosv_0001_001` (view) / `aosv_0001_001_r001` (read)
**Feature spec:** operation-status-inquiry.md _(wecms-api backend repo — not included in this clone)_
**Implementation plan:** operation-status-inquiry-plan.md _(wecms-api backend repo — not included in this clone)_
**Status:** Static UI implemented; read fetch wired to a working backend; status filter / pagination / sort / Print / Excel / Update / Inquire handlers NOT wired. View Setting NOT registered.

JEX is **read-only reference**.

---

## Route

```
/addon/operation-status
```

- App Router file: `app/(dashboard)/addon/operation-status/page.tsx`
- Auth: protected by the `(dashboard)` layout's client-side guard (`tokenStorage.get()` + `fetchMe()` on mount). Inherits `<AppShell>` chrome.
- Sidebar / top-nav active state auto-resolved from `usePathname()` against the declarative `addonGroups` config in [`<Sidebar>`](../../../../wecms-web/components/layout/Sidebar.tsx) — no per-page override.
- No sister route. The page does not share its shell with another screen (unlike Sales/Expenses e-Invoices). The Figma frame (12346:109158) is unique to this feature.

---

## Page layout structure

Standard menu page following the **Account Inquiry / Approval Box baseline** (see [wecms-web/CLAUDE.md § Approved reference set](../../../../wecms-web/CLAUDE.md)). Bottom layout follows the `paginationOnly` pattern (CLAUDE.md §7a / §7a.1) — Figma 12346:109158 has pagination but **no totals row**, so no sibling footer table is rendered.

```
PageLayout
├── PageHeader
│     title          ← t("operation.title")
│     children slot  ← <OperationStatusActionBar /> (Excel · Print · Update · Inquire Operation Status)
│
├── FilterRow
│     children       ← <FilterDropdown /> (status — trigger only, popover NOT wired)
│     right slot     ← <SearchInput /> (client-side filter today)
│
└── DataTableShell  (footerMode="paginationOnly")
      table         ← <table> 5 columns: checkbox · Company · Address · Operation Status · Last Update
      pagination    ← <Pagination className="shrink-0" totalLabel={t("common.showing_of", …)} />
```

Vertical stack inside the `<DataTableShell>` shared scroll container:

1. `<thead>` (sticky top, `bg-wb-bg-sidebar`, h `var(--h-wb-table-head)`)
2. `<tbody>` rows (h `var(--h-wb-table-row)` per row)
3. Flex spacer (no footer; the body scrolls inside the shared container)
4. Horizontal scrollbar (inside the shared scroll container; appears when content > `min-w-[960px]`)

Pagination row (`<Pagination>`) lives **outside** the scroll container, separated from the body by `PageLayout`'s `gap-5` and pinned via `shrink-0`.

---

## Component breakdown

### Files

| File | Purpose |
|---|---|
| `app/(dashboard)/addon/operation-status/page.tsx` | Thin App Router page — sets `metadata` (title "Operation Status Inquiry — WeCMS"), renders `<OperationStatusClient />` |
| [`components/addon/operation-status/OperationStatusClient.tsx`](../../../../wecms-web/components/addon/operation-status/OperationStatusClient.tsx) | Client wrapper. Calls `fetchOperationStatus()` via `useApiData`, maps `data?.ROWS` through [`mapOperationCompanyRow`](../../../../wecms-web/lib/api/mappers.ts), forwards `rows` + `totalCompanies` to `<OperationStatusPage>` |
| [`components/addon/operation-status/OperationStatusPage.tsx`](../../../../wecms-web/components/addon/operation-status/OperationStatusPage.tsx) | Page shell — owns the in-memory `search` state, the `useMemo` filter, the `<DataTableShell>` + `<Pagination>` composition, and the inline `<OperationStatusCell>` status renderer (Figma node 12346:109158) |
| [`components/addon/operation-status/OperationStatusActionBar.tsx`](../../../../wecms-web/components/addon/operation-status/OperationStatusActionBar.tsx) | Page-specific toolbar — Excel + Print icon buttons + raised "Update" button + raised brand-coloured "Inquire Operation Status" CTA. Diverges intentionally from the shared `<PageActionButtons>` (CLAUDE.md §6a allows this when an existing-page predates the rule and documents the divergence in the component header) |
| [`components/addon/operation-status/types.ts`](../../../../wecms-web/components/addon/operation-status/types.ts) | TS types: `OperationStatusCode` (`"active_certificate_issued" \| "suspended" \| "not_registered"`) + `OperationCompanyRow` (`id`, `companyName`, `taxCode`, `address`, `status`, `lastUpdate`) |
| `mockData.ts` (removed Sprint 1 — Needs Confirmation if still referenced) | Static seed mirroring the Figma frame — 15 Vietnamese companies. **Not used at runtime** — kept for screenshot/Figma reference |
| [`lib/api/addon.ts`](../../../../wecms-web/lib/api/addon.ts) | `fetchOperationStatus(q?)` Axios wrapper. Today: `GET /api/v1/addon/operation-status?q=…` (no pagination params yet) |
| [`lib/api/mappers.ts`](../../../../wecms-web/lib/api/mappers.ts) | `mapOperationCompanyRow` — UPPER_SNAKE wire row (`TAXCODE`, `COMPANY_NM`, `COMPANY_STATUS`, `STATUS_CD`, `OFFICE_ADD`, `LAST_UPDATE`) → camelCase frontend row, with status coerced via the `STATUS_CD` map (fallback `active_certificate_issued`) |

Shared shell components consumed (never rebuilt per page): [`<PageLayout>`](../../../../wecms-web/components/shared/PageLayout.tsx), [`<PageHeader>`](../../../../wecms-web/components/shared/PageHeader.tsx), [`<FilterRow>`](../../../../wecms-web/components/shared/FilterRow.tsx), [`<FilterDropdown>`](../../../../wecms-web/components/shared/FilterDropdown.tsx), [`<SearchInput>`](../../../../wecms-web/components/shared/SearchInput.tsx), [`<DataTableShell>`](../../../../wecms-web/components/shared/DataTableShell.tsx), [`<Pagination>`](../../../../wecms-web/components/shared/Pagination.tsx), [`<TableHeaderCell>`](../../../../wecms-web/components/shared/TableHeaderCell.tsx), shadcn primitives ([`<Checkbox>`](../../../../wecms-web/components/ui/checkbox.tsx), [`<Table*>`](../../../../wecms-web/components/ui/table.tsx)).

### Status filter dropdown

[`<FilterDropdown>`](../../../../wecms-web/components/shared/FilterDropdown.tsx) inside the `<FilterRow>` left slot. Today renders the trigger only with the static label `t("operation.filter.all_operation_status")` ("All Operation Status") and a fixed `className="w-[250px]"`. **The popover is NOT wired** — clicking the trigger does nothing; selection state is not tracked.

Refactor target (Phase 4):

- Build (or reuse) a shared `<FilterPopover>` triggered by the dropdown.
- Option list: `All` (no filter) · `Registered` (raw match `"đang hoạt động"`) · `Not registered` / `Suspended` (raw match `"ngừng"` / `"tạm ngừng"`). The wire token is the **raw Vietnamese substring** — backend partial match against `COMPANYSTATUS` (legacy parity per `aosv_0001_001_r001_act.jsp:47-52` _(external reference — not included in this repository)_).
- Display labels go through `t("operation.status.<canonical>")` — wire payload is the raw substring, dropdown labels are localised.
- Selection emits `companyStatus` (or `COMPANYSTATUS`, see TODO #6 in the planning doc) to the wrapper, which forwards it as a query param.

### Search input

[`<SearchInput>`](../../../../wecms-web/components/shared/SearchInput.tsx) inside the `<FilterRow>` `right` slot. Today filters the loaded result set **client-side only** in `<OperationStatusPage>`'s `useMemo`:

```ts
filteredRows = sourceRows.filter((r) =>
    [r.companyName, r.taxCode, r.address].join(" ").toLowerCase().includes(q),
);
```

The frontend filter scope is **3 columns** (name + tax code + address); the legacy wire scope is **2 columns** (name + tax code only — see `aosv_0001_001_r001_act.jsp:54-61` _(external reference — not included in this repository)_). This is a **refactor-only divergence** — Phase 4 must collapse to wire parity OR document the address column as an intentional addition.

Refactor target (Phase 4):

- Replace the in-memory filter with a debounced (300 ms) `q` query param. Reset to `page=0` on change.
- Backend predicate: `(companyname ILIKE '%' || ? || '%' OR taxcode ILIKE '%' || ? || '%')` with `ESCAPE '\'` for `%` / `_` / `\` neutralisation.

### Table

5 visible columns, rendered by `<OperationStatusPage>` directly (no extracted `<OperationStatusTable>` component today — the page is small enough to inline the markup). Uses the shadcn `<Table*>` family:

| Col | FIELD_ID (proposed) | Header (i18n key) | Width | Cell content |
|---|---|---|---|---|
| 1 | `CHECKBOX` | (none — visual only) | `w-[66px]` | `<Checkbox>` (size `var(--size-wb-icon-sm)`) — selection state is local-only, **no handler wired** |
| 2 | `COMPANY` | `operation.col.company` | flex | Two-line stacked: `companyName` (top, `font-medium text-wb-ink`) + `taxCode` (sub-line, `font-normal text-wb-muted`) |
| 3 | `ADDRESS` | `operation.col.address` | flex | `address` plain text, truncated |
| 4 | `OPERATION_STATUS` | `operation.col.operation_status` | `w-[339px]` | `<OperationStatusCell>` — `<Check>` lucide glyph (size 18 px, stroke 2.5) + `t("operation.status.<status>")` text, `text-wb-status-approved-text` colour |
| 5 | `LAST_UPDATE` | `operation.col.last_update` | `w-[220px]` | `lastUpdate` plain text |

**Table typography:** body cells render at `text-wb-13` (CLAUDE.md §5 / Table typography). Header text is delivered via [`<TableHeaderCell>`](../../../../wecms-web/components/shared/TableHeaderCell.tsx) — currently default `text-wb-14`; migrate to `text-wb-13` in next stabilisation pass per the global rule.

**`<colgroup>`** — declared inline:

```jsx
<colgroup>
    <col className="w-[66px]" />   {/* checkbox */}
    <col />                        {/* company — flex */}
    <col />                        {/* address — flex */}
    <col className="w-[339px]" />  {/* status */}
    <col className="w-[220px]" />  {/* last update */}
</colgroup>
```

Min width on the table: `min-w-[960px]` so the body scrolls horizontally inside the shared scroll container at narrow viewports. Sum of fixed columns (66 + 339 + 220 = 625) leaves ≥ 335 px for the two flex columns.

### Pagination

[`<Pagination>`](../../../../wecms-web/components/shared/Pagination.tsx) outside the `<DataTableShell>` scroll container.

Today (static UI):

- `<OperationStatusPage>` computes `pageCount = ceil(total / DEFAULT_PAGE_SIZE)` with `DEFAULT_PAGE_SIZE = 15` hardcoded.
- `total` comes from the `totalCompanies` prop (defaults to `0`); `<OperationStatusClient>` forwards `data?.TOTAL_COUNT`.
- State is **read-only** — clicking page-size or arrows does not refetch / re-slice. The displayed page is hardcoded `page={1}`.
- The page does not adopt `usePagination()` per [§4](../../../../wecms-web/CLAUDE.md) yet.

Refactor target (Phase 4 — server-side pagination per the global rule):

- Adopt `usePagination()` per [§4](../../../../wecms-web/CLAUDE.md). Default `size = 10` (canonical `PAGE_SIZE_OPTIONS[0]`); options `10 / 20 / 50 / 100`; backend clamps to `MAX_PAGE_SIZE = 100`.
- Wrapper sends `page` + `size` to the backend; remove the hardcoded `DEFAULT_PAGE_SIZE = 15`.
- Filter `onChange` (search, status) calls `resetPage()` from the hook.
- `usePagination().onPageSizeChange` hook clears the row-selection set (legacy "checkbox-all reset" pattern).
- `totalLabel` keeps using `t("common.showing_of", { shown, total })`.

---

## Filter UI behaviour

| Filter | UI today | Refactor target (Phase 4) |
|---|---|---|
| **Status** (`All / Registered / Suspended / Not Registered`) | Trigger renders, popover NOT wired. | Shared `<FilterPopover>`. Selection emits raw Vietnamese substring (`""` / `"đang hoạt động"` / `"ngừng"` / `"tạm ngừng"`) as `companyStatus` query param. Backend predicate: `companystatus ILIKE '%X%'`. Page resets to 0 on change. |
| **Keyword search** | Client-side `useMemo` over 3 columns (`companyName + taxCode + address`). | Server-side `q` query param (debounce 300 ms). Backend OR clause over 2 columns (`companyname` + `taxcode`) — legacy parity. **Decide Phase 4** whether to keep the address-column divergence on the frontend or collapse to wire parity. Page resets to 0 on change. |

**No date-range filter** on this page (legacy parity — `aosv_0001_001_r001` does not validate or apply any date range; the only validations are `PAGE_NO` / `PAGE_PER_CNT`).

**Filter ↔ pagination coupling:** any filter change resets the wrapper to `page = 0` (mirror Account Inquiry / Approval Box). Selection state is cleared on page-size change but preserved across page navigation within the same filter set.

---

## Table rendering logic

### Row structure

Per row (5 cells, in DOM order):

```jsx
<TableRow key={row.id} className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0">
    {/* 1. Checkbox */}
    <TableCell className="px-2.5 align-middle">
        <Checkbox className="size-[var(--size-wb-icon-sm)]" />
    </TableCell>

    {/* 2. Company (two-line composite) */}
    <TableCell className="px-2.5 py-2.5 align-middle">
        <div className="flex flex-col gap-0.5">
            <span className="truncate text-wb-13 font-medium text-wb-ink">{row.companyName}</span>
            <span className="truncate text-wb-13 font-normal text-wb-muted">{row.taxCode}</span>
        </div>
    </TableCell>

    {/* 3. Address */}
    <TableCell className="px-2.5 py-2.5 align-middle">
        <span className="block truncate text-wb-13 font-normal text-wb-ink">{row.address}</span>
    </TableCell>

    {/* 4. Operation Status — icon + text */}
    <TableCell className="px-2.5 py-2.5 align-middle">
        <OperationStatusCell status={row.status} />
    </TableCell>

    {/* 5. Last Update */}
    <TableCell className="px-2.5 py-2.5 align-middle">
        <span className="text-wb-13 font-normal text-wb-ink">{row.lastUpdate}</span>
    </TableCell>
</TableRow>
```

### Status display (icon + text)

`<OperationStatusCell>` renders a tick glyph + i18n-resolved label, all in `text-wb-status-approved-text` colour:

```jsx
<span className="inline-flex items-center gap-1 text-wb-13 font-medium text-wb-status-approved-text">
    <Check aria-hidden className="size-[18px]" strokeWidth={2.5} />
    <span>{t(`operation.status.${status}`)}</span>
</span>
```

Today every row in the static seed has `status === "active_certificate_issued"` so the green-tick treatment is what the screenshot shows. The 3 canonical states (`active_certificate_issued` / `suspended` / `not_registered`) all currently render the same tint — **a Phase 4 refinement will branch the icon + colour** per state (e.g. warning amber for `suspended`, neutral grey for `not_registered`). Decide before badge-style adoption.

The raw Vietnamese `COMPANY_STATUS` is dropped on the frontend after `mapOperationCompanyRow` produces the canonical key. Phase 4 should consider exposing the raw string as a tooltip / sub-line so the full GDT message stays one hover away (the legacy 12-string TS legend captures information the 3-state collapse loses).

### Checkbox selection (single / multi)

- Header checkbox (in `<TableHead>`) — Figma frame implies "select all" semantics; **NOT wired** today.
- Per-row checkboxes — local-only state, **NOT wired** today; clicking does not update any state.

Refactor target (Phase 4):

- Adopt the shared `useSelection()` hook (top-level `hooks/` folder per CLAUDE.md §3 — convention going forward) keyed by row `id`.
- Header checkbox: indeterminate when partial, checked when all visible rows selected, click toggles the visible set.
- Selection state drives the **Inquire Operation Status** CTA — when ≥ 1 row is selected, the CTA shows a count badge ("Inquire (3)"); zero selection makes the CTA either disabled or routes to a "lookup-by-MST" modal flow (TODO).
- Selection clears on page-size change (legacy "checkbox-all reset"); preserved across page navigation within the same filter set.

---

## Pagination behaviour

See [Pagination](#pagination) above. Today: read-only chrome with hardcoded `DEFAULT_PAGE_SIZE = 15` and `page={1}`. Phase 4: server-side via `usePagination()` per [§4](../../../../wecms-web/CLAUDE.md).

---

## Button actions

The toolbar is the page-specific [`<OperationStatusActionBar>`](../../../../wecms-web/components/addon/operation-status/OperationStatusActionBar.tsx) (Figma 12346:109158).

| Button | Glyph / style | Today | Refactor target |
|---|---|---|---|
| **Excel** | `/assets/common/ico-excel.svg` at `size-5` | `onExport` prop accepted; **no handler wired**. | Route through the shared [`useExcelExport()`](../../../../wecms-web/hooks/useExcelExport.ts) hook per [§13b](../../../../wecms-web/CLAUDE.md). New per-resource endpoint `POST /api/v1/addon/operation-status/export`; `screenId = "addon-operation-status"`. No chevron-dropdown variant — Figma shows a plain icon. |
| **Print** | `/assets/common/ico-print.svg` at `size-5` | `onPrint` prop accepted; **no handler wired**. | Route through [`printReport`](../../../../wecms-web/lib/print.ts) per [§6d](../../../../wecms-web/CLAUDE.md). Source = filtered, in-memory dataset (search + status applied) BEFORE pagination. Columns mirror the on-screen table minus the checkbox; render the operation-status text plain (no badge). Default landscape. |
| **Update** | Raised white button with `<RotateCw>`-shaped label "Update", `bg-white shadow-wb-btn` | `onUpdate` prop accepted; **no handler wired**. | Phase 1: `refreshKey++` → refetch the list endpoint (mirrors Sales e-Invoices' Update-button stance). Phase 2 (deferred — only if NXISAS bridge is ported): bulk re-poll every visible row against GDT via `nxisas_oprtstts_*`. |
| **Inquire Operation Status** (raised brand CTA) | `bg-brand text-white shadow-wb-brand-btn`, label `t("operation.inquire_cta")` | `onInquire` prop accepted; **no handler wired**. | Selection-aware: ≥ 1 checkbox selected → bulk inquire for the selected MSTs; zero selection → opens a "lookup-by-MST" modal flow. **Refactor R&D scope: deferred** — local-only environment has no GDT bridge. Phase 1 ships an inert CTA with explanatory tooltip; Phase 2 (if the NXISAS bridge lands) wires the actual GDT pull. |

The Excel + Print icons are **NOT** routed through the shared `<PageActionButtons>` component because `<PageActionButtons>` only carries the list / print / Excel trio — this page swaps the list icon for the Update + Inquire CTA pair. The divergence is documented in the action-bar component header (CLAUDE.md §6a). When (and only when) the team consolidates page toolbars in a future stabilisation pass, this component will be the second consumer of an extended `<PageActionButtons>` API — not the trigger to fork it again.

---

## Data binding expectations

### API → UI mapping

The wire DTO is UPPER_SNAKE per the global rule (CLAUDE.md API section). Translation lives in [`mapOperationCompanyRow`](../../../../wecms-web/lib/api/mappers.ts):

| Wire field (current backend) | Frontend `OperationCompanyRow` field | Notes |
|---|---|---|
| `TAXCODE` | `taxCode` | Vietnamese MST. Used as the row React key (`row.id` is also derived from this — see TODO). |
| `COMPANY_NM` | `companyName` | Refactor wire name. **Diverges from legacy WSVC** (`COMPANYNAME`); see Phase 4 task #6 in the planning doc. |
| `COMPANY_STATUS` | (dropped) | Raw Vietnamese GDT string. Phase 4 should preserve as a tooltip / sub-line. |
| `STATUS_CD` | `status` | Canonical 3-state enum (`active_certificate_issued` / `suspended` / `not_registered`). Computed server-side by `OperationStatusService.resolveStatusCd(...)`. Frontend has a defensive fallback: if `STATUS_CD` is unknown / missing, mapper coerces to `active_certificate_issued`. |
| `OFFICE_ADD` | `address` | Refactor wire name. **Diverges from legacy WSVC** (`OFFICEADD`). |
| `LAST_UPDATE` | `lastUpdate` | Refactor wire name (legacy: `SEARCHDATETIME`). Format: `YYYYMMDDhhmmss`. Frontend currently displays the string verbatim — Phase 4 should format via [`lib/datetime.ts`](../../../../wecms-web/lib/datetime.ts). |
| (not on wire) | `id` | Synthetic — derived from `TAXCODE` for React key stability. |

`TOTAL_COUNT` (top-level on `REC`) → `<OperationStatusClient>` forwards as `totalCompanies` to `<OperationStatusPage>` for the pagination math.

### Default behaviour when API returns empty

`<OperationStatusPage>`'s `EMPTY_ROWS` constant (`OperationCompanyRow[]`) is the stable empty-array reference used when `rowsProp ?? EMPTY_ROWS`. Same reference across renders so downstream `useMemo` deps don't churn. `total` defaults to `0`.

The legacy mock-data fallback was **removed in Sprint 1 stabilisation** — API is the single source of truth. Empty API response → empty table (today; Phase 4 should add an empty-state placeholder per the Account Inquiry / Approval Box pattern).

### `STATUS_CD` resolution defence in depth

Backend `OperationStatusService.resolveStatusCd(...)`:

```java
if (status.toLowerCase().contains("đang hoạt động")) → "active_certificate_issued";
if (status.toLowerCase().contains("tạm ngừng"))      → "suspended";
otherwise                                             → "not_registered";
```

Frontend mapper defensive coercion: if the wire `STATUS_CD` is missing or not in the canonical set, fall back to `"active_certificate_issued"` so the table never renders an unknown badge. **Defensive only** — if defaults start firing in production, the regex on either side is wrong and must be tightened.

---

## Loading / empty / error states

| State | Today | Refactor target (Phase 4) |
|---|---|---|
| **Loading** | `<OperationStatusPage>` renders 0 rows + `total=0` (via `useApiData`'s initial `data === undefined` state). Pagination shows `0 of 0`. No spinner. | Add the standard skeleton-row pattern from Account Inquiry (3 placeholder rows) OR a dedicated loading state. Mirror whichever pattern lands first in the shared layer. |
| **Empty (filter excludes all)** | Empty table; pagination shows `0 of 0`. No placeholder text. | Render the shared empty-state placeholder (`t("common.empty_state")` or screen-specific copy). Mirror Approval Box. |
| **Empty (no data ever)** | Same as above. | Same — refactor R&D may have legitimately empty tenant seeds. The Phase 3 demo-seed migration is the right fix if PO wants a non-empty default screen. |
| **Error** | `useApiData` swallows errors silently; row list is `undefined` and the page renders empty. No error toast / dialog. | Route through the global `useDialog()` `error` variant on non-401 errors (401 is handled by the global Axios session-expired interceptor). Surface `COMMON_HEAD.CODE` (e.g. `WBE9999`) so the support team can correlate logs. |
| **Stale data after Update** | The Update button is a no-op — no stale-data path exists today. | Phase 4: clicking Update bumps `refreshKey++`; `useApiData` re-fires; brief loading skeleton returns; new data lands. |

---

## Related frontend files (found during analysis)

| Path | Role |
|---|---|
| `app/(dashboard)/addon/operation-status/page.tsx` | Route / metadata |
| [`components/addon/operation-status/OperationStatusClient.tsx`](../../../../wecms-web/components/addon/operation-status/OperationStatusClient.tsx) | Client wrapper (data fetch) |
| [`components/addon/operation-status/OperationStatusPage.tsx`](../../../../wecms-web/components/addon/operation-status/OperationStatusPage.tsx) | Page shell + table markup (Figma 12346:109158) |
| [`components/addon/operation-status/OperationStatusActionBar.tsx`](../../../../wecms-web/components/addon/operation-status/OperationStatusActionBar.tsx) | Page-specific toolbar |
| [`components/addon/operation-status/types.ts`](../../../../wecms-web/components/addon/operation-status/types.ts) | TS types |
| `mockData.ts` (removed Sprint 1 — Needs Confirmation if still referenced) | Static seed (Figma reference, not used at runtime) |
| [`lib/api/addon.ts`](../../../../wecms-web/lib/api/addon.ts) | `fetchOperationStatus(q?)` |
| [`lib/api/mappers.ts`](../../../../wecms-web/lib/api/mappers.ts) | `mapOperationCompanyRow` |
| `locales/{en,ko,vi}.json` | i18n keys under `operation.*` (`operation.title`, `operation.col.*`, `operation.status.*`, `operation.filter.*`, `operation.inquire_cta`). KM missing. Sidebar entries: `sidebar.addon.operationStatus`, `sidebar.addon.operationStatusInquiry`. |

**Not yet present** (Phase 4 deliverables, listed for completeness):

- `components/addon/operation-status/OperationStatusTable.tsx` (no extracted table component yet — page inlines the markup; extract when sort / View Setting wiring lands).
- `components/addon/operation-status/OperationStatusFilterPopover.tsx` (status-filter popover wiring).
- `lib/api/operationStatus.ts` (the `fetchOperationStatus` wrapper currently lives inside `lib/api/addon.ts` alongside e-invoices — split when the surface grows).

---

## Cross-references

- Feature spec: operation-status-inquiry.md _(wecms-api backend repo — not included in this clone)_
- Implementation plan: operation-status-inquiry-plan.md _(wecms-api backend repo — not included in this clone)_
- Backend API: operation-status-inquiry-api.md _(wecms-api backend repo — not included in this clone)_
- Database design: operation-status-inquiry-db.md _(wecms-api backend repo — not included in this clone)_
- Service mapping: service-mapping.md _(wecms-api backend repo — not included in this clone)_ → "Add-on Service > Operation Status Inquiry"
- Sister pages that consume the same `OPRT_STTS_INFO` data on their Buyer cell: [`addon/sales-e-invoices-page.md`](sales-e-invoices.md), [`addon/expenses-e-invoices-page.md`](expenses-e-invoices.md)

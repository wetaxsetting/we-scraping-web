# Operation Status Inquiry — UI Specification

Figma node 12346:109158. Page composes the shared `PageLayout → PageHeader → FilterRow → DataTableShell` baseline (Account Inquiry pattern). Bottom layout is `footerMode="paginationOnly"` — pagination, no totals row. Source: [OperationStatusPage.tsx](../../../../components/addon/operation-status/OperationStatusPage.tsx).

---

## 1. Layout

```
PageLayout
├── PageHeader  title = t("operation.title")  "Operation Status Inquiry"
│     children → <OperationStatusActionBar />   (Print · Excel · Update · Inquire CTA)
├── FilterRow
│     children  → <FilterDropdown> status (w-[250px]) + inline StatusFilterPopover
│     right     → <SearchInput>
└── DataTableShell footerMode="paginationOnly"
      table     → <table min-w-[960px] table-fixed>  5 columns
      pagination→ <Pagination> (outside scroll container)
```

## 2. Toolbar — `<OperationStatusActionBar>`

Page-specific (kept local; the shared `PageActionButtons` trio doesn't match this layout — documented in the component header). Order: **Print · Excel** (icon pair, `gap-1`) · **Update** (white `h-9` secondary) · **Inquire Operation Status** (brand-blue `h-9` primary CTA, label `operation.inquire_cta`).

- Print/Excel icons: `/assets/common/ico-print.svg`, `/assets/common/ico-excel.svg` at `size-5`.
- `exporting` disables Print + Excel; `updating` disables Update + Inquire (prevents double-trigger on fast resolve).

## 3. Filters

| Control | Behaviour |
|---|---|
| Status dropdown | `<FilterDropdown>` trigger + inline `StatusFilterPopover` (listbox, outside-click/ESC close). Options: All (`null`) · Active (`đang hoạt động`) · Suspended (`ngừng`) · Temporarily closed (`tạm`). `wireValue` = raw substring → `companyStatus` param; label via `t(labelKey)`. |
| Keyword search | `<SearchInput>` in the FilterRow right slot. Immediate input value; 300 ms debounce to the wire `q`. |

## 4. Table columns

View-Setting-driven: the page walks `vs.items` filtered to `use_yn === "Y"`, `disp_yn !== "N"`, non-special, sorted by `disp_ord`, and looks each FIELD_ID up in `COLUMN_REGISTRY`. The View Setting popover itself is **not rendered** (Figma has no list-view icon); the hook data feeds column rendering + export only. `FALLBACK_COLUMNS` mirrors the V56 seed for first paint.

| # | FIELD_ID | Header key | Width | Cell |
|---|---|---|---|---|
| 1 | (checkbox) | — | `w-[66px]` | `<Checkbox>` — row selection (header = select-all-on-page, tri-state) |
| 2 | `COMPANY` | `operation.col.company` | flex | two-line: `companyName` (ink) + `taxCode` (muted) |
| 3 | `ADDRESS` | `operation.col.address` | flex | `address`, truncated |
| 4 | `OPERATION_STATUS` | `operation.col.operation_status` | `w-[339px]` | `<OperationStatusCell>` — check glyph + localised status, coloured by code |
| 5 | `LAST_UPDATE` | `operation.col.last_update` | `w-[220px]` | `formatDateLang(lastUpdate, locale)` |

Body text `text-wb-13 font-medium`; header via `<TableHeaderCell textSizeClass="text-wb-13">` with sort glyph when `sort_yn === "Y"`.

## 5. Status display rules

`OperationStatusCode = "active_certificate_issued" | "suspended" | "not_registered"` (from the wire `status_cd`, coerced defensively by `coerceOpStatus`). `<OperationStatusCell>` renders a lucide `Check` (18px, stroke 2.5) + `t("operation.status.<code>")` in:

| Code | Tone | i18n label |
|---|---|---|
| `active_certificate_issued` | `text-wb-status-approved-text` (green) | "Active - Certificate issued" |
| `suspended` | `text-wb-status-pending-text` (amber) | "Suspended" |
| `not_registered` | `text-wb-muted` (grey) | "Not registered" |

The Inquire dialog's status banner reuses the same tones via `statusTone`/`statusBannerBg`, so the popup pill and the table cell read identically.

## 6. Last-update / inquiry datetime

- **Table cell:** `formatDateLang(row.lastUpdate, locale)` (locale-aware date-only — EN `DD-MMM-YYYY`, KO `YYYY-MM-DD`, others `DD-MM-YYYY`), falling back to the raw string. Port of legacy `common.app.formatDateLang`.
- **Inquire dialog banner:** `formatLastUpdate(searchDatetime)` → `DD-MM-YYYY, HH:mm` from the `yyyyMMddHHmmss` GDT timestamp (raw fallback on parse failure).

## 7. Inquire dialog — `<InquireOperationStatusDialog>`

shadcn `<Dialog>` `max-w-[520px]`, `closeOnOutsideClick={false}`, `closeOnEscape={false}`.

- **Tax ID** input (required) — masked: strips non-digits, inserts `-` after the 10th digit, caps 13 digits; placeholder `0000000000-(000)`. Adjacent **Get Business Info** button (lucide `Search`).
- Hint `operation.inquire.hint` shows until a result lands.
- After a successful lookup: status banner (status + Last Update) + read-only **Customer Name** input + read-only **Address** textarea (3 rows).
- Footer: **Close** (white secondary) + **Save** (brand primary, enabled only when `hasResult && companyName`).
- Buttons follow the Settings button system (`h-8 px-3 text-wb-14-tight`).

## 8. Pagination

Shared `<Pagination>`: page-size dropdown + `common.showing_of` count (`{shown} of {total}`) + nav. Display page = `page + 1`; `pageCount = max(1, total_pages)`.

## 9. i18n keys (EN / KO / VI; KM not yet)

`operation.title`, `operation.empty`, `operation.export_title`, `operation.inquire_cta`, `operation.filter.{all_operation_status,active,suspended,tam_suspended}`, `operation.col.{company,address,operation_status,last_update}`, `operation.status.{active_certificate_issued,suspended,not_registered}`, `operation.aria.{select_all,select_row}`, `operation.inquire.{title,tax_id,get_business_info,hint,customer_name,address,last_update,invalid_tax_code,save_success}`, `operation.update.{confirm,success,partial}`. Sidebar: `sidebar.addon.operationStatus(Inquiry)`.

## 10. Responsive

Standard menu-page responsive behaviour (table scrolls horizontally below `min-w-[960px]`; filter row wraps; sidebar drawer < lg). Verify 375 / 768 / 1024 / 1440.

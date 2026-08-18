# Tax Filing — UI Specification

Layout, columns, and controls for `/addon/tax-filing`. Source-verified 2026-08-17.

## 1. Page shell (dashboard list)

Standard list-page composition per [CLAUDE.md §7a](../../../../CLAUDE.md):
`<PageLayout>` → header + filters → `<DataTableShell>` → `<Pagination>`.
Footer mode is `paginationOnly` — **no totals row**, matching the design.

## 2. List columns

Nine data columns plus an actions column. Headers use the shared
[`<TableHeaderCell>`](../../../../components/shared/TableHeaderCell.tsx) with
`textSizeClass="text-wb-13"` (the 13 px table standard).

| # | Header key | Align | Source field |
|---|---|---|---|
| 1 | `tax_filing.col.filing_period` | left | `filingPeriod`, re-derived by `formatVatPeriod()` |
| 2 | `tax_filing.col.applicable_circular` | left | `applicableCircular` |
| 3 | `tax_filing.col.declaration_type` | left | `declTypeName` |
| 4 | `tax_filing.col.e_transaction_code` | left | `etaxCode` — empty renders `tax_filing.col.not_submitted` |
| 5 | `tax_filing.col.status` | left | `status` → [`<TaxFilingStatusBadge>`](../../../../components/addon/tax-filing/TaxFilingStatusBadge.tsx) |
| 6 | `tax_filing.col.prev_period_credit` | **right** | `prevPeriodCredit` |
| 7 | `tax_filing.col.tax_payable` | **right** | `taxPayable` |
| 8 | `tax_filing.col.carried_forward` | **right** | `carriedForward` |
| 9 | `tax_filing.col.actions` | — | kebab → `<TaxFilingDropdown>` |

**No header-click sorting.** No `sortFieldId` / `onSort` is wired on any header, and no sort param
is sent. Ordering is whatever the backend returns.

### Amount formatting — a documented local deviation

Amounts render through a **module-local** helper in `TaxFilingPage.tsx`:

```ts
n.toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + " đ"
```

This does **not** go through the shared `formatAmount()` in
[`lib/currency.ts`](../../../../lib/currency.ts) that the rest of the app uses. It is recorded here
as an observed fact, not endorsed — a VAT declaration is Vietnam-only and single-currency (VND, `đ`),
which is the apparent reason. Reconciling it with the shared formatter is a separate decision.

## 3. Filter row

| Control | Notes |
|---|---|
| Year dropdown | options from `YEAR_OPTIONS` in `mockData.ts`; default `"2026"` |
| Status dropdown | All / Confirmed / Draft (`STATUS_FILTERS`), own `statusDropdownOpen` state |
| Keyword | shared [`<SearchInput>`](../../../../components/shared/SearchInput.tsx) |
| **+ New Declaration** | primary CTA, lucide `Plus`, opens the create dialog |

Toolbar icons come from shared
[`<PageActionButtons>`](../../../../components/shared/PageActionButtons.tsx).

## 4. Create dialog — `<NewVatDeclarationDialog>`

| Field | Control | Default |
|---|---|---|
| Period mode | Monthly / Quarterly tabs | `monthly` |
| Year | dropdown | `"2026"` |
| Month *or* Quarter | dropdown, follows mode | first option / `Quarter 1` |
| Industry / activity | dropdown, `ActivityCode` | `"00"` |
| Annexes | checkbox list — annex code + filing period columns | `bkbr`, `bkmv` pre-checked |
| Load Group 4 | toggle (`loadGroup4`) | off |

Footer: `Close` (secondary) · `Next` (primary, shows `submitting` state). Checked annexes map to the
`annex_bkbr_yn` / `annex_bkmv_yn` / `annex_reduce8_yn` body flags.

## 5. Declaration form overlay

Full-screen `fixed inset-0 z-[60] flex flex-col bg-white`. Top bar: page title
(`text-wb-18 font-semibold tracking-wb-tight text-wb-dark`) plus a status chip
(`rounded bg-wb-ntrl-3 px-2 py-0.5 text-wb-13 font-medium text-wb-ntrl-8`). Tab strip below;
active tab is brand-underlined.

### 5a. Declaration tab — indicator grid

The largest component in the module (952 lines). The grid is **schema-driven**:
[`indicatorSchema.ts`](../../../../components/addon/tax-filing/indicatorSchema.ts) defines
structure and i18n keys only — **never values**. At render time each row merges with live
`indicators` from the API via `indicators[schema.ctLeft]` / `indicators[schema.ctRight]`.

`IndicatorSchemaRow` supports: `no`, `labelKey`, `ctLeft` / `ctRight`, `hasCheckbox`,
`isSectionHeader`, `isSubHeader`, `isSection`, `isTotal`, `isLast`, `isEmptyLeft` / `isEmptyRight`,
`italic`, `bold`, `indent` — i.e. the statutory form's typography and indentation are data, not
hand-built markup.

**30 indicator cells** are addressed: `ct21 ct22 ct23 ct23a ct24 ct24a ct25 ct26 ct27 ct28 ct29 ct30
ct31 ct32 ct32a ct33 ct34 ct35 ct36 ct37 ct38 ct39a ct40 ct40a ct40b ct41 ct42 ct42a ct42b ct43`.
Row numbering follows the form: letters `A` / `B` / `C` for section headers, numerals for indicators.

### 5b. Computed vs. editable cells

The write path for every derived figure is
[`lib/vat/vatFormula.ts`](../../../../lib/vat/vatFormula.ts) — one module, consumed by **both** the
form and the Excel export, so a figure can never differ between what the user sees and what is filed.

**16 editable inputs:** `ct22 ct23 ct24 ct25 ct26 ct29 ct30 ct31 ct32 ct32a ct33 ct37 ct38 ct39a
ct40b ct42`. Everything else is derived:

```
ct27  = ct29 + ct30 + ct32 + ct32a
ct28  = ct31 + ct33
ct34  = ct26 + ct27
ct35  = ct28
ct36  = ct35 − ct25
hiệu số = ct36 − ct22 + ct37 − ct38 − ct39a      (signed intermediate; not filed)
ct40a = max(hiệu số, 0)
ct41  = |min(hiệu số, 0)|
ct40  = max(0, ct40a − ct40b)
ct43  = max(0, ct41 − ct42)
```

Two behaviours are explicit in source and worth preserving:

- **Truncation is `floor`, never `round`** — a rounded-up tax figure over-declares.
- **`propagateVatInput()` seeds dependants but does not lock them.** Editing a source cell writes its
  dependants once; the targets stay editable, so a manual override survives until the source moves
  again ("Auto / manual" behaviour).

### 5c. Annex tabs

| Tab | Component | Shape |
|---|---|---|
| BKBR (sales) | [`BkbrTab.tsx`](../../../../components/addon/tax-filing/BkbrTab.tsx) | invoice listing grouped by VAT-rate |
| BKMV (purchases) | [`BkmvTab.tsx`](../../../../components/addon/tax-filing/BkmvTab.tsx) | same shape, purchase side |
| PL 43/2022 reduce-8% | [`PlReduce8Tab.tsx`](../../../../components/addon/tax-filing/PlReduce8Tab.tsx) | two sections, each its own `fetchAnnexInvoices` call |
| PL CSSX · PL VT | *(tab renders when flagged; no dedicated component file exists)* | — |

BKBR and BKMV share their grouping logic through
[`annexGrouping.ts`](../../../../components/addon/tax-filing/annexGrouping.ts) rather than
duplicating it (the two-call rule). Two deliberate properties:

- Only groups present on the **current page** are returned, so paging counts invoice lines, not groups.
- Subtotals come from `tax_groups` (computed over the whole filtered set), **not** from summing the
  page — so a group straddling two pages still shows its full subtotal.

Group codes observed: `KKKNT`, `8%`, `10%`, `KCT`, plus a `TOTAL` grand row.
`PlReduce8Tab` derives its reduced column as `(4) × 80%` per Figma 153:58853.

## 6. Dialogs

All go through the shared `useDialog()` system dialog — no bespoke dialogs.

| Trigger | Type | Notes |
|---|---|---|
| Unlock | `confirmation` | Yes / No |
| Delete | `confirmation` + `destructive: true` | the module's only red CTA |
| Any success | `success` | `tax_filing.unlock_success` / `tax_filing.delete_success` |
| Validation failure | `error` | `errorCode: "WBE_VALIDATION"` |
| API failure | `error` | message from `vatDeclErrorMessage()`, `errorCode` = server code or `WBE9999` |
| Export on wrong tab | `warning` | `select_annex_tab` / `pdf_declaration_only` |

## 7. Tokens and i18n

Standard WB365 tokens throughout — `text-wb-13` tables, `text-wb-18` titles, `h-8` buttons,
`shadow-wb-btn` / `shadow-wb-brand-btn`, `bg-wb-ntrl-3` chips. No arbitrary `text-[Npx]`.

Locale coverage is complete across **EN / KO / VI** under the `tax_filing.*` namespace — roughly
230 keys, grouped: `form` (65) · `indicator` (29) · `bkmv` (23) · `pl_reduce8` (22) · `bkbr` (17) ·
`new_dialog` (14) · `annex` (12) · `col` (10) · `filter` (8) · `error` (6) · `action` (6) ·
`status` (4) · `export` (2) · `period` (2).

**Inline SVG icons are a local deviation.** `TaxFilingPage.tsx` defines several icons
(`CalendarIcon`, `IconLock`, `IconSupplemental`, `IconEdit`) as inline `<svg>` constants rather than
assets under `public/assets/` per [CLAUDE.md §8a](../../../../CLAUDE.md). Recorded as observed; not
endorsed.

# WeInvoice — Invoice Screens per UI Spec v1.2 (parts A–D) — Web

**Date:** 2026-11-27
**Type:** FEATURE
**Status:** READY FOR MANUAL COMMIT
**Repository:** we-scraping-web
**Approval Status:** NOT REQUIRED (user, 2026-11-27: "Start A–D" — implementation requested)
**Implementation Status:** COMPLETE (automated verification only — see Known Limitations)

Backend counterpart: `we-scraping-api/docs/features/addon-service/weinvoice/weinvoice-invoice-screen-v1-2-2026-11-27.md`.
Source: UI Spec v1.2 (PO, 27/11/2026) — `00_THAY_DOI_v1.1_v1.2.md` §A–D, `02_Yeu_cau_nghiep_vu.md` §3.3, §3.6, §3.11,
§3.13–§3.15, `01_Dac_ta_UI.html` items tagged [MỚI v1.2]/[ĐỔI v1.2], reference UI source `WeInvoice_UI_Source_v1.2.zip`
(`DateRangePicker.tsx`, `ItemsCell.tsx`, `period.ts`, `lib/fx.ts`, `InvoiceListPage.tsx`, `InvoiceDetailModal.tsx`,
`InvoiceSheet.tsx`, `ViewSetting.tsx`, `lib/nav.ts`, `lib/i18n/*`). Parts E–G (auto-journal rebuild, chart of accounts,
item catalogue) are out of scope.

## Requirement (web share of A–D)

- A1 currency code everywhere (done 2026-11-25 except leftovers) · A2 "Tất cả" not "Mọi" · A3 Tax menu: two groups
  (THUẾ & KÊ KHAI / DANH MỤC) — catalog screens not built yet.
- B1 date-range picker (year, months, quarters, halves, from–to, future months locked) · B2 default = current month ·
  B3 search hint (items, PO) · B4 kind filter "Tất cả…" · B5–B7 new columns + Items cell (hover list, click popup) ·
  B8 Item details popup · B9 totals bar by currency · B10 KPIs in VND · B11 new columns inserted at their default
  position.
- C1 detail panel "Hoá đơn liên quan" both ways + effective value · C2 totals with fee · C3 rendered copy: fee table,
  total fee, trade discount, related line, full decimals · C4 status labels.

## Current System Behavior (before this change)

- Period: quick picks (this / last year, Q1–Q4) + month picker + a "dd/mm/yyyy – dd/mm/yyyy" text line; default
  **this year**.
- Columns: Ngày lập · Nhãn · Ký hiệu · Số HĐ · Đối tác · Tiền thuế · Tổng tiền (+ the currency code after a foreign
  total) · Tệp gốc · Phát hành qua; no items, currency, rate, fee, VND, related, due date or PO columns.
- Totals footer: one text line "Trước thuế · Tiền thuế · Tổng tiền … VND" from the VND KPIs.
- Column settings: a column added after the user saved was appended **hidden at the end**.
- Detail panel: "Trước thuế + Thuế = Tổng" (no fee), no related-invoice section; detail lines mapped without
  `line_kind` / code / line tax (`OPEN` note in `fromDetail`); `fees`, `discount`, `related` of `InvoiceDetail` ignored.
- Rendered copy (screen + HTML): qty as an integer (`fmtMoney`), price with currency digits only, no fee table, no
  fee / trade-discount totals, no related-invoice line; "(Hóa đơn thay thế)" only.
- Tax menu: one group (VAT return · filed returns · tax-reduction annex · auto-journal).
- Locale leftovers: `jn.r.any_partner` "— Mọi đối tác —"; `chk.found_money` "… {m} đ" (VI) / "… {m} 동" (KO).

## Implementation

**Data layer** (`lib/api/weinvoice/invoices.ts`, rules referenced by §):

- Wire types: `InvoiceRow` + `fee`, `trade_discount`, `po_number`, `due_date`, `due_text`, `items`, `item_count`,
  `vat_rates`, `related{relation, original, referenced_by}` (`Ref`); `InvoiceKpis` + `fee`, `by_currency[]`;
  `InvoiceDetail` + `fee`, `fees[]`, `discount`, `po_number`, `due_*`, `related`, `referenced_by[]`, `effective_total`,
  item `line_kind` / `code` / `discount` / `tax_amount` / `vat_rate_label`.
- Mappers `fromRow` / `fromDetail` fill the new optional `Invoice` fields (absent — not `undefined` — when the server
  does not send them, so mock mode and older backends render "—"); the detail keeps the row-only previews it does not
  carry; `fromRow` keeps the detail-only fee lines / note / effective value of an opened record. An older backend
  without `by_currency` gets one VND row from its VND KPIs; a detail `related` of `replaced_by` / `adjusted_by` without
  `referenced_by` becomes one referencing entry.
- Helpers used by every screen: `exchangeRateOf` / `vndOf` / `totalVndOf` (§3.13, VND → rate 1, foreign without rate →
  null = "Thiếu tỷ giá"), `totalsByCurrency` (mock totals bar), `relationsOf` (§3.15: API `related`, mock derived from
  `relatedId`), `effectiveTotalOf` (API `effective_total`, mock original + Σ adjustments), `lineTaxOf` (API reconciled
  `tax_amount`; display fallback amount × rate), `feeOf`, `itemNamesOf`, `vatRatesOf`. Mock `kpisFor` fills `fee` and
  `byCurrency`; mock keyword search also matches `poNumber`.
- `lib/weinvoice/types.ts`: optional `ItemKind`, item `kind / code / discount / taxAmount / vatLabel`, `InvoiceFee`,
  `InvoiceRef`, `InvoiceRelations`, invoice `fee / fees / tradeDiscount / poNumber / dueDate / dueText / itemNames /
  itemCount / vatRates / related / effectiveTotal`.
- `lib/weinvoice/format.ts`: `fmtPrice` / `fmtQty` (up to 6 decimals, §3.14), `fmtRate`, `vatRateText` (−2 = KKKNT).

**Screens:**

- B1/B2 — `components/invoices/DateRangePicker.tsx` (new; the shared WeCMS `DateRangePopover` has other presets and no
  future lock): trigger "Tháng 11/2026" / "Năm 2026" / "Tháng 1/2026 → Tháng 3/2026" / "01/11/2026 → 27/11/2026"
  before "Chọn nhanh"; panel = year select + "Cả năm", 12 months, Quý I–IV, 6 tháng đầu / cuối năm (months after
  today disabled), Từ ngày / Đến ngày typed `dd/mm/yyyy` or two calendar clicks (days after today disabled), Huỷ /
  Áp dụng; preset ranges end at today. `period.ts`: `r<from>_<to>` period keys, `currentMonthKey` (list default),
  `monthsRange`, `isFutureMonth`, `parseDmy`. The range text line is removed.
- B3 — `inv.search_ph` mentions item name and PO (the server matches them, backend record). B4 — kind options were
  already "Tất cả · Hoá đơn thường · Máy tính tiền (MTT) · Không mã CQT" (`common.all`).
- B5/B6 — `InvoiceListPage.tsx` columns: default Ngày lập · Nhãn · Ký hiệu · Số HĐ · Đối tác · Hàng hoá / dịch vụ ·
  Loại tiền · Tỷ giá · Trước thuế · Tiền thuế · Phí / lệ phí · Tổng tiền · Tổng quy đổi (VND) · Tệp gốc · Phát hành qua
  · Thao tác; optional (hidden) Trước thuế (VND) · Thuế (VND) · Thuế suất · CK thương mại · HĐ liên quan · Hạn thanh
  toán · Số PO (plus the existing Hướng / MST đối tác / Mã CQT / Nguồn / Tag). Amounts in the invoice currency,
  right-aligned; foreign currency badge; "Thiếu tỷ giá" in red; due date red when `due_date` parses and is past, else
  the text as written; HĐ liên quan "→ 1C26TAA-7 · 01/10/2026" (⚠ when the original is not stored) or "← …".
- B7/B8 — `components/invoices/ItemsCell.tsx` (new): cell = first names joined "/" + "+n mặt hàng"; hover (250 ms) →
  portal list "i/n"; click → `ItemsModal` "Chi tiết hàng hoá" (loads `GET /invoices/{id}` in api mode): STT · Loại
  dòng · Mã hàng (when any) · Tên · ĐVT · SL · Đơn giá · Chiết khấu · Thuế suất · Thành tiền · Tiền thuế · Tổng
  (+ Tổng quy đổi (VND) for a foreign currency); fee rows "Không thuế"; footer Cộng tiền hàng → Phí / lệ phí →
  Tổng thanh toán (single "Tổng cộng" row without fees); "Trên hoá đơn: tiền hàng · thuế · (phí ·) tổng CCY" with
  "⚠ …" when pre-tax + tax + fee ≠ total or the lines + fees ≠ total. Clicks inside the cell / tooltip / popup are
  stopped so they never open the invoice detail (portal events bubble to the row in React).
- B9 — `components/invoices/InvoiceTotals.tsx` (new): table per currency (currency badge + "n HĐ" · Trước thuế · Tiền
  thuế · Phí / lệ phí · Tổng tiền · Tổng quy đổi (VND)) and, with a foreign currency or several currencies, a
  "Tổng quy đổi (VND)" row from the VND KPIs; no "VND" after the converted numbers. Same component for both directions.
- B10 — KPI cards already summed VND (`kpis.*` are VND server-side and in mock `toVnd`) and labelled "… VND": unchanged.
- B11 — `ColumnSetting.tsx` `mergeViewColumns`: a column missing from the saved setting is inserted right after the
  nearest earlier default column the user has, with its default visibility (was: appended hidden). Persistence
  unchanged (the existing `localStorage` key `weinvoice.viewsetting.invoices`; no screen-id bump, so saved order and
  visibility of existing columns are kept).
- C1/C2 — `InvoiceDetailModal.tsx`: `AmountSummary` "a + x (+ fee) = total CCY", label "Trước thuế + thuế + phí = tổng"
  when there is a fee, VND + rate for a foreign currency or "Thiếu tỷ giá"; `RelatedInfo` "Hoá đơn liên quan":
  "Thay thế cho / Điều chỉnh cho 1C26TAA-7 · 01/10/2026" (button opens it when its id is known) + note, or "⚠ Chưa có
  HĐ gốc trong hệ thống…"; on an original "Đã được thay thế / điều chỉnh bởi (n)" + list (status pill, link, date,
  total) + "Giá trị còn hiệu lực" = `effective_total`.
- C3 — `InvoiceSheet.tsx` + `exporter.ts renderedHtml` share `renderedItemCells` / `renderedTotals` /
  `relatedLineText`: yellow line "Điều chỉnh / Thay thế cho hoá đơn Mẫu số … Ký hiệu … Số … ngày … — note", fee table
  (STT · Tên loại phí · Tiền phí), "Tổng tiền phí", "Tổng tiền chiết khấu thương mại" (only ≠ 0), qty / price up to 6
  decimals, rate label from the XML (KKKNT), "(Hóa đơn điều chỉnh)" heading.
- C4 — status labels come from the API (`status`, backend maps `TCHDon`); no "tăng / giảm" labels exist.
- A1 — `chk.found_money` VI / KO now "… {m} VND" (other invoice screens were already ISO codes). A2 —
  `jn.r.any_partner` "— Tất cả đối tác —"; no other "Mọi" option labels in the invoice / tax screens.
- A3 — `lib/weinvoice/nav.ts`: Tax module groups `tax` ("Thuế & kê khai") and `catalog` ("Danh mục"; Hệ thống tài
  khoản · Vật tư, hàng hoá, dịch vụ · Nhóm VTHH · Đơn vị tính), each catalog item with a **P5** badge (roadmap phase
  "Rủi ro NCC & hạch toán" that these catalogs feed); routes `app/(dashboard)/tax/{accounts,items,item-groups,units}`
  render `ComingSoon` with `soon.<key>.*` texts.
- Locales: 98 new keys + 3 updated values in each of `vi.json` / `en.json` / `ko.json` (`drp.*`, `it.*`,
  `inv.col.*`, `inv.fx_*`, `inv.discount_tip`, `detail.amounts_fee`, `detail.rel.*`, `nav.g.catalog`, `nav.i.*`,
  `soon.*`). The unrelated uncommitted `conn.count` hunk was kept.

## Files Changed

| File | Change |
|---|---|
| `lib/weinvoice/types.ts` | optional v1.2 invoice / item fields, `InvoiceFee`, `InvoiceRef`, `InvoiceRelations`, `ItemKind` |
| `lib/weinvoice/format.ts` | `fmtPrice`, `fmtQty`, `fmtRate`, `vatRateText` |
| `lib/api/weinvoice/invoices.ts` | wire types + mappers for row / KPI / detail v1.2 fields; helpers (§3.13–§3.15); mock KPIs `fee` / `byCurrency`; PO in mock search |
| `lib/weinvoice/exporter.ts` | rendered HTML: fee table, fee / discount totals, related line, decimals; shared helpers |
| `lib/weinvoice/nav.ts` | Tax › "Danh mục" group (4 items, P5) |
| `components/invoices/period.ts` | range keys, current-month default, picker helpers |
| `components/invoices/DateRangePicker.tsx` | **new** — B1 picker |
| `components/invoices/ItemsCell.tsx` | **new** — B7 cell + B8 popup |
| `components/invoices/InvoiceTotals.tsx` | **new** — B9 totals bar |
| `components/invoices/InvoiceListPage.tsx` | B1/B2 period row, B5/B6 columns + cells, B9 footer |
| `components/invoices/ColumnSetting.tsx` | B11 `mergeViewColumns` |
| `components/invoices/InvoiceDetailModal.tsx` | C1 `RelatedInfo`, C2 `AmountSummary` with fee |
| `components/invoices/InvoiceSheet.tsx` | C3 rendered copy |
| `app/(dashboard)/tax/{accounts,items,item-groups,units}/page.tsx` | **new** — `ComingSoon` routes |
| `locales/vi.json`, `en.json`, `ko.json` | v1.2 labels, A1 / A2 / B3 value updates |
| `components/invoices/InvoiceListPage.providerTooltip.test.tsx` | pins "today" to 2026-10-20 (mock data ends 2026-10; the list now opens on the current month) |
| `components/invoices/DateRangePicker.test.tsx` | **new** test |
| `components/invoices/InvoiceScreenV12.test.tsx` | **new** test |
| `lib/api/weinvoice/invoices.v12.api.test.ts` | **new** test |
| `docs/features/weinvoice/README.md`, `CLAUDE.md` | route table + route count (25 → 29) / Tax module groups |

## API Impact

Consumes the backend fields of the counterpart record (`GET /invoices`, `GET /invoices/{id}`); no request changes.
Sorting by the new columns is not offered (the backend sort whitelist is unchanged).

## Database Impact

NONE (frontend) — depends on the backend record above for the new list / detail fields.

## Verification

### Automated Tests

- `npx vitest run`: baseline 33 files / 247 tests PASS → after 36 files / 280 tests PASS (33 new tests in 3 new files;
  1 existing test adjusted, see Files Changed).
- `npx eslint` on all 21 changed / new source and test files: 0 problems.
- `npx tsc --noEmit -p .`: 0 errors outside `.next/types` (44 lines, all stale `.next/types/validator.ts` references to
  removed `addon/*` pages — pre-existing).

### Test Scenarios

Covered by the new tests: current-month default (and the first `GET /invoices` asking for it); range keys; future
months / quarters / halves locked; Q IV / whole year cut at today; typed range; end after today not applicable;
calendar two-click range; trigger labels; totals bar VND-only vs VND + USD (+ VND row, no "VND" suffix); items popup
lines (kind, code, 6-decimal price, reconciled tax), fee row "Không thuế", 3-line footer, on-invoice line, mismatch
warning, foreign-currency VND column; items cell hover "i/n" and popup; clicks inside the popup do not reach the row;
"no lines" text; related section (missing original ⚠ + note, stored original opens, original with adjustments +
effective value, mock derivation); amounts with fee; missing rate; rendered copy and HTML (related line, fee table,
fee / discount totals, decimals, no discount line at 0); column-setting merge; API mapping of every new row / KPI /
detail field, older-backend fallbacks.

### Regression Review

Existing invoice list tests (server paging, download bar, provider tooltip), currency regression tests
(`InvoiceAmounts.currency`) and the whole suite pass. The rendered copy keeps its USD / VND behaviour (amount in words
only for VND).

### Manual Verification

NOT RUN — no dev server was started (task instruction); not checked against the real backend or in a browser.

## Test Evidence

Test result:
[WeInvoice Invoice Screens v1.2 (web) — Test Result](../../testing/results/weinvoice-invoice-screen-v1-2-web-test-result-2026-11-27.md)

Final test result:    PASS (automated)
Regression coverage:  PASS

## Result

UI Spec v1.2 A–D web share implemented; automated checks pass. Not committed (§15).

## Known Limitations / Follow-up

- **Mock mode opens on an empty month**: mock invoices end in 2026-10 and the list now opens on the current month
  (spec B2) — pick a month / range to see data.
- Not run in a browser or against the backend (layout at 375 / 1440, real `by_currency`, real related links).
- The items popup trusts the backend's reconciled line tax (`tax_amount`, §3.14); without it the tax shown is
  amount × rate (display only). The §3.14 tax-status labels (Thuế khớp / Lệch làm tròn / Lệch bất thường) belong to
  the auto-journal (part E) and are not shown here; the popup warns only on total mismatches.
- "Thiếu tỷ giá" count per currency in the totals bar (prototype) is not shown — the backend `by_currency` has no such
  count.
- The related-invoice column shows only what the row carries (first link); the detail is needed for the note and the
  effective value.
- Catalog screens (F, G) are ComingSoon pages; the P5 badge is our choice (the v1.0 Roadmap has no row for them) —
  confirm with the PO.
- New columns are not sortable (backend sort whitelist).
- `period.ts` `CURRENT_YEAR` / quick chips unchanged ("Năm nay", "Quý n/yyyy").

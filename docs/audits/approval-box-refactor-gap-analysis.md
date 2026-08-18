# Approval Box — Refactor Gap Analysis (Frontend)

Frontend view of the SIT-readiness gaps raised on the Approval Box main page (`/payment/approval-box`) and how the Next.js side consumes the fixes. The authoritative, full cross-system findings (legacy SQL evidence, backend solution, verification) live in the backend doc — this page records only the **frontend-visible** behaviour and the wire/mapper/component touch-points.

> **Authoritative source:** [wecms-api refactor-gap-analysis.md](../../../wecms-api/docs/features/payment/approval-box/refactor-gap-analysis.md) · audits: [approval-box-main-legacy-vs-refactor-audit.md](../../../docs/audits/approval-box-main-legacy-vs-refactor-audit.md), [approval-box-followup-verification.md](../../../docs/audits/approval-box-followup-verification.md).

Status vocabulary: **MATCH** / **PARTIAL** / **MISSING** (frontend consumption parity with the legacy `resl_0001_001` screen).

---

## 1. SIT-readiness gaps (G1–G5) — frontend impact

| # | Gap | Status | Frontend change |
|---|---|---|---|
| **G1** | Footer currency totals | **FIXED** | The footer now binds to the backend `footer_totals` (tab-unfiltered, full result set) instead of `approvalBoxCurrencyTotal(displayRows)` (a client page-slice sum). See §2. |
| **G2** | Approver status logic | **FALSE POSITIVE** | No change. The status badge + tab counts were already correct — legacy shows document-level status to every persona (the IDO calls `wb_get_appr_stts` with `apprvr_id = reg_id`), which the wire `appr_stts` already reflects. |
| **G3** | Visibility scope | **FIXED** (backend) | No frontend change — the list call carries no visibility params; the backend restored the SCDUL/OVRS/CARD uploader branches. A non-admin uploader now receives their document in the list, the tab counts, and the footer totals. |
| **G4** | Footer document count | **FIXED** | The footer document count now binds to `footer_totals.total_document_count` (tab-unfiltered) instead of `total_count` (tab-filtered, which still drives pagination). See §2. |
| **G5** | Card payment amount | **FIXED** (backend) | No frontend change — `tot_pay_amt` for `appr_dv='33'` rows now carries `SUM(CARD_TRNS_HSTR.TRSC_AMT)` from the server; the row, the footer, and the Excel export all read the correct card amount. |

Net frontend surface: **G1 + G4 only** (footer wiring + one new wire type + one mapper). G3/G5 are backend-only; the frontend consumes the corrected values transparently. G2 is a no-op.

---

## 2. Footer totals — frontend wiring (G1 + G4)

**Before (page-slice, removed 2026-06-16):**
- `mappers.ts` exported `approvalBoxCurrencyTotal(rows)` — summed `ApprovalRow.amount` over the **current page slice** and bucketed by `currency`.
- `ApprovalBoxPage` computed `currencyTotals = useMemo(() => approvalBoxCurrencyTotal(displayRows), …)` and passed `documentCount={totalCount}` (the tab-filtered count) to `<ApprovalTableFooter>`.
- Result: totals were wrong across pages / on non-All tabs (G1); the doc count changed per tab vs legacy's tab-unfiltered `TOT_CNT` (G4).

**After (backend aggregate):**
- New wire type `ApiApprovalBoxFooterTotals` (`total_document_count, total_usd_amount, total_vnd_amount, total_krw_amount`) on `ApiApprovalBoxListResponse.footer_totals`.
- New mapper `mapApprovalBoxFooterTotals(api.footer_totals)` → `{ documentCount, totals: CurrencyTotal[] }` (always USD/VND/KRW in order, even when zero). `MappedApprovalBoxList` exposes `footerDocumentCount` + `footerCurrencyTotals`.
- `ApprovalBoxPage` binds `documentCount={footerDocumentCount}` and `totals={currencyTotals = data?.footerCurrencyTotals ?? EMPTY_CURRENCY_TOTALS}` to `<ApprovalTableFooter>`. The `EMPTY_CURRENCY_TOTALS` (three zero rows) covers only the first paint before any response latches.
- `total_count` is retained but now only feeds **pagination** (`<Pagination total>`), never the footer count.

Legacy parity: the backend computes the per-currency sums + count over the **tab-unfiltered full result set** (legacy `resl_0001_001` footer bar). The card-payment amount (G5) is resolved server-side, so the footer's per-currency buckets include the correct `SUM(CARD_TRNS_HSTR.TRSC_AMT)` for card rows.

---

## 3. Coverage vs legacy (frontend)

| Capability | Status | Note |
|---|---|---|
| Tabs (All / Pending / In Progress / Approved / Rejected) | MATCH | tab → `appr_type_cd` map; counts from `tab_counts`; "All" = sum of four |
| Date filter (Last 30 Days default) | MATCH | client computes the ISO window; sends `from_date`/`to_date` (YYYYMMDD) |
| Search | MATCH | server-side via `srch_wd` |
| Column sort | MATCH | server-side via `sort_field`/`sort_direction` (View Setting FIELD_IDs) |
| Pagination / page size | MATCH | `total_count` (tab-filtered) drives the count + page count |
| Footer document count | MATCH (G4) | `footer_totals.total_document_count` (tab-unfiltered) |
| Footer currency totals | MATCH (G1) | `footer_totals.total_*_amount` (tab-unfiltered, full set, card-aware) |
| Row status badge | MATCH | `appr_stts` → `StatusBadge`; document-level (G2 confirmed parity) |
| Card amount column | MATCH (G5) | `tot_pay_amt` carries the server-side card sum |
| Document-No → detail dialog | MATCH | opens `ApprovalDetailsDialog`, composes from the row + approvers + module detail |
| Excel export | MATCH | `POST /export`; backend reuses the same query + card-aware amount |
| Visibility (uploader) | MATCH (G3) | no frontend param — backend scopes by tenant + requester/approver/uploader |

No frontend area is MISSING. The page is SIT/UAT-ready against the verified backend.

---

## 4. Open items

None frontend-side. The footer-totals binding, the new wire type, and the mapper landed with the 2026-06-16 backend fix in one full-stack change (per the workspace full-stack-ownership rule). Type-check (`tsc --noEmit`) is green.

# Invoice Currency Unit Display — Audit

**Date:** 2026-11-25
**Type:** AUDIT / INVESTIGATION
**Status:** COMPLETE
**Repository:** we-scraping-web
**Investigation Status:** COMPLETE
**Approval Status:** PENDING
**Implementation Status:** NOT STARTED

## Observed Behavior

User report (screenshot, invoice detail modal, Grab 1C26TNN-270539 of MST 0319232069): the side panel
shows "TRƯỚC THUẾ + THUẾ = TỔNG 44.445 + 3.555 = 48.000 **₫**", the PDF shows "Loại tiền (Currency):
**VND**". User asks to check the currency unit ("đơn vị tính").

## Expected Behavior

The unit shown next to an amount is the invoice's own currency (spec `02` §3.3 as amended: any ISO 4217
code from `DVTTe`, `VNĐ` → `VND`).

## Scope

Where the web shows a currency unit for an invoice amount: detail modal, invoice list, bản thể hiện,
KPIs / totals.

## Initial Evidence

`components/invoices/InvoiceDetailModal.tsx:127` appends a literal `₫` to `inv.total`.

## Investigation Plan

1. Find every place an invoice amount is rendered with a unit.
2. Check how `currency` reaches the UI (backend `InvoiceRow.currency`, mapper `toInvoice`).
3. Count non-VND invoices in the engine DB to size the impact.

## Evidence

- Backend is correct: `InvoiceCodes.currency` (`we-scraping-api`) maps `DVTTe` to ISO (`VNĐ`/`Đ`/blank → `VND`) and
  `InvoiceRow` / `InvoiceDetail` carry `currency`, `exchange_rate`, `total_vnd`; mapper `toInvoice` keeps it.
- Engine DB (read-only, 2026-11-25): invoices by currency (XML `don_vi_tt`, else list `dvtte`): VND 38,866 ·
  `VNĐ` 43 · **USD 428** · **KRW 11** · blank 59,533 (= VND). 246 USD invoices with XML across 6 MSTs; **213 of
  them have cents** (e.g. 3600790154 C26TKS-445: 7,303.84 USD, rate 25,705).
- Screenshot invoice (Grab, VND): "48.000 ₫" is **correct** — VND shown with the ₫ symbol.

## Root Cause

The web ignores `Invoice.currency` when it renders an amount:

| Place | Today | For a USD invoice of 7,303.84 |
|---|---|---|
| Detail modal `InvoiceDetailModal.tsx:127` | `fmtMoney(total) ₫` — literal ₫ | **"7.304 ₫"** (wrong unit, cents lost) |
| List rows `InvoiceListPage.tsx:932–936` | `fmtMoney(...)`, no unit | "7.304" — no unit, cents lost |
| Bản thể hiện `InvoiceSheet.tsx` (`Sum`, item rows) | `fmtMoney`, no currency line | cents lost, no "Loại tiền" |
| Supplier risk `SupplierRiskPage.tsx:180`, command palette `CommandPalette.tsx:85` | literal `đ` | wrong unit |
| Replacement compare `InvoiceDetailModal.tsx:653–655` | `fmtMoney` | cents lost |

`fmtMoney` = `Math.round(n).toLocaleString("vi-VN")` — always 0 decimals. `lib/currency.ts` › `formatAmount(v, ccy)`
already does per-currency rules (VND `550.000 ₫`, USD `$7.303,84`, KRW `₩…`, other ISO = number only) but no
WeInvoice screen uses it. `lib/weinvoice/types.ts:68` still types `currency` as `"VND" | "USD"` (spec amendment
says any ISO code).

KPI cards / totals footer (`InvoiceListPage.tsx:474–475, 750`, dashboard) are **correct**: they sum `total_vnd`
(foreign × rate) and label ₫.

## Recommended Implementation

1. Add a WeInvoice money helper (e.g. `fmtInvoiceMoney(v, currency)` in `lib/weinvoice/format.ts`) delegating to
   `formatAmount` — VND unchanged (`48.000 ₫`), USD 2 decimals, other ISO code shown as a code suffix when there is
   no symbol (e.g. `1.000 JPY`→`¥1.000`, `SGD` → `1.000 SGD`).
2. Use it in the detail modal (pre-tax + tax + total), list rows (amount columns; optionally a small currency tag
   when ≠ VND), replacement compare, supplier risk, command palette, `InvoiceSheet` (+ a "Loại tiền" line).
3. Detail modal: for non-VND also show the VND equivalent and rate (`≈ 187.745.207 ₫ · tỷ giá 25.705`).
4. Widen `Invoice.currency` to `string`.

## Required Tests

Unit tests for the helper (VND / USD cents / KRW / unknown ISO); a detail-modal or list-row test with a USD row.

## Affected Repositories

we-scraping-web only. API impact: none. DB impact: NONE (frontend).

## Investigation result

Investigation COMPLETE · Approval PENDING · Implementation NOT STARTED.

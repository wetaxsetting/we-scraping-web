# Cash Flow — Test Scenarios (Frontend)

Frontend SIT/UAT scenarios. Backend math/parity scenarios:
[wecms-api test-scenarios](../../../../../../wecms-api/docs/features/banking/reports/cash-flow/test-scenarios.md).

---

## 1. Load & search

| ID | Scenario | Expected |
|---|---|---|
| FE1 | Initial load | matrix chrome renders (empty rows until first fetch resolves); rate inputs prefilled from `/exchange-rates` (or static 26000/19 if it fails); year=current, base=VND, period=This Year, banks=All |
| FE2 | Loading state | while `loading && !report`, a centered "Loading…" note shows |
| FE3 | Search VND | click Search → `fetchCashFlow` fires → matrix populates with Opening / L1–L3 / Subtotals / SALES PROFIT / NON SALES PROFIT / End Balance |
| FE4 | No refetch on filter change | changing year/currency/quarter/banks does **not** refetch until Search is clicked |
| FE5 | Backend error/empty | matrix shows empty chrome (`buildEmptyReport`), **never** mock rows; an export error opens a `useDialog` error dialog |

## 2. Currency

| ID | Scenario | Expected |
|---|---|---|
| FE6 | Currency = USD | amounts formatted with `$` prefix / 2 digits; combined Exchange Rate input now edits `krwRate` |
| FE7 | Currency = KRW | amounts formatted with `₩` prefix / 0 digits (no legacy `"KWR"` typo) |
| FE8 | Currency = VND | `₫` suffix / 0 digits |
| FE9 | Rate override | edit the Exchange Rate input → Search → new rate reflected in converted amounts |

## 3. Quarter column hiding (client-only)

| ID | Selection | Months shown | Balances |
|---|---|---|---|
| FE10 | This Year | Jan–Dec (12) | full-year |
| FE11 | Quarter 1 | Jan, Feb, Mar | **identical** to This Year (full-year math) |
| FE12 | Quarter 2 | Apr, May, Jun | identical |
| FE13 | Quarter 3 | Jul, Aug, Sep | identical |
| FE14 | Quarter 4 | Oct, Nov, Dec | identical |

Opening Balance (header), End Balance (footer), and every monthly cell are unchanged across selections —
only the rendered `<col>` set shrinks. No refetch on quarter change.

## 4. Special rows & hierarchy

| ID | Scenario | Expected |
|---|---|---|
| FE15 | Opening Balance | appears in the header second row, per month |
| FE16 | L1/L2/L3 | L1 cell spans its tree; L2 spans its L3 children; L3 shows KO name + Item code + Item name + months |
| FE17 | SALES PROFIT | green band before the first ACC-03 group |
| FE18 | NON SALES PROFIT | **two** rows — a blue subtotal band (ACC-03) + a green band — intentional legacy duplicate |
| FE19 | End Balance | solid-green sticky footer, label centered (colSpan 5), white bold |
| FE20 | Zero amounts | render blank (no "0", no "–") |
| FE21 | No annual-total column | the matrix has no Total column on screen (export only) |

## 5. Sticky / scroll / responsive

| ID | Scenario | Expected |
|---|---|---|
| FE22 | Vertical scroll | header sticky-top, End Balance sticky-bottom, 5 left columns sticky-left |
| FE23 | Wide table | horizontal scroll inside the report viewport (no nested second vertical scroll) — §7d |
| FE24 | Laptop 1024×768 | filter row pinned; only the report body scrolls; page does not overflow |
| FE25 | No pagination | report page never renders `<Pagination>` (§7b) |

## 6. Bank filter

| ID | Scenario | Expected |
|---|---|---|
| FE26 | Single account | popover shows `bankNm · acctNo`; Search → only that account aggregated |
| FE27 | Multiple | ">N selected" label; union aggregated |
| FE28 | All Banks | empty selection = no wire filter = all |
| FE29 | Options source | bank list comes from `fetchAccounts()`; silent empty on error |

## 7. Excel export

| ID | Scenario | Expected |
|---|---|---|
| FE30 | Export with data | `CashFlow_<DDMMYYYY>.xlsx` downloads; title / subtitle / 2-row header; merged L1/L2; blue subtotal + green Sales-Profit + green NON SALES PROFIT bands; solid-green End Balance; all 12 month columns regardless of quarter |
| FE31 | Export without data | export still produces a valid sheet (chrome only) or surfaces the backend's empty handling |
| FE32 | Formatting | amounts `#,##0.##` right-aligned, zero cells blank (G7: per-currency format is a pending PO call) |
| FE33 | Hierarchical rows | L1/L2 merged cells, L3 leaf rows under their L2 — no duplicate NON SALES PROFIT row in the sheet, no empty row before End Balance |
| FE34 | Export error | non-`WBE1401` `ApiCallError` opens a `useDialog` error dialog with the code |

## 8. Permissions

| ID | Scenario | Expected |
|---|---|---|
| FE35 | Authorized user | JWT present → page loads and fetch succeeds |
| FE36 | Unauthorized / expired | 401 → global session-expired interceptor redirects to `/login` (no per-page handling) |

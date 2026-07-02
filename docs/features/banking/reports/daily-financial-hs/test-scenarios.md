# Daily Financial (HS) — Frontend Test Scenarios

> Manual SIT/UAT catalogue for the screen. **Automated frontend tests are ABSENT** for this
> feature (no test files in the folder) — every scenario below is manual until a FE test harness
> lands. Backend-verifiable behaviour (validation, tenant scope, workbook content) is covered by
> the backend unit tests — see the backend package's
> [test-scenarios.md](../../../../../../wecms-api/docs/features/banking/reports/daily-financial-hs/test-scenarios.md).

## 1. Load & search

| # | Scenario | Expected |
|---|---|---|
| L-1 | Open `/banking/reports/daily-financial-hs` as an H-tenant granted user | Report renders eagerly (today + all accounts); no empty-state Search gate |
| L-2 | Sidebar | "Daily Financial (HS)" appears under Banking → Reports only when `/navigation` returns the H-tree node; active state highlights on visit |
| L-3 | Change date / bank selection without Search | No refetch |
| L-4 | Search with a past date | Ledger reloads for that date |
| L-5 | Select a subset of accounts → Search | Only those accounts render; filter survives until changed |
| L-6 | F/M-tenant user (no menu node) navigates to the URL directly | Page loads (auth-only route guard) but the API returns 403 `WBE1003` → no data; menu never shows the entry. Frontend-side route blocking: **not implemented** (by design — backend is the boundary) |

## 2. Table rendering

| # | Scenario | Expected |
|---|---|---|
| T-1 | Row taxonomy | Per account: BEFORE_BALANCE → TRANSACTIONs → blue SUB TOTAL; green TOTAL closes each currency section (VND → USD → KRW), immediately after that currency's last account |
| T-2 | Frozen cells | Bank + Currency render once per group (rowSpan over entries + SUB TOTAL); TOTAL rows render every column (outside the span) |
| T-3 | Bank header parsing | Account-type parenthetical, red BRANCH accent, red Due-Date label/value render when present in `bank_account` (rare on HAENGSUNG seed — all Current accounts) |
| T-4 | Null amounts | Blank cells, never "0"; read-only text cells never echo column labels |
| T-5 | No spacer rows | tbody `<tr>` count = ΣTᵢ + 2·accounts + currency-totals |
| T-6 | Amount format | id-ID grouping (dot thousands), no currency symbol; USD shows decimals |
| T-7 | Wide viewport / 1024×768 | Only the report body scrolls (§7b); horizontal scroll appears when the visible-column sum exceeds the viewport |

## 3. Editable save

| # | Scenario | Expected |
|---|---|---|
| E-1 | Edit Receipt Code on a TRANSACTION row → blur | One PATCH; silent success; value stays in the cell |
| E-2 | Same via Enter | Same |
| E-3 | Blur with unchanged value | No request |
| E-4 | Clear a value | PATCH with `""` → column cleared (verify via re-Search) |
| E-5 | BEFORE_BALANCE row | No input boxes at all |
| E-6 | Save failure (backend down / not-found) | Shared error dialog (`type:"error"`) with the server code; cell not rolled back automatically |
| E-7 | Edit → Search | Persisted value returns from the DB |
| E-8 | Rapid edits across multiple cells | Each field saves independently; no lost updates within one row (*concurrency beyond this: not verified from implementation*) |

## 4. View Setting

| # | Scenario | Expected |
|---|---|---|
| V-1 | Hide columns → Save → reload | Persisted per user; all rows (incl. SUB TOTAL / TOTAL) stay column-aligned; no blank right strip (`min-width = Σ visible widths`) |
| V-2 | Reorder → Save | Order follows `disp_ord`; totals stay under their columns |
| V-3 | Reset | 12 system defaults return |
| V-4 | Cancel / ESC | Draft discarded, no network call |
| V-5 | Unseeded env (V249 not run) | Popover works off `DEFAULT_VIEW_SETTING_ITEMS`; Save/persistence unavailable (`WBE2001`) — degraded, not broken |
| V-6 | Memo column in the popover | Appears as user-controllable (`MEMO_NOTE`); never hidden as a special FIELD_ID |

## 5. Download

| # | Scenario | Expected |
|---|---|---|
| D-1 | Download in EN / KO / VI locale | Server-named `WeCMS_Daily_Financial_Report_{EN\|KO\|VI}.xlsx` saved; A1 title per locale |
| D-2 | Download with hidden columns | Workbook still carries all 12 columns |
| D-3 | Download after an edit, without re-Search | Saved value present in the workbook |
| D-4 | Download failure | Shared error dialog |

## 6. Currency & localization

| # | Scenario | Expected |
|---|---|---|
| C-1 | VND+USD+KRW data | Three sections, three green TOTALs, each anchored to its own currency |
| C-2 | Locale switch EN↔KO↔VI | Title, filter labels, bilingual column headers all translate; table headers always show KO+EN pair regardless of locale |
| C-3 | Khmer | Not supported (no `km.json` platform-wide) |

## 7. Regression watchlist (from the 2026-07 fix loop)

- TOTAL rows collapsing onto the last group (ORDER BY / anchoring) — fix 8.
- Hidden-column misalignment on summary rows — fix 10.
- Reappearing spacer/"-" separator rows — fix 11.
- Input boxes on BEFORE_BALANCE rows — fix 3.
- Save success misread as error (void `WBI0000` response) — fix 4.
- Sticky summary-label overlay covering numeric cells — reverted experiment; do not reintroduce
  without proper frozen-column offsets.

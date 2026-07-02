# Daily Financial (HS) — Legacy UI Spec vs Refactor

> Legacy `rept_0017_001` screen behaviour (read-only `WECMS DEV/` tree) compared with this page.
> The backend-side comparison (SQL, save path, Excel internals) lives in the backend package's
> [legacy-spec.md](../../../../../../wecms-api/docs/features/banking/reports/daily-financial-hs/legacy-spec.md);
> this file covers the screen surface.

---

## 1. Legacy screen (source of truth)

`WECMS DEV/WECMS/web/view/jex/wabooks/rept/rept_0017_001_view.jsp` +
`WECMS_STATIC/ts-src/js/jex/wabooks/rept/rept_0017_001.ts`:

- **Title** `Daily Financial` (ML `rept_0017_001_v001`, :134) with a toolbar of View-Setting icon
  (:139) + **Download Excel** button (`excel-icon.svg`, ML `v002`, :143-160).
- **Filter row** (:165-227): "As of" label (ML `v003`) + `#TO_DT` jQuery datepicker
  (display `DD-MM-YYYY`) · custom checkbox-driven **bank multi-select** ("All Banks" ML
  `v004`/`v005`; shows "{N} Banks Selected"; stores `BANK_CD`+`ACCT_NO` pairs) · **Search**
  button (ML `v006`). No keyword field.
- **Table** (:230-238): empty `<table id="table-view-hd" dymAreaId="table1">` — rows rendered by
  TS (`fn_renderTableRows` / `fnGetDataRow`): bank-grouped ledger, bilingual headers, blue
  account-total rows (`.ks-light-blue-background` `#e2f0ff`), green currency-total rows
  (`.ks-light-green-background` `#dcfce7`), exactly one `<tr>` per data row.
- **Behaviour:** page load runs the report for today + all banks; date/checkbox changes are inert
  until Search (auto-search commented out); editable inputs only on TRANSACTION rows, saved
  per-field on blur/Enter via `fn_saveData` → `rept_0017_001_u001`; Excel button GETs
  `rept_0017_001_r002_excel.act` with the current date/filter.

## 2. Side-by-side

| Surface | Legacy | Refactor | Parity |
|---|---|---|---|
| Landing | eager report render (today + ALL) | eager render, same defaults | ✅ |
| Title + toolbar | h1 + View-Setting icon + Excel button | `<PageHeader>` + list icon + Excel button (`ico-excel.svg`) | ✅ |
| As-of date | `#TO_DT` datepicker, `DD-MM-YYYY` display, `YYYYMMDD` wire | `<DateField>` with `formatValue` reverse-join, `yyyyMMdd` wire | ✅ |
| Bank filter | checkbox multi-select fed by `cash_0001_001_r003` | `<BankFilterPopover>` fed by `deriveBankOptions` over the `ALL` report's HEADER rows | ⚠ **intentional divergence** — equivalent data, different source (one fewer legacy service) |
| Search semantics | button-only refetch | `searchKey` bump, button-only | ✅ |
| Ledger rendering | jQuery row builder over `REC1` | `projectHsRows` → `BankGroup[]` → React table | ✅ (same row taxonomy + order) |
| Bilingual headers | KO + EN header lines | `col_ko.*` + `col.*` keys | ✅ |
| SUB TOTAL / TOTAL colours | `#e2f0ff` blue / `#dcfce7` green CSS classes | WB token backgrounds (blue/green) | ✅ visual |
| Summary-row structure | colSpan-merged label cells | one `<td>` per **visible** column (robust under View Setting hide/reorder) | ⚠ intentional divergence (visual output equivalent) |
| Editable cells | 5 fields, TRANSACTION rows, blur/Enter, one field per save | same | ✅ |
| Save feedback | silent success; totals refresh only on re-search | same (error dialog on failure) | ✅ |
| Excel | GET excel action; locale template; 12 columns always | GET `/report`; same templates (classpath); 12 columns always | ✅ (title localization divergence is backend/template-side — see backend legacy-spec §6) |
| Currencies shown | VND + USD (IDO filter) | VND + USD + KRW (+ any) | ⚠ intentional divergence (PO-approved) |
| View Setting | legacy popover on `rept_0017_001`/`table1` | shared popover on `banking-reports-daily-financial-hs`/`default` (V249 remap; `MEMO`→`MEMO_NOTE`) | ✅ behavioural |
| Pagination / sorting | none | none | ✅ |
| ML / i18n | `rept_0017_001_v001–v006` | `report.daily_financial_hs.*` (EN/KO/VI) | ✅ (new keys — legacy ML ids never reused) |

## 3. Localization comparison

| String | Legacy (EN default) | Refactor keys |
|---|---|---|
| Page title | "Daily Financial" (`v001`) | `report.daily_financial_hs.title` = "Daily Financial (HS)" — the "(HS)" suffix disambiguates the two refactor variants in one menu tree |
| Excel button | "Download Excel" (`v002`) | `report.download_excel` (shared) |
| As of / All Banks / Search | `v003`–`v006` | `report.as_of` · bank-popover strings · `common.search` |
| Column headers | rendered by TS from the legacy View-Setting rows | `col.*` / `col_ko.*` key pairs |

## 4. Known screen-level differences that are NOT gaps

1. **Bank dropdown source** (above) — revisit only if an account with no ledger rows for the
   default date fails to appear as an option (*edge not verified from implementation*).
2. **Page title suffix "(HS)"** — refactor menu carries both variants; legacy HAENGSUNG menu only
   had one Daily Financial entry.
3. **Sticky label experiment reverted** — legacy keeps summary labels in normal flow; the
   refactor briefly tried `sticky left-0` labels and reverted to legacy-like flow (2026-07-01).

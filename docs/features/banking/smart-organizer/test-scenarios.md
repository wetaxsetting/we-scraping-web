# Smart Organizer — Test Scenarios (Frontend SIT/UAT)

Frontend SIT/UAT scenarios for the Smart Organizer page + Organizer Settings dialog. Pair with the
backend scenarios:
[wecms-api/docs/features/banking/smart-organizer/test-scenarios.md](../../../../../wecms-api/docs/features/banking/smart-organizer/test-scenarios.md).

---

## 1. Entry & account scope (R11)

| # | Scenario | Expected |
|---|---|---|
| E-01 | Open from Transaction History (VND) Smart Organizer button | Navigates to `/banking/smart-organizer?account={bankCd}_{acctNo}`; grid loads that account |
| E-02 | Open from Transaction History (FCY) | Same; amounts render in the FCY currency |
| E-03 | Visit page with no `?account=` | Empty state shown; **no** API call |
| E-04 | Malformed `?account=` | Empty state; no API call |

## 2. Search / filter

| # | Scenario | Expected |
|---|---|---|
| S-01 | Default date range | Jan 1 – Dec 31 current year prefilled; list loads |
| S-02 | Narrow date range | Refetch; out-of-range rows gone |
| S-03 | Keyword search | Refetch with `q`; only matching remarks |
| S-04 | Column sort (Date/Account/Deposit/Withdrawal/Remarks/Reporting/Purpose) | Refetch with `sort_field`/`sort_dir`; order changes |
| S-05 | Page size change (10/20/50/100) | Client-side re-paginate |

## 3. Grid display

| # | Scenario | Expected |
|---|---|---|
| G-01 | Matched row | Shows resolved Reporting Account / Purpose / VAS / Contact **names**, not codes (R07) |
| G-02 | VND amounts | `₫` formatting (R06) |
| G-03 | FCY amounts (USD/KRW) | `$` / `₩` formatting (R06) |
| G-04 | Two-section header | "Bank Transaction Data" over date/acct/amounts/remark; "Confirmation" over classification |
| G-05 | No matched rows | Empty state + "Go to Organizer Settings" CTA |

## 4. Selection + confirm

| # | Scenario | Expected |
|---|---|---|
| C-01 | Select a row | Selection footer appears; row tinted |
| C-02 | Select-all | All page rows selected |
| C-03 | Save with selection | `POST /confirm`; success dialog "confirmed n"; selection cleared; list refetches; confirmed rows gone |
| C-04 | Save with none selected | Save disabled |
| C-05 | Confirm a now-already-confirmed row (race) | Error dialog with backend message |

## 5. Organizer Settings dialog

| # | Scenario | Expected |
|---|---|---|
| O-01 | Open dialog | View mode; rules listed (ordered by disp_ord); searchable |
| O-02 | Edit → add rule (Remark + Match Type + Receive/Pay + pickers) | Draft row added |
| O-03 | Create a PAY rule | Direction toggle = Pay; saved; PAY transactions begin matching (R03) |
| O-04 | Edit existing rule | PUT on save; values updated |
| O-05 | Delete rule | Row flagged; DELETE on save |
| O-06 | Save with a blank Remark | Validation error (`remark_required`); save blocked |
| O-07 | Save | onChanged fires; page refetches eligibility |
| O-08 | Cancel | Draft discarded |

## 6. States / errors

| # | Scenario | Expected |
|---|---|---|
| X-01 | Slow fetch | Sticky loading (no empty flash) |
| X-02 | Fetch error | Inline error |
| X-03 | Empty result | Empty state, not an error |
| X-04 | Confirm validation error (purpose/VAS/contact not found) | Error dialog with code/message |

---

> **Known frontend residual:** drag-reorder save in the settings dialog is deferred (the
> `reorderOrganizerRules` client + backend endpoint exist). Reorder-via-drag is therefore **not** an
> active UAT path yet. See [README.md](README.md) "Migration status".

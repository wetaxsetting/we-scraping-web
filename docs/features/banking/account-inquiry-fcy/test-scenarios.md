# Account Inquiry (FCY) — Frontend Test Scenarios (SIT/UAT)

> Frontend-oriented scenarios. Backend mirror:
> [wecms-api/docs/features/banking/account-inquiry-fcy/test-scenarios.md](../../../../../wecms-api/docs/features/banking/account-inquiry-fcy/test-scenarios.md).
> R&D: live-bank scraping may be unavailable locally (FCY-A03) — sync tests exercise the UI flow/contract.

## A. Search / list

| # | Scenario | Expected |
|---|---|---|
| A1 | Open `/banking/account-inquiry-fcy` | Page loads with title "Account Inquiry (FCY)"; only non-VND rows; currency dropdown present. |
| A2 | Search by bank | Grid filters; bank dropdown options unchanged. |
| A3 | Type keyword | Debounced (300ms) refetch; matches formatted nickname; page resets to 1. |
| A4 | No results | `account_inquiry.empty_fcy` shown; no crash. |
| A5 | Refetch flicker | Prior rows stay visible during refetch (stable-data latch). |

## B. Multi-currency / currency filter (FCY-A01)

| # | Scenario | Expected |
|---|---|---|
| B1 | "All Currency" default | Wire `currency=FCY`; all non-VND CCYs shown; one summary tile per CCY. |
| B2 | Narrow to USD | Wire `currency=USD`; only USD rows; single USD tile; dropdown still lists all cached CCYs. |
| B3 | Narrow to KRW | Only KRW rows; `₩` formatting. |
| B4 | EUR / JPY account | Visible under All Currency; concrete narrow works. |
| B5 | Each row amount formatting | Formatted per the row's own CCY (`$`, `₩`, …), not a page-wide currency. |
| B6 | Row currency label | Shows `"USD • Current"` / `"KRW • Savings"` etc. |
| B7 | VND account | Never appears on this screen. |

## C. Sort

| # | Scenario | Expected |
|---|---|---|
| C1 | Click BANK header | Cycles default → ASC → DESC → default; glyph updates; rows reorder via backend. |
| C2 | Sort by BALANCE | Numeric ORDER BY (DB-side), not a client sort. |
| C3 | VAS_ACCOUNT header | Not sortable (no glyph). |
| C4 | Change filter after sort | Page resets; sort preserved per the shared hook. |

## D. Pagination

| # | Scenario | Expected |
|---|---|---|
| D1 | Change page size | Resets to page 1; `{shown} of {total}` updates. |
| D2 | Navigate pages | Server-side; rows + totals consistent. |
| D3 | Totals vs. page | Summary tiles reflect the full filtered set, not the page slice. |

## E. Update / sync

| # | Scenario | Expected |
|---|---|---|
| E1 | Select rows → Update enables | Update button disabled until ≥1 selectable row checked. |
| E2 | Manual / disconnected row | Checkbox disabled + tooltip; cannot be selected. |
| E3 | Sync COMPLETED | Dialog shows counts/totals; list refetches; Last Update moves. |
| E4 | OTP / QNA / CAPTCHA challenge | Correct sub-dialog renders; resume continues; cancel aborts in-flight only. |
| E5 | Sync ERROR | Error dialog with `errorCode`. |
| E6 | Local R&D scrape | Document actual behaviour (likely unavailable); flow/contract still exercisable. |

## F. Balance popup / drill-down

| # | Scenario | Expected |
|---|---|---|
| F1 | Click a balance cell | `BalancePopover` opens anchored below the cell; transactions for the selected date load. |
| F2 | Popup footer totals | Deposit/withdrawal totals formatted per the row's CCY. |
| F3 | "View Details" | Deep-links to the per-account FCY Transaction History. |
| F4 | Popup near viewport bottom | Anchors above the cell instead. |

## G. Last Update display (FCY-A02)

| # | Scenario | Expected |
|---|---|---|
| G1 | Recent update | Humanized relative time + datetime tooltip. |
| G2 | Inquiry error | Red "Error" tag (+ time if present). |
| G3 | No timestamp | Blank cell. |

## H. Export

| # | Scenario | Expected |
|---|---|---|
| H1 | Excel from All Currency | XLSX downloads; multi-line per-CCY subheader; columns = visible View Setting set. |
| H2 | Excel from concrete CCY | Single subheader line. |
| H3 | Unsaved column reorder | Honoured in export (backend re-intersects visibility). |

## I. View Setting

| # | Scenario | Expected |
|---|---|---|
| I1 | Open popover | Lists user columns (CHECKBOX/ETC hidden); locked BANK disabled. |
| I2 | Hide a column / reorder / Save | Grid + export reflect the change; persists per user. |
| I3 | Reset | Reverts to system defaults. |

## J. Permissions / errors

| # | Scenario | Expected |
|---|---|---|
| J1 | Authorized user | All actions available. |
| J2 | Unauthorized | 403 → error dialog (`WBE1003`). |
| J3 | Session expired (401) | Global re-auth interceptor fires. |
| J4 | API failure | `useDialog({type:"error", errorCode})` with the server trace id. |

## K. Responsive

| # | Scenario | Expected |
|---|---|---|
| K1 | 375 / 768 / 1024 / 1440 | Filter row wraps, grid scrolls, tiles stack; no broken layout. |

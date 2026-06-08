# Account Inquiry (VND) — Test Scenarios (Frontend, SIT/UAT)

**Route:** `/banking/account-inquiry` · **Screen ID:** `banking-account-inquiry-vnd` · **Hub:** [README.md](README.md)

Frontend-facing SIT/UAT scenarios. Backend scenarios: [wecms-api/docs/features/banking/account-inquiry-vnd/test-scenarios.md](../../../../../wecms-api/docs/features/banking/account-inquiry-vnd/test-scenarios.md).

---

## 1. Search / list

| # | Scenario | Expected |
|---|---|---|
| FS1 | Open `/banking/account-inquiry` | VND accounts render; summary tiles show count + balance + available; no mock data |
| FS2 | Search by account nickname | debounced (300 ms) refetch; matches formatted nickname; page resets to 1 |
| FS3 | Filter by bank | only that bank's rows; bank dropdown still lists all banks |
| FS4 | Currency filter | not shown on VND (hidden); VND-locked |
| FS5 | Empty result | friendly empty message; pagination chrome consistent |

## 2. Update Balance / Sync

| # | Scenario | Expected |
|---|---|---|
| FU1 | Select account(s) → Update → success | sync dialog completes; latest-tx modal; list refreshes Balance/Available/Last Update |
| FU2 | OTP / CAPTCHA / QnA challenge | challenge UI renders; submit resumes via session; completes or errors |
| FU3 | Failed sync | error dialog with code + trace id; Last Update shows Failed; balance retained (not zeroed) |
| FU4 | Manual / disconnected account | checkbox disabled with tooltip (`manual` / `disconnected`); cannot be selected for sync |
| FU5 | Verify Last Update display | success → datetime (stale >72h → warning glyph); failure → red Failed |

## 3. Synchronization history

| # | Scenario | Expected |
|---|---|---|
| FH1 | Open Sync History from sync dialog | lists past attempts; filter by date/bank/result |
| FH2 | After a sync | new history row appears |

## 4. Balance popup / detail

| # | Scenario | Expected |
|---|---|---|
| FD1 | Click balance cell | `BalancePopover` shows recent transactions for that account/date |

## 5. Sorting

| # | Scenario | Expected |
|---|---|---|
| FO1 | Click a sortable header | cycles default→ASC→DESC→default; rows re-ordered by server |
| FO2 | Sort by Last Update | ordered by `acctBalLstInqDtm` (displayed column) |
| FO3 | VAS Account / checkbox headers | no sort glyph, not clickable |
| FO4 | Sort persists across pagination | sort retained when changing page |

## 6. Pagination

| # | Scenario | Expected |
|---|---|---|
| FP1 | Navigate pages | 0-based wire → 1-based "Page X of N" display; rows update |
| FP2 | Change page size (10/20/50/100) | page resets to 1; selection cleared; refetch |
| FP3 | Totals stable | summary tiles unchanged across page navigation |

## 7. View Setting / Print / Excel

| # | Scenario | Expected |
|---|---|---|
| FV1 | Toggle/reorder columns + Save | table re-renders; persists; CHECKBOX/BANK locked |
| FV2 | Reset | restores sys defaults |
| FV3 | Excel export | downloads `Account Inquiry (VND).xlsx` honouring current filter+sort+visible columns; no CSV |
| FV4 | Print | popup print of filtered rows (sidebar/nav excluded) |

## 8. Permissions / session

| # | Scenario | Expected |
|---|---|---|
| FA1 | Authorized user | sees granted accounts (admin sees all) |
| FA2 | Token expiry (401) | global session dialog → redirect `/login` |

## 9. Responsive

| # | Scenario | Expected |
|---|---|---|
| FR1 | 375 / 768 / 1024 / 1440 | filter wraps, table scrolls horizontally, tiles stack, pagination reflows |

---

Cross-reference: [screen-flow.md](screen-flow.md) · [ui-specification.md](ui-specification.md) · [api-consumption.md](api-consumption.md).

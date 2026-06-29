# HAENGSUNG Payment Refresh — Legacy Frontend Parity Audit

**Slug:** `haengsung-payment-refresh-frontend-parity` · **Domain:** Payment · **Product type:** `H` (HAENGSUNG Electronics) only · **Status:** Audit (docs only — no code changed in this pass) · **Audited:** 2026-06-28

> Verifies the refactor Next.js frontend for the HAENGSUNG Refresh button against the **live JEX legacy frontend source** (not assumptions). Backend is already implemented + verified (see [haengsung-payment-refresh.md](../../../../wecms-api/docs/features/haengsung-payment-refresh.md) and the [SIT verification](../../../../wecms-api/docs/features/haengsung-oracle-integration-sit-verification.md)). This audit covers the **frontend only**.
>
> **Outcome:** the refactor matches legacy on all load-bearing behaviors (button visibility gating, payment-type literals, period window, API call, list reload, error popup, duplicate-click prevention, localization, permissions). **Three differences** remain, all introduced by the refactor's success/loading UX — one Medium (extra success popup not in legacy), two Cosmetic. None are functional defects; the Medium one is a deliberate UX addition that the PO must accept or revert for strict parity.

---

## 0. Legacy source of truth (files read)

| Concern | Legacy file |
|---|---|
| Refresh button markup + HAENGSUNG gating | `WECMS DEV/WECMS/web/view/jex/wabooks/pymn/pymn_0001_001_view.jsp:382-389` (Vendor; Expense/Payroll/Overseas identical) |
| Refresh click handler + period build | `WECMS DEV/WECMS_STATIC/web/js/jex/wabooks/pymn/pymn_0001_001.js:56-74` |
| Refresh AJAX (`fnManualRefresh`) | `…/pymn_0001_001.js:1105-1129` |
| Per-module payment-type literal | `pymn_0001_001.js:72` `VENDOR` · `pymn_0003_001.js:81` `EXPENSE` · `pymn_0005_001.js:74` `PAYROLL` · `pymn_0007_001.js:74` `OVERSEAS` |
| Backend import action (shared) | `pymn_000{1,3,5,7}_00{2,2,2,3}_c002_act.jsp` → `wabooks/helper/ErpDataRefreshHelper.java` |

Refactor side audited: `components/payment/{vendor-payment,expense-payment,payroll,overseas-payment}/ScheduledPaymentPage.tsx`, `components/payment/shared/PaymentScheduledBatchListPage.tsx`, `hooks/useHaengsungRefresh.ts`, `lib/api/payment.ts`, `locales/{en,ko,vi}.json`.

---

## 1. Legacy frontend flow

```
User clicks Refresh  (#btnRefresh — rendered ONLY when PRDT_TYPE == 'H')
        │
        ├─ Confirmation popup?     → NO. Click handler fires immediately.
        │
        ├─ Build period            → reads the page date filter (#FROM_DT/#TO_DT, or
        │                            the calendar window, or sessionStorage fallback);
        │                            periodDate = createDateRange(FROM,TO) = "FROM-TO"
        │                            (ALWAYS the hyphenated range form, even single day).
        │                            paymentType = module literal (VENDOR/EXPENSE/PAYROLL/OVERSEAS).
        │
        ├─ Loading indicator?      → YES. tmsComm.createProgressBar() — a GLOBAL blocking
        │                            progress overlay shown for the whole call.
        │
        ├─ Backend action          → jexjs ajax "pymn_000X_00Y_c002" (.jct),
        │                            input { PAYMENT_TYPE, PERIOD_DATE }, async:false (SYNCHRONOUS).
        │
        ├─ Progress?               → NO incremental progress — just the on/off progress bar.
        │
        ├─ Success popup?          → NO. On success it silently reloads.
        │
        ├─ Failure popup?          → YES. jexjs.isJexError(data) → _v2common.app.showMessage(data)
        │                            (server JexError code/message), then destroyProgressBar().
        │
        ├─ Reload list?            → YES. fnLoadData({ TO_EXCEL:false }) re-runs the list query
        │                            with the current filter/sort/page, then destroyProgressBar().
        │
        ├─ Clear selection?        → No explicit clear. The tbody is re-rendered by the reload,
        │                            so row checkboxes reset implicitly (no code clears a set).
        │
        ├─ Focus?                  → NO focus handling.
        │
        └─ Other UI behavior?      → Duplicate-click prevention is implicit: async:false +
                                     the global progress overlay block the UI for the call's
                                     duration. No explicit button-disable. Button label ML
                                     = pymn_0001_001_v024 ("Refresh"). Excel Upload (#btn_excel,
                                     perm "U") renders instead for non-'H' tenants.
```

**Button visibility (legacy, `pymn_0001_001_view.jsp:383-389`):**
```jsp
<% if ("H".equals(prdtTypes)) { %>
    <a ... id="btnRefresh" data-jex-ml="pymn_0001_001_v024">Refresh</a>
<% } else { %>
    <div class="excel-down" id="btn_excel"></div>   <!-- Excel Upload -->
<% } %>
```
Internal Transfer (`pymn_0009`) has no Refresh branch — Excel Upload only, every product type.

---

## 2. Current refactor frontend flow

```
User clicks Refresh  (RefreshButton — rendered when isProductType(user,'H') && onRefresh set)
        │
        ├─ Confirmation popup?     → NO. runRefresh() fires immediately.                      ✓ match
        │
        ├─ Build period            → getPeriodDate() from the page window (periodToWindow →
        │                            {fromDate,toDate}); period_date = from===to ? from
        │                            : `${from}-${to}`.  paymentType = page literal.          ~ (see D3)
        │
        ├─ Loading indicator?      → refreshing=true → RefreshButton disabled + icon animate-spin.
        │                            INLINE (button-local), not a global overlay.             ~ (see D2)
        │
        ├─ Backend action          → api.post("/api/v1/payments/haengsung/refresh",
        │                            { payment_type, period_date })  (async, awaited).        ✓ match (REST equiv)
        │
        ├─ Success popup?          → YES. useDialog success: "Imported N batch(es) (M txns)."  ✗ DIFF (D1)
        │
        ├─ Failure popup?          → YES. useDialog error; code → localized copy
        │                            (WBE_HS_REFRESH_DISABLED / _NOT_HAENGSUNG / _NO_TAX_ID
        │                            / generic). 401 handled by axios interceptor.            ✓ match
        │
        ├─ Reload list?            → YES. onSuccess = refreshList() bumps refreshKey →
        │                            useApiData re-fetch with current filter/sort/page.        ✓ match
        │
        ├─ Clear selection?        → No explicit clear; list re-fetch re-renders rows.          ~ match
        │
        ├─ Focus?                  → NO focus handling.                                         ✓ match
        │
        └─ Other                   → Duplicate-click prevented by `refreshing` guard +
                                     disabled button. Button label = common.refresh.           ✓ match
```

Shared wiring: [`useHaengsungRefresh.ts`](../../../hooks/useHaengsungRefresh.ts) (one hook, all four modules) → [`haengsungPaymentRefresh()`](../../../lib/api/payment.ts) → backend; `refreshing` threaded through [`PaymentScheduledBatchListPage`](../../../components/payment/shared/PaymentScheduledBatchListPage.tsx) `RefreshButton`.

---

## 3. Difference analysis (comparison matrix)

Audited identically across **Vendor / Expense / Payroll / Overseas** (the four pages share `PaymentScheduledBatchListPage` + `useHaengsungRefresh`, so every row below holds for all four).

| Item | Legacy | Refactor | Match? |
|---|---|---|---|
| Refresh button visibility (`H` only) | `<% if ("H".equals(prdtTypes)) %>` → `#btnRefresh` | `isProductType(user,'H') && onRefresh` → `RefreshButton` | ✅ |
| Excel Upload visibility (non-`H`) | else → `#btn_excel` | else → `ExcelUploadButton` | ✅ |
| Internal Transfer unaffected | no Refresh branch | never passes `onRefresh` (Excel Upload only) | ✅ |
| Click handler | `#btnRefresh` → `fnManualRefresh` | `RefreshButton onClick` → `runRefresh` | ✅ |
| Confirmation popup before action | none | none | ✅ |
| API call | `pymn_000X_00Y_c002` (.jct) | `POST /api/v1/payments/haengsung/refresh` | ✅ (REST equivalent) |
| Request payload — payment type | `PAYMENT_TYPE` = VENDOR/EXPENSE/PAYROLL/OVERSEAS | `payment_type` = same 4 literals | ✅ |
| Request payload — period | `PERIOD_DATE` = `FROM-TO` (always range) | `period_date` = `from` if single day else `from-to` | ⚠️ D3 (equivalent) |
| Period source | page date filter window | page date filter window (`periodToWindow`) | ✅ |
| Loading indicator | global blocking progress bar | inline button spinner + disable | ⚠️ D2 |
| Disable while processing | implicit (sync + overlay) | explicit (`refreshing` guard + disabled button) | ✅ (equivalent) |
| Success message | **none** | **success dialog with counts** | ❌ D1 |
| Error message | `showMessage(JexError)` | error dialog, code-mapped + localized | ✅ |
| List reload on success | `fnLoadData` | `refreshList()` (refreshKey → re-fetch) | ✅ |
| Checkbox / selection state | implicit reset via tbody re-render | list re-fetch re-renders rows | ✅ (equivalent) |
| Search condition preservation | reload reuses current filter | re-fetch reuses current `search` state | ✅ |
| Pagination preservation | reload reuses current page | re-fetch reuses current `page`/`pageSize` | ✅ |
| Focus handling | none | none | ✅ |
| Localization (button) | ML `pymn_0001_001_v024` "Refresh" | `common.refresh` (EN/KO/VI) | ✅ |
| Localization (messages) | server JexError (4 langs) | success/error keys added EN/KO/VI | ✅ (superset) |
| Permission check | page menu access; Excel = perm "U"; Refresh ungated beyond `H` | endpoint `@menuAuthz.canAccessAny(4 scheduled slugs)` + JWT product-`H` guard | ✅ (equivalent) |

---

## 4. Missing / differing behaviors (classified)

### Critical
- **None.** Every functional behavior (which API, payload, reload, error surface, button gating, filter/page preservation, permissions) matches legacy.

### Medium
- **D1 — Success popup not present in legacy.** The refactor shows a `useDialog` **success** dialog ("Imported N batch(es) (M transaction(s)).") after a successful import; legacy shows **no** success popup — it silently reloads. This is the one true behavioral divergence. It is an intentional UX addition (added when the frontend was wired), not a bug, but it breaks strict legacy parity.
  - *Fix for strict parity:* drop the success dialog from `useHaengsungRefresh` — keep the silent `onSuccess()` reload only. (Optionally surface a non-blocking toast instead, if the PO wants feedback without a modal — but legacy has neither.)

### Cosmetic
- **D2 — Loading-indicator style.** Legacy shows a **global blocking progress overlay** (`tmsComm.createProgressBar`) for the duration of a synchronous call; the refactor shows an **inline button spinner + disabled button** during an async call. Both prevent a duplicate Refresh submission. The user-visible difference is that the refactor does not dim/block the whole page while importing. Functionally equivalent for the Refresh action; legacy's overlay is a global pattern the refactor does not replicate per-action.
  - *Optional fix:* if a global busy overlay is desired for parity, route through a shared busy-overlay primitive — but no such global overlay exists in `wecms-web` today, so this would be a new cross-cutting pattern, not a Refresh-local change. Recommend leaving as-is unless the PO wants the legacy overlay everywhere.
- **D3 — `period_date` single-day form.** Legacy `createDateRange` always emits `FROM-TO` (e.g. `20260628-20260628`); the refactor emits the bare `20260628` when from == to. The backend filter (`file_date BETWEEN from AND to`, with from == to ⇔ `file_date = X`) treats both identically, and the request DTO regex `\d{8}(-\d{8})?` accepts both. No observable difference.
  - *Optional fix:* always emit the range form (`${from}-${to}`) in `getPeriodDate()` to match the legacy wire byte-for-byte. Zero behavioral impact; do only if exact wire parity is required.

---

## 5. Screens / components involved

| Layer | Refactor file | Legacy counterpart |
|---|---|---|
| Vendor scheduled page | `components/payment/vendor-payment/ScheduledPaymentPage.tsx` | `pymn_0001_001` (view + js) |
| Expense scheduled page | `components/payment/expense-payment/ScheduledPaymentPage.tsx` | `pymn_0003_001` |
| Payroll scheduled page | `components/payment/payroll/ScheduledPaymentPage.tsx` | `pymn_0005_001` |
| Overseas scheduled page | `components/payment/overseas-payment/ScheduledPaymentPage.tsx` | `pymn_0007_001` |
| Shared list shell + Refresh/Excel toggle | `components/payment/shared/PaymentScheduledBatchListPage.tsx` (`RefreshButton`, `ScheduledTitleActionGroup`) | `pymn_000X_001_view.jsp` button block |
| Refresh handler hook | `hooks/useHaengsungRefresh.ts` | `pymn_000X_001.js` `fnManualRefresh` + `#btnRefresh` handler |
| API client | `lib/api/payment.ts` (`haengsungPaymentRefresh`) | `jexjs` ajax `pymn_000X_00Y_c002` |
| Locale | `locales/{en,ko,vi}.json` (`payment.haengsung.refresh.*`, `common.refresh`) | ML `pymn_000X_001_v024` + server JexError ML |
| **Internal Transfer (must stay Excel Upload)** | `components/payment/internal-transfer/ScheduledTransferPage.tsx` (no `onRefresh`) | `pymn_0009` (no Refresh branch) |

---

## 6. API integration flow

```
RefreshButton onClick
  → useHaengsungRefresh.runRefresh()
      guard: if (refreshing) return            // duplicate-click prevention
      setRefreshing(true)
      → haengsungPaymentRefresh({ payment_type, period_date })
          → POST /api/v1/payments/haengsung/refresh   (JWT bearer auto-attached)
          → ApiResponse<HaengsungRefreshResult>  unwrap() (status.error → ApiCallError)
      success → onSuccess()  (refreshList → refreshKey++ → useApiData re-fetch)
              → success dialog (D1 — not in legacy)
      error   → error dialog (code → localized message); 401 handled by axios interceptor
      finally → setRefreshing(false)
```
Backend contract (already implemented): `payment_type ∈ {VENDOR,EXPENSE,PAYROLL,OVERSEAS,ALL}`, `period_date = YYYYMMDD | YYYYMMDD-YYYYMMDD`; returns `{ masters_found, imported, skipped, failed, details_imported }`; product-`H` guard from the signed JWT; `WBE_HS_REFRESH_DISABLED` when the Oracle integration is off.

---

## 7. UI state transitions

| State | Trigger | UI |
|---|---|---|
| Idle (`H` tenant) | page load | Refresh button enabled; Excel Upload hidden |
| Idle (non-`H`) | page load | Excel Upload shown; Refresh hidden |
| Refreshing | click Refresh | button disabled + spinner (`refreshing=true`); legacy = global progress overlay |
| Success | API ok | list re-fetched; success dialog shown (D1 — legacy: none) → `refreshing=false` |
| Error | API/ network error | error dialog (localized); list unchanged → `refreshing=false` |
| Re-click during refresh | click while refreshing | ignored (`if (refreshing) return` + button disabled) |

---

## 8. Error handling

| Case | Legacy | Refactor |
|---|---|---|
| Oracle disabled | server `WbException` → `showMessage` | `WBE_HS_REFRESH_DISABLED` → `payment.haengsung.refresh.error_disabled` |
| Non-`H` tenant | not reachable (button hidden) | `WBE_HS_REFRESH_NOT_HAENGSUNG` → `error_not_haengsung` (defensive) |
| Missing tax id | server error → `showMessage` | `WBE_HS_REFRESH_NO_TAX_ID` → `error_no_tax_id` |
| Other server error | `showMessage(JexError)` | mapped/generic → `error_generic` + `errorCode` trailer |
| Network failure | ajax error | `ApiCallError("NETWORK")` → error dialog |
| Session expired (401) | framework redirect | axios interceptor → global session-expired flow |

Parity: ✅ — refactor surfaces an error dialog for every failure path, same as legacy's `showMessage`, with localized copy for the known business codes.

---

## 9. Loading behavior

- **Legacy:** `tmsComm.createProgressBar()` before the synchronous ajax; `tmsComm.destroyProgressBar()` in both success and error branches. A global, page-blocking overlay.
- **Refactor:** `refreshing` state → `RefreshButton` `disabled` + `RefreshCw` `animate-spin`; reset in `finally`. Inline, button-local, non-blocking.
- **Duplicate-click prevention:** legacy via `async:false` + overlay; refactor via `if (refreshing) return` + `disabled`. Both effective. (D2 — style differs, behavior equivalent.)

---

## 10. Final parity checklist

| # | Behavior | Parity |
|---|---|---|
| 1 | Refresh shown only for `PRDT_TYPE='H'` | ✅ |
| 2 | Excel Upload shown for non-`H` | ✅ |
| 3 | Internal Transfer keeps Excel Upload (no Refresh) | ✅ |
| 4 | No confirmation popup before refresh | ✅ |
| 5 | Correct API invoked (import action, not list-only) | ✅ |
| 6 | Payload `payment_type` literal per module | ✅ |
| 7 | Payload `period_date` from current filter window | ✅ (⚠️ D3 single-day form, equivalent) |
| 8 | Loading indicator shown during call | ✅ (⚠️ D2 inline vs global overlay) |
| 9 | Duplicate clicks prevented while processing | ✅ |
| 10 | Error popup on failure (localized) | ✅ |
| 11 | **No success popup (legacy shows none)** | ❌ **D1 — refactor adds a success dialog** |
| 12 | List reloads on success | ✅ |
| 13 | Filter / search preserved on reload | ✅ |
| 14 | Pagination preserved on reload | ✅ |
| 15 | Selection state behavior | ✅ (equivalent) |
| 16 | No focus change | ✅ |
| 17 | Button label localized (EN/KO/VI) | ✅ |
| 18 | Permission/product gating enforced | ✅ |

**Verdict:** **functional parity achieved.** The Refresh button now calls the real import API across all four HAENGSUNG payment modules and matches legacy on every load-bearing behavior. The only strict-parity gap is **D1 (extra success popup)** — Medium, a deliberate UX addition that the PO should explicitly keep or revert. **D2** (loading-overlay style) and **D3** (single-day period form) are cosmetic and behavior-equivalent.

### Required fixes (for strict legacy parity — pending PO decision, not yet implemented)

1. **D1 (Medium):** remove the success `useDialog` call from `useHaengsungRefresh` so a successful Refresh reloads silently like legacy. One-line removal; no backend/contract change. **Recommended only if the PO wants byte-for-byte legacy behavior** — otherwise the success dialog is an acceptable UX improvement.
2. **D2 (Cosmetic, optional):** replace the inline spinner with a global busy overlay only if a shared overlay primitive is introduced product-wide; not recommended as a Refresh-local change.
3. **D3 (Cosmetic, optional):** emit `${from}-${to}` even for a single day to match the legacy wire exactly; zero behavioral impact.

No Critical or Medium **functional** fix is required. D1 is the only item that changes observable behavior; the decision is the PO's.

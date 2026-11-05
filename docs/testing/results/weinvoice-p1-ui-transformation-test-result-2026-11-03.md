# WeInvoice P1 UI Transformation — Test Result

**Date:** 2026-11-03
**Type:** TEST RESULT
**Status:** PASS
**Repository:** we-scraping-web (wecms-web codebase)
**Related Record:** [weinvoice-p1-ui-transformation-2026-11-03.md](../../features/weinvoice/weinvoice-p1-ui-transformation-2026-11-03.md)

## Scope

The whole-app transformation from WeCMS screens to the WeInvoice P1 static UI (mock data): shared
primitives, shell, login, 25 routes, mock data layer, removal of WeCMS code.

## Environment

LOCAL only — `next dev` (Next.js 16.2.3, Turbopack) on `http://localhost:3000`, in-app browser.
SIT / UAT: NOT RUN (deployment is manual and has not happened).

## Code / Build Under Test

Branch: `main` (working tree) · Commit: NOT COMMITTED · API: none (mock data).

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx tsc --noEmit -p .` | PASS | 0 errors |
| `npx vitest run` | PASS | 3 files, 18 tests, 18 passed |
| `npm run build` | PASS | 30 static pages; all 25 WeInvoice routes + `/login` listed |
| `npx eslint app components lib hooks proxy.ts` | FAIL (pre-existing) | 5 errors + 1 warning, all in files this change did not edit — see Existing Failures |
| `node scripts/check-doc-links.mjs` | PASS | in-repo broken 0 after the WeCMS docs were deleted and `README.md` / `docs/` / `CLAUDE.md` rewritten (baseline at HEAD: 6); 2 out-of-repo workspace links pre-existing |

Test files: [lib/weinvoice/xml.test.ts](../../../lib/weinvoice/xml.test.ts) (6),
[lib/api/weinvoice/invoices.test.ts](../../../lib/api/weinvoice/invoices.test.ts) (9),
[components/shared/dialog/DialogProvider.test.tsx](../../../components/shared/dialog/DialogProvider.test.tsx) (3).

## Regression Tests

Not a bug fix — no original defect to reproduce. The tests pin the business rules the mock layer
must keep when the backend replaces it: §3.2 de-dup outcomes (duplicate / merged / new / foreign,
leading-zero key), §3.1 MST + direction scoping, §3.3 K / M detection, §3.5 protected files, XML
parse / round-trip, and the `useDialog` confirm / toast helpers. All previous suites were WeCMS
tests deleted together with the WeCMS code they covered.

## Test Scenarios

Executed in the browser against [test-scenarios.md](../../features/weinvoice/test-scenarios.md):

| # | Scenario | Actual | Result |
|---|---|---|---|
| 1 | Unauthenticated `/invoices/purchase` | Redirect to `/login?next=%2Finvoices%2Fpurchase`; back there after login | PASS |
| 2 | Wrong password | "Tên đăng nhập hoặc mật khẩu không đúng." inline | PASS |
| 3 | Logout | Back to `/login`; `wecms_token` cookie cleared; `wecms_locale` kept; `/dashboard` redirects | PASS |
| 4 | Language VI → EN | Labels + toasts in English; kept after reload | PASS |
| 5 | Switch working MST | List re-scoped (184 → 69 invoices), toast | PASS |
| 7 | Dashboard | KPIs + monthly chart for 2026 | PASS |
| 8 | Purchase list | KPIs, incomplete-period banner (10/2026), table, totals footer, pagination | PASS |
| 12 | Row → detail modal | Rendered invoice, provider, lookup code, file record tab | PASS |
| 15 | Excel with missing XML | "Còn hoá đơn thiếu XML" confirm first, then "not available in this build" toast | PASS |
| 22 | Supplier risk → check status | 8 partners checked, finding chips (warnings, name, address, high risk) | PASS |
| 29 | Roadmap page `/tax/vat-return` | Intro page + P4 badge | PASS |
| 30 | 375 px | No page-level horizontal scroll (scrollWidth 375), drawer sidebar | PASS |
| — | Every other route (sales, sources ×4, sync ×2, tax ×2, checks, tools ×3, settings ×3) | Renders with data, no console errors | PASS (render only) |

## Not Tested

- Scenarios 6, 9–11, 13–14, 16–21, 23–28 were not driven by hand in the browser. 18 / 24 (de-dup
  outcomes) and 13 are covered by unit tests at the data layer only.
- 768 / 1024 / 1440 breakpoints: only 375 and the pane's default width were checked.
- Visual comparison against the screenshots in `01_Dac_ta_UI.html`: NOT RUN.

## Existing Failures

ESLint `react-hooks/set-state-in-effect` in `components/shared/DateField.tsx`,
`InteractiveDateRangePicker.tsx` (×2), `SearchSelect.tsx`, `lib/i18n/LocaleProvider.tsx`, plus a
`no-img-element` warning in `components/shared/InfoIcon.tsx`. These files are unchanged by this work
(present at HEAD). Category B — not fixed here.

## New Failures

None. (The documentation-link failure found in the first run was resolved the same day by deleting the WeCMS docs and rewriting `README.md`, `docs/` indexes and `CLAUDE.md`.)

## Final Result

PASS — every executed check passed; manual scenarios listed under *Not Tested* were not run.

## Recommendation

READY FOR MANUAL COMMIT.

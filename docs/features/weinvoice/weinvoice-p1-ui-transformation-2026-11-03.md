# WeInvoice P1 — UI Transformation of we-scraping-web

**Date:** 2026-11-03
**Type:** FEATURE
**Status:** READY FOR MANUAL COMMIT
**Repository:** we-scraping-web (wecms-web codebase)
**Issue:** WeInvoice UI Spec v1.0 (PO WeCMS, 2026-10-30)

**Investigation Status:** COMPLETE
**Approval Status:** NOT REQUIRED (class C — implementation requested by the user, scope chosen in chat 2026-11-03)
**Implementation Status:** COMPLETE
**Test Status:** PASS for every executed check (tsc · vitest · build · doc links); some manual scenarios NOT RUN — see the test-result record

## Purpose

Turn this repository into the **WeInvoice** application described by the handover package
`/Users/quyenvu/Desktop/WeInvoice_UI_Spec_v1.0/` (outside this repo):

- `00_DOC_TRUOC.md` — handover rules (layout / labels / states / flows / messages are binding;
  architecture, DB, API, engines are the dev team's call).
- `01_Dac_ta_UI.html` — per-screen UI specification with screenshots.
- `02_Yeu_cau_nghiep_vu.md` — product, P1 scope, mandatory business rules.
- `weinvoice-web/` — UI source (Next.js 16 / React 19 / Tailwind 4) with simulation logic stubbed.

## Requirement (decisions taken with the user, 2026-11-03)

| Decision | Choice |
|---|---|
| Shape | **Become the WeInvoice app** — remove the WeCMS screens (Banking / Payment / Add-on / Settings modal) and rebuild every WeInvoice screen, written to this repo's CLAUDE.md conventions (shared components, `wb-*` tokens, `locales/*.json`, `useDialog()`). |
| Data | **Static UI + per-screen `mockData.ts`** — no API calls this round. Backend is decided later. |
| Size | **All P1 screens** of the prototype in this pass. |

## Current System Behavior

The repo is a full WeCMS frontend clone: 42 dashboard routes under `app/(dashboard)/`
(banking, payment, addon), the Settings modal, server-side auth gate in `proxy.ts`, live calls to
`wecms-api` through `lib/axios.ts`, in-house i18n EN/KO/VI.

## Target Behavior

The WeInvoice navigation (`weinvoice-web/lib/nav.ts`): top-nav modules → left-sidebar groups, a
header MST (working tax code) selector, and every P1 screen rendering with mock data, with labels
VI / EN / KO.

## Scope

### Screen inventory (from `weinvoice-web/lib/nav.ts` + `app/(app)/**/page.tsx`)

| Module | Route | Spec component | Phase |
|---|---|---|---|
| Invoices | `/dashboard` | `dashboard/Dashboard` | MVP |
| Invoices | `/invoices/purchase`, `/invoices/sales` | `invoices/InvoiceListPage` (+ `InvoiceDetailModal`, `DownloadDialog`, `InvoiceSheet`, `TagMenu`) | MVP |
| Invoices › Sources | `/sources/gdt` | `connections/ConnectionsPage` | MVP |
| Invoices › Sources | `/sources/email` | `upload/EmailPage` | MVP |
| Invoices › Sources | `/sources/mailbox` | `upload/MailboxPage` (+ `MailboxConnect`, `MailboxSummary`) | MVP |
| Invoices › Sources | `/sources/upload` | `upload/UploadPage` (+ `shared/TestDataPanel`) | MVP |
| Invoices › Sync | `/sync/history`, `/sync/bulk` | `sync/SyncPages` (+ `SyncDialog`) | MVP |
| Tax | `/tax/filed` | `tax/FiledPage` | MVP |
| Tax | `/tax/journal` | `tax/JournalPage` | MVP |
| Tax | `/tax/vat-return`, `/tax/reduction` | `soon/ComingSoon` | roadmap |
| Reports | `/reports/listing`, `/reports/accounting-export` | `soon/ComingSoon` | roadmap |
| Checks | `/checks/invoices` | `checks/InvoiceCheckPage` | MVP |
| Checks | `/checks/supplier-risk` | `checks/SupplierRiskPage` | MVP |
| Tools | `/tools/xml-viewer` | `tools/XmlViewerPage` | MVP |
| Tools | `/tools/providers` | `tools/ProvidersPage` | MVP |
| Tools | `/tools/taxpayer-lookup` | `tools/TaxpayerLookupPage` | MVP |
| Tools | `/tools/pdf-merge` | `soon/ComingSoon` | roadmap |
| Settings | `/settings/general` | `settings/SettingsPage` | MVP |
| Settings | `/settings/tags` | `settings/TagsPage` | MVP |
| Settings | `/settings/users` | `settings/SubAccountsPage` | MVP |
| Settings | `/settings/plan` | `soon/ComingSoon` | roadmap |
| Auth | `/login` | `app/login/page` | MVP |
| Shell | — | `layout/{AppShell,Header,Sidebar,CommandPalette}` | MVP |

Total: 25 routes + login. i18n: 1005 keys × VI/EN/KO.

### Findings — spec ↔ repo

- The spec was authored "in WeCMS tone": `app/globals.css` token names (`bg-brand`, `text-wb-13`,
  `shadow-wb-btn`, …) are copied 1:1 from this repo, and its i18n provider has the same
  `t(key, vars)` shape. Porting is mostly structural, not visual.
- i18n: spec keys collide with repo `locales/*.json` on **7 keys, all with identical values** → safe
  to merge. Spec default locale is **VI**; repo default is EN, and repo `Locale` is upper-case
  (`"VI"`) while spec formatters compare lower-case (`locale === "vi"`).
- Primitives whose **API differs** from the repo's shared component:
  - Dialog — spec `useDialog()` = `{ alert, confirm, toast }` (Promise-based); repo = `{ open, close }`.
  - Button — spec variants `primary/secondary/neutral/danger/ghost` + `icon`; repo shadcn `default/outline/…`.
  - Modal — spec custom portal modal; repo shadcn `<Dialog>` with `stackLevel`.
  - Pagination — spec `{page,pageSize,total,onPage,onPageSize}`, sizes 15/20/50/100; repo
    `{page,pageCount,pageSize,totalLabel,…}`, sizes fixed `PAGE_SIZE_OPTIONS = [10,20,50,100]`.
- Spec data layer (`lib/api/*`, `lib/mock/*`, `lib/xml.ts`, `lib/exporter.ts`, …) is **stubbed
  empty** on purpose (91 exported functions). The decision "UI tĩnh + mockData" therefore means
  writing mock implementations behind those signatures — the spec gives no data.
- `lib/exporter.ts` (Excel / ZIP) is a client-side workbook writer in the prototype. Repo §13b
  forbids frontend workbook generation → stays a stub that tells the user the export is not
  available yet (backend will own it).
- Repo layout/shell is WeCMS-specific (backend-driven navigation via `/api/v1/navigation`) and
  cannot render WeInvoice's module/sidebar map without the backend.

## Out of Scope

- Backend / API / DB / GDT sync engine / NCC PDF retrieval / captcha handling (spec: dev decides; not this round).
- "Roadmap" screens beyond intro pages (spec §2: VAT return, listing, template export, tax-reduction annex, PDF merge, plan → intro page only).
- Commit / push / deploy (§15).

## Initial Evidence

- Spec source: 104 files under `weinvoice-web/{app,components,lib}`, ~10k lines in components + i18n.
- Spec i18n lives in `lib/i18n/{vi,en,ko}.ts`; repo i18n lives in `locales/{en,ko,vi}.json`.

## Investigation Plan

1. Inventory spec screens / routes / shared UI primitives.
2. Map each spec primitive to the repo's shared component (reuse-before-create).
3. Decide what WeCMS code is removed vs. kept (auth gate, i18n provider, dialog, shell).
4. Plan the port order: foundations (i18n, shell, nav, mock store) → screen modules.

## Root Cause

Not applicable (feature).

## Proposed Implementation

Rule of thumb: **the spec decides what the screen looks like; CLAUDE.md decides how the code is
organised.** Where the two conflict on a shared mechanism, the repo's shared component wins and the
deviation is recorded under Known Limitations.

1. **i18n** — merge the 1005 spec keys into `locales/{vi,en,ko}.json`; keep the repo
   `LocaleProvider`; default locale → `VI` (spec). Formatters compare locale case-insensitively.
2. **Dialogs** — extend the repo `useDialog()` with `alert` / `confirm` / `toast` helpers built on
   `open()` + a toast stack inside the same provider (extend-the-shared-component, §"Shared / Common").
3. **Buttons / Modal / Pagination / PageLayout / PageHeader / SearchInput** — reuse the repo shared
   components; extend them (Button variants + `icon`, PageHeader `subtitle`) instead of forking.
   Spec-only primitives with no repo equivalent (`Select`, `Popover`, `Card`, `EmptyState`,
   `FileBadge`) are added once to `components/shared/`.
4. **Domain lib** — `lib/weinvoice/` (types, nav map, formatters, provider catalogue, XML parser) and
   `lib/api/weinvoice/` (data-access functions with the spec's signatures, backed by an in-memory
   store seeded from `lib/api/weinvoice/mockData.ts`). Swapping to the real backend later touches
   only `lib/api/weinvoice/`.
5. **Shell** — `components/layout/{AppShell,Header,Sidebar}` rewritten to the spec shell (top-nav
   modules from `lib/weinvoice/nav.ts`, sidebar groups, working-MST selector, language menu).
6. **Auth** — keep `proxy.ts` (cookie gate). Login screen = spec UI; credentials checked against a
   mock (`demo` / `demo1234`) that sets the existing `wecms_token` cookie + storage. Real auth later.
7. **Screens** — port each spec screen into `app/(dashboard)/<module>/<screen>/page.tsx` +
   `components/<module>/…`.
8. **Remove WeCMS** — delete the Banking / Payment / Add-on routes and their feature components,
   the WeCMS Settings modal, and code left without a consumer.

## API Impact

Planned: NONE this round (mock data only). Existing `wecms-api` clients become unused.

## UI Impact

Planned: whole application UI replaced.

## Database Impact

NONE (frontend).

## Integration Impact

Planned: NONE this round.

## Testing Plan

Typecheck, Vitest unit tests for the mock data rules, production build, ESLint, doc-link check,
and a browser pass over every route using [test-scenarios.md](test-scenarios.md).

## Implementation

Actual implementation followed the proposal. Points where it diverged or was decided during the work:

- **Codemod port.** Spec components were copied with an import-rewriting codemod (spec primitive →
  repo shared component, Button variant names, Pagination props), then fixed by hand. Four
  subagents each owned one screen group and its mock module; the lead owned the shared layer.
- **Shared components extended, not forked:** `useDialog` (+ `alert` / `confirm` / `toast`,
  [Toaster](../../../components/shared/dialog/Toaster.tsx)), `components/ui/button` (variants
  `primary | brand | neutral | danger | subtle`, sizes `wb-sm | md`, `icon`, default `type="button"`),
  `StatusPill` (`warning`, `size`), `PageHeader` (`subtitle`, ReactNode title). Added once:
  `Modal` (on shadcn Dialog), `Popover`, `Select`, `LabeledCheckbox`, `FileBadge`, `IconButton`,
  `Card`, `EmptyState`.
- **Mock data layer** `lib/api/weinvoice/*` over an in-memory store seeded deterministically
  (3 fictional MSTs, ~400 invoices 01–10/2026 with no-code, cash-register, replaced / adjusted /
  cancelled, missing XML / PDF, an incomplete period, an expired connection).
- **Spec behaviour deliberately not reproduced** (repo rules / business rules win):
  - Excel export (invoice list, invoice check, taxpayer lookup, journal) generates nothing in the
    browser and says so — CLAUDE.md §13b.
  - The ZIP listing is HTML, not XLSX, for the same reason.
  - The "auto-solve captcha" step in the original-PDF fetch was removed — §3.4.
  - Invoice print opens a popup with the rendered invoice instead of `window.print()` on the page — CLAUDE.md §6d.
  - Browser persistence / backup-restore of the demo DB, the "load sample XML" demo button and the
    TestData folder loader (it needs the prototype's local server) were dropped.
  - Login no longer pre-fills or accepts any credentials: only `demo` / `demo1234`.
- **WeCMS removed:** 539 files deleted — all `app/(dashboard)` WeCMS routes, `app/api`,
  `app/memo-preview`, feature components, WeCMS-domain shared components, `lib/api` clients,
  `lib/axios`, `lib/nxisas`, `lib/payment`, `lib/vat`, View Setting (backend-driven), WeCMS
  hooks and their tests. Generic shared UI (date pickers, `DataTableShell`, `ReportLayout`,
  `lib/print`, …) was kept for future screens even though nothing imports it yet.
- **Dependency:** `jszip@3.10.1` added (spec package; upload of ZIP files + ZIP download).

## Files Changed

539 deleted · 24 modified · 27 added (excluding this record's docs). Main areas:
`app/(auth)`, `app/(dashboard)/**` (25 routes), `components/{invoices,dashboard,connections,upload,sync,settings,checks,tools,tax,soon,layout}`,
`components/shared/*` (new primitives + dialog extension), `components/ui/button.tsx`,
`lib/weinvoice/*`, `lib/api/weinvoice/*`, `lib/i18n/{LocaleProvider,localeLabels,index}`,
`lib/utils.ts`, `locales/{vi,en,ko}.json`, `app/{layout,page,globals.css}`, `proxy.ts`,
`package.json` / `package-lock.json`, `.claude/launch.json`.

## Verification

### Automated Tests

- Test: `npx tsc --noEmit` · `npx vitest run` (18 tests) · `npm run build`
- Result: PASS
- Test: `npx eslint` — FAIL, pre-existing only (5 errors / 1 warning in files not edited here)
- Test: `node scripts/check-doc-links.mjs` — PASS (0 in-repo broken; 6 at HEAD; 2 out-of-repo workspace links pre-existing)

### Test Scenarios

- Scenario: 12 of 30 scenarios driven in the browser + render check of every route
- Result: PASS for all executed; the rest NOT RUN (listed in the test-result record)

### Regression Review

- Areas checked: auth gate (`proxy.ts` unchanged except the deleted `/memo-preview` entry), shared
  dialog API (old `open` / `close` callers unchanged — none remain outside this change),
  `Button` default `type="button"` (the only submit button, login, sets `type="submit"`).
- Result: no regression found in retained code.

### Manual Verification

- Environment: LOCAL (`next dev`, in-app browser)
- Steps: see the test-result record
- Result: PASS for executed scenarios

## Test Evidence

Test result:
[WeInvoice P1 UI Transformation — Test Result](../../testing/results/weinvoice-p1-ui-transformation-test-result-2026-11-03.md)

Final test result:    PASS (executed checks)
Regression coverage:  NOT APPLICABLE (feature; rule tests added)

## Result

The repository now builds and runs as the WeInvoice P1 static UI: every P1 screen of the spec is
reachable, renders mock data, and follows the spec layout, labels (VI / EN / KO) and the business
rules listed in [README.md](README.md). Not committed.

## Known Limitations / Follow-up

1. **Documentation gate — partly resolved 2026-11-03 (user decision: delete the WeCMS docs).**
   Deleted: `docs/features/{banking,payment,addon-service,settings,auth,common}`,
   `docs/features/transaction-history-memo.md`, `docs/architecture/`, `docs/references/`,
   `docs/e-sign/`, the 9 WeCMS audits, and the workspace-pointer pages (`prd`, `permissions`,
   `workflow`, `bug-reports/`, `change-log/`, `tech-stack`, `ui-component-guide`). Rewritten for
   WeInvoice: `README.md`, `docs/README.md`, `docs/features/README.md`; stale counts / links fixed in
   `docs/testing/*`, `docs/{bugs,issues,audits}/README.md`, `docs/frontend-project-rules.md`,
   `docs/tech-debt.md` (TD-2 / TD-3 closed). Note: deleting audit records goes against the
   "audits are never deleted" rule (§16g, `docs/audits/README.md`); done on the user's explicit
   instruction — the records remain in git history.
   **`CLAUDE.md` rewritten 2026-11-03 (user decision):** the team workflow §1–§17 kept (WeCMS-only
   links / examples corrected); the WeCMS UI / API sections replaced by "WeInvoice Project Rules"
   (5034 → 2557 lines). The harness skill trees (`.claude/` + `.agents/skills/wecms-web-docs`) were
   updated to the new doc structure. Link check: **0** in-repo broken.
2. **No backend.** Every `lib/api/weinvoice/*` module is a mock; login is a mock *(login since wired
   to the real backend — [weinvoice-api-integration-2026-11-03.md](weinvoice-api-integration-2026-11-03.md))*. Do not deploy
   to SIT / UAT as a product build (pushing `sit` / `uat` deploys).
3. **Not checked against the spec screenshots** pixel-by-pixel; 768 / 1024 / 1440 not checked.
4. Spec-inherited gaps left as found: the sidebar company block prints "MST" untranslated; a few
   inline hex colours (SettingsPage, SupplierRiskPage chips, tag swatches); the supplier drawer is
   a custom portal at `z-[70]`; the copy button title is a hard-coded "Copy"; the "Fetch PDF from
   provider" button on providers without a direct link still adds a placeholder PDF record.
5. Invoice list column toggles stay local (spec `ColumnSetting`); server-backed View Setting
   (CLAUDE.md §13) returns with the backend.
6. Pre-existing ESLint errors in untouched shared files (category B).

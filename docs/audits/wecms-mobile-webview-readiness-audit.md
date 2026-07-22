# WeCMS Mobile WebView Readiness Audit

> **Audit only.** No source code, routes, components, APIs, configuration, or dependencies were changed. This document is a repository-evidence-based readiness assessment for moving the native mobile business screens to a WebView-based architecture:
>
> `Android/iOS native app → WebView → dedicated Next.js mobile UI → Spring Boot APIs`
>
> **Scope of code inspected:** `wecms-web/` (Next.js 16 frontend) + `wecms-api/` (Spring Boot 3.5.13 backend). The native Android/iOS apps and their existing mobile UI are **not** in this repository and were assessed only from the task brief.
>
> **Placement note:** filed under `wecms-web/docs/audits/` because the headline decision (mobile routes vs. a separate mobile app) is a Next.js frontend-architecture decision, per the workspace doc-structure rules. It nonetheless covers backend API readiness in depth.
>
> **Author:** Claude Code (AI) · **Date:** 2026-07-22 · **Status legend per finding:** Confirmed / Likely / Not Confirmed / Requires Validation.

---

## 1. Executive Summary

**Can the current Next.js project support dedicated mobile routes? — Yes, with contained, well-understood changes.** The app is a Next.js 16 App Router SPA with a clean shared-code culture (one Axios client, one auth pipeline, one i18n provider, one dialog system, per-domain API wrappers). Adding a `/mobile` route namespace with its own layout is architecturally straightforward and low-risk to the desktop app, provided the edge auth gate (`proxy.ts`) and login flow are made mobile-aware first.

**The mobile UI must be built new, not reused.** The web app is **desktop-first by design** — fixed-pixel wide tables (1058–1834 px), a 1300×760 Settings modal, hover-reliant menus, dialog-based selectors, and a single responsive drawer shell. None of the native app's mobile-specific screens (bottom navigation, mobile cards, full-screen selectors, receipt-creation wizard) exist in the web. What *is* highly reusable is the **non-visual layer**: API clients, currency/date formatters, validation schemas, the 401 re-auth bus, and status badges.

**The single biggest gap is the receipt module.** The native app's receipt flow (list → create → purpose → payment-method → recipient → detail) has **no matching backend API**. The only receipt capability that exists is *corporate-card-linked* receipts under Card Transactions (`BUSA_DOC_MSTR`, `DOC_TYPE='E'`) — it supports purpose selection but has **no recipient wiring and no payment-method concept**. A standalone mobile receipt feature would require new endpoints and a fresh product decision.

**The highest-severity technical risks for a WebView deployment are:**
1. **JWT stored in `localStorage` *and* a non-HttpOnly cookie** — XSS/bridge-exfiltratable (Critical).
2. **The Next.js frontend ships zero security headers / no CSP** — no defense-in-depth on the pages a WebView renders (High).
3. **No refresh token; a hard 1-hour token expiry** — forces re-login every hour, a poor mobile UX and a session-management design gap (High).
4. **In-memory, per-instance token revocation** — logout/lock is not honored across instances or restarts (High in a multi-instance deploy).
5. **No idempotency + non-atomic duplicate-submit guards** on payment dispatch — dangerous on flaky mobile networks with retry (High).

**Recommended path:** keep desktop and mobile in **one Next.js project** using a real `/mobile` URL segment (Option A). Do **not** spin up a separate `wecms-mobile-web` app (Option C) — the maintenance/duplication cost is not justified for a 2-developer team, and the shared layer is exactly what makes reuse cheap. Adopt **native-login → short-lived one-time code → mobile auth route → web session** (Auth Option B) as the safest authentication model, and define a **versioned native↔web bridge contract** before implementation.

---

## 2. Current Architecture

### 2.1 Frontend (`wecms-web`)

| Aspect | Finding | Evidence |
|---|---|---|
| Framework | **Next.js 16.2.3, App Router** (no Pages Router) | `wecms-web/package.json`; `app/` tree |
| Runtime | React 19.2.4, Node 22 | `package.json:engines` |
| Routing | Route groups `(auth)` + `(dashboard)` (invisible in URL); **43+ dashboard routes** under `banking/`, `payment/`, `addon/`. **No `/mobile` routes exist.** Settings is a **modal**, not routes. | `app/(auth)/`, `app/(dashboard)/` |
| Layout | Root `app/layout.tsx` → `<LocaleProvider><DialogProvider>`; `(dashboard)/layout.tsx` = client auth-rehydrate guard + `<AppShell>` (Header + Sidebar) | `app/layout.tsx`; `app/(dashboard)/layout.tsx` |
| Edge auth gate | `proxy.ts` (Next 16 renamed `middleware`) redirects any non-public route to `/login` when the `wecms_token` cookie is absent; public prefixes `= ["/login", "/memo-preview"]` | `wecms-web/proxy.ts:28-53` |
| HTTP client | Single Axios instance, `baseURL = NEXT_PUBLIC_API_BASE_URL ?? http://localhost:8080`; Bearer interceptor reads token from `localStorage` | `lib/axios.ts:5-24` |
| State management | **None** (no Redux/Zustand/react-query/SWR). Server state via `useApiData` `useEffect` hook; local state via `useState` | `lib/api/useApiData.ts:25-68` |
| i18n | In-house `LocaleProvider`, flat dotted keys, **EN/KO/VI only (no Khmer `km.json`)**; persisted to `localStorage[wecms_locale]` | `lib/i18n/LocaleProvider.tsx:35-102`; `locales/{en,ko,vi}.json` |
| Styling | Tailwind CSS 4, tokens in `app/globals.css @theme inline`; shadcn/ui primitives | `app/globals.css` |
| BFF routes | One Next.js API route exists (`POST /api/v1/payment/overseas-payment/excel-preview`) that parses XLSX server-side — contradicts the CLAUDE.md "no API routes" claim | `app/api/v1/payment/overseas-payment/excel-preview/route.ts` |

### 2.2 Backend (`wecms-api`)

| Aspect | Finding | Evidence |
|---|---|---|
| Framework | Spring Boot 3.5.13, **packaged as WAR** to external Tomcat | `build.gradle:3-4` |
| Controllers | **48 `*Controller.java`**, all under literal `/api/v1/...`, **no `server.servlet.context-path`** | inventory §4 below; `application.yml` |
| Auth | Stateless JWT (HS512), `expires_in = 3600` (1 h), **no refresh token**, in-memory per-instance revocation blocklist | `JwtTokenProvider.java:78-120`; `application.yml:59`; `TokenRevocationService.java:42-48` |
| Session policy | `STATELESS`; CSRF disabled; 401 (not 403) on missing/expired token | `SecurityConfig.java:49,73,85` |
| Envelope | `ApiResponse` = `{status:{error,code,message}, data, timestamp, path, trace_id}`; **business errors return HTTP 200** with `status.error=true` | `common/response/ApiResponse.java:33`; `GlobalExceptionHandler.java:55-66` |
| CORS | Enabled, env-driven exact-origin allow-list (`WECMS_CORS_ALLOWED_ORIGINS`), `allowCredentials=true`, mapped to `/api/**` | `CorsConfig.java:16-26` |
| DB | PostgreSQL, `ddl-auto=validate`, Flyway disabled (schema external) | `application*.yml` |

### 2.3 Deployment topology

- **Build/deploy:** external-Tomcat `ROOT.war` (backend); standard `next build` (frontend). **No Dockerfile / docker-compose / nginx config in-repo.**
- **CI:** thin GitLab trigger pipelines in both trees that delegate to a downstream project (`.gitlab-ci.yml` in both). Build logic lives elsewhere.
- **Environments:** DEV/SIT/UAT/PROD exist; **no environment URL is hardcoded** — all endpoints are env-var injected (`NEXT_PUBLIC_API_BASE_URL`, `WECMS_DB_URL`, `WECMS_CORS_ALLOWED_ORIGINS`, …). SIT loads backend config from `bin/setenv.sh` OS env vars and bundles config inside `ROOT.war`.

---

## 3. Frontend Findings

### [High] The web UI is desktop-first with fixed-pixel wide tables that cannot reflow to a phone

Area: Responsive / UX
Status: Confirmed
Current behavior: List/table screens declare hard min-width tokens and horizontally scroll below them rather than reflowing. Examples: `--w-wb-table-min: 1058px`, `--w-wb-ap-table-min: 1834px`, `--w-wb-st-table-min: 1793px` (payment batch tables), plus per-column matrices for Card Transactions and Exchange Rate. The Settings modal is a fixed `1300×760` card. CLAUDE.md states "Desktop-first authoring."
Evidence: `app/globals.css:258,274,296,413-414`; `components/shared/DataTableShell.tsx` (scroll chain); CLAUDE.md §7a/§7d
Mobile WebView impact: These screens are unusable as-is in a 375–430 px WebView — they force two-axis panning inside a card. Reusing them directly is not viable.
Recommendation: Build mobile-dedicated screens (cards / stacked rows / bottom sheets) rather than embedding desktop tables. Reuse only the data layer and formatters.
Implementation required: Yes · Priority: High

### [Medium] One responsive drawer shell exists, but there is no mobile-dedicated UI

Area: Frontend architecture
Status: Confirmed
Current behavior: The only responsive adaptation is the shared shell: `AppShell` locks body scroll for a `< lg` (1024 px) drawer; `Sidebar` becomes a `fixed`/`translate-x` drawer with backdrop; `Header` shows a hamburger and collapses top-nav. No `useMediaQuery`/`matchMedia`; responsiveness is pure Tailwind `lg` breakpoints. No `/mobile` routes, no bottom navigation, no full-screen selectors, no mobile cards.
Evidence: `components/layout/AppShell.tsx:9-42`; `components/layout/Sidebar.tsx:150-176`; `components/layout/Header.tsx:47-55`; no `mobile` routes in `app/`
Mobile WebView impact: The drawer shell is desktop-navigation shrunk, not a mobile IA. The native app's bottom-nav + mobile-card patterns must be designed and built.
Recommendation: New mobile shell (`app/mobile/layout.tsx`) with bottom navigation; do not reuse `AppShell`/`Sidebar`/`Header`.
Implementation required: Yes · Priority: Medium

### [High] JWT is stored in `localStorage` and mirrored into a non-HttpOnly cookie

Area: Auth / Security (also §13)
Status: Confirmed
Current behavior: On login the token is written to `localStorage["wecms_token"]` and to a `wecms_token` cookie set via `document.cookie` (therefore **cannot** be HttpOnly). Cookie is `SameSite=Lax`, `Secure` only when the page is HTTPS, session-scoped (no Max-Age). The cookie exists solely so `proxy.ts` can gate routes at the edge; the Authorization header still comes from `localStorage`.
Evidence: `lib/auth/storage.ts:98-129`; `proxy.ts:13-18`; `lib/axios.ts:15-24`
Mobile WebView impact: In a WebView, any injected script or a compromised JS bridge can read the token from both stores. This is the top client-side risk for a WebView.
Recommendation: Prefer the native-token-handoff auth model (§8 Option B) and keep the web session token out of long-lived JS-readable storage where possible; at minimum ensure HTTPS-only so `Secure` applies.
Implementation required: Yes · Priority: High

### [Medium] Session-expiration handling is a mature in-page re-auth bus (reusable)

Area: Session
Status: Confirmed
Current behavior: `lib/auth/sessionExpired.ts` implements a promise-based re-auth event bus. The Axios response interceptor catches in-page 401s (excluding `/auth/login|logout|me`), opens a non-dismissible `SessionExpiredDialog` (password re-entry, `stackLevel=5`), and replays the original request once on success. A `/me` 401 on page load instead redirects to `/login` via the layout catch handler.
Evidence: `lib/auth/sessionExpired.ts:31-68`; `lib/axios.ts:52-89`; `components/auth/SessionExpiredDialog.tsx:96-190`; `app/(dashboard)/layout.tsx`
Mobile WebView impact: The in-page password re-entry popup is desktop UX; on mobile, expiry should signal native (bridge) to trigger biometric/OTP re-auth or return to a native login. The bus itself is reusable; the dialog is not.
Recommendation: Keep the 401→bus mechanism; replace the popup UI with a bridge call `REPORT_SESSION_EXPIRED` on mobile.
Implementation required: Yes · Priority: Medium

### [Medium] Menu is server-driven; action-level (R/D/T) permission is a static client stub

Area: Role / permission
Status: Confirmed
Current behavior: Sidebar/top-nav come from `GET /api/v1/navigation` (backend returns the resolved visible tree by JWT `prdt_type`). `lib/menuAuth.ts` does client route/section gating (presentation only). Action-level R/D/T gating is hardcoded `{R:true,D:true,T:true}` pending the `USER_MENU_ACTION_AUTH_INFM`-equivalent backend contract; real enforcement is server-side `@PreAuthorize`.
Evidence: `lib/api/navigation.ts:97-112`; `lib/menuAuth.ts:26-192`; `components/payment/internal-transfer/ScheduledTransferPage.tsx:75-77`
Mobile WebView impact: Mobile can reuse `/navigation` and `/me` (`all_menus`, `allowed_menu_cds`) to build its menu. The R/D/T stub is a pre-existing gap that must be closed before any deploy (mobile or desktop), not a WebView-specific issue.
Recommendation: Reuse `/navigation` + `/me` for the mobile menu; track the R/D/T backend contract as a shared pre-UAT blocker.
Implementation required: No (reuse) · Priority: Medium

### Other confirmed frontend facts
- **No state library**; server state via `useApiData`. Reusable. (`lib/api/useApiData.ts:25-68`)
- **PDF generation** is client-side via `jspdf` + `html2canvas-pro` (`lib/pdf.ts`), used by e-invoice detail export. `html2canvas` raster capture is memory-heavy and inconsistent in WebViews — flag. (`lib/pdf.ts:1-104`; `ViewEInvoiceDetailsModal.tsx:332`)
- **No camera / `getUserMedia`** anywhere; uploads are `<input type=file>` only. (Confirmed absent.)
- **Selectors are dialogs, not full-screen routes** (`SelectBankDialog`, `SelectBankAccountsDialog`, `AddApproverPopover`). The native "full-screen selection page" pattern does not exist.

---

## 4. Backend and API Findings

### 4.1 Controller inventory (48 controllers, grouped)

| Domain | Controllers (base path) |
|---|---|
| **Auth / User** | `AuthController` `/api/v1/auth`; `UserController` `/api/v1/users` (directory + avatar) |
| **Navigation / Common** | `NavigationController` `/api/v1/navigation`; `ScreenOptionController` `/api/v1/screen-options`; `CountryController` `/api/v1/common/countries` |
| **Banking (13)** | `AccountController` `/api/v1/banking`; `ExchangeRateController`; `TransferController` `/transfers`; `ReportController` `/reports`; `CashFlowReportController`; `DailyCashReportController`; `OwnAccountTransferController` `/own-account-transfer`; `SmartOrganizerController` + `OrganizerRuleController`; `SyncHistoryController` `/sync-history`; `TransferHistoryController` `/internal-transfer/transfer-history`; `BankScrapingController` `/scraping`; `BankCredentialController` `/credentials` |
| **Payment (14)** | `VendorPaymentController`, `ExpensePaymentController`, `PayrollPaymentController`, `OverseasPaymentController`, `InternalTransferController` (+`TransferResultController`, `CutoffConfigController`); `ApprovalBoxController` `/approval-box`; `CardTransactionsController` `/card-transactions` (+ **receipts**); `BlockedCharsRuleController`; `HaengsungPaymentRefreshController`; `NotificationController` `/api/v1/notifications`; two dispatch-callback controllers (permitAll + IP allow-list) |
| **Add-on** | `EInvoiceController` `/api/v1/addon`; `OperationStatusController` `/api/v1/addon` |
| **Settings (13)** | users, approval-line, contacts, chart-of-accounts, purpose-settings, firm-banking-settings, firm-banking-history, environment-settings, bank-account, preferences, vas-account, erp-transaction-history; `LoginCredentialsController` `/api/v1/login-credentials` (not under `/settings`) |

### [Critical] No standalone receipt / expense-claim API exists

Area: Backend API — receipts
Status: Confirmed
Current behavior: The native app's receipt flow has no matching module. The only receipt capability is *card-linked*: under Card Transactions — `POST /card-transactions/receipts` (create, ports legacy `prch_0011_001`, writes `BUSA_DOC_MSTR DOC_TYPE='E'`), `GET /receipts/{doc_id}`, `GET/POST/DELETE /receipts/{doc_id}/files` (attachments, 10 MB), `GET /links/receipts`, `GET /purpose-options`. It supports **purpose** selection but has **no recipient wiring** and **no payment-method concept** (card is implicit).
Evidence: `CardTransactionsController.java:661-813`; `messages.properties:464-478`
Mobile WebView impact: The mobile receipt screens (list / create / purpose / payment-method / recipient / detail) cannot be served by existing APIs. Purpose ≈ `PurposeSettingsController`; recipient ≈ `ContactsController`; but neither is wired into a create-receipt payload, and no payment-method API exists.
Recommendation: Treat mobile receipts as a **net-new feature** requiring new backend endpoints + a PO product decision. Do not assume the card-receipt endpoints cover it. Mark all receipt screens "new mobile design + missing API" in the inventory (§7).
Implementation required: Yes (new APIs) · Priority: Critical (blocks the receipt phase)

### [High] No refresh token; hard 1-hour JWT expiry

Area: Auth / session
Status: Confirmed
Current behavior: JWT `expires_in = 3600`; no refresh mechanism anywhere (the only `refresh_token` string is a log-redaction keyword). A client must fully re-login every hour.
Evidence: `application.yml:59`; `JwtTokenProvider.java:78-120`; `RequestResponseLoggingFilter.java:47`
Mobile WebView impact: Mobile users are logged out hourly with no silent refresh — hostile UX and a design gap. Backgrounded apps will routinely resume to an expired session.
Recommendation: Decide a mobile session strategy in Phase 0: either a refresh-token grant, a native-held long-lived credential that re-mints web tokens via a one-time-code exchange (§8 Option B), or biometric-gated silent re-auth. Requires backend work + PO sign-off.
Implementation required: Yes · Priority: High

### [High] Token revocation is in-memory and per-instance

Area: Auth
Status: Confirmed
Current behavior: `TokenRevocationService` keeps a `jti` denylist + per-user not-before cutoff in memory; documented to be lost on restart and not shared across instances (deliberately not DB-backed to avoid a refactor-only table).
Evidence: `TokenRevocationService.java:26-48`
Mobile WebView impact: In a multi-instance / load-balanced deploy, a mobile logout or forced lock is not honored on other instances or after restart. Combined with the 1-hour expiry, a stolen token remains valid up to an hour regardless of logout.
Recommendation: Revisit for any non-local deploy — either sticky sessions (weak) or a shared revocation store. Cross-team (backend) decision.
Implementation required: Yes · Priority: High

### [High] No idempotency; duplicate-submit guards are non-atomic

Area: Payment reliability
Status: Confirmed
Current behavior: The idempotency-key mechanism was deliberately removed (2026-06-10, no legacy column); only a cosmetic echoed/audited `idempotencyKey` field remains, never checked. Duplicate dispatch is prevented only by a check-then-act `TRNF_YN == 'Y' → WBE2064` flag with **no row locking** (`SELECT … FOR UPDATE`/`@Lock` absent), so concurrent double-submits can both pass under READ_COMMITTED. Transactional boundaries are consistent (outer `@Transactional dispatch` + inner `MANDATORY execute`) across all five payment types.
Evidence: `OwnAccountTransferService.java:550-556,744`; `V69__napas_remit_trns_hstr.sql:7-13`; `VendorPaymentService.java:1138-1140` (+ expense/payroll/internal/overseas peers)
Mobile WebView impact: Flaky mobile networks + user retries + app-resume replays make duplicate submission materially more likely than on desktop. Without idempotency, a retried "submit payment" can double-dispatch.
Recommendation: Require a client-supplied idempotency key honored server-side for all payment/approval mutations before the approval/create-receipt phases ship on mobile. Cross-team (backend) decision.
Implementation required: Yes · Priority: High

### [Medium] Notification API exists but is poll-only (no push, no device tokens)

Area: Notifications
Status: Confirmed
Current behavior: `NotificationController` `/api/v1/notifications` (ports legacy `comm_0192_007`, backed by legacy BLTB tables): `GET /` (list, `read_type`/`page`/`size`/`search`), `GET /unread-count`, `PUT /{id}/read`, `PUT /read-all`. No push/websocket/device-token endpoints. Recipient is derived from `TenantContext`, never the request.
Evidence: `NotificationController.java:38-95`; frontend `lib/api/notification.ts:51-104`
Mobile WebView impact: Real-time push must be native (FCM/APNs); the web can only poll. Notification tap-through in the web opens an **overlay dialog on the current page — it does not `router.push`** (see §10), so deep-linking needs new routing.
Recommendation: Native owns push registration + delivery; web owns the in-app list. Add a native→web `PUSH_NOTIFICATION_OPENED` bridge event carrying a deep-link target.
Implementation required: Yes (bridge + deep-link routes) · Priority: Medium

### Other confirmed backend facts
- **Pagination:** dominant convention is zero-based `page` + `size` `@RequestParam` (e.g. `CardTransactionsController.java:169-170`, `NotificationController.java:59-60`). A few **unpaginated full-list** endpoints exist — `GET /api/v1/users` (whole tenant directory), card dropdown lists, `GET /by-approval/{apprSeqNo}` — acceptable sizes but watch on mobile. (`UserController.java:86-92`; `CardTransactionsController.java:187-194,256-262`)
- **File upload:** multipart via `@RequestPart MultipartFile`, global limits `max-file-size 10MB` / `max-request-size 50MB` (`application.yml:30-31`); per-feature caps in code (avatar 2 MB, receipt 10 MB). Downloads stream `InputStreamResource`/`ByteArrayResource` as `application/octet-stream` with RFC-5987 `Content-Disposition`; **no PDF-typed download endpoint** (PDF is client-generated). (File-handling detail in §11.)
- **Error envelope** is consistent (`ApiResponse`, `GlobalExceptionHandler.java:55`); business errors are **HTTP 200 + `status.error=true`** — mobile clients must inspect `status.error`, not the HTTP code. Key codes: `WBI0000` success, `WBE1009` bad credentials, `WBE1010/1011/1128` inactive/locked/deleted, `WBE1401` session expired, `WBE_VALIDATION`, `WBE9999`.
- **User/company context** via `TenantContext` (JWT-bound `bizKey`/`userId`, roles `ADMIN`/`USER`); avatar self-service `POST/DELETE /api/v1/users/me/image`, shared read `GET /api/v1/users/{id}/image`.

---

## 5. Recommended Route Architecture

### Option comparison

| Criterion | **Option A** — `app/(desktop)/ … app/mobile/` (real segment) | **Option B** — `app/(desktop)/ … app/(mobile)/` (route groups) | **Option C** — separate `wecms-mobile-web/` app |
|---|---|---|---|
| Code reuse | **High** — shares `lib/`, `components/shared`, `lib/api`, `lib/auth`, `lib/i18n` directly | High (same project) | **Low** — must extract a shared package or duplicate |
| URL namespace | **Clean `/mobile/*` prefix** — ideal for WebView load + deep-link allowlisting | **Broken:** route groups are invisible, so `(desktop)/banking` and `(mobile)/banking` both resolve to `/banking` → **route collision / build failure** unless every mobile path differs | Own domain/path (`m.` host or `/`) |
| Deployment | One build, one deploy, one env set | One build, one deploy | **Two builds, two deploys, two env sets** |
| Authentication | One `proxy.ts` + one Axios pipeline (branch on `/mobile`) | One pipeline, but invisible-group paths complicate the gate | **Duplicated** auth pipeline, cookies, CORS origin |
| Maintenance | **Low** — single codebase, shared-component culture intact | Low, but collisions force awkward path aliasing | **High** — every shared fix applied twice |
| Risk to desktop | **Low/Contained** — mobile lives under its own segment + layout; desktop URLs unchanged (no need to physically move desktop into a group) | **Medium/High** — route-group collisions and shared root layout changes touch desktop | **Lowest** — full isolation |
| Suitability here | **Best fit** — matches the repo's one-project, shared-first design and small team | Not viable for same-named screens without renaming every route | Overkill for a 2-dev R&D team; discards the shared layer that makes reuse cheap |

### Recommendation: **Option A** (single project, real `/mobile` segment)

Keep desktop where it is; add `app/mobile/` with its own `layout.tsx` (bottom-nav shell, no `AppShell`). This preserves the one-auth-pipeline / one-API-client / one-i18n design, gives a clean `/mobile/*` URL prefix for WebView loading and deep-link allowlisting, and contains desktop risk because mobile is a sibling segment with an independent layout. A `(desktop)` group is optional organizational sugar — **not required**, and skipping it avoids touching every existing route.

**Option B is rejected** on a hard technical ground: Next.js route groups do not appear in the URL, so `(desktop)`/`(mobile)` groups with identically-named screens collide and fail the build. **Option C is rejected** on cost: it doubles auth, i18n, API-client, build, and deploy for a team of two, directly against the repo's "two-call rule" shared-code culture — reconsider only if mobile diverges so far that shared code becomes a liability, or if an independent release cadence/security boundary is mandated.

### Phase-0 changes Option A requires
1. `proxy.ts`: add `/mobile/login` + `/mobile/auth` to public prefixes and redirect unauthenticated `/mobile/*` to `/mobile/login` (not the desktop `/login`). (`proxy.ts:22,40`)
2. New `app/mobile/layout.tsx` mobile shell (bottom nav); do not mount `AppShell`.
3. Mobile-aware post-login redirect target (a mobile home, not `HOME_ROUTE`).

### Proposed route review

| Proposed route | Verdict | Notes |
|---|---|---|
| `/mobile/auth` | Keep | Use as the **native-token/OTP handoff callback** route (Auth Option B), distinct from the form. |
| `/mobile/login` | Keep | In-WebView login form fallback. Having both `/auth` + `/login` is fine if they play different roles; otherwise collapse to one. |
| `/mobile/dashboard` | Keep | New mobile home; desktop has no `/dashboard` (post-login → `/banking/account-inquiry`). |
| `/mobile/receipts`, `/receipts/create`, `/create/purpose`, `/create/payment-method`, `/create/recipient`, `/receipts/{id}` | Keep **but blocked** | **No backend receipt module** (§4). These are the multi-step wizard; APIs must be created first. `purpose` ≈ `/purpose-options`; `recipient` ≈ `/settings/contacts`; `payment-method` has **no API**. |
| `/mobile/banking` | Keep | Maps to `/api/v1/banking/*` (accounts, transactions). |
| `/mobile/payments` | Keep | Maps to the 5 payment modules + approval. |
| `/mobile/approvals` | Keep | Maps to `/api/v1/payment/approval-box`. |
| `/mobile/notifications` | Keep | Maps to `/api/v1/notifications` (poll). |
| `/mobile/settings` | Keep, redesign | Desktop Settings is a **modal**, not routes; mobile needs real settings routes built new. |

Deep-link/detail routes should follow `/mobile/approvals/{approvalId}`, `/mobile/payments/{paymentId}`, `/mobile/receipts/{receiptId}` (§10).

---

## 6. Shared vs Mobile-Specific Components

| Component / concern | Path | Classification |
|---|---|---|
| Status badge | `components/payment/approval-box/StatusBadge.tsx`; `components/payment/shared/PaymentResultBadge.tsx` | **Reusable without changes** — token-based pill |
| Currency formatting | `lib/currency.ts` (`formatAmount`) | **Reusable without changes** — pure |
| Date/time formatting | `lib/datetime.ts` (`formatUtcDtmByLanguage`), relative-time bucketing | **Reusable without changes** — locale+TZ aware |
| API clients (per-domain) | `lib/api/*.ts` | **Reusable without changes** — transport only |
| HTTP + JWT + 401 bus | `lib/axios.ts`, `lib/auth/sessionExpired.ts` | **Reusable with adaptation** — keep transport; swap the popup UI for a bridge call on mobile |
| Auth storage/client | `lib/auth/storage.ts`, `lib/auth/client.ts` | **Reusable with adaptation** — token source may change under native handoff |
| Validation (Zod + RHF) | `app/(auth)/login/loginSchema.ts`, `react-hook-form` + `zod` | **Reusable without changes** |
| i18n provider | `lib/i18n/LocaleProvider.tsx` | **Reusable with adaptation** — add native language sync + Khmer if needed |
| System dialogs | `components/shared/dialog/` (`useDialog`, ≤500 px, portal) | **Reusable with adaptation** — mobile-safe but review touch sizing |
| Forms | RHF-based feature forms | **Reusable with adaptation** — layout must go single-column / step-by-step |
| Feature dialogs | `components/ui/dialog.tsx` (shadcn, `stackLevel` 1–5) | **Must be redesigned** — large `max-w-*`, 5-deep stack unusable at 375 px; convert to full-screen pages / bottom sheets |
| Data tables | `components/shared/DataTableShell.tsx`, `components/payment/shared/PaymentListTable.tsx` | **Must be redesigned** — fixed min-width horizontal scroll, no reflow |
| Sidebar | `components/layout/Sidebar.tsx` | **Desktop-only** — drawer is desktop-nav shrunk; replace with bottom nav |
| Header | `components/layout/Header.tsx` | **Desktop-only** — replace with mobile top bar |
| Full-screen selectors | (none — done as dialogs: `SelectBankDialog`, `SelectBankAccountsDialog`, `AddApproverPopover`) | **Must be built** — native uses full-screen selection pages |
| Bottom navigation | (none) | **Must be built** |
| Fixed bottom action buttons | (none — actions live in toolbars/dialog footers) | **Must be built** (sticky action bar) |
| Receipt cards | (none) | **Must be built** + backend (§4) |
| Camera / file-upload flows | `<input type=file>` only; `lib/file.ts`, `lib/api/approvalMultipart.ts`; **no camera** | **Must be redesigned** — camera/gallery require a native bridge (§11) |
| Excel upload preview | `components/shared/excel-upload/ExcelUploadDialog.tsx` (fixed 450 px 3-table preview) | **Must be redesigned** or kept desktop-only |
| PDF generation | `lib/pdf.ts` (`jspdf`+`html2canvas-pro`) | **Reusable with adaptation** — heavy in WebView; prefer native PDF viewer via bridge |
| Notification panel | `components/layout/notifications/` (right-docked slide-over) | **Must be redesigned** — full-screen list on mobile |
| Pagination | `components/shared/Pagination.tsx` (hides page-size `< md`) | **Reusable with adaptation** — prefer infinite scroll on mobile |
| FileCard | `components/payment/shared/FileCard.tsx` | **Reusable with adaptation** |
| Memo drawer | `components/shared/memo/` | **Reusable with adaptation** — already a slide-over |

---

## 7. Mobile Screen Inventory

Ownership legend — **Web** (Next.js mobile route in WebView), **Native** (must stay native), **Hybrid** (native shell + web content, or web + native bridge). "Missing API" means no endpoint exists; APIs are never invented here.

| Screen | Desktop route/component | Existing API | New mobile design? | Native dependency | Ownership | Main risks |
|---|---|---|---|---|---|---|
| Language selection | `ProfileMenu` language submenu | none (client pref `wecms_locale`) | Yes | Native locale sync | Hybrid | Native/web language desync |
| Login | `app/(auth)/login` | `POST /api/v1/auth/login` | Yes | Keystore, biometric | Hybrid | Token handoff model (§8); 1 h expiry |
| Forgot ID | — (not in web; login = ID/PW only) | **Missing** | Yes | — | Web | Provisioning is DBA-only today; no self-service flow exists |
| Forgot password | — (not in web) | **Missing** | Yes | — | Web | Same as above — no endpoint |
| Dashboard | — (no `/dashboard`; lands on account inquiry) | reuse banking/approval APIs | Yes | — | Web | New IA; aggregate endpoints may be desired |
| Receipt list | — (none) | **Missing** (only card `GET /links/receipts`) | Yes | — | Web | No standalone receipt list API (§4) |
| Create receipt | — (none) | **Missing** (card `POST /receipts` only) | Yes | Camera/gallery | Hybrid | Multi-step wizard has no backend; needs new APIs + PO decision |
| Select purpose | Settings Purpose modal | `GET /card-transactions/purpose-options`; `/settings/purpose-settings` | Yes | — | Web | Not wired to a receipt-create payload |
| Select payment method | — (none) | **Missing** | Yes | — | Web | **No payment-method API/enum exists** |
| Select recipient | `SelectBank*`/contacts dialogs | `/api/v1/settings/contacts` | Yes | — | Web | Not wired to receipt create; full-screen picker to build |
| Receipt detail | — (none) | card `GET /receipts/{doc_id}` only | Yes | — | Web | Only card-linked detail exists |
| Banking account inquiry | `/banking/account-inquiry` | `GET /api/v1/banking/accounts` | Yes (cards) | — | Web | Wide table → card redesign |
| Transaction history | `/banking/transaction-history` | `GET /banking/accounts/{seq}/transactions` | Yes | — | Web | Pagination → infinite scroll |
| Payment list | `/payment/*` (5 modules) | per-module list APIs (page/size) | Yes | — | Web | Batch-file semantics; totals; wide tables |
| Payment detail | `/payment/*/[id]` | per-module detail APIs | Yes | — | Web | Attachments; file download via bridge |
| Approval list | `/payment/approval-box` | `GET /approval-box` | Yes | — | Web | Core mobile use case |
| Approval detail | `ApprovalDetailsDialog` | `/approval-box/{id}` + attachments | Yes | — | Web | Dialog → full-screen; attachment view |
| Approve / reject | approval action in dialog | `PUT /approval-box/...` (mutations) | Yes | Biometric (optional) | Hybrid | **No idempotency (§4)** — retry risk; visibility = first-pending-approver |
| Notifications | notification slide-over | `GET/PUT /api/v1/notifications` | Yes | Push (FCM/APNs) | Hybrid | Poll-only web; push is native; deep-link (§10) |
| User profile | `/auth/me` + avatar | `GET /me`, `GET/POST/DELETE /users/me/image` | Yes | Gallery/camera | Hybrid | Avatar upload needs bridge or `<input>` |
| Settings | `<SettingsModal>` (modal) | per-setting APIs | Yes | — | Web | Desktop is a modal → build routes |
| Logout | `ProfileMenu` → confirm | `POST /api/v1/auth/logout` | Yes | Clear native token | Hybrid | In-memory revocation (§4); native cleanup |
| Session-expired | `SessionExpiredDialog` | 401 via any call | Yes | Biometric/OTP re-auth | Hybrid | Bridge `REPORT_SESSION_EXPIRED`; background expiry |
| Error screen | `useDialog` error | envelope `status.error` | Yes | — | Web | Business errors are HTTP 200 |
| Maintenance screen | — (none) | **Missing** | Yes | — | Hybrid | No maintenance-mode flag/endpoint exists |
| Unsupported-app-version | — (none) | **Missing** | Yes | App version, bridge | Hybrid | Needs version headers + capability check (§16) |

---

## 8. Authentication and Session Assessment

### Current end-to-end flow (Confirmed)
1. `LoginForm` → `login(userId, password)` → `POST /api/v1/auth/login {user_id,user_pw}`; `Accept-Language` sets `lang_cd`; per-IP rate limit 10/60 s. (`AuthController.java:40-53`)
2. Response `{access_token, token_type:"Bearer", expires_in:3600, user_id, user_nm, biz_key, lang_cd, cmpn_nm, auth_gr_cd, prdt_type, tax_id}` (or a multi-company `companies_available[]` chooser with no token). (`LoginResponse.java:56-105`)
3. Frontend `toStoredUser()` maps snake→camel; `tokenStorage.set()` writes `localStorage` **+ non-HttpOnly cookie**; `router.push(HOME_ROUTE)`. (`lib/auth/client.ts:113-246`; `lib/auth/storage.ts:98-129`)
4. Every request: Axios attaches `Authorization: Bearer <localStorage token>`. (`lib/axios.ts:15-24`)
5. Route protection: `proxy.ts` edge-gate on the `wecms_token` cookie; `(dashboard)/layout.tsx` rehydrates via `GET /me`. (`proxy.ts:28-53`)
6. Session expiry: in-page 401 → re-auth bus → password popup → retry; `/me` 401 → `/login`. (`sessionExpired.ts`; `axios.ts:52-89`)
7. Logout: best-effort `POST /logout` (revokes by `jti`, in-memory) → clear auth keys (locale/saved-id preserved). (`AuthController.java:76-81`; `client.ts:288-297`)

**Storage keys:** `wecms_token` (localStorage + cookie), `wecms_user`, `wecms_saved_user_id`, `wecms_locale`. **JWT stateless, HS512, 1 h, no refresh, in-memory revocation.** **CSRF disabled** (token API). **CORS** exact-origin allow-list + `allowCredentials=true`.

### Option comparison for WebView

| Option | How it works | Pros | Cons | Verdict |
|---|---|---|---|---|
| **A — Login inside WebView** | Web renders `/mobile/login`, calls `/auth/login`, token in web storage | Simplest; reuses existing flow | Token lives in JS-readable web storage inside WebView (XSS/bridge exfil, §13); native can't broker biometric; 1 h re-login inside WebView is jarring | Acceptable only as a fallback |
| **B — Native login → one-time code → `/mobile/auth` → web session** | Native authenticates (biometric-backed), obtains a **short-lived single-use code**, WebView opens `/mobile/auth?code=…`, web exchanges it for a session token | Native owns credentials + biometric + secure keystore; short-lived code limits exposure; enables silent re-mint on resume; supports the hourly-expiry problem cleanly | Requires **new backend endpoints** (code issue + exchange); more moving parts | **Recommended** |
| **C — Inject native token into WebView** | Native holds the JWT, injects it into WebView storage/header | No second login | Native must call `/auth/login` and hold a bearer token in native; token still lands in web storage; ties native to the web token lifecycle; no clean revocation | Not recommended |

### Recommendation
Adopt **Option B**. It is the only model that keeps long-lived credentials in the native keystore, brokers biometric re-auth, and gives a clean answer to the 1-hour-expiry / background-resume problem via a native-driven silent re-mint. It requires a **new backend one-time-code issue+exchange pair** (Phase 0 / Phase 1) and a PO/backend decision. Until it lands, Option A is the interim fallback but must run **HTTPS-only** so the token cookie's `Secure` flag applies. Also resolve, before any deploy: no-refresh-token strategy, cross-instance revocation, and the R/D/T action-permission contract.

Deep-link authentication: a deep link must **never** navigate before the session is confirmed. The mobile auth route must gate on a valid web session (or trigger Option B exchange) and preserve the intended target as a `next` param — mirroring the existing `proxy.ts ?next=` pattern (`proxy.ts:40-44`).

---

## 9. Native-WebView Bridge Requirements

No bridge exists today (no `getUserMedia`, no `window.webkit`/`AndroidBridge` references in the web). The following contract is **recommended, not implemented**. Adopt a **versioned bridge** (`bridgeVersion`, e.g. semver) negotiated at load via `GET_APP_INFO`, so web can feature-detect before calling.

### Web → Native

| Function | Purpose | Input | Expected response | Security | Phase | Android | iOS |
|---|---|---|---|---|---|---|---|
| `CLOSE_WEBVIEW` | Return to native | `{reason?}` | ack | Restrict to app origin | 1 | Activity finish | dismiss VC |
| `LOGOUT` | Native clears token + returns to native login | `{}` | ack | Must clear keystore | 1 | — | — |
| `OPEN_EXTERNAL_BROWSER` | Open URL in system browser | `{url}` | ack | Allowlist URL scheme/host | 2 | CustomTabs | SFSafariVC |
| `OPEN_CAMERA` | Capture receipt/attachment photo | `{maxSize,quality,mime}` | `{fileToken\|base64,mime,size}` | Runtime permission; size cap | 4 | FileProvider | PHPicker/Camera |
| `OPEN_GALLERY` | Pick image | `{multiple,mime}` | `{files[]}` | Permission | 4 | — | PHPicker |
| `SELECT_FILE` | Pick document (xlsx/pdf) | `{mime[]}` | `{fileToken,name,mime,size}` | Type allowlist | 4 | SAF | UIDocumentPicker |
| `DOWNLOAD_FILE` | Save an authenticated blob natively | `{url,fileName,authHeader}` | `{path}` | Auth header not logged | 4 | DownloadManager | URLSession |
| `SHARE_FILE` | Share sheet | `{path\|url}` | ack | — | 4 | ACTION_SEND | UIActivityVC |
| `REQUEST_BIOMETRIC` | Gate approve/reject or re-auth | `{promptText}` | `{ok,token?}` | No secrets in JS | 3 | BiometricPrompt | LAContext |
| `OPEN_NOTIFICATION_SETTINGS` | Deep-link OS settings | `{}` | ack | — | 2 | — | — |
| `GET_APP_INFO` | Version/capability negotiation | `{}` | `{appVersion,platform,bridgeVersion,capabilities[]}` | — | 0/1 | — | — |
| `GET_DEVICE_INFO` | Device/OS/model | `{}` | `{os,osVersion,model}` | Minimize PII | 1 | — | — |
| `REPORT_SESSION_EXPIRED` | Ask native to re-auth (biometric/OTP) | `{}` | `{re_authenticated,token?}` | Short-lived token | 1 | — | — |

### Native → Web

| Function | Purpose | Direction | Input | Expected | Security | Phase |
|---|---|---|---|---|---|---|
| `PUSH_NOTIFICATION_OPENED` | User tapped a push | N→W | `{type,targetId,deepLink}` | web routes after auth check | Validate target vs allowlist (§10) | 2 |
| `DEEP_LINK_RECEIVED` | App link / universal link | N→W | `{path,params}` | web navigates post-auth | Allowlist path | 2 |
| `APP_RESUMED` | Foreground | N→W | `{}` | web re-validates session | Trigger silent re-mint | 1 |
| `BIOMETRIC_RESULT` | Result of `REQUEST_BIOMETRIC` | N→W | `{ok,token?}` | continue gated action | — | 3 |
| `FILE_SELECTED` / `CAMERA_RESULT` | Result of picker/capture | N→W | `{fileToken\|base64,meta}` | web attaches/uploads | Size/type re-validate | 4 |
| `NETWORK_STATUS_CHANGED` | Online/offline | N→W | `{online}` | web shows offline UI | — | 2 |
| `APP_THEME_CHANGED` | Light/dark | N→W | `{theme}` | web restyles | — | 5 (optional) |

**Contract rules (recommended):** every call carries `bridgeVersion`; unknown/lower-version calls degrade gracefully; large binaries pass by **file token/handle**, not base64, where possible; the bridge posts only to the app's own origin; no secrets or tokens are logged on either side.

---

## 10. Deep Linking and Push Notifications

- **Current notification implementation:** poll-only web list (`GET/PUT /api/v1/notifications`, §4) over legacy BLTB tables. Payload `NotificationRow` carries `notificationId, bltbCd, notiSeqNo, title, content, senderName, senderId, notiJson, notiWsvc, deleted, read, dateTimeRaw, userImgUrl`. (`components/layout/notifications/types.ts:17-51`)
- **Current tap behavior — no deep-link:** `handleRowClick` marks read and opens `CommonApprovalDetailsDialog` **as an overlay on the current page**; it parses `NOTI_JSON` (`POST_SEQ_NO`/`BLTB_CD`/`APPR_SEQ_NO`) but **does not `router.push`**. Deleted → warning; no key → "no detail". (`NotificationPopup.tsx:157-200,319-329`)
- **No push/websocket/device-token endpoints** exist server-side (§4). Real-time delivery must be native (FCM/APNs).

### Findings
- **Authentication before navigation:** a push/deep-link must resolve auth first (Option B exchange or existing session) before routing; preserve `?next=` (mirrors `proxy.ts:40-44`).
- **Route allowlisting:** define a strict allowlist of deep-linkable mobile paths; reject anything else. Recommended targets:
  - `/mobile/approvals/{approvalId}`
  - `/mobile/payments/{paymentId}`
  - `/mobile/receipts/{receiptId}` (pending receipt APIs, §4)
- **Expired-session behavior:** a deep link that arrives with an expired session routes to `/mobile/login`/`/mobile/auth` with the target preserved, then continues.
- **Invalid/unauthorized targets:** if the target record is withdrawn/completed or the user lacks permission, show the existing "approval not found" / permission messaging (`notification.approval_not_found`) rather than a blank route.
- **Android App Links / iOS Universal Links:** must be configured natively (assetlinks.json / apple-app-site-association) — not present in this repo; native-team owned.

Recommendation: add mobile detail routes + a `PUSH_NOTIFICATION_OPENED`/`DEEP_LINK_RECEIVED` bridge handler that runs the auth-then-allowlist-then-navigate sequence. Priority: Medium (Phase 2).

---

## 11. File, Camera, and Download Requirements

| Flow | Existing web component | Existing API | Types / limits | WebView considerations | Native bridge? |
|---|---|---|---|---|---|
| Receipt image upload | none (card receipt uses `<input>`) | `POST /card-transactions/receipts/{doc_id}/files` (10 MB) | image; ext allow-list server-side | `<input type=file>` opens gallery only; no camera in WebView reliably | **Yes** — `OPEN_CAMERA`/`OPEN_GALLERY` |
| Attachments (payment/approval) | `<input multiple>` + `lib/api/approvalMultipart.ts` (FormData) | per-module `POST /{id}/request-approval` multipart; 10 MB/50 MB | any; no client size check | Android WebView `<input>` needs `onShowFileChooser`; iOS WKWebView needs file-picker delegate | Recommended (`SELECT_FILE`) |
| Excel upload | `ExcelUploadDialog` + client XLSX read (`lib/xlsxReader.ts`) | per-feature `POST /excel/preview` + `/excel-upload` | `.xlsx,.xls` | Client-side SheetJS parse works in WebView but is memory-heavy | Optional |
| PDF display | client-gen via `lib/pdf.ts` (`jspdf`+`html2canvas-pro`) | none (client-generated) | — | `html2canvas` raster is heavy/inconsistent in WebView | **Prefer native PDF viewer** |
| File download | `lib/file.ts` (auth XHR blob → synthetic `<a download>`) | streamed `octet-stream` + RFC-5987 filename | — | Blob `<a download>` is unreliable in WebView; JWT can't ride a plain link | **Yes** — `DOWNLOAD_FILE` (native does the authed fetch) |
| File sharing | none | — | — | — | **Yes** — `SHARE_FILE` |
| Camera capture | **none** | — | — | Not possible reliably in WebView | **Yes** — `OPEN_CAMERA` |
| Gallery selection | via `<input accept=image/*>` | — | jpg/png/gif (avatar +svg) | Works but limited | Recommended |

**Security risks:** client-side type restriction is `accept`-attribute only (advisory) with **no client size check** — all validation is server-side; a mobile upload path must not weaken that. Downloads carry the JWT (must go through native `DOWNLOAD_FILE` so the auth header isn't exposed in a link). **Required permissions:** camera, photo library, storage/downloads — all native-declared and runtime-prompted.

Recommendation: route camera/gallery/download/share through the bridge (Phase 4); keep `<input type=file>` as a fallback for gallery/document. Priority: High for the receipt/attachment phase.

---

## 12. Mobile UX Findings

Desktop patterns present in the web that must **not** be reused directly in a mobile WebView, with the recommended mobile alternative:

| Desktop pattern (evidence) | Mobile alternative |
|---|---|
| Wide fixed-px tables 1058–1834 px, horizontal scroll (`globals.css:258,274,296`; `DataTableShell`) | **Cards / stacked rows**, searchable mobile lists |
| Hover interactions (pervasive `hover:*`; `AttachmentCountDropdown.tsx:139`) | Tap targets; bottom sheets; no hover-only affordance |
| Desktop sidebar nav (`Sidebar.tsx`) | **Bottom navigation** |
| Large dialogs (Settings 1300×760; Edit Bank Account 1024 px; 5-level modal stack) | **Full-screen pages** / bottom sheets; single active surface |
| Multi-column forms | **Single-column, step-by-step** forms (the receipt wizard is the model) |
| Small click targets (`size-4`/`size-6` icons; 32 px pills) | ≥44×44 pt touch targets |
| Fixed desktop widths (211 px sidebar, page-size dropdowns) | Fluid, viewport-relative layout |
| Drag-and-drop / reorder (View Setting popover) | Explicit up/down or a mobile reorder pattern |
| Nested modals (stackLevel 1–5) | Push navigation (route stack), not stacked overlays |
| Excel-only workflows (upload/download/preview) | Keep desktop-only, or native file bridge; not a core mobile flow |
| Slide-over notification panel (405 px) | **Full-screen notification list** route |
| Classic pagination (`Pagination.tsx`) | **Infinite scroll** / "load more" |

Recommendation: mobile screens are designed fresh against the native app's existing patterns (bottom nav, mobile cards, full-screen selectors, sticky action buttons). This is a design deliverable — not produced in this audit.

---

## 13. Security Findings

### [Critical] JWT in `localStorage` + non-HttpOnly cookie — token exfiltration surface
Area: Client token storage · Status: Confirmed · Evidence: `lib/auth/storage.ts:98-129`; `lib/axios.ts:15-24`
Impact: Any XSS or compromised JS bridge inside the WebView can read the bearer token from two JS-readable stores. Recommendation: native-token-handoff (§8 Option B), HTTPS-only so `Secure` applies, and a strict CSP (below). Implementation required: Yes.

### [High] Frontend ships zero security headers / no CSP
Area: Frontend hardening · Status: Confirmed · Evidence: no `headers()` in `next.config.ts`; `proxy.ts` sets none — grep found no CSP/X-Frame-Options/HSTS in `wecms-web`.
Impact: No CSP, no `frame-ancestors`, no HSTS on the pages a WebView renders — no defense-in-depth against injected script or clickjacking. Recommendation: add a strict CSP (script-src self, connect-src the API origin only), `X-Content-Type-Options`, and frame-ancestors restricting embedding to the app. Implementation required: Yes.

### [High] No refresh token + in-memory per-instance revocation
Area: Session lifecycle · Status: Confirmed · Evidence: `application.yml:59`; `TokenRevocationService.java:26-48`
Impact: 1-hour forced re-login; logout not honored cross-instance/after restart; stolen token valid up to an hour. Recommendation: mobile session strategy + shared revocation store before deploy. Implementation required: Yes.

### [High] No idempotency; non-atomic duplicate-submit guards on payments
Area: Payment integrity · Status: Confirmed · Evidence: `V69__napas_remit_trns_hstr.sql:7-13`; `VendorPaymentService.java:1138-1140`
Impact: Mobile retries/resumes can double-dispatch. Recommendation: server-honored idempotency key for all payment/approval mutations. Implementation required: Yes.

### [Medium] Verbose config carried into SIT (`show-sql: true`, `include-message: always`)
Area: Info leakage · Status: Confirmed · Evidence: `application-sit.yml:18`; `application.yml:48` (inherited)
Impact: SQL + exception messages exposed in a shared-DB SIT environment reachable by mobile testers. Recommendation: set `include-message: never` and `show-sql: false` for SIT. Implementation required: Yes.

### [Medium] Business errors returned as HTTP 200
Area: Error semantics · Status: Confirmed · Evidence: `GlobalExceptionHandler.java:61-66`
Impact: A naive native retry-on-non-2xx layer will misread success; a WebView network monitor won't flag business failures. Recommendation: mobile/native clients must inspect `status.error`, never the HTTP code. Implementation required: No (documentation/contract).

### [Medium] CORS uses `allowCredentials=true` with an exact-origin allow-list
Area: CORS · Status: Confirmed · Evidence: `CorsConfig.java:16-26`
Impact: The WebView's `Origin` must be present in `WECMS_CORS_ALLOWED_ORIGINS`; wildcard is unusable with credentials. Recommendation: confirm the mobile web origin is allow-listed per environment. Implementation required: Requires validation (env).

### Items to validate before deploy (native-owned or env-owned)
| Item | Classification | Note |
|---|---|---|
| WebView debugging disabled in release builds | High | Native (`setWebContentsDebuggingEnabled(false)` / iOS inspectable=false) |
| Domain allowlisting / block external navigation in WebView | High | Native `shouldOverrideUrlLoading` / `WKNavigationDelegate` |
| `javascript:`/`file://` access disabled | High | Native WebView settings |
| Mixed content blocked | High | Env-driven: `NEXT_PUBLIC_API_BASE_URL` must be HTTPS (§8/§14) |
| SSL validation (no cert bypass) | Critical | Native — never disable trust checks |
| Screenshot restriction / clipboard policy | Medium | Native FLAG_SECURE / iOS equivalent |
| Root/jailbreak policy | Medium | Native |
| Sensitive logs (tokens not logged) | Confirmed OK backend | Backend masks tokens (`JwtAuthenticationFilter.java:105`, `NxisasMask`); ensure native + bridge do the same |
| XSS / CSRF / clickjacking | High/Medium | XSS mitigated by CSP (missing); CSRF N/A (stateless bearer, CSRF disabled — correct); clickjacking → frame-ancestors (missing) |
| Download authorization | Medium | Downloads are JWT-authed; keep via native `DOWNLOAD_FILE` |
| Session invalidation / logout cleanup | High | In-memory revocation gap + native token cleanup |

---

## 14. Deployment and Environment Findings

To expose mobile routes at `https://sit-…/mobile`, `https://uat-…/mobile`, `https://…/mobile`:

| Concern | Current state | Action for mobile |
|---|---|---|
| Reverse proxy | No nginx/Docker in-repo; external Tomcat WAR + downstream GitLab pipeline | Confirm the fronting proxy routes `/mobile/*` to the Next.js app (same as other routes) |
| Context path | Backend **no `context-path`**; routes literal `/api/v1/*` | No change; mobile uses the same API base |
| Next.js base path | **No `basePath`/`assetPrefix`** (`next.config.ts`) | `/mobile` as a route segment needs no basePath; keep as-is |
| API base URL | `NEXT_PUBLIC_API_BASE_URL` env, default localhost | Set per env; **must be HTTPS** to satisfy WebView mixed-content + cookie `Secure` |
| CORS | env-driven exact-origin allow-list, `allowCredentials=true` | Add the mobile web origin per env to `WECMS_CORS_ALLOWED_ORIGINS` |
| Cookie domain / SameSite | `wecms_token` `SameSite=Lax`, `Secure` on HTTPS only, path `/` | Verify domain matches the WebView-loaded host; HTTPS mandatory |
| Env variables | All endpoints env-injected; SIT via `setenv.sh` in `ROOT.war` | Add mobile origin + (if Option B) one-time-code config per env |
| Cache control | No custom cache headers on Next side | Define cache policy for `/mobile` assets; ensure HTML not over-cached in WebView |
| Release compatibility | No app-version negotiation exists | Add version headers/capability check (§15) |
| Rollback | WAR redeploy + downstream pipeline | Mobile web rolls back with the web app; native rolls back independently — decouple contracts (bridge/version) |
| Mobile env switching | None | Native must be able to point the WebView at DEV/SIT/UAT/PROD (build flavor / config) |

Finding: **HTTPS is mandatory** for every mobile env (cookie `Secure` + mixed content). The env matrix and CORS origins are the main deployment prerequisites; no context-path or basePath work is needed. Priority: High (Phase 0).

---

## 15. Compatibility and Versioning

No versioning/capability mechanism exists today. Recommended (not implemented):

| Mechanism | Purpose | Recommendation |
|---|---|---|
| `X-WeCMS-App-Version` | Native app semver on every request | Adopt — enables min-version gating server-side |
| `X-WeCMS-Platform` | `android`/`ios` | Adopt — platform-specific behavior/telemetry |
| `X-WeCMS-Bridge-Version` | Bridge contract version | Adopt — web feature-detects before bridge calls |
| Minimum supported app version | Force-upgrade below a floor | Adopt — a backend rule + an "Unsupported app version" screen (missing today, §7) |
| Feature capability list | `GET_APP_INFO` returns `capabilities[]` | Adopt — web degrades gracefully when a bridge feature is absent |

The web should read these headers/capabilities to decide whether a native feature (camera, biometric, share) is callable, and the backend should be able to reject/route based on app version + platform. Priority: Medium (Phase 0/1).

---

## 16. Testing Matrix

| Test | Android WebView | iOS WKWebView | Mobile Chrome | Mobile Safari | Automatable? |
|---|---|---|---|---|---|
| Login (incl. Option B handoff) | ✔ | ✔ | ✔ | ✔ | Partial (unit/e2e web; handoff needs device) |
| Logout + native token cleanup | ✔ | ✔ | — | — | Device |
| Session expiration (in-page 401) | ✔ | ✔ | ✔ | ✔ | Automatable (mock 401) |
| Expired token on resume/background | ✔ | ✔ | — | — | **Real device** |
| Receipt creation (once APIs exist) | ✔ | ✔ | ✔ | ✔ | Partial |
| Attachments (upload) | ✔ | ✔ | ✔ | ✔ | Partial (file-chooser is device) |
| Payments (list/detail/submit) | ✔ | ✔ | ✔ | ✔ | Automatable (web) + device for submit |
| Approvals (approve/reject) | ✔ | ✔ | ✔ | ✔ | Automatable + biometric on device |
| Notifications (list + push tap) | ✔ | ✔ | list only | list only | Push = **real device** |
| Deep links (app/universal links) | ✔ | ✔ | — | — | **Real device** |
| Downloads (native `DOWNLOAD_FILE`) | ✔ | ✔ | limited | limited | **Real device** |
| Camera / gallery | ✔ | ✔ | — | — | **Real device** |
| Slow network (3G/latency) | ✔ | ✔ | ✔ | ✔ | Automatable (throttle) |
| Offline | ✔ | ✔ | ✔ | ✔ | Automatable |
| Background / resume | ✔ | ✔ | — | — | **Real device** |
| Duplicate submission (retry) | ✔ | ✔ | ✔ | ✔ | Automatable (concurrent requests) |
| Old app version gating | ✔ | ✔ | — | — | Automatable (header) + device |
| Interrupted upload | ✔ | ✔ | ✔ | ✔ | Partial (device) |
| Back button (Android) | ✔ | n/a | ✔ | n/a | **Real device** |
| Swipe-back (iOS) | n/a | ✔ | n/a | ✔ | **Real device** |
| Keyboard overlap / safe-area | ✔ | ✔ | ✔ | ✔ | Partial (visual, device) |
| Orientation | ✔ | ✔ | ✔ | ✔ | Partial |

**Automatable:** business logic, 401/expiry mocks, duplicate-submit concurrency, slow/offline throttling, version-header gating, web e2e (Playwright). **Real-device required:** camera/gallery, downloads, push + deep links, biometric, back/swipe navigation, background/resume, safe-area/keyboard, WebView-engine-specific quirks. Note the Haengsung Oracle datasource and NXiSAS local-engine dependencies mean some payment/scrape flows already require specific environments.

---

## 17. Migration Phases

### Phase 0 — Foundation (no user-facing screens)
- Scope: route architecture (Option A), Auth Option B design + one-time-code endpoints, versioned bridge contract, security baseline (CSP/headers, HTTPS, token storage), env/CORS matrix, `proxy.ts` mobile-awareness.
- Dependencies: PO + backend + native-team sign-off.
- Risks: auth model + idempotency + revocation are cross-team; getting these wrong blocks everything downstream.
- Exit criteria: agreed bridge spec (versioned), agreed auth model, CSP live, `/mobile` routing + gate proven, env matrix documented.
- Teams: Web, Backend, Native, Security, PO.

### Phase 1 — Auth + shell
- Scope: `/mobile/login` + `/mobile/auth` handoff, dashboard, profile, logout, session expiration via bridge, basic bridge (`GET_APP_INFO`, `GET_DEVICE_INFO`, `APP_RESUMED`, `REPORT_SESSION_EXPIRED`, `CLOSE_WEBVIEW`, `LOGOUT`).
- Dependencies: Phase 0.
- Risks: 1-hour expiry UX; token handoff correctness; background-resume re-auth.
- Exit criteria: end-to-end login→session→logout on both platforms; expiry/resume handled via bridge.
- Teams: Web, Native, Backend.

### Phase 2 — Read-only business screens
- Scope: receipt list (**blocked on APIs** — read the closest analogs only), banking inquiry, transaction history, payment status, notifications (list + `PUSH_NOTIFICATION_OPENED`/`DEEP_LINK_RECEIVED`, `NETWORK_STATUS_CHANGED`).
- Dependencies: Phase 1; deep-link allowlist; native push registration.
- Risks: wide-table redesign volume; poll-only notifications; deep-link auth ordering.
- Exit criteria: read flows usable on device; deep links route safely post-auth.
- Teams: Web, Native, Backend (notification/deep-link contract).

### Phase 3 — Approvals
- Scope: approval list/detail, approve/reject, biometric/OTP gating (`REQUEST_BIOMETRIC`/`BIOMETRIC_RESULT`), **duplicate-submit protection (idempotency)**.
- Dependencies: Phase 2; **backend idempotency** (Phase 0/1 decision realized here).
- Risks: double-approval on retry without idempotency; approver-visibility parity.
- Exit criteria: approve/reject safe under retry/flaky network; biometric gate working.
- Teams: Web, Native, Backend.

### Phase 4 — Create + attachments
- Scope: create receipt (**requires new backend APIs** for purpose+payment-method+recipient), camera/gallery, attachments, Excel upload, PDF/download/share (`OPEN_CAMERA`/`OPEN_GALLERY`/`SELECT_FILE`/`DOWNLOAD_FILE`/`SHARE_FILE`).
- Dependencies: Phase 3; **new receipt endpoints + PO decision**; file bridge.
- Risks: the receipt module is net-new (highest scope risk); file bridge complexity; `html2canvas` PDF in WebView.
- Exit criteria: receipt creation + attachment upload + download/share verified on device.
- Teams: Web, Native, Backend, PO.

### Phase 5 — Retire duplicated native business screens
- Scope: remove native screens now served by WebView; keep native for camera/biometric/push/navigation shell.
- Dependencies: Phases 1–4 stable in production; feature-flag rollback path.
- Risks: parity regressions; version compatibility across app versions in the field.
- Exit criteria: WebView parity confirmed; staged rollout + rollback proven; old app versions gated.
- Teams: Native, Web, PO.

---

## 18. Risks and Open Questions

| # | Risk / open question | Severity | Owner |
|---|---|---|---|
| R1 | Receipt module has no backend (list/create/purpose/payment-method/recipient). Is mobile receipt in scope, and who defines the API? | Critical | PO + Backend |
| R2 | No refresh token + 1-hour expiry — what is the mobile session model? | High | Backend + PO |
| R3 | In-memory per-instance token revocation in a multi-instance deploy | High | Backend/Infra |
| R4 | No idempotency + non-atomic duplicate-submit on payments | High | Backend |
| R5 | JWT in localStorage + non-HttpOnly cookie; no CSP/headers on the web | Critical/High | Web + Security |
| R6 | Auth model choice (Option B one-time-code) needs new endpoints | High | Backend + Native |
| R7 | Bridge contract + versioning does not exist | High | Native + Web |
| R8 | Push + deep links entirely native (FCM/APNs, app/universal links) | Medium | Native |
| R9 | R/D/T action-permission is a client stub — must close pre-UAT (mobile or desktop) | Medium | Backend + Web |
| R10 | Khmer (`km`) locale absent in web; native may support it | Low | Web + PO |
| R11 | `html2canvas` PDF unreliable in WebView | Medium | Web + Native |
| R12 | Forgot-ID / forgot-password / maintenance / unsupported-version screens have no backend | Medium | Backend + PO |
| R13 | Verbose SIT config (`show-sql`, `include-message: always`) reachable by testers | Medium | Backend |
| R14 | Native must switch WebView across DEV/SIT/UAT/PROD; HTTPS + CORS origin per env | Medium | Native + Infra |

---

## 19. Final Recommendation

**Proceed with a WebView migration on Option A (single Next.js project, real `/mobile` segment, new mobile shell) — but only after Phase 0 closes the auth, idempotency, revocation, and security-header gaps.** The shared non-visual layer (API clients, formatters, validation, 401 bus, status/badges) makes reuse cheap; the visual layer must be built fresh for mobile. The receipt module is the largest single unknown and gates Phase 4.

### Answers to the required questions
1. **Can the Next.js project safely support dedicated mobile routes?** Yes — with a mobile-aware `proxy.ts`, a new `app/mobile/` shell, and the security baseline in place. Low, contained risk to desktop.
2. **Should desktop and mobile stay in one Next.js project?** Yes — one project maximizes reuse (auth, API, i18n, formatters) and matches the repo's shared-code culture.
3. **Would a separate `wecms-mobile-web` be safer?** Safer in isolation, but not worth it — it doubles auth/i18n/API/build/deploy for a 2-dev team and discards the shared layer. Reconsider only if an independent release cadence or hard security boundary is mandated.
4. **Which components can be reused?** API clients (`lib/api/*`), Axios+401 bus (`lib/axios.ts`, `sessionExpired.ts`), currency/date formatters (`lib/currency.ts`, `lib/datetime.ts`), Zod validation, status badges, auth storage/client (with adaptation), i18n provider (with native sync).
5. **Which screens need a completely new mobile design?** All list/table screens, all dialogs/selectors, Settings (modal→routes), notifications (slide-over→full-screen), the entire receipt wizard, bottom nav, sticky action bars, mobile cards.
6. **Which Spring Boot APIs can be reused?** Auth (`/auth/*`), navigation (`/navigation`), banking (`/banking/*`), all payment modules + approval-box, notifications (`/notifications`), settings/contacts/purpose, user/profile/avatar, card transactions incl. card-receipts — all as-is (page/size pagination, `ApiResponse` envelope).
7. **Which APIs are missing or unsuitable?** **Missing:** standalone receipt CRUD, payment-method selection, forgot-ID/password, maintenance-mode, unsupported-version, push/device-token, one-time-code auth exchange. **Unsuitable as-is:** poll-only notifications for real-time; 1-hour no-refresh session; non-idempotent payment submit.
8. **Safest authentication approach?** **Option B** — native login (biometric-backed) → short-lived one-time code → `/mobile/auth` exchange → web session; HTTPS-only; add CSP; move off long-lived JS-readable token storage.
9. **Which native bridge functions are required?** Minimum set: `GET_APP_INFO`, `GET_DEVICE_INFO`, `APP_RESUMED`, `REPORT_SESSION_EXPIRED`, `CLOSE_WEBVIEW`, `LOGOUT`, then `OPEN_CAMERA`/`OPEN_GALLERY`/`SELECT_FILE`/`DOWNLOAD_FILE`/`SHARE_FILE`, `REQUEST_BIOMETRIC`, `PUSH_NOTIFICATION_OPENED`/`DEEP_LINK_RECEIVED`, `NETWORK_STATUS_CHANGED` (§9).
10. **What must remain native?** Push registration/delivery, app/universal links, biometric, camera/gallery/file pickers, secure token/keystore, screenshot/root policy, WebView security config, the app shell + navigation container.
11. **Highest security risks?** JWT in localStorage + non-HttpOnly cookie (Critical); no CSP/security headers on the web (High); no refresh + in-memory per-instance revocation (High); no idempotency on payments (High).
12. **What must be completed before implementation?** Phase 0: auth model (Option B endpoints), idempotency, cross-instance revocation, CSP/headers, HTTPS + CORS env matrix, versioned bridge contract, receipt-scope decision.
13. **Recommended migration sequence?** Phase 0 foundation → 1 auth/shell → 2 read-only screens → 3 approvals → 4 create/attachments → 5 retire native duplicates.
14. **Decisions requiring the Android/iOS team?** Bridge contract + versioning, push/FCM-APNs + app/universal links, biometric, WebView security config, per-env WebView switching, back/swipe lifecycle, native token storage + Option B integration.
15. **Decisions requiring product/design?** Whether/how mobile receipts exist (and their payment-method/recipient model), forgot-ID/password + maintenance + unsupported-version flows, Khmer locale, the R/D/T permission contract, and the mobile IA/visual design for every new screen.

---

*End of audit. No code, routes, components, APIs, configuration, or dependencies were modified in producing this report.*

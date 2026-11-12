# WeInvoice: Notification Bell per MST — Web

**Date:** 2026-11-12
**Type:** FEATURE
**Current Work Classification:** FEATURE
**Status:** PARTIAL — code + automated tests done; browser check and backend integration pending
**Approval Status:** APPROVED (developer, 2026-11-12: "Build to this layout") · **Implementation Status:** COMPLETE · **Test Status:** PASS (automated) · browser / integration NOT RUN
**Repository:** we-scraping-web
**Backend record (shared contract):** `we-scraping-api/docs/features/addon-service/weinvoice/weinvoice-notifications-2026-11-12.md` (backend repository — built in parallel against the same contract)

## Purpose

Spec 01 "Khung ứng dụng" shows a "chuông thông báo" in the header and leaves its behaviour to Dev. The bell tells the
user what the engine collected per MST (new invoices from GDT, XML downloaded, original PDFs obtained) and what needs
action (GDT password refused, mailbox login failed).

## Requirement

Approved layout (developer, 2026-11-12):

- Bell in the header with an unread badge (number, capped "99+", hidden at 0) from `GET /notifications/unread-count`,
  polled every 60 s while the tab is visible (paused while `document.hidden`), refreshed after the panel marks items read.
- Click → panel (shared `Popover`, ~400 px, max height + internal scroll): title "Thông báo" + "Đánh dấu đã đọc tất cả";
  filter chips **MST đang làm việc** (default) · **Tất cả MST** · **Cần xử lý**; items with a type icon, main text, a
  second line "<MST> · <company name or month> · <call to action>", relative time (VI / EN / KO), unread highlight;
  empty / loading / error states; footer "Xem tất cả thông báo" loads the next page (size 20) in the same panel.
- Item click → `POST /notifications/read {ids:[id]}` (not awaited) → navigate: `NEW_INVOICES` → `/invoices/purchase`
  (`mua`) or `/invoices/sales` (`ban`), switching the working MST to the item's MST when different;
  `XML_READY` / `PDF_READY` → the same list for that MST (unknown direction → purchase); `GDT_LOGIN_ERROR` →
  `/sources/gdt`; `MAILBOX_ERROR` → `/sources/mailbox`.

## Current System Behavior

`components/layout/Header.tsx` renders a static `Bell` button with an always-on red dot; it does nothing on click. There
is no notifications module in `lib/api/weinvoice/`.

## Target Behavior

As in the requirement. Mock mode (default) shows deterministic fictional notifications built from the mock store's
companies and keeps the read state in memory; api mode calls the 4 endpoints of the backend contract.

## Scope

- `lib/api/weinvoice/notifications.ts` (new data module, mock + api, wire → UI mapper).
- `components/layout/NotificationBell.tsx` (new: bell + badge + panel), `components/layout/Header.tsx` (use it).
- `locales/{vi,en,ko}.json` (new `notif.*` keys).
- Tests: `lib/api/weinvoice/notifications.api.test.ts`, `components/layout/NotificationBell.test.tsx`.

## Out of Scope

Backend endpoints, the read-state table and the engine-side sources (backend record). Push / web-socket delivery, a
separate notifications page, per-user notification settings.

## Proposed User / Business Flow

Bell badge → open panel (filter = working MST) → read / switch filter / load more → click an item → item marked read,
badge refreshed, working MST switched when needed, the target screen opens.

## Proposed Implementation

PLANNED:

- Data module functions: `listNotifications({ filter, companyMst, page, size })`, `getUnreadCount()`,
  `markNotificationsRead(ids)`, `markAllNotificationsRead(companyMst?)`, `notificationTarget(item)` (route + MST),
  mapper `toNotification(wire)`. Api mode via `wiGet` / `wiPost`.
- `NotificationBell` owns the badge poll (`setInterval` 60 s + `visibilitychange`), the panel state (filter, pages,
  loading / error), and navigation (`useRouter().push`, `setActiveTaxId` — the same call the header MST picker uses).

## API Impact

Consumes (backend contract, `/api/v1/weinvoice`, JWT, snake_case):
`GET /notifications?company_mst=&filter=mst|all|action&page=&size=`, `GET /notifications/unread-count`,
`POST /notifications/read {ids}`, `POST /notifications/read-all {company_mst?}`. No backend change from this repository.

## UI Impact

Header bell becomes functional (badge + panel). No other screen changes.

## Database Impact

NONE (frontend) — database dependency only: the backend owns the read-state table `winv_ntfc_read`
(`V3__winv_notification_read.sql`), see the backend record named above.

## Integration Impact

Works only against a backend that has the notification endpoints; until then api mode shows the panel error state and
the badge stays hidden (poll errors are ignored).

## Validation / Business Rules

- Badge: hidden at 0, number up to 99, "99+" above.
- `filter=mst` always carries `company_mst` = the working MST; read-all sends `company_mst` only for that filter.
- Navigation never waits for the read call; a failed read call is ignored (the next poll corrects the badge).

## Testing Plan

Vitest: data-module request shapes for each filter, unread-count, read, read-all with / without MST, mapper; component
tests for badge hidden / "99+", filter switching params, item click → read + route + MST switch, read-all. Quality gate:
`npx vitest run components lib/api/weinvoice`, `npx tsc --noEmit`, `npx eslint <changed files>`,
`node scripts/check-doc-links.mjs`. Browser check at 375 / 1440 px.

## Implementation

Actual implementation (follows the plan; differences listed under *Deviations*):

- **Data module** `lib/api/weinvoice/notifications.ts`: `listNotifications({filter, companyMst, page, size})`,
  `getUnreadCount()`, `markNotificationsRead(ids)`, `markAllNotificationsRead(companyMst?)`, `notificationTarget(item)`,
  mapper `toNotification(wire)` (wire type `WireNotification`, read raw and mapped once), `resetNotificationsMock()` (tests).
  Api mode: `wiRequest(..., {raw:true})` for the two GETs, `wiPost` for the two writes. `filter=mst` without a working MST
  returns an empty page without a request. Mock mode: per company in the store 4 items (new purchase, XML, PDF split
  provider / email, new sales with 2 months), a GDT error for companies whose connection is not `connected`, one mailbox
  error on the first company (fictional address `ketoan@anphat.example`); times are fixed offsets from a module anchor so
  ids and order are stable; read ids kept in a `Set` (reset on reload).
- **`lib/api/weinvoice/http.ts`**: `wiRequest` treats HTTP 204 on a write (`allowEmpty`) as success with no data — the
  contract answers `read` / `read-all` with 204 and no envelope, which `unwrap` would otherwise reject.
- **`lib/datetime.ts`**: `humanizeIso(iso, t)` — same buckets as the existing `humanizeDatetime` (shared
  `humanizeElapsed`), for the ISO `at` field.
- **`components/layout/NotificationBell.tsx`** (new) — bell + badge (`badgeText`: hidden at 0, "99+" above 99);
  `unread-count` on mount, every 60 s (`UNREAD_POLL_MS`) when `!document.hidden`, and on `visibilitychange` back to
  visible; errors keep the last count. Panel = shared `Popover` (controlled, 400 px, `max-w-[calc(100vw-24px)]`, list area
  `max-h-[min(560px,calc(100vh-80px))]` with `custom-scrollbar-y`). Loads happen in event handlers (open, chip, retry, load
  more), not effects; a sequence ref drops superseded answers. Item click: optimistic read + badge −1,
  `markNotificationsRead` not awaited (failure ignored, badge re-read when it settles), working MST switched with
  `setActiveTaxId` (+ the picker's "Đã chuyển sang MST …" toast) when the item's MST differs, panel closed,
  `router.push(target)`. Read-all: `company_mst` only on the working-MST filter; failure → error toast. Footer shown only
  while loaded < `total_count`.
- **`components/layout/Header.tsx`**: the static bell + fake dot replaced by `<NotificationBell className="hidden sm:block" />`
  (same `sm` breakpoint as before); `Bell` import removed.
- **Locales** (vi / en / ko, 23 keys each): `notif.title`, `notif.mark_all_read`, `notif.filter.{mst,all,action}`,
  `notif.new_purchase`, `notif.new_sales`, `notif.new_invoices`, `notif.xml_ready`, `notif.pdf_ready`,
  `notif.pdf_from_provider`, `notif.pdf_from_email`, `notif.gdt_login_error`, `notif.mailbox_error`, `notif.month`,
  `notif.cta.{view,password,mailbox}`, `notif.empty`, `notif.load_failed`, `notif.load_more`, `notif.read_all_failed`,
  `notif.unread_badge`. Reused: `header.notifications`, `header.switched`, `common.loading`, `common.retry`,
  `relative_time.*`.

**How the working MST is switched:** the same call the header MST picker uses — `setActiveTaxId(mst)` from
`lib/api/weinvoice/sync.ts`. `AppShell` reacts to `activeTaxId` and, in api mode, reloads that MST's invoices / emails
(`remote.reloadForTaxId`), so the target list opens scoped to the item's MST.

**Second line** = `<MST> · <detail> · <call to action>`: detail = the months ("Tháng 10/2026") for `NEW_INVOICES` with
`months`, the mailbox address for `MAILBOX_ERROR`, else the company name; CTA "Xem hóa đơn" / "Cập nhật mật khẩu" /
"Kết nối lại". For the two error types the backend `message` is shown as a third line.

### Deviations

- **No month filter on navigation.** The contract allows "the first month as filter if the list supports it";
  `InvoiceListPage` only reads `?missing=` / `?open=` and uses period presets — no month parameter exists, so the list
  opens on its default period. Adding one would change the invoice list (outside the approved layout).
- **204 handling added to the shared HTTP helper** (needed by the contract; covered by a new `http.test.ts` case).
- The bell stays hidden below `sm` (640 px), as the old static bell was — no mobile entry point added.

## Files Changed

`components/layout/NotificationBell.tsx` (new), `components/layout/NotificationBell.test.tsx` (new),
`components/layout/Header.tsx`, `lib/api/weinvoice/notifications.ts` (new), `lib/api/weinvoice/notifications.api.test.ts`
(new), `lib/api/weinvoice/http.ts`, `lib/api/weinvoice/http.test.ts`, `lib/datetime.ts`, `locales/{vi,en,ko}.json`;
docs: this record, the test result, `test-scenarios.md`, `README.md` (module), `CLAUDE.md` (data-layer note).

## Verification

### Automated Tests

- Test: `npx vitest run components lib/api/weinvoice` — 17 files, 174 tests; whole suite `npx vitest run` — 19 files,
  186 tests.
- Result: PASS. `npx tsc --noEmit`: no errors outside the pre-existing `.next/types`. `npx eslint` on changed files: clean.

### Test Scenarios

- Scenario: badge 0 / 99+, 60 s poll + hidden pause, chips → params, item click → read + MST switch + route, read-all with /
  without MST, load more, empty / error, mock mode.
- Result: PASS (jsdom) — detail in the test result.

### Regression Review

- Areas checked: every `wiPost` caller (204 change only applies when `res.status === 204`), header MST picker / language /
  avatar menus (unchanged code), `humanizeDatetime` (now delegates to the shared bucket function; behaviour unchanged).
- Result: whole suite green.

### Manual Verification

- Environment: LOCAL browser — NOT RUN.
- Result: NOT RUN (no browser session in this task; the backend endpoints do not exist yet).

## Test Evidence

Test result:
[WeInvoice Notification Bell — Web — Test Result](../../testing/results/weinvoice-notifications-web-test-result-2026-11-12.md)

Final test result:    PASS (automated) · browser NOT RUN · integration NOT RUN

## Result

Bell, panel and data layer implemented to the approved layout; mock mode works stand-alone; api mode matches the contract
request shapes. Status PARTIAL until the browser check and the backend integration run.

## Known Limitations / Follow-up

- Browser check at 375 / 1440 px and in EN / KO.
- Integration test against the backend endpoints once `we-scraping-api` ships them (incl. whether `read` / `read-all`
  answer 204 or an envelope — both are accepted).
- Month filter on the target list (needs an invoice-list query parameter — separate change).

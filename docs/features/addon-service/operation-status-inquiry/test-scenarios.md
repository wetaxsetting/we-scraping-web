# Operation Status Inquiry — Frontend Test Scenarios

No automated frontend tests exist for this page yet (the repo has no component test harness wired). The scenarios below are the manual / future-automated checklist. Run against a local `wecms-api` with `wecms.osmc.*` pointed at a **non-PROD** gateway (or a mock).

## 1. List, filter, sort, paginate
1. Page loads → rows render; total count + pagination reflect `total_count` / `total_pages`.
2. Type in search → after ~300 ms the list refetches with `q`; page resets to 1.
3. Open status dropdown → pick Active/Suspended/Temporarily closed → list filters by the raw Vietnamese substring; page resets.
4. Click a sortable header → cycles default → ASC → DESC → default; rows reorder **server-side** (verify the network request carries `sortField`/`sortDirection`, not a client re-sort).
5. Change page / page-size → refetch; selection cleared on page-size change; rows don't flicker between fetches.
6. Empty result → centered "Operation Status Inquiry Not Found"; loading → "Loading…" only on first load.

## 2. Status display
1. Each `status_cd` renders the correct tone: active = green, suspended = amber, not_registered = grey, with the check glyph + localised label.
2. Switch locale (EN/KO/VI) → status labels + Last Update format change (`formatDateLang`).

## 3. Inquire dialog
1. Open the Inquire CTA → dialog opens; Save disabled; hint visible.
2. Type a Tax ID → input masks (digits only, hyphen after 10th, max 13).
3. Invalid Tax ID + Get Business Info → `WBE_VALIDATION` error dialog; fields stay blank.
4. Valid Tax ID (known DEV code) → name/address/status banner + Last Update populate; Save enables.
5. GDT failure → `WBE_OSMC_LOOKUP_FAILED` / `WBE_OSMC_NO_RESULT` error dialog; fields cleared.
6. Save success → success dialog → list refetches (new row appears) → dialog closes + resets.
7. Save duplicate Tax ID → `WBE_OPERATION_STATUS_DUPLICATE` error dialog; popup stays open.
8. Close / overlay click / ESC → outside-click + ESC are disabled; only Close discards and resets.

## 4. Update (bulk re-poll)
1. No selection → Update re-polls the whole tenant cache → success dialog `operation.update.success` with counts → list refreshes.
2. Select rows via checkboxes → Update targets only those tax codes; selection cleared on full success.
3. Partial failure → `operation.update.partial` with `{updated, total, failed}`; selection retained.
4. Update button disabled while a refresh is in flight (no double-fire).

## 5. Export & Print
1. Excel → downloads an XLSX named `Operation_Status_Inquiry_<DDMMYYYY>`; columns COMPANY/ADDRESS/OPERATION_STATUS/LAST_UPDATE; status column shows the raw Vietnamese string; current filters + sort applied.
2. Print → opens the print popup with the visible columns (no checkbox); status text plain.
3. Both disabled while a download is in flight.

## 6. Selection & pagination interplay
1. Select rows, navigate pages → selection persists across pages.
2. Header checkbox → tri-state (none / some = indeterminate / all-on-page).

## 7. Auth / responsive
1. Expired token mid-action → global 401 interceptor handles re-auth (not a per-page error dialog).
2. Verify layout at 375 / 768 / 1024 / 1440 — table scrolls horizontally below `min-w-[960px]`; filter row wraps; sidebar drawer < lg.

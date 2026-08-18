# view-setting/

**Global cross-cutting feature** — column visibility / order / size persistence per user × screenId.

## Purpose

View Setting is a *shared* feature, not a per-page concern. Per memory `feedback_view_setting_global`, every list / table screen in `wecms-web` consumes the same:

- Shared component (`<ViewSettingDialog />`)
- Shared hook (`useViewSetting(screenId)`)
- Shared REST surface (`view-setting` slug — see `api` _(wecms-api backend repo — not included in this clone)_)
- Per-page registry mapping `screenId` ↔ allowed columns

## What goes here

- The hook contract & cache strategy
- The dialog UX spec
- The per-page registry schema (which `screenId`s exist, which columns each one declares)
- Audit logging notes — writes use the **slug** `view-setting` for `AUDIT_LOGS_INFM.WSVC_ID`

## Column widths — DB `size` via one shared mechanism

Column *width* is part of the same View Setting contract as visibility / order. The width of every configurable column comes from `SYS_SCR_OPTION_WECMS.size` (`WEB_SVC_ID` + `DYM_AREA_ID` + `FIELD_ID`), mirroring legacy JEX's `<col width='SIZE'>` per `USE_YN='Y'` column in `DISP_ORD` order. There is **one** shared implementation — do not hardcode `--w-wb-*` / `w-[Npx]` width tokens for a column that has a DB `size`:

- [`components/shared/view-setting/ViewSettingColgroup.tsx`](../../../components/shared/view-setting/ViewSettingColgroup.tsx) — the single `<colgroup>` element (`items` → `<col style={{ width: size }}>`, plus fixed `leading` / `trailing` cols for checkbox / action slots).
- [`components/shared/view-setting/columnWidth.ts`](../../../components/shared/view-setting/columnWidth.ts) — `parseViewSettingPxSize` / `resolveViewSettingWidth` / `viewSettingMinWidthPx` / `viewSettingMinWidth`.
- [`useViewSettingColumns`](../../../components/shared/view-setting/useViewSettingColumns.ts) — the merge-into-base-columns path (used by `PaymentListTable`), which computes `minWidth` through the same helper.

**Width policy (locked): legacy-parity stretch.** Tables are `w-full table-fixed` + `min-width = Σ visible px sizes`. Wider container → columns stretch (size = proportional basis); narrower → widths lock to DB px + horizontal scroll. Header, body, and the sibling totals footer render the SAME `<ViewSettingColgroup>` from the SAME visible-column list + `min-width`.

**`dym_area_id`.** All refactor seeds use `default` today (no multi-area screens). The mechanism supports multi-area — one `useViewSetting(screenId, areaId)` + one `<ViewSettingColgroup>` per table; use kebab area names, never `table1`.

**Honoring DB `size`:** Approval Box, Account Inquiry (VND/FCY), Transaction History (VND/FCY), Own Account Transfer, Bank Account, all Payment Scheduled/Result batch + detail pages.

**Documented exceptions:**
- **Card Transactions** — fixed 15-col table, not VS-driven for order/visibility (popover + export only); widths stay `--w-wb-ct-*` tokens kept 1:1 with the seed (except the icon-only `MEMO` action column, deliberately 48px). Full adoption is a follow-up bundled with VS-driven body order/visibility.
- **Daily Financial (HS)** — report page; its seed `size` is derived from the static `widthPx`, so the two are equal by construction.
- **Add-on > Operation Status** and **Add-on > Sales/Expenses e-Invoices** — intentionally do NOT use View Setting (no `SYS_SCR_OPTION_WECMS` seed); fixed-column tables. Static width tokens by design.

Full normative rule: workspace [`wecms-web/CLAUDE.md`](../../../CLAUDE.md) §13c.

## What does NOT go here

- Per-table column lists (those belong on the **owning** feature spec under [`../../features/<domain>/<feature>.md`](../../features/), referenced from the registry)
- Tailwind / token usage (lives in workspace CLAUDE.md typography section)

## Related

- Workspace CLAUDE.md — refactor identifier naming (slugs over WSVC ids)
- Feature spec for any list screen that consumes View Setting → cross-link from the per-page registry doc

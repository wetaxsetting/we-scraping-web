# Add-on Service > Operation Status Inquiry — Frontend Summary (Root)

> ⚠️ **This document is a high-level feature summary.**
> The detailed source of truth is the module-folder documentation:
> [`docs/features/addon-service/operation-status-inquiry/`](operation-status-inquiry/README.md)
> (+ the code under `components/addon/operation-status/` and `lib/api/addon.ts`). When this summary and the folder docs/code disagree, the **folder docs and code win**.

**Module:** Add-on Service · **Feature slug:** `operation-status-inquiry`
**Route:** `/addon/operation-status` · **View Setting / export screenId:** `addon-operation-status` (`SCREEN_IDS.ADDON_OPERATION_STATUS`)
**Menu permission code:** `addon-operation-status-inquiry` (see [menu-route-authorization.md](menu-route-authorization.md))
**Status:** ✅ **Completed** — live data, server-side filter/sort/pagination, Inquire dialog (Get Business Info + Save), bulk Update, Excel export, and Print all wired against live endpoints (verified 2026-06-02).
**JEX counterpart (read-only reference):** `aosv_0001_001` (list) · `aosv_0001_002` (inquire popup).

---

## Purpose

`/addon/operation-status` lists every counterparty whose Vietnamese tax-authority operating status has been polled into WeCMS. The finance team spots suspended/ceased counterparties (which invalidate input-VAT credit) and refreshes that status on demand from the GDT.

## Feature overview (all wired)

- **List** — server-side keyword search (`q`), status-dropdown filter (`companyStatus`), header-click sort, pagination.
- **Inquire Operation Status** (primary CTA) — dialog: enter a Tax ID → "Get Business Info" (live GDT lookup, `POST .../inquire`) → review name/address/status → **Save** persists the row (`POST /api/v1/addon/operation-status`).
- **Update** (secondary) — bulk re-poll from the GDT (selected rows or the whole tenant cache) → refresh.
- **Excel** + **Print** toolbar — XLSX export via the shared pipeline; print via shared `printReport`.
- **Row checkboxes** — drive the Update button's selected-subset targeting; selection persists across pages.

## Route / menu / permission mapping

| Concern | Value |
|---|---|
| Route | `/addon/operation-status` |
| Menu permission code | `addon-operation-status-inquiry` |
| Export / View Setting screenId | `addon-operation-status` |
| Components | [`components/addon/operation-status/`](../../../components/addon/operation-status/) — `OperationStatusClient`, `OperationStatusPage`, `OperationStatusActionBar`, `InquireOperationStatusDialog` |
| API client | [`lib/api/addon.ts`](../../../lib/api/addon.ts) — `fetchOperationStatus`, `inquireOperationStatus`, `createOperationStatus`, `updateOperationStatus` |
| Product gating | F + M only (H omits Add-on) |

## Current implementation status

✅ Completed end-to-end, no mock fallback. The Inquire dialog Save persists via the backend `POST /api/v1/addon/operation-status` (create-only; duplicate `(BIZ_KEY, TAXCODE)` surfaces `WBE_OPERATION_STATUS_DUPLICATE`). *(The earlier "Save / Inquire / Update NOT wired" claim is stale — corrected 2026-06-23.)*

## Detailed docs (source of truth)

[operation-status-inquiry/](operation-status-inquiry/README.md) — screen-flow · ui-specification · component-index · api-consumption · test-scenarios. **Backend counterpart:** [`wecms-api/.../operation-status-inquiry/`](../../../../wecms-api/docs/features/addon-service/operation-status-inquiry/README.md).

## Design history

The prior verbose version of this file (Phase-1 read-only notes) is preserved in git history.

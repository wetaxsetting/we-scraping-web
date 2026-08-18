# Operation Status Inquiry — Frontend Feature (wecms-web)

**Module:** Add-on Service
**Feature slug:** `operation-status-inquiry`
**Route:** `/addon/operation-status`
**View Setting screen ID:** `SCREEN_IDS.ADDON_OPERATION_STATUS` = `addon-operation-status`
**Status:** ✅ **Completed** — page renders live data, server-side filter/sort/pagination, Inquire dialog (Get Business Info + Save), bulk Update, Excel export, and Print all wired against live backend endpoints (verified 2026-06-02).

> Consolidated, code-accurate home for the **completed** Operation Status Inquiry frontend. It supersedes the *status claims* in the older [../operation-status-inquiry.md](../operation-status-inquiry.md) spec (which predates the dialog/export/sort wiring). That file is kept as a design-history reference and cross-linked below.

---

## What the page does

`/addon/operation-status` lists every counterparty whose Vietnamese tax-authority operating status has been polled into WeCMS. The finance team uses it to spot suspended/ceased counterparties (which invalidate input-VAT credit on outbound e-invoices) and to refresh that status on demand from the GDT.

Capabilities, all wired:

- **List** — server-side keyword search (`q`), status-dropdown filter (`companyStatus`), header-click sort, and pagination.
- **Inquire Operation Status** (primary CTA) — opens a dialog: enter a Tax ID → "Get Business Info" (live GDT lookup) → review name/address/status → **Save** persists the row.
- **Update** (secondary button) — bulk re-poll from the GDT (selected rows, or the whole tenant cache) and refresh the list.
- **Excel** + **Print** toolbar icons — XLSX export via the shared pipeline, and print via the shared `printReport` helper.
- **Row checkboxes** — drive the Update button's selected-subset targeting; selection persists across pages.

---

## Documents in this folder

| Doc | Focus |
|---|---|
| [screen-flow.md](screen-flow.md) | Page behaviour & user flows: list/filter/sort/paginate, Inquire dialog flow, Update flow, export, print, loading/empty/error. |
| [ui-specification.md](ui-specification.md) | Layout, toolbar, filters, table columns, status display rules, last-update formatting, dialog spec. |
| [component-index.md](component-index.md) | Component files, shared components, hooks, and lib helpers used. |
| [api-consumption.md](api-consumption.md) | Backend endpoints consumed, API-client functions, wire types, mappers, frontend state handling, validation. |
| [test-scenarios.md](test-scenarios.md) | Frontend test scenarios. |

---

## Legacy & Migration Traceability

**JEX counterpart (read-only reference):** `aosv_0001_001` (list) · `aosv_0001_002` (inquire popup)

---

## Related docs (kept in place — cross-references)

- Design-history spec: [../operation-status-inquiry.md](../operation-status-inquiry.md)
- Page mapping (JEX `_view.jsp` → Next.js route): [../../../references/page-mapping/operation-status-inquiry.md](../../../references/page-mapping/operation-status-inquiry.md)
- **Backend counterpart:** [../../../../../wecms-api/docs/features/addon-service/operation-status-inquiry/README.md](../../../../../wecms-api/docs/features/addon-service/operation-status-inquiry/README.md)
  - API contract: [wecms-api/…/interface-specification.md](../../../../../wecms-api/docs/features/addon-service/operation-status-inquiry/interface-specification.md)

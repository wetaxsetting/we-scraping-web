# Settings > Firm Banking History — Frontend Feature (Refactor)

**Status:** ✅ Wired to the live backend (no mock fallback) — legacy parity verified 2026-06-05.
**Menu:** Settings → Firm Banking → **Firm Banking History** (Settings modal panel — **no standalone route**)
**Slug:** `firm-banking-history` (matches the JEX + backend counterparts)
**Panel key:** `firm_banking_history` · **Permission:** `settings-firm-banking-history`
**Backend:** `GET /api/v1/settings/firm-banking-history` (+ `POST .../export`)

> This folder is the **primary frontend documentation home** for Firm Banking History. It
> consolidates and indexes the material previously in the single-file
> [../firm-banking-history.md](../firm-banking-history.md) (preserved, cross-linked). The matching
> backend docs are at
> [wecms-api/docs/features/settings/firm-banking-history/](../../../../../wecms-api/docs/features/settings/firm-banking-history/README.md).

---

## What this screen is

A read-only, filterable log of every outbound firm-banking integration call for the current tenant
(Korean firm-banking gateway, NAPAS scraping transfers, generic scraping balance/transaction/card,
Vietnam GDT e-Invoice inquiries, Vietnam business inquiries) — surfaced as one grid with date-range
+ service-type + keyword filters, sortable columns, server-side pagination, a per-row **View
Details** popover, and an **Excel export**.

It renders as a **panel inside `<SettingsModal>`** (mounted via `<SettingsNav>`, "Firm Banking"
group) — there is no `/settings/firm-banking-history` URL. This matches the approved **Settings >
Purpose modal** baseline.

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Open → default range → fetch → grid → sort/paginate/filter → detail popover → export |
| [ui-specification.md](ui-specification.md) | Filters, grid columns + formatting, detail popover, status/result mapping, loading/empty/error states |
| [component-index.md](component-index.md) | Component / hook / API-client / type / i18n file map |
| [api-consumption.md](api-consumption.md) | Endpoint, request params, wire types, mappers, error handling |
| [test-scenarios.md](test-scenarios.md) | SIT/UAT scenarios (filters, detail, export, permissions, error) |

---

## Quick facts

| Aspect | Value |
|---|---|
| Panel | [`<FirmBankingHistoryPanel>`](../../../../components/settings/firm-banking-history/FirmBankingHistoryPanel.tsx) |
| Mount | [`SettingsModal.tsx`](../../../../components/settings/SettingsModal.tsx) (`panel === "firm_banking_history"`) + [`SettingsNav.tsx`](../../../../components/settings/SettingsNav.tsx) |
| Default date range | last 30 days |
| Default page size | 10 (frontend canonical; backend default is 15) |
| Keyword debounce | 300 ms |
| Service types | F (Firm Banking) · S (Scraping) · G (GDT e-Invoice) · B (Business Inquiry) — G/B hidden for product type `H` |
| Sortable columns | `TARN_DTM`, `SVC_TYPE`, `SVC_NM`, `SEQ_NO`, `DEP_BANK_CD`, `RSLT_CD` |
| Detail view | client-side popover (388 px); no extra HTTP call |
| Excel export | shared `useExcelExport` → `POST .../export` |
| Wire convention | lowercase snake_case → camelCase mappers |

---

## Related docs

- **Backend feature folder:** [wecms-api/docs/features/settings/firm-banking-history/](../../../../../wecms-api/docs/features/settings/firm-banking-history/README.md)
- **Preserved single-file spec:** [../firm-banking-history.md](../firm-banking-history.md)
- **JEX legacy spec set (read-only):** [docs/jex/features/firm-banking-history/](../../../../../docs/jex/features/firm-banking-history/README.md)
- **Page mapping:** [references/page-mapping/page-mapping.md](../../../references/page-mapping/page-mapping.md)
- **Settings feature index:** [../README.md](../README.md)

# Add-on Service > Tax Filing (VAT Declaration) — Frontend Feature (wecms-web)

**Status:** ✅ **CURRENT — implemented and wired to live endpoints.** Shipped from branch
`f1_v1_vat_declaration`, merged to `sit` through 2026-08-12.
**Module:** Add-on Service · **Feature slug:** `tax-filing`
**Route:** `/addon/tax-filing` · **Menu permission code:** `addon-vat-declaration`
**Sidebar:** group `addon-vat-declaration` (`sidebar.addon.reportsTax`) → item `addon-tax-filing`
(`sidebar.addon.taxFiling`)
**View Setting screenId:** *none* — the list is not View-Setting-driven. The annex export uses a
dedicated export-only id, `addon-vat-declaration-annex`, which is **deliberately not seeded** in
`SYS_SCR_OPTION_WECMS`.
**Docs authored:** 2026-08-17, from source only.

> **Scope of these docs.** Everything here was read out of current `wecms-web` source. This is a
> **frontend** description: it documents which endpoints the UI calls and how it consumes the
> responses. It does **not** document backend implementation — no SQL, no entities, no server-side
> rules. Where the frontend cannot prove a backend behaviour, that is stated explicitly rather than
> guessed.

---

## What the screen is

Vietnamese **VAT declaration** (Tờ khai thuế GTGT), statutory form **01/GTGT** under Circular 80
(TT80), plus its annexes. The user creates a declaration for a filing period, fills or reviews the
indicator grid, reviews the invoice annexes, then locks it and exports it for filing.

Two surfaces, one route:

1. **Dashboard list** ([`TaxFilingPage`](../../../../components/addon/tax-filing/TaxFilingPage.tsx)) —
   one row per declaration, with year / status / keyword filters and per-row actions.
2. **Full-screen declaration form**
   ([`VatDeclarationFormPage`](../../../../components/addon/tax-filing/VatDeclarationFormPage.tsx)) —
   a fixed overlay (`fixed inset-0 z-[60]`), **not a separate route**. Opened from the list; closing
   returns to the list. The URL stays `/addon/tax-filing` throughout.

## Doc set

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Navigation, list → form, create flow, lock / unlock / delete lifecycle |
| [ui-specification.md](ui-specification.md) | List columns, filters, form tabs, indicator grid, dialogs, tokens |
| [component-index.md](component-index.md) | Every file in `components/addon/tax-filing/` + the shared/lib modules it consumes |
| [api-consumption.md](api-consumption.md) | The 11 endpoints called, request/response shapes, error codes, export contracts |
| [test-scenarios.md](test-scenarios.md) | Existing automated coverage + manual scenarios |

## Status lifecycle

Two states are reachable from the frontend. `TaxFilingStatus` in
[`types.ts`](../../../../components/addon/tax-filing/types.ts) also declares `submitted` and
`cancelled`, but **no frontend code produces or transitions to them** — treat them as reserved.

```
        create                lock (PUT …/lock)
   ─────────────►  DRAFT  ──────────────────────►  CONFIRMED
                     │                                  │
                     │ delete (DELETE …)                │ unlock (DELETE …/lock)
                     ▼                                  │
                  (removed)  ◄────────────────────────  ┘
```

- **Draft** — editable. `Save Draft`, `Sync`, `Delete`, and per-cell editing are available.
- **Confirmed (locked)** — read-only. XML export requires it; `Sync` and `Delete` are rejected
  server-side (`WBE_VAT_DECL_LOCKED`).
- **Lock is not exposed on the dashboard** — a product decision recorded in
  [`useTaxFilingActions.ts`](../../../../components/addon/tax-filing/useTaxFilingActions.ts)
  (2026-08-04). Locking happens inside the form, because it must save the draft first.
- Ordering is enforced **by the backend**, surfaced by the frontend as mapped messages: a period
  cannot lock while the previous period is missing or still Draft, and cannot unlock while a later
  period is locked. See [api-consumption.md § Error codes](api-consumption.md#error-codes).

## Exports — five, and where each is produced

This feature is the project's main exception to the "backend produces every file" rule in
[CLAUDE.md §13b](../../../../CLAUDE.md); the deviation is documented at each call site.

| Export | Produced | Source |
|---|---|---|
| Declaration **XLSX** (01/GTGT) | **Browser** — patches the authority's own workbook `public/templates/vat-declaration-01-gtgt.xlsx` | [`declarationExcel.ts`](../../../../components/addon/tax-filing/declarationExcel.ts) |
| Declaration **PDF** | **Browser** — same patched sheet, rendered to HTML and printed via `printHtmlDocument` | [`declarationPdf.ts`](../../../../components/addon/tax-filing/declarationPdf.ts) |
| Invoice listing **XLSX** (BKBR / BKMV, form 01-1/GTGT) | **Browser** — template `vat-invoice-listing-01-1-gtgt.xlsx` | [`invoiceListingExcel.ts`](../../../../components/addon/tax-filing/invoiceListingExcel.ts) |
| PL reduce-8% **XLSX** | **Browser** — template `vat-declaration-tt80-workbook.xlsx` | [`plReduce8Excel.ts`](../../../../components/addon/tax-filing/plReduce8Excel.ts) |
| HTKK **XML** | **Backend** — `GET …/export/xml`, binary, locked-only | [`lib/api/addon.ts`](../../../../lib/api/addon.ts) |

**The server-side PDF endpoint exists but is deliberately disabled on the caller side.** The call in
`VatDeclarationFormPage` is commented out; the source states why — it renders from stored figures so
it cannot show unsaved edits, and it accepts only a locked declaration. Re-enabling it is a backend
correction, not a frontend one.

## Known gaps, as stated by source

- **`POST …/sync` is not implemented server-side** (backend Phase 2, per the doc-comment in
  `lib/api/addon.ts`). The button exists and calls it; until the backend lands, the call fails and
  the frontend surfaces the error.
- **`GET …/export/pdf`** — implemented server-side but intentionally not called (above).
- Source comments reference a `docs/testing/features/vat-declaration.md` (items `BE-6`, `BE-9`) and a
  `VAT_Declaration_FunctionalSpec`. **Neither is present in this repository**; both are presumably
  backend- or workspace-side. Their §-numbers are reproduced here only as citations.

## Related

- Module index: [../README.md](../README.md)
- Authorization model for the Add-on menu: [../menu-route-authorization.md](../menu-route-authorization.md)
- Backend counterpart: maintained in the separate `wecms-api` repository (not part of this clone).

# Tax Filing — API Consumption

How the frontend calls the VAT declaration endpoints. **Frontend consumption only** — server-side
behaviour is described solely where the frontend's own code documents it.

All wrappers live in [`lib/api/addon.ts`](../../../../lib/api/addon.ts). JSON endpoints go through
the shared `api` Axios instance (JWT interceptor) and unwrap the `ApiResponse<T>` envelope; binary
endpoints bypass the envelope per [CLAUDE.md §"Binary download/export"](../../../../CLAUDE.md).

## 1. Endpoint inventory

Base path `/api/v1/addon/vat-declarations`.

| # | Method + path | Wrapper | Consumed by |
|---|---|---|---|
| 1 | `GET /` | `fetchVatDeclarations({ year, status, keyword, page, size })` | `TaxFilingPage` list |
| 2 | `POST /` | `createVatDeclaration({ …, annex_*_yn })` | `NewVatDeclarationDialog` |
| 3 | `GET /{declId}` | `fetchVatDeclarationDetail(declId)` | `VatDeclarationFormPage` |
| 4 | `PUT /{sid}` | `saveDraftVatDeclaration(sid, body)` | `DeclarationTab` Save Draft |
| 5 | `DELETE /{sid}` | `deleteVatDeclaration(sid)` | row Delete — Draft only |
| 6 | `PUT /{sid}/lock` | `lockVatDeclaration(sid)` | form Lock — Draft → Confirmed |
| 7 | `DELETE /{sid}/lock` | `unlockVatDeclaration(sid)` | row Unlock — Confirmed → Draft |
| 8 | `POST /{sid}/sync` | `syncVatDeclaration(sid)` | form Sync — **backend not implemented yet** |
| 9 | `GET /{sid}/annex/invoices` | `fetchAnnexLines(sid, …)` · `fetchAnnexInvoices(sid, …)` | BKBR / BKMV / PL-reduce8 tabs |
| 10 | `GET /{sid}/export/xml` | `exportVatDeclarationXml(sid, fileName)` | Export ▾ → XML |
| 11 | `POST /{sid}/annex/export` | `exportVatDeclarationAnnexExcel(sid, …)` | server-side annex XLSX |
| — | `GET /{sid}/export/pdf` | `exportVatDeclarationPdf(sid, fileName)` | **wrapper exists; call site is commented out** (§5) |

## 2. List — request and consumption

```ts
fetchVatDeclarations({
  year,      // number — from the year dropdown
  status,    // "C" | "D" | undefined  ("all" omits the param)
  keyword,   // omitted when blank
  page,      // zero-based
  size,
})
```

All five are in the `useApiData` dep array alongside `refreshKey`, so every filter change and every
mutation refires the fetch. **Filtering and paging are server-side**; there is no client-side
post-filter.

Response `ApiVatDeclarationListResponse` → `{ rows, total_count }`. Rows map through
`toTaxFilingRow()` (snake_case wire → camelCase `TaxFilingRow`): `sid → declId`, `period_label →
filingPeriod`, `tax_amount → taxPayable`, `prev_credit → prevPeriodCredit`, `carried_forward →
carriedForward`, plus `period_type`, `period_value`, `decl_year`, `suppl_no`, `decl_type`,
`decl_type_name`, `applicable_circular`, `etax_code`, `mod_dtm`. Numeric fields are `Number(...)`-cast
with a `0` fallback.

`filingPeriod` is then **re-derived** by `formatVatPeriod()` because the wire `period_label` does not
distinguish a month from a quarter.

## 3. Detail

`ApiVatDeclarationDetail` carries: identity (`sid`, `period_type`, `period_value`, `decl_year`,
`period_label`, `suppl_no`, `decl_type`, `status`), taxpayer (`tp_name`, `tp_tax_code`,
`activity_code`, `activity_name`), dates (`from_dt`, `to_dt`, `decl_dt`), the `indicators` object,
the five annex flags (`annex_bkbr_yn`, `annex_bkmv_yn`, `annex_alloc_yn`, `annex_alloc_tele_yn`,
`annex_reduce8_yn`), and the tax-agent / dependent-unit block (`agent_nm`, `agent_tax_code`,
`agent_ctr_no`, `agent_ctr_dt`, `du_nm`, `du_tax_code`, `du_addr`, `du_prov`, `du_dist`, `du_ward`).

The agent / dependent-unit fields are a **round-trip of what Save Draft accepts**, so reopening a
declaration re-populates the form.

`indicators` is `ApiVatDeclarationIndicators`, keyed `ct21 … ct43`. The grid reads them as
`indicators[schema.ctLeft]` / `indicators[schema.ctRight]`.

## 4. Annex invoices

`GET /{sid}/annex/invoices` is **server-paginated**. `AnnexInvoicePage` returns `rows`, `total_count`,
`total_pages`, `page_number` (0-based), `page_size`, `tax_groups`, and `grand_total`.

`AnnexTaxGroup` carries `groupCd` (`"KKKNT" | "8%" | "10%" | "KCT" | "TOTAL"`), `taxRateLabel`
(null on TOTAL), `rowCount`, `totalSplyAmt`, `totalReducedAmt`, `totalVatAmt` — **computed over the
whole filtered set**, which is what lets a group straddling two pages show its full subtotal.

`AnnexInvoiceRow.handRegYn` marks hand-entered lines. Per the `sync` doc-comment, those survive a
re-sync while invoice-sourced lines are regenerated.

## 5. Export contracts

### Browser-generated (no endpoint)

Declaration XLSX, declaration PDF, invoice-listing XLSX, and PL-reduce8 XLSX are all produced
**client-side** by patching an authority workbook under `public/templates/`. Deliberate deviation
from [CLAUDE.md §13b](../../../../CLAUDE.md), documented at each call site: the filed document must
be the authority's own workbook, byte-for-byte, and must reflect **unsaved** edits.

### `GET /{sid}/export/xml` — backend, binary

`application/xml` + `Content-Disposition`, no envelope, consumed via `downloadFile()`.
**Locked declarations only** — a Draft returns `WBE_VAT_DECL_NOT_LOCKED`, surfaced as
`tax_filing.export.not_locked`. On a business error the server *does* answer with the JSON envelope;
`downloadFile` sniffs that and throws `ApiCallError`.

### `GET /{sid}/export/pdf` — exists, deliberately not called

The wrapper is implemented, and the server names the file `[MST]-01_GTGT_TT80-[period].pdf`. The call
site in `VatDeclarationFormPage` is **commented out**, with the reason in source: it renders
server-side from stored figures, so it cannot show unsaved edits, and it accepts only a locked
declaration. Re-enabling is a backend correction.

### `POST /{sid}/annex/export` — backend XLSX, explicit column list

Goes through the shared `exportExcel()` helper but **not** through `hooks/useExcelExport`: that hook
derives its columns from the screen's View Setting items, and this screen is export-only with no
`SYS_SCR_OPTION_WECMS` seed. Callers pass an explicit column list instead — the provider's allow-list
is the contract. Screen id `ANNEX_EXPORT_SCREEN_ID = "addon-vat-declaration-annex"`. `sid` travels in
the path; the server injects `filters.decl_id` itself.

## 6. Error codes

`VAT_DECL_ERROR_KEYS` in
[`vatDeclErrors.ts`](../../../../components/addon/tax-filing/vatDeclErrors.ts). Source records that
every code was **observed from the live backend on 2026-08-04**, not inferred — an earlier guessed
code (`WBE_VAT_PREV_PERIOD_NOT_LOCKED`) never matched anything and leaked a raw server string to the
user. **Trigger a new code against the API before adding it.**

| Code | i18n key | Meaning (as documented in source) |
|---|---|---|
| `WBE_VAT_DECL_PREV_NOT_LOCKED` | `tax_filing.error.prev_period_not_locked` | Preceding period exists but is still Draft |
| `WBE_VAT_DECL_PREV_MISSING` | `tax_filing.error.prev_period_missing` | No declaration at all for the preceding period — enforced across the year boundary (locking 01/2026 needs 12/2025) |
| `WBE_VAT_DECL_NEXT_LOCKED` | `tax_filing.error.next_period_locked` | A later period is still locked, pinning this one |
| `WBE_VAT_DECL_DUPLICATE_PERIOD` | `tax_filing.error.duplicate_period` | One declaration per (year, period type, period value) |
| `WBE_VAT_DECL_LOCKED` | `tax_filing.error.decl_locked` | Locked declaration rejects edit / sync / delete |
| `WBE_VAT_DECL_NOT_FOUND` | `tax_filing.error.decl_not_found` | — |
| `WBE_VAT_DECL_NOT_LOCKED` | `tax_filing.export.not_locked` | XML/PDF export requires a locked declaration |
| `WBE_VALIDATION` | *(client-raised)* | Client-side validation — never from the server |

`vatDeclErrorMessage(err, t)` resolves: mapped key → server's own `message` → `common.error_unknown`.
So an unmapped code still says something specific instead of a generic string.

## 7. What this document does **not** assert

- **No backend implementation detail** — no tables, no SQL, no server-side validation order. The
  ordering rules above are inferred *only* from the error codes the frontend maps.
- **`POST /{sid}/sync` server behaviour is unverified.** The wrapper's doc-comment states it is
  "not implemented server-side yet (backend Phase 2)"; the described re-derivation semantics
  (regenerate `HAND_REG_YN = 'N'` lines, keep hand-entered ones) are the *intended* contract as
  written in the frontend, not something this repository can prove.
- Source comments cite `docs/testing/features/vat-declaration.md` (`BE-6`, `BE-9`) and
  `VAT_Declaration_FunctionalSpec` (§3, §7.1, §8.3, §8.4, §8.5, §9, §11.2). **Neither document exists
  in this repository.** They are reproduced as citations only.

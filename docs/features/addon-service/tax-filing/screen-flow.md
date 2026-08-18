# Tax Filing — Screen Flow

Navigation and state flow for `/addon/tax-filing`. Source-verified 2026-08-17.

## 1. Entry

```
Top nav "Add-on Service"  →  sidebar group "Reports/Tax" (sidebar.addon.reportsTax)
                              →  item "Tax Filing" (sidebar.addon.taxFiling)
                                  →  /addon/tax-filing
```

Route guard: [`lib/menuAuth.ts`](../../../../lib/menuAuth.ts) maps prefix `/addon/tax-filing` to
permission code `addon-vat-declaration`. The sidebar entry itself is rendered from the backend
navigation tree via `useNavigation()`; the frontend does not reconstruct visibility. The route page
[`app/(dashboard)/addon/tax-filing/page.tsx`](../../../../app/(dashboard)/addon/tax-filing/page.tsx)
is thin — it sets `metadata.title = "Tax Filing"` and renders `<TaxFilingPage />`.

## 2. Dashboard list

`TaxFilingPage` is a standard paginated list page: `<PageLayout>` → header → filter row →
`<DataTableShell>` → `<Pagination>`.

**Filters** (all server-side — every one is in the `useApiData` dep array, so changing it refires the
fetch):

| Control | State | Wire param |
|---|---|---|
| Year dropdown | `yearFilter`, default `"2026"` | `year` (number) |
| Status dropdown — All / Confirmed / Draft | `statusFilter` | `status` — `undefined` / `"C"` / `"D"` |
| Keyword search | `keyword` | `keyword` (omitted when blank) |
| Page / size | `useServerPagination()` | `page` (0-based), `size` |

A `refreshKey` counter is also in the deps; every mutation bumps it to reload the list. After a load,
`pg.clampToTotal(total_count)` runs so deleting the last row of the last page does not strand the
user on an out-of-range empty page.

**Period label is derived on the frontend.** The API's `period_label` does not distinguish a month
from a quarter, so `formatVatPeriod(t, row, row.filingPeriod)` from
[`lib/vat/periodLabel.ts`](../../../../lib/vat/periodLabel.ts) re-derives it once, before anything
consumes it — so the table and every confirmation dialog name the period identically.

## 3. Create a declaration

```
"+ New Declaration"  →  <NewVatDeclarationDialog>
                          ├─ Monthly | Quarterly tab
                          ├─ Year + Month/Quarter
                          ├─ Industry / activity code
                          ├─ Annex checkboxes (BKBR, BKMV, PL 43/2022 reduce-8%)
                          └─ "Load Group 4" toggle
                        │
                     [Next]  →  POST /api/v1/addon/vat-declarations
                        │           (annex_*_yn flags travel in the body)
                        ▼
              handleNext(selectedAnnexes, declId)
                        │
                        ├─ setCheckedAnnexes(selected)   ← pre-load tab fallback
                        ├─ setActiveDeclId(declId)
                        └─ setFormPageOpen(true)          ← opens the form overlay
```

`Close` dismisses without creating. Duplicate periods are rejected by the backend
(`WBE_VAT_DECL_DUPLICATE_PERIOD`) and surfaced as a localized error dialog.

## 4. Declaration form (overlay, not a route)

`VatDeclarationFormPage` renders as `fixed inset-0 z-[60] flex flex-col bg-white` — a full-screen
overlay above the dashboard. **There is no `/addon/tax-filing/[id]` route.** Consequences worth
knowing: the form is not deep-linkable, browser Back does not close it, and a reload returns to the
list.

It loads its own data: `useApiData(() => fetchVatDeclarationDetail(declId), [declId, fetchKey])`.

### Tab strip — driven by the declaration's own annex flags

`Declaration` is always first. Annex tabs render only when the loaded detail says so, in this fixed
order:

| Tab id | Flag on detail | Label key |
|---|---|---|
| `declaration` | *(always)* | `tax_filing.form.tab_declaration` |
| `bkbr` | `annex_bkbr_yn === "Y"` | `tax_filing.form.tab_bkbr` |
| `bkmv` | `annex_bkmv_yn === "Y"` | `tax_filing.form.tab_bkmv` |
| `pl_cssx` | `annex_alloc_yn === "Y"` | `tax_filing.form.tab_pl_cssx` |
| `pl_vt` | `annex_alloc_tele_yn === "Y"` | `tax_filing.form.tab_pl_vt` |
| `pl_142` | `annex_reduce8_yn === "Y"` | `tax_filing.form.tab_pl_142` |

Before the detail lands, the `checkedAnnexes` set passed from the create dialog is used as a
fallback so the strip does not flicker. If the active tab disappears (flags changed), the form falls
back to `declaration`.

### Actions in the form

| Action | Guard | Call |
|---|---|---|
| **Save Draft** | validates first (§5) | `PUT …/{sid}` |
| **Sync** | Draft only (`isDraft`) | `POST …/{sid}/sync` — **not implemented server-side yet**; the call currently fails and the error is surfaced |
| **Lock** | saves the draft first | `PUT …/{sid}/lock` |
| **Export ▾** | per active tab (§6) | browser-generated, or `GET …/export/xml` |
| **Close** | — | returns to the list |

## 5. Client-side validation (Save Draft / Lock)

Blocks the call and opens a `type: "error"` dialog with `errorCode: "WBE_VALIDATION"`:

- **Negative indicator cell** → `tax_filing.form.error_negative_cell` (interpolates the cell `code`)
- **Non-integer indicator cell** → `tax_filing.form.error_not_integer_cell`
- **Malformed tax-agent code** → `tax_filing.form.error_agent_tax_code`. Rule in
  [`agentTaxCode.ts`](../../../../components/addon/tax-filing/agentTaxCode.ts): blank is valid;
  otherwise exactly 10 or 13 digits (13 = 10-digit parent + 3-digit branch). Lengths in between are
  always a typo.

## 6. Export flow — the active tab decides

`Export ▾` acts on whatever tab is on screen:

| Active tab | Excel | PDF |
|---|---|---|
| `declaration` | `exportDeclarationExcel()` — 01/GTGT workbook | `exportDeclarationPdf()` |
| `pl_142` | `exportPlReduce8Excel()` | — |
| `bkbr` / `bkmv` | `exportInvoiceListingExcel({ kind })` — form 01-1/GTGT | — |
| `pl_cssx` / `pl_vt` | none → warns `tax_filing.export.select_annex_tab` | — |

PDF outside the Declaration tab warns `tax_filing.export.pdf_declaration_only`.
**XML** is separate and backend-produced: locked declarations only — a Draft yields
`WBE_VAT_DECL_NOT_LOCKED`, surfaced as `tax_filing.export.not_locked`.

## 7. Row actions (dashboard)

Per-row kebab → [`TaxFilingDropdown`](../../../../components/addon/tax-filing/TaxFilingDropdown.tsx):

| Action | Behaviour |
|---|---|
| **Edit** | opens the form overlay for that row |
| **Unlock** | confirm → `DELETE …/{sid}/lock` → refresh → success dialog |
| **Delete** | confirm (**destructive / red CTA**) → `DELETE …/{sid}` → refresh → success dialog |
| **Supplemental** | label `tax_filing.action.supplemental` is rendered; **no handler is wired in current source** — treat as not implemented |

Unlock and Delete share one shape in
[`useTaxFilingActions.ts`](../../../../components/addon/tax-filing/useTaxFilingActions.ts) —
confirm → call → refresh → report — so their chrome and their error mapping cannot drift. The
refresh re-fetches the list; mutation responses are deliberately **not** treated as authoritative
here. Delete is the only red CTA in the module, because it is irreversible on a Draft.

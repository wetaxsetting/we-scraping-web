# Transfer History — Frontend (wecms-web)

> **Module:** Banking › Internal Transfer › Transfer History
> **Route:** `/banking/transfer-history`
> **Refactor slug:** `transfer-history`
> **Legacy JEX:** `trns_0003_001`
> **Status:** ✅ **Implemented — live API, no mock fallback** (landed 2026-05-20)
> **System:** Refactor (Next.js 16 App Router)

This folder is the **primary frontend documentation home** for Transfer History. It supersedes the older page-design note at [`../own-account-transfer/transfer-history.md`](legacy-spec.md) (misfiled under the Own Account Transfer folder), which is preserved and cross-linked, not deleted.

---

## 1. What the page is

A **read-only list page** of NAPAS transfer-history transactions. The user picks a date range and a status (All / Success / Failed) and sees a paged, sortable grid with a VND totals footer. Wired directly to the live backend — there is **no mock data**.

### What the page is NOT (scope boundary)

The page renders **no toolbar** and has **none** of the following — by design (legacy `trns_0003_001` parity):

- ❌ No vendor / expense **matching** dialog, no match/unmatch buttons
- ❌ No match **candidate** grid or candidate search
- ❌ No **detail** view / detail route (`[id]`)
- ❌ No **export** (Excel) button, no **print**
- ❌ No **View Setting** popover / list-view icon (OQ-5)
- ❌ No write actions, no audit-log writes

Vendor/expense matching is a **different feature** (Banking › Transaction History matching / Smart Organizer). See [api-consumption.md](api-consumption.md) §"Out of scope" and the backend [refactor-gap-analysis.md](../../../../../../wecms-api/docs/features/banking/internal-transfer-vnd/transfer-history/refactor-gap-analysis.md).

---

## 2. Documentation map (this folder)

| File | Contents |
|---|---|
| [README.md](README.md) | This overview + scope boundary |
| [screen-flow.md](screen-flow.md) | User flow, states (loading/empty/error), filter→fetch→render |
| [ui-specification.md](ui-specification.md) | Layout, columns, filters, footer, status display, tokens |
| [component-index.md](component-index.md) | Every page/component/hook/type file with paths |
| [api-consumption.md](api-consumption.md) | Endpoint, params, wire types, mappers, error handling |
| [test-scenarios.md](test-scenarios.md) | SIT/UAT scenarios |

---

## 3. Cross-links (preserved)

| Doc | Path |
|---|---|
| Backend feature docs (hub) | [../../../../../wecms-api/docs/features/banking/internal-transfer-vnd/transfer-history/README.md](../../../../../../wecms-api/docs/features/banking/internal-transfer-vnd/transfer-history/README.md) |
| Legacy JEX feature package | `docs/jex/features/transfer-history/` |
| Existing frontend page-design note | [../own-account-transfer/transfer-history.md](legacy-spec.md) |
| Page-mapping inventory | [../../../references/page-mapping/page-mapping.md](../../../../references/page-mapping/page-mapping.md) |

---

## 4. Key facts

- **Route:** `app/(dashboard)/banking/transfer-history/page.tsx` → `<TransferHistoryClient />`.
- **Endpoint:** `GET /api/v1/banking/internal-transfer/transfer-history` (spec-aligned path; `lib/api/banking.ts → fetchTransferHistory`).
- **Columns:** Date/Time · From Bank · To Bank · Transfer Amount · Remarks · Results (6).
- **Filters:** interactive date range (default last 7 days) + status radios (All/Success/Failed).
- **Sort:** shared `useTableSort()` (DB-side); 5 of 6 columns sortable, Results inert.
- **Pagination:** shared `<Pagination>`, `paginationWithTotals`; default size 10; VND totals footer; count reflects full filter scope.
- **i18n:** `transfer_history.*` keys in `en.json` / `ko.json` / `vi.json`.

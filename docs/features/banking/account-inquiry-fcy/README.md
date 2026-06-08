# Banking > Account Inquiry (FCY) — Refactor Frontend Feature Hub

**Module:** Banking → Current & Savings (FCY)
**Route:** `/banking/account-inquiry-fcy`
**Screen ID (View Setting `screenId`):** `banking-account-inquiry-fcy` (`SCREEN_IDS.ACCOUNT_INQUIRY_FCY`)
**JEX counterpart:** `fnsh_0005_001` (foreign-currency account list, reuses the VND helper with `CcyCd.USD`)
**Backend counterpart:** [wecms-api/docs/features/banking/account-inquiry-fcy/](../../../../../wecms-api/docs/features/banking/account-inquiry-fcy/README.md)

> **Status — Refactor complete (full-stack).** The page is wired to the live backend (no mock fallback):
> server-side list + filter + **currency dropdown** + sort + pagination, real-time Update/Sync (with
> OTP/CAPTCHA/QnA challenge handling), balance-click transaction popup, per-currency summary tiles, View
> Setting, and XLSX export are all implemented. Legacy parity verified; SIT/UAT completed (read path).
> This folder is the **primary frontend documentation home**; the older single-file spec at
> [current-savings-fcy/account-inquiry.md](../current-savings-fcy/account-inquiry.md) is preserved and
> cross-linked.

Account Inquiry (FCY) is a **prop-variant of the approved Account Inquiry (VND) baseline** — same shell
(`AccountInquiryPage`), same client wrapper (`AccountInquiryClient`), differing only by `currency="FCY"`,
`multiCurrencyMode`, FCY i18n keys, and the FCY View-Setting screenId. Fix the shared shell once → both
VND and FCY benefit.

---

## Document map (this folder)

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | User journeys + interaction flows (load, filter, currency switch, sort, paginate, update/sync, balance popup, export). |
| [ui-specification.md](ui-specification.md) | Layout, currency filter, table columns, per-CCY tiles, formatting, loading/empty/error states, last-update + status rendering. |
| [component-index.md](component-index.md) | Route, client wrapper, shared shell, dialogs, filters, hooks, API client, types — file-by-file. |
| [api-consumption.md](api-consumption.md) | Endpoints consumed, request params, response shapes, wire → in-memory mapping, currency wire derivation. |
| [test-scenarios.md](test-scenarios.md) | Frontend SIT/UAT scenarios. |

## Companion references (preserved — cross-linked)

| Doc | Location |
|---|---|
| Original frontend page design | [current-savings-fcy/account-inquiry.md](../current-savings-fcy/account-inquiry.md) |
| VND twin (shared shell, UI baseline) | [account-inquiry-vnd/](../account-inquiry-vnd/README.md) |
| Page mapping (JEX `_view.jsp` → route) | [references/page-mapping/page-mapping.md](../../../references/page-mapping/page-mapping.md) |
| Backend feature hub | [wecms-api/docs/features/banking/account-inquiry-fcy/](../../../../../wecms-api/docs/features/banking/account-inquiry-fcy/README.md) |
| Backend interface spec (endpoints) | [wecms-api/docs/features/banking/account-inquiry-fcy/interface-specification.md](../../../../../wecms-api/docs/features/banking/account-inquiry-fcy/interface-specification.md) |
| Parity audit (2026-06-06) | [wecms-api/docs/audits/account-inquiry-fcy-parity-audit.md](../../../../../wecms-api/docs/audits/account-inquiry-fcy-parity-audit.md) |
| Legacy investigation package (`fnsh_0005_001`) | [docs/features/account-inquiry-fcy/](../../../../../docs/features/account-inquiry-fcy/README.md) |

---

## Quick facts

- **Route file:** `app/(dashboard)/banking/account-inquiry-fcy/page.tsx` → `<AccountInquiryFcyClient />`
  → `<AccountInquiryClient currency="FCY" multiCurrencyMode />` → shared
  `components/shared/AccountInquiryPage.tsx`.
- **API:** `GET /api/v1/banking/accounts?currency=FCY` (list) · `POST .../transactions-sync` (+ challenge
  resume) · `GET .../{acctSeqNo}/transactions` (balance popup) · `POST .../accounts/export` (XLSX).
- **Currency filter:** in-page dropdown (`CurrencyFilterPopover`) — "All Currency" (`currency=FCY`) or a
  concrete CCY (`USD`/`KRW`/`EUR`/…); options cached from the first "All Currency" response.
- **Per-currency totals:** one `SummaryTile` per `totals_by_ccy` entry.
- **Pagination:** server-side (`serverPaging` controlled mode); page 0-based on the wire, 1-based in the UI.
- **Sort:** shared `useTableSort()` → DB-side ORDER BY.
- **View Setting:** shared `useViewSetting(SCREEN_IDS.ACCOUNT_INQUIRY_FCY, DEFAULT_AREA_ID)`.
- **Export:** shared `useExcelExport()` → backend XLSX (per-CCY subheader; no client-side CSV).
- **FCY-A01:** multi-currency FCY is an **approved deviation** (PO: Mr. Jung, 2026-06-06) — see backend
  [refactor-gap-analysis.md](../../../../../wecms-api/docs/features/banking/account-inquiry-fcy/refactor-gap-analysis.md).

## Migration status

```
Refactor Status: 100% Complete   (FCY screen — list, currency dropdown, per-CCY tiles, sort,
                                  pagination, update/sync, balance popup, View Setting, XLSX export)
```

See the backend
[refactor-gap-analysis.md](../../../../../wecms-api/docs/features/banking/account-inquiry-fcy/refactor-gap-analysis.md)
for the line-by-line parity table. Open frontend-side items are all OPEN/deferred (FCY-A05 >72h
stale-red, FCY-A06 client role gate, FCY-A08 date-change refetch) and do not block the feature.

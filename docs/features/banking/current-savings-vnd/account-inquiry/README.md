# Banking > Account Inquiry (VND) — Refactor Frontend Feature Hub

**Module:** Banking → Current & Savings (VND)
**Route:** `/banking/account-inquiry`
**Screen ID (View Setting `screenId`):** `banking-account-inquiry-vnd` (`SCREEN_IDS.ACCOUNT_INQUIRY_VND`)
**JEX counterpart:** `fnsh_0001_001` — [docs/jex/features/account-inquiry-vnd/](../../../../../../docs/jex/features/account-inquiry-vnd/README.md)
**Backend counterpart:** [wecms-api/docs/features/banking/current-savings-vnd/account-inquiry/](../../../../../../wecms-api/docs/features/banking/current-savings-vnd/account-inquiry/README.md)

> **Status — Refactor complete (full-stack).** The page is wired to the live backend (no mock fallback):
> server-side list + filter + sort + pagination, real-time Update/Sync (with OTP/CAPTCHA/QnA challenge
> handling), Sync History, balance-click transaction popup, View Setting, and XLSX export are all
> implemented. Legacy parity verified; SIT/UAT completed. This folder is the **primary frontend
> documentation home**; the older single-file spec at [current-savings-vnd/account-inquiry.md](../account-inquiry/legacy-spec.md)
> and the UI-baseline rule at [current-savings-vnd/account-inquiry-main-page-ui-rule.md](account-inquiry-main-page-ui-rule.md)
> are preserved and cross-linked.

> **Note on stale references:** `wecms-web/CLAUDE.md`'s Feature-Status table still labels this route
> "Shell + mock data" — that line predates the full wiring and is **stale**. The actual implementation
> (documented here) calls live endpoints with no mock seed. Flagged as a CLAUDE.md follow-up.

Account Inquiry (VND) is also one of the **approved UI baseline reference screens** for the whole app —
its shell, page-header, filter row, table, and pagination are the pattern every new menu page mirrors.

---

## Document map (this folder)

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | User journeys + interaction flows (load, filter, sort, paginate, update/sync, balance popup, export). |
| [ui-specification.md](ui-specification.md) | Layout, table columns, formatting, loading/empty/error states, last-update + status rendering. |
| [component-index.md](component-index.md) | Route, client wrapper, shared shell, dialogs, hooks, API client, types — file-by-file. |
| [api-consumption.md](api-consumption.md) | Endpoints consumed, request params, response shapes, wire → in-memory mapping. |
| [test-scenarios.md](test-scenarios.md) | Frontend SIT/UAT scenarios. |

## Companion references (preserved — cross-linked)

| Doc | Location |
|---|---|
| Original frontend page design | [current-savings-vnd/account-inquiry.md](../account-inquiry/legacy-spec.md) |
| UI baseline rule (standard menu page) | [current-savings-vnd/account-inquiry-main-page-ui-rule.md](account-inquiry-main-page-ui-rule.md) |
| Page mapping (JEX `_view.jsp` → route) | [references/page-mapping/page-mapping.md](../../../../references/page-mapping/page-mapping.md) |
| Backend feature hub | [wecms-api/docs/features/banking/current-savings-vnd/account-inquiry/](../../../../../../wecms-api/docs/features/banking/current-savings-vnd/account-inquiry/README.md) |
| Backend interface spec (endpoints) | [wecms-api/docs/features/banking/current-savings-vnd/account-inquiry/interface-specification.md](../../../../../../wecms-api/docs/features/banking/current-savings-vnd/account-inquiry/interface-specification.md) |
| JEX functional spec | [docs/jex/features/account-inquiry-vnd/](../../../../../../docs/jex/features/account-inquiry-vnd/README.md) |

---

## Quick facts

- **Route file:** `app/(dashboard)/banking/account-inquiry/page.tsx` → `<AccountInquiryClient currency="VND" />`.
- **Shared shell:** `components/shared/AccountInquiryPage.tsx` (also serves the FCY twin).
- **API:** `GET /api/v1/banking/accounts` (list) · `POST .../transactions-sync` (+ challenge resume) ·
  `GET /api/v1/banking/sync-history` · `GET .../{acctSeqNo}/transactions` (balance popup) · `POST .../accounts/export`.
- **Pagination:** server-side (`serverPaging` controlled mode); page 0-based on the wire, 1-based in the UI.
- **Sort:** shared `useTableSort()` → DB-side ORDER BY.
- **View Setting:** shared `useViewSetting(SCREEN_IDS.ACCOUNT_INQUIRY_VND, DEFAULT_AREA_ID)`.
- **Export:** shared `useExcelExport()` → backend XLSX (no client-side CSV).

## Migration status

**Refactor Status: 100% Complete** for the VND screen. See the backend
[refactor-gap-analysis.md](../../../../../../wecms-api/docs/features/banking/current-savings-vnd/account-inquiry/refactor-gap-analysis.md)
for the line-by-line parity table; the only PARTIAL items (Print = browser-print helper; FCY client
server-paging) do not affect the VND page.

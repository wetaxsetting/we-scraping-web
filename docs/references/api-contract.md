# Frontend API Consumption Contract

**Status: CURRENT.** Verified against `wecms-web` source on 2026-08-17.

This document is the **frontend-facing contract bridge**. It describes how `wecms-web` *consumes*
HTTP — the envelope it expects, how it authenticates, how it surfaces errors, where snake_case
becomes camelCase, and which calls deliberately bypass the envelope.

It is **not** a backend API specification and must never grow into one. It lists no endpoint
inventory, no request/response field tables, no DB mapping.

## Authority boundary

| Question | Authority |
|---|---|
| What an endpoint does, what it validates, what it returns, which table backs it | **`wecms-api`** (backend repo) |
| How this client consumes HTTP — envelope, auth, errors, casing, pagination, binary | **`wecms-web`** — *this document* |
| Which endpoints a specific screen calls, and how its wire data maps to UI state | **`docs/features/<module>/<screen>/api-consumption.md`** |

`wecms-web` is a frontend. It implements no business endpoint. Every business API it calls belongs
to `wecms-api` and is reached through the shared Axios instance. New endpoints belong in
`wecms-api`, never here.

> **Why this document exists.** 424 links in this docs tree point outside this repository — 381
> into a sibling `../wecms-api/` checkout, 43 into the multi-tree workspace root. Those resolve
> only when the other trees are present. The repeated *frontend-consumption* concepts — the
> envelope, `status.error`, `trace_id`, 401 handling, the casing boundary — are documented here so a
> standalone `wecms-web` clone stays understandable without the backend checkout. Backend
> **evidence** links remain where they genuinely add authority; see
> [README.md § Out-of-repo links](README.md#out-of-repo-links--three-tiers) for the tier breakdown.

---

## 1. The `ApiResponse<T>` envelope

Every JSON endpoint returns one envelope shape, declared once in
[`lib/types/api.ts`](../../lib/types/api.ts):

```ts
export interface CommonHead {
    error: boolean;
    code: string;
    message: string;
}

export interface ApiResponse<T> {
    status: CommonHead;
    data?: T;
    timestamp?: string;   // populated on errors
    path?: string;        // populated on errors
    trace_id?: string;    // populated on errors
}
```

`timestamp` / `path` / `trace_id` are populated by the backend's global exception handler on error
responses; successful responses drop them.

**There is exactly one envelope.** A second response-envelope shape (a bespoke `ApiResult<T>` with
a different field set) is forbidden. The legacy JEX `COMMON_HEAD` / `REC` envelope is retired — if
you find it in old code, it predates the cutover.

### HTTP 200 is not success

The backend returns **HTTP 200 for known business errors**, with `status.error === true`. Every
consumer must read `status.error`, never the HTTP status alone.

---

## 2. `unwrap()` — the shared envelope reader

[`lib/api/common/unwrap.ts`](../../lib/api/common/unwrap.ts) is the canonical implementation,
extracted from ~12 byte-identical local copies:

```ts
export async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T>
```

Behaviour:

1. A response is an error when `status.error` is `true` **or** `data` is missing (`!body.data`).
2. Envelope errors throw `ApiCallError(status.code, status.message)`.
3. Axios transport failures are re-read for an error envelope on `error.response.data.status`; when
   present, its `code` / `message` are used. Otherwise `ApiCallError("NETWORK", …)` is thrown.

### Adoption is partial, and deliberately so

12 modules under [`lib/api/`](../../lib/api/) import the shared helper. The rest keep a
local `unwrap` **by design**, because their envelope semantics genuinely differ. The variants, as
documented in the helper's own docblock:

| Variant | Modules |
|---|---|
| Void / empty-`data`-tolerant (checks `status.error` only) | `cardTransactions`, `payment`, `smartOrganizer`, `payrollPayment`, `expensePayment`, `loginCredentials` |
| `body.data === undefined` check (distinguishes `null` from absent) | `approvalLine`, `chartOfAccounts`, `userManagement`, `users` |
| Custom transport error code (`WBE_TRANSPORT`) | `bankCredentials` |
| No network mapping | `screenOption` |
| Synchronous variants | `notification`, `approvalBox` |

**New `lib/api` modules must use the shared helper.** Do not add a new local copy. If your endpoint
genuinely needs different semantics, say which variant above it matches and why, in the MR
description.

---

## 3. Error surface

### `ApiCallError`

Defined once in [`lib/api/common/unwrap.ts`](../../lib/api/common/unwrap.ts) and re-exported from
[`lib/api/banking.ts`](../../lib/api/banking.ts) for backward compatibility with existing
`import { ApiCallError } from "@/lib/api/banking"` call sites.

```ts
export class ApiCallError extends Error {
    code: string;              // status.code, or "NETWORK"
    // message inherited from Error
}
```

> **`ApiCallError` does not carry `traceId`.** Only `code` and `message`. Two other error types do
> carry it: `LoginError` ([`lib/auth/client.ts`](../../lib/auth/client.ts)) and
> `ApprovalBoxApiError` ([`lib/api/approvalBox.ts`](../../lib/api/approvalBox.ts)), both typed
> `(code, message, traceId?)`. Any doc claiming a `trace_id` on `ApiCallError` is wrong.

### Surfacing rules

- **Action / mutation errors** → `useDialog().open({ type: "error", errorCode, description })`.
  Never a bespoke per-page error banner.
- **Load / list errors** → a shared error banner.
- **Dialog variant matters.** API, network, server, and validation failures are `type: "error"`
  (red). `type: "warning"` is for non-fatal caution only. Using Warning chrome for an API failure
  is a reviewed regression.
- **Never display "UNKNOWN" or "Unexpected error" without a code.**

`LoginError`'s funnel produces three meaningful codes when no backend code exists: the real backend
code (e.g. `WBE1009`) when the server responded, `WBE_NETWORK` when Axios threw with no response,
and `WBE_CLIENT_PARSE` when the response shape was malformed.

### `trace_id`

When the server supplies `trace_id`, it renders verbatim in the system error dialog so the user can
quote it to support and ops can grep server logs by the same id. The frontend `localTraceId()`
fallback (id ending `LOCL`) fires only on pure network failures with no response body — that id is
browser-local and will not match any server log.

---

## 4. Authentication — JWT transport

[`lib/axios.ts`](../../lib/axios.ts) creates the single shared instance:

```ts
export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
    headers: { "Content-Type": "application/json" },
});
```

A **request interceptor** reads `wecms_token` from `localStorage` (browser only) and sets
`Authorization: Bearer <token>` on every call. There is no refresh-token flow — the backend is
stateless.

`NEXT_PUBLIC_API_BASE_URL` is baked into the bundle at build time and is public. Never point it at
`dev.wecms.vn`, `test.wecms.vn`, or `www.wecms.vn` — those are the **live JEX system**, a different
application that does not serve this REST contract.

### Route protection is server-side

Authentication is gated by [`proxy.ts`](../../proxy.ts) — Next.js 16's renamed `middleware`
convention — which runs in front of every non-excluded route and redirects to `/login` when the
`wecms_token` cookie is absent, preserving the intended URL as `?next=…`.

The login flow mirrors the JWT into a non-HttpOnly `wecms_token` cookie so the edge can read it,
while Axios keeps reading `localStorage` for the header.

> The former client-side guard in `app/(dashboard)/layout.tsx`, and its `?preview=1` query-string
> bypass, were **removed**: the guard could be defeated by disabling JS and the bypass was a
> security hole. The dashboard layout now only rehydrates the in-memory user from `/auth/me`.
> Do not document `?preview=1` as an available auth bypass.

---

## 5. 401 / session expiration

Handled centrally by the **response interceptor** in [`lib/axios.ts`](../../lib/axios.ts) together
with the event bus in [`lib/auth/sessionExpired.ts`](../../lib/auth/sessionExpired.ts).
**Do not add per-call 401 handling.**

Two distinct cases, deliberately separated:

| Case | Behaviour |
|---|---|
| **Active usage** — the app is loaded, the user is working, an in-page call returns 401 | The interceptor calls `requestReAuth()`, the global `<SessionExpiredDialog>` opens, and on successful re-auth the original request is **retried once** with the fresh token so the user resumes on the same screen |
| **Page load / reload** — `GET /api/v1/auth/me` returns 401 | No popup. The dashboard layout's catch handler clears storage and redirects cleanly to `/login` |

### Excluded paths

`/api/v1/auth/login`, `/api/v1/auth/logout`, and `/api/v1/auth/me` never open the popup:

- `login` / `logout` — a wrong password inside the popup calls `/login` and legitimately 401s;
  opening the popup on it would recurse.
- `me` — excluding it is exactly what makes **reload → `/login`** while **in-page → popup**.

### Retry semantics

`_isRetry` is set on the retried request, so a second 401 falls through to the caller instead of
re-opening the dialog. A permanently broken token therefore still surfaces the original error.

Multiple concurrent 401s collapse to **one** open dialog: every requester waits on the same
in-flight promise and they all settle together. Handler registration is self-healing — a 401 that
arrives before the dialog mounts is re-emitted once a handler comes online.

---

## 6. Casing — three layers, one boundary

Per the CTO directive of 2026-05-08, enforced backend-side by a global Jackson `SNAKE_CASE`
strategy:

| Layer | Convention | Where |
|---|---|---|
| **1. Wire JSON** (request + response) | lowercase `snake_case` | every HTTP call to `wecms-api` |
| **2. Frontend wire types** | `snake_case` property names matching the wire | [`lib/types/api.ts`](../../lib/types/api.ts) |
| **3. Frontend in-memory types** | **camelCase with semantic full words** | everything outside `lib/types/api.ts` |

```
HTTP wire (snake_case)
        │
        ▼
  lib/api/mappers.ts        ← wire row → camelCase frontend row (56 exported mappers)
  lib/auth/client.ts        ← wire user → StoredUser
        │
        ▼
Frontend code (camelCase)   ← components, hooks, storage, state — never see snake_case
```

**Translation happens at the boundary, exactly once.** Pages, hooks, components, and storage
helpers must not read a snake_case property off a response. `response.data.user_id` in a component
means a mapper is missing — extend [`lib/api/mappers.ts`](../../lib/api/mappers.ts) first, then
consume.

### Stable identifier *values* stay UPPERCASE

A View Setting `field_id` **property** is snake_case, but its **value** is `"BANK"` /
`"ACCOUNT_NICKNAME"` / `"CHECKBOX"`. Same for `disp_yn === "Y"`, currency codes (`"VND"`, `"USD"`),
and error codes (`"WBE1009"`). Those are stable identifiers shared with the backend seed and the
export contract, not wire keys.

### No UPPER_SNAKE wire types remain

The Transaction History, Daily Cash, Daily Financial, and Smart-Organizer families were flipped to
lowercase snake_case on 2026-06-07; Internal Transfer flipped 2026-05-20. The active API/Web
contract is 100 % lowercase snake_case. **Do not add a new `Api*` wire type with UPPERCASE property
names.**

Some report wire fields follow the backend camelCase Java field rather than the old legacy token —
`balance` (not `bal`), `opening_balance` (not `opening_bal`), `acct_nickname` (not `acct_nick_nm`).

### Vendor gateway DTOs are exempt

Coocon / NXiSAS gateway DTOs keep vendor casing. They are a pass-through to a third party, not part
of the WeCMS contract.

---

## 7. Pagination

**New list clients send `page` (zero-based) + `size`.** Read `total_count` off the list response
for the count label. Current usage across [`lib/api/`](../../lib/api/): `page` 22×, `size` 21× —
this is the established convention.

Responses commonly carry `total_count`, `total_pages`, `page_number` (zero-based, Spring Data
convention), and `page_size` (the value the server actually used, after clamping). The frontend
converts to one-based for display.

### Grandfathered exception

`page_no` (1-based) + `page_per_cnt` survive in `fetchTransferHistory` and the report-transactions
popup ([`lib/api/banking.ts`](../../lib/api/banking.ts)), mirroring grandfathered backend
endpoints. **Do not copy the pattern to a new feature** — leave them until their backend migrates.

### Query-parameter casing

Send query params as lowercase snake_case: `page`, `size`, `sort_field`, `sort_direction`,
`from_dt`, `to_dt`, `search`. Current usage: `sort_field` 15×, `sort_direction` 12×, with no
camelCase `sortField:` / `sortDirection:` wire params remaining in `lib/api/`.

### Sorting is server-side

Sort state comes from the shared `useTableSort()` hook, the wire `sort_field` **is** the View
Setting `FIELD_ID`, and the database returns rows already ordered. Never `rows.sort(...)` after
fetching — that breaks pagination order and masks backend bugs.

---

## 8. Binary endpoints bypass the envelope

**File downloads and Excel exports return a blob, never `ApiResponse<T>`.** They must never be
routed through `unwrap()`, and no JSON `unwrap` call may be added to a download fetch.

| Path | Helper |
|---|---|
| Authenticated file download | [`lib/file.ts`](../../lib/file.ts) — `downloadFile(url, fallback)` |
| Excel export | [`lib/excel.ts`](../../lib/excel.ts) — `exportExcel(...)`, consumed via [`hooks/useExcelExport.ts`](../../hooks/useExcelExport.ts) |

`downloadFile` exists because the JWT lives in `localStorage`: a plain `<a href download>`
navigation would not carry the Bearer header. It fires an authenticated XHR through the shared
`api` instance (so the Bearer interceptor **and** the 401 re-auth flow both still apply), reads the
response as a `Blob`, and drives a synthetic anchor click. The blob URL is revoked on the next tick.

Filename resolution order: the backend's `Content-Disposition: attachment; filename*=UTF-8''…`
(RFC 5987, so non-ASCII round-trips), then the caller-supplied fallback.

> A `?token=<jwt>` URL-query alternative was **rejected** (OQ-FE-1, resolved 2026-05-11) for
> log-leak risk. The XHR-blob approach keeps the JWT off the URL.

### Error handling on a binary call

When the server responds with the JSON error envelope instead of binary, both helpers parse it and
throw `ApiCallError` carrying `status.code`. Pure network failures throw code `"NETWORK"`. Callers
route the error to `useDialog().open({ type: "error", errorCode })`.

### The frontend does not generate workbooks

Backend Apache POI is the single XLSX producer: the frontend ships JSON, receives a blob, saves it.
CSV is not a sanctioned export format. See [XLSX generation policy](#xlsx-generation-policy) below
for the precise scope of that rule.

---

## 9. `lib/api` module organization

```
lib/
├── axios.ts                — the single `api` Axios instance (JWT + 401 interceptors)
├── excel.ts                — exportExcel() — binary, bypasses the envelope
├── file.ts                 — downloadFile() — binary, bypasses the envelope
├── auth/
│   ├── client.ts           — login / fetchMe / logout / changePassword; LoginError
│   ├── sessionExpired.ts   — 401 re-auth event bus
│   └── storage.ts          — tokenStorage / userStorage / savedIdStorage
├── types/api.ts            — ALL wire types (snake_case property names)
└── api/
    ├── common/unwrap.ts    — shared unwrap() + ApiCallError
    ├── mappers.ts          — wire → camelCase mappers (56 exports)
    ├── useApiData.ts       — fetch-on-mount hook
    └── <domain>.ts         — 33 per-domain client modules
```

(35 `.ts` files in `lib/api/` total: 33 domain clients + `mappers.ts` + `useApiData.ts`, plus
`common/unwrap.ts`.)

Rules:

- **One instance.** All HTTP goes through `api` from [`lib/axios.ts`](../../lib/axios.ts). Never
  construct a second Axios instance or call `fetch()` directly for a business endpoint.
- **One types home.** All wire types live in [`lib/types/api.ts`](../../lib/types/api.ts). Do not
  declare a wire type inside a feature folder.
- **One mappers home.** [`lib/api/mappers.ts`](../../lib/api/mappers.ts). Feature-local re-shaping
  of an already-mapped row is fine; wire→camelCase translation is not.
- **The folder map is closed.** Do not add a root-level `services/`, `utils/`, `helpers/`, or
  `common/`. `lib/api/` is the only home for API clients; `lib/` is the only home for utilities.
- Pages fetch via [`lib/api/useApiData.ts`](../../lib/api/useApiData.ts), not by calling a client
  in a bare `useEffect`.

---

## 10. Permissions — read this before trusting a flag

Menu and route visibility are **server-driven** (`GET /api/v1/navigation` + `lib/menuAuth.ts`), and
the response is already permission-filtered and product-scoped, so the frontend renders it as-is.

**Action-level (R/D/T) gating is a static `{R:true, D:true, T:true}` stub**, pending the backend
`USER_MENU_ACTION_AUTH_INFM`-equivalent contract. The frontend flag is **UX only and is never a
security boundary** — real enforcement is server-side `@PreAuthorize`. This must be resolved before
UAT/PROD sign-off.

---

## XLSX generation policy

> ⚠️ **Corrected 2026-08-17.** An earlier version of this section claimed *"every live export path
> calls the backend … the rule holds"*. **That was wrong.** It was derived from grepping `xlsx` /
> `xlsx-js-style` imports and missed a dependency-free client-side writer. Corrected below.

**General rule (CLAUDE.md §13b): normal downloadable Excel exports are backend-generated.** Apache
POI on `wecms-api` is the producer; the frontend ships JSON, receives a blob, saves it. CSV is not a
sanctioned export format.

**Current classification: B — implementation drift / exception pending architectural approval.**

### Conforming — the general rule holds

Every View-Setting-driven list export and every Banking report export calls the backend: Account
Inquiry, Transaction History, Cash Flow, e-Invoices, Operation Status, Card Transactions, and the
Payment result lists via `useExcelExport()` → [`lib/excel.ts`](../../lib/excel.ts); Daily Cash and
Daily Financial via dedicated backend report endpoints.

### Diverging — Tax Filing generates workbooks client-side (live)

| Call site | Builder | Writer |
|---|---|---|
| `components/addon/tax-filing/DeclarationTab.tsx:343` | `exportDeclarationExcel(...)` | `lib/xlsxTemplate.ts` |
| `components/addon/tax-filing/VatDeclarationFormPage.tsx:121` | `exportPlReduce8Excel(...)` | `lib/xlsxTemplate.ts` |
| `components/addon/tax-filing/VatDeclarationFormPage.tsx:128` | `exportInvoiceListingExcel(...)` | `lib/xlsxTemplate.ts` |

`lib/xlsxTemplate.ts` fetches the authority's workbook from `public/templates/`, unzips it, patches
only the `<c>` cell elements, and rezips — via `DecompressionStream("deflate-raw")`, so it carries
**no dependency** and never appeared in an `xlsx` import grep.

**Reason** (evidenced in source + [the Tax Filing api-consumption doc](../features/addon-service/tax-filing/api-consumption.md) §5):
the filed document must be the tax authority's own workbook **byte-for-byte**, and must reflect the
figures **currently on screen including unsaved edits** — neither of which a server round-trip can
deliver. The declaration also has no `/export/excel` endpoint.

**This section does not grant the exception.** Whether Tax Filing becomes a formally approved
exception, or migrates to backend generation, is an open **human architecture decision**. Until it is
recorded: do not cite Tax Filing as precedent for a new client-side writer, and do not "fix" the Tax
Filing implementation for compliance — the statutory-fidelity requirement is real. New export
surfaces follow the general rule.

### Not a violation — read-side parsing

`xlsx` imports in `lib/xlsxReader.ts`, `components/shared/excel-upload/templateValidator.ts`,
`components/settings/chart-of-accounts/useExcelUpload.ts`, and
`components/settings/contacts/ExcelUploadDialog.tsx` parse **uploaded** workbooks. §13b governs
workbook **writing** on an export path; import parsing was never in scope. §13b's "Forbidden: a
frontend `xlsx` import" bullet was narrowed on 2026-08-17 to say so explicitly.

### Dead code — separate from the divergence above

`lib/reportExcel.ts` (`exportReportExcel`) has **zero** importers; `lib/dailyCashExport.ts`
(`exportDailyCashExcel`) is **never** imported — only its sibling `printDailyCashReport` is consumed.
Residue from the earlier migration to backend generation; tracked as
[TD-2](../tech-debt.md). Source was not modified.

---

## Related

- Per-screen endpoint usage: `docs/features/<module>/<screen>/api-consumption.md`
- Integration mapping (JEX WSVC → Spring REST → Next.js fetcher):
  [../architecture/integrations/](../architecture/integrations/)
- State management + fetch patterns: [../architecture/state-management/](../architecture/state-management/)
- Project rules: [../../CLAUDE.md](../../CLAUDE.md) — § API Naming & Serialization Standards,
  § REST API Consumption Conventions
- References index: [README.md](README.md)
- Backend authority: the `wecms-api` repository. Its `docs/api-spec/` and per-feature
  `interface-specification.md` files are the endpoint contracts; links to them resolve only when
  both repositories are checked out side by side.

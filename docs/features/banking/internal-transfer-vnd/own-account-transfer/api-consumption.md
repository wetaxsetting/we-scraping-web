# Own Account Transfer — API Consumption (Frontend)

Backend endpoints the page calls, via [`lib/api/banking.ts`](../../../../../lib/api/banking.ts). The authoritative
wire contract (method, URI, request/response DTOs, validation) is the backend
[wecms-api/…/interface-specification.md](../../../../../../wecms-api/docs/features/banking/internal-transfer-vnd/own-account-transfer/interface-specification.md)
and [wecms-api/…/own-account-transfer-api.md](../../../../../../wecms-api/docs/references/api-spec/banking/own-account-transfer-api.md).

> **Base path (authoritative, from `OwnAccountTransferController`):** `/api/v1/banking/own-account-transfer`.
> All calls go through the shared `api` Axios instance ([`lib/axios.ts`](../../../../../lib/axios.ts)) — JWT auto-attached,
> `{ status, data }` envelope unwrapped, snake_case wire → camelCase mapped in `mappers.ts`. Errors throw
> `ApiCallError { code, message, traceId }`; 401 handled by the global session-expired interceptor.

---

## 1. List APIs

| Function | Method | Endpoint | Consumer |
|---|---|---|---|
| `fetchOwnAccountSources(bankCd, sort)` | GET | `/source-accounts?bank_cd=&sortField=&sortDirection=` | `use-own-account-transfer` on mount + filter/sort change |
| `loadTargets(source)` → targets | GET | `/target-accounts?source_bank_cd=&source_acct_no=` | composer (lazy, per source, cached) |

`fetchOwnAccountSources` → `ApiOwnAccountSourceListResponse` (`list[]`, `total_count`, `tot_bal`, `tot_avi_bal`, `allowed_bank_cds[]`) → mapped to `OwnAccountSourceRow[]` + `OwnAccountSourceTotals`.

## 2. Detail / Status APIs

| Function | Method | Endpoint | Consumer |
|---|---|---|---|
| `validateNapas(napasBankCd)` | GET | `/napas-bank-info/{napas_bank_cd}` | composer (cross-bank recipient validation) |

Returns `ApiNapasBankInfoRow` (`napas_bank_cd`, `short_name`, `long_name_en`, `long_name_vn`, `bank_cd`).

## 3. Transfer APIs

| Function | Method | Endpoint | Consumer |
|---|---|---|---|
| `submitScrapingResult(req)` | POST | `/scraping-result` | composer, after the engine TRANSFER completes |

Request carries `idempotency_key`, `transfer_type` (`SAME_BANK`/`NAPAS`), source/target identifiers, `ccy_cd` (VND),
`requested_amt`/`actual_amt`, `trns_stts`, optional fee/remarks/engine metadata. Response → `ScrapingResultResponse`
(`seq_no`, `status` `success`/`failed`, `already_recorded`). Retrying with the same `idempotency_key` replays the
prior row (`already_recorded=true`) — no duplicate.

## 4. Balance Inquiry APIs

| Function | Method | Endpoint | Consumer |
|---|---|---|---|
| `postBalanceRefresh(req)` | POST | `/balance-refresh` | "Update Balance" (deferred — OQ-FE-1) |

Patches `ACCT_MSTR` balance + inquiry status after an engine BALANCE scrape; response carries `acct_bal_lst_inq_dtm`.

## 5. Audit

| Function | Method | Endpoint | Consumer |
|---|---|---|---|
| `postEngineConnectionCheck(req)` | POST | `/engine-connection-check` | `use-nxisas-engine` (fire-and-forget compliance audit) |

Returns `204`; failures swallowed (console.warn only).

## 6. NXiSAS bundle support

The engine bundle also calls `/nxisas/cert-acct-list`, `/nxisas/decrypt`, `/nxisas/encrypt`, `/nxisas/logging` —
driven by the vendor JS + `lib/nxisas/*` adapters, not the page's React data layer. Decrypt/encrypt are gated
server-side by `wecms.oat.seed-decrypt.enabled`. See the backend
[wecms-api/…/interface-specification.md §1](../../../../../../wecms-api/docs/features/banking/internal-transfer-vnd/own-account-transfer/interface-specification.md).

## 7. Wire naming

Wire is lowercase snake_case ([`lib/types/api.ts`](../../../../../lib/types/api.ts) `ApiOwnAccount*`); in-memory types are
camelCase ([`types.ts`](../../../../../components/banking/own-account-transfer/types.ts)); translation happens once in
[`mappers.ts`](../../../../../components/banking/own-account-transfer/mappers.ts). Pages never read snake_case directly.

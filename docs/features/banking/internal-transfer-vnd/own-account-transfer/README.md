# Banking › Own Account Transfer (Frontend)

Next.js design + implementation docs for the Banking **Internal Transfer › Own Account Transfer** screen —
the source-account picker, live balance refresh, and the NXiSAS-engine-driven transfer composer. Mirrors
the WeCMS Banking sidebar entry **Own Account Transfer**.

> Not to be confused with Payment › Internal Transfer (batch-file approval flow). This Banking screen is the
> tenant's own→own VND transfer, executed by the local NXiSAS Coocon engine.

**Route:** `/banking/transfer-own-accounts` (canonical menu route) · **Slug:** `own-account-transfer` · **JEX:** `trns_0001_001` (+ `trns_0001_007` composer).
**Legacy route:** `/banking/own-account-transfer` → permanent redirect to `/banking/transfer-own-accounts` (forwards `?sourceAccountNo=` for old deep-links).
**Status:** ✅ Implemented — page + source table + composer + engine lifecycle landed. Composer credential-collection deferred (OQ-FE-1).

> **Route consolidation (2026-06-06).** The feature previously had **two** pages for one menu item: a generic
> all-account list at `/banking/transfer-own-accounts` (fed by `fetchOwnAccounts()` — all banks / all currencies)
> whose Transfer button navigated to `/banking/own-account-transfer?sourceAccountNo=…`, plus the real composer page
> at `/banking/own-account-transfer`. These were collapsed onto **one** implementation: the canonical menu route
> `/banking/transfer-own-accounts` now renders the real NXiSAS composer page (`OwnAccountTransferClient` →
> `OwnAccountTransferPage`), so the per-row **Transfer** button opens the composer popup **in place** (no
> navigation, URL unchanged). The old `/banking/own-account-transfer` route is now a thin server-side redirect.
> The five generic-list components under `components/banking/internal-transfer/TransferOwnAccounts*` were deleted.
>
> The source list is VND-only and limited to the legacy-supported allow-listed banks: the page reads
> `GET /api/v1/banking/own-account-transfer/source-accounts` (which returns the rows **and** `allowed_bank_cds`),
> so the bank filter shows only the 5 allow-listed banks (Shinhan(VN), IBK(VN), Vietcom, Vietin, Woori(VN)) and the
> generic `fetchOwnAccounts()` all-account path is no longer reached by any route. Transfers run through the local
> NXiSAS engine (.exe) scraping flow, not an API-only transfer. The orphaned generic-list data layer
> (`fetchOwnAccounts`, `mapOwnAccountRow`/`mapOwnAccountTotals`, `OwnAccountRow`/`OwnAccountTotals`,
> `ApiOwnAccountListResponse`) was intentionally **left in place** — it is unreferenced by any route but still
> entangled with the live `mapTransferHistoryRow` typing (`coerceCurrency` → `OwnAccountRow["currency"]`); its
> removal is deferred to a separate `CurrencyCode` cleanup.
>
> Menu label and active state are unchanged (the sidebar item's `leaf.route` is `/banking/transfer-own-accounts`;
> `lib/menuAuth.ts` still maps both prefixes to `banking-internal-transfer-own`).
>
> **Verification:** `npx tsc --noEmit` → 0 errors · `npm run build` → compiled successfully
> (`/banking/transfer-own-accounts` static `○`, `/banking/own-account-transfer` dynamic redirect `ƒ`) · `npm run lint`
> → no new findings in the changed route files (only pre-existing issues in unrelated files).

---

## Documentation map (this folder)

| Doc | Purpose |
|---|---|
| [README.md](README.md) | This index. |
| [screen-flow.md](screen-flow.md) | Page → composer → engine scrape → result intake; engine lifecycle states. |
| [ui-specification.md](ui-specification.md) | Filters, grid columns, Last-Refresh display, actions, dialogs, loading/empty/error. |
| [component-index.md](component-index.md) | Every component / hook / adapter / type for the feature, with file paths. |
| [api-consumption.md](api-consumption.md) | Endpoints the page calls (List / Detail / Transfer / Balance Inquiry). |
| [test-scenarios.md](test-scenarios.md) | Frontend SIT/UAT scenarios — search, actions, engine, validation. |
| [own-account-transfer.md](legacy-spec.md) | **Preserved** earlier design spec (Internal Transfer group landing). Cross-linked. |
| [transfer-history.md](../transfer-history/legacy-spec.md) | **Preserved** companion design — Transfer History list. Cross-linked. |

> **Note (2026-06-05, route corrected 2026-06-06):** the canonical route is `/banking/transfer-own-accounts`
> (consolidation, 2026-06-06); the legacy `/banking/own-account-transfer` is a permanent redirect to it (forwards
> `?sourceAccountNo=` for old deep-links). Components live under
> [`components/banking/own-account-transfer/`](../../../../../components/banking/own-account-transfer/). The two preserved
> design docs (`own-account-transfer.md`, `transfer-history.md`) predate the build and reference the earlier
> `/banking/internal-transfer/…` route + `components/banking/internal-transfer/` paths — they are kept for history
> and design rationale; the five consolidation docs above describe the **as-built** implementation.

## Related backend docs (`wecms-api/`)

| Layer | Location |
|---|---|
| Feature home | [own-account-transfer/README.md](../../../../../../wecms-api/docs/features/banking/internal-transfer-vnd/own-account-transfer/README.md) |
| Interface spec (endpoints) | [interface-specification.md](../../../../../../wecms-api/docs/features/banking/internal-transfer-vnd/own-account-transfer/interface-specification.md) |
| API contract | [own-account-transfer-api.md](../../../../../../wecms-api/docs/references/api-spec/banking/own-account-transfer-api.md) |
| Gap analysis / parity | [refactor-gap-analysis.md](../../../../../../wecms-api/docs/features/banking/internal-transfer-vnd/own-account-transfer/refactor-gap-analysis.md) |
| Legacy (JEX) functional spec | [docs/jex/features/own-account-transfer/](../../../../../../docs/jex/features/own-account-transfer/README.md) |

## Open questions

- **OQ-FE-1** — composer credential-collection (saved bank-cert lookup, in-app password capture, balance-refresh action) deferred to the Phase-B composer MR. Tracked backend-side in [refactor-gap-analysis.md](../../../../../../wecms-api/docs/features/banking/internal-transfer-vnd/own-account-transfer/refactor-gap-analysis.md).
- Page-mapping row: [page-mapping.md](../../../../references/page-mapping/page-mapping.md).

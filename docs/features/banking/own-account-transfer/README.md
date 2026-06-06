# Banking › Own Account Transfer (Frontend)

Next.js design + implementation docs for the Banking **Internal Transfer › Own Account Transfer** screen —
the source-account picker, live balance refresh, and the NXiSAS-engine-driven transfer composer. Mirrors
the WeCMS Banking sidebar entry **Own Account Transfer**.

> Not to be confused with Payment › Internal Transfer (batch-file approval flow). This Banking screen is the
> tenant's own→own VND transfer, executed by the local NXiSAS Coocon engine.

**Route:** `/banking/own-account-transfer` · **Slug:** `own-account-transfer` · **JEX:** `trns_0001_001` (+ `trns_0001_007` composer).
**Status:** ✅ Implemented — page + source table + composer + engine lifecycle landed. Composer credential-collection deferred (OQ-FE-1).

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
| [own-account-transfer.md](own-account-transfer.md) | **Preserved** earlier design spec (Internal Transfer group landing). Cross-linked. |
| [transfer-history.md](transfer-history.md) | **Preserved** companion design — Transfer History list. Cross-linked. |

> **Note (2026-06-05):** the shipped feature lives at route `/banking/own-account-transfer` with components under
> [`components/banking/own-account-transfer/`](../../../../components/banking/own-account-transfer/). The two preserved
> design docs (`own-account-transfer.md`, `transfer-history.md`) predate the build and reference the earlier
> `/banking/internal-transfer/…` route + `components/banking/internal-transfer/` paths — they are kept for history
> and design rationale; the five consolidation docs above describe the **as-built** implementation.

## Related backend docs (`wecms-api/`)

| Layer | Location |
|---|---|
| Feature home | [own-account-transfer/README.md](../../../../../wecms-api/docs/features/banking/own-account-transfer/README.md) |
| Interface spec (endpoints) | [interface-specification.md](../../../../../wecms-api/docs/features/banking/own-account-transfer/interface-specification.md) |
| API contract | [own-account-transfer-api.md](../../../../../wecms-api/docs/references/api-spec/banking/own-account-transfer-api.md) |
| Gap analysis / parity | [refactor-gap-analysis.md](../../../../../wecms-api/docs/features/banking/own-account-transfer/refactor-gap-analysis.md) |
| Legacy (JEX) functional spec | [docs/jex/features/own-account-transfer/](../../../../../docs/jex/features/own-account-transfer/README.md) |

## Open questions

- **OQ-FE-1** — composer credential-collection (saved bank-cert lookup, in-app password capture, balance-refresh action) deferred to the Phase-B composer MR. Tracked backend-side in [refactor-gap-analysis.md](../../../../../wecms-api/docs/features/banking/own-account-transfer/refactor-gap-analysis.md).
- Page-mapping row: [page-mapping.md](../../../references/page-mapping/page-mapping.md).

# Legacy reference

Holding area for legacy / deprecated frontend reference material kept for traceability.

> **Corrected 2026-08-17.** This page previously said the folder was "currently empty". It is not —
> see the inventory below.

## Contents

| File | Size | What it is |
|---|---|---|
| [nxisas_api.js](nxisas_api.js) | ~149 KB | **Verbatim copy of the live JEX bundle** `WECMS DEV/WECMS_STATIC/web/nxisas/js/nxisas_api.js`, kept **only** as a behavioural spec for porting bank-specific scraping rules into the Spring layer (`NxisasBankConfig` / `BankScrapingService` / `BankTransactionSyncService` / `NxisasGatewayClient`). |

**`nxisas_api.js` is reference material, not application code.** Its own header banner states it is
`NOT LOADED AT RUNTIME, NOT THE ARCHITECTURE`: it lives outside `wecms-web/public/` so Next.js never
serves it, and it is not in the `SCRIPT_LOAD_ORDER` of
[`use-nxisas-engine.ts`](../../../components/banking/own-account-transfer/hooks/use-nxisas-engine.ts).
Read it to understand legacy behaviour; never import, bundle, or execute it. The file keeps its
legacy snake_case name deliberately — it is a verbatim capture, so renaming it would break the
traceability to the JEX original.

The deprecated workspace-level `refactor-wecms` doc tree is **outside this repository** (read-only
legacy; not part of the `wecms-web` clone). The former in-repo `archive/` folder was deleted
2026-06-23 by project decision — it held only an empty placeholder.

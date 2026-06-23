# Settings > Transaction History (ERP) — Frontend Feature (Refactor)

**Status:** ✅ Wired full-stack — the panel consumes the live `erp-transaction-history` API (list + 4 tab counts + per-row file download), no mock fallback; legacy `comm_0219_001` parity verified.
**Menu:** Settings → **Transaction History** (Settings modal panel — **no standalone route**). This is the **ERP file-exchange audit ledger**, NOT the Banking transaction-history page.
**Slug:** `erp-transaction-history` (matches the JEX-traceability + backend counterparts). Doc-folder name `transaction-history` per the prompt; component folder is `components/settings/erp-transaction-history/`.
**Panel:** `<ErpTransactionHistoryPanel>` · **Menu permission:** `settings-erp-transaction-history`
**Backend:** `/api/v1/settings/erp-transaction-history` (GET list+counts · GET `/{seqNo}/download` · POST `/export`)

> This folder is the **primary frontend documentation home** for ERP Transaction History. It indexes
> the material previously in the single-file [../transaction-history.md](../transaction-history.md)
> (preserved, cross-linked). The matching backend docs are at
> [wecms-api/docs/features/settings/transaction-history/](../../../../../wecms-api/docs/features/settings/transaction-history/README.md).

---

## What this screen is

The per-tenant **read-only audit ledger** of every file exchanged between WeCMS and the customer's ERP,
rendered as a four-tab list inside the Settings modal. The user filters by date range, transaction
type, and keyword, pages through results, and downloads the file attached to a row. There is **no add /
edit / delete** — the panel never mutates a row (upload happens on the live JEX system / future Payment
features, OQ-1).

It renders as a **panel inside `<SettingsModal>`** (mounted via `<SettingsNav>`) — there is no
`/settings/erp-transaction-history` URL. The View Setting (column-visibility popover) is **not adopted**
in the panel (OQ-FE-2 — the legacy JEX panel has no toolbar list-icon); the columns are a fixed
`<colgroup>`. Excel export is wired separately through the toolbar.

Two "Transaction History" features exist — do not confuse them:

| Feature | Slug | JEX | Folder |
|---|---|---|---|
| Banking > Transaction History (account ledger) | `transaction-history` | `comm_0220_001` | `components/banking/transaction-history/` |
| **Settings > ERP Transaction History (this)** | **`erp-transaction-history`** | `comm_0219_001` | `components/settings/erp-transaction-history/` |

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Open → fetch list+counts → tabs → filters → table → download → export; refetch model; authz/visibility |
| [ui-specification.md](ui-specification.md) | Header, tabs + counts, filters (date range / type dropdown / search), table columns, download cell, pagination, states, i18n keys |
| [component-index.md](component-index.md) | Component / hook / API-client / wire-type / mapper file map |
| [api-consumption.md](api-consumption.md) | Endpoints consumed, wire shapes, mappers, error→dialog mapping, download handling, 4-tab count mapping |
| [test-scenarios.md](test-scenarios.md) | SIT/UAT scenarios (per-tab / filter, download success + WBE2015 + WBE2014, export, sort, search; no create/update/delete; no upload) |

---

## Quick facts

| Aspect | Value |
|---|---|
| Panel | [`<ErpTransactionHistoryPanel>`](../../../../components/settings/erp-transaction-history/ErpTransactionHistoryPanel.tsx) |
| Mount | `<SettingsModal>` + `<SettingsNav>` (`panel` key → ERP Transaction History) |
| Data hook | `useApiData(fetchErpTransactionHistory, [filters/sort/page deps])` — project's lightweight hook (no React Query) |
| API client | [lib/api/erpTransactionHistory.ts](../../../../lib/api/erpTransactionHistory.ts) |
| Tabs | All / WeCMS → ERP / ERP → WeCMS / Deleted — counts from one server fan-out |
| Filter | date range (Last 30/90/180 + Enter Manually) · transaction-type dropdown · keyword search |
| Grid columns | Date · Type · Transaction Type · File (download) · User |
| Sort | shared `useTableSort` + `<TableHeaderCell>`; whitelist `REG_DTM`/`ERP_TYPE`/`TRNS_TYPE_CD`/`REG_USER`; `FILE` non-sortable |
| Download | `lib/file.ts downloadFile(url, filename)` (authenticated XHR + blob; JWT is in localStorage so a plain `<a download>` wouldn't carry the Bearer) |
| View Setting popover | **not adopted** (OQ-FE-2) |
| Mock fallback | **none** — panel is fully API-wired (the flat doc's planned `mockData.ts` rename was superseded) |
| Wire convention | lowercase snake_case → camelCase mapping at the API boundary |

---

## Related docs

- **Backend feature folder:** [wecms-api/docs/features/settings/transaction-history/](../../../../../wecms-api/docs/features/settings/transaction-history/README.md)
- **Preserved single-file spec (frontend):** [../transaction-history.md](../transaction-history.md)
- **Backend interface spec (wire contract):** [wecms-api/.../interface-specification.md](../../../../../wecms-api/docs/features/settings/transaction-history/interface-specification.md)
- **Settings feature index:** [../README.md](../README.md) (if present)

# ERP Transaction History — Test Scenarios (Frontend)

Manual SIT/UAT scenarios for the ERP Transaction History panel. Backend scenarios + JUnit map:
[wecms-api/.../test-scenarios.md](../../../../../wecms-api/docs/features/settings/transaction-history/test-scenarios.md).

> **No create / edit / delete scenarios** — this is a read-only audit ledger; the panel has no mutating
> action. **No upload scenarios** — the upload write-path is not ported (OQ-1); files arrive via the
> live JEX system / future Payment features, not this panel.

---

## List + tabs

| # | Scenario | Expected |
|---|---|---|
| L1 | Open the panel | tabs load with counts; table shows the tenant's rows in `REG_DTM DESC` order, page 1, size 10 |
| L2 | Click **WeCMS → ERP** tab | table shows only `W` rows; **all four tab counts stay the same** (server fan-out) |
| L3 | Click **ERP → WeCMS** / **Deleted** tab | direction-filtered rows; counts unchanged |
| L4 | Pick a transaction type | rows narrow to that `trns_type_cd`; page resets to 1 |
| L5 | Switch to **Deleted** while a non-subset type is selected | type dropdown narrows to `02/03/12/16` set; selection resets to All |
| L6 | Pick a date preset (Last 90 Days) | window recomputes from today; refetch fires |
| L7 | Enter Manually → pick start/end | manual range honoured verbatim |
| L8 | Type a keyword | input updates immediately; refetch fires after 300ms debounce; matches `reg_id` |
| L9 | Empty result | "No Data Found" centers in the scroll area |

## Detail

| # | Scenario | Expected |
|---|---|---|
| DT1 | (no detail view) | **N/A** — no per-row detail page/dialog; the row carries every field and download is the only per-row action |

## Download

| # | Scenario | Expected |
|---|---|---|
| D1 | Click a File link on a row with `fileSize > 0` and a present file | file downloads (authenticated XHR + blob); filename = backend `SAVE_FILE_NM` |
| D2 | A batch row (`fileSize = 0`) | File cell is empty — no link rendered (matches legacy hide) |
| D3 | Download a row whose physical file is missing on the server | error dialog `WBE2015` ("file is unavailable") |
| D4 | Download a row not in the tenant (forged seqNo) | error dialog `WBE2014` (not found / wrong tenant — no cross-tenant leak) |
| D5 | Backend returns 401 mid-download | global Axios interceptor triggers re-auth (not a per-call dialog) |

## Export (XLSX)

| # | Scenario | Expected |
|---|---|---|
| X1 | Export with the View Setting seed present + wired toolbar | XLSX downloads; same filtered+sorted rows as the table (unpaged); `ERP_TYPE`/`TRNS_TYPE_CD` show raw codes |
| X2 | Export in the **current live state** (no `erp-transaction-history` seed — backend GAP-4) | export fails with `WBE2013` (no exportable columns) → error dialog. Documents the seed gap; not a frontend defect. |

## Sort

| # | Scenario | Expected |
|---|---|---|
| ST1 | Click the **Date** header | cycles default → ASC → DESC → default; rows re-sort server-side on each click |
| ST2 | Click **Type** / **Transaction Type** / **User** | sorts by the mapped column |
| ST3 | The **File** header | renders no sort glyph and does nothing (non-sortable, OQ-5) |

## Search

| # | Scenario | Expected |
|---|---|---|
| SR1 | Keyword matching a `reg_id` | matching rows returned |
| SR2 | Keyword matching only a filename | **no rows** — search matches `reg_id` only (legacy parity) |

## Authorization

| # | Scenario | Expected |
|---|---|---|
| A1 | User with `settings-erp-transaction-history` grant | Transaction History appears in `<SettingsNav>`; list / download work |
| A2 | User without the grant | entry hidden from `<SettingsNav>`; direct API attempts 403 server-side |

## Error handling

| # | Scenario | Expected |
|---|---|---|
| E1 | Backend unreachable on load | error dialog (no mock fallback); table empty, prior chrome latched |
| E2 | `WBE_VALIDATION` from a filter edge case | suppressed (no dialog) — the panel state guards against it |
| E3 | Session expired (401) | global Axios interceptor triggers the re-auth dialog |

## Cross-cutting

- Verify the panel mounts inside `<SettingsModal>` (no standalone route); ESC closes the top-most layer
  only; the collapse arrow toggles the sidebar width, never closes the modal.
- Verify all visible strings resolve via `t(...)` in EN / KO / VI, including the server-emitted
  `erp_type_key` / `trns_type_key` labels.
- Verify the four tab counts do not change when switching tabs (server fan-out semantics).
- Verify pagination math: 0-based server ↔ 1-based chrome.

# Transaction History (ERP)

> Canonical Settings-menu entry for **Settings → ERP → Transaction History** (frontend). Detailed
> wiring lives in the linked design doc below.

## Overview
The ERP Transaction History panel is a read-only, filterable log of ERP-interface transaction
records with four status counts and file download. Slug: `erp-transaction-history`.

- Frontend design: [../screen-flows/settings/erp-transaction-history.md](../features/settings/transaction-history.md)
- API side: [../../../wecms-api/docs/settings/transaction-history.md](../../../wecms-api/docs/features/settings/transaction-history.md)

> **Slug note:** this is the **ERP** Transaction History (JEX `comm_0219_001`), distinct from
> Banking → Transaction History (`transaction-history`, JEX `comm_0220_001`). Folder is
> `components/settings/erp-transaction-history/` to avoid the collision.

## Page Location
Settings modal panel under the **ERP** group — mounted inside `<SettingsModal>` via `<SettingsNav>`
("Transaction History"). **No standalone route.** Mirrors the `<FirmBankingHistoryPanel>` precedent.

## UI Components
- ERP transaction-history panel shell
- Filter bar (date range, status, keyword)
- Four status-count chips/cards
- Result table + pagination
- Download button

## User Actions
- **Filter** by date range / status / keyword.
- **View** paginated results + the four counts.
- **Download** the file (mirrors `comm_0219_001_r002`).
- **Sort** by whitelisted columns.

## Table Columns
| Column | Source |
|---|---|
| Transaction date/time | `ERP_TRNS_HSTR` |
| Status / result | per row |
| Reference / amount | per row |

> Confirm exact column set against the shipped panel.

## Dialogs / Popups
- None primary (download is a direct action). Confirm if a detail popup exists.

## API Integration
`GET /api/v1/settings/erp-transaction-history` (list + 4 counts) and `GET .../download`. snake_case
wire ↔ camelCase mappers.

## Validation
- Date range validated (from ≤ to); pagination clamped.

## Notes
Read + download only — no create/update/delete. Upload is out of scope.

# Features — common/ (Frontend)

**Cross-cutting system domain** — shared, screen-agnostic UI features reused by every menu group
(Banking / Payment / Add-on / Settings).

Not a WeCMS top-menu group. Formalized 2026-06-01 to resolve **OQ-DOC-2** (tracked backend-side at
[`../../../../wecms-api/docs/planning/open-questions/documentation-follow-up.md`](../../../../wecms-api/docs/planning/open-questions/documentation-follow-up.md)).

## Docs

| Doc | Scope | Status |
|---|---|---|
| [view-setting.md](view-setting.md) | Column visibility / order popover — shared component + hook, per-page registry | Working |

## Scope

| Common feature | This domain? | Where it is documented |
|---|---|---|
| **View Setting / Screen Options** | ✅ yes | [view-setting.md](view-setting.md) + architecture: [`../../architecture/view-setting/README.md`](../../architecture/view-setting/README.md) |
| **Excel / XLSX export** | shared trigger | per-screen export button; backend produces the file (`wecms-api/CLAUDE.md` §"Excel export") |
| Notifications · File upload / Attachment · Dashboard · Common Codes | **not yet in scope** | no refactor page exists; add a doc here when the feature lands — do **not** pre-create empty stubs |

## What does NOT live here

- Per-table column lists → the owning feature spec under [`../banking/`](../banking/) / [`../payment/`](../payment/) / [`../addon-service/`](../addon-service/) / [`../settings/`](../settings/), referenced from the screen registry.
- Hook / dialog architecture detail → [`../../architecture/view-setting/README.md`](../../architecture/view-setting/README.md).

## Naming traceability

Slug `view-setting` matches the JEX counterpart and the backend counterpart
[`../../../../wecms-api/docs/features/common/view-setting.md`](../../../../wecms-api/docs/features/common/view-setting.md).

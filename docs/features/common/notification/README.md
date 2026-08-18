# Common → notification (Frontend)

**Status: CURRENT** — documents shipped frontend behaviour. Per-screen wiring detail is in the tables below. Vocabulary: [../../../README.md § Status vocabulary](../../../README.md#status-vocabulary).

**Part of:** Common → notification
**Last verified:** 2026-06-23

The header-bell notification surface: a bell trigger with a live unread badge in the top `Header`, and a
right-docked slide-over panel with Unread / All tabs, a search box, a scrollable list, and a "Read All"
action. Clicking a row marks it read and opens the Approval Details popup on the current page (no
navigation). Fully API-backed — no mock fallback.

> **Backed by legacy `BLTB_*` tables.** The frontend talks to `domain/payment/notification/` on the
> backend, which is backed by the legacy `BLTB_*` tables. The earlier refactor-only `NOTIFICATION` table
> was removed 2026-06-10 — there is no client-visible change, but do not describe the API as backed by a
> refactor-only table.

## Files

| Concern | File |
|---|---|
| Bell + slide-over container | `components/layout/notifications/NotificationPopup.tsx` |
| Unread / All tabs | `components/layout/notifications/NotificationTabs.tsx` |
| Search box (wraps shared `<SearchInput>`) | `components/layout/notifications/NotificationSearch.tsx` |
| Single row | `components/layout/notifications/NotificationItem.tsx` |
| In-memory types | `components/layout/notifications/types.ts` |
| API client | `lib/api/notification.ts` |
| Bell mount | `components/layout/Header.tsx` (line 151) |

## API calls (all → `/api/v1/notifications`)

| Function | Method + path |
|---|---|
| `fetchNotifications({ readType, page, size })` | `GET /api/v1/notifications?read_type=U\|A&page&size` |
| `fetchUnreadCount()` | `GET /api/v1/notifications/unread-count` |
| `markNotificationRead(id)` | `PUT /api/v1/notifications/{id}/read` |
| `markAllNotificationsRead()` | `PUT /api/v1/notifications/read-all` |

Tenant + recipient are server-side from the JWT; the client never sends `biz_key` / `rcv_id`.

## Documents index

| Doc | Purpose |
|---|---|
| [screen-flow.md](screen-flow.md) | Bell badge → open slide-over → Unread/All + search → row click marks read → Read All. |
| [ui-specification.md](ui-specification.md) | Bell, slide-over panel, tabs, search, item row — tokens + layout. |
| [component-index.md](component-index.md) | Verified component + API-client file map. |
| [api-consumption.md](api-consumption.md) | The 4 calls, `refreshKey` re-fetch after mutation, unread-count badge. |
| [test-scenarios.md](test-scenarios.md) | Badge, tabs, search, row click, Read All, deleted-row, error states. |

## Related links

- Backend twin — [../../../../../wecms-api/docs/features/common/notification/README.md](../../../../../wecms-api/docs/features/common/notification/README.md)
- Common module hub — [../README.md](../README.md)
- Backend reference analyses — `wecms-api/docs/audits/notification-popup-legacy-vs-refactor-analysis.md` · `wecms-api/docs/audits/notification-approval-detail-popup-parity-audit.md` _(backend repo)_

## Naming traceability

Slug `notification` matches the backend counterpart `domain/payment/notification/` and the backend doc
`wecms-api/docs/features/common/notification/`.

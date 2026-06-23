# notification — API Consumption (Frontend)

**Part of:** Common → notification
**Last verified:** 2026-06-23

How the panel consumes the backend. Source of truth: `lib/api/notification.ts` +
`components/layout/notifications/NotificationPopup.tsx`.

## The four calls

| Function | Method + path | When |
|---|---|---|
| `fetchUnreadCount()` | `GET /api/v1/notifications/unread-count` | on mount + after every mutation (badge) |
| `fetchNotifications({ readType })` | `GET /api/v1/notifications?read_type=U\|A&page&size` | only while panel open; on tab switch; after mutation |
| `markNotificationRead(id)` | `PUT /api/v1/notifications/{id}/read` | row click (only if unread) |
| `markAllNotificationsRead()` | `PUT /api/v1/notifications/read-all` | Read All button |

Defaults sent by `fetchNotifications`: `read_type=A`, `page=0`, `size=50`. Tenant + recipient are
server-side from the JWT — the client never sends `biz_key` / `rcv_id`.

## Badge (unread count)

```ts
const countState = useApiData(() => fetchUnreadCount(), [refreshKey]);
const unreadCount = countState.data?.total_count ?? 0;
```

- Runs on mount even with the panel closed, and re-fires whenever `refreshKey` bumps.
- Errors degrade to `0` (no badge) — a background poll never surfaces a dialog.
- There is **no timer-based polling**; the badge refreshes on mount and on every mutation via `refreshKey`,
  not on an interval. (Interval polling is deliberately out of scope.)

## List

```ts
const listState = useApiData(
  () => open ? fetchNotifications({ readType: tab === "unread" ? "U" : "A" }) : Promise.resolve(null),
  [open, tab, refreshKey],
);
```

- Fetched only while `open`; re-fires on `tab` switch and `refreshKey` bump.
- Stale-while-revalidate: prior rows stay visible during a refetch (no empty flash).
- Rows are mapped via `mapNotificationRow` then filtered **client-side** by the search query over sender
  name / title / content.

## `refreshKey` — the single re-fetch trigger

`const refresh = () => setRefreshKey((k) => k + 1);` bumps a counter that is a dependency of **both** the
badge loader and the list loader, so any mutation re-syncs the badge and the rows together:

- after `markNotificationRead(id)` on row click,
- after `markAllNotificationsRead()`,
- after the Approval Details popup closes.

## Mutations

- **Mark one read:** only called when `!n.read` (already-read rows skip the call but still open the popup);
  then `refresh()`.
- **Mark all read:** guarded by `if (busy || unreadCount === 0) return;` then `refresh()`.
- A `busy` flag serializes mutations so a double-click can't fire two calls.

## Error handling

- Calls unwrap the `{ status, data }` envelope; business errors throw `ApiCallError(code, message)`.
- Row-click / Read-All failures route to `useDialog().open({ type: "error", errorCode })`.
- 401s are handled globally by the Axios session-expired interceptor (`lib/axios.ts`) — not per call.
- `WBE_NOTIFICATION_NOT_FOUND` (mark a stale/foreign id) surfaces as an error dialog carrying that code.

## Wire types

`ApiNotificationListResponse`, `ApiNotificationRow`, `ApiUnreadCountResponse` in `lib/types/api.ts`
(snake_case). `mapNotificationRow` (`lib/api/mappers.ts`) translates to the camelCase `NotificationRow`.
The full-stack ownership rule applies — a backend DTO change flips the wire type + mapper in the same MR.

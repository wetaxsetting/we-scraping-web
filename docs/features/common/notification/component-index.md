# notification — Component Index (Frontend)

**Part of:** Common → notification
**Last verified:** 2026-06-23

Verified file map. ✔ = opened against the working tree on 2026-06-23.

## Components — `components/layout/notifications/`

| File | Role | Notes |
|---|---|---|
| `NotificationPopup.tsx` ✔ | Container | Bell trigger + badge + right-docked slide-over. Owns `open` / `tab` / `query` / `refreshKey` / `busy` / `detailKey` state, `useApiData` loaders, row-click + Read-All handlers. Mounts `CommonApprovalDetailsDialog` on click. |
| `NotificationTabs.tsx` ✔ | Tabs | Unread / All strip; `value` + `onChange` props; active underline. |
| `NotificationSearch.tsx` ✔ | Search | Wraps shared `@/components/shared/SearchInput`; controlled `value`/`onChange`. |
| `NotificationItem.tsx` ✔ | Row | Avatar + sender/time + title/content; read-tint background; whole row is a `<button>` calling `onClick(notification)`. |
| `types.ts` ✔ | Types | `NotificationTab = "unread" \| "all"`; `NotificationRow` (camelCase in-memory: `id`, `notificationId`, `bltbCd`, `notiSeqNo`, `title`, `content`, `senderName`, `senderId`, `notiJson`, `notiWsvc`, `deleted`, `read`, `time`, `userImgUrl`). |

## Mount point

| File | Notes |
|---|---|
| `components/layout/Header.tsx` ✔ | Imports `NotificationPopup` (line 8) and renders `<NotificationPopup />` in the header action group (line 151). |

## API client — `lib/api/notification.ts` ✔

| Export | Signature | Endpoint |
|---|---|---|
| `NotificationReadType` | `"U" \| "A"` | — |
| `fetchNotifications` | `({ readType?, page?, size? }) → Promise<ApiNotificationListResponse>` | `GET /api/v1/notifications` (defaults `read_type=A`, `page=0`, `size=50`) |
| `fetchUnreadCount` | `() → Promise<ApiUnreadCountResponse>` | `GET /api/v1/notifications/unread-count` |
| `markNotificationRead` | `(notificationId: number) → Promise<void>` | `PUT /api/v1/notifications/{id}/read` |
| `markAllNotificationsRead` | `() → Promise<void>` | `PUT /api/v1/notifications/read-all` |

All go through the shared `api` Axios instance (JWT + 401 re-auth bus), `unwrap` the envelope, and `rethrow`
business errors as `ApiCallError(code, message)`.

## Shared collaborators (not in this folder)

| File | Role |
|---|---|
| `lib/api/mappers.ts` → `mapNotificationRow` | snake_case wire row → camelCase `NotificationRow` |
| `lib/api/useApiData.ts` → `useApiData` | mount + refetch fetch hook (badge + list) |
| `lib/types/api.ts` | wire types `ApiNotificationListResponse` / `ApiNotificationRow` / `ApiUnreadCountResponse` |
| `components/shared/SearchInput` | the sanctioned search field |
| `components/shared/dialog` → `useDialog` | system warning/error dialogs |
| `components/payment/shared/CommonApprovalDetailsDialog` | Approval Details popup opened on row click |

## Wire ↔ in-memory boundary

The wire row is snake_case (`ApiNotificationRow` in `lib/types/api.ts`); `mapNotificationRow` translates it
into the camelCase `NotificationRow` at the API boundary. Components consume only the camelCase shape —
they never read snake_case off a response.

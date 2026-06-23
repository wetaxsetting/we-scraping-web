# notification — Screen Flow (Frontend)

**Part of:** Common → notification
**Last verified:** 2026-06-23

User flow for the header-bell notification surface. Source of truth:
`components/layout/notifications/NotificationPopup.tsx`.

## Flow

```
Header bell (always mounted, NotificationPopup)
   │  unread badge ← GET /unread-count (on mount + after every mutation)
   ▼  click bell
Right-docked slide-over panel opens (below the 48px header, flush to viewport right)
   ├─ Tabs: Unread | All ──────────► switch tab refetches list (read_type U|A)
   ├─ Read All button (top-right) ──► PUT /read-all → refresh badge + list
   ├─ Search box ──────────────────► filters the loaded rows client-side
   └─ List (scrollable)
         │  click a row
         ▼
      if !read → PUT /{id}/read, then refresh (badge + tint update)
         ├─ deleted (del_yn='Y') → warning dialog "notification deleted", no navigation
         ├─ has POST_SEQ_NO / APPR_SEQ_NO in noti_json → close panel, open Approval Details popup
         │                                                 ON THE CURRENT PAGE (no router.push)
         └─ neither key → warning dialog "no detail", no navigation
```

## Steps

1. **Badge.** `NotificationPopup` mounts in `Header`. `fetchUnreadCount()` runs on mount and after every
   mutation (via `refreshKey`), so the badge is live even with the panel closed. `> 99` renders `99+`.
   Errors degrade to 0 (no badge) — a background poll never raises a dialog.
2. **Open panel.** Clicking the bell toggles the slide-over. Outside-click and ESC close it (same handling
   as `ProfileMenu`).
3. **List loads** only while the panel is open; re-fires on tab switch and after a mutation. Stale rows
   stay visible during a refetch (no empty flash). Loading shows a spinner; error shows
   `notification.load_error`; empty shows `notification.empty`.
4. **Tabs.** Unread (`read_type=U`) / All (`read_type=A`). Switching changes the fetched set.
5. **Search.** Filters the currently loaded rows client-side on sender name / title / content. (The
   backend also accepts a `search` param for server-side `SND_NAME` match; the panel currently filters in
   memory over the loaded page.)
6. **Row click** (`handleRowClick`):
   - If unread → `markNotificationRead(id)` first (legacy `fn_readOneCommNoti` marks read before the
     `DEL_YN` branch), then `refresh()`.
   - Deleted row → warning dialog, no navigation.
   - Resolve the detail key from `noti_json` (`POST_SEQ_NO` / `APPR_SEQ_NO` / `BLTB_CD`). If present →
     close the bell panel and open `CommonApprovalDetailsDialog` overlaying the current page (no
     `router.push`, the active top menu is preserved). Re-clicking an already-read row re-opens the popup.
   - No business key → warning dialog "no detail", no navigation.
7. **Read All.** Disabled when busy or `unreadCount === 0`. `markAllNotificationsRead()` then `refresh()`.
8. **Approval Details close** → clears `detailKey` and `refresh()` so the just-read row reflects its new
   state.

## Notes

- The Approval Details popup content is a read-only subset (header / status / approver chain / content) —
  transaction rows, attachments, and Approve/Reject actions are a documented follow-up (see the backend
  parity audit). The navigation behaviour itself is correct.
- `noti_json` is parsed defensively — malformed / null degrades to `{}` so a click never throws.

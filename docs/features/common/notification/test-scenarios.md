# notification — Test Scenarios (Frontend)

**Part of:** Common → notification
**Last verified:** 2026-06-23

Manual / future-automated scenarios for the header-bell surface. There are no automated frontend tests for
this module on disk today (◦ = manual / to-automate). Behaviour is sourced from
`NotificationPopup.tsx` + `lib/api/notification.ts`.

## Badge

| # | Scenario | Expected | Status |
|---|---|---|---|
| B1 | Unread count on mount | badge shows `GET /unread-count.total_count`; hidden at 0 | ◦ |
| B2 | Count > 99 | badge renders `99+` | ◦ |
| B3 | Count fetch error | badge degrades to no-badge, no dialog | ◦ |
| B4 | Badge live without opening panel | mounts closed, still shows count | ◦ |

## Open / close

| # | Scenario | Expected | Status |
|---|---|---|---|
| O1 | Click bell | slide-over opens; list fetches (`read_type` per tab) | ◦ |
| O2 | Outside click / ESC | panel closes | ◦ |
| O3 | X button | panel closes | ◦ |

## Tabs + search

| # | Scenario | Expected | Status |
|---|---|---|---|
| T1 | Default tab | Unread tab active on open | ◦ |
| T2 | Switch to All | refetch with `read_type=A` | ◦ |
| T3 | Search | loaded rows filter client-side on sender/title/content | ◦ |
| T4 | Clear search | full loaded set returns | ◦ |

## List states

| # | Scenario | Expected | Status |
|---|---|---|---|
| L1 | Loading | spinner (`Loader2`) | ◦ |
| L2 | Error | `notification.load_error` message | ◦ |
| L3 | Empty | `notification.empty` message | ◦ |
| L4 | Unread vs read tint | unread `bg-brand-soft`, read `bg-white` | ◦ |
| L5 | No-title/content row | renders `notification.untitled`, never blank | ◦ |

## Row click

| # | Scenario | Expected | Status |
|---|---|---|---|
| R1 | Click unread row | `PUT /{id}/read` → refresh → badge decrements + tint flips, then opens Approval Details on current page (no navigation) | ◦ |
| R2 | Click already-read row | no mark call; popup re-opens | ◦ |
| R3 | Click deleted row (`del_yn='Y'`) | warning dialog "deleted", no navigation | ◦ |
| R4 | Row with no `POST_SEQ_NO`/`APPR_SEQ_NO` | warning dialog "no detail", no navigation | ◦ |
| R5 | Mark-read returns `WBE_NOTIFICATION_NOT_FOUND` | error dialog with the code | ◦ |
| R6 | Close Approval Details | `refresh()` re-syncs badge + list | ◦ |

## Read All

| # | Scenario | Expected | Status |
|---|---|---|---|
| A1 | Read All with unread rows | `PUT /read-all` → refresh → badge 0, all rows read | ◦ |
| A2 | Read All when 0 unread | button disabled, no call | ◦ |
| A3 | Read All while busy | guarded, no double-fire | ◦ |

## Auth / transport

| # | Scenario | Expected | Status |
|---|---|---|---|
| X1 | Expired token (401) | global session-expired interceptor handles, not per call | ◦ |
| X2 | No `biz_key`/`rcv_id` sent | requests carry only `read_type`/`page`/`size`/`search` | ◦ |

> When frontend tests are added, mock `lib/api/notification.ts` (Jest/RTL) and assert the refreshKey
> re-fetch wiring + dialog branches; the backend already has `NotificationControllerTest` +
> `NotificationServiceTest` for the contract.

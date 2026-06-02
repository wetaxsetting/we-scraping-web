# Auth > Login Authentication — Frontend Feature Spec

**Domain:** `auth` (system / cross-cutting)
**Refactor slug:** `login-auth`
**Route:** `/login` (slug-based; never a legacy JEX WSVC id)
**Status:** Working
**Backend counterpart:** [`../../../../wecms-api/docs/features/auth/login-auth.md`](../../../../wecms-api/docs/features/auth/login-auth.md)
**JEX functional reference (read-only):** [`../../../../docs/jex/features/login-wecms.md`](../../../../docs/jex/features/login-wecms.md)

> Created 2026-06-01 to resolve **OQ-DOC-1**. Documents an already-implemented feature — no new scope.

## Overview

The login page is the entry point of the Next.js app: a split-screen layout (marketing panel left,
login form right) matching the live WeCMS login. The form has exactly **ID, Password, Save ID, and
LOGIN** — no signup, no forgot-password, no BIZ_KEY chooser (memory `feedback_wecms_login_ui_shape`;
account provisioning is DBA-only).

## Page / Route

- **Route:** `/login` (App Router; public — outside the authenticated layout).
- After successful login the user lands directly on the dashboard (one-user-one-company operational model).

## UI Components

- Login form — `user_id`, `user_pw`, **Save ID** checkbox (browser `localStorage`, client-only), **LOGIN** button (`ks-btn-lg`).
- Error surface — maps the backend `status.code` (`WBE1009/1010/1011/1128`) to a localized message.

## API Integration

| Action | Call | Notes |
|---|---|---|
| Submit login | `POST /api/v1/auth/login` | body `{ user_id, user_pw }`; on success store `access_token` |
| Bootstrap session | `GET /api/v1/auth/me` | on app load / refresh; populates the user store |
| Logout | `POST /api/v1/auth/logout` + clear token | server endpoint is a stub; client clears local token |

- **Token storage** — access token kept client-side; attached as `Authorization: Bearer <token>` by the Axios request interceptor.
- **401 handling** — the Axios response interceptor watches for 401 and surfaces the global session-expired re-auth dialog.
- **Wire shape** — lowercase snake_case (matches backend global Jackson strategy); `StoredUser.productType` is for UI display/gating only, never a security boundary.

## Validation

- `user_id` / `user_pw` required (trimmed). Submit disabled until both present.
- All authoritative validation + lockout lives backend-side; the page only does presence checks.

## Save ID

- Purely client-side `localStorage` (legacy `CookieUtils` "Save ID" equivalent). No server persistence.

## Deferred

Forgot-password · signup · BIZ_KEY chooser UI · refresh-token rotation · multi-company chooser is a
safe fallback only (not a documented business flow — see backend spec).

## Related

- Backend spec: [`../../../../wecms-api/docs/features/auth/login-auth.md`](../../../../wecms-api/docs/features/auth/login-auth.md)
- Permission / role catalogue (shared): [`../../../../docs/_shared/permission-roles.md`](../../../../docs/_shared/permission-roles.md)
- Frontend architecture: [`../../architecture/README.md`](../../architecture/README.md)
- Typography: workspace CLAUDE.md §"Global Typography"

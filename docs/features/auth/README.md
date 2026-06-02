# Features — auth/ (Frontend)

**Cross-cutting system domain** — authentication UI for the Next.js refactor.

Not a WeCMS top-menu group (Banking / Payment / Add-on / Settings). It is a **system feature group**
every authenticated page depends on. Formalized 2026-06-01 to resolve **OQ-DOC-1** (tracked backend-side
at [`../../../../wecms-api/docs/planning/open-questions/documentation-follow-up.md`](../../../../wecms-api/docs/planning/open-questions/documentation-follow-up.md)).

## Docs

| Doc | Scope | Status |
|---|---|---|
| [login-auth.md](login-auth.md) | Login page, session bootstrap (`/me`), logout, token storage, route guard | Working |

## Scope

- **Login page** (`/login`) — ID / password / Save-ID form (no signup, no forgot-password, no BIZ_KEY chooser per memory `feedback_wecms_login_ui_shape`)
- **Session bootstrap** — `GET /api/v1/auth/me` on app load / refresh
- **Logout** — clears the stored token (server logout is a stub)
- **Token storage + Axios interceptor** — Bearer attach + 401 → session-expired re-auth dialog
- **Route guard** — redirect unauthenticated users to `/login`

## What does NOT live here

- **Permission / role catalogue** — shared, [`../../../../docs/_shared/permission-roles.md`](../../../../docs/_shared/permission-roles.md) (pointer: [`../../permissions.md`](../../permissions.md)).
- **Self-service password change** — Settings / ProfileMenu: [`../settings/login-credentials.md`](../settings/login-credentials.md) is bank credentials; password change is a ProfileMenu item handled backend-side under Settings.
- **Bank / GDT login credentials** — *not* authentication: [`../settings/login-credentials.md`](../settings/login-credentials.md).

## Related

- Backend counterpart: [`../../../../wecms-api/docs/features/auth/login-auth.md`](../../../../wecms-api/docs/features/auth/login-auth.md)
- Frontend architecture: [`../../architecture/README.md`](../../architecture/README.md) · state: [`../../architecture/state-management/README.md`](../../architecture/state-management/README.md)
- JEX functional reference (read-only): [`../../../../docs/jex/features/login-wecms.md`](../../../../docs/jex/features/login-wecms.md)

## Naming traceability

Slug `login-auth` matches the backend counterpart and the `login-auth` references in both mapping
files. Routes are slug-based (`/login`), never legacy JEX WSVC ids.

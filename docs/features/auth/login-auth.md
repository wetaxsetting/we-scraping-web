# Auth > Login Authentication — Summary (Frontend)

> ⚠️ **This document is a high-level feature summary.**
> The detailed source of truth is located in:
> `wecms-web/docs/features/auth/{module}/`
>
> Specifically: [login/](login/README.md) · [logout/](logout/README.md) · [session-management/](session-management/README.md)
> (login page, logout, token storage, route guard, and session bootstrap were split into per-module folders
> in the 2026-06-23 Auth standardization).

**Domain:** `auth` (system / cross-cutting)
**Route:** `/login` (slug-based; never a legacy JEX WSVC id)
**Status:** Working

## Overview

The `/login` page is a split-screen layout (marketing panel + form). The form has **ID, Password, Save ID,
LOGIN**. When a user has ≥2 active company links the backend returns a chooser payload and the frontend shows
the **`CompanyChooser`** step (this UI **exists** — the earlier "no BIZ_KEY chooser" note was stale). On
success the token is stored and the user lands on `HOME_ROUTE`.

## Surface (summary)

| Concern | Module |
|---|---|
| Login page, two-step + company chooser | [login/](login/README.md) |
| Logout (ProfileMenu + confirm) | [logout/](logout/README.md) |
| Change Password dialog (**built** — was wrongly marked "not implemented") | [change-password/](change-password/README.md) |
| Profile dropdown (identity, avatar, language) | [profile/](profile/README.md) |
| Token storage + Bearer transport | [jwt-authentication/](jwt-authentication/README.md) |
| Route gating helpers (`menuAuth.ts`) | [authorization/](authorization/README.md) |
| Navigation tree consumption (Sidebar/Header) | [menu-authorization/](menu-authorization/README.md) |
| `fetchMe`, route guard, edge middleware, 401 re-auth | [session-management/](session-management/README.md) |

## Corrections vs. the previous flat doc

- **Company chooser UI exists** (`components/auth/CompanyChooser.tsx`) for the multi-link fallback.
- **Change Password is fully built** (`ChangePasswordDialog` wired into `ProfileMenu`).
- **`?preview=1` client guard removed** — route protection is the `proxy.ts` edge middleware.

## Related

- Module folders: [login/](login/README.md) · [logout/](logout/README.md) · [change-password/](change-password/README.md) · [profile/](profile/README.md) · [jwt-authentication/](jwt-authentication/README.md) · [authorization/](authorization/README.md) · [menu-authorization/](menu-authorization/README.md) · [session-management/](session-management/README.md)
- Backend counterpart: [../../../../wecms-api/docs/features/auth/login/README.md](../../../../wecms-api/docs/features/auth/login/README.md)
- Backend audit deliverables: [../../../../wecms-api/docs/audits/auth-docs-audit.md](../../../../wecms-api/docs/audits/auth-docs-audit.md)

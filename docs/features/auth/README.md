# features/auth/ — Frontend (navigation)

**Cross-cutting system domain** — authentication UI, route protection, and session handling for the Next.js
refactor. Not a WeCMS top-menu group; it is the system feature group every authenticated page depends on.

Standardized 2026-06-23 into **8 per-module folders** (6-file structure each) matching the actual
implementation. The earlier flat `login-auth.md` is now a [summary](login-auth.md).

## Modules

| Module | Scope | Frontend surface | Status |
|---|---|---|---|
| [login](login/README.md) | `/login` page, two-step flow + `CompanyChooser`, Save ID | `app/(auth)/login` + `components/auth/` | Working |
| [logout](logout/README.md) | ProfileMenu logout + confirmation, selective storage clear | `ProfileMenu` + `lib/auth/client.logout` | Working |
| [change-password](change-password/README.md) | Change Password feature dialog | `ChangePasswordDialog` | Working |
| [profile](profile/README.md) | Identity block, avatar (edit = UI-only), language switcher | `ProfileMenu` | Working |
| [jwt-authentication](jwt-authentication/README.md) | Token storage (cookie + localStorage) + Bearer transport | `lib/auth/storage.ts` + `lib/axios.ts` | Working |
| [authorization](authorization/README.md) | Route/menu gating helpers, product-type UX gating | `lib/menuAuth.ts` | Working |
| [menu-authorization](menu-authorization/README.md) | Navigation tree consumption, sidebar/top-nav, entitlement universe | `useNavigation` + `Sidebar`/`Header` | Working |
| [session-management](session-management/README.md) | `fetchMe` rehydrate, route guard, edge middleware, 401 re-auth | `proxy.ts` + dashboard layout + axios interceptor | Working |

## Security boundary

Frontend auth/menu gating is **UX-only** — it hides routes/menus the user can't reach. The backend
`@menuAuthz` guard + signed JWT are the authoritative enforcement layer. Never treat `StoredUser.productType`
or `allowedMenuCds` as a security boundary.

## What does NOT live here

- **Self-service password change** — built; see [change-password/](change-password/README.md).
- **Bank / GDT login credentials** (not authentication) — Settings: [`../settings/login-credentials/README.md`](../settings/login-credentials/README.md).
- **User administration + avatar image CRUD** — Settings: [`../settings/user-management/README.md`](../settings/user-management/README.md).

## Related

- Backend counterpart root: [../../../../wecms-api/docs/features/auth/README.md](../../../../wecms-api/docs/features/auth/README.md)
- Backend audit deliverables: [auth-docs-audit.md](../../../../wecms-api/docs/audits/auth-docs-audit.md) · [auth-gap-analysis.md](../../../../wecms-api/docs/audits/auth-gap-analysis.md) · [auth-source-index.md](../../../../wecms-api/docs/audits/auth-source-index.md)

## Naming traceability

Each module slug matches its backend counterpart at `wecms-api/docs/features/auth/<slug>/`. Routes are
slug-based (`/login`), never legacy JEX WSVC ids.

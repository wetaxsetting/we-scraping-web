# Auth > Profile — Test Scenarios (Frontend)

Manual SIT/UAT scenarios for the ProfileMenu profile surface. Backend scenarios (tenant directory):
[wecms-api/docs/features/auth/profile/test-scenarios.md](../../../../../wecms-api/docs/features/auth/profile/test-scenarios.md).

> **Automated FE tests: MISSING.** There is no `ProfileMenu.test.*` (or any `*.test.*` for the language
> / storage path) in `wecms-web`. The scenarios below are manual until a test harness lands.

---

## Open / close

| # | Scenario | Expected |
|---|---|---|
| O1 | Click the header avatar button | dropdown opens; `aria-expanded=true`; user block + Languages + Change Password + Logout visible |
| O2 | Click outside the dropdown | dropdown closes (`pointerdown` outside `wrapperRef`) |
| O3 | Press ESC with submenu closed | dropdown closes |
| O4 | Press ESC with the language submenu open | only the submenu closes; dropdown stays open (one layer per keypress) |
| O5 | Close then re-open the dropdown | the language submenu starts collapsed (state reset on close) |

## User identity block

| # | Scenario | Expected |
|---|---|---|
| U1 | Signed-in user (`userStorage` populated) | name = `userName`, secondary = `userId`; avatar = `/assets/header/avatar.svg` |
| U2 | No stored user (`userStorage.get()` returns `null`) | name = "Guest" (`profile.guest`); secondary line hidden |
| U3 | `avatarSrc` prop overridden | trigger + popup-header avatar both use the override |
| U4 | Default avatar asset present | `/assets/header/avatar.svg` resolves (asset exists under `public/assets/header/`) |

## Avatar edit (pencil) — MISSING

| # | Scenario | Expected |
|---|---|---|
| AV1 | Click the avatar edit pencil | **no-op** — UI-only placeholder, no handler, no upload dialog opens (documented gap, **MISSING**) |
| AV2 | Pencil a11y | `aria-label` resolves to `t("profile.edit_photo")` ("Edit profile photo") |

## Language switch

| # | Scenario | Expected |
|---|---|---|
| L1 | Open Languages submenu | EN / KO / VI listed; active locale marked with `Check` + `text-brand`; `aria-checked` set on the active radio |
| L2 | Select a different locale → **Yes** | `useDialog()` confirmation (`language.confirm_description` with the target native name) → on Yes, UI re-renders in the new locale, submenu closes, `wecms_locale` persisted |
| L3 | Select a different locale → **No** / dismiss | no locale change; `wecms_locale` unchanged |
| L4 | Re-select the already-active locale | **no-op** — no confirmation dialog (early return) |
| L5 | Locale survives logout | after switching then logging out, the login screen renders in the chosen locale (`wecms_locale` not cleared) |
| L6 | Confirmation prompt language | the prompt body renders in the **current** locale; the target language name shows its native form (e.g. "Tiếng Việt") |

## Change Password

| # | Scenario | Expected |
|---|---|---|
| C1 | Click "Change Password" | dropdown closes + `<ChangePasswordDialog>` opens — see [change-password](../change-password/test-scenarios.md) |

## Logout

| # | Scenario | Expected |
|---|---|---|
| LO1 | Click "Logout" → **Yes** | dropdown closes + confirmation (`logout.confirm_description`) → `logout()` → `router.replace("/login")`; row shows `profile.signing_out` while pending — see [logout](../logout/test-scenarios.md) |
| LO2 | Logout pending state | the Logout row is `disabled` (`cursor-wait` + `opacity-60`) while `isPending` |

## i18n / a11y

| # | Scenario | Expected |
|---|---|---|
| I1 | Every visible string | resolves via `t(...)` in EN / KO / VI (no raw keys shown) |
| I2 | Trigger + card roles | trigger `aria-haspopup="menu"` / `aria-expanded`; card `role="menu"`; rows `role="menuitem"`; locale rows `role="menuitemradio"` + `aria-checked` |
| I3 | Icon fallbacks | Globe / Lock / Pencil render as lucide glyphs (Figma icons not yet exported); power glyph uses `/assets/header/ico-power.svg` |

## Gaps to track (vocabulary per the shared brief)

- **MATCH** — language switch (client-only locale persistence).
- **MISSING** — self-profile-edit and avatar-edit on the profile surface (both live under backend
  Settings > Users); no FE automated tests for ProfileMenu / language / storage paths.

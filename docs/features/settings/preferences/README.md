# Settings > Preferences — Frontend Feature (Refactor)

**Status:** ✅ Wired full-stack — the panel consumes the live `preferences` company-profile API (read /
save / logo upload / delete / stream) **and** the generic Environment Settings endpoint for the two
toggles. No mock fallback in the company-profile path.
**Menu:** Settings → **Preferences** (Settings modal panel — **no standalone route**)
**Slug:** `preferences` (matches the JEX-traceability + backend counterparts)
**Panel key:** `preferences` · **Menu permission:** `settings-core-preference`
**Backend:** `/api/v1/settings/preferences` (GET · PUT · `POST /logo` · `DELETE /logo` · `GET /logo`); toggles on `/api/v1/settings/environment-settings/{00077|00074}`

> This folder is the **primary frontend documentation home** for Preferences. It consolidates and
> indexes the material previously in the single-file [../preferences.md](../preferences.md) (preserved,
> cross-linked). The matching backend docs are at
> [wecms-api/docs/features/settings/preferences/](../../../../../wecms-api/docs/features/settings/preferences/README.md).

---

## What this screen is

The per-tenant **company profile** form, rendered as a **read/edit-mode toggle panel** inside the
Settings modal — the canonical *read-mode vs. edit-mode* example per `wecms-web/CLAUDE.md` §3a. The
admin reads the company profile (logo, Vietnamese name, display name, Tax ID, representative name +
email, address), clicks **Edit** to swap the field list for inputs, then **Save** (PUT) or **Cancel**
(discard). The logo card supports upload (click / drag-drop) and clear in edit mode. The panel also
hosts two always-editable switches — *Use Purpose* and *Use VAS Account* — which persist independently
through the generic Environment Settings endpoint.

It renders as a **panel inside `<SettingsModal>`** (mounted via `<SettingsNav>`) — there is no
`/settings/preferences` URL. View Setting (column-visibility popover) is **not** adopted — this is a
form, not a list.

### Status-label note (honest reflection)

`wecms-web/CLAUDE.md` lists Preferences as **"Static UI · read/edit mode toggle."** That label is
**stale**: the shipped [`<PreferencesPanel>`](../../../../components/settings/preferences/PreferencesPanel.tsx)
is **fully API-wired** — it calls `fetchPreferences` / `updatePreferences` / `uploadPreferencesLogo` /
`deletePreferencesLogo` / `fetchPreferencesLogoBlob` and the two env-setting toggles, with no mock data
in the company-profile path. This doc set documents the real wired behaviour; the "Static UI" status
table entry is flagged for a one-line cleanup. (The read/edit-mode toggle pattern the CLAUDE.md cites is
still exactly correct — only the "Static" qualifier is out of date.)

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Open → fetch profile + toggles → read mode → Edit → Save/Cancel → logo upload/clear/stream → states |
| [ui-specification.md](ui-specification.md) | Header, logo block (3 states), read field list, edit form, toggle rows, loading/empty/error, i18n keys |
| [component-index.md](component-index.md) | Component / hook / API-client / type / i18n file map |
| [api-consumption.md](api-consumption.md) | Endpoints, request/response wire shapes, mappers, error-code → dialog mapping |
| [test-scenarios.md](test-scenarios.md) | SIT/UAT scenarios (read, edit, save, cancel, logo upload/clear/stream, toggles, authz, errors) |

---

## Quick facts

| Aspect | Value |
|---|---|
| Panel | [`<PreferencesPanel>`](../../../../components/settings/preferences/PreferencesPanel.tsx) |
| Mount | [`SettingsModal.tsx`](../../../../components/settings/SettingsModal.tsx) (`panel === "preferences"`) + [`SettingsNav.tsx`](../../../../components/settings/SettingsNav.tsx) |
| Data hook | `useApiData(fetchPreferences, [refreshKey])` (project's lightweight hook — **no** React Query) |
| API client | [lib/api/preferences.ts](../../../../lib/api/preferences.ts) (+ [lib/api/environmentSettings.ts](../../../../lib/api/environmentSettings.ts) for toggles) |
| Mode toggle | single `isEditing` `useState` — read field list ↔ edit form; Cancel discards the draft |
| Logo | upload (click / drag-drop, ≤2 MB, jpg/jpeg/png/gif — SVG rejected, F-02 stored-XSS) · clear (trash) · stream via JWT blob → object URL |
| Toggles | *Use Purpose* (`00077`) / *Use VAS Account* (`00074`) — always editable; per-flip PUT; independent of Edit mode |
| View Setting | **not adopted** (form, not list) |
| Wire convention | lowercase snake_case wire types consumed directly by the panel (no separate mapper layer for this feature) |

---

## Related docs

- **Backend feature folder:** [wecms-api/docs/features/settings/preferences/](../../../../../wecms-api/docs/features/settings/preferences/README.md)
- **Backend Environment Settings (toggles):** [wecms-api/docs/features/settings/environment-settings.md](../../../../../wecms-api/docs/features/settings/environment-settings.md)
- **Preserved single-file spec (frontend):** [../preferences.md](../preferences.md)
- **Settings feature index:** [../README.md](../README.md)

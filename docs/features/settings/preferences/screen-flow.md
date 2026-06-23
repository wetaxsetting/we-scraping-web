# Preferences — Screen Flow (Frontend)

Interaction flow for the Preferences panel. Backend flow:
[wecms-api/docs/features/settings/preferences/business-flow.md](../../../../../wecms-api/docs/features/settings/preferences/business-flow.md).

```
Top nav → Settings → <SettingsModal> opens → SettingsNav → "Preferences"
      │  (visible when the session has the settings-core-preference grant or is admin)
      ▼
<PreferencesPanel> mounts
      │  profile  = useApiData(() => fetchPreferences(), [refreshKey])
      │  logoBlob = fetchPreferencesLogoBlob() → URL.createObjectURL  (re-fetched when logo_url flips)
      │  toggles  = fetchEnvironmentSetting(00077) + fetchEnvironmentSetting(00074)  (mount-only)
      ▼
Read mode renders: logo card + read-only company field list + two toggle rows
```

---

## States

| State | Trigger | UI |
|---|---|---|
| **Read (idle)** | panel mount, GET resolves | logo card (image or placeholder) + read field list (`<dl>` rows) + Use Purpose / Use VAS toggle rows; header shows the **Edit** button |
| **Loading** | profile GET in flight | field list shows `common.loading`; sticky-loading smooths a fast cached round-trip |
| **Edit** | click **Edit** | `draft` seeded from the loaded profile; header swaps Edit → **Cancel + Save**; read field list → input grid; logo card becomes the click/drag picker target + shows the trash button when a logo exists |
| **Save** | click **Save** | client validation (required + email shape) → `updatePreferences(toRequest(draft))` → on success flip back to read mode + bump `refreshKey` (re-fetch); on error → `useDialog()` error dialog |
| **Cancel** | click **Cancel** | discard the draft, flip back to read mode, no network call |
| **Validation error** | Save with bad/missing required field | error dialog (`settings.preferences.error.*`) — Save does NOT fire the PUT |
| **Logo — upload** | edit mode, click card / drag-drop a file | client size + MIME pre-check → `uploadPreferencesLogo(file)` → bump `refreshKey` (re-fetch + re-stream); errors → error dialog |
| **Logo — clear** | edit mode, click the trash on a populated logo | `deletePreferencesLogo()` → bump `refreshKey` |
| **Logo — empty (read)** | no logo set, read mode | soft-blue card, `<ImageOff>` icon + "No Image" — decorative, not clickable |
| **Logo — empty (edit)** | no logo set, edit mode | soft-blue dashed card, `<UploadCloud>` icon + "drag & drop or browse" — whole card is the click target + drop zone |
| **Toggle flip** | click Use Purpose / Use VAS switch | `updateEnvironmentSetting(code, { env_set_cont: "Y"\|"N" })` fires immediately; local boolean mirrors the persisted value; error → error dialog. **Independent of Edit mode** — toggles are always editable |
| **No tenant row** | GET returns `WBE2080` | error surfaces via the data hook's failure path (should not happen post-login) |

---

## Refresh model

A `refreshKey` `useState` drives the profile re-fetch. Save / logo-upload / logo-delete bump it; the
`useApiData(fetchPreferences, [refreshKey])` hook re-runs and the read-mode field list reflects the
persisted values without a full page reload. The logo blob effect watches `profile.data.logo_url`
(which carries a `?v=<filename>` cache-buster that flips on every upload) and re-fetches + re-creates
the object URL, revoking the previous one on unmount/re-fetch so blob handles don't leak.

The two toggles are loaded **mount-only** and mirrored locally — each successful flip already returns
the persisted value, so they are never re-pulled after the initial load (avoids one toggle transiently
re-rendering OFF while the other's refetch is in flight).

---

## Logo streaming (JWT-protected)

The logo GET endpoint requires the bearer token, which a plain `<img src>` cannot carry. So the panel
fetches the bytes via `fetchPreferencesLogoBlob()` (Axios with the JWT interceptor, `responseType:
"blob"`), wraps them in an object URL, and pins that to the `<img>`. A `WBE2082` ("no logo set") from
the stream resolves to `null` → the placeholder card. Object URLs are revoked on unmount / re-fetch.

---

## Authorization & visibility

The Preferences entry appears in `<SettingsNav>` only when the session is admin or the granted menu
codes include `settings-core-preference`. The backend independently enforces
`@menuAuthz.canAccess('settings-core-preference')` on every endpoint — the frontend gate is UX, the
backend gate is the security boundary.

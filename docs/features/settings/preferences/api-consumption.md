# Preferences — API Consumption (Frontend)

Endpoints the panel calls, request/response wire shapes, and the error → dialog mapping. Backend
contract: [wecms-api/docs/features/settings/preferences/interface-specification.md](../../../../../wecms-api/docs/features/settings/preferences/interface-specification.md).
All calls go through [lib/api/preferences.ts](../../../../lib/api/preferences.ts) /
[lib/api/environmentSettings.ts](../../../../lib/api/environmentSettings.ts) (Axios `api` with JWT
interceptor); wire is lowercase snake_case.

---

## Endpoints

### Company profile + logo ([lib/api/preferences.ts](../../../../lib/api/preferences.ts))

| Action | Client fn | Method + URL | Request | Response |
|---|---|---|---|---|
| Read profile | `fetchPreferences()` | `GET /api/v1/settings/preferences` | — | `ApiPreferencesResponse` |
| Save profile | `updatePreferences(body)` | `PUT /api/v1/settings/preferences` | `ApiPreferencesUpdateRequest` | `ApiPreferencesResponse` (echo) |
| Upload logo | `uploadPreferencesLogo(file)` | `POST .../logo` (multipart `file`) | `File` | `ApiPreferencesResponse` (refreshed) |
| Clear logo | `deletePreferencesLogo()` | `DELETE .../logo` | — | `ApiPreferencesResponse` (refreshed) |
| Stream logo bytes | `fetchPreferencesLogoBlob()` | `GET .../logo` (`responseType: blob`) | — | `Blob \| null` (null on `WBE2082`) |

### Toggles ([lib/api/environmentSettings.ts](../../../../lib/api/environmentSettings.ts))

| Action | Client fn | Method + URL | Code |
|---|---|---|---|
| Read toggle | `fetchEnvironmentSetting(code)` | `GET /api/v1/settings/environment-settings/{code}` | `00077` Use Purpose · `00074` Use VAS Account |
| Flip toggle | `updateEnvironmentSetting(code, { env_set_cont })` | `PUT .../{code}` | `env_set_cont: "Y" \| "N"` |

---

## Wire shapes (snake_case)

```ts
interface ApiPreferencesAddress {
  post_address:   string;
  detail_address: string | null;
  city:           string;
  state:          string;
}

interface ApiPreferencesResponse {
  vietnamese_name:      string;
  display_name:         string | null;
  tax_id:               string;
  representative_name:  string | null;
  representative_email: string;
  tel_no:               string | null;
  fax_no:               string | null;
  address:              ApiPreferencesAddress;
  logo_url:             string | null;   // streaming GET URI + ?v=<filename>; null when no logo
  modified_by:          string | null;
  modified_at:          string | null;   // ISO-8601 with offset
}

interface ApiPreferencesUpdateRequest {
  vietnamese_name:      string;
  display_name?:        string | null;
  tax_id:               string;
  representative_name?: string | null;
  representative_email: string;
  tel_no?:              string | null;
  fax_no?:              string | null;
  address:              ApiPreferencesAddress;
}
```

For the env-toggle read/update shape (`ApiEnvironmentSetting` with `env_set_cont`), see the Environment
Settings client.

---

## Mapping (boundary)

This feature does **not** use a shared `lib/api/mappers.ts` entry. The panel consumes
`ApiPreferencesResponse` directly for the read field list and converts to/from a local camelCase
`DraftState` for the edit form via in-file helpers in
[`PreferencesPanel.tsx`](../../../../components/settings/preferences/PreferencesPanel.tsx):

- `toDraft(p: ApiPreferencesResponse): DraftState` — flattens `address.*` into `addressPost` / `addressDetail` / `addressCity` / `addressState` and maps every field to camelCase.
- `toRequest(d: DraftState): ApiPreferencesUpdateRequest` — trims required fields, `emptyToNull`s optionals, re-nests the address.
- `composeAddress(p)` — joins the four address parts with `", "` (drops nulls/empties) for the read-mode single-line value.

---

## Logo streaming (blob → object URL)

The logo GET is JWT-protected (a plain `<img src>` can't carry the bearer token), so:

```
logo_url flips (e.g. after upload, with a new ?v=)  →  fetchPreferencesLogoBlob()  →  URL.createObjectURL(blob)  →  <img src={objectUrl}>
```

`fetchPreferencesLogoBlob` reads the response with `responseType: "blob"`. Because Axios still returns
the JSON **error** envelope as a Blob on a non-2xx, the client inspects the blob's content type; if it
is JSON and `status.code === "WBE2082"` ("no logo set") it returns `null` (→ placeholder card);
otherwise it throws `ApiCallError`. Object URLs are revoked on unmount / re-fetch.

---

## Envelope + error handling

Every JSON response is the standard `{ status: { error, code, message }, data, … }`. Clients check
`status.error` (HTTP 200 ≠ success for business errors) and throw `ApiCallError` carrying `status.code`.
`<PreferencesPanel>` opens an error dialog (`type: "error"`, `title: t("dialog.error")`,
`errorCode: apiErr.code`) for every failed mutation. There is no success dialog on profile save (the
panel silently returns to read mode).

| Wire code | Dialog / handling |
|---|---|
| `WBE_VALIDATION` | error — backend validation failure (client also pre-validates required + email shape) |
| `WBE2080` | error — no `BUSI_INFM` row (should not happen post-login) |
| `WBE2081` | error — logo disk write failed |
| `WBE2082` | **not a dialog** — `fetchPreferencesLogoBlob` returns `null` → placeholder card |
| `WBE2083` | error — logo file unavailable |
| `WBE2084` / `WBE2085` / `WBE2086` / `WBE2087` | error — logo filename / empty / too-large / type (client pre-checks `logo_empty` / `logo_too_large` / `logo_type` first to avoid a doomed round-trip) |
| network | error — `ApiCallError("NETWORK", …)` |
| 401 | global Axios response interceptor (session-expired re-auth) — not per call |

Toggle failures (`updateEnvironmentSetting`) open the same `type: "error"` dialog via the shared
`toggleEnv` helper.

## Notes

- **No mock fallback** in the company-profile path — unlike the static-UI Settings panels, Preferences
  paints from the live GET (and shows `common.loading` until it resolves).
- The two toggles are mount-only fetched and mirrored locally; each flip persists immediately and is
  independent of the panel's Edit mode.
- Client-side logo pre-checks mirror the backend cap (2 MB) + allow-list (`image/jpeg`, `image/png`,
  `image/gif`, `image/svg+xml`); the backend re-enforces via `WBE2086` / `WBE2087`.

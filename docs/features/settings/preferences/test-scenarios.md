# Preferences — Test Scenarios (Frontend)

Manual SIT/UAT scenarios for the Preferences panel. Backend scenarios:
[wecms-api/docs/features/settings/preferences/test-scenarios.md](../../../../../wecms-api/docs/features/settings/preferences/test-scenarios.md).

---

## Read

| # | Scenario | Expected |
|---|---|---|
| R1 | Open the Preferences panel | profile loads; logo card + 5-row read field list + two toggle rows render; header shows **Edit** |
| R2 | Loading | field list shows `common.loading` until the GET resolves (sticky-loading smooths a fast cached round-trip) |
| R3 | No logo set | logo card shows the "No Image" placeholder (`<ImageOff>`); `logo_url` was null |
| R4 | Address rendering | read-mode address is the four parts joined by `", "` (nulls/empties dropped) |

## Edit / Save / Cancel

| # | Scenario | Expected |
|---|---|---|
| E1 | Click **Edit** | header swaps to **Cancel + Save**; read list → input grid seeded from the loaded profile |
| E2 | Edit a field + **Save** | `PUT /preferences` fires; on success → back to read mode + refetch shows the new value; no success dialog |
| E3 | **Cancel** | draft discarded, back to read mode, **no** network call |
| E4 | Save with empty Vietnamese Name | error dialog (`settings.preferences.error.vietnamese_name_required`); PUT not sent |
| E5 | Save with empty Tax ID | error dialog (`...tax_id_required`) |
| E6 | Save with empty Email | error dialog (`...email_required`) |
| E7 | Save with malformed email | error dialog (`...email_invalid`); backend `@Email` is the second guard |
| E8 | Save with empty address | error dialog (`...address_required`) |
| E9 | Backend rejects the save (`WBE_VALIDATION`) | `type: "error"` dialog with the server code/message |

## Logo upload / clear / stream

| # | Scenario | Expected |
|---|---|---|
| L1 | Edit mode, click the logo card, pick a valid PNG | uploads; card re-streams the new image after refetch |
| L2 | Edit mode, drag-drop a valid image onto the card | same as L1 (drop zone) |
| L3 | Empty (0-byte) file | error dialog `settings.preferences.error.logo_empty` (client pre-check, no round-trip) |
| L4 | File > 2 MB | error dialog `settings.preferences.error.logo_too_large` (client pre-check) |
| L5 | Disallowed type (e.g. `.bmp`) | error dialog `settings.preferences.error.logo_type` (client pre-check) |
| L6 | Backend rejects (`WBE2086` / `WBE2087`) | error dialog with the server code (defence-in-depth past the client pre-check) |
| L7 | Click trash on a populated logo (edit mode) | `DELETE /logo` → placeholder card after refetch |
| L8 | Re-pick the same filename | the file input is reset (`value=""`) so the same file re-triggers a change |
| L9 | Logo image renders | streamed via JWT blob → object URL (not a plain `<img src>` to the protected GET) |
| L10 | Stream returns `WBE2082` | blob client returns `null` → placeholder card (no error dialog) |
| L11 | Logo controls in read mode | card is decorative; no click / drop / trash |

## Toggles (always editable, independent of Edit mode)

| # | Scenario | Expected |
|---|---|---|
| T1 | Flip **Use Purpose** | `PUT /environment-settings/00077` fires immediately; local state mirrors the persisted value |
| T2 | Flip **Use VAS Account** | `PUT /environment-settings/00074` fires |
| T3 | Edit-mode label change for VAS | in edit mode the VAS row shows the "VAS Code" title/description (`use_vas_code.*`) per Figma 154:24540 |
| T4 | Toggle works while NOT in Edit mode | toggles flip regardless of the panel's read/edit state |
| T5 | Toggle PUT fails | `type: "error"` dialog; local state not advanced past the failure |

## Authorization

| # | Scenario | Expected |
|---|---|---|
| A1 | User with `settings-core-preference` | Preferences appears in `<SettingsNav>`; all actions work |
| A2 | User without the grant | Preferences entry hidden from `<SettingsNav>`; direct API attempts 403 server-side |

## Error handling

| # | Scenario | Expected |
|---|---|---|
| ERR1 | Backend unreachable on load | data-hook failure path; error surfaced (no mock fallback — Preferences has no `mockData.ts`) |
| ERR2 | API failure on save / logo / toggle | `type: "error"` dialog with the mapped code/message |
| ERR3 | Session expired (401) | global Axios interceptor triggers the re-auth dialog |

## Export

N/A — Preferences is a form; there is no data export, no template download, no print.

## Cross-cutting

- Verify the panel is a clean **read ↔ edit toggle** — one component, one `isEditing` state; Cancel
  reliably discards the draft.
- Verify the modal shell rules: ESC / X close the Settings shell only when no child popup is open; the
  collapse arrow toggles the sidebar width only.
- Verify all visible strings resolve via `t(...)` in EN / KO / VI.
- Verify object URLs are revoked (no blob-handle leak) on repeated logo upload / panel close.

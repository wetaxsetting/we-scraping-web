# Preferences — UI Specification (Frontend)

The implemented Preferences panel UI. Follows the Settings shell + panel-composition contract and the
Settings UI consistency rules in `wecms-web/CLAUDE.md` §3a / §3b. Figma: 142:17995 (read) + 154:24540
(edit). Panel: [`<PreferencesPanel>`](../../../../components/settings/preferences/PreferencesPanel.tsx).

> Preferences is the canonical **read-mode vs. edit-mode toggle panel** reference per CLAUDE.md §3a —
> one component handles both states, gated by a single `isEditing` `useState`; the header swaps the
> button group; form fields render as plain text in read mode and inputs in edit mode over the same
> layout.

---

## Header

- **Title:** "Preferences" (`settings.preferences.title`) at `text-wb-18 font-semibold tracking-wb-tight
  text-wb-dark`; description below at `mt-1 text-wb-13 font-normal text-wb-muted`.
- **Read mode:** single **Edit** button (`Pencil` icon + `settings.preferences.edit`) — white +
  `shadow-wb-btn`, `h-8 px-3 text-wb-14-tight font-medium`. Disabled until the profile loads.
- **Edit mode:** **Cancel** (white `shadow-wb-btn`) + **Save** (`bg-brand` `shadow-wb-brand-btn`) pair;
  both disabled while saving.
- Header padding `px-8 pb-5 pt-[calc(var(--spacing)*14)]` (drops the title below the shell's Esc/X group).

---

## Company section

Section heading "Company" (`settings.preferences.company.title`) at `text-wb-15 font-semibold
tracking-wb-tight text-wb-ink` + description. Contains the **logo block** then either the **read field
list** or the **edit form**.

### Logo block (`<LogoBlock>`) — three visual states

`117px`-tall card, max-width `401px`, rounded `10px`:

1. **Logo present** — renders the streamed image (object URL) on a cream card (`bg-[#fefdf9]`, a
   documented Figma-asset exception). In edit mode a red trash button (`Trash2`, `text-wb-red-07`) sits
   bottom-right to clear it.
2. **Empty + read mode** — soft-blue card (`bg-brand-soft`), `<ImageOff>` icon + "No Image"
   (`settings.preferences.empty_logo`). Decorative, not clickable.
3. **Empty + edit mode** — soft-blue card with a **dashed brand-blue** border, `<UploadCloud>` icon +
   "… drag & drop or browse …" (`settings.preferences.upload_prompt.{before,browse,after}`). The whole
   card is the click target + a drop zone (`dragOver` highlights the border `border-brand`).

Logo input is a hidden `<input type="file" accept="image/jpeg,image/png,image/gif,image/svg+xml">`; the
card click / drop forwards the file to `submitLogoFile`. Client pre-checks (mirror the backend) run
before the request:
- empty file → `settings.preferences.error.logo_empty`
- > 2 MB → `settings.preferences.error.logo_too_large`
- MIME not in `{ image/jpeg, image/png, image/gif, image/svg+xml }` → `settings.preferences.error.logo_type`

### Read field list (`<CompanyFieldList>`)

A `<dl>` of label/value rows (each `border-b border-wb-ntrl-3 py-3`): label cell `w-[191px]`
`text-wb-14 font-medium text-wb-ntrl-8` with a red `*` for required fields; value cell `text-wb-14
font-medium text-wb-dark`.

| Field | Source (wire) | Required | Notes |
|---|---|---|---|
| **Vietnamese Name** | `vietnamese_name` | ✅ | |
| **Display Name** | `display_name` | — | blank when null |
| **Tax ID** | `tax_id` | ✅ | |
| **Representative Email** | `representative_email` | ✅ | |
| **Address** | composed from `address.*` | ✅ | post + detail + city + state joined by `", "` (nulls/empties dropped) |

While loading or before data resolves, the list shows `common.loading`.

> Read mode surfaces 5 fields; the edit form (below) edits a superset that includes optional `tel_no` /
> `fax_no` and the discrete address parts. `representative_name`, `tel_no`, `fax_no`, and
> `address.detail_address` round-trip through the draft but the read list shows only the five rows above
> (matches Figma 142:17995).

### Edit form (`<CompanyEditForm>`)

Inputs over the same column rhythm. Two-column grids:
- Row 1: **Vietnamese Name*** | **Tax ID***
- Row 2: **Display Name** | **Representative Email***
- Full width: **Address*** — a resizable `<textarea>` (`settings.preferences.placeholder.address`,
  `text-wb-14 leading-[18px]` — the documented textarea exception). Bound to `draft.addressPost`.

Inputs are `h-8` `text-wb-14-tight font-medium` with `shadow-wb-outline` / focus `shadow-wb-focus`.
Labels carry the required `*` in `text-wb-error`.

> The form's address `<textarea>` writes to `addressPost` only; `detail_address` / `city` / `state` are
> carried in the draft (seeded from the loaded row) and re-sent on Save. The Figma edit frame shows a
> single address textarea, so city/state are preserved-not-edited in the current panel.

---

## Purpose & VAS section (`<PurposeVasSection>`)

Heading "Purpose & VAS" (`settings.preferences.purpose_vas.title`) + two rows (`border-b` between them):

| Row | Title key (read) | Title key (edit) | Toggle code |
|---|---|---|---|
| **Use Purpose** | `settings.preferences.use_purpose.title` | (same) | `00077` |
| **Use VAS Account** | `settings.preferences.use_vas.title` | `settings.preferences.use_vas_code.title` | `00074` |

Each row: title + description (left), an ON/OFF label (`settings.preferences.toggle.{on,off}`) + a
`<ToggleSwitch tone="brand">` (right). **The toggles are always editable** — independent of the panel's
Edit mode (which gates only the company-profile fields). Each flip persists immediately via
`updateEnvironmentSetting` and surfaces an error dialog on failure (legacy `comm_0215_001` behaviour +
the Firm Banking Settings precedent).

---

## Scroll / composition

Panel shape per §3a: `flex min-h-0 flex-1 flex-col` → `shrink-0` header → `min-h-0 flex-1
overflow-hidden px-8 pb-6` body whose inner `custom-scrollbar h-full overflow-y-auto` region holds the
company section + toggle section in a `gap-8` stack. No pinned-bottom row (no pagination — it is a form).

---

## States

Loading / empty-logo / error per [screen-flow.md](screen-flow.md). All error dialogs use `type:
"error"` with `title: t("dialog.error")` and the appropriate `errorCode`; there is no success dialog on
profile save (it silently flips back to read mode after the PUT resolves). Logo / toggle failures open
an error dialog carrying the `ApiCallError` code + message.

---

## i18n keys (namespace `settings.preferences.*`)

`title` · `description` · `edit` · `cancel` · `save` · `logo` · `pick_logo` · `delete_logo` ·
`empty_logo` · `upload_prompt.{before,browse,after}` · `company.{title,description}` ·
`field.{vietnamese_name,display_name,tax_id,representative_email,address}` ·
`placeholder.address` · `purpose_vas.title` · `use_purpose.{title,description}` ·
`use_vas.{title,description}` · `use_vas_code.{title,description}` · `toggle.{on,off}` ·
`error.{logo_empty,logo_too_large,logo_type,vietnamese_name_required,tax_id_required,email_required,address_required,email_invalid}`.
Plus the shared `dialog.error` / `common.loading` and the nav label `settings.nav.preferences`. All
present in `locales/{en,ko,vi}.json`.

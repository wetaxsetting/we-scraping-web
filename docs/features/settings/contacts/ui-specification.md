# Contacts — UI Specification (Frontend)

The implemented UI of the Contacts Settings panel. Components under
[components/settings/contacts/](../../../../components/settings/contacts/). i18n keys under
`settings.contacts.*`.

---

## Main page ([`ContactsPanel.tsx`](../../../../components/settings/contacts/ContactsPanel.tsx))

- **Header** — title `settings.contacts.title` + description.
- **Filter row:**
  - **Keyword** `<SearchInput>` (`settings.contacts.search_placeholder`) — server matches contact code
    / name / Tax ID.
  - **Type** — `FilterCheckbox` `showLocal` / `showOverseas`. Local-only → `trco_type="L"`;
    Overseas-only → `"O"`; both → no filter; both off → sentinel `search:" __none__"` (show none).
  - No status filter (backend excludes `trco_stts='C'`).
- **Toolbar (right):**
  - **Delete Selected** (destructive) — only when `selectedIds.size > 0` → confirm → `removeMany`.
  - **Download** dropdown ([`DownloadDropdown`](../../../../components/settings/contacts/DownloadDropdown.tsx)).
  - **Excel Upload** button (brand-green `bg-[#15803d]`, documented §3b/§F exception) → `ExcelUploadDialog`.
  - **Add** (brand) → `AddNewContactDialog`.
- **Pagination** — server-side, 1-based local / zero-based wire, default page size 10; page-size change
  clears selection. Sorting via `useTableSort` (default→ASC→DESC→default).

## Contact grid ([`ContactsTable.tsx`](../../../../components/settings/contacts/ContactsTable.tsx))

`table-fixed`, `min-w-[1264px]`, sticky thead, 60 px rows. **Fixed 8-column layout (not View-Setting-driven):**

| # | Column | Width | i18n | Sortable (FIELD_ID) |
|---|---|---|---|---|
| 1 | Checkbox (select all / row) | 44px | `select_all` | — |
| 2 | **Contact Code** | 120px | `col.contact_code` | yes (`HAND_TRCO_KEY`) |
| 3 | **Contact Name** | 200px | `col.contact_name` | yes (`TRCO_CMNM`) — rendered uppercase |
| 4 | **Location** (Local/Overseas) | 140px | `col.location` | yes (`TRCO_TYPE`) |
| 5 | **Tax ID** | 170px | `col.tax_id` | yes (`TRCO_TAX_ID`) |
| 6 | **Deposit Account** (bank name + acct no., 2-line) | 210px | `col.deposit_account` | no |
| 7 | **Address** (current, truncated + `+N` badge) | 320px | `col.address` | no |
| 8 | Row-action kebab `⋮` | 60px | — | — |

> **No separate English-Name / Phone / Email columns.** English name (`trco_cmenm`) exists in the data
> model but is not shown; Phone/Email are not part of this feature's data model at all. The Deposit
> Account cell renders `accounts[0]` (Local) or `overseas_beneficiaries[0]` (Overseas); renders empty
> when both absent (Local may save with no bank).

## Create / Edit dialog ([`AddNewContactDialog.tsx`](../../../../components/settings/contacts/AddNewContactDialog.tsx) + [`EditContactDialog.tsx`](../../../../components/settings/contacts/EditContactDialog.tsx))

Radix dialog, `max-w-[500px]`, `stackLevel=2`. `EditContactDialog` seeds from the row, calls
`loadDetail` (`GET /{trcoKey}`) → `toFormValues`, then renders `AddNewContactDialog` in edit mode.

**Sections (top → bottom):**

1. **Primary fields**
   - **Contact Code** — required `*`; strips all whitespace on input/paste; inline dup error (`msg1`,
     `WBE_CONTACTS_HAND_KEY_DUP`).
   - **Contact Name** — required `*`.
   - **Tax ID** — optional; digit-only mask, auto-formats `XXXXXXXXXX-YYY` past 10 digits; errors
     `msg2` (dup, `WBE_CONTACTS_TAX_ID_DUP`) / `msg3` (format — must be 10 or 13 digits).
   - **Local / Overseas radio** — edit-mode switch confirms and queues the leaving side's keys for delete.
   - **English Name** has no input — `contactEnglishName` is auto-set to `contactName` (legacy parity).
2. **Type-specific block**
   - **Local → Deposit-account cards** — Bank picker typeahead (NAPAS + CITAD; filters on
     `eng_abrvat_nm`/`bank_nm`/`bank_eng_nm`); Currency dropdown (VND/USD); Account No.; Recipient flow
     (verified **Lookup Recipient** button when `bankDiv==="NAPAS" && currency!=="USD" && bankCd`, else
     manual Recipient Name input). "Add another account" clones a card; last card cannot be removed.
   - **Overseas → beneficiary blocks** — Beneficiary Name, Beneficiary Bank Name, BIC (SWIFT),
     Beneficiary Account No., Beneficiary Address. Duplicate (BIC, Account No.) guarded at submit. Only
     `overseasList[0]` ships to the wire (MVP).
3. **Addresses** — Current Address textarea (required for Local), plus optional "Add Changed Address"
   block with a **Valid Till** date (DD-MM-YYYY, min = tomorrow). Current → `disp_ord=1`,
   changed/old → `disp_ord=2`.
4. **Attachments** — [`AttachmentsSection`](../../../../components/settings/contacts/AttachmentsSection.tsx).

**Submit validation chain:** reset inline msgs → Tax-ID format → overseas dup-(BIC,acct) → `buildValues`
→ inline required (code / name / Local address) → Zod `validateContact` → POST/PUT. Backend dup codes
map back to inline `msg1`/`msg2`.

## Address handling ([`AddressPopover.tsx`](../../../../components/settings/contacts/AddressPopover.tsx))

Portal-mounted hover/focus card (320 px, auto-flips). Shows **Address(Current)** (with a "Default"
badge) and **Address(Old)** (previous value + optional valid-till date, locale-formatted). Current =
`disp_ord=1`, old = `disp_ord=2`; derivation in [`mappers.ts`](../../../../components/settings/contacts/mappers.ts).

## Bank-info handling

- **Local** — NAPAS+CITAD typeahead; on pick stamps label / `bankCd` / `bankDiv` / `bankStatus`. Mapper
  splits `bankCd` into `napas_bank_cd` (NAPAS) or `citad_bank_cd` (CITAD). Currency restricted to
  VND/USD. Bank list fetched once on mount (`GET /banks`).
- **Overseas** — free-text Beneficiary Bank Name + BIC + Account No.; no picker.

## Attachments ([`AttachmentsSection.tsx`](../../../../components/settings/contacts/AttachmentsSection.tsx))

- **Add mode** — files stage locally, uploaded sequentially after create.
- **Edit mode** — list loads on mount; upload/delete fire immediately.
- Limits: max 10 MB; allow-list `jpg/jpeg/png/gif/pdf/doc/docx/xls/xlsx/ppt/pptx`. Server stamps title
  `"Business Registration"` (first file) / `"New document"`. Download via shared `lib/file.ts`.

## Export UI ([`DownloadDropdown.tsx`](../../../../components/settings/contacts/DownloadDropdown.tsx))

Split dropdown (Excel icon + "Download" + chevron), two items: **Local Contacts** / **Overseas
Contacts** → `exportContacts({ type, keyword })` → `POST /export` via shared `lib/excel.ts`. Screen-id
`settings-contacts-local` (9 cols) / `settings-contacts-overseas` (11 cols); filename = localized
title; `.xlsx` appended by the shared pipeline. Live data, active-only, tenant-scoped server-side.

## Import UI ([`ExcelUploadDialog.tsx`](../../../../components/settings/contacts/ExcelUploadDialog.tsx))

Wraps the shared `components/shared/excel-upload/ExcelUploadDialog` (`stackLevel=2`). Variant radio
Local/Overseas. Flow: **Download** static template (`public/templates/contacts/`, locale; KM→EN) →
**Browse** (template-signature gate via `validateExcelTemplate`) → **parse** (data from row 3, 500-row
cap, per-row validation mirroring legacy `comm_0184_007_r001`) → **preflight** + **resolve-recipients**
(Local only, parallel — paint duplicate / unknown-bank cells red) → **Upload** (`POST /excel/import`,
partial success surfaced). Preview columns mirror the export column sets (Local 10 with Recipient,
Overseas with hardcoded "USD" display).

## i18n keys

All visible strings via `t(...)` under `settings.contacts.*` (title, search placeholder, column
labels `col.*`, dialog fields, `download_local` / `download_overseas`, `delete_error.in_use`, upload
chrome) — present in `en.json` / `ko.json` / `vi.json`.

## Documented style exceptions

- Excel Upload trigger uses `bg-[#15803d]` (brand-asset green) — sanctioned exception (CLAUDE.md §3b/§F).
- Contact dialog textareas use `text-wb-14 + leading-[18px]` — sanctioned exception (CLAUDE.md §F).

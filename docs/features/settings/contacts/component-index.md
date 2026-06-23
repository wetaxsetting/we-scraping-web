# Contacts — Component Index (Frontend)

File map for the Contacts Settings panel. All paths relative to `wecms-web/`.

---

## Components ([`components/settings/contacts/`](../../../../components/settings/contacts/))

| File | Role |
|---|---|
| [ContactsPanel.tsx](../../../../components/settings/contacts/ContactsPanel.tsx) | Main panel — header, filter row (keyword + Local/Overseas), toolbar (Delete Selected / Download / Excel Upload / Add), table, pagination, dialog wiring, delete-error mapping |
| [ContactsTable.tsx](../../../../components/settings/contacts/ContactsTable.tsx) | Fixed 8-column grid, selection (header tri-state + row), sort headers, `DepositAccountCell` + `AddressCell` |
| [AddNewContactDialog.tsx](../../../../components/settings/contacts/AddNewContactDialog.tsx) | Create/Edit form (primary fields, type-specific deposit/beneficiary blocks, addresses, attachments, validation chain) |
| [EditContactDialog.tsx](../../../../components/settings/contacts/EditContactDialog.tsx) | Edit wrapper — seeds fallback, `loadDetail` → `toFormValues`, renders `AddNewContactDialog` edit mode |
| [AddressPopover.tsx](../../../../components/settings/contacts/AddressPopover.tsx) | Hover/focus card showing current (`disp_ord=1`) + old (`disp_ord=2`) address with valid-till |
| [AttachmentsSection.tsx](../../../../components/settings/contacts/AttachmentsSection.tsx) | File attach (stage on add / immediate on edit); 10 MB cap, extension allow-list, download/delete |
| [DownloadDropdown.tsx](../../../../components/settings/contacts/DownloadDropdown.tsx) | Export split dropdown — Local / Overseas → `exportContacts` |
| [ExcelUploadDialog.tsx](../../../../components/settings/contacts/ExcelUploadDialog.tsx) | Import wrapper around the shared excel-upload shell (variant, template, parse, preflight/resolve, upload) |

## Hook

| File | Role |
|---|---|
| [useContacts.ts](../../../../components/settings/contacts/useContacts.ts) | `useContactsList(params)` (rawRows / rows / totalCount / loading / refetch) + `useContactsMutations()` (loadDetail, create, update, remove, removeMany, loadBanks, lookupRecipient, listFiles, uploadFile, deleteFile, fileDownloadUrl). **Plain React state — no react-query.** |

## Schema / types / mappers

| File | Role |
|---|---|
| [schema.ts](../../../../components/settings/contacts/schema.ts) | Zod `contactSchema` — contactCode (≤100, required), contactName (≤200, required), taxId (empty or 10/13 digits), location enum, accounts/overseas/address rules, `superRefine` (Local needs ≥1 account; per-card bank+acct pairing; Overseas needs beneficiaryName) |
| [types.ts](../../../../components/settings/contacts/types.ts) | `ContactLocation`, `ContactRow`, `ContactDepositAccount`, `DepositAccountFormValues`, `ContactFormValues` |
| [mappers.ts](../../../../components/settings/contacts/mappers.ts) | `toContactRow` (wire → table row; address current/old split, `deposit` from accounts[0]/overseas[0]), `toFormValues` (detail → edit seed), `toCreateRequest`/`toUpdateRequest` → `buildBody` (split bank into napas/citad, address ops `disp_ord` 1/2, client keys, `accounts_to_delete`/`overseas_to_delete`) |

## API client + wire types

| File | Role |
|---|---|
| [lib/api/contacts.ts](../../../../lib/api/contacts.ts) | All endpoint wrappers (see [api-consumption.md](api-consumption.md)) — `fetchContacts`, `fetchContact`, `createContact`, `updateContact`, `deleteContact`, `bulkDeleteContacts`, `bulkImportContacts`, `preflightContactsImport`, `resolveContactsImportRecipients`, `fetchContactsByBeneficiaryCodes`, `fetchContactBanks`, `lookupContactRecipient`, `listContactFiles`, `uploadContactFile`, `deleteContactFile`, `contactFileDownloadUrl`, `exportContacts` |
| [lib/types/api.ts](../../../../lib/types/api.ts) | `ApiContact*` wire types (`ApiContactRow`, `ApiContactDetail`, `ApiContactAddressRow`/`AccountRow`/`OverseasRow`, create/update requests + sub-ops, bulk import / preflight / resolve-recipients, bank-list, lookup-recipient, file rows) — lowercase snake_case |

## Shared dependencies (reused, not owned)

- `components/shared/excel-upload/ExcelUploadDialog` — shell consumed by the contacts import wrapper.
- `lib/excel.ts` `exportExcel` — XLSX export pipeline used by `exportContacts`.
- `lib/file.ts` `downloadFile` — attachment download.
- `components/shared/SearchInput`, `useTableSort`, `useDialog`, `Pagination` chrome.

## Templates ([`public/templates/contacts/`](../../../../public/templates/contacts/))

Six static XLSX (2 variants × EN/KO/VI; KM→EN):
`WeCMS_Local_Contacts_download_{EN,KO,VI}.xlsx` · `WeCMS_Overseas_Contacts_download_{EN,KO,VI}.xlsx`.
Row 0 title, row 1 blank, row 2 headers, row 3+ sample. Local headers (9): Contact Code · Contact Name
· Tax ID · Deposit Bank · Deposit Account No. · Currency · Current Address · Old Address · Valid Date.
Overseas headers (11): Contact Code · Contact Name · Tax ID · Beneficiary Name · Beneficiary Bank Name
· Bank Identifier Code (BIC) · Beneficiary Account No. · Beneficiary Address · Current Address ·
Old Address · Valid Date.

## Mount point

- [components/settings/SettingsModal.tsx](../../../../components/settings/SettingsModal.tsx) renders `<ContactsPanel />` when `panel === "contacts"`.
- [components/settings/SettingsNav.tsx](../../../../components/settings/SettingsNav.tsx) — nav entry key `contacts`, permission `settings-core-contacts`.
- Mounted globally via `AppShell` → `SettingsModalProvider`; no route file.

## Not used

- **react-query** — the hook is plain `useState`/`useEffect`.
- **View Setting** (`useViewSetting`) — the on-screen grid is a fixed 8-column layout. The export path
  passes slug screenIds but there is **no** backend View Setting seed (the old V247 seed was archived
  2026-06-09); export columns come from the backend provider allow-list ∩ the requested columns.

Backend counterpart: [wecms-api/docs/features/settings/contacts/source-code-index.md](../../../../../wecms-api/docs/features/settings/contacts/source-code-index.md).

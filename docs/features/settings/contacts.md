# Contacts — Next.js Frontend Design

| Field | Value |
|---|---|
| Refactor slug | `contacts` |
| Settings panel route | Opens inside `<SettingsModal>` — no top-level dashboard URL of its own |
| Feature folder | `components/settings/contacts/` |
| Functional spec | [`docs/refactor-wecms/features/contacts.md`](contacts.md) |
| Backend design | [`docs/refactor-wecms/backend/contacts-design.md`](../../../../wecms-api/docs/references/business-rules/contacts-design.md) |

This file is design-only. Conventions track [`wecms-web/CLAUDE.md`](../../../CLAUDE.md) and [`wecms-web/AGENTS.md`](../../../AGENTS.md) — the codebase is Next.js 16; consult the bundled docs under `node_modules/next/dist/docs/` before doing anything non-trivial. Per [`wecms-web/CLAUDE.md` § Scope Guard](../../../CLAUDE.md), the frontend can ship a static-UI panel with mock data before the backend lands — but for Contacts we expect the backend MR to ship first per `docs/refactor-wecms/planning/contacts-tasks.md` (Needs Confirmation), so the frontend MR can wire to a live endpoint.

---

## 1. Where Contacts lives

Per [`wecms-web/CLAUDE.md` § 3. Setting Popup Sidebar Menu](../../../CLAUDE.md), the Contacts panel is reached **only** through the global Settings modal. It does not get a dashboard route under `app/(dashboard)/`.

User journey:

1. User clicks **Settings** in the global top nav ([components/layout/Header.tsx](../../../components/layout/Header.tsx)).
2. `<SettingsModal>` opens (already built — [components/settings/SettingsModal.tsx](../../../components/settings/SettingsModal.tsx)).
3. `<SettingsNav>` renders the "Contacts" entry in the **top group** (added in this MR).
4. The panel column renders `<ContactsPanel />` with shell + scroll region per the §3a contract.

Adding the entry to `<SettingsNav>` is a one-line config edit per the same `CLAUDE.md`: declarative `TOP_GROUPS` / `BOTTOM_GROUPS` config — no component fork.

## 2. Component tree

```
ContactsPanel.tsx                              (feature root)
├── Header (inline)                            sticks at top of panel
│   ├── <h2> "Contacts" + <p> subtitle         text-page-title + text-helper
│   └── Right action group
│       ├── <ViewSettingPopover>               existing shared component, screenId="contacts"
│       └── <Button> "+ Add"                    bg-brand, opens ContactFormDialog mode="create"
├── Filter row (inline)                        flex shrink-0, px-8 + gap-3
│   ├── <SearchInput>                          shared, debounced
│   ├── <FilterDropdown> "Local"               toggle
│   └── <FilterDropdown> "Overseas"            toggle
├── <DataTableShell> (paginated list shell)    shared — owns scroll + footer + pagination slot
│   ├── shadcn <Table> + <TableHeader> + <TableBody>
│   │   └── ContactsTableRow                  one per record
│   │       ├── <Checkbox>                    bulk selection
│   │       ├── HAND_TRCO_KEY                 column
│   │       ├── Company name + EN name        column
│   │       ├── <TrcoTypeBadge> "Local"/"Overseas"
│   │       ├── Tax ID
│   │       ├── Bank (first account or first overseas)
│   │       ├── Address (current) with hover tooltip
│   │       └── <RowActionMenu>               ⋯ button → Edit / Delete
│   └── <Pagination>                          shared, usePagination hook
└── ContactFormDialog                          shadcn <Dialog>, stackLevel={2}
    ├── <DialogHeader>                         "Add Contact" / "Edit Contact"
    ├── <DialogBody>
    │   ├── <Tabs> "Local" | "Overseas"      drives TRCO_TYPE
    │   ├── Master fields                     handTrcoKey, taxId, names
    │   ├── Addresses section (REC1)          repeatable rows with current/previous tabs
    │   ├── Accounts section (REC2)           visible when TRCO_TYPE='L'
    │   └── Overseas section (REC5)           visible when TRCO_TYPE='O'
    └── <DialogFooter>                         Cancel + Save
```

All shared components consumed without modification. Per [`wecms-web/CLAUDE.md` § Shared UI Component Architecture](../../../CLAUDE.md), every cross-page concern in the tree above is a shared component; no per-page rebuilds.

## 3. File layout

```
wecms-web/
├── components/settings/contacts/
│   ├── ContactsPanel.tsx              feature root
│   ├── ContactsTable.tsx              shadcn <Table> wrapper + colgroup + header
│   ├── ContactsTableRow.tsx           one <TableRow>
│   ├── ContactFormDialog.tsx          shadcn <Dialog>, mode="create" | "edit"
│   ├── AddressSubForm.tsx             repeatable addresses (REC1)
│   ├── AccountSubForm.tsx             repeatable accounts (REC2)
│   ├── OverseasSubForm.tsx            repeatable overseas (REC5)
│   ├── RowActionMenu.tsx              ⋯ menu (Edit / Delete)
│   ├── TrcoTypeBadge.tsx              "Local" / "Overseas" pill
│   ├── contactSchema.ts               Zod schemas for create + update
│   ├── types.ts                       in-memory camelCase types
│   └── viewSettingColumns.ts          per-feature column registry for useExcelExport (future)
├── hooks/contacts/
│   ├── useContacts.ts                 list hook (wraps useApiData)
│   ├── useContactDetail.ts            single-record hook for edit pre-fill
│   ├── useContactMutations.ts         create / update / delete / bulkDelete via api/contacts.ts
│   └── useContactsSelection.ts        thin wrapper over the shared useSelection hook
├── lib/api/contacts.ts                 Axios wrappers + mappers (wire ↔ in-memory)
├── lib/types/api.ts                    add ApiContact, ApiAddress, ApiAccount, ApiOverseas wire types
├── lib/viewSettingScreens.ts          add "contacts" → semantic registry
├── locales/{en,ko,vi}.json             add settings.contacts.* keys
└── components/layout/                  no changes; SettingsNav config gains a "Contacts" row
```

`hooks/contacts/` is a new sub-folder per the §3 "Folder Structure Rule" — new cross-feature hooks land in `hooks/` from day one ([`wecms-web/CLAUDE.md`](../../../CLAUDE.md)).

## 4. Naming layers (recap)

Per [`wecms-web/CLAUDE.md` § API Naming & Serialization Standards](../../../CLAUDE.md), three layers, three rules. Examples for Contacts:

| Layer | Convention | Example |
|---|---|---|
| Wire JSON | lowercase `snake_case` | `hand_trco_key`, `trco_cmnm`, `total_count` |
| `lib/types/api.ts` (wire types) | `snake_case` matching the wire | `ApiContact.hand_trco_key` |
| In-memory (`components/**`, `hooks/**`, storage) | **camelCase semantic full words** | `Contact.handTrcoKey`, `Contact.companyName` (Vietnamese name), `Contact.companyEnglishName` |

Wire ↔ in-memory translation happens **once** in `lib/api/mappers.ts` — components never see snake_case.

## 5. In-memory types (`components/settings/contacts/types.ts`)

```ts
export type ContactType = "L" | "O";   // stable identifier value — stays UPPERCASE-like

export interface Contact {
    trcoKey: string;
    handTrcoKey: string;
    companyName: string;          // ← TRCO_CMNM (semantic full word)
    companyEnglishName: string;   // ← TRCO_CMENM
    taxId: string | null;
    contactType: ContactType;
    addresses: Address[];
    accounts: Account[];
    overseasBeneficiaries: OverseasBeneficiary[];
    modifiedAt: string | null;    // ISO — used for default sort
}

export interface Address {
    addrKey: string;
    fullAddress: string;
    displayOrder: number | null;
    issuedDate: string | null;
    dueDate: string | null;
}

export interface Account {
    acctKey: string;
    bankName: string | null;       // resolved server-side
    accountNumber: string | null;
    napasBankCd: string | null;
    citadBankCd: string | null;
    currencyCode: string | null;
    accountOwnerName: string | null;
    branchAddress: string | null;
    displayOrder: number | null;
}

export interface OverseasBeneficiary {
    ovrsKey: string;
    beneficiaryName: string;
    beneficiaryAccountNumber: string | null;
    bicCode: string | null;
    beneficiaryBankName: string | null;
    beneficiaryBankCode: string | null;
    beneficiaryAddress: string | null;
}
```

## 6. Wire types (`lib/types/api.ts` additions)

```ts
export interface ApiContact {
    trco_key: string;
    hand_trco_key: string;
    trco_cmnm: string;
    trco_cmenm: string;
    trco_tax_id: string | null;
    trco_type: "L" | "O";
    addresses: ApiAddress[];
    accounts: ApiAccount[];
    overseas_beneficiaries: ApiOverseas[];
    mod_dtm: string | null;
}

export interface ApiAddress {
    trco_addr_key: string;
    trco_bsun_post_adrs: string | null;
    disp_ord: number | null;
    issu_dt: string | null;
    due_dt: string | null;
}

export interface ApiAccount {
    trco_acct_key: string;
    bank_nm: string | null;
    acct_no: string | null;
    napas_bank_cd: string | null;
    citad_bank_cd: string | null;
    acct_ccy_cd: string | null;
    finc_mda_owner_nm: string | null;
    owac_addr: string | null;
    disp_ord: number | null;
}

export interface ApiOverseas {
    trco_ovrs_key: string;
    bene_name: string;
    bene_acct_no: string | null;
    bic_code: string | null;
    bene_bank_name: string | null;
    bene_bank_code: string | null;
    bene_addr: string | null;
}

export interface ApiContactListResponse {
    rows: ApiContact[];
    total_count: number;
}
```

Per [`wecms-web/CLAUDE.md` § Forbidden](../../../CLAUDE.md): no UPPER_SNAKE property names; no `@JsonProperty("USER_ID")`-style holdovers. These wire types are lowercase snake from day one because the backend DTOs are lowercase snake from day one.

## 7. Mappers (`lib/api/mappers.ts` additions)

```ts
import type { ApiContact, ApiAddress, ApiAccount, ApiOverseas } from "@/lib/types/api";
import type { Contact, Address, Account, OverseasBeneficiary } from "@/components/settings/contacts/types";

export const toContact = (a: ApiContact): Contact => ({
    trcoKey:               a.trco_key,
    handTrcoKey:           a.hand_trco_key,
    companyName:           a.trco_cmnm,
    companyEnglishName:    a.trco_cmenm,
    taxId:                 a.trco_tax_id,
    contactType:           a.trco_type,
    addresses:             a.addresses.map(toAddress),
    accounts:              a.accounts.map(toAccount),
    overseasBeneficiaries: a.overseas_beneficiaries.map(toOverseas),
    modifiedAt:            a.mod_dtm,
});

const toAddress = (a: ApiAddress): Address => ({ /* … */ });
const toAccount = (a: ApiAccount): Account => ({ /* … */ });
const toOverseas = (a: ApiOverseas): OverseasBeneficiary => ({ /* … */ });

export const toApiContactCreate = (c: ContactDraft): ApiContactCreateRequest => ({ /* … */ });
export const toApiContactUpdate = (c: ContactDraft): ApiContactUpdateRequest => ({ /* … */ });
```

Both directions live in one file (`mappers.ts`) as the codebase already does for `banking.ts` etc.

## 8. API client (`lib/api/contacts.ts`)

```ts
import { api } from "@/lib/axios";
import type { ApiResponse } from "@/lib/types/api";
import { toContact, toApiContactCreate, toApiContactUpdate } from "./mappers";

export interface ContactsListParams {
    search?: string;
    contactType?: "L" | "O";
    page: number;
    size: number;
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
}

export async function listContacts(params: ContactsListParams) {
    const res = await api.get<ApiResponse<ApiContactListResponse>>(
        "/api/v1/settings/contacts",
        {
            params: {
                search:         params.search,
                trco_type:      params.contactType,
                page:           params.page,
                size:           params.size,
                sort_field:     params.sortField,
                sort_direction: params.sortDirection,
            }
        }
    );
    if (res.data.status.error) throw new ApiCallError(res.data.status);
    const data = res.data.data!;
    return { rows: data.rows.map(toContact), totalCount: data.total_count };
}

export async function getContact(trcoKey: string): Promise<Contact> { /* … */ }
export async function createContact(draft: ContactDraft): Promise<Contact> { /* … */ }
export async function updateContact(trcoKey: string, draft: ContactDraft): Promise<Contact> { /* … */ }
export async function deleteContact(trcoKey: string): Promise<void> { /* … */ }
export async function bulkDeleteContacts(trcoKeys: string[]): Promise<void> { /* … */ }
```

The shared `api` Axios instance from [`lib/axios.ts`](../../../lib/axios.ts) already attaches the JWT and handles the 401 → re-login redirect.

## 9. Hooks (`hooks/contacts/`)

```ts
// hooks/contacts/useContacts.ts
import { useApiData } from "@/lib/api/useApiData";
import { listContacts, type ContactsListParams } from "@/lib/api/contacts";

export function useContacts(params: ContactsListParams) {
    return useApiData(
        () => listContacts(params),
        [params.search, params.contactType, params.page, params.size, params.sortField, params.sortDirection]
    );
}
```

`useContactDetail`, `useContactMutations`, and `useContactsSelection` follow the same shape — each is a thin wrapper that composes a shared primitive (`useApiData`, `useSelection`).

## 10. Validation (`contactSchema.ts`)

```ts
import { z } from "zod";

const HAND_TRCO_KEY_PATTERN = /^[A-Za-z0-9_\-.]+$/;
const DATE_ISO_PATTERN      = /^\d{4}-\d{2}-\d{2}$/;

const addressOp = z.object({
    op: z.enum(["upsert", "delete"]),
    addrKey: z.string().min(1),
    fullAddress: z.string().max(200).optional(),
    displayOrder: z.number().int().min(1).max(2).optional(),
    issuedDate: z.string().regex(DATE_ISO_PATTERN).optional(),
    dueDate: z.string().regex(DATE_ISO_PATTERN).optional(),
});

const accountOp = z.object({
    op: z.enum(["upsert", "delete"]),
    acctKey: z.string().min(1),
    bankName:   z.string().max(2000).optional(),
    accountNumber: z.string().max(100).optional(),
    napasBankCd: z.string().max(10).optional(),
    citadBankCd: z.string().max(200).optional(),
    accountOwnerName: z.string().max(150).optional(),
    currencyCode: z.string().length(3).optional(),
    branchAddress: z.string().max(500).optional(),
    displayOrder: z.number().int().optional(),
});

const overseasOp = z.object({
    op: z.enum(["upsert", "delete"]),
    ovrsKey: z.string().min(1),
    beneficiaryName: z.string().max(200),
    beneficiaryAccountNumber: z.string().max(100).optional(),
    bicCode: z.string().max(50).optional(),
    beneficiaryBankName: z.string().max(200).optional(),
    beneficiaryBankCode: z.string().max(20).optional(),
    beneficiaryAddress: z.string().max(500).optional(),
});

export const contactSchema = z
    .object({
        handTrcoKey: z.string().min(1).max(20).regex(HAND_TRCO_KEY_PATTERN, { message: "settings.contacts.error.hand_trco_key_format" }),
        companyName: z.string().min(1).max(200),
        companyEnglishName: z.string().min(1).max(200),
        taxId: z.string().max(40).optional(),
        contactType: z.enum(["L", "O"]),
        addresses: z.array(addressOp).max(50),
        accounts:  z.array(accountOp).max(50),
        overseasBeneficiaries: z.array(overseasOp).max(50),
    })
    .superRefine((data, ctx) => {
        if (data.contactType === "L") {
            const hasBank = data.accounts.some(a => a.op === "upsert" && a.bankName);
            if (!hasBank) ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["accounts"],
                message: "settings.contacts.error.local_bank_required",
            });
        }
        // duplicate (bankName, accountNumber) and (bic, beneficiaryAccountNumber) checks
        // mirror the backend rules — client-side fast feedback before submit
    });
```

Per [`wecms-web/CLAUDE.md` § Translation keys live in the Zod message](../../../CLAUDE.md): messages are translation keys; the caller resolves `t(key)` when rendering. RHF + `@hookform/resolvers/zod` consumes this schema.

## 11. ContactsPanel composition (typography + tokens)

Per [`wecms-web/CLAUDE.md` § 3a Settings Popup — Modal Shell + Panel Composition](../../../CLAUDE.md) — every Settings panel uses the shape:

```tsx
<div className="flex min-h-0 flex-1 flex-col">
  <Header />                                       {/* shrink-0 */}
  <FilterRow />                                    {/* shrink-0 */}
  <ScrollRegion />                                 {/* min-h-0 flex-1 */}
  <Pagination />                                   {/* shrink-0, OUTSIDE scroll */}
</div>
```

Header rhythm (matches `FirmBankingSettings` panel):
- `flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-14`
- Title: `<h2 className="text-page-title">{t("settings.contacts.title")}</h2>` resolves to `text-xl font-medium` per the global typography scale ([root `CLAUDE.md` § Global Typography](../../../../CLAUDE.md)).
- Subtitle: `<p className="mt-1 text-wb-13 font-normal text-wb-muted">{t("settings.contacts.subtitle")}</p>`.
- Right action group:
  - `<ViewSettingPopover screenId="contacts" dymAreaId="default" />` — existing shared component.
  - `<Button className="bg-brand text-white shadow-wb-brand-btn …">{t("settings.contacts.add")}</Button>` → opens `<ContactFormDialog mode="create" />`.

Filter row:
- `<div className="flex shrink-0 items-center gap-3 px-8 py-3">`
- `<SearchInput value={search} onChange={…} placeholder={t("settings.contacts.search_placeholder")} />`
- Two filter chips for Local + Overseas — the existing checkbox-style toggle. Toggling either calls `resetPage()` from `usePagination` (per the legacy `fn_loadData(..., option=true)` reset rule documented in [`wecms-web/CLAUDE.md` § 5 Event Function Rule](../../../CLAUDE.md)).

Scroll region:
- `<DataTableShell minWidth="1058px">` — owns `min-h-0 flex-1 overflow-hidden` outer + `custom-scrollbar h-full overflow-auto` inner per the §6c scrollbar contract.
- `<Table>` inside with column widths taken from the View Setting `size` value seeded in the migration. Header cells use `<TableHeaderCell field="HAND_TRCO_KEY" sortable />` so the sort glyph cycles `default → ASC → DESC → default` per [`wecms-web/CLAUDE.md` § 13a](../../../CLAUDE.md).

Pagination:
- `<Pagination {...paginationProps} totalLabel={t("settings.contacts.total_label", { count: data.totalCount })} />`.

Typography tokens used (all from the global `@theme inline` registry):
- Page title: `text-page-title` (18px / medium).
- Subtitle, table cells, filter labels, buttons: `text-wb-13` (13px / normal-or-medium).
- Section labels inside `ContactFormDialog`: `text-section-title` (14px / 600).
- Empty-state copy: `text-wb-13 font-normal text-wb-muted`.

Per the workspace global typography rule ([root `CLAUDE.md` § Global Typography](../../../../CLAUDE.md)) and [`wecms-web/CLAUDE.md` § Typography & tokens](../../../CLAUDE.md): no arbitrary `text-[Npx]`, no inline `style={{ fontFamily: … }}`. If a new size is genuinely needed, add a token to `@theme inline` first.

## 12. ContactFormDialog rhythm

Per [`wecms-web/CLAUDE.md` § 3a feature-dialog rhythm](../../../CLAUDE.md):

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="max-w-3xl" stackLevel={2}>
    <DialogHeader>
      <DialogTitle>{mode === "create" ? t("settings.contacts.create_title") : t("settings.contacts.edit_title")}</DialogTitle>
      <DialogDescription>{t("settings.contacts.dialog_description")}</DialogDescription>
    </DialogHeader>
    <DialogBody>
      {/* Tabs (Local / Overseas) drive TRCO_TYPE in create mode; readonly in edit mode */}
      {/* Master fields */}
      {/* AddressSubForm */}
      {/* AccountSubForm OR OverseasSubForm based on contactType */}
    </DialogBody>
    <DialogFooter>
      <Button variant="secondary" onClick={onCancel}>{t("dialog.cancel")}</Button>
      <Button onClick={onSubmit} disabled={!isValid}>{t("dialog.save")}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Rules respected:
- `stackLevel={2}` — opened on top of the Settings modal (L1). Backdrop `bg-black/20` per §"Modal stacking convention" — the primitive owns this.
- Conditional mount + `key` re-seed: `{editing && <ContactFormDialog key={editing.trcoKey} ... />}` so opening row B after row A remounts cleanly.
- Standard rhythm `<DialogHeader>` / `<DialogBody>` / `<DialogFooter>` — no per-dialog padding overrides.
- Footer buttons: secondary "Cancel" left, primary "Save" right per [`wecms-web/CLAUDE.md` § Dialog buttons](../../../CLAUDE.md). No `destructive: true`.
- Top-most modal rule (§ Modal stack — interaction & close behaviour): only the dialog is interactive while open; the Settings modal under it is non-interactive — the shared primitive owns this. Per-page handlers are forbidden.

## 13. Delete confirmation + success / error feedback

Per [`wecms-web/CLAUDE.md` § Dialogs & modals](../../../CLAUDE.md):

```tsx
const dialog = useDialog();

const onDelete = (row: Contact) => {
    dialog.open({
        type: "confirmation",
        title: t("dialog.confirmation"),
        description: t("settings.contacts.confirm.delete_one", { name: row.companyName }),
        confirmText: t("dialog.continue"),
        cancelText:  t("dialog.cancel"),
        onConfirm: async () => {
            try {
                await deleteContact(row.trcoKey);
                dialog.open({ type: "success", title: t("dialog.success"), description: t("settings.contacts.success.deleted") });
                refresh();
            } catch (err) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: (err as ApiCallError).message,
                    errorCode: (err as ApiCallError).code,
                });
            }
        },
    });
};
```

- Confirmation icon green, single primary "Continue" + secondary "Cancel" — Figma standard. **No `destructive: true`** (soft-delete is not the explicit red-CTA variant; per the rule, destructive Red is only for designs that explicitly call for it).
- Success → blue check, single OK.
- Error → red, single OK; `errorCode` renders inline so the user can quote the WBE/WBI code.
- Network failures bubble through `lib/axios.ts` with the standard `LoginError`-style envelope; the traceId returned by the server renders verbatim in the error dialog.

## 14. List → Edit / Delete handoff

`<RowActionMenu>` is a small `<DropdownMenu>` triggered by a ⋯ icon button per the existing pattern. Two items: Edit (opens `ContactFormDialog mode="edit"` with `key={row.trcoKey}`), Delete (opens the confirmation above).

Bulk-select bar: when at least one row is selected, the page shows a small action bar above the table with a "Delete selected" button. Same confirmation + same error handling, calling `bulkDeleteContacts(...)`.

## 15. View Setting integration

Register `contacts` in [`lib/viewSettingScreens.ts`](../../../lib/viewSettingScreens.ts):

```ts
export const VIEW_SETTING_SCREENS = {
    "banking-account-inquiry-vnd": { /* existing */ },
    "contacts": {
        defaultArea: "default",
        fields: {
            CHECKBOX:               { sortable: false, special: true },
            HAND_TRCO_KEY:          { sortable: true,  i18nKey: "settings.contacts.column.hand_trco_key" },
            TRCO_CMNM:              { sortable: true,  i18nKey: "settings.contacts.column.company_name" },
            TRCO_TYPE:              { sortable: true,  i18nKey: "settings.contacts.column.location" },
            TRCO_TAX_ID:            { sortable: true,  i18nKey: "settings.contacts.column.tax_id" },
            BANK_NM:                { sortable: false, i18nKey: "settings.contacts.column.bank" },
            TRCO_BSUN_POST_ADRS:    { sortable: false, i18nKey: "settings.contacts.column.address" },
            ETC:                    { sortable: false, special: true },
        },
    },
};
```

The shared `<ViewSettingPopover>` and the table's `<TableHeaderCell>` consume this registry automatically; no per-feature popover work.

## 16. i18n keys (`locales/{en,ko,vi}.json`)

Full list mirrors [`docs/refactor-wecms/features/contacts.md` § 9](contacts.md). EN sample:

```jsonc
{
  "settings.contacts.title": "Contacts",
  "settings.contacts.subtitle": "Manage trading partners — local and overseas.",
  "settings.contacts.add": "+ Add",
  "settings.contacts.search_placeholder": "Search",
  "settings.contacts.filter.local": "Local",
  "settings.contacts.filter.overseas": "Overseas",
  "settings.contacts.column.hand_trco_key": "Contact Code",
  "settings.contacts.column.company_name": "Company",
  "settings.contacts.column.location": "Contact Location",
  "settings.contacts.column.tax_id": "Tax ID",
  "settings.contacts.column.bank": "Bank",
  "settings.contacts.column.address": "Address",
  "settings.contacts.row.edit": "Edit",
  "settings.contacts.row.delete": "Delete",
  "settings.contacts.address.current": "Address (Current)",
  "settings.contacts.address.old": "Address (Old)",
  "settings.contacts.address.default_badge": "Default",
  "settings.contacts.empty": "No data found",
  "settings.contacts.location.local": "Local",
  "settings.contacts.location.overseas": "Overseas",
  "settings.contacts.total_label": "{count} contact(s)",
  "settings.contacts.create_title": "Add Contact",
  "settings.contacts.edit_title": "Edit Contact",
  "settings.contacts.dialog_description": "Fill in the contact details below.",
  "settings.contacts.confirm.delete_one": "Are you sure you want to delete {name}?",
  "settings.contacts.confirm.delete_bulk": "Are you sure you want to delete {count} contacts?",
  "settings.contacts.success.deleted": "Contact deleted.",
  "settings.contacts.success.created": "Contact created.",
  "settings.contacts.success.updated": "Contact updated.",
  "settings.contacts.error.hand_trco_key_format": "Contact code may only contain letters, numbers, _, -, .",
  "settings.contacts.error.local_bank_required": "Local contacts must have at least one bank account."
}
```

KO + VI mirror with verified translations from Sonny. KM omitted per workspace policy.

## 17. Loading / empty / error states

| State | Render |
|---|---|
| Loading (initial) | `<Skeleton>` placeholder rows inside `<DataTableShell>` matching column widths. Reuses the existing skeleton convention. |
| Empty | Centered `<div>` with `text-wb-13 font-normal text-wb-muted` and `t("settings.contacts.empty")`. Mirrors legacy ts:228-235. |
| Loading (refetch) | Spinner overlay on the scroll region; pagination disabled. |
| Error | `useDialog().open({ type: "error", … })` with the traceId. Table reverts to last-known data. |

## 18. Excel export (deferred — same hook)

When the export MR lands, register a column config under `viewSettingColumns.ts`:

```ts
export const contactsExportColumns = {
    HAND_TRCO_KEY: { headerKey: "settings.contacts.column.hand_trco_key", format: "text", align: "left"  },
    TRCO_CMNM:     { headerKey: "settings.contacts.column.company_name",   format: "text", align: "left"  },
    // …
};
```

The shared `useExcelExport({ endpoint: "/api/v1/settings/contacts/export", screenId: "contacts", columnConfig: contactsExportColumns })` does the rest — backend (POI) produces the XLSX, frontend posts JSON and saves the blob. CSV is **not** sanctioned per [`wecms-web/CLAUDE.md` § 6 Print / Export Rule](../../../CLAUDE.md).

## 19. Print (deferred)

If "Print contacts" is ever requested, route through the shared `printReport(...)` helper in [`lib/print.ts`](../../../lib/print.ts) — per §6 Print / Export Rule, `window.print()` is forbidden. Not in MVP scope.

## 20. Responsive rules

Per [`wecms-web/CLAUDE.md` § Responsive rules](../../../CLAUDE.md): Desktop-first authoring; verified at 375 / 768 / 1024 / 1440.

- Filter row wraps to column below `md`.
- Table scrolls horizontally below `1058px` (min table width).
- KPI cards N/A — no summary cards in Contacts.
- `<ContactFormDialog>` uses `max-w-3xl` and `max-h-[calc(100vh-32px)]` so it fits laptop viewports.

## 21. Reuse manifest (Next.js side)

Concrete files in `wecms-web/` that this feature consumes:

| Reuse target | Path |
|---|---|
| Settings shell | [`components/settings/SettingsModal.tsx`](../../../components/settings/SettingsModal.tsx) |
| Settings sidebar | [`components/settings/SettingsNav.tsx`](../../../components/settings/SettingsNav.tsx) |
| View Setting popover | [`components/shared/ViewSettingPopover` (existing)](../../../components/shared) |
| Data table shell | [`components/shared/DataTableShell.tsx`](../../../components/shared/DataTableShell.tsx) |
| Table header cell + sort glyph | [`components/shared/TableHeaderCell.tsx`](../../../components/shared/TableHeaderCell.tsx) |
| shadcn `<Table>` primitive | [`components/ui/table.tsx`](../../../components/ui/table.tsx) |
| shadcn `<Dialog>` primitive | [`components/ui/dialog.tsx`](../../../components/ui/dialog.tsx) |
| Search input | [`components/shared/SearchInput.tsx`](../../../components/shared/SearchInput.tsx) |
| Pagination + `usePagination` | [`components/shared/Pagination.tsx`](../../../components/shared/Pagination.tsx) |
| Filter dropdown | [`components/shared/FilterDropdown.tsx`](../../../components/shared/FilterDropdown.tsx) |
| System dialog | [`components/shared/dialog/DialogProvider.tsx`](../../../components/shared/dialog/DialogProvider.tsx) + `useDialog()` |
| Toast (not needed today; success/error route through useDialog) | — |
| API data hook | [`lib/api/useApiData.ts`](../../../lib/api/useApiData.ts) |
| Axios + JWT interceptor | [`lib/axios.ts`](../../../lib/axios.ts) |
| Wire types | [`lib/types/api.ts`](../../../lib/types/api.ts) |
| View Setting registry | [`lib/viewSettingScreens.ts`](../../../lib/viewSettingScreens.ts) |
| i18n provider | [`lib/i18n/LocaleProvider.tsx`](../../../lib/i18n/LocaleProvider.tsx) |
| Class-name composition | [`lib/utils.ts`](../../../lib/utils.ts) (`cn`) |
| Datetime formatting | [`lib/datetime.ts`](../../../lib/datetime.ts) (for `mod_dtm` rendering if surfaced) |
| RHF + Zod resolver | already in `package.json` |

New shared primitives needed: **none**. Per the pre-flight checklist in [`wecms-web/CLAUDE.md` § 9](../../../CLAUDE.md), every cross-feature concern Contacts touches already has a shared module.

## 22. Performance considerations

- The list endpoint is paged (default 15, max 100) — no client-side pagination, no full-result fetch.
- Sub-rows (addresses / accounts / overseas) ship inline with each row from the backend in one trip; no N+1 per-row HTTP.
- Filter inputs use the shared `useDebounce` (300 ms) — first consumer can land it in `hooks/` if it doesn't exist yet (§ 5 Event Function Rule).
- Bulk-select uses the existing shared `useSelection` hook pattern; selection state is keyed on `trcoKey`.

## 23. Static-UI fallback (if the backend slips)

Per [`wecms-web/CLAUDE.md` § Scope Guard — Static-UI mock data is owned by the frontend](../../../CLAUDE.md):

If the backend MR is not ready when the frontend MR is, ship the panel with `components/settings/contacts/mockData.ts` providing static rows. The frontend types stay camelCase; mock data is in the same shape as `Contact[]`. No backend dependency until the real endpoint lands. When the backend lands, the only file edit is in `hooks/contacts/useContacts.ts` (swap the data source from mock to `listContacts(...)`).

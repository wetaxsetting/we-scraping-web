/**
 * Contacts panel — Settings popup submenu (Figma 9194:9683).
 *
 * In-memory types for the contact directory. The wire shape lives in
 * `lib/types/api.ts` (`ApiContact*` records); `lib/api/contacts.ts`
 * + `./mappers.ts` translate at the boundary so this module sees only
 * camelCase semantic types.
 */

/**
 * Local / Overseas radio toggle. Mapped to the wire `trco_type`
 * letter `'L'` / `'O'` by `./mappers.ts`.
 */
export type ContactLocation = "local" | "overseas";

/**
 * Deposit account display block used by the list / table cell. For
 * Local rows `bankName` is the server-resolved display name and
 * `accountNo` is the verbatim `ACCT_NO`; for Overseas rows the same
 * shape carries the primary beneficiary's `BNFC_NM` + `SWFT_CD`. The
 * visual contract is identical — only the source of the strings
 * differs.
 */
export type ContactDepositAccount = {
    bankName: string;
    accountNo: string;
};

/**
 * In-memory row consumed by the table renderer. Stable across
 * refetches because it carries the server-issued `id` (`trco_key`).
 *
 * `addresses[0]` is the (Current) Address shown in the table cell;
 * anything past index 0 (e.g. previous addresses tagged
 * `disp_ord = 2`) is counted into the `+N` badge.
 */
export type ContactRow = {
    id: string;
    /** `TRCO_KEY` — global per-row identifier (V85 sequence). Used as
     *  the path segment on detail / update / delete calls. */
    trcoKey: string;
    /** Human-facing contact code — wire `HAND_TRCO_KEY`. */
    contactCode: string;
    contactName: string;
    location: ContactLocation;
    taxId: string;
    deposit: ContactDepositAccount;
    /** Address list — `addresses[0]` is the (Current) Address; anything
     *  past is counted into the `+N` badge. Always non-empty when the
     *  contact has at least one stored address. */
    addresses: string[];
};

/* =================================================================
 *  Form-values shapes — consumed by Add/Edit dialog + Zod schema.
 *  Wire translation lives in `./mappers.ts`.
 * ================================================================= */

/**
 * One deposit-account draft inside the Add/Edit form. Mirrors the
 * `<DepositAccountCard>` UI: bank label, currency, account number,
 * recipient. `id` is a stable per-card key — `trcoAcctKey` carries
 * the server-issued identifier when present (Edit mode), otherwise
 * absent so the backend allocates one.
 */
export type DepositAccountFormValues = {
    id: string;
    trcoAcctKey?: string;
    /** Display label for the picked bank — `ENG_ABRVAT_NM - BANK_*_NM`
     *  from the bank-picker autocomplete. Stored verbatim into
     *  `bank_nm` on the wire. */
    bank: string;
    /** Server-side `BANK_CD` from the picker. Translates to either
     *  `napas_bank_cd` or `citad_bank_cd` on the wire based on
     *  {@link bankDiv}. Empty until a bank is picked. */
    bankCd: string;
    /** {@code "NAPAS"} or {@code "CITAD"} — discriminator from the
     *  picked row's `ant_div_cd`. Drives which wire key the mapper
     *  populates. Empty until a bank is picked. */
    bankDiv: "" | "NAPAS" | "CITAD";
    /** `'Y'` / `'N'` from the bank's status — drives the recipient
     *  flow toggle (`'N'` ⇒ manual; anything else ⇒ Lookup). */
    bankStatus: "" | "Y" | "N";
    currency: "VND" | "USD" | "";
    accountNo: string;
    /** Recipient / owner name — wire `finc_mda_owner_nm`. Either
     *  populated via the Lookup Recipient call (verified flow) or
     *  user-typed (manual flow). */
    recipient: string;
    /** `true` once the recipient was set via the Lookup flow — drives
     *  the verified vs manual visual in the card. Not shipped on the
     *  wire. */
    lookupVerified?: boolean;
};

/**
 * Form-values shape for the Add / Edit dialog. Internal camelCase
 * shape consumed by RHF + the Zod schema; `./mappers.ts` translates
 * to the snake_case wire body.
 *
 * The Local / Overseas radio reshapes the form: Local rows ship
 * `accounts` (≥ 1 card); Overseas rows ship a single `overseas`
 * beneficiary block. The mapper enforces the rule by ignoring the
 * inactive half on submit.
 */
export type ContactFormValues = {
    contactCode: string;
    contactName: string;
    /** Vietnamese contacts use this column as the English / Latin
     *  transliteration of `contactName`. The backend marks it
     *  `@NotBlank` so the mapper falls back to `contactName` when the
     *  dialog leaves this blank — wire it to a dedicated input in the
     *  follow-up MR. */
    contactEnglishName: string;
    taxId: string;
    location: ContactLocation;
    /** Used on Local contacts. The form keeps ≥ 1 card; the dialog
     *  hides the per-card Delete button on the last remaining card. */
    accounts: DepositAccountFormValues[];
    /** Server-issued account keys that have been removed via the
     *  Delete-account chip — emitted as `accounts_to_delete` on the
     *  Update wire body so backend drops the matching rows. New
     *  rows (no `trcoAcctKey` ever assigned) are absent here. */
    deletedAccountKeys?: string[];
    /** Server-issued overseas-beneficiary keys queued for deletion —
     *  emitted as `overseas_to_delete` on the Update wire body. Populated
     *  when the user confirms a Local → Overseas switch in edit mode so
     *  the previously-saved local accounts get dropped; the symmetric
     *  Overseas → Local flow drops the overseas row. Mirrors legacy
     *  `comm_0184_005` REC4 / REC6 delete behaviour after WBC1175. */
    deletedOverseasKeys?: string[];
    /** Used on Overseas contacts. Single beneficiary today —
     *  multi-beneficiary lands when the Overseas Figma frame is wired. */
    overseas: {
        beneficiaryName: string;
        swiftCode: string;
        beneficiaryAccountNo: string;
        beneficiaryBankName: string;
        beneficiaryBankCode: string;
        beneficiaryAddress: string;
    };
    /** Server-issued overseas-row key — round-tripped through Save so
     *  the backend's `op: 'upsert'` keeps editing the same row. New
     *  contacts leave it undefined; mapper generates a fresh key. */
    existingOverseasKey?: string;
    /** (Current) Address — required. */
    address: string;
    /** Optional (Changed) / previous address block. */
    changedAddress: string;
    /** `yyyy-MM-dd` from the native date input. Mapper converts to
     *  the wire `yyyyMMdd` due-date on the previous-address row. */
    validTill: string;
    /** Server-issued address keys round-tripped through Save so the
     *  Update body's `op: 'upsert'` ops edit existing rows in place.
     *  Undefined on new contacts; mapper generates fresh keys. */
    existingAddressKeys?: {
        currentKey?: string;
        previousKey?: string;
    };
};

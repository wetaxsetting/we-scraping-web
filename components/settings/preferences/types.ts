/**
 * Settings popup → Preferences panel — Figma 142:17995.
 *
 * The panel currently renders read-only mock data (no Spring endpoint yet).
 * Field keys map 1:1 to the JEX `usrm_0001_001` company-profile record so the
 * shape stays stable when the API arrives.
 */
export type PreferencesCompanyFieldKey =
    | "vietnamese_name"
    | "display_name"
    | "tax_id"
    | "representative_email"
    | "address";

export type PreferencesCompanyField = {
    key: PreferencesCompanyFieldKey;
    labelKey: string;
    value: string;
    required: boolean;
};

export type PreferencesToggleKey = "use_purpose" | "use_vas_account";

/**
 * One ON/OFF row in the Purpose-and-VAS section. Read-mode uses
 * `titleKey`/`descriptionKey`; edit-mode swaps to the `editTitleKey`/
 * `editDescriptionKey` pair (Figma 154:24540 renames "VAS Account" → "VAS Code"
 * and rewrites the helper text). Falls back to the read-mode keys when the
 * edit-mode keys are not provided.
 */
export type PreferencesToggleRow = {
    key: PreferencesToggleKey;
    titleKey: string;
    descriptionKey: string;
    editTitleKey?: string;
    editDescriptionKey?: string;
    enabled: boolean;
};

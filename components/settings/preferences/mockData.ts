import type {
    PreferencesCompanyField,
    PreferencesToggleRow,
} from "./types";

/**
 * Static read-only company profile rendered by <PreferencesPanel>.
 * Values mirror Figma node 142:18007 — once the Spring side ships
 * `/api/v1/settings/company-profile` this whole list becomes the
 * default fallback and the panel reads the live record instead.
 */
export const COMPANY_FIELDS: PreferencesCompanyField[] = [
    {
        key: "vietnamese_name",
        labelKey: "settings.preferences.field.vietnamese_name",
        value: "CÔNG TY TNHH WEBCASH VIỆT NAM",
        required: true,
    },
    {
        key: "display_name",
        labelKey: "settings.preferences.field.display_name",
        value: "WEBCASH VIETNAM COMPANY LIMITED",
        required: false,
    },
    {
        key: "tax_id",
        labelKey: "settings.preferences.field.tax_id",
        value: "2909020203",
        required: true,
    },
    {
        key: "representative_email",
        labelKey: "settings.preferences.field.representative_email",
        value: "hochiminh@gmail.com",
        required: true,
    },
    {
        key: "address",
        labelKey: "settings.preferences.field.address",
        value: "Vietnam, Hanoi, 110, Russian Federation Blvd., Tuek Thla, Sen Sok",
        required: true,
    },
];

export const TOGGLE_ROWS: PreferencesToggleRow[] = [
    {
        key: "use_purpose",
        titleKey: "settings.preferences.use_purpose.title",
        descriptionKey: "settings.preferences.use_purpose.description",
        enabled: true,
    },
    {
        key: "use_vas_account",
        titleKey: "settings.preferences.use_vas.title",
        descriptionKey: "settings.preferences.use_vas.description",
        editTitleKey: "settings.preferences.use_vas_code.title",
        editDescriptionKey: "settings.preferences.use_vas_code.description",
        enabled: true,
    },
];

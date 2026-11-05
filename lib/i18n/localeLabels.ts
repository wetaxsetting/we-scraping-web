import type { Locale } from "./LocaleProvider";

/** Display order + labels for language pickers (WeInvoice UI Spec v1.0: VI first). */
export const LOCALE_OPTIONS: { code: Locale; label: string; short: string }[] = [
    { code: "VI", label: "Tiếng Việt", short: "VI" },
    { code: "EN", label: "English", short: "EN" },
    { code: "KO", label: "한국어", short: "KO" },
];

/**
 * Scraping / GDT / Business-Inquiry result-code resolver — shared
 * utility that consumers in the banking domain (Firm Banking History
 * S / G / B legs today; future scraping-fronted features tomorrow)
 * import to translate raw {@code RSLT_CD} values to localized
 * messages.
 *
 * <p>Mirrors the legacy {@code comm_0221_001.ts:459-481} resolver:
 *
 * <pre>{@code
 *   const resultMap = { "42110000": multiLanguagesObj['…j027'], … };
 *   RSLT_MSG = resultMap[RSLT_CD] || RSLT_MSG;
 * }</pre>
 *
 * <p>Refactor reshape:
 * <ul>
 *   <li>The legacy ML keys ({@code comm_0221_001_jNNN}) become i18n
 *       keys under the {@code fb_history.result.&lt;code&gt;}
 *       namespace declared in {@code locales/en.json}. Two codes that
 *       share a legacy ML key get two i18n entries with identical EN
 *       text — same observable behaviour, simpler resolver.</li>
 *   <li>Locale switching goes through the workspace
 *       {@code LocaleProvider}'s {@code t()} (passed in by the caller),
 *       not a hand-rolled locale switch. Missing KO / VI translations
 *       fall back to EN automatically per the provider's chain
 *       (see {@code LocaleProvider.tsx:101-103}).</li>
 *   <li>Unknown codes return {@code null} — callers fall back to the
 *       row's existing {@code rslt_msg} or the raw {@code rslt_cd},
 *       never a blank cell.</li>
 * </ul>
 *
 * <p><b>Distinct from DICTIONARY_VAN.</b> The F-leg uses 4-char VAN
 * gateway codes resolved against {@code lib/i18n/dictionaryVan.ts};
 * S / G / B legs use the 8-char scraping codes resolved here. The two
 * registries share no codes and have separate legacy sources (XML for
 * VAN, inline JS for scraping). Keep the call sites leg-specific —
 * see {@code FirmBankingHistoryDetailPopover#buildDetailRows}.
 *
 * @see ./scrapingResultCodes.data.ts for the static registry.
 * @see ./dictionaryVan.ts for the F-leg sibling resolver.
 */

import {
    KNOWN_SCRAPING_RESULT_CODES,
    SCRAPING_RESULT_CODES,
    type ScrapingResultEntry,
} from "./scrapingResultCodes.data";

/** Same shape as {@code LocaleContextValue["t"]} — declaring it here
 *  decouples this module from the LocaleProvider import so it can be
 *  unit-tested with a stub {@code t}. Callers pass
 *  {@code useTranslation().t} directly. */
export type TFunc = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Resolve a raw scraping result code to its localized message.
 *
 * <p>Returns {@code null} for:
 * <ul>
 *   <li>missing / blank input ({@code null} / {@code undefined} /
 *       {@code ""}),</li>
 *   <li>codes not present in the registry (legacy DEV codes that
 *       were never mapped — track as content gaps in the feature
 *       spec).</li>
 * </ul>
 *
 * <p>For known codes, calls {@code t("fb_history.result.<code>")}
 * which the workspace {@code LocaleProvider} resolves against the
 * active locale. If the active locale's JSON does not carry the key,
 * the provider's fallback chain returns the EN entry; if EN is also
 * missing, it returns the key string itself (visible bug, by design).
 *
 * <p>Code lookup is whitespace-trimmed and case-sensitive. The legacy
 * registry uses uppercase hex / mixed-case strings ({@code 8000E200},
 * {@code GWS06004}, {@code LBS00001}, {@code LOGIN_CAN}) — the live
 * gateway returns codes verbatim, so case folding would be wrong.
 */
export function lookupScrapingResultMessage(
    code: string | null | undefined,
    t: TFunc,
): string | null {
    if (code === null || code === undefined) return null;
    const trimmed = code.trim();
    if (trimmed === "") return null;
    if (!KNOWN_SCRAPING_RESULT_CODES.has(trimmed)) return null;
    const entry = SCRAPING_RESULT_CODES[trimmed]!;
    return t(entry.i18nKey);
}

/**
 * Resolve a result code with the legacy fallback chain. Mirrors the
 * legacy "{@code resultMap[RSLT_CD] || RSLT_MSG}" pattern at
 * {@code comm_0221_001.ts:481}, with one extra fallback layer
 * (raw {@code rslt_cd}) so the UI never renders blank.
 *
 * <ol>
 *   <li>Localized i18n message if {@code code} is in the registry
 *       (and the active locale has a translation, with EN fallback).</li>
 *   <li>Otherwise the row's {@code rsltMsg} (gateway free-text).</li>
 *   <li>Otherwise the raw {@code rsltCd} string itself — never blank
 *       per the task's "Never render blank UI" rule.</li>
 *   <li>Otherwise the optional {@code emptyFallback} (e.g. localized
 *       "Failed" label) when both code AND message are blank.</li>
 *   <li>Otherwise the empty string (the popover renders "—" placeholder).</li>
 * </ol>
 *
 * <p>This is the canonical resolver every S / G / B-leg call site
 * should use. Inlining the if-else chain at the call site is the bug
 * pattern this helper exists to prevent.
 */
export function resolveScrapingResultMessage(
    code: string | null | undefined,
    rsltMsg: string | null | undefined,
    t: TFunc,
    emptyFallback?: string | null,
): string {
    const localized = lookupScrapingResultMessage(code, t);
    if (localized) return localized;
    const msg = (rsltMsg ?? "").trim();
    if (msg) return msg;
    const raw = (code ?? "").trim();
    if (raw) return raw;
    return emptyFallback ?? "";
}

/**
 * Direct registry access for diagnostic / introspection use cases
 * (admin panels listing all codes, tests asserting coverage). Returns
 * the underlying entry — do not mutate the result.
 */
export function getScrapingResultEntry(code: string): ScrapingResultEntry | undefined {
    return SCRAPING_RESULT_CODES[code.trim()];
}

/** Total registry size — useful for tests asserting the legacy port
 *  is complete (expected: 18). */
export const SCRAPING_RESULT_CODES_SIZE: number = Object.keys(SCRAPING_RESULT_CODES).length;

export type { ScrapingResultEntry };

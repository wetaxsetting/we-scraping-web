/**
 * Scraping / GDT / Business-Inquiry result-code registry — ported from
 * legacy {@code comm_0221_001.ts:455-481}'s inline {@code resultMap} +
 * its EN fallback strings at lines 80-99.
 *
 * <p><b>Provenance.</b> Source of truth is the legacy TypeScript file
 * {@code WECMS DEV/WECMS_STATIC/ts-src/js/jex/wabooks/comm/comm_0221_001.ts}.
 * The legacy code maps 18 result codes onto 16 distinct legacy ML keys
 * ({@code comm_0221_001_j027} … {@code j046}). Two pairs of codes
 * collapse onto the same message:
 *
 * <ul>
 *   <li>{@code 80002F33} + {@code 80002F31} → both use {@code j035}
 *       ("Transaction failed due to changes on the institution's
 *       related page…")</li>
 *   <li>{@code 80002214} + {@code 80002421} → both use {@code j043}
 *       ("Incorrect ID or password…")</li>
 * </ul>
 *
 * <p>The refactor preserves this 1-code → 1-i18n-key shape (per the
 * task spec's {@code fb_history.result.&#123;code&#125;} convention)
 * and emits two i18n entries with identical English text for those
 * pairs — equivalent runtime behaviour, simpler resolver.
 *
 * <p><b>Verified vs unverified data.</b>
 * <ul>
 *   <li>The <b>EN</b> message is the verified English fallback string
 *       declared at the legacy {@code _osmc.ui.ml.get(key, fallback)}
 *       call sites (lines 80-99). Verbatim — including the trailing
 *       space on {@code j037} and the curly apostrophe in
 *       {@code j032} / {@code j035} / {@code j036}.</li>
 *   <li>The <b>KO</b> + <b>VI</b> translations are <i>not</i> in
 *       source. They live in the live JEX system's ML configuration
 *       database (Jex Studio &gt; Multi Language &gt; Common View),
 *       which is outside the {@code WECMS DEV/} source tree and
 *       outside the {@code postgres} MCP scope. Per the task rule
 *       "Do not invent translations", this module does NOT include
 *       them. Localised display in KO / VI relies on the workspace's
 *       {@code LocaleProvider} fallback ("missing key → EN text"),
 *       and the gap is documented in
 *       {@code docs/refactor-wecms/features/settings/firm-banking-history.md}
 *       § Result-code i18n bundle.</li>
 * </ul>
 *
 * <p>The workspace officially supports three locales — {@code en} /
 * {@code ko} / {@code vi}. This module targets that set only.
 *
 * <p><b>Distinct from DICTIONARY_VAN.</b> The codes here are 8-char
 * scraping / NXISAS / gateway codes ({@code 42110000} / {@code 80004113}
 * / {@code LBS00001} / {@code LOGIN_CAN} / {@code GWS06004}) emitted by
 * the S / G / B legs of the unified history view. The F-leg's 4-char
 * VAN response codes live in
 * {@code lib/i18n/dictionaryVan.{ts,data.ts}} and have a separate
 * legacy source (the ETC XML dictionary). Keep the two registries
 * separate — they share no codes and serve different gateways.
 */

/** Stable i18n-key shape for every entry in this registry. The {@code <code>}
 *  segment is the raw legacy result code (uppercase, no spaces). */
export type ScrapingResultI18nKey = `fb_history.result.${string}`;

/**
 * One registry entry — connects a result code to:
 * <ul>
 *   <li>the i18n key the resolver looks up via {@code t(key)}, and</li>
 *   <li>the legacy ML key for traceability (matches Jex Studio
 *       registration; not used at runtime).</li>
 * </ul>
 */
export type ScrapingResultEntry = {
    /** Result code as it appears in {@code RSLT_CD} / {@code TRNS_STTS}
     *  / {@code NXISAS_ERR_CODE}. Codes are case-sensitive — the legacy
     *  source has them all uppercase except {@code LOGIN_CAN} which is
     *  the same in any case (no lower-case variant exists). */
    code: string;
    /** i18n key consumers pass to {@code t(...)} — always under the
     *  {@code fb_history.result.<code>} namespace. */
    i18nKey: ScrapingResultI18nKey;
    /** Legacy ML key (e.g. {@code "comm_0221_001_j027"}). Recorded for
     *  traceability against the Jex Studio ML registration; not used
     *  at runtime. */
    legacyMlKey: string;
};

/**
 * 18-entry registry keyed by result code. Order mirrors the legacy
 * {@code resultMap} declaration at {@code comm_0221_001.ts:459-478}
 * so a side-by-side diff with the source is immediate.
 */
export const SCRAPING_RESULT_CODES: Readonly<Record<string, ScrapingResultEntry>> = Object.freeze({
    "42110000": { code: "42110000", i18nKey: "fb_history.result.42110000", legacyMlKey: "comm_0221_001_j027" },
    "80004113": { code: "80004113", i18nKey: "fb_history.result.80004113", legacyMlKey: "comm_0221_001_j028" },
    "80010011": { code: "80010011", i18nKey: "fb_history.result.80010011", legacyMlKey: "comm_0221_001_j029" },
    "80002216": { code: "80002216", i18nKey: "fb_history.result.80002216", legacyMlKey: "comm_0221_001_j030" },
    "80010141": { code: "80010141", i18nKey: "fb_history.result.80010141", legacyMlKey: "comm_0221_001_j031" },
    "80002411": { code: "80002411", i18nKey: "fb_history.result.80002411", legacyMlKey: "comm_0221_001_j032" },
    "8000E200": { code: "8000E200", i18nKey: "fb_history.result.8000E200", legacyMlKey: "comm_0221_001_j033" },
    "80002F33": { code: "80002F33", i18nKey: "fb_history.result.80002F33", legacyMlKey: "comm_0221_001_j035" },
    "8000FFFF": { code: "8000FFFF", i18nKey: "fb_history.result.8000FFFF", legacyMlKey: "comm_0221_001_j036" },
    "LBS00001": { code: "LBS00001", i18nKey: "fb_history.result.LBS00001", legacyMlKey: "comm_0221_001_j037" },
    "80002121": { code: "80002121", i18nKey: "fb_history.result.80002121", legacyMlKey: "comm_0221_001_j038" },
    "00000000": { code: "00000000", i18nKey: "fb_history.result.00000000", legacyMlKey: "comm_0221_001_j040" },
    "GWS06004": { code: "GWS06004", i18nKey: "fb_history.result.GWS06004", legacyMlKey: "comm_0221_001_j041" },
    "80002E21": { code: "80002E21", i18nKey: "fb_history.result.80002E21", legacyMlKey: "comm_0221_001_j042" },
    "80002214": { code: "80002214", i18nKey: "fb_history.result.80002214", legacyMlKey: "comm_0221_001_j043" },
    "80002F31": { code: "80002F31", i18nKey: "fb_history.result.80002F31", legacyMlKey: "comm_0221_001_j035" },
    "80002421": { code: "80002421", i18nKey: "fb_history.result.80002421", legacyMlKey: "comm_0221_001_j043" },
    "LOGIN_CAN": { code: "LOGIN_CAN", i18nKey: "fb_history.result.LOGIN_CAN", legacyMlKey: "comm_0221_001_j046" },
});

/** Quick existence check used by the resolver to differentiate
 *  "unknown code" (return null) from "known code, missing translation"
 *  (the {@code LocaleProvider} fallback chain handles the missing
 *  translation gracefully). */
export const KNOWN_SCRAPING_RESULT_CODES: ReadonlySet<string> = new Set(
    Object.keys(SCRAPING_RESULT_CODES),
);

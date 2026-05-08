/**
 * DICTIONARY_VAN — shared lookup utility.
 *
 * <p>Resolves a 4-character VAN response code (e.g. {@code "0000"} /
 * {@code "1030"} / {@code "FB01"} / {@code "G999"}) to the
 * locale-appropriate message ported from the legacy ETC dictionary
 * XML. Currently consumed by Settings &gt; Firm Banking History F-leg
 * rows; any future banking / payment / VAN-gateway feature that
 * surfaces a response code should consume this module rather than
 * inline its own translation map.
 *
 * <p>The lookup is keyed <b>only</b> by the response code — there is
 * no per-{@code VAN_ORG_CD} dictionary in the legacy ETC tree, and
 * the legacy {@code jexjs.getCode("DICTIONARY_VAN", RSLT_CD)} call
 * site at
 * {@code WECMS DEV/WECMS_STATIC/ts-src/js/jex/wabooks/comm/comm_0221_001.ts:440}
 * passes {@code RSLT_CD} alone.
 *
 * @see ./dictionaryVan.data.ts for the static data table.
 */

import type { Locale } from "@/lib/i18n";

import {
    DICTIONARY_VAN,
    localizedMessage,
    type DictionaryVanEntry,
} from "./dictionaryVan.data";

/**
 * Resolve a VAN response code to the locale-appropriate message.
 *
 * <p>Returns {@code null} for:
 * <ul>
 *   <li>missing / blank input ({@code null} / {@code undefined} / {@code ""})</li>
 *   <li>codes not present in the dictionary (e.g. legacy DEV codes
 *       {@code 0091} / {@code 0011} / {@code 1006} / {@code 1000} —
 *       known production gaps that the legacy XML does not cover)</li>
 * </ul>
 *
 * <p>Callers MUST treat {@code null} as a graceful "no dictionary
 * entry" signal and fall back to the row's own {@code rslt_msg} or a
 * neutral label. Mirrors the legacy fallback chain at
 * {@code comm_0221_001.ts:440-442}:
 *
 * <pre>{@code
 *   RSLT_MSG = jexjs.getCode("DICTIONARY_VAN", RSLT_CD)
 *   RSLT_MSG = RSLT_MSG ?? multiLanguagesObj['comm_0221_001_j004']  // "Failed"
 * }</pre>
 *
 * <p>Lookup is whitespace-trimmed but case-sensitive: the legacy XML
 * filenames (and the {@code RS_CD} values they reference) are mixed
 * upper-numeric (e.g. {@code FB01} / {@code G999}), so case folding
 * would map {@code "fb01"} to a non-existent entry. The
 * {@code TB_FIRM_TRAN.RS_CD} column in the live system carries the
 * codes verbatim from the gateway.
 */
export function lookupVanMessage(
    code: string | null | undefined,
    locale: Locale,
): string | null {
    if (code === null || code === undefined) return null;
    const trimmed = code.trim();
    if (trimmed === "") return null;
    const entry = DICTIONARY_VAN[trimmed];
    if (!entry) return null;
    return localizedMessage(entry, locale);
}

/**
 * Resolve a VAN response code with a safe fallback chain. Mirrors
 * the legacy F-leg fallback at {@code comm_0221_001.ts:440-442}:
 *
 * <ol>
 *   <li>Locale-appropriate dictionary message if {@code code} is in
 *       {@link DICTIONARY_VAN}.</li>
 *   <li>Otherwise the row's existing {@code rsltMsg} (free-text from
 *       the source leg).</li>
 *   <li>Otherwise the optional {@code emptyFallback} (typically a
 *       localized "Failed" label).</li>
 *   <li>Otherwise the empty string.</li>
 * </ol>
 *
 * <p>This is the canonical resolver every caller should use. Inlining
 * the if-else chain at the call site is the bug pattern this helper
 * exists to prevent.
 */
export function resolveVanMessage(
    code: string | null | undefined,
    rsltMsg: string | null | undefined,
    locale: Locale,
    emptyFallback?: string | null,
): string {
    const dict = lookupVanMessage(code, locale);
    if (dict) return dict;
    const msg = (rsltMsg ?? "").trim();
    if (msg) return msg;
    return emptyFallback ?? "";
}

/**
 * Direct dictionary access for diagnostic / introspection use cases
 * (e.g. listing all known codes in an admin panel, asserting code
 * coverage in tests). Returns the underlying entry — do not mutate
 * the result.
 */
export function getVanEntry(code: string): DictionaryVanEntry | undefined {
    return DICTIONARY_VAN[code.trim()];
}

/** Total count of dictionary entries available — useful for tests
 *  that assert the legacy XML port is complete. */
export const DICTIONARY_VAN_SIZE: number = Object.keys(DICTIONARY_VAN).length;

export type { DictionaryVanEntry };

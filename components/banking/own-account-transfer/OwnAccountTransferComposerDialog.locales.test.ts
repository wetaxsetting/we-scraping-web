/**
 * Locale coverage for the Own Account Transfer composer's engine-error
 * messages (legacy-parity sweep item 6, 2026-08-18).
 *
 * <p>Legacy resolves these through the JEX ML table / RSPS_CD codes at runtime
 * and falls back to an inline English default when a translation is missing
 * (`trns_0001_007.ts:138-141` → `ML.get(key, "<EN default>")`). The refactor's
 * equivalent is `locales/{en,ko,vi}.json` plus the EN fallback chain in
 * `lib/i18n/LocaleProvider.tsx:99-101`
 * (`MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key`).
 *
 * <p>These assertions pin two things:
 *   1. **EN is always present** for every key the composer can render, so
 *      `t()` can never leak a raw key into a dialog in any locale.
 *   2. **Translations are only claimed where a legacy source actually exists.**
 *      `balance_inquiry_failed` has no VI text because `CD_WBW1103.xml` ships
 *      EN / KM / KO only — inventing one is forbidden
 *      (`wecms-web/CLAUDE.md` §13a-bis), so VI resolves via the EN fallback.
 *
 * @see ../../../docs/bugs/internal-transfer-legacy-parity-sweep-2026-08-18.md
 */

import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import ko from "@/locales/ko.json";
import vi from "@/locales/vi.json";

const LOCALES: Record<string, Record<string, string>> = { en, ko, vi };

/** Every message key the composer's error paths can render. */
const COMPOSER_ERROR_KEYS = [
    "own_account_transfer.composer.error.engine_failed",
    "own_account_transfer.composer.error.engine_80002411",
    "own_account_transfer.composer.error.engine_unexpected",
    "own_account_transfer.composer.error.balance_inquiry_failed",
    "own_account_transfer.composer.error.balance_required",
    "own_account_transfer.composer.error.intake_failed",
    "own_account_transfer.composer.error.napas_invalid",
] as const;

/** Keys whose KO / VI text is genuinely available from a legacy source, with
 *  the source named so a reviewer can re-verify without guessing. */
const VERIFIED_TRANSLATIONS: Record<string, { locales: string[]; source: string }> = {
    "own_account_transfer.composer.error.engine_unexpected":
        { locales: ["en", "ko", "vi"], source: "CD_WBE9999.xml (EN/KM/KO/VI)" },
    "own_account_transfer.composer.error.balance_required":
        { locales: ["en", "ko", "vi"], source: "CD_WBE6021.xml (EN/KM/KO/VI)" },
    "own_account_transfer.composer.error.balance_inquiry_failed":
        { locales: ["en", "ko"],       source: "CD_WBW1103.xml (EN/KM/KO — no VI)" },
};

describe("OAT composer error messages — locale coverage", () => {
    it("every renderable key has EN text, so t() never leaks a raw key", () => {
        const missing = COMPOSER_ERROR_KEYS.filter((k) => typeof en[k] !== "string");
        expect(missing).toEqual([]);
    });

    it("no key resolves to an empty string in any locale that defines it", () => {
        const blanks: string[] = [];
        for (const [loc, dict] of Object.entries(LOCALES)) {
            for (const key of COMPOSER_ERROR_KEYS) {
                const v = dict[key];
                if (v !== undefined && v.trim().length === 0) blanks.push(`${loc}:${key}`);
            }
        }
        expect(blanks).toEqual([]);
    });

    it.each(Object.entries(VERIFIED_TRANSLATIONS))(
        "%s carries text in exactly the locales its legacy source provides",
        (key, { locales, source }) => {
            for (const loc of ["en", "ko", "vi"]) {
                const present = typeof LOCALES[loc][key] === "string";
                expect(
                    present,
                    `${key} in ${loc}.json — expected ${locales.includes(loc) ? "present" : "ABSENT"} per ${source}`,
                ).toBe(locales.includes(loc));
            }
        },
    );

    it("engine_80002411 is EN-only — its KO/VI live in the DB ML table, unreachable from the repo", () => {
        // `trns_0001_007_js80002411` is an ML key, not an RSPS_CD code: no XML
        // in WECMS_ETC, no file under WECMS_SYNC/dbSync/AD_DST_MGNT/ML_*, and
        // no Postgres MCP wired to read the table. EN is the verbatim inline
        // `ML.get` default; KO/VI intentionally fall back to EN.
        const key = "own_account_transfer.composer.error.engine_80002411";
        expect(en[key]).toBe(
            "The sender account cannot be transferred.Please use another sender account.",
        );
        expect(ko[key]).toBeUndefined();
        expect(vi[key]).toBeUndefined();
    });

    it("the EN fallback chain covers every locale for every renderable key", () => {
        // Mirrors LocaleProvider's resolution order.
        const resolve = (loc: string, key: string) =>
            LOCALES[loc][key] ?? LOCALES.en[key] ?? key;
        for (const loc of Object.keys(LOCALES)) {
            for (const key of COMPOSER_ERROR_KEYS) {
                const out = resolve(loc, key);
                expect(out, `${loc}:${key}`).not.toBe(key);   // never the raw key
                expect(out.trim().length).toBeGreaterThan(0);
            }
        }
    });
});

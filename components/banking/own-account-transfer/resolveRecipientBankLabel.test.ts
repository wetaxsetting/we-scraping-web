/**
 * Regression coverage for the "Recipient Bank" label shown in the
 * Transfer Confirmation popup.
 *
 * <p>Legacy renders the pipe-joined composite from the NAPAS dictionary
 * (confirmed against `test.wecms.vn/trns_0001_001.act`, 2026-08-19):
 * <pre>
 *   SHINHAN BANK | Shinhan Bank Vietnam Limited (970424)
 *    SHORT_NAME  |        LONG_NAME_EN         (NAPAS_BANK_CD)
 * </pre>
 *
 * <p>Two defects are guarded here, fixed in sequence on 2026-08-19:
 * <ol>
 *   <li>The popup showed the bank's own internal string
 *       (`SHBVN_Ngan hang TNHH MTV ShinHan Viet Nam`) because the engine
 *       org-obj never carried `recpBankNm`, so the NXiSAS bundle fell
 *       back to `obj.req.transfer[0].remitBank` (`nxisas_v2.js:1360`).</li>
 *   <li>Once supplied, the label was still only
 *       `LONG_NAME_EN (NAPAS)` — the `SHORT_NAME |` prefix was missing,
 *       because the dictionary names resolved by the pre-scrape NAPAS
 *       validation were discarded instead of threaded through.</li>
 * </ol>
 *
 * <p>The names cost nothing extra: `GET /napas-bank-info/{code}` already
 * runs on every cross-bank leg (legacy `fnReadNapasBankCode` parity) and
 * returns `short_name` / `long_name_en` (backend B9, 2026-06-04).
 *
 * @see ../../../docs/bugs/own-account-transfer-confirmation-display-fields-2026-08-19.md
 * @see ../../../docs/audits/own-account-transfer-transfer-confirmation-modal-parity-audit-2026-08-19.md
 */

import { describe, expect, it } from "vitest";

import { resolveRecipientBankLabel } from "./OwnAccountTransferComposerDialog";
import type { OwnAccountTargetRow } from "./types";

/* ===================================================================
 *  Fixtures — the Shinhan recipient from the 2026-08-19 report
 * ================================================================= */

function target(over: Partial<OwnAccountTargetRow> = {}): OwnAccountTargetRow {
    return {
        kind:        "OWN_ACCOUNT",
        bankCd:      "11704088",
        bankNm:      "Shinhan(Vietnam)",
        acctNo:      "700022499445",
        acctNickNm:  "SHB 9445",
        acctTypeCd:  "02",
        ccyCd:       "VND",
        napasBankCd: "970424",
        ...over,
    };
}

const NAMES = {
    shortName:  "SHINHAN BANK",
    longNameEn: "Shinhan Bank Vietnam Limited",
};

/* ===================================================================
 *  Tests
 * ================================================================= */

describe("resolveRecipientBankLabel — legacy composite", () => {
    it("builds SHORT_NAME | LONG_NAME_EN (NAPAS_BANK_CD)", () => {
        expect(resolveRecipientBankLabel(null, target(), NAMES))
            .toBe("SHINHAN BANK | Shinhan Bank Vietnam Limited (970424)");
    });

    it("trims stray whitespace around the dictionary names", () => {
        // The dictionary columns are varchar(100)/varchar(500); padded
        // values must not leak into the label.
        expect(resolveRecipientBankLabel(null, target(), {
            shortName:  "  SHINHAN BANK  ",
            longNameEn: "  Shinhan Bank Vietnam Limited  ",
        })).toBe("SHINHAN BANK | Shinhan Bank Vietnam Limited (970424)");
    });
});

describe("resolveRecipientBankLabel — graceful degradation", () => {
    it("omits the separator when only the long name is present", () => {
        // Never emit a dangling " | ".
        expect(resolveRecipientBankLabel(null, target(), {
            shortName: null, longNameEn: NAMES.longNameEn,
        })).toBe("Shinhan Bank Vietnam Limited (970424)");
    });

    it("omits the separator when only the short name is present", () => {
        expect(resolveRecipientBankLabel(null, target(), {
            shortName: NAMES.shortName, longNameEn: null,
        })).toBe("SHINHAN BANK (970424)");
    });

    it("falls back to the target row's bank name when the dictionary is empty", () => {
        expect(resolveRecipientBankLabel(null, target(), {
            shortName: null, longNameEn: null,
        })).toBe("Shinhan(Vietnam) (970424)");
    });

    it("falls back identically when no dictionary names are passed at all", () => {
        // SAME_BANK legs run no NAPAS lookup, so the composer passes
        // nulls — this must behave exactly like the pre-2026-08-19 path.
        expect(resolveRecipientBankLabel(null, target()))
            .toBe("Shinhan(Vietnam) (970424)");
    });

    it("falls back to the bank code when the row has no bank name", () => {
        expect(resolveRecipientBankLabel(null, target({ bankNm: "" }), {
            shortName: null, longNameEn: null,
        })).toBe("11704088 (970424)");
    });

    it("drops the NAPAS suffix when the row carries no NAPAS code", () => {
        expect(resolveRecipientBankLabel(null, target({ napasBankCd: null }), NAMES))
            .toBe("SHINHAN BANK | Shinhan Bank Vietnam Limited");
    });

    it("never returns the strings \"undefined\" or \"null\"", () => {
        // `isMeaninglessLabel` guards the stringified-nullish case that
        // produced literal "undefined" labels before 2026-06-01e.
        expect(resolveRecipientBankLabel("undefined", target(), NAMES))
            .toBe("SHINHAN BANK | Shinhan Bank Vietnam Limited (970424)");
        expect(resolveRecipientBankLabel("null", target(), NAMES))
            .toBe("SHINHAN BANK | Shinhan Bank Vietnam Limited (970424)");
        expect(resolveRecipientBankLabel(null, null, NAMES)).toBe("");
    });
});

describe("resolveRecipientBankLabel — bridge precedence", () => {
    it("uses a real bridge value verbatim", () => {
        // Once the org-obj carries recpBankNm, the scraped value IS our
        // value — so bridge-first precedence is harmless and preserved.
        expect(resolveRecipientBankLabel(
            "SHINHAN BANK | Shinhan Bank Vietnam Limited (970424)", target(), NAMES,
        )).toBe("SHINHAN BANK | Shinhan Bank Vietnam Limited (970424)");
    });

    it("prefers the bridge value over the dictionary composite", () => {
        expect(resolveRecipientBankLabel("Bank From Engine", target(), NAMES))
            .toBe("Bank From Engine");
    });
});

/**
 * Multi-level-approval (`_ML`) detection — the predicate behind the
 * "needs approval in internet banking" success message.
 *
 * <p><b>Why this file exists.</b> An `_ML` job does not move money; it
 * only REGISTERS the transfer at the bank, and someone must approve it
 * in the bank's own internet banking before it settles. Showing a bare
 * "Transfer completed successfully" for those tells the user the
 * opposite of what happened.
 *
 * <p><b>The trap this pins down.</b> It is tempting to express the rule
 * as a bank list — "Vietcom and VIETIN are the ML banks". That is wrong
 * twice:
 * <ol>
 *   <li><b>Shinhan is `_ML` on its same-bank leg only</b>
 *       (`bank-profiles.ts:200`, legacy `trns_0001_007.ts:1952`) — a
 *       bank list either misses it or over-warns on its NAPAS leg.</li>
 *   <li><b>Vietcom drops out of `_ML` entirely on a DIGIBIZ
 *       credential</b> (`:285-287`, legacy `:1980-1983`) — a bank list
 *       would warn when no approval is needed.</li>
 * </ol>
 * So the predicate must read the job the profile actually produced.
 *
 * <p>Legacy semantics: `trns_0003_001.ts:96` (다단계 승인 → finish in
 * internet banking) and `trns_0002_001.ts:266`
 * (`TRANSFER_ML … (Need Approve)`).
 */

import { describe, expect, it } from "vitest";

import {
    buildNxisasOrgObj,
    isMultiLevelApprovalJob,
    orgObjNeedsBankApproval,
    recordedTransferNeedsBankApproval,
} from "./bank-profiles";
import type { OwnAccountTransferDraft } from "./types";

const IBK     = "11704003";
const SHINHAN = "11704088";
const WOORI   = "11704020";
const VIETCOM = "11704004";
const VIETIN  = "11704001";

function draft(sourceBankCd: string, targetBankCd: string): OwnAccountTransferDraft {
    return {
        source: {
            bankCd: sourceBankCd, bankNm: "src", acctNo: "0001",
            acctNickNm: "SRC", acctTypeCd: "03", ccyCd: "VND",
            balance: 1_000_000, available: 1_000_000, canTransfer: true,
            bankCertSeq: "1", certInfoCon: "id", certInfoDetlCon: "pw",
            nxisasGbSeqNo: "0",
        } as unknown as OwnAccountTransferDraft["source"],
        target: {
            bankCd: targetBankCd, bankNm: "tgt", acctNo: "0002",
            acctNickNm: "TGT", napasBankCd: "970455", ccyCd: "VND",
        } as unknown as OwnAccountTransferDraft["target"],
        transferType:       sourceBankCd === targetBankCd ? "SAME_BANK" : "NAPAS",
        amount:             10_000,
        acctPassword:       "pw",
        trnsPassword:       "",
        feeBearer:          "B",
        remarkForRecipient: "",
        remarkForSender:    "",
        idempotencyKey:     "k",
    };
}

/** Build the payload the way the composer does, then ask the predicate. */
function needsApproval(sourceBankCd: string, targetBankCd: string, bankClass?: string): boolean {
    const d = draft(sourceBankCd, targetBankCd);
    return orgObjNeedsBankApproval(
        buildNxisasOrgObj({
            draft:     d,
            internal:  d.transferType === "SAME_BANK",
            remitDate: "20260827",
            bankClass,
        }),
    );
}

describe("isMultiLevelApprovalJob", () => {
    it("is true for the two _ML job kinds", () => {
        expect(isMultiLevelApprovalJob("TRANSFER_ML")).toBe(true);
        expect(isMultiLevelApprovalJob("TRANSFER_INTERNAL_ML")).toBe(true);
    });

    it("is false for the immediate-execution job kinds", () => {
        expect(isMultiLevelApprovalJob("TRANSFER")).toBe(false);
        expect(isMultiLevelApprovalJob("TRANSFER_INTERNAL")).toBe(false);
    });
});

describe("orgObjNeedsBankApproval — per bank AND per leg", () => {
    it.each([
        ["VIETIN  same-bank", VIETIN,  VIETIN,  true],
        ["VIETIN  NAPAS",     VIETIN,  VIETCOM, true],
        ["Vietcom same-bank", VIETCOM, VIETCOM, true],
        ["Vietcom NAPAS",     VIETCOM, VIETIN,  true],
    ])("%s → needs approval", (_n, src, tgt, expected) => {
        expect(needsApproval(src, tgt)).toBe(expected);
    });

    it.each([
        ["IBK   same-bank", IBK,   IBK,   false],
        ["IBK   NAPAS",     IBK,   WOORI, false],
        ["Woori same-bank", WOORI, WOORI, false],
        ["Woori NAPAS",     WOORI, IBK,   false],
    ])("%s → immediate, no notice", (_n, src, tgt, expected) => {
        expect(needsApproval(src, tgt)).toBe(expected);
    });

    /* --- the two cases a bank-level rule would get wrong ------------ */

    it("🔴 Shinhan is _ML on the SAME-BANK leg — a bank list would miss it", () => {
        expect(needsApproval(SHINHAN, SHINHAN)).toBe(true);
    });

    it("🔴 Shinhan's NAPAS leg is NOT _ML — a bank list would over-warn", () => {
        expect(needsApproval(SHINHAN, VIETCOM)).toBe(false);
    });

    it("🔴 Vietcom on a DIGIBIZ credential is NOT _ML — a bank list would over-warn", () => {
        expect(needsApproval(VIETCOM, VIETCOM, "DIGIBIZ")).toBe(false);
        expect(needsApproval(VIETCOM, VIETIN,  "DIGIBIZ")).toBe(false);
    });

    it("Vietcom on a CORPORATE credential stays _ML", () => {
        expect(needsApproval(VIETCOM, VIETCOM, "CORPORATE")).toBe(true);
    });
});

/* ===================================================================
 *  recordedTransferNeedsBankApproval — the Transfer History path
 *
 *  History rows carry no job kind (NAPAS_REMIT_TRNS_HSTR has no such
 *  column), so the predicate re-derives it from the two bank codes.
 *  The DRIFT GUARD below is the important test: it cross-checks that
 *  re-derivation against what the real profile builders produce, so a
 *  future change to a builder cannot silently desync the history
 *  tooltip from the composer.
 * ================================================================= */

describe("recordedTransferNeedsBankApproval — drift guard vs the real builders", () => {
    const BANKS = [IBK, SHINHAN, WOORI, VIETCOM, VIETIN];

    it.each(
        BANKS.filter((b) => b !== VIETCOM).flatMap((src) => [
            { src, tgt: src,                               leg: "same-bank" },
            { src, tgt: src === VIETIN ? SHINHAN : VIETIN, leg: "NAPAS"     },
        ]),
    )("$src $leg — derived answer matches buildNxisasOrgObj", ({ src, tgt }) => {
        expect(recordedTransferNeedsBankApproval(src, tgt)).toBe(needsApproval(src, tgt));
    });

    /**
     * Vietcom is excluded from the loop above because the history path
     * deliberately assumes **DIGIBIZ** while `buildNxisasOrgObj` with no
     * `bankClass` falls back to CORPORATE. The two therefore differ by
     * design — and the history answer is the correct one, because a
     * CORPORATE Vietcom transfer cannot reach a success row at all
     * (Coocon 2026-08-26: `80010222`, *"TRANSFER_ML in Vietcom CORPORATE
     * is old job that Wabooks never used"*).
     */
    it("Vietcom: history assumes DIGIBIZ and matches the DIGIBIZ builder", () => {
        expect(recordedTransferNeedsBankApproval(VIETCOM, VIETCOM))
            .toBe(needsApproval(VIETCOM, VIETCOM, "DIGIBIZ"));
        expect(recordedTransferNeedsBankApproval(VIETCOM, VIETIN))
            .toBe(needsApproval(VIETCOM, VIETIN, "DIGIBIZ"));
    });
});

describe("recordedTransferNeedsBankApproval — edge cases", () => {
    it("Shinhan same-bank vs NAPAS differ, as in the composer", () => {
        expect(recordedTransferNeedsBankApproval(SHINHAN, SHINHAN)).toBe(true);
        expect(recordedTransferNeedsBankApproval(SHINHAN, VIETCOM)).toBe(false);
    });

    it("an unknown bank falls back to _ML, matching fallbackProfile", () => {
        expect(recordedTransferNeedsBankApproval("99999999", "99999999")).toBe(true);
    });

    it("missing bank codes never warn", () => {
        expect(recordedTransferNeedsBankApproval(null, null)).toBe(false);
        expect(recordedTransferNeedsBankApproval(undefined, IBK)).toBe(false);
        expect(recordedTransferNeedsBankApproval("", IBK)).toBe(false);
    });

    it("a null target is treated as cross-bank, not same-bank", () => {
        // Shinhan is the only bank where the legs differ, so it is the
        // one that proves the direction defaults safely.
        expect(recordedTransferNeedsBankApproval(SHINHAN, null)).toBe(false);
    });

    /**
     * Vietcom never warns in history — because a CORPORATE Vietcom
     * transfer cannot produce a success row in the first place.
     *
     * Coocon scraping team, 2026-08-26: *"Vietcom CORPORATE didn't have
     * Napas Transfer, moreover TRANSFER_ML in Vietcom CORPORATE is old
     * job that Wabooks never used before. Therefore, it got error
     * 80010222."* Corroborated on legacy UAT — a Vietcom → Vietcom
     * transfer on the same date failed with *"Job명을 확인해주시기
     * 바랍니다"*.
     *
     * So any successful Vietcom row ran on DIGIBIZ, which is immediate.
     * Revisit if the vendor ever ships a working CORPORATE module.
     */
    it("Vietcom never warns — a CORPORATE transfer cannot succeed (80010222)", () => {
        expect(recordedTransferNeedsBankApproval(VIETCOM, VIETCOM)).toBe(false);
        expect(recordedTransferNeedsBankApproval(VIETCOM, VIETIN)).toBe(false);
        // …and that agrees with the composer on the only class that works.
        expect(needsApproval(VIETCOM, VIETCOM, "DIGIBIZ")).toBe(false);
    });
});

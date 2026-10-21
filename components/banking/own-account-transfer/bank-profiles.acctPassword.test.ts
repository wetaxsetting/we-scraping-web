/**
 * Regression test for engine error `80002420` — "An account password was
 * not entered."
 *
 * <p><b>The defect.</b> IBK `11704003` was absent from
 * {@link OAT_BANK_PASSWORD_REQUIRED}, so the composer rendered its
 * Account Password input `disabled`, `acctPassword` stayed `""` forever,
 * and `bank-profiles.ts` shipped `acctNumPWD: ""` to the NXiSAS engine.
 * The IBK internet-banking site rejected the job with `80002420`.
 *
 * <p>Legacy assigns `acctNumPWD` unconditionally for IBK
 * (`trns_0001_007.ts:1943`) — it simply sourced the value from the
 * stored `ACCT_MSTR.ACCT_PWD` rather than a typed field. The refactor
 * copied the disabling and not the replacement source.
 *
 * <p>What this pins:
 * <ol>
 *   <li>IBK / Shinhan / Woori require the account password, so the
 *       composer renders an enabled input for them.</li>
 *   <li>Vietcom / Vietin do not — their engine jobs carry no
 *       `acctNumPWD` (`:1977-1984`, `:2002-2012`), so no field renders
 *       and no value is collected.</li>
 *   <li>KEB Hana is the ONLY bank that also needs a transfer password
 *       (`:1971`) — `grep transPWD` across both legacy trees returns
 *       nothing else.</li>
 *   <li>A typed password actually reaches `Input.acctNumPWD` — the
 *       specific link that was broken.</li>
 * </ol>
 *
 * Audit: `wecms-api/docs/audits/legacy-parity/own-account-transfer-account-password-source-2026-08-25.md`
 */

import { describe, expect, it } from "vitest";

import {
    isPasswordRequiredFor,
    isTransferPasswordRequiredFor,
} from "./hooks/use-own-account-transfer";
import { buildNxisasOrgObj } from "./bank-profiles";
import type { OwnAccountTransferDraft } from "./types";

const IBK     = "11704003";
const SHINHAN = "11704088";
const WOORI   = "11704020";
const VIETCOM = "11704004";
const VIETIN  = "11704001";
const KEBHANA = "11704080";

/** Minimal draft for the engine-payload assertions. Only the fields the
 *  IBK profile reads are meaningful; the rest satisfy the type. */
function draftFor(bankCd: string, acctPassword: string): OwnAccountTransferDraft {
    return {
        source: {
            bankCd,
            bankNm:         "IBK VN",
            acctNo:         "076400794420001",
            acctNickNm:     "CONG TY TNHH WEBCASH VIET NAM",
            acctTypeCd:     "03",
            ccyCd:          "VND",
            balance:        1_000_000,
            available:      1_000_000,
            canTransfer:    true,
            bankCertSeq:    "1",
            certInfoCon:    "loginid",
            certInfoDetlCon: "loginpw",
            nxisasGbSeqNo:  "0",
        } as unknown as OwnAccountTransferDraft["source"],
        target: {
            bankCd,
            bankNm:      "IBK VN",
            acctNo:      "076400794420002",
            acctNickNm:  "CONG TY TNHH WEBCASH VIET NAM",
            napasBankCd: "970455",
            ccyCd:       "VND",
        } as unknown as OwnAccountTransferDraft["target"],
        transferType:       "SAME_BANK",
        amount:             10_000,
        acctPassword,
        trnsPassword:       "",
        feeBearer:          "B",
        remarkForRecipient: "",
        remarkForSender:    "",
        idempotencyKey:     "test-key",
    };
}

describe("account-password requirement matrix — legacy trns_0001_007.ts:1930-2012", () => {
    it.each([
        ["IBK",     IBK],
        ["Shinhan", SHINHAN],
        ["Woori",   WOORI],
        ["KEBHana", KEBHANA],
    ])("%s requires the account password", (_name, bankCd) => {
        expect(isPasswordRequiredFor(bankCd)).toBe(true);
    });

    it.each([
        ["Vietcom", VIETCOM],
        ["Vietin",  VIETIN],
    ])("%s does not — its engine job carries no acctNumPWD", (_name, bankCd) => {
        expect(isPasswordRequiredFor(bankCd)).toBe(false);
    });

    it("IBK is in the matrix — the exact regression behind 80002420", () => {
        // Before the fix this returned false, which disabled the input,
        // which shipped acctNumPWD:"" to the bank.
        expect(isPasswordRequiredFor(IBK)).toBe(true);
    });

    it("handles null / undefined / unknown bank codes without throwing", () => {
        expect(isPasswordRequiredFor(null)).toBe(false);
        expect(isPasswordRequiredFor(undefined)).toBe(false);
        expect(isPasswordRequiredFor("99999999")).toBe(false);
    });
});

describe("transfer-password requirement matrix — KEB Hana only", () => {
    it("KEB Hana requires it (legacy :1971)", () => {
        expect(isTransferPasswordRequiredFor(KEBHANA)).toBe(true);
    });

    it.each([
        ["IBK",     IBK],
        ["Shinhan", SHINHAN],
        ["Woori",   WOORI],
        ["Vietcom", VIETCOM],
        ["Vietin",  VIETIN],
    ])("%s does not", (_name, bankCd) => {
        expect(isTransferPasswordRequiredFor(bankCd)).toBe(false);
    });

    it("no bank in the current allow-list needs a transfer password", () => {
        const allowListed = [IBK, SHINHAN, WOORI, VIETCOM, VIETIN];
        expect(allowListed.filter(isTransferPasswordRequiredFor)).toEqual([]);
    });
});

describe("the typed password reaches the engine payload", () => {
    it("IBK ships the typed value as Input.acctNumPWD", () => {
        const orgObj = buildNxisasOrgObj({
            draft:     draftFor(IBK, "s3cret"),
            internal:  true,
            remitDate: "20260826",
        });

        expect(orgObj.job[0].Input.acctNumPWD).toBe("s3cret");
    });

    it("an empty password still reaches the payload as \"\" — the 80002420 shape", () => {
        // Documents the failing state so a future refactor that
        // reintroduces a disabled input fails loudly here rather than at
        // the bank. The client-side guard (validateDraft) is what stops
        // this reaching the engine in practice.
        const orgObj = buildNxisasOrgObj({
            draft:     draftFor(IBK, ""),
            internal:  true,
            remitDate: "20260826",
        });

        expect(orgObj.job[0].Input.acctNumPWD).toBe("");
    });
});

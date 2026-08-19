/**
 * Regression coverage for engine SESSION REUSE on the Own Account
 * Transfer org-obj builder.
 *
 * <p>Guards the defect fixed 2026-08-19: inside one open Transfer modal,
 * clicking **Update Balance** and then **Next** made the NXiSAS bundle
 * re-open the engine and re-run the `LOGIN` job against a Vietcom IB
 * session that was still authenticated — the balance job runs
 * `nonLogout:true`, so the engine appends no `LOGOUT`
 * (`nxisas_v2.js:1056-1080`). Vietcom answered the second LOGIN with
 * `80002F31` — *"The transaction failed, since the financial institution`s
 * webpage was modified."*
 *
 * <p>Legacy behaviour under test — `trns_0001_007.ts`:
 * <ul>
 *   <li>`:1654` — a BALANCE returning `00000000` sets
 *       `trns_0001.runScrapingJob = true` (the session is alive).</li>
 *   <li>`:2123-2125` — when that flag is set, the TRANSFER org-obj gets
 *       `nonLogin = true`, so no LOGIN job is built.</li>
 *   <li>`:2096-2101` — `nonLogout = true` always; the Woori VN branch sets
 *       `nonLogin = false` BEFORE the flag branch, so the flag wins on
 *       ordering.</li>
 * </ul>
 *
 * @see ../../../docs/bugs/own-account-transfer-engine-session-reuse-2026-08-19.md
 */

import { describe, expect, it } from "vitest";

import { buildNxisasOrgObj } from "./bank-profiles";
import type {
    OwnAccountSourceRow,
    OwnAccountTargetRow,
    OwnAccountTransferDraft,
} from "./types";

/* ===================================================================
 *  Fixtures — the Vietcom account from the 2026-08-18 defect report
 * ================================================================= */

const VIETCOM  = "11704004";
const WOORI_VN = "11704020";

function source(bankCd: string): OwnAccountSourceRow {
    return {
        bankCd,
        bankNm:              "Vietcom",
        acctNo:              "0441000688210",
        acctNickNm:          "VCB 8210",
        acctTypeCd:          "02",
        balance:             3_369_311,
        available:           3_369_311,
        ccyCd:               "VND",
        lastInquiryStts:     "00000000",
        lastInquiryMsg:      "",
        lastInquiryAt:       "20260818103856",
        lastBalanceUpdateAt: "20260818103856",
        canTransfer:         true,
        bankCertSeq:         "2",
        certInfoCon:         "9744496G111",
        nxisasGbSeqNo:       "0",
        loginID:             "9744496G111",
        loginPWD:            "pw",
    };
}

function target(bankCd: string): OwnAccountTargetRow {
    return {
        kind:        "OWN_ACCOUNT",
        bankCd,
        bankNm:      "Shinhan",
        acctNo:      "700009445445",
        acctNickNm:  "SHINHAN 445",
        acctTypeCd:  "02",
        ccyCd:       "VND",
        napasBankCd: "970443",
    };
}

function draft(bankCd: string): OwnAccountTransferDraft {
    return {
        source:             source(bankCd),
        target:             target("11704088"),
        transferType:       "NAPAS",
        amount:             100_000,
        acctPassword:       "",
        feeBearer:          "A",
        remarkForRecipient: "Vietcom 210 to Shinhan 445",
        remarkForSender:    "Vietcom 210 to Shinhan 445",
        idempotencyKey:     "test-key",
    };
}

function build(bankCd: string, reuseSession?: boolean) {
    return buildNxisasOrgObj({
        draft:     draft(bankCd),
        internal:  false,
        remitDate: "20260819",
        bankClass: "CORPORATE",
        ...(reuseSession === undefined ? {} : { reuseSession }),
    });
}

/* ===================================================================
 *  Tests
 * ================================================================= */

describe("buildNxisasOrgObj — engine session reuse (nonLogin)", () => {
    it("omits nonLogin when no session is alive — the engine must LOGIN", () => {
        // Legacy default: `runScrapingJob === false` → the `:2123` branch
        // never runs, so `nonLogin` is left unset and the bundle prepends
        // the LOGIN job (`nxisas_v2.js:943`).
        const obj = build(VIETCOM);
        expect(obj.nonLogin).toBeUndefined();
    });

    it("omits nonLogin when reuseSession is explicitly false", () => {
        const obj = build(VIETCOM, false);
        expect(obj.nonLogin).toBeUndefined();
    });

    it("sets nonLogin:true when a session is alive — no second LOGIN, no 80002F31", () => {
        // THE REGRESSION. Before the fix the composer had no session state
        // at all, so this flag could never be set and the second engine
        // call always re-ran LOGIN on an authenticated Vietcom page.
        const obj = build(VIETCOM, true);
        expect(obj.nonLogin).toBe(true);
    });

    it("keeps nonLogout:true in every case — legacy :2096", () => {
        expect(build(VIETCOM).nonLogout).toBe(true);
        expect(build(VIETCOM, true).nonLogout).toBe(true);
        expect(build(WOORI_VN).nonLogout).toBe(true);
    });

    it("keeps the Woori VN nonLogin:false default when no session is alive", () => {
        // Legacy `:2099-2102` — the Woori branch runs on its own.
        expect(build(WOORI_VN).nonLogin).toBe(false);
    });

    it("applies session reuse AFTER the Woori branch — legacy ordering", () => {
        // Legacy sets `nonLogin = false` for Woori at `:2100` and then
        // overwrites it at `:2123` when the flag is set. Ordering is pinned
        // here so a future refactor cannot silently invert it. The composer
        // never reaches this state for Woori (its BALANCE runs
        // `nonLogout:false`, so no session is tracked) — this asserts the
        // builder's own contract, not the composer's.
        expect(build(WOORI_VN, true).nonLogin).toBe(true);
    });

    it("does not disturb the cert / job payload when reusing a session", () => {
        const plain = build(VIETCOM);
        const reuse = build(VIETCOM, true);
        expect(reuse.bankCd).toBe(plain.bankCd);
        expect(reuse.certInfoCon).toBe(plain.certInfoCon);
        expect(reuse.loginID).toBe(plain.loginID);
        expect(reuse.nxisasGbSeqNo).toBe(plain.nxisasGbSeqNo);
        expect(reuse.job).toEqual(plain.job);
    });
});

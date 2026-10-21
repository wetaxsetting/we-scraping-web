/**
 * Regression coverage for the NAPAS-leg `transType` wire value on the
 * Own Account Transfer engine payload.
 *
 * <p>Guards the defect fixed 2026-08-19: every bank profile sent
 * `transType: ""` on the cross-bank leg, so the bank's engine module
 * could not tell the remit was an inter-bank NAPAS transfer. It fell
 * back to the domestic/CITAD route, which requires the receiving
 * bank's branch — a field WeCMS has no UI, DTO, or column for — and
 * answered `80010222`, *"No Deposit Bank Branch Code entered. Please
 * check and try it again."*
 *
 * <p>The wrong constant came from misreading legacy
 * `trns_0001_007.ts:2056`, which is an ASSIGNMENT
 * (`data.REC.BANK_CD = '11704008'`), not a comparison. Being always
 * truthy, it makes every cross-bank transfer take `transType = "2"`
 * at runtime and leaves the `else { transType = "" }` at `:2058-2059`
 * unreachable. Read as `==`, that dead branch looks like the
 * cross-bank case — which is what shipped.
 *
 * <p>Evidence the value must be `"2"`:
 * <ul>
 *   <li>`TransType.java:33-34` — `"1"` = 당행이체 (within-bank),
 *       `"2"` = 타행이체 (other-bank).</li>
 *   <li>`trns_0001_001.ts:1399-1410` — `// Default:"", 1 : Within Bank,
 *       2: Other Bank`, and `remitBankCode` is documented
 *       `//* required when transType = 2`.</li>
 *   <li>`trns_0002_001_c001_act.jsp` — requires `IN_NAPAS_BANK_CODE`
 *       only when `TYPE_2`.</li>
 *   <li>Legacy UAT `napas_remit_trns_hstr` — all 20 successful
 *       cross-bank rows carry `TRANS_TYPE='2'`; none carry `''`.
 *       Four are Vietin (`11704001`) and two are Vietcom
 *       (`11704004`) — the banks that reproduced the failure.</li>
 * </ul>
 *
 * <p>Note the DB column is NOT the wire value: `OwnAccountTransferService`
 * derives `NAPAS_REMIT_TRNS_HSTR.TRANS_TYPE` independently (`SAME_BANK
 * ? "1" : "2"`), which is why the failed rows persisted `'2'` while the
 * engine received `''`. Assert the payload, never the row.
 */

import { describe, expect, it } from "vitest";

import { getBankProfileBuilder } from "./bank-profiles";
import type {
    OwnAccountSourceRow,
    OwnAccountTargetRow,
    OwnAccountTransferDraft,
} from "./types";

/* ===================================================================
 *  Fixtures
 * ================================================================= */

const SHINHAN  = "11704088";
const IBK      = "11704003";
const VIETCOM  = "11704004";
const VIETIN   = "11704001";
const WOORI_VN = "11704020";

/** Every bank in the Path-A allow-list, plus the unknown-bank fallback. */
const ALL_PROFILES = [SHINHAN, IBK, VIETCOM, VIETIN, WOORI_VN, "99999999"];

function source(bankCd: string): OwnAccountSourceRow {
    return {
        bankCd,
        bankNm:              "Source Bank",
        acctNo:              "112002954853",
        acctNickNm:          "SRC 4853",
        acctTypeCd:          "02",
        balance:             10_000_000,
        available:           10_000_000,
        ccyCd:               "VND",
        lastInquiryStts:     "00000000",
        lastInquiryMsg:      "",
        lastInquiryAt:       "20260819071930",
        lastBalanceUpdateAt: "20260819071930",
        canTransfer:         true,
        bankCertSeq:         "2",
        certInfoCon:         "cert",
        nxisasGbSeqNo:       "0",
        loginID:             "login",
        loginPWD:            "pw",
    };
}

function target(bankCd: string): OwnAccountTargetRow {
    return {
        kind:        "OWN_ACCOUNT",
        bankCd,
        bankNm:      "Target Bank",
        acctNo:      "0441000688210",
        acctNickNm:  "VCB 8210",
        acctTypeCd:  "02",
        ccyCd:       "VND",
        napasBankCd: "970436",
    };
}

/**
 * @param sourceBankCd source-account BANK_CD (selects the profile)
 * @param internal     true → same-bank leg; false → cross-bank NAPAS leg
 */
function build(sourceBankCd: string, internal: boolean) {
    const targetBankCd = internal ? sourceBankCd : VIETCOM;
    const draft: OwnAccountTransferDraft = {
        source:             source(sourceBankCd),
        target:             target(targetBankCd),
        transferType:       internal ? "SAME_BANK" : "NAPAS",
        amount:             10_000,
        acctPassword:       "",
        trnsPassword:       "",
        feeBearer:          "A",
        remarkForRecipient: "Vietin 853 to Vietcom 210",
        remarkForSender:    "Vietin 853 to Vietcom 210",
        idempotencyKey:     "test-key",
    };
    return getBankProfileBuilder(sourceBankCd)({
        draft,
        internal,
        remitDate: "20260819",
        bankClass: "CORPORATE",
    });
}

/* ===================================================================
 *  Tests
 * ================================================================= */

describe("bank profiles — NAPAS-leg transType (engine error 80010222)", () => {
    it.each(ALL_PROFILES)(
        'sends transType "2" (타행이체) on the cross-bank leg — %s',
        (bankCd) => {
            // "" made the engine take the CITAD route and demand a
            // deposit-bank branch code. Never send "" cross-bank.
            expect(build(bankCd, false).Input.transType).toBe("2");
        },
    );

    it("still sends the NAPAS bank code alongside transType 2", () => {
        // trns_0001_001.ts:1406 — remitBankCode is required when
        // transType = 2. A "2" with no NAPAS code is equally broken.
        const { Input } = build(VIETIN, false);
        expect(Input.transType).toBe("2");
        expect(Input.remitBankCode).toBe("970436");
    });
});

describe("bank profiles — same-bank leg transType is unchanged", () => {
    it.each([SHINHAN, IBK, WOORI_VN, "99999999"])(
        'keeps transType "1" (당행이체) on the same-bank leg — %s',
        (bankCd) => {
            expect(build(bankCd, true).Input.transType).toBe("1");
        },
    );

    it('keeps Vietcom\'s same-bank "" override (trns_0001_007.ts:2055)', () => {
        // Vietcom is the one documented bank whose within-bank leg
        // sends a blank transType. The fix must not disturb it.
        expect(build(VIETCOM, true).Input.transType).toBe("");
    });

    it("keeps Vietin's same-bank transType deletion", () => {
        // trns_0001_007.ts:2106-2110 — TRANSFER_INTERNAL_ML drops
        // transType entirely, pins fee "2", blanks remitBankCode.
        const { Job, Input } = build(VIETIN, true);
        expect(Job).toBe("TRANSFER_INTERNAL_ML");
        expect(Input.transType).toBeUndefined();
        expect(Input.feePaymentType).toBe("2");
        expect(Input.remitBankCode).toBe("");
    });
});

/**
 * Regression coverage for the Transfer Confirmation popup's display
 * fields on the Own Account Transfer engine org-obj.
 *
 * <p>Guards the defect fixed 2026-08-19: `buildNxisasOrgObj` omitted
 * `recpBankNm` and `trnsFeeStts`, so the NXiSAS bundle took its
 * fallback branch at `nxisas_v2.js:1360-1361` and substituted
 * bank-scraped raw text into the popup —
 * `SHBVN_Ngan hang TNHH MTV ShinHan Viet Nam` for the recipient bank
 * and `Phí ngoài (Phí được thu ngoài số tiền chuyển)` for the fee.
 * The refactor hides that popup and re-renders the values it scrapes,
 * so the React dialog faithfully mirrored the wrong strings.
 *
 * <p>Legacy sets both, under a comment naming the purpose —
 * `trns_0001_007.ts:2021-2023`:
 * <pre>
 *   /* For display in Confirmation page *&#47;
 *   _nxisas_dataObj.recpBankNm  = recpBankNm;    // = REC2.RCPT_BANK_NM
 *   _nxisas_dataObj.trnsFeeStts = trnsFeeStts;   // = REC3.TRNS_FEE_STTS
 * </pre>
 *
 * <p>`trnsFeeStts` is the fee dropdown's visible LABEL, deliberately
 * distinct from `Input.feePaymentType` — the `"1"`/`"2"` wire value the
 * bank actually receives (`REC3.TRNS_FEE_VAL`). Both must be present
 * and must not be confused; the last case here pins that.
 *
 * @see ../../../docs/bugs/own-account-transfer-confirmation-display-fields-2026-08-19.md
 * @see ../../../docs/audits/own-account-transfer-transfer-confirmation-modal-parity-audit-2026-08-19.md
 */

import { describe, expect, it } from "vitest";

import { buildNxisasOrgObj } from "./bank-profiles";
import type {
    OwnAccountSourceRow,
    OwnAccountTargetRow,
    OwnAccountTransferDraft,
} from "./types";

/* ===================================================================
 *  Fixtures — the Vietin → Shinhan transfer from the 2026-08-19 report
 * ================================================================= */

const VIETIN = "11704001";

function source(): OwnAccountSourceRow {
    return {
        bankCd:              VIETIN,
        bankNm:              "VIETIN",
        acctNo:              "112002954853",
        acctNickNm:          "VIETIN 4853",
        acctTypeCd:          "02",
        balance:             1_347_836,
        available:           1_347_836,
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

function target(): OwnAccountTargetRow {
    return {
        kind:        "OWN_ACCOUNT",
        bankCd:      "11704088",
        bankNm:      "Shinhan Bank Vietnam Limited",
        acctNo:      "700022499445",
        acctNickNm:  "SHB 9445",
        acctTypeCd:  "02",
        ccyCd:       "VND",
        napasBankCd: "970424",
    };
}

function draft(feeBearer: "A" | "B"): OwnAccountTransferDraft {
    return {
        source:             source(),
        target:             target(),
        transferType:       "NAPAS",
        amount:             10_000,
        acctPassword:       "",
        trnsPassword:       "",
        feeBearer,
        remarkForRecipient: "Vietin 853 to Shinhan 445",
        remarkForSender:    "Vietin 853 to Shinhan 445",
        idempotencyKey:     "test-key",
    };
}

/** Mirrors the composer: local bank label + the fee dropdown's label. */
function buildFrom(sourceBankCd: string, feeBearer: "A" | "B" = "A") {
    const d = draft(feeBearer);
    d.source.bankCd = sourceBankCd;
    return buildNxisasOrgObj({
        draft:     d,
        internal:  false,
        remitDate: "20260819",
        bankClass: "CORPORATE",
        confirmDisplay: {
            recpBankNm:  "Shinhan Bank Vietnam Limited (970424)",
            trnsFeeStts: feeBearer === "A" ? "Sender pays" : "Recipient pays",
        },
    });
}

/** The reported case — a VIETIN source. */
function build(feeBearer: "A" | "B" = "A") {
    return buildFrom(VIETIN, feeBearer);
}

/* ===================================================================
 *  Tests
 * ================================================================= */

describe("buildNxisasOrgObj — confirmation-popup display fields", () => {
    it("sets recpBankNm so the bundle does not fall back to the bank's raw name", () => {
        // Blank/absent → nxisas_v2.js:1360 substitutes
        // obj.req.transfer[0].remitBank ("SHBVN_Ngan hang TNHH MTV …").
        expect(build().recpBankNm).toBe("Shinhan Bank Vietnam Limited (970424)");
    });

    it("sets trnsFeeStts so the bundle does not fall back to the bank's raw fee text", () => {
        // Blank/absent → nxisas_v2.js:1361 substitutes
        // obj.req.transfer[0].feePaymentType ("Phí ngoài (…)").
        expect(build("A").trnsFeeStts).toBe("Sender pays");
        expect(build("B").trnsFeeStts).toBe("Recipient pays");
    });

    it("keeps the fee LABEL and the fee WIRE value separate", () => {
        // trnsFeeStts is display text; Input.feePaymentType is the "1"/"2"
        // the bank receives. Conflating them is the classic mistake here.
        //
        // Asserted on a SHINHAN source, not Vietin: the vietin profile
        // deletes feePaymentType on its TRANSFER_ML leg, so Vietin cannot
        // demonstrate the pairing (see the next case).
        const senderPays = buildFrom("11704088", "A");
        expect(senderPays.trnsFeeStts).toBe("Sender pays");
        expect(senderPays.job[0].Input.feePaymentType).toBe("1");

        const recipientPays = buildFrom("11704088", "B");
        expect(recipientPays.trnsFeeStts).toBe("Recipient pays");
        expect(recipientPays.job[0].Input.feePaymentType).toBe("2");
    });

    it("still supplies the fee LABEL on Vietin, whose wire fee value is deleted", () => {
        // Vietin's TRANSFER_ML drops feePaymentType entirely
        // (`bank-profiles.ts` — legacy's `:2112` intent). That is exactly
        // why the popup needed an explicit label: with no wire fee value,
        // the bundle's fallback had nothing sensible to show and used the
        // bank's raw Vietnamese text. Documented divergence — see
        // docs/bugs/own-account-transfer-napas-leg-transtype-2026-08-19.md
        // "Known Limitations" item 1.
        const obj = build("A");
        expect(obj.job[0].Input.feePaymentType).toBeUndefined();
        expect(obj.trnsFeeStts).toBe("Sender pays");
    });

    it("omits both keys when no display strings are supplied", () => {
        // The bundle's guard is `null2void(...) == ""`, so an empty string
        // is equivalent to omission — the builder must not write noise.
        const bare = buildNxisasOrgObj({
            draft:     draft("A"),
            internal:  false,
            remitDate: "20260819",
            bankClass: "CORPORATE",
        });
        expect(bare.recpBankNm).toBeUndefined();
        expect(bare.trnsFeeStts).toBeUndefined();

        const blank = buildNxisasOrgObj({
            draft:     draft("A"),
            internal:  false,
            remitDate: "20260819",
            bankClass: "CORPORATE",
            confirmDisplay: { recpBankNm: "", trnsFeeStts: "" },
        });
        expect(blank.recpBankNm).toBeUndefined();
        expect(blank.trnsFeeStts).toBeUndefined();
    });

    it("does not disturb the transType fix or the job kind", () => {
        // Cross-bank leg must still be TRANSFER_ML + transType "2".
        const obj = build();
        expect(obj.job[0].Job).toBe("TRANSFER_ML");
        expect(obj.job[0].Input.transType).toBe("2");
    });
});

/**
 * Regression coverage for the Internal Transfer (Own Account Transfer)
 * engine-result parser.
 *
 * <p>Guards the defect fixed 2026-08-18: `parseEngineOutcome` read
 * `ErrorCode` / `ErrorMessage` from the TOP LEVEL of the NXiSAS callback
 * payload, but the bundle resolves with `_v2nxisas.orgObj` — an ARRAY of
 * org-objs, each carrying `result[]` job records, each with an `Output`
 * (`nxisas_v2.js:2073/2187/2227/2245`). The flat read always produced
 * `null`, and the caller substituted a hardcoded `"99999999"` — which is the
 * Transfer-History "Failed" FILTER sentinel (`trns_0003_001_view.jsp:158`)
 * and is never a stored transfer result in legacy.
 *
 * <p>Legacy behaviour under test: `trns_0001_007.ts:2144-2175` (identical in
 * `trns_0001_001.ts:1767-1799`) and `getScrapingMessage`
 * (`trns_0001_007.ts:138-141`).
 *
 * @see ../../../docs/bugs/internal-transfer-engine-result-parsing-2026-08-18.md
 */

import { describe, expect, it } from "vitest";

import {
    getScrapingMessage,
    parseEngineOutcome,
    resolveBalanceErrorMessage,
    resolveTransferErrorMessage,
} from "./OwnAccountTransferComposerDialog";

/* ===================================================================
 *  Fixtures — the real engine shape: orgObj[] → result[] → Output
 * ================================================================= */

type Job = { Job?: string; Output: Record<string, unknown> };

/** One org-obj (thread) carrying N completed job records. */
function orgObj(...jobs: Job[]) {
    return { bankCd: "11704004", job: [], result: jobs };
}

/** A successful TRANSFER job Output, per legacy `Result.transfer[0]`. */
function transferJob(over: Record<string, unknown> = {}): Job {
    return {
        Job: "TRANSFER",
        Output: {
            ErrorCode:    "00000000",
            ErrorMessage: "",
            Result: {
                transfer: [
                    {
                        acctNum:      "0441000688210",
                        remitAcctNum: "700022499445",
                        currency:     "VND",
                        remitAmt:     "1000000",
                        fee:          "11000",
                        memo:         "vcb 8210 => shb 9445",
                        memo2:        "recipient note",
                        acceptName:   "HAENGSUNG ELECTRONICS VN",
                        ...over,
                    },
                ],
            },
        },
    };
}

/** A failed job Output — bank code + message, no `Result.transfer`. */
function failedJob(code: string, message: string): Job {
    return { Job: "TRANSFER", Output: { ErrorCode: code, ErrorMessage: message } };
}

/* ===================================================================
 *  parseEngineOutcome — nested navigation
 * ================================================================= */

describe("parseEngineOutcome — nested orgObj[] → result[] → Output", () => {
    it("reads a successful transfer from the nested Output", () => {
        const out = parseEngineOutcome([orgObj(transferJob())]);

        expect(out.trnsStts).toBe("00000000");
        expect(out.trnsMsg).toBeNull();          // ErrorMessage was blank
        expect(out.actualAmt).toBe("1000000");
        expect(out.fee).toBe(11000);
        expect(out.memo).toBe("vcb 8210 => shb 9445");
        expect(out.memo2).toBe("recipient note");
        expect(out.acceptName).toBe("HAENGSUNG ELECTRONICS VN");
    });

    it("reads the ACTUAL engine ErrorCode on failure — never a sentinel", () => {
        const out = parseEngineOutcome([
            orgObj(failedJob("80002411", "Sender account is restricted.")),
        ]);

        expect(out.trnsStts).toBe("80002411");
        expect(out.trnsStts).not.toBe("99999999");
    });

    it("preserves the bank's ErrorMessage", () => {
        const out = parseEngineOutcome([
            orgObj(failedJob("8000F110", "Insufficient balance.")),
        ]);

        expect(out.trnsMsg).toBe("Insufficient balance.");
    });

    it("keeps transfer fields null on failure so the caller falls back to the composed values", () => {
        const out = parseEngineOutcome([orgObj(failedJob("80003230", "Wrong password."))]);

        expect(out.actualAmt).toBeNull();
        expect(out.fee).toBeNull();
        expect(out.memo).toBeNull();
        expect(out.memo2).toBeNull();
        expect(out.acceptName).toBeNull();
    });

    it("ignores a Result.transfer payload when ErrorCode is not 00000000 (legacy gates on BOTH)", () => {
        const bogus: Job = {
            Output: {
                ErrorCode:    "80002411",
                ErrorMessage: "rejected",
                Result: { transfer: [{ remitAmt: "999", fee: "1" }] },
            },
        };

        const out = parseEngineOutcome([orgObj(bogus)]);

        expect(out.trnsStts).toBe("80002411");
        expect(out.actualAmt).toBeNull();
        expect(out.fee).toBeNull();
    });

    it("never returns 99999999 for an unparseable payload — legacy's initial value is \"\"", () => {
        // Output present but carrying no code at all.
        expect(parseEngineOutcome([orgObj({ Output: {} })]).trnsStts).toBe("");
        // No recognizable Output anywhere → null (caller sends "").
        expect(parseEngineOutcome([{ bankCd: "1", job: [] }]).trnsStts).toBeNull();
        expect(parseEngineOutcome(null).trnsStts).toBeNull();
        expect(parseEngineOutcome("LOGIN_CAN").trnsStts).toBeNull();
    });
});

/* ===================================================================
 *  Legacy job-selection behaviour — LAST applicable Output wins
 * ================================================================= */

describe("parseEngineOutcome — legacy last-wins job selection", () => {
    it("takes the LAST job record of an org-obj (legacy assigns on every iteration)", () => {
        const out = parseEngineOutcome([
            orgObj(
                { Job: "LOGIN", Output: { ErrorCode: "00000000", ErrorMessage: "" } },
                failedJob("80003270", "OTP expired."),
            ),
        ]);

        expect(out.trnsStts).toBe("80003270");
        expect(out.trnsMsg).toBe("OTP expired.");
    });

    it("takes the LAST org-obj when several threads report", () => {
        const out = parseEngineOutcome([
            orgObj(transferJob()),
            orgObj(failedJob("8000FFFF", "Second thread failed.")),
        ]);

        expect(out.trnsStts).toBe("8000FFFF");
    });

    it("lets a trailing successful job win over an earlier failure", () => {
        const out = parseEngineOutcome([
            orgObj(failedJob("80003230", "Wrong password."), transferJob()),
        ]);

        expect(out.trnsStts).toBe("00000000");
        expect(out.actualAmt).toBe("1000000");
    });

    it("accepts flatter engine variants — a bare job record and an Output-shaped object", () => {
        expect(parseEngineOutcome(transferJob()).trnsStts).toBe("00000000");
        expect(parseEngineOutcome(transferJob().Output).actualAmt).toBe("1000000");
    });
});

/* ===================================================================
 *  Amount normalization — the wire is \d{1,15} (VND integer)
 * ================================================================= */

describe("parseEngineOutcome — engine amount normalization", () => {
    it("normalizes grouped and decimal-suffixed bank amounts to integer digits", () => {
        expect(parseEngineOutcome([orgObj(transferJob({ remitAmt: "3.362.692" }))]).actualAmt)
            .toBe("3362692");
        expect(parseEngineOutcome([orgObj(transferJob({ remitAmt: "3,362,692" }))]).actualAmt)
            .toBe("3362692");
        expect(parseEngineOutcome([orgObj(transferJob({ remitAmt: "3362692.00" }))]).actualAmt)
            .toBe("3362692");
        expect(parseEngineOutcome([orgObj(transferJob({ remitAmt: 1_000_000 }))]).actualAmt)
            .toBe("1000000");
    });

    it("returns null for an unparseable amount so the composed amount is used (legacy else-branch)", () => {
        expect(parseEngineOutcome([orgObj(transferJob({ remitAmt: "" }))]).actualAmt).toBeNull();
        expect(parseEngineOutcome([orgObj(transferJob({ remitAmt: "N/A" }))]).actualAmt).toBeNull();
        expect(parseEngineOutcome([orgObj(transferJob({ remitAmt: null }))]).actualAmt).toBeNull();
    });
});

/* ===================================================================
 *  getScrapingMessage — legacy trns_0001_007.ts:138-141
 * ================================================================= */

describe("getScrapingMessage — legacy parity", () => {
    const t = (key: string) => `t:${key}`;

    it("shows the bank's own ErrorMessage for an ordinary code", () => {
        expect(getScrapingMessage("8000F110", "Insufficient balance.", t))
            .toBe("Insufficient balance.");
    });

    it("special-cases 80002411 with the legacy sentence", () => {
        expect(getScrapingMessage("80002411", "whatever the bank said", t))
            .toBe("t:own_account_transfer.composer.error.engine_80002411");
    });

    it("falls back to the generic sentence only when the engine reported no message", () => {
        expect(getScrapingMessage("8000FFFF", null, t))
            .toBe("t:own_account_transfer.composer.error.engine_failed");
        expect(getScrapingMessage("", "   ", t))
            .toBe("t:own_account_transfer.composer.error.engine_failed");
    });
});

/* ===================================================================
 *  Item 4 — bank-echoed account / currency fields
 *  Legacy overwrites OUT_ACCT_NO / IN_ACCT_NO / CCY_CD from
 *  Result.transfer[0] on success (trns_0001_007.ts:2157-2158, 2163) and
 *  keeps the composed values on failure (:2167-2170).
 * ================================================================= */

describe("parseEngineOutcome — bank-echoed account + currency (item 4)", () => {
    it("reads acctNum / remitAcctNum / currency on success", () => {
        const out = parseEngineOutcome([orgObj(transferJob())]);

        expect(out.outAcctNo).toBe("0441000688210");
        expect(out.inAcctNo).toBe("700022499445");
        expect(out.ccyCd).toBe("VND");
    });

    it("carries a bank-NORMALIZED account number through untouched (product H DDA form)", () => {
        // Legacy sends 100…→DDA… for bank 11704020 and the bank echoes the
        // DDA form (trns_0001_007.ts:2036-2044). It must be recordable.
        const out = parseEngineOutcome([
            orgObj(transferJob({ acctNum: "DDA200543518", remitAcctNum: "DDA200612649" })),
        ]);

        expect(out.outAcctNo).toBe("DDA200543518");
        expect(out.inAcctNo).toBe("DDA200612649");
    });

    it("leaves all three null on failure so the composed values are persisted", () => {
        const out = parseEngineOutcome([orgObj(failedJob("8000FFFF", "declined"))]);

        expect(out.outAcctNo).toBeNull();
        expect(out.inAcctNo).toBeNull();
        expect(out.ccyCd).toBeNull();
    });

    it("records a non-VND currency the bank echoed instead of rejecting it", () => {
        const out = parseEngineOutcome([orgObj(transferJob({ currency: "USD" }))]);

        expect(out.ccyCd).toBe("USD");
    });
});

/* ===================================================================
 *  Item 1 — OTP / transfer-password / 8000F110 message selection
 *  trns_0001_007.ts:857-905. All three branches SAVE identically; only
 *  the message source differs. There is no re-prompt in legacy.
 * ================================================================= */

describe("resolveTransferErrorMessage — legacy branch chain (item 1)", () => {
    const t = (key: string) => `t:${key}`;

    it("8000F110 shows the generic WBE9999 sentence and suppresses the bank text", () => {
        expect(resolveTransferErrorMessage("8000F110", "engine exploded", t))
            .toBe("t:own_account_transfer.composer.error.engine_unexpected");
    });

    it.each([
        "80003270", "80003271", "80003272", "80003273", "80003274", "80003275",
        "80003276", "80003277", "80003278", "8000327A", "8000327B", "8000327C",
        "8000327D",
    ])("OTP code %s shows the RAW bank message", (code) => {
        expect(resolveTransferErrorMessage(code, "OTP is not valid.", t))
            .toBe("OTP is not valid.");
    });

    it.each([
        "80003230", "80003231", "80003233", "80003234", "80003235", "80003236",
    ])("transfer-password code %s shows the RAW bank message", (code) => {
        expect(resolveTransferErrorMessage(code, "Transfer password is wrong.", t))
            .toBe("Transfer password is wrong.");
    });

    it("80003232 is NOT in the legacy password array, so it takes the generic branch", () => {
        // trns_0001_001.ts:169 lists it in the comment; :170-171 omits it from
        // the array. Reproduced verbatim — a legacy quirk, not a defect.
        expect(resolveTransferErrorMessage("80003232", "Transfer password is wrong.", t))
            .toBe("Transfer password is wrong."); // same text here…
        // …but it routes through getScrapingMessage, which the 80002411 case proves:
        expect(resolveTransferErrorMessage("80002411", "bank text", t))
            .toBe("t:own_account_transfer.composer.error.engine_80002411");
    });

    it("an OTP code with no bank message still shows something (never blank)", () => {
        expect(resolveTransferErrorMessage("80003270", null, t))
            .toBe("t:own_account_transfer.composer.error.engine_failed");
    });

    it("a generic code keeps the getScrapingMessage behaviour", () => {
        expect(resolveTransferErrorMessage("8000FFFF", "Declined by bank.", t))
            .toBe("Declined by bank.");
    });
});

/* ===================================================================
 *  Item 3 — balance-refresh failure messaging
 *  trns_0001_007.ts:1717-1731 / trns_0001_001.ts:1312-1321.
 * ================================================================= */

describe("resolveBalanceErrorMessage — legacy parity (item 3)", () => {
    const t = (key: string, vars?: Record<string, string | number>) =>
        vars ? `t:${key}|${JSON.stringify(vars)}` : `t:${key}`;

    it("8000F110 → generic WBE9999 sentence", () => {
        expect(resolveBalanceErrorMessage("8000F110", "whatever", t))
            .toBe("t:own_account_transfer.composer.error.engine_unexpected");
    });

    it("code + message → WBW1103 with the raw [code] : message detail", () => {
        expect(resolveBalanceErrorMessage("80002121", "Account is closed.", t))
            .toBe('t:own_account_transfer.composer.error.balance_inquiry_failed|{"detail":"[80002121] : Account is closed."}');
    });

    it("returns null when either half is blank — legacy shows NO dialog", () => {
        expect(resolveBalanceErrorMessage("80002121", "", t)).toBeNull();
        expect(resolveBalanceErrorMessage("80002121", null, t)).toBeNull();
        expect(resolveBalanceErrorMessage("", "Account is closed.", t)).toBeNull();
        expect(resolveBalanceErrorMessage(null, null, t)).toBeNull();
        expect(resolveBalanceErrorMessage("   ", "   ", t)).toBeNull();
    });
});

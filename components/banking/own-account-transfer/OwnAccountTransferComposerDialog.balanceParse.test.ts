import { describe, expect, it } from "vitest";

import { parseBalanceOutcome } from "./OwnAccountTransferComposerDialog";

/**
 * Regression net for the Update Balance read path.
 *
 * Two defects are pinned here, both fixed 2026-08-18:
 *
 * 1. `readNumber` used `Number(v.replace(/[^\d.-]/g, ""))`, so a dot-grouped
 *    amount — which is what the engine sends for VND — parsed as `NaN`, and an
 *    empty string parsed as `0`. The first hid a real balance; the second
 *    invented a zero one.
 * 2. The engine's `Output.Result` arrives SEED-CBC encrypted on every response,
 *    so if the decrypt leg fails the balance row is unreachable. The
 *    `stillEncrypted` case below pins that this reads as "absent" (`null`) and
 *    never as a number — the caller's `bal === null` guard is what produces the
 *    correct "Balance is required." refusal instead of persisting garbage.
 */
describe("parseBalanceOutcome — engine amount formats", () => {
    const envelope = (balanceRow: Record<string, unknown>) => [
        {
            bankCd: "11704088",
            result: [
                {
                    Job: "BALANCE",
                    Output: {
                        ErrorCode: "00000000",
                        ErrorMessage: "",
                        Result: { balance: [balanceRow] },
                    },
                },
            ],
        },
    ];

    it("parses id-ID dot-grouped amounts (the VND wire format)", () => {
        const out = parseBalanceOutcome(
            envelope({ balance: "3.362.692", availableBal: "3.362.692" }),
        );

        expect(out.status).toBe("00000000");
        expect(out.bal).toBe(3362692);
        expect(out.realAmt).toBe(3362692);
    });

    it("parses comma-grouped amounts", () => {
        const out = parseBalanceOutcome(
            envelope({ balance: "3,553,015", availableBal: "1,200,000" }),
        );

        expect(out.bal).toBe(3553015);
        expect(out.realAmt).toBe(1200000);
    });

    it("drops an all-zero fractional tail rather than truncating the value", () => {
        const out = parseBalanceOutcome(
            envelope({ balance: "3362692.00", availableBal: "3362692,00" }),
        );

        expect(out.bal).toBe(3362692);
        expect(out.realAmt).toBe(3362692);
    });

    it("accepts a plain numeric value", () => {
        const out = parseBalanceOutcome(
            envelope({ balance: 3553015, availableBal: 0 }),
        );

        expect(out.bal).toBe(3553015);
        expect(out.realAmt).toBe(0);   // a real numeric zero IS a balance
    });

    it("treats a blank string as absent, not as zero", () => {
        const out = parseBalanceOutcome(
            envelope({ balance: "", availableBal: "   " }),
        );

        expect(out.bal).toBeNull();
        expect(out.realAmt).toBeNull();
    });

    it("falls through to the next key when the first is unusable", () => {
        const out = parseBalanceOutcome(
            envelope({ balance: "", bal: "1.500.000", availableBal: "-" }),
        );

        expect(out.bal).toBe(1500000);
        expect(out.realAmt).toBeNull();
    });

    it("reports the balance as absent when Output.Result is still ciphertext", () => {
        // What the screen actually received on SIT before the decrypt fix:
        // ErrorCode says success, but Result is an opaque base64 blob.
        const out = parseBalanceOutcome([
            {
                bankCd: "11704088",
                result: [
                    {
                        Job: "BALANCE",
                        Output: {
                            ErrorCode: "00000000",
                            ErrorMessage: "",
                            Result: "M0PZWMHTvOZ0hFHUcXAv1w9RRNhKfXbOEDkKmFhVEmk=",
                        },
                    },
                ],
            },
        ]);

        expect(out.status).toBe("00000000");
        expect(out.bal).toBeNull();
        expect(out.realAmt).toBeNull();
    });
});

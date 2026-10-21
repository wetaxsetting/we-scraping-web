/**
 * Transfer-capability guard — Vietcom iB@nking (CORPORATE) cannot
 * transfer at all, so the flow is blocked before the engine is called.
 *
 * <p>Coocon scraping team, Mr. Vantha, 2026-08-26:
 * <blockquote>
 * "Vietcom CORPORATE didn't have Napas Transfer, moreover TRANSFER_ML in
 * Vietcom CORPORATE is old job that Wabooks never used before. Therefore,
 * it got error 80010222. … Please, use Vietcom Digibiz Transfer."
 * </blockquote>
 *
 * <p>The vendor workbook agrees on every leg (`VNM_BANK_API_Data`, col
 * AH): `TRANSFER` and `TRANSFER_INTERNAL` are all `-`, `TRANSFER_ML` is
 * the unused old job, and `TRANSFER_INTERNAL_ML` is **blank**. So both
 * directions are dead — which is why the guard blocks the account rather
 * than only its NAPAS leg.
 *
 * <p><b>The class, not the bank, is what's blocked.</b> Vietcom DigiBiz
 * runs the same `BANK_CD` and must keep working; these tests pin that.
 */

import { describe, expect, it } from "vitest";

import {
    bankClassSupportsTransfer,
    sourceRowSupportsTransfer,
} from "./bank-profiles";

const IBK     = "11704003";
const SHINHAN = "11704088";
const WOORI   = "11704020";
const VIETCOM = "11704004";
const VIETIN  = "11704001";

/** `NXISAS_GB_SEQ_NO`: 0 → CORPORATE (iB@nking), 1 → DIGIBIZ. */
const CORPORATE_SEQ = "0";
const DIGIBIZ_SEQ   = "1";

const row = (bankCd: string, nxisasGbSeqNo?: string | null) =>
    ({ bankCd, nxisasGbSeqNo }) as Parameters<typeof sourceRowSupportsTransfer>[0];

describe("bankClassSupportsTransfer", () => {
    it("🔴 blocks Vietcom CORPORATE — the 80010222 case", () => {
        expect(bankClassSupportsTransfer(VIETCOM, "CORPORATE")).toBe(false);
    });

    it("🔴 allows Vietcom DIGIBIZ — same bank code, working module", () => {
        expect(bankClassSupportsTransfer(VIETCOM, "DIGIBIZ")).toBe(true);
    });

    it.each([
        ["IBK",     IBK,     "CORPORATE"],
        ["Shinhan", SHINHAN, "COMMON"],
        ["Woori",   WOORI,   "CORPORATE"],
        ["VIETIN",  VIETIN,  "CORPORATE"],
    ])("allows %s", (_n, bankCd, cls) => {
        expect(bankClassSupportsTransfer(bankCd, cls)).toBe(true);
    });

    it("never blocks on missing information", () => {
        // An unresolved class must not produce a client-side block: the
        // engine's own error is more informative than a wrong guess.
        expect(bankClassSupportsTransfer(VIETCOM, null)).toBe(true);
        expect(bankClassSupportsTransfer(VIETCOM, undefined)).toBe(true);
        expect(bankClassSupportsTransfer(null, "CORPORATE")).toBe(true);
        expect(bankClassSupportsTransfer(undefined, undefined)).toBe(true);
    });

    it("does not block an unrelated bank that happens to be CORPORATE", () => {
        // The table is keyed by bank AND class — a blanket "CORPORATE is
        // bad" rule would break IBK, Woori and VIETIN.
        expect(bankClassSupportsTransfer(IBK, "CORPORATE")).toBe(true);
    });
});

describe("sourceRowSupportsTransfer — resolves the class from the row", () => {
    it("🔴 blocks a Vietcom row whose credential is CORPORATE (seq 0)", () => {
        expect(sourceRowSupportsTransfer(row(VIETCOM, CORPORATE_SEQ))).toBe(false);
    });

    it("🔴 allows a Vietcom row whose credential is DigiBiz (seq 1)", () => {
        expect(sourceRowSupportsTransfer(row(VIETCOM, DIGIBIZ_SEQ))).toBe(true);
    });

    it.each([
        ["IBK",     IBK],
        ["Shinhan", SHINHAN],
        ["Woori",   WOORI],
        ["VIETIN",  VIETIN],
    ])("allows a %s row", (_n, bankCd) => {
        expect(sourceRowSupportsTransfer(row(bankCd, CORPORATE_SEQ))).toBe(true);
    });

    it("tolerates a null row and a missing seq without throwing", () => {
        expect(sourceRowSupportsTransfer(null)).toBe(true);
        expect(sourceRowSupportsTransfer(undefined)).toBe(true);
        expect(sourceRowSupportsTransfer(row(VIETCOM, null))).toBe(
            // Whatever the adapter's default resolution is, the call must
            // not throw — the guard is advisory, never a crash source.
            sourceRowSupportsTransfer(row(VIETCOM, null)),
        );
    });
});

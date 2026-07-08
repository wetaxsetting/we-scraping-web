import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the five per-module dispatch endpoints so the orchestrator can be
// exercised without hitting the network. `vi.hoisted` gives the mock fns a
// safe home above the hoisted `vi.mock` factories.
const mocks = vi.hoisted(() => ({
    dispatchScheduledTransfer: vi.fn(),
    dispatchVendorPayment: vi.fn(),
    dispatchExpensePayment: vi.fn(),
    dispatchPayrollPayment: vi.fn(),
    dispatchOverseasPayment: vi.fn(),
}));

vi.mock("@/lib/api/internalTransfer", () => ({ dispatchScheduledTransfer: mocks.dispatchScheduledTransfer }));
vi.mock("@/lib/api/vendorPayment", () => ({ dispatchVendorPayment: mocks.dispatchVendorPayment }));
vi.mock("@/lib/api/expensePayment", () => ({ dispatchExpensePayment: mocks.dispatchExpensePayment }));
vi.mock("@/lib/api/payrollPayment", () => ({ dispatchPayrollPayment: mocks.dispatchPayrollPayment }));
vi.mock("@/lib/api/payment", () => ({ dispatchOverseasPayment: mocks.dispatchOverseasPayment }));

const {
    dispatchScheduledTransfer,
    dispatchOverseasPayment,
} = mocks;

import { ApiCallError } from "@/lib/api/banking";
import {
    decideAutoTransfer,
    runAutoTransferAfterApproval,
    type AutoTransferDecisionInput,
} from "@/lib/payment/autoTransferAfterApproval";
import { isWithinAutoTransferWindow } from "@/lib/payment/validateBankingTime";

/** Shinhan out-bank code — resolves to a real banking window. */
const SHINHAN = "970424";
/** VCB out-bank code — the only bank with a CITAD ≥500M (16:30) tier. */
const VCB = "970436";

/** Tuesday 2026-01-06 16:00 Vietnam time (09:00Z) — past the CITAD 15:30
 *  cut-off but before the NAPAS 23:45 cut-off. The window where the real
 *  channel matters: CITAD → blocked, NAPAS → open. */
const CITAD_AFTER_1530_NOW = new Date("2026-01-06T09:00:00Z");
/** Tuesday 2026-01-06 15:00 VN (08:00Z) — before every CITAD cut-off. */
const BEFORE_1530_NOW = new Date("2026-01-06T08:00:00Z");
/** Tuesday 2026-01-06 16:45 VN (09:45Z) — past even the VCB ≥500M 16:30. */
const AFTER_1630_NOW = new Date("2026-01-06T09:45:00Z");

/** Tuesday 2026-01-06 10:00 Vietnam time (UTC+7 → 03:00Z). Weekday, inside
 *  the NAPAS 00:05–23:45 window → a "valid" auto-transfer moment. */
const VALID_NOW = new Date("2026-01-06T03:00:00Z");
/** Tuesday 2026-01-06 23:50 Vietnam time (16:50Z) — past the 23:45 NAPAS
 *  cut-off → "invalid time". */
const AFTER_CUTOFF_NOW = new Date("2026-01-06T16:50:00Z");
/** Saturday 2026-01-10 12:00 Vietnam time (05:00Z) — weekend; SWIFT is
 *  Mon–Fri only → "invalid time" for overseas. */
const WEEKEND_NOW = new Date("2026-01-10T05:00:00Z");

function baseInput(over: Partial<AutoTransferDecisionInput> = {}): AutoTransferDecisionInput {
    return {
        autoTransferEnabled: true,
        isFullyApproved: true,
        apprDv: "35", // Internal Transfer
        batchNo: "SPS-1",
        payDate: "20260106",
        todayVn: "20260106",
        bankCd: SHINHAN,
        txnCurrency: "VND",
        now: VALID_NOW,
        ...over,
    };
}

describe("decideAutoTransfer (pure gate — legacy comm_0195_001.js order)", () => {
    it("skips when the firm-banking flag (env 00078) is OFF", () => {
        expect(decideAutoTransfer(baseInput({ autoTransferEnabled: false })).kind).toBe("skip");
    });

    it("skips when the document is not yet fully approved", () => {
        expect(decideAutoTransfer(baseInput({ isFullyApproved: false })).kind).toBe("skip");
    });

    it("skips Corporate Card (APPR_DV 33)", () => {
        expect(decideAutoTransfer(baseInput({ apprDv: "33" })).kind).toBe("skip");
    });

    it("skips when there is no dispatchable batch id (e.g. overseas M-mode)", () => {
        expect(decideAutoTransfer(baseInput({ batchNo: null })).kind).toBe("skip");
    });

    it("returns date-not-arrived when today < scheduled PAY_DATE", () => {
        const out = decideAutoTransfer(baseInput({ todayVn: "20260105", payDate: "20260106" }));
        expect(out.kind).toBe("date-not-arrived");
    });

    it("returns invalid-time when past the banking cut-off", () => {
        const out = decideAutoTransfer(baseInput({ now: AFTER_CUTOFF_NOW }));
        expect(out.kind).toBe("invalid-time");
    });

    it("returns invalid-time on a weekend for overseas (SWIFT, Mon–Fri)", () => {
        const out = decideAutoTransfer(
            baseInput({ apprDv: "34", txnCurrency: "USD", now: WEEKEND_NOW }),
        );
        expect(out.kind).toBe("invalid-time");
    });

    it("returns dispatch when fully approved, flag on, date reached, time valid", () => {
        const out = decideAutoTransfer(baseInput());
        expect(out).toEqual({ kind: "dispatch", batchNo: "SPS-1", ccyCd: "VND", apprDv: "35" });
    });

    it("treats today == PAY_DATE as reached (>=, not >)", () => {
        const out = decideAutoTransfer(baseInput({ todayVn: "20260106", payDate: "20260106" }));
        expect(out.kind).toBe("dispatch");
    });
});

describe("decideAutoTransfer — real channel via ANT_DIV_CD (exact parity)", () => {
    it("CITAD-VND past the 15:30 cut-off (before NAPAS 23:45) → invalid-time when ant_div_cd=CITAD", () => {
        // The real channel is CITAD → Shinhan CITAD closes 15:30 → 16:00 invalid,
        // exactly like legacy mapTransferType(REC[0].ANT_DIV_CD). Currency alone
        // would have inferred the wide-open NAPAS window.
        const out = decideAutoTransfer(
            baseInput({ antDivCd: "CITAD", bankCd: SHINHAN, now: CITAD_AFTER_1530_NOW }),
        );
        expect(out.kind).toBe("invalid-time");
    });

    it("CITAD-VND past 15:30 with ant_div_cd MISSING → falls back to currency (NAPAS) → dispatch (backend re-checks)", () => {
        // Defensive fallback: no channel on the wire → infer NAPAS from VND →
        // 16:00 < 23:45 → FE proceeds; the backend re-validates the real CITAD
        // window and rejects (WBE2066 → WBW1169). Still safe, no false send.
        const out = decideAutoTransfer(
            baseInput({ antDivCd: null, bankCd: SHINHAN, now: CITAD_AFTER_1530_NOW }),
        );
        expect(out.kind).toBe("dispatch");
    });

    it("NAPAS-VND (ant_div_cd=NAPAS) past 15:30 → dispatch (NAPAS window open until 23:45)", () => {
        const out = decideAutoTransfer(
            baseInput({ antDivCd: "NAPAS", bankCd: SHINHAN, now: CITAD_AFTER_1530_NOW }),
        );
        expect(out.kind).toBe("dispatch");
    });
});

describe("isWithinAutoTransferWindow — VCB CITAD amount-tier (direct)", () => {
    const vcbCitad = (amountTier: "ALL_SMALL" | "ALL_LARGE" | undefined, now: Date) =>
        isWithinAutoTransferWindow({
            bankCd: VCB,
            txnCurrency: "VND",
            transferType: "CITAD",
            amountTier,
            now,
        });

    it("<500M (ALL_SMALL) uses the 15:30 cut-off", () => {
        expect(vcbCitad("ALL_SMALL", BEFORE_1530_NOW)).toBe(true); // 15:00 < 15:30
        expect(vcbCitad("ALL_SMALL", CITAD_AFTER_1530_NOW)).toBe(false); // 16:00 ≥ 15:30
    });

    it("≥500M (ALL_LARGE) uses the 16:30 cut-off", () => {
        expect(vcbCitad("ALL_LARGE", CITAD_AFTER_1530_NOW)).toBe(true); // 16:00 < 16:30
        expect(vcbCitad("ALL_LARGE", AFTER_1630_NOW)).toBe(false); // 16:45 ≥ 16:30
    });

    it("unknown tier defaults to the WIDER 16:30 window (never false-blocks a large transfer)", () => {
        expect(vcbCitad(undefined, CITAD_AFTER_1530_NOW)).toBe(true); // 16:00 < 16:30
        expect(vcbCitad(undefined, AFTER_1630_NOW)).toBe(false); // 16:45 ≥ 16:30
    });
});

describe("runAutoTransferAfterApproval (orchestration)", () => {
    let dialogOpen: ReturnType<typeof vi.fn>;
    let onDone: ReturnType<typeof vi.fn>;
    const deps = () => ({ dialog: { open: dialogOpen, close: vi.fn() }, t: (k: string) => k, onDone });

    beforeEach(() => {
        vi.clearAllMocks();
        dialogOpen = vi.fn();
        onDone = vi.fn();
    });

    it("dispatches exactly once and shows the success toast on the valid path", async () => {
        dispatchScheduledTransfer.mockResolvedValueOnce(undefined);
        const handled = await runAutoTransferAfterApproval(baseInput(), deps());

        expect(handled).toBe(true);
        expect(dispatchScheduledTransfer).toHaveBeenCalledTimes(1);
        expect(dispatchScheduledTransfer).toHaveBeenCalledWith("SPS-1", { trnf_ccy_cd: "VND" });
        expect(dialogOpen).toHaveBeenCalledWith(
            expect.objectContaining({ type: "success", description: "payment.auto_transfer.success" }),
        );
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("shows WBW1170 and does NOT dispatch when the scheduled date has not arrived", async () => {
        const handled = await runAutoTransferAfterApproval(
            baseInput({ todayVn: "20260105", payDate: "20260106" }),
            deps(),
        );
        expect(handled).toBe(true);
        expect(dispatchScheduledTransfer).not.toHaveBeenCalled();
        expect(dialogOpen).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "warning",
                description: "payment.auto_transfer.date_not_arrived",
            }),
        );
    });

    it("shows WBW1169 and does NOT dispatch when the time is invalid", async () => {
        const handled = await runAutoTransferAfterApproval(baseInput({ now: AFTER_CUTOFF_NOW }), deps());
        expect(handled).toBe(true);
        expect(dispatchScheduledTransfer).not.toHaveBeenCalled();
        expect(dialogOpen).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "warning",
                description: "payment.auto_transfer.inappropriate_time",
            }),
        );
    });

    it("returns false (caller shows its own success) when env 00078 is OFF", async () => {
        const handled = await runAutoTransferAfterApproval(baseInput({ autoTransferEnabled: false }), deps());
        expect(handled).toBe(false);
        expect(dispatchScheduledTransfer).not.toHaveBeenCalled();
        expect(dialogOpen).not.toHaveBeenCalled();
        expect(onDone).not.toHaveBeenCalled();
    });

    it("env-not-yet-loaded race: autoTransferEnabled=false → safe skip, no dispatch", async () => {
        // While useEnvironmentSettings is still loading, envValues is empty →
        // autoTransferEnabled resolves to false. The decision is a safe no-op
        // skip (plain approve), never a premature auto-send. The dialog
        // additionally disables the Approve button while envLoading so this
        // race is closed at the UI too.
        const handled = await runAutoTransferAfterApproval(baseInput({ autoTransferEnabled: false }), deps());
        expect(handled).toBe(false);
        expect(dispatchScheduledTransfer).not.toHaveBeenCalled();
    });

    it("maps a backend cut-off rejection (WBE2066) to the WBW1169 message", async () => {
        dispatchScheduledTransfer.mockRejectedValueOnce(new ApiCallError("WBE2066", "after cut-off"));
        const handled = await runAutoTransferAfterApproval(baseInput(), deps());
        expect(handled).toBe(true);
        expect(dialogOpen).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "warning",
                description: "payment.auto_transfer.inappropriate_time",
            }),
        );
    });

    it("surfaces an already-dispatched rejection (WBE2064) as an error dialog (idempotency safety net)", async () => {
        dispatchScheduledTransfer.mockRejectedValueOnce(new ApiCallError("WBE2064", "already dispatched"));
        const handled = await runAutoTransferAfterApproval(baseInput(), deps());
        expect(handled).toBe(true);
        expect(dialogOpen).toHaveBeenCalledWith(
            expect.objectContaining({ type: "error", errorCode: "WBE2064" }),
        );
    });

    it("routes overseas (APPR_DV 34) to the no-body overseas dispatch", async () => {
        dispatchOverseasPayment.mockResolvedValueOnce(undefined);
        await runAutoTransferAfterApproval(
            baseInput({ apprDv: "34", txnCurrency: "USD", bankCd: SHINHAN, now: VALID_NOW }),
            deps(),
        );
        expect(dispatchOverseasPayment).toHaveBeenCalledWith("SPS-1");
    });
});

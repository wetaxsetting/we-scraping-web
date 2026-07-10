import { beforeEach, describe, expect, it, vi } from "vitest";

// The cut-off windows come from the backend config module. Mock it so the
// pre-flight check is deterministic without a network call, and so we can
// assert the "config unavailable → proceed" safe fallback.
const cutoffMock = vi.hoisted(() => {
    const WEEKDAYS = new Set([1, 2, 3, 4, 5]);
    const ALL_DAYS = new Set([0, 1, 2, 3, 4, 5, 6]);
    const schedules = {
        SHINHAN: {
            NAPAS: { start: "00:05", warning: "23:00", end: "23:45", days: ALL_DAYS },
            CITAD: { start: "09:00", warning: "15:00", end: "15:30", days: WEEKDAYS },
            SWIFT: { start: "09:00", warning: "18:30", end: "22:00", days: WEEKDAYS },
        },
        WOORI: {
            NAPAS: { start: "00:15", warning: "23:00", end: "23:55", days: ALL_DAYS },
            CITAD: { start: "08:30", warning: "17:10", end: "17:40", days: WEEKDAYS },
            SWIFT: { start: "08:30", warning: "18:30", end: "19:10", days: WEEKDAYS },
        },
        VCB: {
            NAPAS: { start: "00:05", warning: "23:00", end: "23:45", days: ALL_DAYS },
            CITAD: { start: "08:00", warning: "15:00", end: "15:30", days: WEEKDAYS, largeEnd: "16:30" },
        },
    };
    // Mutable holder so a test can set the "server now" the check must use
    // (proves the decision is driven by server time, not the machine clock).
    const serverNowRef = { value: null as Date | null };
    return {
        schedules,
        serverNowRef,
        loadCutoffSchedules: vi.fn(async () => schedules as unknown),
        getServerNow: vi.fn(() => serverNowRef.value),
    };
});

vi.mock("@/lib/payment/cutoffConfig", () => ({
    WEEKDAYS: new Set([1, 2, 3, 4, 5]),
    ALL_DAYS: new Set([0, 1, 2, 3, 4, 5, 6]),
    loadCutoffSchedules: cutoffMock.loadCutoffSchedules,
    getCachedCutoffSchedules: vi.fn(() => cutoffMock.schedules),
    getServerNow: cutoffMock.getServerNow,
    loadCutoffConfig: vi.fn(async () => ({ schedules: cutoffMock.schedules, largeTxnThreshold: 500000000 })),
    getCachedCutoffConfig: vi.fn(() => ({ schedules: cutoffMock.schedules, largeTxnThreshold: 500000000 })),
    __resetCutoffConfigForTests: vi.fn(),
}));

import { validateBankingTime } from "@/lib/payment/validateBankingTime";

const SHINHAN = "970424";
const VCB = "970436";

/** Saturday 2026-01-10 10:00 VN (03:00Z) — weekend; Shinhan CITAD would
 *  hard-block. Used to prove the VCB internal-transfer bypass short-circuits
 *  before any window/weekend evaluation. */
const WEEKEND_NOW = new Date("2026-01-10T03:00:00Z");
/** Tuesday 2026-01-06 10:00 VN (03:00Z) — inside every window. */
const VALID_NOW = new Date("2026-01-06T03:00:00Z");

function deps() {
    // Auto-dismiss the dialog (invoke onClose) so the showBlock/showConfirm
    // promise resolves — a hard block / cancelled confirm both resolve to false.
    const open = vi.fn((opts?: { onClose?: () => void }) => { opts?.onClose?.(); });
    return { open, dialog: { open, close: vi.fn() }, t: (k: string) => k };
}

describe("validateBankingTime — VCB Internal Transfer 24/7 bypass", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns true and shows NO dialog for a VCB internal transfer, even on a weekend", async () => {
        const d = deps();
        const ok = await validateBankingTime({
            bankCd: VCB,
            txnCurrency: "VND",
            internalTransfer: true,
            dialog: d.dialog,
            t: d.t,
            now: WEEKEND_NOW,
        });
        expect(ok).toBe(true);
        expect(d.open).not.toHaveBeenCalled();
        // Bypass short-circuits before the config is even consulted.
        expect(cutoffMock.loadCutoffSchedules).not.toHaveBeenCalled();
    });

    it("does NOT bypass for a non-VCB internal transfer (Shinhan still uses config)", async () => {
        const d = deps();
        const ok = await validateBankingTime({
            bankCd: SHINHAN,
            txnCurrency: "VND",
            internalTransfer: true,
            dialog: d.dialog,
            t: d.t,
            now: VALID_NOW,
        });
        expect(ok).toBe(true);
        // Shinhan is not exempt → the config path runs.
        expect(cutoffMock.loadCutoffSchedules).toHaveBeenCalled();
    });

    it("does NOT bypass VCB when internalTransfer is not set (e.g. Vendor/Expense/Payroll)", async () => {
        const d = deps();
        await validateBankingTime({
            bankCd: VCB,
            txnCurrency: "VND",
            dialog: d.dialog,
            t: d.t,
            now: VALID_NOW,
        });
        // No bypass → the config-driven window path runs.
        expect(cutoffMock.loadCutoffSchedules).toHaveBeenCalled();
    });
});

describe("validateBankingTime — safe fallback when config is unavailable", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns true (proceed) when the config fetch yields null — backend is authoritative", async () => {
        cutoffMock.loadCutoffSchedules.mockResolvedValueOnce(null as unknown);
        const d = deps();
        const ok = await validateBankingTime({
            bankCd: SHINHAN,
            txnCurrency: "VND",
            dialog: d.dialog,
            t: d.t,
            now: VALID_NOW,
        });
        expect(ok).toBe(true);
        expect(d.open).not.toHaveBeenCalled();
    });
});

describe("validateBankingTime — uses Vietnam server time (not the browser clock)", () => {
    const WOORI = "970457";
    beforeEach(() => {
        vi.clearAllMocks();
        cutoffMock.serverNowRef.value = null;
    });

    it("weekend block is decided by the SERVER instant, not the machine clock (req 4)", async () => {
        // Server says Saturday 12:00 VN (05:00Z). No `now` is passed, so the
        // check must read getServerNow(). An FCY transfer resolves to the SWIFT
        // window (weekday-only) → weekend hard block — regardless of the test
        // machine's real date/timezone.
        cutoffMock.serverNowRef.value = new Date("2026-01-10T05:00:00Z"); // Sat 12:00 VN
        const d = deps();
        const ok = await validateBankingTime({ bankCd: SHINHAN, txnCurrency: "USD", dialog: d.dialog, t: d.t });
        expect(ok).toBe(false);
        expect(d.open).toHaveBeenCalledWith(
            expect.objectContaining({ description: "payment.transfer.cutoff.weekend" }),
        );
        expect(cutoffMock.getServerNow).toHaveBeenCalled();
    });

    it("past-cut-off block is decided by the SERVER instant (req 5)", async () => {
        // Server says weekday 20:00 VN (13:00Z). Woori FCY → SWIFT (08:30-19:10)
        // → past cut-off → Woori hard block (past_end). Driven by server time.
        cutoffMock.serverNowRef.value = new Date("2026-01-06T13:00:00Z"); // Tue 20:00 VN
        const d = deps();
        const ok = await validateBankingTime({ bankCd: WOORI, txnCurrency: "USD", dialog: d.dialog, t: d.t });
        expect(ok).toBe(false);
        expect(d.open).toHaveBeenCalledWith(
            expect.objectContaining({ description: "payment.transfer.cutoff.past_end" }),
        );
    });

    it("inside-window server instant proceeds with no dialog (req 5)", async () => {
        // Server says weekday 12:00 VN — inside the Woori SWIFT window, before warning.
        cutoffMock.serverNowRef.value = new Date("2026-01-06T05:00:00Z"); // Tue 12:00 VN
        const d = deps();
        const ok = await validateBankingTime({ bankCd: WOORI, txnCurrency: "USD", dialog: d.dialog, t: d.t });
        expect(ok).toBe(true);
        expect(d.open).not.toHaveBeenCalled();
    });

    it("VCB Internal Transfer stays 24/7 even when server time is a weekend (req 6)", async () => {
        cutoffMock.serverNowRef.value = new Date("2026-01-10T05:00:00Z"); // Sat 12:00 VN
        const d = deps();
        const ok = await validateBankingTime({
            bankCd: VCB, txnCurrency: "VND", internalTransfer: true, dialog: d.dialog, t: d.t,
        });
        expect(ok).toBe(true);
        expect(d.open).not.toHaveBeenCalled();
    });
});

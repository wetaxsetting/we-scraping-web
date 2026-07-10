import { describe, expect, it } from "vitest";

import {
    computeServerOffsetMs,
    getServerNow,
    __resetCutoffConfigForTests,
} from "@/lib/payment/cutoffConfig";

/**
 * The server-time offset math is what makes the cut-off decision independent of
 * (a) the browser timezone and (b) a mis-set OS clock. A JS `Date`/epoch is an
 * absolute instant, so two correctly-clocked machines in different timezones
 * report the SAME epoch for the same real moment → the same offset (~0) → the
 * same "server now". A skewed clock is corrected by the offset.
 */
describe("computeServerOffsetMs — timezone- and clock-independence", () => {
    // Server's authoritative Vietnam time and its absolute epoch.
    const SERVER_ISO = "2026-07-10T15:25:30+07:00"; // == 08:25:30Z
    const SERVER_EPOCH = Date.parse(SERVER_ISO);

    it("Cambodia user (UTC+7, correct clock) → offset 0 → same as Vietnam server time", () => {
        // A correctly-clocked Cambodia machine reports the same absolute epoch.
        expect(computeServerOffsetMs(SERVER_ISO, SERVER_EPOCH)).toBe(0);
    });

    it("Korea user (UTC+9, correct clock) → offset 0 → same as Vietnam server time", () => {
        // Timezone does not change the absolute epoch — same instant, same offset.
        expect(computeServerOffsetMs(SERVER_ISO, SERVER_EPOCH)).toBe(0);
    });

    it("corrects a client clock skewed +2h (wrong OS clock must not change the result)", () => {
        const skewedClientEpoch = SERVER_EPOCH + 2 * 3600 * 1000;
        const offset = computeServerOffsetMs(SERVER_ISO, skewedClientEpoch);
        expect(offset).toBe(-2 * 3600 * 1000);
        // getServerNow() = Date.now() + offset would recover the true server
        // instant: (skewed) + (-2h) == SERVER_EPOCH.
        expect(skewedClientEpoch + (offset as number)).toBe(SERVER_EPOCH);
    });

    it("corrects a client clock skewed -3h", () => {
        const skewedClientEpoch = SERVER_EPOCH - 3 * 3600 * 1000;
        const offset = computeServerOffsetMs(SERVER_ISO, skewedClientEpoch);
        expect(offset).toBe(3 * 3600 * 1000);
        expect(skewedClientEpoch + (offset as number)).toBe(SERVER_EPOCH);
    });

    it("returns null when server_datetime is absent or unparseable (→ FE falls back to browser clock)", () => {
        expect(computeServerOffsetMs(undefined, Date.now())).toBeNull();
        expect(computeServerOffsetMs(null, Date.now())).toBeNull();
        expect(computeServerOffsetMs("not-a-date", Date.now())).toBeNull();
        expect(computeServerOffsetMs("", Date.now())).toBeNull();
    });
});

describe("getServerNow", () => {
    it("returns null before any config has loaded (caller then uses the browser clock)", () => {
        __resetCutoffConfigForTests();
        expect(getServerNow()).toBeNull();
    });
});

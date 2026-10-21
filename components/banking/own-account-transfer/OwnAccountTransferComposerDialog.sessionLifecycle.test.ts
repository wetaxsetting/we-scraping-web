/**
 * Regression coverage for the engine SESSION-LIFECYCLE rule on Own Account
 * Transfer — the guard that keeps the fix from turning into a bank-lockout
 * hazard.
 *
 * <p>Context. Every job this screen runs carries `nonLogout:true`, so the
 * bank IB session stays authenticated after the scrape
 * (`nxisas_v2.js:1056-1080`). The 2026-08-19 fix reuses that session for the
 * next job (`nonLogin:true` + `callNxisasWithoutOpenProcess`) instead of
 * re-issuing `LOGIN`, which Vietcom rejects with `80002F31`.
 *
 * <p>The rule under test decides when that reuse is allowed. It must be
 * *pessimistic*: only a job that reported `00000000` proves the session is
 * still usable. Assuming aliveness after a failure would strand the retry
 * path (every press skipping LOGIN against a dead session), and the opposite
 * mistake — logging in blind while a session may still be open — is what
 * risks a wrong-page credential submit. Vietcom blocks the login after three
 * bad attempts and only the Vietnam PO team can reset it, so "release, then
 * log in cleanly" is the only acceptable failure behaviour.
 *
 * @see ../../../docs/bugs/own-account-transfer-engine-session-reuse-2026-08-19.md
 */

import { describe, expect, it } from "vitest";

import { shouldKeepEngineSession } from "./OwnAccountTransferComposerDialog";

const VIETCOM  = "11704004";
const SHINHAN  = "11704088";
const IBK      = "11704003";
const VIETIN   = "11704001";
const WOORI_VN = "11704020";

/** Engine codes seen on this screen that are NOT success. */
const NON_SUCCESS_CODES = [
    "80002F31", // "financial institution`s webpage was modified" — the defect's own code
    "8000F110", // engine/site unavailable
    "80003230", // transfer-password error
    "80003275", // OTP error
    "LOGIN_CAN", // user cancelled the 2nd-cert
    "99999999", // Transfer-History Failed filter sentinel — never a live session
    "",         // engine reported no code
];

/** The composer is open in every case except the closed-mid-scrape group. */
const OPEN = true;
const CLOSED = false;

describe("shouldKeepEngineSession — only a proven-alive session may be reused", () => {
    it("keeps the session after a successful job", () => {
        expect(shouldKeepEngineSession(VIETCOM, "00000000", OPEN)).toBe(true);
        expect(shouldKeepEngineSession(SHINHAN, "00000000", OPEN)).toBe(true);
        expect(shouldKeepEngineSession(IBK,     "00000000", OPEN)).toBe(true);
        expect(shouldKeepEngineSession(VIETIN,  "00000000", OPEN)).toBe(true);
    });

    it.each(NON_SUCCESS_CODES)("releases the session after code %s", (code) => {
        // THE SAFETY PROPERTY. A released session means the next attempt runs
        // a clean Open+LOGIN into a real login page — never a LOGIN skipped
        // against a dead session, and never a blind credential submit.
        expect(shouldKeepEngineSession(VIETCOM, code, OPEN)).toBe(false);
    });

    it("releases the session when the engine reported no status at all", () => {
        expect(shouldKeepEngineSession(VIETCOM, null, OPEN)).toBe(false);
        expect(shouldKeepEngineSession(VIETCOM, undefined, OPEN)).toBe(false);
    });

    it("never keeps a Woori VN session, even on success", () => {
        // Woori's BALANCE runs `nonLogout:false` (the engine appends LOGOUT,
        // legacy `trns_0001_007.ts:1612-1613`) and legacy resets its engine
        // after a transfer (`:2196-2200`) — so there is never a Woori session
        // to reuse, and `nonLogin:true` for Woori would run without a login.
        expect(shouldKeepEngineSession(WOORI_VN, "00000000", OPEN)).toBe(false);
        expect(shouldKeepEngineSession(WOORI_VN, "80002F31", OPEN)).toBe(false);
    });

    it("is not fooled by a success-looking status string", () => {
        // Exact match only — no trimming, no prefix matching, no truthiness.
        expect(shouldKeepEngineSession(VIETCOM, " 00000000", OPEN)).toBe(false);
        expect(shouldKeepEngineSession(VIETCOM, "00000000 ", OPEN)).toBe(false);
        expect(shouldKeepEngineSession(VIETCOM, "0", OPEN)).toBe(false);
        expect(shouldKeepEngineSession(VIETCOM, "000000000", OPEN)).toBe(false);
    });

    it("does NOT keep a session when the composer already closed", () => {
        // Cancel / X are not blocked during an Update Balance refresh, so a
        // successful scrape can resolve after the modal closed. Keeping it
        // then would leave a session nothing ever logs out — and a later
        // re-open would skip LOGIN on a session the bank may have expired.
        // The caller logs the bank out instead.
        expect(shouldKeepEngineSession(VIETCOM, "00000000", CLOSED)).toBe(false);
        expect(shouldKeepEngineSession(SHINHAN, "00000000", CLOSED)).toBe(false);
    });

    it("stays false on a closed composer for every non-success code too", () => {
        for (const code of NON_SUCCESS_CODES) {
            expect(shouldKeepEngineSession(VIETCOM, code, CLOSED)).toBe(false);
        }
    });
});

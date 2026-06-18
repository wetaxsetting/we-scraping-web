/**
 * Shared NXiSAS API debug logging — the browser-side counterpart to the
 * backend `NxisasApiLog` (Spring) and a refactor analogue of legacy
 * `nxisas_api.js`'s `console.log` trace. `nxisas_api.js` is reference
 * only; it is never loaded or executed, and `_v2nxisas` is never shadowed.
 *
 * Every NXiSAS API scraping UI flow (Bank Transaction Sync VND/FCY, Bank
 * Login Credentials verify, the OTP / QNA / CAPTCHA dialogs, and the shared
 * API client wrappers) logs through `nxisasDebug(...)` so the console reads
 * the same way the legacy engine did:
 *
 *   -------------------- execute thread(0) input --------------------
 *   { bankCd: "970424", accounts: 2, acctNo: "***1234" }
 *
 * Logs are OFF unless `NEXT_PUBLIC_NXISAS_DEBUG === "true"`, so production
 * builds emit nothing. Nothing sensitive is ever printed: payloads pass
 * through `maskNxisasDebugData` which redacts passwords / OTP / CAPTCHA /
 * QNA answers and partially masks account numbers and session tokens
 * (mirrors the backend `NxisasMask` rules).
 *
 * Correlate browser ↔ Spring ↔ gateway logs on `traceId` — the scrape
 * `session_id` the backend returns and the frontend echoes on every
 * resume call. Pass it in your debug payloads (e.g.
 * `nxisasDebug("Auth", { bankCd, traceId, sasSessionId })`).
 */

const NXISAS_DEBUG = process.env.NEXT_PUBLIC_NXISAS_DEBUG === "true";

/** Keys whose values are secrets — fully redacted. Matched after
 *  lowercasing and stripping non-alphanumerics. */
const REDACT_KEYS = new Set([
    "password",
    "pwd",
    "passwd",
    "loginpwd",
    "loginpwd1",
    "otp",
    "captcha",
    "captchaanswer",
    "answer",
    "res",
    // `value` is the OTP / CAPTCHA answer field on the resume payloads — a
    // secret in every NXiSAS debug context, so always redact it.
    "value",
    "hiddenvalue",
    "secret",
    "certpassword",
    "certpwd",
    "privatekey",
    "privkey",
    "corporateid",
]);

/** Keys whose values are account OR card numbers — masked to last 4. */
const ACCT_KEYS = new Set([
    "acctno", "accountno", "acctnum", "accountnum", "acct", "account",
    "cardno", "cardnum", "cardnumber",
]);

/** Keys whose values are session tokens — partially masked. */
const TOKEN_KEYS = new Set(["sassessionid", "token", "commontoken", "common"]);

const REDACTED = "***REDACTED***";

/** Account number → `***1234` (last 4 only). */
export function maskAcct(acctNo: string | null | undefined): string {
    if (!acctNo) return "";
    const t = String(acctNo).trim();
    if (t.length <= 4) return "****";
    return "***" + t.slice(-4);
}

/** Token (SAS_SessionID, Common token, …) → `abc***xyz`. */
export function maskToken(value: string | null | undefined): string {
    if (!value) return "";
    const t = String(value).trim();
    if (t.length <= 6) return "***";
    return t.slice(0, 3) + "***" + t.slice(-3);
}

const normalizeKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Deep-clone `data` with sensitive fields masked. Safe to call on any
 * request/response object before logging. Non-plain values (primitives,
 * Dates, etc.) pass through unchanged; cyclic refs are guarded.
 */
export function maskNxisasDebugData(data: unknown, seen = new WeakSet<object>()): unknown {
    if (data === null || typeof data !== "object") return data;
    if (seen.has(data as object)) return "[Circular]";
    seen.add(data as object);

    if (Array.isArray(data)) {
        return data.map((v) => maskNxisasDebugData(v, seen));
    }

    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        const norm = normalizeKey(key);
        if (REDACT_KEYS.has(norm)) {
            out[key] = REDACTED;
        } else if (ACCT_KEYS.has(norm) && typeof value === "string") {
            out[key] = maskAcct(value);
        } else if (TOKEN_KEYS.has(norm) && typeof value === "string") {
            out[key] = maskToken(value);
        } else {
            out[key] = maskNxisasDebugData(value, seen);
        }
    }
    return out;
}

/**
 * Log one NXiSAS debug section. No-op unless `NEXT_PUBLIC_NXISAS_DEBUG`
 * is `"true"`. `data` is masked before printing.
 *
 *   nxisasDebug("execute thread(0) input", { bankCd, acctNo, accounts });
 */
export function nxisasDebug(title: string, data?: unknown): void {
    if (!NXISAS_DEBUG) return;
    console.log(`-------------------- ${title} --------------------`);
    if (data !== undefined) {
        console.log(maskNxisasDebugData(data));
    }
}

/** True when NXiSAS debug logging is enabled — lets callers skip building
 *  an expensive debug payload when it would be discarded. */
export const isNxisasDebugEnabled = NXISAS_DEBUG;

/**
 * Card scraping (Update Card Transactions + Card Management add-card)
 * supports exactly two issuing banks. Single source of truth for tagging
 * card-flow debug logs as in-scope; does NOT add or enable any other bank.
 * Mirrors the backend `NxisasCardBanks`.
 */
export const SUPPORTED_CARD_BANK_CDS: ReadonlySet<string> = new Set([
    "11704088", // Shinhan Bank Vietnam
    "11704020", // Woori Bank Vietnam
]);

/** True only for the two supported card banks (Shinhan / Woori). */
export function isSupportedCardBank(bankCd: string | null | undefined): boolean {
    return !!bankCd && SUPPORTED_CARD_BANK_CDS.has(bankCd);
}

import type { NxisasScrapingInput } from "@/components/banking/own-account-transfer/hooks/use-nxisas-engine";

/**
 * GDT (Vietnam tax-portal) credential validation against the LOCAL NXiSAS
 * engine — legacy-parity port of `comm_0218_007.js:43-95` (the
 * Settings > Login Credentials GDT save flow).
 *
 * <p>Legacy GDT login runs entirely in the client-side engine
 * (`_v2nxisas.callNxisas([{ bankCd:"VIETNAM_GDT", loginID, loginPWD }])`),
 * NOT through the Coocon server gateway. The engine logs into the GDT
 * portal, renders its own CAPTCHA modal (image generated + answer verified
 * by the engine; the web page only displays it), and the credential is
 * persisted ONLY after a successful login. This module reproduces that:
 * it builds the login-only `orgObj` and parses the engine's terminal
 * result. The engine's CAPTCHA modal + 3-try loop (`_GDTCaptchaTryCount`,
 * `WBE6121`) runs internally during `runScraping`, which resolves only
 * once the engine reaches a terminal outcome — exactly like legacy.
 *
 * <p>The module deliberately calls NO backend Coocon API and adds NO
 * `VIETNAM_GDT` server-gateway Module/Class — the GDT engine module
 * (`GLOBAL/VNM/PUBLIC_GDT` / `COMMON`) is resolved client-side by
 * `lib/nxisas/jexjs-adapter.ts`'s `GDT_NXISAS_PROFILES`.
 *
 * <p><b>Runtime caveat:</b> the local engine is licensed per page origin
 * and is NOT licensed on `localhost`, so this flow cannot be exercised in
 * R&D — it is built to legacy parity and type-checked, but verified
 * end-to-end only on a licensed origin (e.g. `wecms.kosign.dev`). Same
 * constraint as the e-Invoice scrape (`useEInvoiceScrape`).
 */

/** Pseudo bank code the engine uses for a GDT login (legacy
 *  `comm_0218_007.js:45`). */
export const GDT_BANK_CD = "VIETNAM_GDT";

/** Engine success codes — `00000000` plus the three benign
 *  "no-data"/"no-transaction" codes the legacy engine's `isSuccess`
 *  treats as success (`nxisas_v2.js` `isSuccess`). For a login-only
 *  test only `00000000` is expected, but the wider set is harmless. */
const SUCCESS_CODES = new Set(["00000000", "42110000", "42120011", "42120111"]);

/** Bad-credential code surfaced by the GDT adapter (legacy
 *  `comm_0218_007.js:81`). */
export const GDT_BAD_CREDENTIAL_CODE = "80004051";

export type GdtValidationOutcome = {
    /** True only when the engine reported a successful GDT login — the
     *  single gate the caller uses to decide whether to persist. */
    ok: boolean;
    /** Raw engine `Output.ErrorCode` (e.g. `"00000000"`, `"80004051"`),
     *  or `""` when the result couldn't be parsed. */
    errorCode: string;
    /** Engine `Output.ErrorMessage` (falls back to `DetailMessage`). */
    errorMessage: string;
    /** Wrong username/password (`80004051`) or any non-success terminal
     *  result — caller must NOT save. */
    loginFailed: boolean;
    /** GDT CAPTCHA entered wrong 3+ times — legacy `WBE6121`
     *  (`_v2nxisas._GDTCaptchaTryCount >= 3`). Caller must NOT save. */
    captchaExceeded: boolean;
};

/**
 * Build the login-only `orgObj` for the GDT credential test. Mirrors
 * legacy `comm_0218_007.js:43-49` ({@code bankCd:"VIETNAM_GDT"}, login id,
 * password) plus the refactor e-Invoice GDT engine config
 * ({@code nonDecrypt:false} client-side decrypt, {@code use2ndCertRuleForGDT}
 * so the GDT CAPTCHA 2nd-cert rule fires). No post-login job — login is
 * per-`orgObj` entry, jobs are post-login operations, so an empty `job`
 * makes the engine log in and stop (the login test). {@code nonLogout:false}
 * closes the session after the test.
 */
export function buildGdtValidationInput(
    loginId: string,
    password: string,
): NxisasScrapingInput[] {
    return [
        {
            bankCd: GDT_BANK_CD,
            loginID: loginId,
            loginPWD: password,
            nonLogout: false,
            nonDecrypt: false,
            use2ndCertRuleForGDT: true,
            threadCount: 1,
            job: [],
        },
    ];
}

/** Read the engine's GDT CAPTCHA try counter (legacy
 *  `_v2nxisas._GDTCaptchaTryCount`) defensively. */
function gdtCaptchaTryCount(): number {
    if (typeof window === "undefined") return 0;
    const v2 = (window as unknown as { _v2nxisas?: { _GDTCaptchaTryCount?: number } })
        ._v2nxisas;
    const n = v2?._GDTCaptchaTryCount;
    return typeof n === "number" ? n : 0;
}

/** Defer to the engine's own `isSuccess` when present (parity with
 *  `comm_0218_007.js:51`); otherwise fall back to the known success set. */
function engineIsSuccess(code: string): boolean {
    if (code === "") return false;
    if (typeof window !== "undefined") {
        const v2 = (window as unknown as { _v2nxisas?: { isSuccess?: (c: string) => boolean } })
            ._v2nxisas;
        if (typeof v2?.isSuccess === "function") {
            try {
                return v2.isSuccess(code);
            } catch {
                /* fall through to the static set */
            }
        }
    }
    return SUCCESS_CODES.has(code);
}

/** Extract the LOGIN record's error code/message from the engine's raw
 *  callback payload. Contract: `raw[0].result[0].Output.{ErrorCode,
 *  ErrorMessage,DetailMessage}` (legacy `comm_0218_007.js:51,81,90`). */
function readEngineOutput(raw: unknown): { code: string; message: string } {
    try {
        const r = raw as Array<{
            result?: Array<{
                Output?: { ErrorCode?: string; ErrorMessage?: string; DetailMessage?: string };
            }>;
        }>;
        const out = r?.[0]?.result?.[0]?.Output;
        const code = typeof out?.ErrorCode === "string" ? out.ErrorCode : "";
        const message = out?.ErrorMessage || out?.DetailMessage || "";
        return { code, message };
    } catch {
        return { code: "", message: "" };
    }
}

/**
 * Parse the engine's terminal result into a {@link GdtValidationOutcome}.
 * Conservative: persistence is allowed ONLY on a clearly-successful login
 * — an unparseable / unknown result is treated as a failure so bad or
 * uncertain credentials never reach the DB (legacy parity: save only on
 * `isSuccess`).
 */
export function extractGdtValidationOutcome(raw: unknown): GdtValidationOutcome {
    const { code, message } = readEngineOutput(raw);
    const captchaExceeded = gdtCaptchaTryCount() >= 3;
    const ok = !captchaExceeded && engineIsSuccess(code);
    return {
        ok,
        errorCode: code,
        errorMessage: message,
        loginFailed: !ok && !captchaExceeded,
        captchaExceeded,
    };
}

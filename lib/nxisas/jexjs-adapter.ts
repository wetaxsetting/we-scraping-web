/**
 * Next.js compatibility adapter for the NXiSAS scraping bundle's
 * legacy {@code jexjs} runtime.
 *
 * <p><b>PHASE B TODO:</b> Port saved-cert engine harness backed by
 * {@code BANK_CERT_INFO} before enabling live Update Balance /
 * Confirm Transfer execution. Full numbered checklist + Spring
 * endpoint mapping below — search for "PHASE B TODO" in this file.
 *
 * <p>The vendor bundle at {@code public/nxisas/js/nxisas_v2.js} was
 * compiled for the JEX framework shell — it references a handful of
 * globals (`jexjs`, `_isOsmc`, `top.tmsComm`) that the JEX page
 * scaffold normally injects. The refactor Next.js shell doesn't
 * provide them, so the bundle throws on first use (`jexjs is not
 * defined`).
 *
 * <p>This module installs minimal browser-side equivalents:
 *
 * <ul>
 *   <li>{@code window.jexjs} with the five methods the bundle
 *       actually calls — {@code empty}, {@code getLang},
 *       {@code isJexError}, {@code getCode}, {@code createAjaxUtil}.</li>
 *   <li>{@code window._isOsmc = false} — forces the bundle's
 *       synchronous {@code getCode("NXISAS_MODULE", bankCd)} branch
 *       in `makeHeader` (line 919-920) instead of the async
 *       {@code nxisas_getModuleInfo.jct} AJAX path. The sync branch
 *       reads from {@link BANK_NXISAS_PROFILES} below, so the header
 *       builds without any network round-trip.</li>
 *   <li>{@code window.tmsComm} no-op progress-bar helpers. React
 *       owns the busy state via {@code updating}/{@code submitting}
 *       in the composer, so the bundle's progress-bar calls become
 *       no-ops.</li>
 * </ul>
 *
 * <p><b>What this adapter does NOT do:</b> it does NOT call any
 * legacy JEX {@code .jct} action. Every {@code createAjaxUtil}
 * request is routed through {@link routeJexCall} to a refactor
 * Spring REST endpoint (or returns a structured "not implemented"
 * response when the corresponding Spring port hasn't shipped yet,
 * so the bundle reports a clean error via its own
 * {@code isJexError} path instead of crashing).
 *
 * <p>The bundle's WebSocket transport to the user-local
 * {@code NXiSAS.exe} process is unaffected — that link is between
 * the browser and the user's PC, with the bank IB site as the
 * remote peer. Spring is never on that path. Spring's role is
 * limited to (a) providing the few REST endpoints the bundle needs
 * for module/class lookup and audit logging, and (b) accepting the
 * post-scrape result via the existing {@code /balance-refresh} and
 * {@code /scraping-result} endpoints.
 */

import { api } from "@/lib/axios";

/* ===================================================================
 *  Static bank profile table — replaces legacy `DBC_CODE_INFM`
 *  lookups for NXISAS_MODULE / NXISAS_CLASS.
 * ================================================================= */

/**
 * Per-bank NXISAS Module + Class identifiers — extracted verbatim
 * from live DEV {@code wecmsvndev.nxsias_module_tran_log_his}
 * (2026-05-20). These are wabooks bank-driver identifiers compiled
 * into the NXiSAS.exe vendor binary; they are stable across releases
 * (the vendor would have to ship a new binary to change them).
 *
 * <p>Coverage:
 *
 * <table>
 *   <tr><th>bank_cd</th><th>module</th><th>class</th></tr>
 *   <tr><td>11704001</td><td>GLOBAL/VNM/BANK_Vietin</td><td>CORPORATE</td></tr>
 *   <tr><td>11704003</td><td>GLOBAL/GBL/BANK_IBK</td><td>CORPORATE</td></tr>
 *   <tr><td>11704004</td><td>GLOBAL/VNM/BANK_Vietcom</td><td>CORPORATE</td></tr>
 *   <tr><td>11704020</td><td>GLOBAL/GBL/BANK_Woori</td><td>CORPORATE</td></tr>
 *   <tr><td>11704088</td><td>GLOBAL/GBL/BANK_Shinhan</td><td>COMMON</td></tr>
 * </table>
 *
 * Vietcom additionally supports {@code DIGIBIZ} and {@code PERSONAL}
 * classes (legacy {@code trns_0001_007.ts} switches the class per
 * user-selected variant). The refactor today only uses CORPORATE —
 * the Vietcom variant picker is deferred. When ported, swap the
 * value here based on the variant the user picked.
 *
 * If a future Path-A bank lands without an entry here, the adapter
 * falls back to the legacy synthetic {@code BNK_BNK001_<bankCd>}
 * module name — sometimes that's enough for the engine to recognise
 * a bank, but it's a best-effort safety net, not a long-term fix.
 */
export const BANK_NXISAS_PROFILES: Readonly<Record<string, { module: string; class: string }>> = {
    "11704001": { module: "GLOBAL/VNM/BANK_Vietin",  class: "CORPORATE" },
    "11704003": { module: "GLOBAL/GBL/BANK_IBK",     class: "CORPORATE" },
    "11704004": { module: "GLOBAL/VNM/BANK_Vietcom", class: "CORPORATE" },
    "11704020": { module: "GLOBAL/GBL/BANK_Woori",   class: "CORPORATE" },
    "11704088": { module: "GLOBAL/GBL/BANK_Shinhan", class: "COMMON"    },
};

/* ===================================================================
 *  Legacy → Spring REST routing table for `createAjaxUtil`.
 *
 *  Every JEX action name the bundle invokes (`nxisas_*`,
 *  `gdtc_*`, `fnif_*`) maps to either:
 *    • a refactor Spring REST URL — adapter `fetch`es it
 *    • `null` — endpoint not yet ported; adapter returns a
 *      synthetic JEX-shaped error so the bundle reports a clean
 *      message instead of crashing on undefined response shape.
 * ================================================================= */

const ENDPOINT_MAP: Readonly<Record<string, string | null>> = {
    // Module/class info — bundle's OSMC branch (gated by `_isOsmc`).
    // Forced unused since we set `_isOsmc = false`, but kept here so
    // a future flip back to OSMC mode has a place to land.
    nxisas_getModuleInfo:   null,
    // Cert form HTML template fetched on first cert chooser open.
    nxisas_getCertFormInfo: null,
    // Saved-cert account list — driver of the cert chooser popup.
    nxisas_acctList_r003:   null,
    // Vietnam tax-authority cert info (GDT module).
    gdtc_0001_001_r001:     null,
    // Cert decryption — server-side AES with tenant-scoped key.
    nxisas_decrypt:         null,
    // Cert encryption — same crypto, write side.
    nxisas_encrypt:         null,
    // Save / update a bank cert.
    fnif_0001_003_u001:     null,
    // Save / update a GDT cert.
    gdtc_0001_002_u001:     null,
    // Engine event audit log — bundle's fire-and-forget telemetry.
    // Wired to the existing `/engine-connection-check` audit channel
    // when ported; null today is the safest default.
    nxisas_logging:         null,
};

/* ===================================================================
 *  JEX runtime stubs.
 * ================================================================= */

/** Mirror of legacy {@code jexjs.empty} semantics — true for null,
 *  undefined, empty string, empty array, and empty plain object. */
function jexEmpty(v: unknown): boolean {
    if (v === null || v === undefined) return true;
    if (typeof v === "string") return v.length === 0;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === "object") return Object.keys(v as object).length === 0;
    return false;
}

/** Active locale, two-letter lowercase. Reads the same storage key
 *  the refactor's {@code LocaleProvider} writes to (see
 *  `lib/i18n/LocaleProvider.tsx`). Falls back to `"en"` for SSR /
 *  first paint where {@code window} is undefined.
 *
 *  <p>Legacy bundle expects values like {@code "en" / "ko" / "vi"}
 *  — matches the refactor's {@code Locale} type 1:1. */
function jexGetLang(): string {
    if (typeof window === "undefined") return "en";
    try {
        const stored = window.localStorage.getItem("wecms_locale");
        if (stored === "en" || stored === "ko" || stored === "vi" || stored === "km") {
            return stored;
        }
    } catch {
        /* localStorage blocked / private mode */
    }
    return "en";
}

/** Detect a JEX-shaped error response. Bundle calls this on every
 *  AJAX callback to decide whether to short-circuit into its
 *  error-display path. We recognise three envelope shapes:
 *
 *    1. Refactor Spring envelope — {@code data.status.error === true}
 *    2. Legacy JEX envelope — {@code data.COMMON_HEAD.ERROR === true}
 *    3. Adapter synthetic error (this file's
 *       {@link buildSyntheticJexError}) — uses the legacy shape. */
function jexIsJexError(data: unknown): boolean {
    if (!data || typeof data !== "object") return true;
    const d = data as Record<string, unknown>;
    const head = d.COMMON_HEAD as { ERROR?: unknown } | undefined;
    if (head && head.ERROR === true) return true;
    const status = d.status as { error?: unknown } | undefined;
    if (status && status.error === true) return true;
    return false;
}

/** Synchronous code lookup. Bundle calls this twice in
 *  `makeHeader`:
 *    {@code jexjs.getCode("NXISAS_MODULE", bankCd)} → module
 *    {@code jexjs.getCode("NXISAS_CLASS", bankCd)}  → class
 *
 *  We answer from {@link BANK_NXISAS_PROFILES}. Unknown bank →
 *  safety-net synthetic value (matches the legacy
 *  `BNK_BNK001_<bankCd>` shape so the engine has a chance to
 *  resolve it server-side). */
function jexGetCode(codeType: string, bankCd: string): string {
    const profile = BANK_NXISAS_PROFILES[bankCd];
    if (codeType === "NXISAS_MODULE") {
        return profile?.module ?? `BNK_BNK001_${bankCd}`;
    }
    if (codeType === "NXISAS_CLASS") {
        return profile?.class ?? "CORPORATE";
    }
    // Other code types aren't requested by the bundle. Return empty
    // string rather than throwing so a future bundle update doesn't
    // crash the engine.
    return "";
}

/* ===================================================================
 *  createAjaxUtil — fetch-based replacement for the legacy JEX AJAX
 *  helper. Returns an object the bundle drives with
 *  `.setting()`, `.set()`, `.execute(cb)`.
 * ================================================================= */

type JexAjaxSetting = {
    suffix?: string;     // e.g. `.jct` — informational only
    async?:  boolean;    // sync mode is ignored; warn + run async
    [key: string]: unknown;
};

interface JexAjaxLike {
    setting:  (keyOrObj: string | JexAjaxSetting, val?: unknown) => JexAjaxLike;
    set:      (input: unknown) => JexAjaxLike;
    execute:  (callback: (rData: unknown) => void) => void;
}

/** Build a JEX-shaped error response the bundle's
 *  {@link jexIsJexError} recognises. Used when an action has no
 *  Spring endpoint mapped yet, so the bundle surfaces a clean
 *  message instead of crashing on `rData.MODULE` etc. */
function buildSyntheticJexError(actionName: string): Record<string, unknown> {
    return {
        COMMON_HEAD: {
            ERROR:   true,
            CODE:    "WBE_ENGINE_ENDPOINT_DEFERRED",
            MESSAGE: `Engine endpoint "${actionName}" is not yet ported. ` +
                     `Saved-cert / cert-decrypt / engine-logging flows are deferred to Phase B.`,
        },
    };
}

function createAjaxUtil(actionName: string): JexAjaxLike {
    let body: unknown = null;
    let settings: JexAjaxSetting = {};

    const utility: JexAjaxLike = {
        setting(keyOrObj, val) {
            if (typeof keyOrObj === "string") {
                settings[keyOrObj] = val;
            } else if (keyOrObj && typeof keyOrObj === "object") {
                settings = { ...settings, ...keyOrObj };
            }
            return utility;
        },
        set(input) {
            body = input;
            return utility;
        },
        execute(callback) {
            const endpoint = ENDPOINT_MAP[actionName];

            // No Spring port → synthetic JEX error. The bundle's
            // own `isJexError(rData)` returns true and it falls
            // through to its error-message UI. We intentionally
            // surface this rather than fail silently.
            if (endpoint == null) {
                console.warn(
                    `[nxisas] no Spring REST endpoint mapped for legacy JEX action "${actionName}". ` +
                    `Returning synthetic JEX error so the bundle reports cleanly.`,
                );
                queueMicrotask(() => callback(buildSyntheticJexError(actionName)));
                return;
            }

            // Sync mode requested → warn and run async anyway.
            // Modern browsers prohibit sync XHR in the document.
            if (settings.async === false) {
                console.warn(
                    `[nxisas] legacy JEX action "${actionName}" requested sync execution; ` +
                    `running async (modern browsers prohibit sync XHR).`,
                );
            }

            api.post(endpoint, body ?? {})
                .then((res) => callback(res.data))
                .catch((err) => {
                    console.warn(
                        `[nxisas] Spring REST endpoint "${endpoint}" failed for legacy action "${actionName}"`,
                        err,
                    );
                    callback(buildSyntheticJexError(actionName));
                });
        },
    };
    return utility;
}

/* ===================================================================
 *  Phase B pre-flight — does this source row have a saved bank cert?
 * ================================================================= */

/**
 * Cert metadata the NXiSAS bundle needs to log into a bank IB site.
 * Mirrors the legacy `data.REC` shape at `trns_0001_007.ts:1582-1599`
 * — these five fields are what gets passed to `_v2nxisas.callNxisas`
 * as the `orgObj` cert payload. Legacy reads them from
 * {@code BANK_CERT_INFO} via the JEX backend.
 *
 * <p>In the refactor, none of these fields are on the wire today —
 * the {@code /source-accounts} endpoint doesn't surface them. Phase B
 * will:
 *
 * <ol>
 *   <li>Port {@code BANK_CERT_INFO} schema + entity + repository.</li>
 *   <li>Extend the source-account DTO to carry the five fields
 *       below per row.</li>
 *   <li>Add cert-management endpoints (save / decrypt / list).</li>
 *   <li>Wire a cert-chooser UI when more than one cert is on file.</li>
 * </ol>
 *
 * Until Phase B lands, every source row has these fields empty /
 * undefined, and {@link hasSavedBankCert} returns false.
 */
export type EngineCertFields = {
    bankCertSeq?:   string | null;
    certInfoCon?:   string | null;
    nxisasGbSeqNo?: string | null;
    loginID?:       string | null;
    loginPWD?:      string | null;
};

/**
 * True only when the source row carries enough cert material for the
 * engine to actually log in. The minimum bar is {@code bankCertSeq +
 * loginID + loginPWD} — without all three, the bundle would either
 * pop the saved-cert chooser (Phase B endpoint) or send a LOGIN with
 * empty credentials (bank rejects → user sees "login failed").
 *
 * <p>Pre-flight callers ({@code handleUpdateBalance},
 * {@code handleConfirm}) should consult this BEFORE invoking
 * {@code engine.runScraping(...)} so the user sees a precise
 * "Phase B" message instead of a generic engine-side error.
 */
export function hasSavedBankCert(source: EngineCertFields | null | undefined): boolean {
    if (!source) return false;
    return Boolean(source.bankCertSeq && source.loginID && source.loginPWD);
}

/* ===================================================================
 *  PHASE B TODO — NXiSAS cert harness port
 *  -----------------------------------------------------------------
 *  The current MR ships the jexjs adapter + bundle compatibility +
 *  pre-flight warning. The engine bundle itself can load, parse,
 *  and build login headers without crashing — but it cannot
 *  actually log into a bank because the saved-cert material is
 *  not surfaced yet. The list below is the exact work that
 *  re-enables live Update Balance / Confirm Transfer.
 *
 *  [ ] 1. Port `BANK_CERT_INFO` schema via Flyway
 *         (column-for-column DEV parity per the
 *         "Legacy Schema Parity Rule" in wecms-api/CLAUDE.md).
 *
 *  [ ] 2. Extend `/api/v1/banking/own-account-transfer/source-accounts`
 *         DTO with five per-row fields:
 *           - bank_cert_seq    (string)
 *           - cert_info_con    (string — cert envelope content)
 *           - nxisas_gb_seq_no (string — engine driver sequence)
 *           - login_id         (string)
 *           - login_pwd        (string — ciphertext from BANK_CERT_INFO)
 *         Frontend wire type + mapper plumbing already lands those
 *         into `OwnAccountSourceRow` (see types.ts — optional
 *         placeholder slots are in place).
 *
 *  [ ] 3. Add Spring REST endpoint for `nxisas_acctList_r003`
 *         (saved-cert account list per biz_key + bank_cd).
 *         Reads `BANK_CERT_INFO`. Then flip the corresponding
 *         entry in {@link ENDPOINT_MAP} from `null` → the new
 *         path; no other change to this file is needed.
 *
 *  [ ] 4. Add Spring REST endpoint for `nxisas_decrypt`
 *         (tenant-scoped AES round-trip — backend holds the key;
 *         frontend never sees it). Flip {@link ENDPOINT_MAP}.
 *
 *  [ ] 5. Enable live Update Balance / Confirm Transfer once
 *         saved-cert data is available — {@link hasSavedBankCert}
 *         auto-flips from `false` → `true` for rows whose cert
 *         fields populate, and the composer's pre-flight passes
 *         through to the engine call. No composer code change
 *         needed.
 *
 *  Out-of-OAT-scope (port only if/when their feature lands):
 *    - nxisas_getCertFormInfo   — drives `putPassword` popup
 *    - nxisas_encrypt           — write side of cert AES
 *    - fnif_0001_003_u001       — "Save bank cert" form upsert
 *    - nxisas_logging           — engine event audit log (telemetry)
 *    - gdtc_0001_001_r001       \ Vietnam tax authority cert flow,
 *    - gdtc_0001_002_u001       /   not used by OAT
 *    - nxisas_getModuleInfo     — OSMC branch only, never hit
 *                                  because `_isOsmc=false`
 *
 *  When each of the above is genuinely needed, flip the
 *  corresponding entry in {@link ENDPOINT_MAP} from `null` to
 *  the new Spring REST path. Bundle calls are already routed
 *  through {@link createAjaxUtil}.
 *
 *  -----------------------------------------------------------------
 *  2nd-cert UI prerequisites (separate from cert-data harness)
 *
 *  Stubbed below in {@link installJexjsAdapter}:
 *
 *   - `window._v2common.app.*` (showMessage / enableLayerPopup /
 *     closeLayerPopup / getPopupName / validated) — prevents
 *     ~103 ReferenceError sites in the bundle's 2nd-cert paths
 *     (`nxisas_v2.js:103,163,...,2452`). Today every call short-
 *     circuits because `hasSavedBankCert` blocks the engine from
 *     ever rendering a 2nd-cert modal; the stub guarantees Day-1
 *     Phase B activation does NOT need to revisit this file.
 *   - `window.jexML.get(key, fallback)` — prevents ~63
 *     ReferenceError sites in template-string builders. Returns
 *     the bundle-supplied English fallback. Upgrade to a real
 *     locale snapshot when Phase B testers report missing KO/VI.
 *   - `/public/assets_v2/images/common/OTP.jpg` — restored
 *     verbatim from `WECMS DEV/WECMS_STATIC/web/assets_v2/...`
 *     because the OTP modal template at `nxisas_v2.js:394`
 *     references it via a hard-coded relative path
 *     (`../../assets_v2/images/common/OTP.jpg`).
 *   - `/public/assets_v2/images/common/icon-information.png` —
 *     used by the engine's "not installed" / "non-Windows"
 *     banner templates at `nxisas_v2.js:565,597`.
 *
 *  Still missing (Phase B prerequisite, port BEFORE flipping the
 *  cert gate so modals render correctly):
 *
 *   - **Modal layout CSS** for `.layerCont`, `.layerPopupWrap`,
 *     `.layerPopup-contsBox`, `.btn-st.common/.primary`,
 *     `.item-table`, `.input-clear-box`, `.select-box-default-st`,
 *     `.OTP-img`, `.captcha-code`, `.formList-wrap`, `.required`,
 *     `.btn-area`. Today the bundle's 2nd-cert popups would
 *     render unstyled and at the default static stacking, so
 *     they'd sit UNDER the composer's z-50 `<DialogContent>`
 *     overlay and be unclickable. Port the needed rules from
 *     `WECMS DEV/WECMS_STATIC/web/assets_v2/css/_common.css` +
 *     `_ks-properties.css` into a new
 *     `wecms-web/app/nxisas-modals.css` (or equivalent), with
 *     `z-index: 60+` on `.layerCont` so it overlays the dialog.
 *     Must follow CLAUDE.md global typography (Inter stack).
 *
 *   - **`.select-box-default-st` jQuery click handler** — the QNA
 *     modal at `nxisas_v2.js:450-496` uses
 *     `.select-box-default-st > ul > li` and expects the legacy
 *     shell's `add.js` handler (~6 lines of jQuery) to toggle
 *     `.selected` on click + populate the read-only
 *     `input.selectValue`. Without it, the Confirm button always
 *     hits the "WBE6120 — Select a question" guard at line 163.
 *     Port the snippet into the same place this adapter lives,
 *     attached at install time.
 * ================================================================= */

/* ===================================================================
 *  Public install — idempotent, safe to call multiple times.
 * ================================================================= */

declare global {
    interface Window {
        jexjs?: {
            empty:   typeof jexEmpty;
            getLang: typeof jexGetLang;
            isJexError: typeof jexIsJexError;
            getCode: typeof jexGetCode;
            createAjaxUtil: typeof createAjaxUtil;
        };
        /** Bundle's "OSMC build" feature flag — read at parse time
         *  in {@code nxisas_v2.js:883,2433}. We pin it to `false`
         *  to force the synchronous {@link jexGetCode} branch. */
        _isOsmc?: boolean;
        /** Legacy JEX progress-bar helper the NXiSAS bundle calls via
         *  `top.tmsComm.createProgressBar()` / `destroyProgressBar()`
         *  (see `nxisas_v2.js:207`, `:1732`, `:1811`,
         *  `isasscaping.js:493`). React owns its own busy state via
         *  `updating` / `submitting`, so the adapter installs no-ops. */
        tmsComm?: {
            createProgressBar:  () => void;
            destroyProgressBar: () => void;
        };
        /** Legacy JEX common-UI helper the NXiSAS bundle calls in 5
         *  places during its 2nd-cert / popup flows. Shimmed here so
         *  `putPassword`, `run2ndCert`, Q&A submit, OTP submit, etc.
         *  do not throw `ReferenceError: _v2common is not defined`
         *  the moment the bundle tries to render a modal — even
         *  though `hasSavedBankCert` blocks today, the shim ensures
         *  Phase B Day-1 activation works without revisiting this
         *  file. Bundle call sites: `nxisas_v2.js:103,163,176,189,
         *  200,256,260,261,274,289,315,330,340,342,370,817,820,854,
         *  857,908,1098,1189,1194,1295,1608,1614,1650,1673,1696,
         *  1719,2265,2272,2273,2290,2309,2316,2317,2326,2452` +
         *  `isasscaping.js` showMessage paths. */
        _v2common?: {
            app: {
                showMessage:      (codeOrData: unknown, dataObjOrCb?: unknown, cb?: unknown) => void;
                enableLayerPopup: (name: string, cb?: () => void) => void;
                closeLayerPopup:  (cb?: () => void) => void;
                getPopupName:     (jq: unknown) => string;
                validated:        (selector: string) => boolean;
            };
        };
        /** Legacy JEX multi-language helper. Bundle calls `jexML.get(key,
         *  fallback)` 63 times in template-string builders. Shim returns
         *  the fallback (English string baked into the bundle), giving
         *  the modal a sane English label. Future enhancement: route to
         *  `useTranslation` via a locale-snapshot bridge. Bundle call
         *  sites concentrated at `nxisas_v2.js:384,401,1181-1186,1406-
         *  1424,1516-1535`. */
        jexML?: {
            get: (key: string, fallback?: string) => string;
        };
        /** jQuery — the bundle attaches it to the window in its own
         *  load order; the adapter does not own this. Declared here
         *  only so TypeScript's narrowing of `_v2common.app.validated`
         *  works against typed `$` calls in the shim body. */
        $?: ((selector: string) => { [key: string]: unknown });
    }
}

/**
 * Install the JEX compatibility adapter onto {@link Window}. Must
 * run BEFORE the NXiSAS bundle scripts execute — the engine hook
 * calls this inside its bundle-loader, alongside the
 * {@code WEB_SOCKET_SWF_LOCATION} flash hint.
 *
 * <p>Idempotent. Calls after the first one are no-ops.
 */
export function installJexjsAdapter(): void {
    if (typeof window === "undefined") return;

    if (!window.jexjs) {
        window.jexjs = {
            empty:          jexEmpty,
            getLang:        jexGetLang,
            isJexError:     jexIsJexError,
            getCode:        jexGetCode,
            createAjaxUtil: createAjaxUtil,
        };
    }

    // Force the synchronous `getCode` branch in `makeHeader`. The
    // OSMC branch wants AJAX to `nxisas_getModuleInfo.jct` which
    // we explicitly DO NOT want to call.
    if (window._isOsmc === undefined) {
        window._isOsmc = false;
    }

    // Legacy progress-bar shim. Bundle calls these unconditionally
    // from several unguarded paths — see `nxisas_v2.js:207`,
    // `isasscaping.js:493`. The composer owns its own busy state,
    // so no-ops are the correct semantics.
    if (!window.tmsComm) {
        window.tmsComm = {
            createProgressBar:  () => { /* React owns busy state */ },
            destroyProgressBar: () => { /* React owns busy state */ },
        };
    }

    // ---- _v2common + jexML 2nd-cert plumbing ----------------------
    // The bundle's putPassword / run2ndCert / Q&A / OTP / captcha /
    // transfer-confirm flows all assume the legacy JEX shell's
    // `_v2common.app.*` and `jexML.get(...)` helpers are on `window`.
    // The refactor's React shell doesn't ship them, so without these
    // stubs the very first 2nd-cert modal would throw
    // `ReferenceError: _v2common is not defined` (~103 call sites) or
    // `ReferenceError: jexML is not defined` (~63 call sites).
    //
    // Today the `hasSavedBankCert` pre-flight blocks every flow that
    // could reach these globals — but the stubs are installed
    // unconditionally so Phase B activation (BANK_CERT_INFO port +
    // `nxisas_acctList_r003` Spring endpoint + the rest of the cert
    // harness) does not have to revisit this file. See "PHASE B TODO"
    // block above for the full activation checklist.
    if (!window._v2common) {
        window._v2common = {
            app: {
                /** Bundle uses this to surface WBE/WBI codes AND
                 *  occasionally to surface a raw response object
                 *  (`rData`) when the AJAX path errored. Shimmed
                 *  to a browser `alert(...)` (acceptable for Phase B
                 *  edge cases — these fire on validation errors only)
                 *  + always-fire callback. Phase B can route this to
                 *  the shared `useDialog` system via a custom-event
                 *  bridge if the UX warrants it. */
                showMessage(codeOrData, dataObjOrCb, cb) {
                    // Resolve which arg is the callback (overloaded
                    // signature: `(code, cb)` OR `(code, dataObj, cb)`).
                    const callback = typeof dataObjOrCb === "function"
                        ? dataObjOrCb as () => void
                        : typeof cb === "function"
                            ? cb as () => void
                            : null;
                    const msg = typeof codeOrData === "string"
                        ? codeOrData
                        : "[engine] system message";
                    if (typeof window !== "undefined" && typeof window.alert === "function") {
                        window.alert(msg);
                    } else {
                        console.warn("[nxisas] _v2common.showMessage:", codeOrData);
                    }
                    if (callback) {
                        try { callback(); } catch (e) { console.warn("[nxisas] showMessage cb threw", e); }
                    }
                },

                /** Bundle calls this immediately after appending a
                 *  `.layerCont` popup to `<body>` to bind its inputs.
                 *  Legacy shell did focus management + select-box wiring;
                 *  refactor delegates focus to the browser and select
                 *  boxes are stubbed (see note below QNA selection
                 *  handler in the Phase B doc block). No-op + fire cb. */
                enableLayerPopup(_name, cb) {
                    if (typeof cb === "function") {
                        try { cb(); } catch (e) { console.warn("[nxisas] enableLayerPopup cb threw", e); }
                    }
                },

                /** Bundle calls this to dismiss the topmost popup. The
                 *  popup is a `.layerCont` DOM element the bundle
                 *  appended to `<body>`; removing it dismisses the
                 *  modal visually. We target the LAST `.layerCont` in
                 *  body order to handle stacked popups (legacy used a
                 *  `fromPopup` chain — same intent). Then fire cb. */
                closeLayerPopup(cb) {
                    if (typeof document !== "undefined") {
                        const cards = document.querySelectorAll("body > .layerCont");
                        if (cards.length > 0) {
                            const top = cards[cards.length - 1];
                            top.parentElement?.removeChild(top);
                        }
                    }
                    if (typeof cb === "function") {
                        try { cb(); } catch (e) { console.warn("[nxisas] closeLayerPopup cb threw", e); }
                    }
                },

                /** Bundle generates per-popup names so `enableLayerPopup`
                 *  / `closeLayerPopup` can target them. Legacy returned
                 *  a hashed id from the jQuery wrapper's first element.
                 *  Refactor stub: return the element's `id` attr or a
                 *  fresh unique string. The name is opaque to the
                 *  bundle's flow logic — it's only used as a handle. */
                getPopupName(jq) {
                    // Try to read `.attr('id')` off the jQuery wrapper
                    // without importing jQuery types. The bundle passes
                    // a jQuery object; we duck-type for `attr`.
                    const j = jq as { attr?: (k: string) => string | undefined };
                    const id = typeof j?.attr === "function" ? j.attr("id") : undefined;
                    if (id) return id;
                    return `nxisas-popup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                },

                /** Bundle calls this to check that every
                 *  `[data-require='true']` input inside a popup has a
                 *  value. Returns `true` when ALL required inputs are
                 *  non-empty (then the bundle proceeds to submit).
                 *  Native DOM read — no jQuery dependency. */
                validated(selector) {
                    if (typeof document === "undefined") return false;
                    const nodes = document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector);
                    for (const node of nodes) {
                        const v = (node as HTMLInputElement).value;
                        if (v == null || String(v).trim() === "") return false;
                    }
                    return true;
                },
            },
        };
    }

    if (!window.jexML) {
        window.jexML = {
            /** Bundle calls `jexML.get(key, fallback)` for every
             *  localized string in the 2nd-cert template builders.
             *  Returning the bundle-supplied fallback gives the modal
             *  a sane English label. When Phase B activates the cert
             *  harness, this can be upgraded to read from the same
             *  locale snapshot {@link jexGetLang} consults. */
            get(_key, fallback) {
                return fallback ?? "";
            },
        };
    }

    // ---- Security-question dropdown click delegate ----------------
    // The bundle's QNA template at `nxisas_v2.js:450-496` renders a
    // custom `<div class="select-box-default-st">` with a readonly
    // `<input class="selectValue">` trigger + a `<ul class="select-
    // box-option">` popover of `<li data-val="…" data-hiddenVal="…">`
    // options. Selecting an `<li>` must (a) mark it `.selected`,
    // (b) write its `data-val` into the trigger input, (c) close the
    // popover. The legacy shell's `add.js` wired this with jQuery;
    // refactor implements via native DOM delegation on `<body>` so
    // it works for ALL `.select-box-default-st` instances the bundle
    // ever renders. Idempotent — guarded by a marker dataset flag.
    if (typeof document !== "undefined" && !document.body?.dataset.wbNxisasSelectWired) {
        const closeAllSelects = (except?: Element) => {
            document.querySelectorAll<HTMLElement>(".select-box-default-st.open").forEach((el) => {
                if (el !== except) el.classList.remove("open");
            });
        };
        const onBodyClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;

            // 1. Click an option `<li>` inside `.select-box-option`.
            const li = target.closest<HTMLLIElement>(".select-box-default-st .select-box-option > li");
            if (li) {
                const root = li.closest<HTMLElement>(".select-box-default-st");
                if (!root) return;
                root.querySelectorAll(".select-box-option > li.selected").forEach((s) =>
                    s.classList.remove("selected"),
                );
                li.classList.add("selected");
                const input = root.querySelector<HTMLInputElement>("input.selectValue");
                const val = li.getAttribute("data-val") ?? li.textContent ?? "";
                if (input) input.value = val;
                root.classList.remove("open");
                return;
            }

            // 2. Click the trigger input — toggle popover open/closed.
            const trigger = target.closest<HTMLInputElement>(".select-box-default-st input.selectValue");
            if (trigger) {
                const root = trigger.closest<HTMLElement>(".select-box-default-st");
                if (!root) return;
                const wasOpen = root.classList.contains("open");
                closeAllSelects(root);
                if (!wasOpen) root.classList.add("open");
                return;
            }

            // 3. Click outside any select-box — close all open ones.
            if (!target.closest(".select-box-default-st")) {
                closeAllSelects();
            }
        };
        document.body.addEventListener("click", onBodyClick);
        document.body.dataset.wbNxisasSelectWired = "yes";
    }
}

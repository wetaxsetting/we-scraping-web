"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { postEngineConnectionCheck } from "@/lib/api/banking";
import { installJexjsAdapter, registerActiveCertSeq } from "@/lib/nxisas/jexjs-adapter";

/**
 * Loader + facade for the Coocon NXiSAS engine.
 *
 * <p>The bundle lives at {@code /public/nxisas/} as a verbatim vendor
 * drop (see CLAUDE.md §"COOCON nxisas SCRAPING BUNDLE"). This hook owns:
 *
 * <ul>
 *   <li><b>Idempotent script-tag injection</b> — `<head>`-attached
 *       scripts in the exact order the bundle requires:
 *       jquery → json2 → platform → swfobject → web_socket →
 *       isasscaping → nxisas_v2. (Vendor also shipped a sibling
 *       `nxisas_api_v2.js` that re-declared `_v2nxisas` — same global,
 *       so loading it before `nxisas_v2.js` made it dead code.
 *       Removed from `public/nxisas/js/` during the 2026-05-21 cleanup
 *       pass; see {@link SCRIPT_LOAD_ORDER} for the live chain.)
 *       Re-mounts on the same page (Strict Mode dev double-invoke,
 *       internal navigation) reuse the existing tags.</li>
 *   <li><b>Flash transport hint</b> — {@code window.WEB_SOCKET_SWF_LOCATION}
 *       is set to {@code "/nxisas/websocket.swf"} BEFORE web_socket.js
 *       executes. Coocon's documented requirement.</li>
 *   <li><b>Ready detection</b> — resolves only once
 *       {@code window._v2nxisas} and {@code window.CooconiSASNX} are both
 *       present (defined by nxisas_v2.js and isasscaping.js respectively).</li>
 *   <li><b>Timeout</b> — defaults to 30 s; rejects with status
 *       {@code "timeout"}.</li>
 *   <li><b>Engine-not-installed CTA hook</b> — surfaces a status the
 *       page can render with links to
 *       {@code /nxisas/InstallCheck.html} and {@code /nxisas/file/NXiSAS.exe}.</li>
 * </ul>
 *
 * <p><b>What this hook does NOT do:</b> tear the engine down on unmount.
 * NXiSAS is a singleton attached to the user's local NXiSAS.exe process;
 * other pages in the same SPA session may share it. We only detach the
 * page's own callback listeners.
 *
 * <p><b>React + Coocon coexistence:</b> the bundle's jQuery lives on
 * {@code window.jQuery} for the engine ONLY — the Next.js app must not
 * import jQuery. The engine renders OTP / captcha / password modals by
 * mutating the DOM via jQuery; render them into a stable React-untouched
 * portal sibling (`<div id="nxisas-mount" />`) to avoid reconciler
 * conflicts.
 */
export type NxisasEngineStatus =
    | "loading"           // scripts are being injected
    | "probing"           // scripts loaded, calling openNxisas
    | "ready"             // engine reachable; transfers can run
    | "not_installed"     // probe resolved false / Cooconi reported uninstalled
    | "unsupported_os"    // platform.js → window.platform.os.family !== Windows
    | "timeout"           // probe didn't resolve within timeoutMs
    | "load_error";       // a script tag failed to load (network / 404 / CSP)

export type UseNxisasEngineOptions = {
    /** Set to {@code false} to skip the probe (useful for build-time
     *  static rendering / SSR — the page is "use client" so SSR is the
     *  initial render only, but this also lets tests opt out). Defaults
     *  to {@code true}. */
    enabled?: boolean;
    /** Wall-clock ceiling on the probe. Defaults to 30,000 ms. */
    timeoutMs?: number;
};

export type UseNxisasEngineState = {
    status:   NxisasEngineStatus;
    /** Vendor / version reported by the engine when loaded; null until
     *  the bundle exposes the values on {@code window.CooconiSASNX}. */
    vendor:   string | null;
    version:  string | null;
    /** Re-runs the script load + probe. Useful for the "try again"
     *  button after a timeout or install. */
    retry:    () => void;
    /** Pass-through to {@code _v2nxisas.callNxisas} — the engine's main
     *  scraping driver. Returns a Promise that resolves with the engine's
     *  raw callback payload. The caller is responsible for posting the
     *  result to {@code POST /scraping-result} (or whichever Spring intake
     *  the workflow needs); this hook never POSTs on its own.
     *
     *  <p>{@code onJob} (optional) is the engine's per-job completion hook —
     *  it maps to {@code callNxisas}'s 5th `job_callback` arg, which the
     *  bundle fires once per completed job EXCEPT the final one (the final
     *  job resolves the main callback). Used for "( done / total )"
     *  progress on multi-job phases like INVOICE_DETAIL. */
    runScraping: (
        orgObj: NxisasScrapingInput[],
        onJob?: (jobResult: unknown) => void,
    ) => Promise<unknown>;
    /** Second-and-later scrape inside ONE engine session — pass-through
     *  to {@code _v2nxisas.callNxisasWithoutOpenProcess}, the vendor
     *  entrypoint whose own comment reads "used when the NXISAS process
     *  is already open (when scraping must be called 2+ times)"
     *  ({@code nxisas_v2.js:1795-1796}). Unlike {@link runScraping} it
     *  does NOT call {@code CooconiSASNX.open(...)}, and combined with an
     *  org-obj carrying {@code nonLogin:true} it skips the LOGIN job and
     *  runs the jobs straight on the session a previous
     *  {@code nonLogout:true} scrape left logged in
     *  ({@code nxisas_v2.js:1839-1854}).
     *
     *  <p>Refactor port of the legacy {@code trns_0001.runScraping}
     *  {@code runScrapingJob} branch ({@code trns_0001_007.ts:77-83}).
     *  Calling {@link runScraping} a second time instead re-opens the
     *  engine and re-issues LOGIN against a bank site that is still
     *  authenticated, which Vietcom answers with {@code 80002F31} "the
     *  financial institution's webpage was modified" — the 2026-08-18
     *  Own Account Transfer defect (Update Balance → Next).
     *
     *  <p>Falls back to the opening entrypoint on bundle drops that don't
     *  ship the function, so an older vendor drop degrades to the previous
     *  behaviour instead of throwing. */
    runScrapingWithoutOpen: (
        orgObj: NxisasScrapingInput[],
        onJob?: (jobResult: unknown) => void,
    ) => Promise<unknown>;
    /**
     * Explicit engine LOGOUT on the CURRENTLY-OPEN session — the refactor
     * port of legacy {@code _v2nxisas.execute([makeHeader(bankCd,'0',
     * 'LOGOUT')], …)} (`nxisas_einvoice.js:1717-1726, :2023-2032`). Scrape
     * flows that keep the session alive with {@code nonLogout:true} MUST
     * call this after the last job to avoid an orphaned GDT session (D1).
     *
     * <p><b>Best-effort by contract:</b> resolves (never rejects) — on
     * success, on the engine's failure callback, on a 10 s safety timeout,
     * and immediately as a no-op when the bundle isn't present
     * (localhost / OQ-S1) or is an older drop without
     * {@code makeHeader}/{@code execute}. It never performs a login, and
     * logs only sanitized context — never credentials / UID / Action.
     */
    runLogout: (bankCd: string) => Promise<void>;
};

/** Shape of an entry in the `orgObj` array `_v2nxisas.callNxisas`
 *  consumes. Matches the legacy {@code trns_0001_001_v001.ts} call
 *  sites — extend as new fields surface. */
export type NxisasScrapingInput = {
    bankCd:         string;
    /** Job name the engine drives — e.g. {@code "TRANSFER"} /
     *  {@code "TRANSFER_INTERNAL"} / {@code "BALANCE"}. The page picks
     *  the right job based on the composer's `transferType`. */
    job:            Array<{ Job: string; [extra: string]: unknown }>;
    [extra: string]: unknown;
};

/** Minimal typing for the globals the bundle exposes. Declared in a
 *  global block so the hook can call them without `as any`. The full
 *  Coocon API surface is intentionally NOT typed — we treat the bundle
 *  as opaque vendor code. */
declare global {
    interface Window {
        _v2nxisas?: {
            loadedNxisas: boolean;
            openNxisas: (callback: (ok: boolean) => void) => void;
            callNxisas: (
                obj: NxisasScrapingInput[],
                progress: boolean,
                callback?: (res: unknown) => void,
                unitCallback?: (res: unknown, threadIndex: number) => void,
                jobCallback?: (res: unknown) => void,
            ) => void;
            /** Same signature as {@link callNxisas} minus the
             *  {@code CooconiSASNX.open} handshake — for the 2nd..nth
             *  scrape inside one already-open engine session
             *  ({@code nxisas_v2.js:1796}). Optional: absent on older
             *  bundle drops. */
            callNxisasWithoutOpenProcess?: (
                obj: NxisasScrapingInput[],
                progress: boolean,
                callback?: (res: unknown) => void,
                unitCallback?: (res: unknown, threadIndex: number) => void,
                jobCallback?: (res: unknown) => void,
            ) => void;
            /** Vendor header factory — {@code makeHeader(bankCd, seqno,
             *  job)} → a job header the engine's {@code execute} consumes.
             *  Optional: absent on older/partial bundle drops. */
            makeHeader?: (
                bankCd: string,
                seqno: string,
                job: string,
            ) => { Input?: unknown; [extra: string]: unknown };
            /** Vendor job runner on the current session — used for the
             *  explicit LOGOUT (D1). Optional for the same reason. */
            execute?: (
                headers: Array<Record<string, unknown>>,
                threadIndex: number,
                onSuccess?: (res: unknown, seq: number) => void,
                onFail?: (res: unknown, seq: number) => void,
            ) => void;
            /** Vendor abort-all — used by the modal's Stop/Cancel path. */
            stopAllNxisas?: (cb: () => void) => void;
        };
        CooconiSASNX?: {
            Version?: string;
            Vendor?:  string;
            [key: string]: unknown;
        };
        WEB_SOCKET_SWF_LOCATION?: string;
        platform?: { os?: { family?: string } };
        /** `tmsComm` / `jexjs` / `_isOsmc` are owned by
         *  `lib/nxisas/jexjs-adapter.ts` which augments the same
         *  global Window interface — no duplicate declarations here. */
    }
}

/**
 * Vendor-fixed load order. Changing the order will desync the bundle's
 * internal dependency assumptions (e.g. nxisas_v2 expects jQuery to be
 * present on `window` before parse-time) and will produce
 * "X is not defined" runtime errors.
 */
// `nxisas_api_v2.js` is intentionally NOT in the chain. Both
// `nxisas_api_v2.js` and `nxisas_v2.js` declared `_v2nxisas = {...}`
// at top level — loaded sequentially the second one REPLACED the
// first (object assignment, not merge), so `nxisas_api_v2.js` was
// dead code in the original chain. Removed from the chain in the
// 2026-05-20 MR, then the file itself was deleted from
// `public/nxisas/js/` in the 2026-05-21 cleanup pass.
// Net effect: ~34 jexjs symbol references shaved + one bundle
// round-trip avoided. If a future vendor drop re-ships an API-v2
// variant, prefer adding it under a separate global rather than
// shadowing `_v2nxisas`.
const SCRIPT_LOAD_ORDER: ReadonlyArray<string> = [
    "/nxisas/js/jquery-3.3.1.min.js",
    "/nxisas/js/json2.js",
    "/nxisas/js/platform.js",
    "/nxisas/js/swfobject.js",
    "/nxisas/js/web_socket.js",
    "/nxisas/js/isasscaping.js",
    "/nxisas/js/nxisas_v2.js",
    // NOTE: nxisas_api.js is intentionally NOT loaded here. It is the
    // legacy JSP-routed scraping fork and is kept only as a behavior
    // reference (under wecms-web/docs/references/legacy/). Loading it
    // would shadow the active window._v2nxisas defined by nxisas_v2.js
    // (both forks do a bare `_v2nxisas = {...}` assignment, last-load-wins)
    // and break the EXE/local-engine flow. API scraping pages use the
    // Spring REST path (BankScrapingService / BankTransactionSyncService),
    // not this bundle.
];

const SWF_LOCATION       = "/nxisas/websocket.swf";
const DEFAULT_TIMEOUT_MS = 30_000;

/** Marker attribute on `<script>` tags this loader inserts, so a second
 *  mount can detect "already injected" without re-fetching. */
const SCRIPT_MARK_ATTR = "data-wb-nxisas-src";

/**
 * Inject the bundle scripts in order, resolving when the last one's
 * `load` event fires (or rejecting on `error`). Safe to call multiple
 * times — already-injected tags short-circuit immediately.
 */
function loadBundleSequentially(): Promise<void> {
    // Set the Flash hint once, before web_socket.js may execute.
    if (typeof window !== "undefined" && !window.WEB_SOCKET_SWF_LOCATION) {
        window.WEB_SOCKET_SWF_LOCATION = SWF_LOCATION;
    }
    // Install the JEX compatibility adapter BEFORE the bundle scripts
    // load. The adapter wires `window.jexjs` / `window._isOsmc` /
    // `window.tmsComm` — every legacy global the bundle reaches for.
    // Without it the bundle throws on its first `jexjs.empty(...)`
    // call inside `makeHeader`. See `lib/nxisas/jexjs-adapter.ts`
    // for the full mapping (Spring REST routing table + static
    // bank profile map + no-op progress-bar shim).
    installJexjsAdapter();

    const loadOne = (src: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>(
                `script[${SCRIPT_MARK_ATTR}="${src}"]`,
            );
            if (existing && existing.dataset.wbNxisasLoaded === "yes") {
                resolve();
                return;
            }
            if (existing) {
                existing.addEventListener("load", () => resolve(), { once: true });
                existing.addEventListener(
                    "error",
                    () => reject(new Error(`nxisas script failed to load: ${src}`)),
                    { once: true },
                );
                return;
            }
            const tag = document.createElement("script");
            tag.src   = src;
            tag.async = false;            // preserve load order
            tag.setAttribute(SCRIPT_MARK_ATTR, src);
            tag.addEventListener(
                "load",
                () => {
                    tag.dataset.wbNxisasLoaded = "yes";
                    resolve();
                },
                { once: true },
            );
            tag.addEventListener(
                "error",
                () => reject(new Error(`nxisas script failed to load: ${src}`)),
                { once: true },
            );
            document.head.appendChild(tag);
        });
    };

    return SCRIPT_LOAD_ORDER.reduce<Promise<void>>(
        (chain, src) => chain.then(() => loadOne(src)),
        Promise.resolve(),
    );
}

/** Detect non-Windows up front. Vendor's `_v2nxisas.openNxisas` already
 *  surfaces an in-DOM dialog for non-Windows; we want to surface our
 *  own typography-compliant React banner instead, so we check before
 *  calling the engine. */
function isWindows(): boolean {
    if (typeof window === "undefined") return false;
    const family = window.platform?.os?.family;
    if (typeof family === "string") return /windows/i.test(family);
    // Fallback when platform.js hasn't initialised yet.
    return /windows/i.test(navigator.userAgent);
}

export function useNxisasEngine(opts: UseNxisasEngineOptions = {}): UseNxisasEngineState {
    const enabled   = opts.enabled !== false;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const [status,  setStatus]  = useState<NxisasEngineStatus>(enabled ? "loading" : "loading");
    const [vendor,  setVendor]  = useState<string | null>(null);
    const [version, setVersion] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    // Track mounted state so callbacks fired by the bundle after
    // unmount don't call setState (React would warn).
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;

        /**
         * Fire-and-forget audit POST to the backend's
         * {@code POST /engine-connection-check} sink. Per OQ-4
         * (PO 2026-05-18) every engine handshake — success AND failure
         * — leaves a compliance trail. The audit row IS the artifact;
         * the endpoint returns 204 No Content. Failures must NOT
         * surface to the user — wrap in `.catch(...)` and only warn
         * to the console.
         */
        const reportEngineCheck = (
            result: "OK" | "FAIL" | "TIMEOUT" | "NOT_INSTALLED",
            extras: { errorCode?: string; errorMessage?: string } = {},
        ): void => {
            if (cancelled || !mountedRef.current) return;
            const cap = (typeof window !== "undefined" ? window.CooconiSASNX : null) ?? null;
            postEngineConnectionCheck({
                result,
                engine_vendor:  cap?.Vendor  ?? "COCON",
                engine_version: cap?.Version ?? "unknown",
                user_agent:     typeof navigator !== "undefined" ? navigator.userAgent : null,
                os_platform:    typeof navigator !== "undefined" ? navigator.platform  : null,
                error_code:     extras.errorCode    ?? null,
                error_message:  extras.errorMessage ?? null,
            }).catch((err) => {
                // Audit failures are non-fatal for the user — the row
                // exists for compliance, not for UX. Surface nothing.
                console.warn("[own-account-transfer] engine-check audit POST failed", err);
            });
        };

        const probe = async () => {
            if (typeof window === "undefined") return;
            if (!isWindows()) {
                if (!cancelled && mountedRef.current) setStatus("unsupported_os");
                // Non-Windows is a probe outcome too — record as a
                // "not installed" event so the audit trail covers
                // the case (it's the closest legitimate bucket; the
                // server-side enum doesn't have UNSUPPORTED_OS).
                reportEngineCheck("NOT_INSTALLED", {
                    errorCode:    "UNSUPPORTED_OS",
                    errorMessage: navigator?.platform ?? "non-Windows",
                });
                return;
            }
            setStatus("loading");
            try {
                await loadBundleSequentially();
            } catch (err) {
                if (!cancelled && mountedRef.current) {
                    setStatus("load_error");
                    console.warn("[own-account-transfer] nxisas bundle load failed", err);
                    reportEngineCheck("FAIL", {
                        errorCode:    "BUNDLE_LOAD_FAILED",
                        errorMessage: err instanceof Error ? err.message : String(err),
                    });
                }
                return;
            }
            if (cancelled || !mountedRef.current) return;
            setStatus("probing");

            const cap = window.CooconiSASNX ?? null;
            if (cap && (cap.Vendor || cap.Version)) {
                setVendor(cap.Vendor ?? null);
                setVersion(cap.Version ?? null);
            }

            const v2 = window._v2nxisas;
            if (!v2 || typeof v2.openNxisas !== "function") {
                if (!cancelled && mountedRef.current) {
                    setStatus("load_error");
                    reportEngineCheck("FAIL", {
                        errorCode:    "OPEN_NXISAS_MISSING",
                        errorMessage: "_v2nxisas.openNxisas is not a function after bundle load",
                    });
                }
                return;
            }

            let timer: ReturnType<typeof setTimeout> | null = null;
            let settled = false;
            const settle = (next: NxisasEngineStatus) => {
                if (settled) return;
                settled = true;
                if (timer) clearTimeout(timer);
                if (!cancelled && mountedRef.current) setStatus(next);
                // Report each terminal probe outcome exactly once.
                // The `ready` / `not_installed` / `timeout` mapping
                // mirrors the backend enum exactly.
                if (next === "ready")          reportEngineCheck("OK");
                else if (next === "timeout")   reportEngineCheck("TIMEOUT");
                else if (next === "not_installed") reportEngineCheck("NOT_INSTALLED");
                else if (next === "load_error") reportEngineCheck("FAIL", {
                    errorCode: "OPEN_NXISAS_THREW",
                });
            };

            timer = setTimeout(() => settle("timeout"), timeoutMs);

            try {
                v2.openNxisas((ok: boolean) => {
                    // Capture vendor/version a second time — the bundle
                    // populates CooconiSASNX during openNxisas's resolve
                    // path, not at parse time.
                    const cap2 = window.CooconiSASNX ?? null;
                    if (cap2 && mountedRef.current && !cancelled) {
                        if (cap2.Vendor)  setVendor(cap2.Vendor);
                        if (cap2.Version) setVersion(cap2.Version);
                    }
                    settle(ok ? "ready" : "not_installed");
                });
            } catch (err) {
                console.warn("[own-account-transfer] openNxisas threw", err);
                settle("load_error");
            }
        };

        void probe();
        return () => {
            cancelled = true;
        };
    }, [enabled, reloadKey, timeoutMs]);

    const retry = useCallback(() => {
        setReloadKey((n) => n + 1);
    }, []);

    /**
     * Shared driver behind {@link UseNxisasEngineState.runScraping} and
     * {@link UseNxisasEngineState.runScrapingWithoutOpen}.
     * {@code reuseSession} picks the vendor entrypoint: {@code false} →
     * {@code callNxisas} (opens the engine, then LOGIN); {@code true} →
     * {@code callNxisasWithoutOpenProcess} (no open — runs on the session
     * a prior {@code nonLogout:true} scrape left alive).
     */
    const driveScraping = useCallback(
        (
            orgObj: NxisasScrapingInput[],
            onJob: ((jobResult: unknown) => void) | undefined,
            reuseSession: boolean,
        ) =>
            new Promise<unknown>((resolve, reject) => {
                if (typeof window === "undefined" || !window._v2nxisas) {
                    reject(new Error("nxisas engine is not loaded"));
                    return;
                }
                const v2 = window._v2nxisas;
                const guard = <T,>(fn: (res: T) => void) => (res: T) => {
                    if (!mountedRef.current) return;
                    fn(res);
                };
                // Older bundle drops ship no `callNxisasWithoutOpenProcess`
                // — degrade to the opening entrypoint rather than throw.
                const call = reuseSession && typeof v2.callNxisasWithoutOpenProcess === "function"
                    ? v2.callNxisasWithoutOpenProcess.bind(v2)
                    : v2.callNxisas.bind(v2);
                try {
                    call(
                        orgObj,
                        true,
                        guard((res: unknown) => resolve(res)),
                        undefined,
                        // Per-job progress (`job_callback`): fires per completed
                        // job except the last. Optional — only wired when the
                        // caller needs incremental "( done / total )" progress.
                        onJob ? guard((res: unknown) => onJob(res)) : undefined,
                    );
                } catch (err) {
                    reject(err);
                }
            }),
        [],
    );

    const runScraping = useCallback<UseNxisasEngineState["runScraping"]>(
        (orgObj, onJob) => driveScraping(orgObj, onJob, false),
        [driveScraping],
    );

    const runScrapingWithoutOpen = useCallback<UseNxisasEngineState["runScrapingWithoutOpen"]>(
        (orgObj, onJob) => driveScraping(orgObj, onJob, true),
        [driveScraping],
    );

    const runLogout = useCallback<UseNxisasEngineState["runLogout"]>(
        (bankCd) =>
            new Promise<void>((resolve) => {
                if (typeof window === "undefined") {
                    resolve();
                    return;
                }
                const v2 = window._v2nxisas;
                // Engine absent (localhost / OQ-S1) or an older bundle drop
                // without the header/execute pair → best-effort no-op.
                if (
                    !v2 ||
                    typeof v2.makeHeader !== "function" ||
                    typeof v2.execute !== "function"
                ) {
                    resolve();
                    return;
                }
                let done = false;
                const finish = () => {
                    if (done) return;
                    done = true;
                    resolve();
                };
                try {
                    // Legacy parity: makeHeader(bankCd,'0','LOGOUT') + empty
                    // Input, run on the current session via execute — no
                    // re-login. Resolve on BOTH callbacks (logout failure is
                    // non-fatal and must not surface).
                    const header = v2.makeHeader(bankCd, "0", "LOGOUT");
                    header.Input = {};
                    v2.execute([header], 0, () => finish(), () => finish());
                    // Safety net: never let a silent engine hang the caller's
                    // finally. 10 s mirrors the engine's own timeout budget.
                    setTimeout(finish, 10_000);
                } catch (err) {
                    // Sanitized only — never log credentials / UID / Action.
                    console.warn(
                        "[nxisas] GDT logout failed (non-fatal)",
                        err instanceof Error ? err.message : String(err),
                    );
                    finish();
                }
            }),
        [],
    );

    return useMemo(
        () => ({
            status, vendor, version, retry,
            runScraping, runScrapingWithoutOpen, runLogout,
        }),
        [status, vendor, version, retry, runScraping, runScrapingWithoutOpen, runLogout],
    );
}

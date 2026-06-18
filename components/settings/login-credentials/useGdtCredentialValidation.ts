"use client";

import { useCallback, useState } from "react";

import {
    useNxisasEngine,
    type NxisasEngineStatus,
} from "@/components/banking/own-account-transfer/hooks/use-nxisas-engine";
import { fetchGdtEngineConfig } from "@/lib/api/loginCredentials";
import {
    buildGdtValidationInput,
    extractGdtValidationOutcome,
    type GdtValidationOutcome,
} from "@/lib/nxisas/gdtCredentialValidate";
import { setGdtNxisasProfile } from "@/lib/nxisas/jexjs-adapter";

/**
 * Fetch the GDT engine config (api_id / module / class) from the refactor
 * backend ONCE per session and install the module/class into the local
 * engine adapter — the JexAdmin/OSMC replacement. Cached so a transient
 * failure can be retried; on failure the adapter keeps its legacy-value
 * defaults so the login test still works.
 */
let gdtEngineConfigPromise: Promise<void> | null = null;
function ensureGdtEngineConfig(): Promise<void> {
    if (!gdtEngineConfigPromise) {
        gdtEngineConfigPromise = fetchGdtEngineConfig()
            .then((cfg) => {
                setGdtNxisasProfile(cfg.scrapping_module, cfg.scrapping_class);
            })
            .catch(() => {
                // Endpoint unreachable → keep the adapter's legacy-value
                // defaults. Reset so a later attempt can re-fetch.
                gdtEngineConfigPromise = null;
            });
    }
    return gdtEngineConfigPromise;
}

/**
 * Drives a GDT (Vietnam tax-portal) credential validation against the
 * LOCAL NXiSAS engine before the Settings > Login Credentials GDT row is
 * saved — legacy-parity port of `comm_0218_007.js` (Bank uses the Coocon
 * server gateway; GDT uses the local engine `.exe`, never Coocon).
 *
 * <p>Thin wrapper over {@link useNxisasEngine} (loader + status + the
 * `runScraping` facade): `validate()` runs a login-only `VIETNAM_GDT`
 * scrape and returns the parsed outcome. The engine renders its own
 * CAPTCHA modal and runs the 3-try loop internally during `runScraping`,
 * which resolves only at a terminal outcome — so the caller just awaits
 * and branches (success → persist; failure / CAPTCHA-exceeded → error,
 * no save).
 *
 * <p>No backend Coocon API is called. The GDT engine module
 * (`GLOBAL/VNM/PUBLIC_GDT`) is resolved client-side by the jexjs adapter.
 *
 * @param enabled gate the engine load + probe — pass `true` only while the
 *                GDT dialog is open so the bundle isn't loaded for every
 *                Login Credentials visit (mirrors `useEInvoiceScrape`).
 */
export type UseGdtCredentialValidationState = {
    /** Engine readiness — the caller gates the save on `=== "ready"` and
     *  surfaces an install / unsupported-OS prompt otherwise. */
    engineStatus: NxisasEngineStatus;
    /** Re-run the engine load + probe (after install / timeout). */
    retryEngine: () => void;
    /** True while a validation round-trip is in flight. */
    validating: boolean;
    /** Run the local-engine GDT login test. Resolves with the outcome;
     *  rejects only on an engine/transport fault (caller routes that to a
     *  system error dialog). NEVER persists — the caller does that on
     *  {@code outcome.ok}. */
    validate: (loginId: string, password: string) => Promise<GdtValidationOutcome>;
};

export function useGdtCredentialValidation(
    enabled: boolean,
): UseGdtCredentialValidationState {
    const { status, retry, runScraping } = useNxisasEngine({ enabled });
    const [validating, setValidating] = useState(false);

    const validate = useCallback(
        async (loginId: string, password: string): Promise<GdtValidationOutcome> => {
            setValidating(true);
            try {
                // Install the config-sourced GDT module/class first (JexAdmin/
                // OSMC replacement); on failure the adapter keeps legacy defaults.
                await ensureGdtEngineConfig();
                const raw = await runScraping(buildGdtValidationInput(loginId, password));
                return extractGdtValidationOutcome(raw);
            } finally {
                setValidating(false);
            }
        },
        [runScraping],
    );

    return { engineStatus: status, retryEngine: retry, validating, validate };
}

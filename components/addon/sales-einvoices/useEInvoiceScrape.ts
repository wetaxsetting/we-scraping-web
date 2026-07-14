"use client";

import { useCallback, useState } from "react";

import {
    useNxisasEngine,
    type NxisasEngineStatus,
} from "@/components/banking/own-account-transfer/hooks/use-nxisas-engine";
import {
    scrapeEInvoices,
    scrapeEInvoiceDetails,
    decryptEInvoiceEngineData,
} from "@/lib/api/addon";
import {
    buildInvoiceListInputs,
    buildInvoiceDetailInputs,
    buildRegistrationDetailInputs,
    extractScrapedInvoices,
    extractScrapedDetails,
    extractRegistrationDetails,
    applyRegistrationEnrichment,
    blankSellerTaxCodes,
    GDT_BANK_CD,
    type EInvoiceScrapeCert,
    type EInvoiceScrapeOutcome,
    type EInvoiceDetailOutcome,
} from "@/lib/nxisas/einvoiceScrape";
import type {
    ApiEInvoiceScrapeResult,
    ApiEInvoiceScrapeDetailResult,
} from "@/lib/types/api";

/**
 * Drives the e-Invoice "Update" (scrape) flow against the LOCAL NXiSAS
 * engine — full two-phase refactor port of legacy `nxisas_einvoice.js`
 * `scrapingProcess` + `runDetailScrapping3/4`.
 *
 * <p><b>Phase 1 — INVOICE_LIST.</b> One engine call. Sales submits one
 * job; Expenses submits three buckets (C / K / POS). The decrypted
 * invoice rows are POSTed to {@code /scrape-results} (legacy
 * {@code nxisas_einvoice_c001} — upserts {@code BUSA_DOC_MSTR} +
 * audit row).
 *
 * <p><b>Phase 2 — INVOICE_DETAIL.</b> When phase 1 returned rows, a
 * second engine call ({@code nonLogin:true}, reusing the session) pulls
 * the per-invoice detail; the line items / fees / taxes are POSTed to
 * {@code /scrape-detail-results} (legacy {@code nxisas_einvoice_c002} —
 * enriches the master + upserts {@code BUSA_DOC_DETL} /
 * {@code EINV_FEE_DETL} / {@code EINV_TAX_DETL}).
 *
 * <p><b>Login-failure parity:</b> when phase 1 returns only auth jobs
 * (LOGIN / CAPTCHA / OTP / QNA), no save runs — mirrors legacy
 * {@code nxisas_einvoice.js:406-452}. The GDT captcha 3-try guard
 * (`WBE6121`) is surfaced via {@link EInvoiceScrapeRunResult.captchaExceeded}.
 *
 * <p><b>Runtime caveat (OQ-S1):</b> the engine is licensed per page
 * origin and is NOT licensed on `localhost`, so the live scrape cannot be
 * exercised in R&D — the wiring is built to legacy parity and typed/built,
 * but verified end-to-end only on a licensed origin (e.g. `wecms.kosign.dev`).
 */
export type EInvoiceScrapeRunParams = {
    cert: EInvoiceScrapeCert;
    type: "SALES" | "EXPENSE";
    /** YYYYMMDD. */
    fromDt: string;
    /** YYYYMMDD. */
    toDt: string;
    /** Optional progress callback (0..100) — mirrors the legacy
     *  `.process-bar > progress` steps (25 → 35 → 50 → 100). */
    onProgress?: (pct: number) => void;
    /** Optional per-invoice detail progress — `(done, total)`. Mirrors the
     *  legacy "In Progress ( 9 / 10 )" counter shown during the
     *  INVOICE_DETAIL phase (fires as each invoice's detail completes). */
    onDetailProgress?: (done: number, total: number) => void;
};

export type EInvoiceScrapeRunResult = {
    outcome: EInvoiceScrapeOutcome;
    /** Phase-1 list save result; null when phase 1 was a login failure
     *  (no save performed — legacy parity). */
    saved: ApiEInvoiceScrapeResult | null;
    /** Phase-2 detail outcome; null when there were no rows to detail. */
    detailOutcome: EInvoiceDetailOutcome | null;
    /** Phase-2 detail save result; null when phase 2 did not run. */
    detailSaved: ApiEInvoiceScrapeDetailResult | null;
    /** GDT captcha entered wrong 3+ times — legacy `WBE6121`. */
    captchaExceeded: boolean;
};

export type UseEInvoiceScrapeState = {
    /** Engine readiness — gate the CTA + show the install prompt. */
    engineStatus: NxisasEngineStatus;
    /** Re-run the engine load + probe (after install / timeout). */
    retryEngine: () => void;
    /** True while a scrape + intake round-trip is in flight. */
    scraping: boolean;
    /** Run a two-phase scrape and persist the results. Throws on engine /
     *  network failure so the caller can route it to a system dialog. */
    run: (params: EInvoiceScrapeRunParams) => Promise<EInvoiceScrapeRunResult>;
};

/** Read the engine's GDT captcha try counter (legacy
 *  `_v2nxisas._GDTCaptchaTryCount`) defensively. */
function gdtCaptchaTryCount(): number {
    if (typeof window === "undefined") return 0;
    const v2 = (window as unknown as { _v2nxisas?: { _GDTCaptchaTryCount?: number } })._v2nxisas;
    const n = v2?._GDTCaptchaTryCount;
    return typeof n === "number" ? n : 0;
}

/** Read the current engine session id + action off `CooconiSASNX`
 *  (legacy `CooconiSASNX.OpenUid` / `OpenAction`). These feed the SEED-CBC
 *  key/IV for the server-side decrypt. Blank when the engine hasn't opened
 *  a session (the backend then falls back to the fixed-key cipher). */
function engineSession(): { uid: string; action: string } {
    if (typeof window === "undefined") return { uid: "", action: "" };
    const cap = (window as unknown as {
        CooconiSASNX?: { OpenUid?: unknown; OpenAction?: unknown };
    }).CooconiSASNX;
    const uid = typeof cap?.OpenUid === "string" ? cap.OpenUid : "";
    const action = typeof cap?.OpenAction === "string" ? cap.OpenAction : "";
    return { uid, action };
}

/** Run one engine phase and decrypt its callback server-side before the
 *  caller parses it. Mirrors legacy's `nonDecrypt:true` + server
 *  `nxisas_decrypt` round-trip (OQ-S2, resolved 2026-07-14). */
async function decryptEngineCallback(raw: unknown): Promise<unknown> {
    const { uid, action } = engineSession();
    return decryptEInvoiceEngineData(raw, uid, action);
}

export function useEInvoiceScrape(enabled: boolean): UseEInvoiceScrapeState {
    const { status, retry, runScraping, runLogout } = useNxisasEngine({ enabled });
    const [scraping, setScraping] = useState(false);

    const run = useCallback(
        async ({
            cert,
            type,
            fromDt,
            toDt,
            onProgress,
            onDetailProgress,
        }: EInvoiceScrapeRunParams): Promise<EInvoiceScrapeRunResult> => {
            setScraping(true);
            // D1 — tracks whether phase-1 LOGIN opened a GDT session that
            // must be explicitly closed in `finally`. Stays false on a login
            // failure — legacy issues no LOGOUT there either.
            let sessionOpened = false;
            try {
                // ── Phase 1 — INVOICE_LIST ──────────────────────────────
                const listInput = buildInvoiceListInputs(cert, type, fromDt, toDt);
                const listRaw = await runScraping(listInput);
                onProgress?.(25);
                // Decrypt the engine `Output.Result` server-side before
                // parsing (legacy parity — the engine returns SEED-CBC
                // ciphertext; OQ-S2 resolved 2026-07-14).
                const listDecrypted = await decryptEngineCallback(listRaw);
                const outcome = extractScrapedInvoices(listDecrypted, type);
                const captchaExceeded = gdtCaptchaTryCount() >= 3;

                // Login-failure branch — no save, no detail (legacy:406).
                if (outcome.loginFailed) {
                    onProgress?.(100);
                    return {
                        outcome,
                        saved: null,
                        detailOutcome: null,
                        detailSaved: null,
                        captchaExceeded,
                    };
                }

                // LOGIN succeeded → the session is held open (nonLogout:true)
                // through phase 2; `finally` must log it out (D1).
                sessionOpened = true;

                // Phase-1 save — always posts (even an empty list / per-row
                // error) so EXT_TRAN_CALL_HIS records the call (legacy parity).
                const saved = await scrapeEInvoices({
                    type,
                    from_dt: fromDt,
                    to_dt: toDt,
                    rslt_cd: outcome.rsltCd,
                    rslt_msg: outcome.rsltMsg || undefined,
                    engine_vendor: "NXiSAS",
                    invoices: outcome.invoices,
                });
                onProgress?.(35);

                // ── Phase 2 — INVOICE_DETAIL ────────────────────────────
                let detailOutcome: EInvoiceDetailOutcome | null = null;
                let detailSaved: ApiEInvoiceScrapeDetailResult | null = null;

                const detailInput = buildInvoiceDetailInputs(
                    type,
                    outcome.invoices,
                    fromDt,
                    toDt,
                );
                if (detailInput.length > 0) {
                    onProgress?.(50);
                    // Per-invoice detail progress (legacy "( 9 / 10 )"): total
                    // = listed invoices; the engine fires job_callback as each
                    // invoice's detail completes (all but the last), and the
                    // final one lands when runScraping resolves.
                    const detailTotal = outcome.invoices.length;
                    let detailDone = 0;
                    onDetailProgress?.(0, detailTotal);
                    const detailRaw = await runScraping(detailInput, () => {
                        detailDone = Math.min(detailDone + 1, detailTotal);
                        onDetailProgress?.(detailDone, detailTotal);
                    });
                    onDetailProgress?.(detailTotal, detailTotal);
                    const detailDecrypted = await decryptEngineCallback(detailRaw);
                    detailOutcome = extractScrapedDetails(detailDecrypted, outcome.invoices);

                    // D3 (Expense only — legacy runDetailScrapping3): when a
                    // seller name came back blank, look it up via the GDT
                    // BUSSINESS_REGISTRATION_DETAIL job (reusing the phase-1
                    // session, nonLogin) and merge company / representative /
                    // person-in-charge into the rows before persisting. Sales
                    // (runDetailScrapping4) does NOT do this.
                    if (type === "EXPENSE") {
                        const regInput = buildRegistrationDetailInputs(
                            blankSellerTaxCodes(detailOutcome.details),
                        );
                        if (regInput.length > 0) {
                            const regRaw = await runScraping(regInput);
                            const regDecrypted = await decryptEngineCallback(regRaw);
                            applyRegistrationEnrichment(
                                detailOutcome.details,
                                extractRegistrationDetails(regDecrypted),
                            );
                        }
                    }

                    detailSaved = await scrapeEInvoiceDetails({
                        type,
                        from_dt: fromDt,
                        to_dt: toDt,
                        rslt_cd: detailOutcome.rsltCd,
                        rslt_msg: detailOutcome.rsltMsg || undefined,
                        // Forward the phase-1 batch timestamp so the backend
                        // stamps the SAME MOD_DTM onto the enriched masters
                        // (batch-linking fix, 2026-07-14) — the modal "View"
                        // then reliably selects this exact inquiry's rows.
                        mod_dtm: saved.mod_dtm || undefined,
                        details: detailOutcome.details,
                    });
                }
                onProgress?.(100);

                return { outcome, saved, detailOutcome, detailSaved, captchaExceeded };
            } finally {
                // D1 — explicit GDT LOGOUT on the session opened by phase-1
                // LOGIN (legacy `logoutFunction`), before releasing the UI.
                // Runs for EVERY post-LOGIN exit — success, no-data, list /
                // detail business error, detail-persistence failure, and any
                // thrown exception — but is skipped on a login failure (no
                // session). Best-effort: `runLogout` swallows all failures so
                // the original inquiry result / error is never hidden, and it
                // fires exactly once per run().
                if (sessionOpened) {
                    try {
                        await runLogout(GDT_BANK_CD);
                    } catch {
                        // Defence-in-depth: `runLogout` resolves by contract,
                        // but even a future reject must never mask the
                        // inquiry's own result or error.
                    }
                }
                setScraping(false);
            }
        },
        [runScraping, runLogout],
    );

    return { engineStatus: status, retryEngine: retry, scraping, run };
}

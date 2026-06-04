"use client";

import { useCallback, useState } from "react";

import {
    useNxisasEngine,
    type NxisasEngineStatus,
} from "@/components/banking/own-account-transfer/hooks/use-nxisas-engine";
import { scrapeEInvoices, scrapeEInvoiceDetails } from "@/lib/api/addon";
import {
    buildInvoiceListInputs,
    buildInvoiceDetailInputs,
    extractScrapedInvoices,
    extractScrapedDetails,
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

export function useEInvoiceScrape(enabled: boolean): UseEInvoiceScrapeState {
    const { status, retry, runScraping } = useNxisasEngine({ enabled });
    const [scraping, setScraping] = useState(false);

    const run = useCallback(
        async ({
            cert,
            type,
            fromDt,
            toDt,
            onProgress,
        }: EInvoiceScrapeRunParams): Promise<EInvoiceScrapeRunResult> => {
            setScraping(true);
            try {
                // ── Phase 1 — INVOICE_LIST ──────────────────────────────
                const listInput = buildInvoiceListInputs(cert, type, fromDt, toDt);
                const listRaw = await runScraping(listInput);
                onProgress?.(25);
                const outcome = extractScrapedInvoices(listRaw, type);
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
                    const detailRaw = await runScraping(detailInput);
                    detailOutcome = extractScrapedDetails(detailRaw, outcome.invoices);
                    detailSaved = await scrapeEInvoiceDetails({
                        type,
                        from_dt: fromDt,
                        to_dt: toDt,
                        rslt_cd: detailOutcome.rsltCd,
                        rslt_msg: detailOutcome.rsltMsg || undefined,
                        details: detailOutcome.details,
                    });
                }
                onProgress?.(100);

                return { outcome, saved, detailOutcome, detailSaved, captchaExceeded };
            } finally {
                setScraping(false);
            }
        },
        [runScraping],
    );

    return { engineStatus: status, retryEngine: retry, scraping, run };
}

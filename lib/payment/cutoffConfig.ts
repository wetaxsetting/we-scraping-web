"use client";

import { api } from "@/lib/axios";
import { unwrap } from "@/lib/api/common/unwrap";
import type { ApiCutoffConfigResponse, ApiResponse } from "@/lib/types/api";

/**
 * Client-side cut-off configuration — fetched from the backend
 * ({@code GET /api/v1/payment/cutoff-config}) instead of a hard-coded table
 * (2026-07-09, PO "no hard-coding for cut-off time" directive). The backend
 * {@code application.yml} (`wecms.internal-transfer.cutoff`) is the single
 * source of truth; this module maps the wire payload into the schedule shape
 * the pre-flight check ({@link file://./validateBankingTime.ts}) consumes.
 *
 * <p><b>Safe fallback:</b> if the fetch fails (offline / auth / server), the
 * loaders return {@code null} and every caller proceeds — the backend
 * {@code CutoffValidator} is the authoritative gate, so the FE never blocks a
 * transfer on stale / missing config.
 */

/** Bank brand the schedule table is keyed on. */
export type BankKey = "SHINHAN" | "WOORI" | "VCB";

/** Transfer network (legacy ANT_DIV_CD classification). */
export type TransferType = "NAPAS" | "CITAD" | "SWIFT";

/** VCB CITAD per-transaction amount tier (legacy `classifyAmountTiers`).
 *  {@code MIXED} = the file has both ≥500M and <500M transactions. */
export type AmountTier = "ALL_SMALL" | "ALL_LARGE" | "MIXED";

/** Vietnam-local day-of-week bit set. Mon-Fri for CITAD / SWIFT, all 7
 *  days for NAPAS. Derived from the network (backend has no per-window day
 *  mask — it applies a weekend rule to every non-NAPAS network). */
export type DayMask = ReadonlySet<number>; // 0=Sun ... 6=Sat
export const WEEKDAYS: DayMask = new Set([1, 2, 3, 4, 5]);
export const ALL_DAYS: DayMask = new Set([0, 1, 2, 3, 4, 5, 6]);

/** Single banking window. {@code start} / {@code warning} / {@code end} are
 *  Vietnam-local {@code HH:mm}. {@code largeEnd} is the VCB CITAD ≥500M (H)
 *  tier cut-off — set only for VCB CITAD. */
export interface CutoffWindow {
    readonly start: string;
    readonly warning: string;
    readonly end: string;
    readonly days: DayMask;
    readonly largeEnd?: string;
}

export type CutoffSchedules = Readonly<Record<BankKey, Partial<Record<TransferType, CutoffWindow>>>>;

export interface CutoffConfig {
    readonly schedules: CutoffSchedules;
    /** VCB CITAD ≥500M tier threshold (VND); {@code null} when the server
     *  did not supply one. Exposed for amount-tier classification. */
    readonly largeTxnThreshold: number | null;
}

const BANK_KEYS: readonly BankKey[] = ["SHINHAN", "WOORI", "VCB"];

/** Map the wire payload → the schedule table the checks consume. The FE
 *  derives NAPAS/CITAD/SWIFT windows from the backend's per-network windows:
 *  NAPAS runs all days, CITAD/SWIFT weekdays; VCB's `CITAD_LARGE.end` becomes
 *  the CITAD `largeEnd`. `CITAD_API` is backend-only (the FE cannot tell API
 *  vs File-SFTP transport) and is intentionally NOT surfaced into the FE CITAD
 *  window — the backend widens Shinhan CITAD to 16:30 for VND→VND itself. */
function mapWire(wire: ApiCutoffConfigResponse): CutoffConfig {
    const schedules = {} as Record<BankKey, Partial<Record<TransferType, CutoffWindow>>>;
    for (const key of BANK_KEYS) schedules[key] = {};

    for (const bank of wire.banks ?? []) {
        const key = bank.bank_key as BankKey;
        if (!BANK_KEYS.includes(key)) continue;
        const byNet = new Map((bank.networks ?? []).map((n) => [n.network, n]));
        const napas = byNet.get("NAPAS");
        const citad = byNet.get("CITAD");
        const citadLarge = byNet.get("CITAD_LARGE");
        const swift = byNet.get("SWIFT");

        const dst: Partial<Record<TransferType, CutoffWindow>> = {};
        if (napas) {
            dst.NAPAS = { start: napas.start, warning: napas.warning ?? napas.end, end: napas.end, days: ALL_DAYS };
        }
        if (citad) {
            dst.CITAD = {
                start: citad.start,
                warning: citad.warning ?? citad.end,
                end: citad.end,
                days: WEEKDAYS,
                largeEnd: citadLarge?.end,
            };
        }
        if (swift) {
            dst.SWIFT = { start: swift.start, warning: swift.warning ?? swift.end, end: swift.end, days: WEEKDAYS };
        }
        schedules[key] = dst;
    }

    return { schedules, largeTxnThreshold: wire.large_txn_threshold ?? null };
}

let cached: CutoffConfig | null = null;
let inflight: Promise<CutoffConfig | null> | null = null;

/**
 * Offset (ms) to add to the browser clock to get the authoritative Vietnam
 * server instant: {@code serverEpoch - clientEpoch} captured when the config
 * response was received. {@code null} until a config with a {@code server_datetime}
 * has loaded. Correcting by this offset removes any client-clock skew (the
 * absolute error), while later adding the locally-elapsed time keeps ticking
 * accurately — so the cut-off decision no longer depends on a mis-set OS clock.
 * (The client's local timezone is irrelevant: a JS {@code Date}/epoch is an
 * absolute instant, and {@code Asia/Ho_Chi_Minh} conversion happens downstream.)
 */
let serverOffsetMs: number | null = null;

/**
 * Pure helper: {@code serverEpochMs - clientEpochMs}. Returns {@code null} when
 * {@code serverDatetime} is absent/unparseable so callers fall back to the
 * browser clock. Exported for tests.
 */
export function computeServerOffsetMs(
    serverDatetime: string | null | undefined,
    clientEpochMs: number,
): number | null {
    if (!serverDatetime) return null;
    const serverEpochMs = Date.parse(serverDatetime);
    if (Number.isNaN(serverEpochMs)) return null;
    return serverEpochMs - clientEpochMs;
}

/**
 * The authoritative "now" as an absolute {@link Date}: the browser clock shifted
 * by the server↔client offset. Returns {@code null} when no server time has been
 * loaded (callers then fall back to the browser clock; the backend re-validates).
 * Projection to Vietnam wall-clock time happens in the caller via
 * {@code Intl.DateTimeFormat({ timeZone: "Asia/Ho_Chi_Minh" })} — no UTC+7 math.
 */
export function getServerNow(): Date | null {
    return serverOffsetMs === null ? null : new Date(Date.now() + serverOffsetMs);
}

/**
 * Load (and memoize) the cut-off config. Returns {@code null} on any failure
 * so callers proceed and let the backend gate decide. A failed load is not
 * cached — the next call retries.
 */
export async function loadCutoffConfig(): Promise<CutoffConfig | null> {
    if (cached) return cached;
    if (inflight) return inflight;
    inflight = (async () => {
        try {
            const data = await unwrap(
                api.get<ApiResponse<ApiCutoffConfigResponse>>("/api/v1/payment/cutoff-config"),
            );
            // Capture the server↔client clock offset at the moment of receipt so
            // subsequent cut-off checks use authoritative Vietnam server time.
            serverOffsetMs = computeServerOffsetMs(data.server_datetime, Date.now());
            cached = mapWire(data);
            return cached;
        } catch {
            return null; // safe fallback — never block on missing config
        } finally {
            inflight = null;
        }
    })();
    return inflight;
}

/** Synchronously read the last successfully-loaded config, or {@code null}
 *  if it has not resolved yet. Used by the pure auto-transfer predicate
 *  (which cannot await); the orchestrator warms the cache first. */
export function getCachedCutoffConfig(): CutoffConfig | null {
    return cached;
}

/** Convenience: awaited schedules (or {@code null}). */
export async function loadCutoffSchedules(): Promise<CutoffSchedules | null> {
    const config = await loadCutoffConfig();
    return config?.schedules ?? null;
}

/** Convenience: cached schedules (or {@code null}). */
export function getCachedCutoffSchedules(): CutoffSchedules | null {
    return cached?.schedules ?? null;
}

/** Test seam — reset the module cache between test cases. */
export function __resetCutoffConfigForTests(): void {
    cached = null;
    inflight = null;
    serverOffsetMs = null;
}

"use client";

import type { DialogApi } from "@/components/shared/dialog";
import {
    getCachedCutoffSchedules,
    getServerNow,
    loadCutoffSchedules,
    type AmountTier,
    type BankKey,
    type TransferType,
} from "@/lib/payment/cutoffConfig";

// Re-export so existing consumers that import these types from here
// (autoTransferAfterApproval, page call sites) keep working after the
// schedule table moved to the config module (2026-07-09).
export type { AmountTier, TransferType } from "@/lib/payment/cutoffConfig";

/** Mirrors `useTranslation().t`'s signature. */
type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Pre-flight banking-window check for the Payment Transfer buttons
 * (Internal Transfer / Vendor / Expense / Payroll).
 *
 * <p>Full-parity port of legacy {@code _v2common.app.validateBankingTime}
 * at {@code WECMS_STATIC/web/assets_v2/add_osmc.js:8394-8572}. Same
 * Shinhan / Woori / VCB windows, same NAPAS / CITAD / SWIFT split, and —
 * critically — the same **confirm-vs-block dialog routing**:
 *
 * <ul>
 *   <li><b>Confirmation (Continue / Cancel) — proceeds on Continue:</b>
 *     <ul>
 *       <li>Shinhan past cut-off, NOT CITAD VND→VND (legacy WBC1182).</li>
 *       <li>Warning zone (warning ≤ now &lt; cut-off), all banks (legacy WBC1179).</li>
 *       <li>VCB CITAD MIXED tier between 15:30 and 16:30 — file-split (legacy WBC1187).</li>
 *     </ul></li>
 *   <li><b>Warning (OK only) — hard block:</b> weekend non-NAPAS
 *       (WBW1162), before start (WBW1166), past cut-off for Woori / VCB /
 *       other, Shinhan CITAD VND→VND, and VCB MIXED past 16:30 (WBW1165).</li>
 * </ul>
 *
 * <p>This client check mirrors the legacy FRONTEND gate; the Spring
 * backend {@code CutoffValidator} is the authoritative hard-block safety
 * net (it re-validates on dispatch and allows Shinhan / blocks the rest —
 * see {@code common/bank-cutoff-validation/bank-cutoff-validation.md}). So when the
 * user clicks <b>Continue</b> on a Shinhan past-cut-off confirmation, the
 * dispatch call succeeds because the backend also exempts Shinhan.
 *
 * <p><b>FE data-availability limits (backend remains the safety net):</b>
 * <ul>
 *   <li>The network defaults to NAPAS for VND / SWIFT for FCY when the
 *       caller does not pass {@link BankingTimeCheckInput.transferType}.
 *       CITAD windows therefore only apply when a caller knows its channel.</li>
 *   <li>Shinhan CITAD VND→VND hard-block needs {@code wdrlCcyCd}; without
 *       it the FE offers the soft confirm and the backend hard-blocks.</li>
 *   <li>VCB MIXED-tier file-split needs {@code amountTier}; without it VCB
 *       CITAD uses the base 15:30 window.</li>
 *   <li>The Shinhan CITAD-via-API 16:30 window is backend-only (the FE
 *       cannot tell API vs File-SFTP transport) — the FE uses the legacy
 *       single 15:30 CITAD window and the backend widens to 16:30.</li>
 * </ul>
 *
 * <p><b>Server time (2026-07-10):</b> the check evaluates against the
 * authoritative Vietnam server clock, not the browser clock. The cut-off
 * config response ({@code GET /api/v1/payment/cutoff-config}) carries
 * {@code server_datetime}; {@code cutoffConfig.getServerNow()} corrects the
 * browser instant by the server↔client offset (removing any mis-set-clock
 * skew) and {@code vietnamLocal(...)} projects it to {@code Asia/Ho_Chi_Minh}
 * (so the user's country / OS timezone is irrelevant). This mirrors the legacy
 * {@code comm_1006_001} server-time fetch. If the server time is unavailable
 * (config fetch failed / cold cache) the check falls back to the browser clock
 * and the backend gate — which always uses the server clock — remains
 * authoritative.
 *
 * <p>Returns {@code Promise<boolean>}: {@code true} when the caller may
 * proceed to dispatch; {@code false} when blocked or the user cancelled
 * (the helper has already shown the dialog).
 */

/** Map {@code OUT_BANK_CD} → brand. The firm out-bank codes really used on
 *  {@code SCDUL_PYMN_SUMR.OUT_BANK_CD} are 970424 / 970457 / 970436; the
 *  3-digit CITAD codes (616 / 663) are kept for parity with the legacy
 *  {@code BANK_CODE_MAP}. The backend resolves the brand authoritatively
 *  from {@code TB_FIRM_BANK_CODE.ENG_ABRVAT_NM}. (Bank→brand is a stable
 *  mapping, not a cut-off time — the cut-off windows themselves come from
 *  {@link file://./cutoffConfig.ts} / the backend, not from this file.) */
const BANK_CODE_MAP: Readonly<Record<string, BankKey>> = {
    "970424": "SHINHAN",
    "616":    "SHINHAN",
    "970457": "WOORI",
    "663":    "WOORI",
    "970436": "VCB",
};

/** Display name interpolated into the confirm messages (brand names —
 *  rendered the same across locales, as in the legacy WBC dialogs). */
const BANK_DISPLAY: Readonly<Record<BankKey, string>> = {
    SHINHAN: "Shinhan Bank",
    WOORI:   "Woori Bank",
    VCB:     "Vietcombank",
};

/** Default network when the caller doesn't pass one: VND → NAPAS (API),
 *  non-VND → SWIFT (the broader file window). Pages that know their batch
 *  routes via CITAD pass {@code transferType: "CITAD"} explicitly. */
function inferTransferType(txnCurrency: string): TransferType {
    return txnCurrency === "VND" ? "NAPAS" : "SWIFT";
}

function resolveBankKey(bankCd: string | undefined): BankKey | null {
    if (!bankCd) return null;
    return BANK_CODE_MAP[bankCd.trim()] ?? null;
}

export interface BankingTimeCheckInput {
    /** OUT_BANK_CD on the master row (e.g. {@code "970424"} for Shinhan). */
    readonly bankCd: string;
    /** Master batch (transfer) currency. Drives the default network. */
    readonly txnCurrency: string;
    /** Override the inferred network. Pass {@code "CITAD"} when the page
     *  knows the batch routes via CITAD rather than NAPAS / SWIFT. */
    readonly transferType?: TransferType;
    /** Withdrawal-account currency. Enables the Shinhan CITAD VND→VND
     *  hard-block; when omitted the backend enforces it instead. */
    readonly wdrlCcyCd?: string;
    /** VCB CITAD amount tier (per-transaction). Enables the MIXED-tier
     *  file-split confirmation; when omitted VCB CITAD uses base 15:30. */
    readonly amountTier?: AmountTier;
    /** Set by the Internal Transfer page only. When true and the source bank
     *  is VCB, the cut-off is skipped entirely (VCB-source Internal Transfer
     *  is 24/7 — legacy INTER handling + backend
     *  {@code CutoffValidator.isInternalTransferCutoffExempt}). */
    readonly internalTransfer?: boolean;
    /** Dialog API for surfacing the confirm / warning dialogs. */
    readonly dialog: DialogApi;
    /** i18n translator for dialog copy. */
    readonly t: TranslateFn;
    /** Optional clock override for tests. */
    readonly now?: Date;
}

/**
 * Run the banking-window check. See the file header for the full
 * confirm-vs-block decision tree.
 */
export async function validateBankingTime(
    input: BankingTimeCheckInput,
): Promise<boolean> {
    const { bankCd, txnCurrency, transferType, wdrlCcyCd, amountTier, internalTransfer, dialog, t, now } = input;

    const bank = resolveBankKey(bankCd);
    if (!bank) {
        // Unknown bank — defer to the backend CutoffValidator (it rejects
        // with WBE2066/7/8 if the call is genuinely out of window).
        return true;
    }

    // VCB-source Internal Transfer is 24/7 (any channel, any day) — legacy
    // `validateBankingTime` resolves(true) for INTER, and the backend
    // `CutoffValidator.isInternalTransferCutoffExempt` bypasses VCB internal
    // transfers. Only the Internal Transfer page passes internalTransfer:true.
    if (internalTransfer && bank === "VCB") {
        return true;
    }

    // Windows come from the backend config (single source of truth), not a
    // hard-coded table. If the config is unavailable, proceed — the backend
    // CutoffValidator re-validates on dispatch (never block on stale config).
    const schedules = await loadCutoffSchedules();
    if (!schedules) {
        return true;
    }
    const network = transferType ?? inferTransferType(txnCurrency);
    const sched = schedules[bank][network];
    if (!sched) {
        // No window for this (bank, network) — e.g. VCB SWIFT. Backend decides.
        return true;
    }

    // Authoritative time source: explicit test override → Vietnam server time
    // (from the cut-off config, corrected for client-clock skew) → browser clock
    // as a last resort (config without server time / cold cache). vietnamLocal
    // then projects the instant to Asia/Ho_Chi_Minh — independent of the
    // browser's own timezone.
    const vn = vietnamLocal(now ?? getServerNow() ?? new Date());
    const bankName = BANK_DISPLAY[bank];

    // 1. Working-day (weekend) hard block for non-NAPAS networks (WBW1162).
    if (!sched.days.has(vn.dayOfWeek)) {
        return showBlock(dialog, t, "payment.transfer.cutoff.weekend");
    }

    // 2. VCB CITAD amount-tier handling (file-split confirm / H-tier block).
    let cutoff = sched.end;
    if (bank === "VCB" && network === "CITAD" && sched.largeEnd) {
        const lTier = sched.end;        // <500M  → 15:30
        const hTier = sched.largeEnd;   // ≥500M  → 16:30
        if (amountTier === "MIXED") {
            if (vn.hhmm >= lTier && vn.hhmm < hTier) {
                // 15:30–16:30: offer to split the file (WBC1187). Continue proceeds.
                return showConfirm(dialog, t, "payment.transfer.cutoff.confirm_vcb_split", { end: lTier });
            }
            if (vn.hhmm >= hTier) {
                // From 16:30: hard block like the other banks (WBW1165).
                return showBlock(dialog, t, "payment.transfer.cutoff.past_end", { end: hTier });
            }
            // Before 15:30: transfer as usual on the L window.
            cutoff = lTier;
        } else {
            cutoff = amountTier === "ALL_LARGE" ? hTier : lTier;
        }
    }

    // 3. Past cut-off (legacy checks this before before-start).
    if (vn.hhmm >= cutoff) {
        if (bank === "SHINHAN") {
            const vndToVnd =
                network === "CITAD" && wdrlCcyCd === "VND" && txnCurrency === "VND";
            if (vndToVnd) {
                // Shinhan CITAD VND→VND (API) — hard block like Woori (WBW1165).
                return showBlock(dialog, t, "payment.transfer.cutoff.past_end", { end: cutoff });
            }
            // Shinhan otherwise — soft confirm; bank may process next working day (WBC1182).
            return showConfirm(dialog, t, "payment.transfer.cutoff.confirm_shinhan_past", { bank: bankName });
        }
        // Woori / VCB / other — hard block (WBW1165).
        return showBlock(dialog, t, "payment.transfer.cutoff.past_end", { end: cutoff });
    }

    // 4. Before start time (WBW1166).
    if (vn.hhmm < sched.start) {
        return showBlock(dialog, t, "payment.transfer.cutoff.before_start", { start: sched.start });
    }

    // 5. Warning zone (warning ≤ now < cut-off) — soft confirm, all banks (WBC1179).
    if (vn.hhmm >= sched.warning) {
        return showConfirm(dialog, t, "payment.transfer.cutoff.confirm_warning_zone", {
            bank:    bankName,
            end:     cutoff,
            warning: sched.warning,
        });
    }

    // Normal — inside the window, before the warning zone.
    return true;
}

/* ─────────────────── auto-transfer window predicate ─────────────────── */

export interface AutoTransferWindowInput {
    /** OUT_BANK_CD on the master row. */
    readonly bankCd: string;
    /** Master batch (transfer) currency — drives the default network. */
    readonly txnCurrency: string;
    /** Override the inferred network. Overseas passes {@code "SWIFT"}. */
    readonly transferType?: TransferType;
    /** VCB CITAD amount tier — selects the ≥500M cut-off. */
    readonly amountTier?: AmountTier;
    /** Optional clock override for tests. */
    readonly now?: Date;
}

/**
 * Pure banking-window predicate for the AUTO-transfer-after-full-approval
 * path — NO dialogs, NO confirms. Mirrors legacy
 * {@code _v2common.app.validateBankingTimeForAutoTransfer}
 * ({@code add_osmc.js:8642-8752}): the auto path is a strict boolean —
 * valid iff it is a working day for the network AND
 * {@code start ≤ now < cutoff}. It has none of the manual path's
 * warning-zone / Shinhan soft-confirm branches (legacy WBW1169 is shown
 * for every invalid case by the caller).
 *
 * <p>Reuses the shared cut-off config ({@link file://./cutoffConfig.ts}) so
 * the auto and manual paths cannot drift. Unknown bank / no window for the (bank,
 * network) pair → {@code true} (the backend {@code CutoffValidator} is the
 * authoritative gate — see the file header).
 *
 * <p>Same FE limitation as the manual path: the network is inferred from
 * the batch currency (VND → NAPAS, else SWIFT) unless the caller passes
 * {@code transferType}. The approval row carries no {@code ANT_DIV_CD}, so
 * a VND CITAD batch is evaluated on the NAPAS window here; the backend
 * re-validates the real CITAD window on dispatch and the caller maps a
 * backend cut-off rejection back to the WBW1169 message.
 */
export function isWithinAutoTransferWindow(input: AutoTransferWindowInput): boolean {
    // Read the already-loaded config (the orchestrator warms it via
    // loadCutoffConfig() before this pure predicate runs). Not yet loaded →
    // true, so the auto path proceeds and the backend re-validates.
    const schedules = getCachedCutoffSchedules();
    if (!schedules) return true;
    const bank = resolveBankKey(input.bankCd);
    if (!bank) return true; // unknown bank → backend decides
    const network = input.transferType ?? inferTransferType(input.txnCurrency);
    const sched = schedules[bank][network];
    if (!sched) return true; // no window for this (bank, network) → backend decides

    const vn = vietnamLocal(input.now ?? getServerNow() ?? new Date());
    if (!sched.days.has(vn.dayOfWeek)) return false; // weekend / non-working day

    let cutoff = sched.end;
    if (bank === "VCB" && network === "CITAD" && sched.largeEnd) {
        // Explicit tier picks the window: ALL_SMALL → 15:30 (end);
        // ALL_LARGE / MIXED → 16:30 (largeEnd). When the tier is UNKNOWN (the
        // auto path has no per-line amounts to run classifyAmountTiers), default
        // to the WIDER ≥500M window so a legitimate large transfer is never
        // false-blocked — the backend re-checks the real tier and rejects a
        // <500M past-15:30 batch (WBE2066 → WBW1169). Never the narrower 15:30
        // by default, which would block valid ≥500M sends.
        cutoff = input.amountTier === "ALL_SMALL" ? sched.end : sched.largeEnd;
    }
    return vn.hhmm >= sched.start && vn.hhmm < cutoff;
}

/** Vietnam-local calendar date as {@code YYYYMMDD}. The auto-transfer date
 *  comparison (today vs. scheduled PAY_DATE) uses this — legacy reads the
 *  server date via {@code comm_1006_001}; the refactor has no server-time
 *  endpoint, so this uses the browser clock projected to Asia/Ho_Chi_Minh
 *  (same limitation the window check documents in the file header). */
export function vietnamTodayYmd(now?: Date): string {
    // Prefer authoritative Vietnam server time (skew-corrected); fall back to the
    // browser clock only when the server time has not been loaded yet.
    const when = now ?? getServerNow() ?? new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(when);
    const map = Object.fromEntries(
        parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
    );
    return `${map.year}${map.month}${map.day}`;
}

/* ─────────────────── helpers ─────────────────── */

interface VietnamLocal {
    dayOfWeek: number; // 0=Sun ... 6=Sat
    hhmm:      string; // "HH:mm"
}

function vietnamLocal(when: Date): VietnamLocal {
    // Intl.DateTimeFormat with a fixed timeZone — Date#getHours et al. would
    // read the browser locale, which isn't always Vietnam.
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
        weekday:  "short",
        hour:     "2-digit",
        minute:   "2-digit",
        hour12:   false,
    }).formatToParts(when);

    const map = Object.fromEntries(
        parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
    );
    const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        .indexOf(map.weekday ?? "");
    // "Hour" is "24" at midnight under hour12:false in some engines — normalize.
    const rawHour = map.hour ?? "00";
    const hour    = rawHour === "24" ? "00" : rawHour;
    const minute  = map.minute ?? "00";
    return { dayOfWeek, hhmm: `${hour}:${minute}` };
}

/** Hard-block warning dialog (OK only). Resolves {@code false}. */
function showBlock(
    dialog: DialogApi,
    t: TranslateFn,
    key: string,
    params: Record<string, string> = {},
): Promise<boolean> {
    return new Promise((resolve) => {
        let settled = false;
        const done = () => { if (!settled) { settled = true; resolve(false); } };
        dialog.open({
            type:        "warning",
            title:       t("dialog.warning"),
            description: t(key, params),
            onConfirm:   done,
            onClose:     done,
        });
    });
}

/** Soft confirmation dialog (Continue / Cancel). Resolves {@code true} on
 *  Continue, {@code false} on Cancel / close. */
function showConfirm(
    dialog: DialogApi,
    t: TranslateFn,
    key: string,
    params: Record<string, string> = {},
): Promise<boolean> {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (v: boolean) => { if (!settled) { settled = true; resolve(v); } };
        dialog.open({
            type:        "confirmation",
            title:       t("dialog.confirmation"),
            description: t(key, params),
            confirmText: t("dialog.continue"),
            cancelText:  t("dialog.cancel"),
            onConfirm:   () => finish(true),
            onCancel:    () => finish(false),
            onClose:     () => finish(false),
        });
    });
}

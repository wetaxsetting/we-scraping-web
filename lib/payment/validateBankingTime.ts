"use client";

import type { DialogApi } from "@/components/shared/dialog";

/** Mirrors `useTranslation().t`'s signature. */
type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Pre-flight banking-window check for the four Payment Transfer buttons
 * (Internal Transfer / Vendor / Expense / Payroll).
 *
 * <p>Mirrors legacy {@code _v2common.app.validateBankingTime} at
 * {@code WECMS_STATIC/web/assets_v2/add_osmc.js:8343-8473}. Same
 * Shinhan/Woori windows, same NAPAS/CITAD/SWIFT split, same
 * "outside-window blocks, inside-window passes" semantics.
 *
 * <p>Simplifications from the legacy helper:
 *
 * <ul>
 *   <li>No warning zone — legacy shows a "approaching cut-off" confirm
 *       dialog (WBC1179) in the last N minutes; we skip that and rely
 *       on the existing per-page "Are you sure?" confirmation that fires
 *       after this check.</li>
 *   <li>No special Shinhan past-cutoff override — legacy lets Shinhan
 *       proceed past cut-off in some cases; we block uniformly to match
 *       the refactor's backend {@code CutoffValidator} behaviour. If
 *       legacy parity matters, lift this to a feature flag.</li>
 *   <li>Server-time fetch is intentionally absent — we read Vietnam-local
 *       time from the browser's clock. The backend
 *       ({@code CutoffValidator}) is the authoritative gate; this
 *       client-side check is a UX speed-up.</li>
 * </ul>
 *
 * <p>The helper returns {@code Promise<boolean>}: {@code true} when the
 * caller may proceed, {@code false} when blocked (the helper has already
 * shown the error dialog).
 */

/** Routing channel keyed by the master's currency. NAPAS handles same-
 *  country VND transfers; CITAD/SWIFT handle FCY. The legacy distinction
 *  (CITAD vs SWIFT) is collapsed here onto the cut-off window — pages
 *  that need the finer split can extend the helper's input shape. */
export type TransferType = "NAPAS" | "CITAD" | "SWIFT";

/** Vietnam-local day-of-week bit set. Used to express "Mon-Fri only" for
 *  CITAD / SWIFT and "all 7 days" for NAPAS. Mirrors the legacy
 *  BANKING_SCHEDULES.days array. */
type DayMask = ReadonlySet<number>; // 0=Sun ... 6=Sat
const WEEKDAYS: DayMask = new Set([1, 2, 3, 4, 5]);
const ALL_DAYS: DayMask = new Set([0, 1, 2, 3, 4, 5, 6]);

/** Single cut-off window. {@code start} and {@code end} are local Vietnam
 *  times in {@code HH:mm} format. */
interface CutoffWindow {
    /** Inclusive start time, {@code HH:mm}. */
    readonly start: string;
    /** Exclusive end time, {@code HH:mm}. */
    readonly end:   string;
    /** Days of the week this window is active. */
    readonly days:  DayMask;
}

/** Per-bank windows. Keyed by {@code OUT_BANK_CD} → transfer type →
 *  window. Values mirror the refactor's {@code application-local.yml}
 *  {@code wecms.internal-transfer.cutoff} block AND the legacy
 *  add_osmc.js BANKING_SCHEDULES (the windows agree). Banks not in
 *  the table pass through without check — backend has the final word. */
const BANKING_SCHEDULES: Record<string, Record<TransferType, CutoffWindow>> = {
    // Shinhan Bank — refactor uses 88886000 as the firm-banking OUT_BANK_CD.
    "88886000": {
        NAPAS: { start: "00:05", end: "23:45", days: ALL_DAYS },
        CITAD: { start: "09:00", end: "15:30", days: WEEKDAYS },
        SWIFT: { start: "09:00", end: "22:00", days: WEEKDAYS },
    },
    // Woori Bank — refactor uses 11704000.
    "11704000": {
        NAPAS: { start: "00:15", end: "23:55", days: ALL_DAYS },
        CITAD: { start: "08:30", end: "17:40", days: WEEKDAYS },
        SWIFT: { start: "08:30", end: "19:10", days: WEEKDAYS },
    },
};

/** Resolve the transfer type from the batch currency. VND batches go
 *  via the NAPAS API path; non-VND batches go via the file path,
 *  defaulting to SWIFT (the broader window) — pages that know their
 *  specific channel (CITAD vs SWIFT) can pass it explicitly via
 *  {@link BankingTimeCheckInput.transferType}. */
function inferTransferType(txnCurrency: string): TransferType {
    return txnCurrency === "VND" ? "NAPAS" : "SWIFT";
}

export interface BankingTimeCheckInput {
    /** OUT_BANK_CD on the master row (e.g. {@code "88886000"} for Shinhan). */
    readonly bankCd: string;
    /** Master batch currency. Drives the default transfer-type inference. */
    readonly txnCurrency: string;
    /** Override the inferred transfer type. Pass {@code "CITAD"} when
     *  the page knows the FCY batch routes via CITAD rather than SWIFT. */
    readonly transferType?: TransferType;
    /** Dialog API for surfacing block errors to the user. */
    readonly dialog: DialogApi;
    /** i18n translator for dialog copy. */
    readonly t: TranslateFn;
    /** Optional clock override for tests. */
    readonly now?: Date;
}

/**
 * Run the banking-window check. Returns {@code true} if the caller may
 * proceed to dispatch; returns {@code false} after showing an error
 * dialog if the current Vietnam-local time is outside the window.
 *
 * Sample wiring inside a Transfer-button handler:
 *
 * <pre>
 *     const ok = await validateBankingTime({
 *         bankCd:      row.fromBank,
 *         txnCurrency: row.txnCurrency,
 *         dialog,
 *         t,
 *     });
 *     if (!ok) return;
 *     // ...show the existing "Are you sure?" confirmation...
 * </pre>
 */
export async function validateBankingTime(
    input: BankingTimeCheckInput,
): Promise<boolean> {
    const { bankCd, txnCurrency, transferType, dialog, t, now } = input;
    const resolvedType = transferType ?? inferTransferType(txnCurrency);

    const bankWindows = BANKING_SCHEDULES[bankCd];
    if (!bankWindows) {
        // Unknown bank — defer to the backend's CutoffValidator (it will
        // reject with WBE2066/7/8 if the call is genuinely out of window).
        return true;
    }
    const window = bankWindows[resolvedType];

    const vn = vietnamLocal(now ?? new Date());

    // Day-of-week check first: CITAD and SWIFT block on weekends.
    if (!window.days.has(vn.dayOfWeek)) {
        await openBlock(dialog, t, "payment.transfer.cutoff.weekend");
        return false;
    }

    // Time-of-day check: HH:mm comparison works because both sides are
    // zero-padded uniform-length strings.
    if (vn.hhmm < window.start) {
        await openBlock(dialog, t, "payment.transfer.cutoff.before_start", {
            start: window.start,
        });
        return false;
    }
    if (vn.hhmm >= window.end) {
        await openBlock(dialog, t, "payment.transfer.cutoff.past_end", {
            end: window.end,
        });
        return false;
    }

    return true;
}

/* ─────────────────── helpers ─────────────────── */

interface VietnamLocal {
    dayOfWeek: number; // 0=Sun ... 6=Sat
    hhmm:      string; // "HH:mm"
}

function vietnamLocal(when: Date): VietnamLocal {
    // Use Intl.DateTimeFormat with a fixed timeZone — Date#getHours et al.
    // would read the browser's locale, which isn't always Vietnam.
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
    // "Hour" in formatToParts is "24" at midnight under hour12: false in some
    // engines — normalize to "00".
    const rawHour  = map.hour ?? "00";
    const hour     = rawHour === "24" ? "00" : rawHour;
    const minute   = map.minute ?? "00";
    return { dayOfWeek, hhmm: `${hour}:${minute}` };
}

function openBlock(
    dialog: DialogApi,
    t: TranslateFn,
    key: string,
    params: Record<string, string> = {},
): Promise<void> {
    return new Promise((resolve) => {
        let settled = false;
        const done = () => { if (!settled) { settled = true; resolve(); } };
        dialog.open({
            type:        "warning",
            title:       t("dialog.warning"),
            description: t(key, params),
            onConfirm:   done,
            onClose:     done,
        });
    });
}

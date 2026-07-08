"use client";

import type { DialogApi } from "@/components/shared/dialog";
import { ApiCallError } from "@/lib/api/banking";
import { dispatchExpensePayment } from "@/lib/api/expensePayment";
import { dispatchScheduledTransfer } from "@/lib/api/internalTransfer";
import { dispatchOverseasPayment } from "@/lib/api/payment";
import { dispatchPayrollPayment } from "@/lib/api/payrollPayment";
import { dispatchVendorPayment } from "@/lib/api/vendorPayment";
import {
    isWithinAutoTransferWindow,
    type AmountTier,
    type TransferType,
} from "@/lib/payment/validateBankingTime";

/**
 * Auto-transfer-after-full-approval flow — the refactor equivalent of the
 * legacy client-side orchestration in {@code comm_0195_001.js:741-995}
 * (`updateApproval("A")` → `fnCreateTransfer`). Runs AFTER an Approval Box
 * approve succeeds and the document becomes fully approved.
 *
 * Legacy decision tree (matched here):
 *   1. Firm-banking option "Automatically transfer payments by schedule after
 *      full approval" (env `00078`) must be ON, else stop (comm_0195_001.js:762).
 *   2. Corporate Card (APPR_DV `33`) is excluded (comm_0195_001.js:762).
 *   3. today < scheduled PAY_DATE → popup WBW1170, stop (comm_0195_001.js:788-815).
 *   4. Banking window invalid (incl. weekend) → popup WBW1169, stop
 *      (add_osmc.js validateBankingTimeForAutoTransfer → WBW1169).
 *   5. Valid → auto-send via the same per-module dispatch endpoint the manual
 *      Transfer button uses; toast "Transfer successfully" (WBI1162).
 *
 * Idempotency: the send reuses the manual dispatch endpoints, which reject an
 * already-dispatched batch server-side (TRNF_YN='Y' → WBE2064). This flow fires
 * at most once per approval (guarded by the caller's in-flight flag); the
 * backend guard is the safety net against any double-fire.
 */

/** Backend cut-off / weekend rejection codes (InternalTransfer CutoffValidator).
 *  When the FE pre-check passes but the backend rejects on the real window
 *  (e.g. a VND CITAD batch the FE evaluated on the NAPAS window — the approval
 *  row carries no ANT_DIV_CD), we surface the legacy WBW1169 message rather
 *  than a raw error, keeping the user-facing behaviour legacy-faithful. */
const CUTOFF_REJECTION_CODES: ReadonlySet<string> = new Set([
    "WBE2066", // after cut-off
    "WBE2067", // before start time
    "WBE2068", // weekend (CITAD / SWIFT)
]);

/** Corporate Card APPR_DV — excluded from auto-transfer (legacy parity). */
const APPR_DV_CARD = "33";
/** Overseas APPR_DV — always SWIFT (legacy pymn_0007_001.js:230). */
const APPR_DV_OVERSEAS = "34";

/** Map the batch's first-line `ANT_DIV_CD` to the transfer network, mirroring
 *  the backend `TransferNetwork.parse` (N/NAPAS/INTER→NAPAS, C/CITAD→CITAD,
 *  S/SWIFT→SWIFT) and legacy `mapTransferType(REC[0].ANT_DIV_CD)`. Returns
 *  `undefined` for null / blank / unknown so the caller falls back to
 *  currency inference (the defensive path — backend re-validates either way). */
export function antDivCdToTransferType(antDivCd: string | null | undefined): TransferType | undefined {
    if (!antDivCd) return undefined;
    switch (antDivCd.trim().toUpperCase()) {
        case "N":
        case "NAPAS":
        case "INTER":
            return "NAPAS";
        case "C":
        case "CITAD":
            return "CITAD";
        case "S":
        case "SWIFT":
            return "SWIFT";
        default:
            return undefined;
    }
}

export type AutoTransferOutcome =
    /** Not eligible — caller shows its normal "approved" success dialog. */
    | { kind: "skip" }
    /** today < PAY_DATE — show WBW1170, keep manual Transfer button (disabled). */
    | { kind: "date-not-arrived" }
    /** Outside the valid transfer window (incl. weekend) — show WBW1169. */
    | { kind: "invalid-time" }
    /** Proceed to auto-send. */
    | { kind: "dispatch"; batchNo: string; ccyCd: string; apprDv: string };

export interface AutoTransferDecisionInput {
    /** Firm-banking env `00078` resolved to a boolean. */
    readonly autoTransferEnabled: boolean;
    /** Whether the approve just made the document fully approved (APPR_TYPE_CD='01'). */
    readonly isFullyApproved: boolean;
    /** Raw APPR_DV digit of the approved document. */
    readonly apprDv: string;
    /** Dispatch batch id (SCDUL_PYMN_NO / OVRS_PYMN_NO); null when none. */
    readonly batchNo: string | null;
    /** Scheduled payment date, `YYYYMMDD`; null for drafts. */
    readonly payDate: string | null;
    /** Vietnam-local today, `YYYYMMDD` (the "last approval date" per legacy). */
    readonly todayVn: string;
    /** Withdrawal out-bank code (OUT_BANK_CD). */
    readonly bankCd: string | null;
    /** First-line transfer channel (SCDUL_PYMN_SUMR_DETL.ANT_DIV_CD); null →
     *  the window check falls back to currency inference. */
    readonly antDivCd?: string | null;
    /** Batch transfer currency (CCY_CD). */
    readonly txnCurrency: string;
    /** VCB CITAD amount tier, when known. */
    readonly amountTier?: AmountTier;
    /** Clock override for tests. */
    readonly now?: Date;
}

/**
 * Pure decision — no dialogs, no network. Unit-testable in isolation.
 * Mirrors the legacy gate order (env → card → date → window).
 */
export function decideAutoTransfer(input: AutoTransferDecisionInput): AutoTransferOutcome {
    if (!input.autoTransferEnabled) return { kind: "skip" };
    if (!input.isFullyApproved) return { kind: "skip" };
    if (input.apprDv === APPR_DV_CARD) return { kind: "skip" };
    if (!input.batchNo) return { kind: "skip" }; // no dispatchable batch (e.g. overseas M-mode)

    // 1. Scheduled-date gate — server-today vs PAY_DATE (comm_0195_001.js:791).
    if (input.payDate && input.todayVn && input.todayVn < input.payDate) {
        return { kind: "date-not-arrived" };
    }

    // 2. Banking-window gate (comm_0195_001.js:848 + add_osmc.js:8733).
    // Overseas is always SWIFT; every other type uses the batch's real
    // first-line ANT_DIV_CD (legacy mapTransferType(REC[0].ANT_DIV_CD)),
    // falling back to currency inference only when it is absent.
    const transferType: TransferType | undefined =
        input.apprDv === APPR_DV_OVERSEAS
            ? "SWIFT"
            : antDivCdToTransferType(input.antDivCd);
    const withinWindow = isWithinAutoTransferWindow({
        bankCd: input.bankCd ?? "",
        txnCurrency: input.txnCurrency,
        transferType,
        amountTier: input.amountTier,
        now: input.now,
    });
    if (!withinWindow) return { kind: "invalid-time" };

    return {
        kind: "dispatch",
        batchNo: input.batchNo,
        ccyCd: input.txnCurrency,
        apprDv: input.apprDv,
    };
}

/** Call the per-module manual dispatch endpoint for the approved batch —
 *  the same endpoint the manual Transfer button uses (legacy
 *  comm_0195_001.fnCreateTransfer → pymn_XXXX_001_c001). */
async function dispatchByApprDv(apprDv: string, batchNo: string, ccyCd: string): Promise<void> {
    switch (apprDv) {
        case "21": // Payroll
            return dispatchPayrollPayment(batchNo, { trnf_ccy_cd: ccyCd });
        case "31": // Expense
            return dispatchExpensePayment(batchNo, { trnf_ccy_cd: ccyCd });
        case "32": // Vendor
            return dispatchVendorPayment(batchNo, { trnf_ccy_cd: ccyCd });
        case "35": // Internal Transfer
            return dispatchScheduledTransfer(batchNo, { trnf_ccy_cd: ccyCd });
        case APPR_DV_OVERSEAS: // Overseas — no request body (SWIFT/file path)
            return dispatchOverseasPayment(batchNo);
        default:
            // Unknown APPR_DV — should never reach here (decide() only returns
            // dispatch for the five payment types). Fail loud in dev.
            throw new Error(`auto-transfer: unsupported APPR_DV ${apprDv}`);
    }
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export interface RunAutoTransferDeps {
    readonly dialog: DialogApi;
    readonly t: TranslateFn;
    /** Close-and-refresh callback (the approval dialog's onClose — the parent
     *  refetches the list, exactly like legacy's fn_getData / load reload). */
    readonly onDone: () => void;
}

/** OK-only popup (legacy WBW1169 / WBW1170 are single-button dialogs). */
function openOkDialog(dialog: DialogApi, t: TranslateFn, key: string): void {
    dialog.open({
        type: "warning",
        title: t("dialog.warning"),
        description: t(key),
    });
}

/**
 * Run the full auto-transfer flow after a successful approve. Returns
 * {@code true} when it took over the post-approval UX (caller must NOT show
 * its own "approved" success dialog); {@code false} when the flow is not
 * eligible (caller shows its normal success dialog). Never throws — dispatch
 * failures are surfaced as dialogs.
 */
export async function runAutoTransferAfterApproval(
    input: AutoTransferDecisionInput,
    deps: RunAutoTransferDeps,
): Promise<boolean> {
    const outcome = decideAutoTransfer(input);
    switch (outcome.kind) {
        case "skip":
            return false;
        case "date-not-arrived":
            openOkDialog(deps.dialog, deps.t, "payment.auto_transfer.date_not_arrived");
            deps.onDone();
            return true;
        case "invalid-time":
            openOkDialog(deps.dialog, deps.t, "payment.auto_transfer.inappropriate_time");
            deps.onDone();
            return true;
        case "dispatch":
            try {
                await dispatchByApprDv(outcome.apprDv, outcome.batchNo, outcome.ccyCd);
                deps.dialog.open({
                    type: "success",
                    title: deps.t("dialog.success"),
                    description: deps.t("payment.auto_transfer.success"),
                });
            } catch (err) {
                const code = err instanceof ApiCallError ? err.code : undefined;
                if (code && CUTOFF_REJECTION_CODES.has(code)) {
                    // Backend rejected on the real window → legacy WBW1169 message.
                    openOkDialog(deps.dialog, deps.t, "payment.auto_transfer.inappropriate_time");
                } else {
                    deps.dialog.open({
                        type: "error",
                        title: deps.t("dialog.error"),
                        description:
                            err instanceof ApiCallError
                                ? err.message
                                : deps.t("payment.auto_transfer.dispatch_failed"),
                        errorCode: code,
                    });
                }
            }
            deps.onDone();
            return true;
    }
}

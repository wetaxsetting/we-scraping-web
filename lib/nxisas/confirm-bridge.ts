/**
 * Bridge between the legacy NXiSAS bundle's
 * {@code .layerCont.transfer_confirmation} popup and the production
 * React {@link TransferConfirmationDialog}.
 *
 * <p><b>Same pattern as {@link installNxisasQnaBridge}</b>:
 * <ul>
 *   <li>MutationObserver detects when the bundle does
 *       {@code $('body').append(_confirm_transfer_template)} at
 *       {@code nxisas_v2.js:1610}.</li>
 *   <li>Extracts sender/recipient/details/OTP data from the injected
 *       DOM into a structured {@link TransferConfirmationData}.</li>
 *   <li>Hides the legacy popup via the
 *       {@code .layerCont.transfer_confirmation} CSS rule in
 *       {@code app/nxisas-modals.css} (display: none).</li>
 *   <li>Dispatches {@link CONFIRM_CHALLENGE_EVENT} so React renders
 *       the production {@link TransferConfirmationDialog}.</li>
 *   <li>On Submit/Cancel hydrates the hidden popup DOM
 *       ({@code input[name='otp_pwd'].value = otpPwd}) and triggers
 *       the bundle's existing jQuery delegate via native
 *       {@link HTMLElement.click} on the bundle's
 *       {@code .btn-area a.confirm} / {@code .btn-area a.cancel}
 *       button. The bundle's
 *       {@code _v2nxisas.execute(...)} continuation runs unchanged.</li>
 * </ul>
 *
 * <p>The legacy submit handler at {@code nxisas_v2.js:137-330}
 * (selector {@code .layerCont.transfer_confirmation .btn-area a.confirm})
 * reads {@code input[name='otp_pwd'].val()} (line 232) when the
 * {@code #OTP_PWD} block is visible; otherwise it sends
 * {@code res = "Y"} (line 234). Both paths are honoured here because
 * the bridge always writes the OTP value into the hidden field —
 * empty string when the field is hidden, the user's typed value
 * otherwise. The bundle re-reads visibility from the DOM, not the
 * value, so a stray empty assignment is harmless.
 */

import type { TransferConfirmationData } from "@/components/banking/own-account-transfer/TransferConfirmationDialog";

/* ===================================================================
 *  Public types + event constants
 * ================================================================= */

export const CONFIRM_CHALLENGE_EVENT = "wb:nxisas-confirm-challenge" as const;
export const CONFIRM_DISMISS_EVENT   = "wb:nxisas-confirm-dismiss"   as const;

export type NxisasConfirmChallenge = {
    /** Snapshot of the legacy popup's substituted values, ready for
     *  the React modal to consume. */
    data:  TransferConfirmationData;
    /** Opaque handle to the live `.layerCont.transfer_confirmation`
     *  element. Pass back to {@link submitNxisasConfirm} /
     *  {@link cancelNxisasConfirm} so the bridge targets the correct
     *  popup. */
    popup: HTMLElement;
};

declare global {
    interface WindowEventMap {
        [CONFIRM_CHALLENGE_EVENT]: CustomEvent<NxisasConfirmChallenge>;
        [CONFIRM_DISMISS_EVENT]:   CustomEvent<{ popup: HTMLElement }>;
    }
}

/* ===================================================================
 *  Internal — extract challenge metadata from the injected popup
 * ================================================================= */

/**
 * Each `.ip-list` row in the legacy template carries
 * {@code style="#{TRNS_*_AREA}"} that the bundle fills with either
 * an empty string (visible) or {@code "display:none"} (hidden) per
 * {@code nxisas_v2.js:1374-1473}. This helper checks the live
 * computed style — `display: none` → hidden, otherwise visible.
 */
function isVisible(el: HTMLElement | null): boolean {
    if (!el) return false;
    // Read the inline style first (the bundle uses inline style),
    // fall back to computed style for safety. Either path is fine
    // because the bundle never uses CSS classes for visibility.
    if (el.style.display === "none") return false;
    if (typeof window !== "undefined") {
        const computed = window.getComputedStyle(el).display;
        if (computed === "none") return false;
    }
    return true;
}

/**
 * Read the `<p class="val">` text for the {@code .ip-list} row whose
 * sibling {@code .name} cell label matches the given regex. The
 * bundle replaces the label via {@code jexML.get("nxisas_v2_jNNN",
 * fallback)}, so the English fallback is the most reliable match
 * across locales — but we accept any text that loosely matches the
 * label to be tolerant of future i18n flips.
 *
 * <p>Returns the row element + the value string so the caller can
 * also read the visibility flag off the same row.
 */
function readRow(
    container: HTMLElement,
    sectionTitleRegex: RegExp,
    rowLabelRegex: RegExp,
): { row: HTMLElement | null; value: string } {
    const sections = container.querySelectorAll<HTMLElement>(".form-cont");
    for (const sec of sections) {
        const topic = sec.querySelector<HTMLElement>(".title .topic")?.textContent?.trim() ?? "";
        if (!sectionTitleRegex.test(topic)) continue;
        const rows = sec.querySelectorAll<HTMLElement>(".ip-cont > .ip-list");
        for (const row of rows) {
            const name = row.querySelector<HTMLElement>(".name")?.textContent?.trim() ?? "";
            if (rowLabelRegex.test(name)) {
                const val = row.querySelector<HTMLElement>(".val")?.textContent?.trim() ?? "";
                return { row, value: val };
            }
        }
    }
    return { row: null, value: "" };
}

function extractChallenge(popup: HTMLElement): NxisasConfirmChallenge | null {
    // Sender section
    const senderAccount = readRow(popup, /Sender Account Information|발신/i, /Sender Account|발신 계좌/i).value;
    const transferAmount = readRow(popup, /Sender Account Information|발신/i, /Transfer Amount|이체 금액|송금 금액/i).value;

    // Recipient section
    const recipientBank   = readRow(popup, /Recipient Account Information|수신/i, /Recipient Bank|수신 은행/i).value;
    const recipientAcctNo = readRow(popup, /Recipient Account Information|수신/i, /Recipient Account No\.?|수신 계좌/i).value;
    const recipientName   = readRow(popup, /Recipient Account Information|수신/i, /Recipient Name|수신인/i).value;

    // Transaction Details — visibility from the row's inline style
    const feeStts   = readRow(popup, /Transaction Details|거래 내역/i, /Transaction Fee$|이체 수수료$/i);
    const feeAmt    = readRow(popup, /Transaction Details|거래 내역/i, /Fee Amount|수수료 금액/i);
    const rmrk      = readRow(popup, /Transaction Details|거래 내역/i, /^Remark$|^적요$|^Remarks$/i);
    const rmrkSnd   = readRow(popup, /Transaction Details|거래 내역/i, /Remark.*Sender|적요.*발신/i);
    const rmrkRecp  = readRow(popup, /Transaction Details|거래 내역/i, /Remark.*Recipient|적요.*수신/i);

    // OTP / Transfer-password block
    const pwdAreaWrap  = popup.querySelector<HTMLElement>(".formList-wrap:has(#OTP_PWD)")
                       ?? popup.querySelector<HTMLElement>(".formList-wrap:nth-of-type(2)");
    const otpBlock     = popup.querySelector<HTMLElement>("#OTP_PWD");
    const trnsPwdBlock = popup.querySelector<HTMLElement>("#TRNS_PWD");
    const transactionCode = popup.querySelector<HTMLElement>("#OTP_PWD .code-num")?.textContent?.trim();
    const idLabel = popup.querySelector<HTMLElement>("#OTP_PWD .id_label")?.textContent
                  ?? popup.querySelector<HTMLElement>("#TRNS_PWD .id_label")?.textContent
                  ?? "";
    // Strip "(ID: " / ")" framing the bundle wraps the userName with.
    const userName = idLabel.replace(/^.*\(\s*ID\s*:\s*/i, "").replace(/\s*\)\s*$/, "").trim();

    const data: TransferConfirmationData = {
        senderAccount,
        transferAmount,
        recipientBank,
        recipientAcctNo,
        recipientName,
        showFeeStts:    isVisible(feeStts.row),
        transferFeeStts: feeStts.value,
        showFeeAmt:     isVisible(feeAmt.row),
        feeAmount:      feeAmt.value,
        showRmrk:       isVisible(rmrk.row),
        remark:         rmrk.value,
        showRmrkSender: isVisible(rmrkSnd.row),
        remarkSender:   rmrkSnd.value,
        showRmrkRecp:   isVisible(rmrkRecp.row),
        remarkRecipient: rmrkRecp.value,
        showPwdArea:     isVisible(pwdAreaWrap),
        showOtpPwdArea:  isVisible(otpBlock),
        showTrnsPwdArea: isVisible(trnsPwdBlock),
        transactionCode,
        userName,
    };

    return { data, popup };
}

/* ===================================================================
 *  Submission — write back to legacy DOM + trigger bundle's handler
 * ================================================================= */

/**
 * Confirm path. Writes the OTP password into the hidden legacy
 * input and triggers the bundle's existing
 * {@code .btn-area a.confirm} click handler at
 * {@code nxisas_v2.js:137-330}. The handler reads the OTP from the
 * DOM (line 232) when the OTP block is visible, sends {@code res =
 * "Y"} otherwise (line 234), and continues the flow via
 * {@code _v2nxisas.execute(...)}.
 */
export function submitNxisasConfirm(popup: HTMLElement, otpPwd: string): void {
    const otpInput = popup.querySelector<HTMLInputElement>("#OTP_PWD input[name='otp_pwd']");
    if (otpInput) {
        otpInput.value = otpPwd;
    }
    const confirmBtn = popup.querySelector<HTMLElement>(".btn-area a.confirm");
    if (confirmBtn) {
        confirmBtn.click();
    }
}

/**
 * Cancel path. Triggers the bundle's existing
 * {@code .btn-area a.cancel} click handler at
 * {@code nxisas_v2.js:78-130} which closes the popup (removing it
 * from {@code <body>}) and aborts the in-flight confirm flow. The
 * MutationObserver picks up the removal and fires
 * {@link CONFIRM_DISMISS_EVENT}.
 */
export function cancelNxisasConfirm(popup: HTMLElement): void {
    const cancelBtn = popup.querySelector<HTMLElement>(".btn-area a.cancel");
    if (cancelBtn) {
        cancelBtn.click();
        return;
    }
    popup.parentElement?.removeChild(popup);
}

/* ===================================================================
 *  Observer install — idempotent
 * ================================================================= */

let installed = false;

export function installNxisasConfirmBridge(): void {
    if (installed) return;
    if (typeof window === "undefined" || typeof document === "undefined") return;
    installed = true;

    console.log("[nxisas-confirm-bridge] installed — observing document.body for .layerCont.transfer_confirmation");

    const seen = new WeakSet<HTMLElement>();

    const onAdded = (popup: HTMLElement) => {
        if (seen.has(popup)) return;
        seen.add(popup);
        const challenge = extractChallenge(popup);
        console.log(
            "[nxisas-confirm-bridge] legacy popup detected — extracted:",
            challenge
                ? {
                      senderAccount:   challenge.data.senderAccount,
                      transferAmount:  challenge.data.transferAmount,
                      recipientBank:   challenge.data.recipientBank,
                      recipientAcctNo: challenge.data.recipientAcctNo,
                      showOtp:         challenge.data.showPwdArea && challenge.data.showOtpPwdArea,
                      transactionCode: challenge.data.transactionCode,
                  }
                : "(extract failed)",
        );
        if (!challenge) return;
        window.dispatchEvent(
            new CustomEvent<NxisasConfirmChallenge>(CONFIRM_CHALLENGE_EVENT, {
                detail: challenge,
            }),
        );
    };

    const onRemoved = (popup: HTMLElement) => {
        if (!seen.has(popup)) return;
        window.dispatchEvent(
            new CustomEvent<{ popup: HTMLElement }>(CONFIRM_DISMISS_EVENT, {
                detail: { popup },
            }),
        );
    };

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            m.addedNodes.forEach((n) => {
                if (n.nodeType !== Node.ELEMENT_NODE) return;
                const el = n as HTMLElement;
                if (el.classList?.contains("layerCont")
                    && el.classList.contains("transfer_confirmation")) {
                    onAdded(el);
                }
            });
            m.removedNodes.forEach((n) => {
                if (n.nodeType !== Node.ELEMENT_NODE) return;
                const el = n as HTMLElement;
                if (el.classList?.contains("layerCont")
                    && el.classList.contains("transfer_confirmation")) {
                    onRemoved(el);
                }
            });
        }
    });

    observer.observe(document.body, { childList: true });

    document.body
        .querySelectorAll<HTMLElement>(".layerCont.transfer_confirmation")
        .forEach(onAdded);
}

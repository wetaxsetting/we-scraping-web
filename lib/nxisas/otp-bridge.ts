/**
 * Bridge between the legacy NXiSAS bundle's {@code .layerCont.otp}
 * popup and the production React {@link OtpAuthDialog}.
 *
 * <p><b>Same pattern as {@link installNxisasQnaBridge} +
 * {@link installNxisasConfirmBridge}</b>:
 *
 * <ul>
 *   <li>MutationObserver detects when the bundle does
 *       {@code $('body').append(_otp_template)} during a 2nd-cert
 *       OTP challenge (template at {@code nxisas_v2.js:384-415}).</li>
 *   <li>Extracts the bank-name string from the injected DOM into a
 *       structured {@link OtpAuthData}.</li>
 *   <li>Hides the legacy popup via the {@code .layerCont.otp} CSS
 *       rule in {@code app/nxisas-modals.css} (display: none) so the
 *       user never sees the unstyled bundle layout.</li>
 *   <li>Dispatches {@link OTP_CHALLENGE_EVENT} so React renders the
 *       production {@link OtpAuthDialog}.</li>
 *   <li>On Submit/Cancel hydrates the hidden popup DOM
 *       ({@code input[name='res'].value = otp}) and triggers the
 *       bundle's existing jQuery delegate via native
 *       {@link HTMLElement.click} on the bundle's
 *       {@code .btn-st.primary.save} / {@code .btn-st.common.cancel}
 *       button. The bundle's {@code _v2nxisas.execute(...)}
 *       continuation runs unchanged.</li>
 * </ul>
 *
 * <p>The legacy submit handler at {@code nxisas_v2.js:137-330}
 * (selector {@code .layerCont.otp .btn-st.primary.save}) reads
 * {@code input[name='res'].val()} and dispatches it to the engine.
 * The bridge writes the user's typed OTP into that field before
 * triggering the click, so the bundle sees the same payload it would
 * have seen had the user typed into the legacy popup directly.
 *
 * <p>Scope: applies wherever the NXiSAS bundle injects a
 * {@code .layerCont.otp} popup — currently the Own Account Transfer
 * Update Balance / Confirm Transfer flows (any bank in the allow-list
 * that requires a per-transaction OTP).
 */

import type { OtpAuthData } from "@/components/banking/own-account-transfer/OtpAuthDialog";

/* ===================================================================
 *  Public types + event constants
 * ================================================================= */

export const OTP_CHALLENGE_EVENT = "wb:nxisas-otp-challenge" as const;
export const OTP_DISMISS_EVENT   = "wb:nxisas-otp-dismiss"   as const;

export type NxisasOtpChallenge = {
    /** Snapshot of the legacy popup's substituted values, ready for
     *  the React modal to consume. */
    data:  OtpAuthData;
    /** Opaque handle to the live {@code .layerCont.otp} element.
     *  Pass back to {@link submitNxisasOtp} / {@link cancelNxisasOtp}
     *  so the bridge targets the correct popup when the user has
     *  multiple 2nd-cert challenges queued (the bundle's
     *  {@code _2ndCertList} can hold more than one). */
    popup: HTMLElement;
};

declare global {
    interface WindowEventMap {
        [OTP_CHALLENGE_EVENT]: CustomEvent<NxisasOtpChallenge>;
        [OTP_DISMISS_EVENT]:   CustomEvent<{ popup: HTMLElement }>;
    }
}

/* ===================================================================
 *  Internal — extract challenge metadata from the injected popup
 * ================================================================= */

/**
 * Read the bank-name string out of the legacy popup. The bundle's
 * {@code _otp_template:391} populates {@code .top > p} with
 * {@code #{BANK_INFO}#{ADDITIONAL_INFO}} — a free-form string
 * composed at {@code nxisas_v2.js:1334-1348}. We pass the whole
 * trimmed string through to the React modal verbatim.
 */
function extractChallenge(popup: HTMLElement): NxisasOtpChallenge | null {
    const top = popup.querySelector<HTMLElement>(".top p");
    const bankName = (top?.textContent ?? "").trim();
    if (!bankName) {
        // Defensive — `.top > p` is always present in the template,
        // but skip extraction if the bundle ever ships an empty cell
        // so we don't surface an empty-headed modal.
        return null;
    }
    return { data: { bankName }, popup };
}

/* ===================================================================
 *  Submission — write back to legacy DOM + trigger bundle's handler
 * ================================================================= */

/**
 * Confirm path. Mirrors the user-action sequence the bundle's submit
 * handler ({@code nxisas_v2.js:137-330}) reads out of the popup DOM:
 *
 * <ol>
 *   <li>Populate the OTP input ({@code name='res'}) with the user's
 *       typed code — the bundle reads this via
 *       {@code $("input[name='res']").val()} inside its handler.</li>
 *   <li>Click {@code .btn-st.primary.save} to fire the bundle's
 *       existing jQuery-delegated submit handler. The handler builds
 *       the header + calls {@code _v2nxisas.execute(...)} and the
 *       engine proceeds — no further bridge work required.</li>
 * </ol>
 *
 * Native {@link HTMLElement.click} triggers jQuery delegates the same
 * way a real user click does (jQuery binds to the native event).
 */
export function submitNxisasOtp(popup: HTMLElement, otp: string): void {
    // 1. OTP input — `name='res'`, the user's typed code.
    const input = popup.querySelector<HTMLInputElement>("input[name='res']");
    if (input) {
        input.value = otp;
    }

    // 2. Fire the bundle's `.save` click handler. Use native
    //    `.click()` so the jQuery-delegated handler at
    //    `nxisas_v2.js:137` fires on the bubbling phase.
    const saveBtn = popup.querySelector<HTMLElement>(".btn-st.primary.save");
    if (saveBtn) {
        saveBtn.click();
    }
}

/**
 * Cancel path. Triggers the bundle's existing `.cancel` click
 * handler ({@code nxisas_v2.js:77-130}) which closes the popup
 * (removes the {@code .layerCont} from {@code <body>}) and aborts the
 * in-flight 2nd-cert flow. The MutationObserver picks up the removal
 * and dispatches {@link OTP_DISMISS_EVENT} so the React mirror
 * unmounts.
 */
export function cancelNxisasOtp(popup: HTMLElement): void {
    const cancelBtn = popup.querySelector<HTMLElement>(".btn-st.common.cancel");
    if (cancelBtn) {
        cancelBtn.click();
        return;
    }
    // Fallback — bundle removed the cancel button (shouldn't happen,
    // but be defensive). Just detach the popup so the user's React
    // dialog closes; the engine flow will eventually time out.
    popup.parentElement?.removeChild(popup);
}

/* ===================================================================
 *  Observer install — idempotent
 * ================================================================= */

let installed = false;

/**
 * One-time install. Subsequent calls are no-ops. Safe to invoke from
 * the engine bootstrapper alongside {@link installJexjsAdapter}.
 */
export function installNxisasOtpBridge(): void {
    if (installed) return;
    if (typeof window === "undefined" || typeof document === "undefined") return;
    installed = true;

    // Diagnostic — visible in browser console on first install.
    console.log("[nxisas-otp-bridge] installed — observing document.body for .layerCont.otp");

    // Track which popups we've already dispatched a challenge for so
    // we don't double-fire when the MutationObserver fires more than
    // once for the same node.
    const seen = new WeakSet<HTMLElement>();

    const onAdded = (popup: HTMLElement) => {
        if (seen.has(popup)) return;
        seen.add(popup);
        const challenge = extractChallenge(popup);
        console.log(
            "[nxisas-otp-bridge] legacy popup detected — challenge extracted:",
            challenge
                ? { bankName: challenge.data.bankName }
                : "(extract failed — popup structure unexpected)",
        );
        if (!challenge) return;
        window.dispatchEvent(
            new CustomEvent<NxisasOtpChallenge>(OTP_CHALLENGE_EVENT, {
                detail: challenge,
            }),
        );
        console.log("[nxisas-otp-bridge] dispatched", OTP_CHALLENGE_EVENT);
    };

    const onRemoved = (popup: HTMLElement) => {
        if (!seen.has(popup)) return;
        // No need to mutate `seen` — the WeakSet drops the entry
        // automatically once the node is GC'd.
        console.log("[nxisas-otp-bridge] legacy popup removed — dispatching dismiss");
        window.dispatchEvent(
            new CustomEvent<{ popup: HTMLElement }>(OTP_DISMISS_EVENT, {
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
                    && el.classList.contains("otp")) {
                    onAdded(el);
                }
            });
            m.removedNodes.forEach((n) => {
                if (n.nodeType !== Node.ELEMENT_NODE) return;
                const el = n as HTMLElement;
                if (el.classList?.contains("layerCont")
                    && el.classList.contains("otp")) {
                    onRemoved(el);
                }
            });
        }
    });

    observer.observe(document.body, { childList: true });

    // Catch popups that the bundle might have appended before this
    // bridge mounted (unlikely, but cheap to handle).
    document.body
        .querySelectorAll<HTMLElement>(".layerCont.otp")
        .forEach(onAdded);
}

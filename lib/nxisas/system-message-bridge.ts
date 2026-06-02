/**
 * Bridge for the legacy NXiSAS bundle's `_v2common.app.showMessage(...)`
 * **confirmation** codes — specifically the 2nd-cert quit/cancel
 * confirmations the bundle raises when the user clicks Cancel / X on an
 * engine popup (OTP / Security-Question / Transfer-Confirmation /
 * saved-password).
 *
 * <p><b>Legacy behaviour</b> (`nxisas_v2.js:77-130`): the bundle's
 * single body-delegated Cancel/X handler resolves a message code —
 * {@code WBC1152} ("Would you like to quit the inquiry for #{BANK_NM}?")
 * for inquiry/login jobs, {@code WBC1140} ("Would you like to cancel the
 * transfer to #{BANK_NM}?") for TRANSFER jobs — then calls
 * {@code _v2common.app.showMessage(code, {dataObj:{BANK_NM}}, cb)}. Only
 * when the user picks <b>Yes</b> ({@code cb(true)}) does it close the
 * popup and abort the engine flow (a LOGIN_CAN result that resolves the
 * scrape). <b>No</b> ({@code cb(false)}) leaves the popup open.
 *
 * <p>The refactor previously stubbed {@code showMessage} as a raw
 * {@code window.alert(code)} that always fired {@code cb()} with no
 * argument (falsy → never aborts), which is why the user saw a bare
 * "WBC1152" browser alert and the composer got stuck in "Submitting…".
 *
 * <p>This module lets {@code showMessage} hand the confirmation to the
 * React {@code useDialog()} system dialog instead. {@code showMessage}
 * dispatches {@link NXISAS_SYSTEM_CONFIRM_EVENT}; a React listener
 * (mounted by the Own Account Transfer composer) marks the event
 * {@code handled} and opens the standard "Confirmation" dialog
 * (No / Yes), then calls {@link NxisasSystemConfirm.respond} with the
 * user's decision — which the adapter forwards to the legacy {@code cb},
 * so the bundle's own abort logic runs unchanged.
 *
 * <p>If no React listener is mounted (defensive — should not happen
 * while a transfer is in flight), {@code showMessage} falls back to the
 * native {@code window.confirm} so the engine flow can still resolve
 * rather than hang.
 */

export const NXISAS_SYSTEM_CONFIRM_EVENT = "wb:nxisas-system-confirm" as const;

/** Legacy message codes that are Yes/No quit/cancel confirmations
 *  (as opposed to single-button error/info messages). */
export const NXISAS_CONFIRM_CODES: ReadonlySet<string> = new Set([
    "WBC1152", // Would you like to quit the inquiry for #{BANK_NM}?
    "WBC1140", // Would you like to cancel the transfer to #{BANK_NM}?
]);

export type NxisasSystemConfirm = {
    /** Legacy message code (e.g. {@code "WBC1152"} / {@code "WBC1140"}). */
    code:   string;
    /** Bank display name to interpolate into the message. */
    bankNm: string;
    /** Set to {@code true} by the React listener so the dispatcher knows
     *  a handler took the event (and can skip the native-confirm
     *  fallback). Mutated synchronously during {@code dispatchEvent}. */
    handled: boolean;
    /** Called once with the user's decision (Yes → {@code true},
     *  No → {@code false}). The adapter forwards this to the legacy
     *  {@code showMessage} callback. */
    respond: (confirmed: boolean) => void;
};

declare global {
    interface WindowEventMap {
        [NXISAS_SYSTEM_CONFIRM_EVENT]: CustomEvent<NxisasSystemConfirm>;
    }
}

/**
 * Raise a quit/cancel confirmation. Dispatches the React event and, if
 * no listener handled it, falls back to the native confirm so the
 * caller's `respond` is always eventually invoked exactly once.
 *
 * <p>Returns nothing — the decision is delivered asynchronously through
 * {@code respond}. The {@code fallbackText} is only used for the native
 * confirm fallback (the React dialog builds its own localized copy).
 */
export function requestNxisasSystemConfirm(args: {
    code:         string;
    bankNm:       string;
    respond:      (confirmed: boolean) => void;
    fallbackText: string;
}): void {
    if (typeof window === "undefined") {
        // SSR / no window — default to "No" so nothing is aborted blind.
        args.respond(false);
        return;
    }
    let settled = false;
    const respondOnce = (ok: boolean) => {
        if (settled) return;
        settled = true;
        args.respond(ok);
    };

    const detail: NxisasSystemConfirm = {
        code:    args.code,
        bankNm:  args.bankNm,
        handled: false,
        respond: respondOnce,
    };
    window.dispatchEvent(
        new CustomEvent<NxisasSystemConfirm>(NXISAS_SYSTEM_CONFIRM_EVENT, { detail }),
    );

    // Listeners run synchronously during dispatchEvent, so `detail.handled`
    // is authoritative here. If a React dialog took the event it will
    // call `respondOnce` later (on Yes/No); we do nothing more.
    if (!detail.handled) {
        const ok = typeof window.confirm === "function"
            ? window.confirm(args.fallbackText)
            : false;
        respondOnce(ok);
    }
}

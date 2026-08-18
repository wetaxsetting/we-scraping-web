"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDialog } from "@/components/shared/dialog";
import Tooltip from "@/components/shared/Tooltip";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiCallError, postBalanceRefresh, decryptNxisasResult } from "@/lib/api/banking";
import { formatAmount } from "@/lib/currency";
import { formatUtcDtmByLanguage } from "@/lib/datetime";
import { clampUtf8Bytes, utf8ByteLength } from "@/lib/text";
import { useTranslation, type Locale } from "@/lib/i18n";

/** Format the raw UTC `ACCT_BAL_LST_INQ_DTM` for the composer's
 *  "Last updated time" line — convert UTC→Vietnam-local and render the
 *  date per active locale + `HH:mm:ss`. Empty / null / malformed → "". */
function composeLastUpdated(value: string | null | undefined, locale: Locale): string {
    const { date, time } = formatUtcDtmByLanguage(value, locale);
    if (!date) return "";
    return time ? `${date} ${time}` : date;
}
// PHASE B TODO: Port saved-cert engine harness backed by
// BANK_CERT_INFO before enabling live Update Balance / Confirm
// Transfer execution. Until then `hasSavedBankCert(row)` returns
// false for every source row, the pre-flight in `handleUpdateBalance`
// and `handleConfirm` surfaces a clean Phase B warning, and the
// engine bundle is never invoked. Full checklist + Spring endpoint
// mapping lives in `lib/nxisas/jexjs-adapter.ts` (search "PHASE B TODO").
import { hasSavedBankCert } from "@/lib/nxisas/jexjs-adapter";
import {
    QNA_CHALLENGE_EVENT,
    QNA_DISMISS_EVENT,
    cancelNxisasQna,
    submitNxisasQna,
    type NxisasQnaChallenge,
} from "@/lib/nxisas/qna-bridge";
import {
    CONFIRM_CHALLENGE_EVENT,
    CONFIRM_DISMISS_EVENT,
    cancelNxisasConfirm,
    submitNxisasConfirm,
    type NxisasConfirmChallenge,
} from "@/lib/nxisas/confirm-bridge";
import {
    OTP_CHALLENGE_EVENT,
    OTP_DISMISS_EVENT,
    cancelNxisasOtp,
    submitNxisasOtp,
    type NxisasOtpChallenge,
} from "@/lib/nxisas/otp-bridge";
import {
    NXISAS_SYSTEM_CONFIRM_EVENT,
    type NxisasSystemConfirm,
} from "@/lib/nxisas/system-message-bridge";
import { QnaDialog } from "@/app/(dashboard)/banking/credentials/QnaDialog";
import OtpAuthDialog from "./OtpAuthDialog";
import TransferConfirmationDialog from "./TransferConfirmationDialog";
import { cn } from "@/lib/utils";
import type {
    ApiBalanceRefreshRequest,
    ApiOwnAccountTransferScrapingResultRequest,
} from "@/lib/types/api";

import {
    buildNxisasOrgObj,
    getFeePolicy,
    getRemarkByteLimits,
    getRemarkUiPolicy,
} from "./bank-profiles";
import type { NxisasOrgObj } from "./bank-profiles";
import { resolveNxisasBankClass } from "@/lib/nxisas/jexjs-adapter";
import { userStorage } from "@/lib/auth/storage";
import type {
    UseNxisasEngineState,
} from "./hooks/use-nxisas-engine";
import {
    isPasswordRequiredFor,
    type UseOwnAccountTransferState,
} from "./hooks/use-own-account-transfer";
import type {
    OwnAccountSourceRow,
    OwnAccountTargetRow,
    OwnAccountTransferComposerValidation,
    OwnAccountTransferDraft,
} from "./types";

/* ===================================================================
 *  Public props
 * ================================================================= */

export type OwnAccountTransferComposerDialogProps = {
    /** Set to the row the user clicked Transfer on. `null` keeps the
     *  dialog closed. */
    source: OwnAccountSourceRow | null;
    /** Data hook returned by `useOwnAccountTransfer`. Used for target
     *  loading, draft validation, and the post-scrape POST. */
    data:   UseOwnAccountTransferState;
    /** Engine facade — same `useNxisasEngine` instance the page mounts. */
    engine: UseNxisasEngineState;
    /** Close requested by user (Cancel / X / Esc / outside click). */
    onClose:   () => void;
    /** Called after a successful POST to /scraping-result (or replay).
     *  Pages typically `data.reload()` here to refresh the source list. */
    onRecorded: () => void;
};

/* ===================================================================
 *  Composer dialog — single-step form. Clicking Next fires the engine
 *  directly; the bank-driven {@link TransferConfirmationDialog} (which
 *  replaces the legacy `_confirm_transfer_template`) is the only
 *  confirmation surface. This matches the legacy `trns_0001_007.ts`
 *  flow at `#next_step` click → `fnTransferConfirmation()` →
 *  `_v2nxisas.callNxisas(...)` — no in-app review step.
 * ================================================================= */

export default function OwnAccountTransferComposerDialog({
    source,
    data,
    engine,
    onClose,
    onRecorded,
}: OwnAccountTransferComposerDialogProps) {
    const { t } = useTranslation();
    const sysDialog = useDialog();

    // --- Engine 2nd-cert challenge (security question) -------------
    // Bridged from the legacy NXiSAS bundle. When the engine returns
    // `CallBackfunc=QNA` after LOGIN (Shinhan / IBK / Woori commonly
    // do this on first sync), the bundle injects a hidden
    // `.layerCont.security-question` popup; `lib/nxisas/qna-bridge.ts`
    // detects it and dispatches a `wb:nxisas-qna-challenge` CustomEvent
    // carrying the bank-supplied question list. We mirror it via the
    // existing shared `<QnaDialog>` (same component the Bank
    // Transaction Sync page uses) and on Confirm hydrate the hidden
    // popup + trigger the bundle's existing `.save` click. The legacy
    // submit handler runs `_v2nxisas.execute(...)` to continue the
    // 2nd-cert flow — no engine-side bridge code required.
    const [qnaChallenge, setQnaChallenge] = useState<NxisasQnaChallenge | null>(null);
    useEffect(() => {
        const onChallenge = (e: CustomEvent<NxisasQnaChallenge>) => {
            setQnaChallenge(e.detail);
        };
        const onDismiss = (e: CustomEvent<{ popup: HTMLElement }>) => {
            // Only clear if the dismissed popup matches the one we're
            // currently mirroring — guards against a stale dismiss
            // event firing after the user has already moved on.
            setQnaChallenge((prev) =>
                prev && prev.popup === e.detail.popup ? null : prev,
            );
        };
        window.addEventListener(QNA_CHALLENGE_EVENT, onChallenge);
        window.addEventListener(QNA_DISMISS_EVENT, onDismiss);
        return () => {
            window.removeEventListener(QNA_CHALLENGE_EVENT, onChallenge);
            window.removeEventListener(QNA_DISMISS_EVENT, onDismiss);
        };
    }, []);

    // --- Engine CONFIRM 2nd-cert (transfer confirmation) -----------
    // Same bridge pattern as QNA above. The engine fires this AFTER
    // a successful LOGIN, on banks that require OTP-confirmed
    // transfers (Shinhan / IBK / Vietcom). The legacy bundle injects
    // `.layerCont.transfer_confirmation` (hidden via
    // `app/nxisas-modals.css`), `lib/nxisas/confirm-bridge.ts`
    // extracts the displayed fields + OTP visibility, dispatches a
    // `wb:nxisas-confirm-challenge` event, and we mount the React
    // <TransferConfirmationDialog> in response.
    const [confirmChallenge, setConfirmChallenge] = useState<NxisasConfirmChallenge | null>(null);
    useEffect(() => {
        const onChallenge = (e: CustomEvent<NxisasConfirmChallenge>) => {
            setConfirmChallenge(e.detail);
        };
        const onDismiss = (e: CustomEvent<{ popup: HTMLElement }>) => {
            setConfirmChallenge((prev) =>
                prev && prev.popup === e.detail.popup ? null : prev,
            );
        };
        window.addEventListener(CONFIRM_CHALLENGE_EVENT, onChallenge);
        window.addEventListener(CONFIRM_DISMISS_EVENT, onDismiss);
        return () => {
            window.removeEventListener(CONFIRM_CHALLENGE_EVENT, onChallenge);
            window.removeEventListener(CONFIRM_DISMISS_EVENT, onDismiss);
        };
    }, []);

    // --- Engine OTP 2nd-cert (one-time-password challenge) ---------
    // Same bridge pattern as QNA + CONFIRM above. The engine fires
    // this when a bank requires per-transaction OTP authentication.
    // The legacy bundle injects `.layerCont.otp` (hidden via
    // `app/nxisas-modals.css`), `lib/nxisas/otp-bridge.ts` extracts
    // the bank-name label, dispatches a `wb:nxisas-otp-challenge`
    // event, and we mount the React <OtpAuthDialog> in response.
    // The dialog's Submit calls `submitNxisasOtp(popup, otp)` which
    // hydrates the hidden `input[name='res']` and triggers the
    // bundle's `.btn-st.primary.save` — engine continuation runs
    // unchanged via `_v2nxisas.execute(...)`.
    const [otpChallenge, setOtpChallenge] = useState<NxisasOtpChallenge | null>(null);
    useEffect(() => {
        const onChallenge = (e: CustomEvent<NxisasOtpChallenge>) => {
            setOtpChallenge(e.detail);
        };
        const onDismiss = (e: CustomEvent<{ popup: HTMLElement }>) => {
            setOtpChallenge((prev) =>
                prev && prev.popup === e.detail.popup ? null : prev,
            );
        };
        window.addEventListener(OTP_CHALLENGE_EVENT, onChallenge);
        window.addEventListener(OTP_DISMISS_EVENT, onDismiss);
        return () => {
            window.removeEventListener(OTP_CHALLENGE_EVENT, onChallenge);
            window.removeEventListener(OTP_DISMISS_EVENT, onDismiss);
        };
    }, []);

    // --- Engine quit/cancel confirmation (WBC1152 / WBC1140) ---------
    // Legacy parity (`nxisas_v2.js:78-130`): every 2nd-cert popup's
    // Cancel / X routes through the bundle's delegated handler, which
    // calls `_v2common.app.showMessage(code, {BANK_NM}, cb)` to ask
    // "Would you like to quit the inquiry for {Bank}?" (WBC1152) or
    // "...cancel the transfer to {Bank}?" (WBC1140). The jexjs-adapter
    // forwards that to here as a CustomEvent; we render the shared
    // `useDialog` confirmation (No / Yes) and hand the decision back. On
    // Yes the bundle closes the popup + aborts the engine (LOGIN_CAN),
    // which resolves the in-flight scrape and clears the submitting /
    // updating lock; on No the engine popup stays open. This replaces
    // the raw `alert("WBC1152")` the user used to see.
    useEffect(() => {
        const onSystemConfirm = (e: CustomEvent<NxisasSystemConfirm>) => {
            e.detail.handled = true;
            const { code, bankNm, respond } = e.detail;
            const description = code === "WBC1140"
                ? t("own_account_transfer.engine.cancel_transfer_confirm", { bankName: bankNm })
                : t("own_account_transfer.engine.quit_confirm", { bankName: bankNm });
            sysDialog.open({
                type:        "confirmation",
                title:       t("dialog.confirmation"),
                description,
                confirmText: t("dialog.yes"),
                cancelText:  t("dialog.no"),
                onConfirm: () => respond(true),
                onCancel:  () => respond(false),
            });
        };
        window.addEventListener(NXISAS_SYSTEM_CONFIRM_EVENT, onSystemConfirm);
        return () => window.removeEventListener(NXISAS_SYSTEM_CONFIRM_EVENT, onSystemConfirm);
    }, [sysDialog, t]);

    // --- Step-1 form state -----------------------------------------
    // Current source key — `${bankCd}:${acctNo}`. Initialised from the
    // row the user clicked Transfer on, but the user can swap to any
    // other transferable VND account via the From Bank dropdown
    // (Figma 167:15759).
    const [sourceKey,    setSourceKey]    = useState<string>("");
    const [targets,      setTargets]      = useState<OwnAccountTargetRow[]>([]);
    const [targetsBusy,  setTargetsBusy]  = useState(false);
    const [targetKey,    setTargetKey]    = useState<string>("");          // `${bankCd}:${acctNo}`
    const [amount,       setAmount]       = useState<string>("");          // raw string for input control
    const [acctPassword, setAcctPassword] = useState<string>("");
    const [feeBearer,    setFeeBearer]    = useState<"A" | "B">("A");
    const [rmrkSender,   setRmrkSender]   = useState<string>("");
    const [rmrkRecipient, setRmrkRecipient] = useState<string>("");

    // Seed `sourceKey` from the click-through row when the dialog
    // opens. Subsequent user dropdown changes update `sourceKey`
    // directly — this effect only re-seeds on prop change (reopen).
    useEffect(() => {
        if (source) setSourceKey(`${source.bankCd}:${source.acctNo}`);
    }, [source]);

    // Available source accounts for the dropdown: any VND row the user
    // can transfer FROM (server already filters by W-grant / ADMIN).
    // Same canTransfer guard the per-row Transfer button uses.
    const availableSources = useMemo(
        () => data.sources.filter((s) => s.canTransfer && s.ccyCd === "VND"),
        [data.sources],
    );

    // Resolved current source — looked up against the live source list
    // so a `data.reload()` (Update Balance) refreshes the row in place.
    // Falls back to the prop row before the first effect tick.
    const currentSource = useMemo<OwnAccountSourceRow | null>(() => {
        if (!sourceKey) return source;
        return (
            availableSources.find((s) => `${s.bankCd}:${s.acctNo}` === sourceKey)
            ?? source
        );
    }, [availableSources, sourceKey, source]);

    // --- Idempotency key (stable across confirm/retry within open) --
    const idempotencyKeyRef = useRef<string>(makeIdempotencyKey());
    useEffect(() => {
        // New open → new idempotency key. Closing + re-opening must
        // not re-use a prior key (legacy `trns_0001_007.ts` behaviour).
        if (source) idempotencyKeyRef.current = makeIdempotencyKey();
    }, [source]);

    // --- Submit state ----------------------------------------------
    const [submitting, setSubmitting] = useState(false);
    /* Sticky mirror of `submitting` — keeps Cancel / Back / Confirm
     * disabled across the minimum-visibility window so a fast
     * post-scrape resolution doesn't flicker the buttons. The raw
     * `submitting` boolean still gates state mutations and the
     * close-on-Esc guard (`handleClose`); only the UI-disabled
     * surface reads the sticky value. */
    const stickySubmitting = useStickyLoading(submitting);

    // --- Reset dependent form state on every source-account change -
    // Mirrors legacy `trns_0001_007.ts:392-412` (`snd_acct_callback`
    // wipes amount / target / password / both remark fields whenever
    // the "From Bank" selector changes). The fields belong to the
    // *previous* source's transfer attempt and must not leak across.
    //
    // Keyed by `sourceKey` (the stable `${bankCd}:${acctNo}` string)
    // so it does NOT fire on `data.reload()` — that path replaces
    // the row's *object identity* but keeps the same key, and the
    // user's in-flight typing must survive a balance refresh.
    useEffect(() => {
        if (!sourceKey) return;
        setTargetKey("");
        setAmount("");
        setAcctPassword("");
        setRmrkSender("");
        setRmrkRecipient("");
    }, [sourceKey]);

    // --- Load target list whenever the selected source-account
    // identity changes (NOT on a same-key reload — keyed by
    // `sourceKey` to avoid a busy-flash after `data.reload()`).
    useEffect(() => {
        if (!currentSource || !sourceKey) return;
        let cancelled = false;
        setTargetsBusy(true);
        data.loadTargets(currentSource)
            .then((list) => {
                if (cancelled) return;
                setTargets(list);
            })
            .catch((err) => {
                if (cancelled) return;
                sysDialog.open({
                    type:        "error",
                    title:       t("dialog.error"),
                    description: err instanceof Error
                        ? err.message
                        : t("own_account_transfer.composer.error.target_load_failed"),
                });
            })
            .finally(() => {
                if (!cancelled) setTargetsBusy(false);
            });
        return () => { cancelled = true; };
        // `currentSource` is re-derived from `sourceKey` so excluding
        // it from the dep list avoids re-running when the row object
        // is replaced (reload). The lookup inside is stable per key.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceKey, data, sysDialog, t]);

    // --- Reset on close --------------------------------------------
    const resetState = useCallback(() => {
        setSourceKey("");
        setTargets([]);
        setTargetKey("");
        setAmount("");
        setAcctPassword("");
        setFeeBearer("A");
        setRmrkSender("");
        setRmrkRecipient("");
        setSubmitting(false);
    }, []);

    const handleClose = useCallback(() => {
        if (submitting) return; // can't cancel mid-submit
        resetState();
        onClose();
    }, [resetState, onClose, submitting]);

    // Route a composer Cancel/X press to the active engine popup's
    // cancel, which raises the legacy WBC1152/WBC1140 quit confirmation
    // (`nxisas_v2.js:78`). Tries the tracked mirror first, then falls
    // back to clicking any legacy `.layerCont` Cancel still in the DOM —
    // the escape hatch for the case where the engine injected a popup
    // but its React mirror never surfaced (which otherwise leaves the
    // composer stuck in "Submitting…"). Returns true when a cancel was
    // dispatched. (audit fix 2026-06-01c)
    const requestEngineCancel = useCallback((): boolean => {
        if (confirmChallenge) { cancelNxisasConfirm(confirmChallenge.popup); return true; }
        if (otpChallenge)     { cancelNxisasOtp(otpChallenge.popup);         return true; }
        if (qnaChallenge)     { cancelNxisasQna(qnaChallenge.popup);         return true; }
        if (typeof document !== "undefined") {
            const legacyCancel = document.querySelector<HTMLElement>(
                ".layerCont.security-question .btn-st.common.cancel, "
                + ".layerCont.otp .btn-st.common.cancel, "
                + ".layerCont.captcha .btn-st.common.cancel, "
                + ".layerCont.transfer_confirmation .btn-area a.cancel",
            );
            if (legacyCancel) { legacyCancel.click(); return true; }
        }
        return false;
    }, [confirmChallenge, otpChallenge, qnaChallenge]);

    // Composer Cancel / X. While a transfer is in flight, do NOT ignore
    // the press (the old behaviour) — route it to the active engine
    // popup's cancel so the WBC1152/WBC1140 confirmation appears; the
    // engine abort (LOGIN_CAN) then clears the submitting lock. When not
    // submitting, this is the normal close.
    const handleCancelClick = useCallback(() => {
        if (submitting) {
            requestEngineCancel();
            return;
        }
        handleClose();
    }, [submitting, requestEngineCancel, handleClose]);

    // --- Derived ---------------------------------------------------
    const target = useMemo(() => {
        if (!targetKey) return null;
        return targets.find((t) => `${t.bankCd}:${t.acctNo}` === targetKey) ?? null;
    }, [targets, targetKey]);

    const parsedAmount = useMemo(() => {
        const cleaned = amount.replace(/[^\d]/g, "");
        return cleaned === "" ? NaN : Number(cleaned);
    }, [amount]);

    // --- Per-bank policy (audit fix 2026-06-01) --------------------
    // Fee-radio policy, remark UI shape, and remark byte-limits are all
    // bank-specific in the legacy `switch(bank_cd)` blocks. Resolve them
    // from the source bank + direction so the form matches legacy.
    const feePolicy    = currentSource ? getFeePolicy(currentSource.bankCd) : null;
    const remarkPolicy = currentSource ? getRemarkUiPolicy(currentSource.bankCd) : null;
    // Forced banks (IBK, Woori) pin the fee bearer; editable banks use
    // the user's radio choice. Computed (not stored) so a source-bank
    // change always reflects the forced value without a sync effect.
    const effectiveFeeBearer: "A" | "B" =
        feePolicy?.mode === "forced" && feePolicy.forcedBearer
            ? feePolicy.forcedBearer
            : feeBearer;
    // Direction-aware remark byte-limits. Before a To Bank is chosen the
    // legacy screen shows the WITHIN-bank limit (e.g. Vietcom 0/195, not
    // the inter-bank 0/180) — so treat "no target yet" as within-bank.
    // Once a target is picked, within when same bank, inter (NAPAS) when
    // cross-bank.
    const remarkLimits = currentSource
        ? getRemarkByteLimits(
              currentSource.bankCd,
              !target || currentSource.bankCd === target.bankCd,
          )
        : { sender: 210, recipient: 210 };

    const validation: OwnAccountTransferComposerValidation = useMemo(() => {
        if (!currentSource) return { ok: false, field: "target", messageKey: "" };
        return data.validateDraft({
            source: currentSource,
            target,
            amount: parsedAmount,
            acctPassword,
            remarkForSender: rmrkSender,
            remarkForRecipient: rmrkRecipient,
        });
    }, [currentSource, target, parsedAmount, acctPassword, rmrkSender, rmrkRecipient, data]);

    const nextEnabled = validation.ok && engine.status === "ready" && !submitting;

    // --- Next click — validate + build payload + call engine -------
    // Legacy parity (`trns_0001_007.ts:538` `#next_step` click handler):
    // form validation runs synchronously, then `fnTransferConfirmation`
    // builds the engine payload and immediately calls
    // `_v2nxisas.callNxisas(...)`. There is no in-app review step in
    // legacy — the bank's `_confirm_transfer_template` (now mirrored
    // by the React `<TransferConfirmationDialog>` via the
    // confirm-bridge) is the user's only confirmation surface.
    const handleConfirm = useCallback(async () => {
        if (!currentSource || !target) return;
        if (submitting) return;

        // Phase B pre-flight — same gate as Update Balance.
        // Transferring needs the bank IB login, which needs saved
        // cert material. Until `BANK_CERT_INFO` ports, the bundle
        // can't actually log in. Surface a precise Phase B notice
        // before kicking off the engine round-trip.
        if (!hasSavedBankCert(currentSource)) {
            sysDialog.open({
                type:        "warning",
                title:       t("dialog.warning"),
                description: t("own_account_transfer.composer.error.cert_not_configured"),
            });
            return;
        }

        setSubmitting(true);

        const transferType = currentSource.bankCd === target.bankCd ? "SAME_BANK" : "NAPAS";

        // Pre-transfer NAPAS validation (audit fix 2026-06-01) — legacy
        // `fnReadNapasBankCode` (`trns_0001_007.ts:2255-2294` →
        // `trns_0001_001_r003`) runs BEFORE the engine scrape. Cross-bank
        // (NAPAS) legs must resolve the recipient bank's NAPAS code in
        // the dictionary first; an unknown/blank code blocks the scrape
        // so the local NXiSAS engine is never invoked for an invalid
        // recipient. Same-bank legs skip this (no NAPAS routing). This
        // is a browser-side guard around the existing read endpoint — it
        // does NOT move transfer execution to the backend.
        if (transferType === "NAPAS") {
            const napas = await data.validateNapas(target.napasBankCd);
            if (!napas.ok) {
                setSubmitting(false);
                sysDialog.open({
                    type:        "error",
                    title:       t("dialog.error"),
                    description: t("own_account_transfer.composer.error.napas_invalid"),
                    errorCode:   napas.code,
                });
                return;
            }
        }

        // Remark resolution (audit fix 2026-06-01, refined 2026-06-01b):
        // Driven by the per-bank remark UI policy (legacy parity).
        //   • Company-name default — legacy `:568-572` fills an empty
        //     remark with COMP_NM for Vietcom + Shinhan only
        //     (policy.senderDefaultCompanyName). Never overwrites typed
        //     text.
        //   • Disabled-recipient banks (Vietcom/Shinhan/VIETIN — module/
        //     module4): the recipient row is read-only and empty, so the
        //     single legacy remark is the SENDER value. Mirror it into
        //     the recipient slot so the per-bank profile (Shinhan/Vietcom
        //     read `memo` off the recipient field; VIETIN reads sender)
        //     receives the single memo. The disabled recipient UI value
        //     is never sent.
        //   • Editable-recipient banks (Woori/IBK — module2/module3):
        //     send both typed values verbatim (memo = sender/applicant,
        //     memo2 = recipient/beneficiary).
        const policy          = getRemarkUiPolicy(currentSource.bankCd);
        const companyName     = userStorage.get()?.companyName ?? "";
        let   resolvedSender    = rmrkSender;
        let   resolvedRecipient = rmrkRecipient;
        if (policy.senderDefaultCompanyName && resolvedSender.trim().length === 0) {
            resolvedSender = companyName;
        }
        if (!policy.recipientEnabled) {
            // Single-remark bank — route the sender remark to the slot
            // the profile reads; ignore the disabled recipient field.
            resolvedRecipient = resolvedSender;
        } else if (policy.recipientDefaultCompanyName && resolvedRecipient.trim().length === 0) {
            // No allow-list bank sets this today, but honour the policy.
            resolvedRecipient = companyName;
        }

        const draft: OwnAccountTransferDraft = {
            source: currentSource,
            target,
            transferType,
            amount:         parsedAmount,
            acctPassword,
            feeBearer:      effectiveFeeBearer,
            remarkForRecipient: resolvedRecipient,
            remarkForSender:    resolvedSender,
            idempotencyKey: idempotencyKeyRef.current,
        };

        // 1. Build the engine payload + run the scrape (browser-side).
        //    `bankClass` carries the source bank's NXiSAS module CLASS,
        //    resolved per-credential variant via `resolveNxisasBankClass`
        //    (the stand-in for the deferred runtime `getModuleInfo`). For
        //    Vietcom this honours `nxisasGbSeqNo` (0 → CORPORATE / iB@nking,
        //    1 → DIGIBIZ) so the Vietcom DIGIBIZ job switch resolves in
        //    `bank-profiles.ts`.
        const orgObj: NxisasOrgObj = buildNxisasOrgObj({
            draft,
            internal:  draft.transferType === "SAME_BANK",
            remitDate: nowYyyymmddUtc(),
            bankClass: resolveNxisasBankClass(currentSource.bankCd, currentSource.nxisasGbSeqNo),
        });

        let engineResult: unknown;
        try {
            engineResult = await engine.runScraping([orgObj]);
        } catch (err) {
            // A confirmed Cancel can surface on the reject path too on
            // some bundle versions — treat LOGIN_CAN as a silent user
            // cancel, never an error toast. (audit fix 2026-06-01d)
            if (isLoginCancelled(err)
                || (err instanceof Error && err.message.includes(LOGIN_CANCEL_CODE))) {
                setSubmitting(false);
                return;
            }
            setSubmitting(false);
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: err instanceof Error
                    ? err.message
                    : t("own_account_transfer.composer.error.engine_failed"),
            });
            return;
        }

        // User cancelled the engine 2nd-cert (WBC1152/WBC1140 → Yes):
        // the bundle aborts with ErrorCode "LOGIN_CAN" / ErrorMessage
        // "You have canceled the operation." The result shape varies
        // (flat object OR an array of job headers with nested Output —
        // see the `objOutput` console dump), so detect it with a deep
        // scan BEFORE parsing/POSTing. Legacy does NOT persist a
        // cancelled transfer — clear the submitting lock and stay on the
        // composer (so the user can retry); no POST, no error dialog.
        // (audit fix 2026-06-01d)
        if (isLoginCancelled(engineResult)) {
            setSubmitting(false);
            return;
        }

        // B1: decrypt the engine `Output.Result` before parsing — the
        // legacy `nxisas_decrypt` seam. The LOGIN_CAN check above runs on
        // the still-encrypted result because `ErrorCode` is plaintext;
        // only `Output.Result` (the transfer payload) is SEED-CBC
        // ciphertext. Backend flag-gated (`wecms.oat.seed-decrypt.enabled`)
        // and best-effort — echoes the input unchanged when OFF or on any
        // failure, so this never breaks the flow.
        engineResult = await decryptNxisasResult(engineResult);

        // 2. Parse the engine outcome — legacy `trns_0001_007.ts:2144-2175`
        //    walks orgObj[] → result[] → Output and reads ErrorCode /
        //    ErrorMessage plus Result.transfer[0] on success.
        const outcome = parseEngineOutcome(engineResult);

        // 3. POST the result to Spring.
        //    Field provenance mirrors legacy `transferObj1`: on success the
        //    BANK-echoed values win (TRSC_AMT/FEE/RMRK/RMRK2/OWAC_NM from
        //    `Result.transfer[0]`); on failure — and for anything the engine
        //    did not report — the composed values stand, exactly as the
        //    legacy else-branch does.
        //
        //    Two-channel account/currency contract (legacy-parity fix
        //    2026-08-18, item #4). Legacy overwrites OUT_ACCT_NO /
        //    IN_ACCT_NO / CCY_CD from `Result.transfer[0]` on success
        //    (`trns_0001_007.ts:2157-2158, 2163`) and performs NO ownership
        //    re-validation afterwards (`trns_0002_001_c001_act.jsp:27-56`).
        //    Spring DOES re-validate ownership, so the two roles are split:
        //      • `source_*` / `target_*` / `ccy_cd` — the values the user
        //        actually selected. PRE-transfer identity: Spring validates
        //        ownership + VND scope on these, exactly as before.
        //      • `engine_out_acct_no` / `engine_in_acct_no` / `engine_ccy_cd`
        //        — what the bank echoed. POST-transfer record: persisted
        //        verbatim into the legacy columns, never looked up, never
        //        validated beyond a length cap. A bank-normalized account
        //        number therefore cannot reject a completed transfer.
        //      • bank_tx_id — legacy maps no engine field to TRS_ID here.
        const req: ApiOwnAccountTransferScrapingResultRequest = {
            idempotency_key:      draft.idempotencyKey,
            transfer_type:        draft.transferType,
            source_bank_cd:       draft.source.bankCd,
            source_acct_no:       draft.source.acctNo,
            target_bank_cd:       draft.target.bankCd,
            target_napas_bank_cd: draft.target.napasBankCd,
            target_acct_no:       draft.target.acctNo,
            target_owac_nm:       clampWire(outcome.acceptName, 200)
                                  ?? draft.target.acctNickNm,
            ccy_cd:               "VND",
            requested_amt:        String(draft.amount),
            actual_amt:           outcome.actualAmt ?? String(draft.amount),
            bank_tx_id:           outcome.bankTxId ?? "",
            // Legacy stores `objOutput.ErrorCode` as received (initial
            // value ""), never a synthesized code. "99999999" is the
            // Transfer-History Failed FILTER sentinel only.
            trns_stts:            outcome.trnsStts ?? "",
            trns_msg:             clampWire(outcome.trnsMsg, 255),
            fee:                  outcome.fee,
            fee_dfr_sbj:          draft.feeBearer,
            rmrk:                 clampWire(outcome.memo,  500)
                                  ?? (draft.remarkForRecipient || null),
            rmrk2:                clampWire(outcome.memo2, 500)
                                  ?? (draft.remarkForSender    || null),
            engine_out_acct_no:   clampWire(outcome.outAcctNo, 100),
            engine_in_acct_no:    clampWire(outcome.inAcctNo,  100),
            engine_ccy_cd:        clampWire(outcome.ccyCd,       3),
            engine_vendor:        "COCON",
            engine_version:       null,
        };

        // Retry-on-error contract (legacy `trns_0001_007.ts:889-906`):
        //   • engine reports failure (non-"00000000" trns_stts) →
        //     keep the composer OPEN at Step-2 so the user can hit
        //     Confirm again. Form values are preserved; the
        //     idempotency key is also preserved so the eventual
        //     successful POST replays through the partial-uniq index
        //     and Spring short-circuits to `already_recorded = true`.
        //   • intake POST itself errors (network / server fault) →
        //     same — leave the modal open. Spring may or may not have
        //     persisted; a retry with the same key is the safe path.
        //   • engine + intake both succeed AND Spring reports
        //     `status === "success"` → close the dialog and refresh
        //     the source list.
        try {
            const resp = await data.submitScrapingResult(req);
            setSubmitting(false);
            if (resp.status === "success") {
                sysDialog.open({
                    type:        "success",
                    title:       t("dialog.success"),
                    description: t("own_account_transfer.composer.success.message"),
                });
                // Refresh the parent picker + close. Step-2 → idle.
                onRecorded();
                resetState();
                onClose();
                return;
            }
            // Spring stored the failed engine outcome (audit row) but
            // the bank itself rejected. Keep the dialog open for retry
            // — user may want to change amount/remark and Confirm
            // again.
            //
            // Message source follows legacy's own branch chain — see
            // `resolveTransferErrorMessage`: `8000F110` → generic sentence,
            // OTP / transfer-password codes → the RAW bank message,
            // everything else → `getScrapingMessage` (so the `80002411`
            // substitution applies). Legacy renders all three through
            // `WBE1135`, whose template is literally `#{MSG}`.
            //
            // Code = the verbatim engine status. Legacy's primitive prints
            // `(오류코드: WBE1135)` — its own message code, not the bank's
            // (`add.js:713-717`) — so showing the real engine code here is a
            // deliberate, product-approved improvement, not a parity miss.
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: resolveTransferErrorMessage(resp.trns_stts, outcome.trnsMsg, t),
                errorCode:   resp.trns_stts,
            });
        } catch (err) {
            setSubmitting(false);
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            const message = err instanceof Error
                ? err.message
                : t("own_account_transfer.composer.error.intake_failed");
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
            // Intentionally NOT calling onClose / resetState — see
            // retry-on-error contract above.
        }
    }, [
        currentSource, target, submitting, parsedAmount, acctPassword,
        effectiveFeeBearer,
        rmrkRecipient, rmrkSender, engine, data, sysDialog, t,
        onRecorded, onClose, resetState,
    ]);

    // --- Update Balance --------------------------------------------
    // Mirrors legacy `trns_0001_007.ts:374-389` (button click) →
    // `1549-1680` (engine BALANCE job) → `1686-1763` (POST to
    // `trns_0001_001_u001.jct`). Browser-side only:
    //
    //   1. Build a BALANCE org-obj for the current source
    //   2. `engine.runScraping([orgObj])` — local NXiSAS engine
    //      logs into the bank IB site and pulls the latest balance
    //   3. POST the engine outcome to Spring `/balance-refresh`
    //      (ACCT_MSTR patch + audit row). On failure surface the
    //      same shared system-dialog error path as transfer intake.
    //   4. `data.reload()` so the picker (and `currentSource`,
    //      derived from `data.sources`) reflects the new balance +
    //      `lastInquiryAt` timestamp the row carries.
    //
    // NO server-side .exe is ever invoked — the scraper is the
    // user-local NXiSAS bundle, and Spring is strictly post-scrape.
    const [updating, setUpdating] = useState(false);
    const handleUpdateBalance = useCallback(async () => {
        if (!currentSource || updating) return;
        if (engine.status !== "ready") {
            sysDialog.open({
                type:        "warning",
                title:       t("dialog.warning"),
                description: t("own_account_transfer.composer.error.engine_not_ready"),
            });
            return;
        }

        // Phase B pre-flight — every allow-list bank's IB login
        // requires saved cert material (`bankCertSeq` / `loginID` /
        // `loginPWD`) the refactor doesn't surface yet. Without it,
        // the bundle would send a LOGIN request with empty creds
        // and the bank would reject with a generic "login failed"
        // message — confusing for the user. Surface a precise
        // Phase B notice instead. See
        // `lib/nxisas/jexjs-adapter.ts` Phase B endpoint list.
        if (!hasSavedBankCert(currentSource)) {
            sysDialog.open({
                type:        "warning",
                title:       t("dialog.warning"),
                description: t("own_account_transfer.composer.error.cert_not_configured"),
            });
            return;
        }

        setUpdating(true);

        // 1. BALANCE org-obj. Legacy `trns_0001_007.ts:1594-1614`
        //    builds a single-job array; Woori VN flips `nonLogin`
        //    off (separate IB login flow).
        //
        //    Phase B: cert fields come from the source-account row
        //    (backend joins `BANK_CERT_INFO` via
        //    `ACCT_MSTR.BANK_CERT_SEQ`, which is populated by the
        //    Settings → Login Credentials → Account Picker flow via
        //    `AccountRegistrationService`). `loginID` / `loginPWD`
        //    mirror the legacy aliasing at `trns_0001_007.ts:1583-1584`.
        const balOrgObj = {
            bankCd:        currentSource.bankCd,
            bankNm:        currentSource.bankNm,
            certInfoCon:   currentSource.certInfoCon   ?? "",
            bankCertSeq:   currentSource.bankCertSeq   ?? "",
            nxisasGbSeqNo: currentSource.nxisasGbSeqNo ?? "",
            loginID:       currentSource.loginID       ?? currentSource.certInfoCon ?? "",
            loginPWD:      currentSource.loginPWD      ?? "",
            nonLogout:     true,
            ...(currentSource.bankCd === "11704020" ? { nonLogin: false } : {}),
            job: [{
                Job: "BALANCE",
                Input: {
                    acctNum:    currentSource.acctNo,
                    currency:   currentSource.ccyCd,
                    acctNumPWD: acctPassword || "",
                },
            }],
        };

        // 2. Run the scrape. Any thrown / rejected promise here
        //    means the engine never produced an outcome (bundle
        //    fault / user-cancelled OTP / etc.) — surface the
        //    shared error dialog and bail without writing anything.
        let engineResult: unknown;
        try {
            engineResult = await engine.runScraping([balOrgObj]);
        } catch (err) {
            // Confirmed Cancel on the reject path → silent user cancel.
            if (isLoginCancelled(err)
                || (err instanceof Error && err.message.includes(LOGIN_CANCEL_CODE))) {
                setUpdating(false);
                return;
            }
            setUpdating(false);
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: err instanceof Error
                    ? err.message
                    : t("own_account_transfer.composer.error.engine_failed"),
            });
            return;
        }

        // User cancelled the balance inquiry's engine 2nd-cert
        // (WBC1152 → Yes → ErrorCode "LOGIN_CAN" / "You have canceled
        // the operation."). Deep-scan the raw result (flat or nested
        // array shape) BEFORE parsing. Legacy does NOT persist a
        // cancelled inquiry — clear the updating lock and bail quietly;
        // no /balance-refresh POST, no error dialog. (audit fix 2026-06-01d)
        if (isLoginCancelled(engineResult)) {
            setUpdating(false);
            return;
        }

        // B1: decrypt the engine `Output.Result` before parsing the
        // balance — the legacy `nxisas_decrypt` seam. LOGIN_CAN above is
        // read from the plaintext `ErrorCode`; only `Output.Result` (the
        // balance payload) is SEED-CBC ciphertext. Backend flag-gated and
        // best-effort (echo when OFF / on failure), so this is
        // behaviour-neutral until the flag is flipped per bank.
        engineResult = await decryptNxisasResult(engineResult);

        // 3. Parse the engine callback. Legacy reads
        //    `Result.balance[0]` for the successful payload and
        //    `ErrorCode` / `ErrorMessage` for the diagnostic strings.
        const parsed = parseBalanceOutcome(engineResult);

        // 4. Legacy gate — persist ONLY on success (`trns_0001_007.ts:1709-1734`,
        //    identical at `trns_0001_001.ts:1305-1323`):
        //
        //      if (ACCT_BAL_INQ_STTS == "00000000") {
        //          if (isEmpty(BAL)) { showMessage('WBE6021', …); return; }
        //      } else {
        //          if (STTS === "8000F110")            showMessage("WBE9999");
        //          else if (STTS != "" && MSG != "")   showMessage("WBW1103", …);
        //          return;                       // ← never reaches the AJAX
        //      }
        //      jexjs.createAjaxUtil("trns_0001_001_u001") …   // success only
        //
        //    So `ACCT_MSTR.ACCT_BAL_INQ_STTS` is only ever written as
        //    "00000000" in legacy — a failure code is never persisted, and
        //    neither is a synthesized one. (The action JSP would store a
        //    failure if it were ever called — `trns_0001_001_u001_act.jsp:93-99`
        //    — but no caller passes one; the gate is on the client.)
        const balStatus = (parsed.status ?? "").trim();

        if (balStatus !== ENGINE_SUCCESS_STTS) {
            setUpdating(false);
            // Legacy shows NOTHING when the code or the message is blank —
            // its `STTS != "" && MSG != ""` guard simply fails.
            const description = resolveBalanceErrorMessage(balStatus, parsed.message, t);
            if (description !== null) {
                sysDialog.open({
                    type:        "error",
                    title:       t("dialog.error"),
                    description,
                    // Verbatim engine code, never a sentinel. Omitted when the
                    // engine reported none.
                    errorCode:   balStatus.length > 0 ? balStatus : undefined,
                });
            }
            // No POST and no list reload — legacy returns before both.
            return;
        }

        if (parsed.bal === null) {
            // Legacy `WBE6021` — "#{FIELD_NM} is required." with FIELD_NM
            // "Balance" (`trns_0001_007.ts:1711-1715`). Success code but no
            // usable balance ⇒ still no save.
            setUpdating(false);
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: t("own_account_transfer.composer.error.balance_required"),
            });
            return;
        }

        const req: ApiBalanceRefreshRequest = {
            bank_cd:           currentSource.bankCd,
            acct_no:           currentSource.acctNo,
            bal:               parsed.bal,
            real_amt:          parsed.realAmt,
            // Only ever the success code — see the legacy gate above.
            acct_bal_inq_stts: ENGINE_SUCCESS_STTS,
            acct_bal_inq_msg:  parsed.message,
            ccy_cd:            "VND",
        };

        try {
            await postBalanceRefresh(req);
        } catch (err) {
            setUpdating(false);
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            const message = err instanceof Error
                ? err.message
                : t("own_account_transfer.composer.error.intake_failed");
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
            return;
        }

        // 5. Refresh the source list so Available Balance + Last
        //    Updated reflect the new ACCT_MSTR state.
        try {
            await data.reload();
        } finally {
            setUpdating(false);
        }
    }, [currentSource, updating, engine, acctPassword, data, sysDialog, t]);

    if (!source || !currentSource) return null;

    /* =================================================================
     *  Render
     * ================================================================= */

    return (
        <>
        {qnaChallenge ? (
            // Mirror the bundle's hidden security-question popup with
            // the existing React `<QnaDialog>`. `stackLevel={4}` is the
            // component's built-in level (designed for the Settings →
            // Registered → Login ID/PW → QNA chain); inside the OAT
            // composer it sits cleanly above the composer's L1 dialog
            // — `z-[81]` content over the composer's `z-50`, so the
            // user can only interact with the QNA dialog. The
            // composer's `closeOnOutsideClick={false}` already blocks
            // backdrop bleed-through.
            <QnaDialog
                bankName={qnaChallenge.bankName}
                loginId={qnaChallenge.loginId}
                questions={qnaChallenge.questions}
                onSubmit={({ hidden_value, question, answer }) => {
                    // Bridge writes back to the hidden legacy DOM +
                    // fires the bundle's `.save` click. The bundle's
                    // existing jQuery delegate at `nxisas_v2.js:137`
                    // builds the input header + invokes
                    // `_v2nxisas.execute(...)` synchronously, then
                    // closes the popup on success (which fires the
                    // MutationObserver's removal branch, dispatching
                    // `wb:nxisas-qna-dismiss` → clears local state).
                    submitNxisasQna(qnaChallenge.popup, hidden_value, question, answer);
                }}
                onCancel={() => {
                    // Route through the legacy Cancel handler → raises
                    // the WBC1152/WBC1140 quit confirmation. Do NOT clear
                    // the mirror here: wait for the QNA_DISMISS_EVENT the
                    // bundle fires only when the user confirms Yes and the
                    // popup is actually removed. On No, the popup (and this
                    // mirror) stay open. (audit fix 2026-06-01c)
                    cancelNxisasQna(qnaChallenge.popup);
                }}
            />
        ) : null}
        {confirmChallenge ? (
            // Mirror the bundle's hidden transfer-confirmation popup
            // with the React <TransferConfirmationDialog>. Single
            // source of UI truth — the same component the dev preview
            // (`?preview=nxisas`) imports and feeds mock data; here
            // we pass values extracted by the confirm-bridge from
            // the hidden `.layerCont.transfer_confirmation` DOM.
            // Same stackLevel (4) as the sibling <QnaDialog> so both
            // engine 2nd-cert surfaces paint identically above the
            // composer.
            <TransferConfirmationDialog
                open
                data={{
                    ...confirmChallenge.data,
                    // Recipient Bank display fix (2026-06-01e): the
                    // confirm-bridge reads this out of the legacy popup
                    // DOM, which can yield the literal string "undefined"
                    // when the bundle template had no bank-name value.
                    // Override with the composer's own selected To-Bank
                    // (`target`) so the row never renders undefined.
                    // Display-only — the engine payload is untouched.
                    recipientBank: resolveRecipientBankLabel(
                        confirmChallenge.data.recipientBank,
                        target,
                    ),
                }}
                onSubmit={(otpPwd) => {
                    submitNxisasConfirm(confirmChallenge.popup, otpPwd);
                }}
                onCancel={() => {
                    // Same as QNA: route to the legacy Cancel handler
                    // (WBC1140 transfer-cancel confirmation) and let the
                    // CONFIRM_DISMISS_EVENT clear this mirror only on Yes.
                    cancelNxisasConfirm(confirmChallenge.popup);
                }}
            />
        ) : null}
        {otpChallenge ? (
            // Mirror the bundle's hidden OTP popup with the React
            // <OtpAuthDialog>. Single source of UI truth — the same
            // component the dev preview (`?preview=nxisas`) imports
            // and feeds mock data; here we pass values extracted by
            // the otp-bridge from the hidden `.layerCont.otp` DOM.
            // On Submit the bridge writes `input[name='res'].value`
            // and fires the bundle's `.btn-st.primary.save` click,
            // so `_v2nxisas.execute(...)` continues the 2nd-cert
            // flow unchanged. On Cancel it fires `.cancel` which
            // closes the popup; the MutationObserver picks up the
            // removal and dispatches `wb:nxisas-otp-dismiss` →
            // local state clears.
            <OtpAuthDialog
                open
                data={otpChallenge.data}
                onSubmit={(otp) => {
                    submitNxisasOtp(otpChallenge.popup, otp);
                }}
                onCancel={() => {
                    // Same as QNA: route to the legacy Cancel handler
                    // (WBC1152/WBC1140 confirmation) and let the
                    // OTP_DISMISS_EVENT clear this mirror only on Yes.
                    cancelNxisasOtp(otpChallenge.popup);
                }}
            />
        ) : null}
        <Dialog
            open={source !== null}
            onOpenChange={(open) => { if (!open) handleCancelClick(); }}
        >
            {/* Engine-driven feature dialog — outside-click AND ESC
                dismiss are both off (CLAUDE.md §"Modal stack —
                interaction & close behaviour" rule 3, same precedent
                as `TransactionSyncDialog`). The composer drives a
                browser-side scrape + posts the result to Spring; a
                stacked system success / engine-challenge dialog
                could bubble pointer events to the overlay and close
                the parent mid-flight. Only the X icon, Cancel
                button, and the success-path `onClose` can dismiss
                the modal. */}
            <DialogContent
                className="max-w-[480px]"
                aria-describedby={undefined}
                closeOnOutsideClick={false}
                closeOnEscape={false}
            >
                <DialogHeader>
                    <DialogTitle>
                        {t("own_account_transfer.composer.title")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("own_account_transfer.composer.subtitle")}
                    </DialogDescription>
                </DialogHeader>

                <Step1Form
                    source={currentSource}
                    availableSources={availableSources}
                    sourceKey={sourceKey}
                    onSourceChange={setSourceKey}
                    targets={targets}
                    targetsBusy={targetsBusy}
                    targetKey={targetKey}
                    onTargetChange={setTargetKey}
                    amount={amount}
                    onAmountChange={setAmount}
                    acctPassword={acctPassword}
                    onAcctPasswordChange={setAcctPassword}
                    feeBearer={effectiveFeeBearer}
                    onFeeBearerChange={setFeeBearer}
                    feeForced={feePolicy?.mode === "forced"}
                    senderRemarkEnabled={remarkPolicy?.senderEnabled ?? true}
                    senderRemarkRequired={remarkPolicy?.senderRequired ?? false}
                    recipientRemarkEnabled={remarkPolicy?.recipientEnabled ?? false}
                    recipientRemarkRequired={remarkPolicy?.recipientRequired ?? false}
                    senderRemarkLimit={remarkLimits.sender}
                    recipientRemarkLimit={remarkLimits.recipient}
                    rmrkRecipient={rmrkRecipient}
                    onRmrkRecipientChange={setRmrkRecipient}
                    rmrkSender={rmrkSender}
                    onRmrkSenderChange={setRmrkSender}
                    onUpdateBalance={handleUpdateBalance}
                    updating={updating}
                    hasCredentials={hasSavedBankCert(currentSource)}
                    noCredentialsTooltip={t("own_account_transfer.no_credentials_tooltip")}
                />

                {/* Footer — single Cancel + Next pair. Next fires the
                    engine directly (legacy `trns_0001_007.ts:538`
                    `#next_step` click → `fnTransferConfirmation()` →
                    `_v2nxisas.callNxisas(...)` parity). The bank's
                    `_confirm_transfer_template` (mirrored via the
                    React `<TransferConfirmationDialog>`) is the only
                    transfer confirmation surface — there is no
                    in-app review step. */}
                <DialogFooter>
                    <button
                        type="button"
                        onClick={handleCancelClick}
                        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {t("own_account_transfer.composer.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleConfirm()}
                        disabled={!nextEnabled || stickySubmitting}
                        aria-busy={stickySubmitting || undefined}
                        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {stickySubmitting
                            ? t("own_account_transfer.composer.submitting")
                            : t("own_account_transfer.composer.next")}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}

/* ===================================================================
 *  Step 1 — form (Figma 167:15759)
 * ================================================================= */

/** Shared textarea chrome for every remark field. */
const REMARK_TEXTAREA_CLASS =
    "min-h-[48px] w-full resize-none rounded-[6px] bg-background px-3 py-2 text-wb-14 font-medium text-wb-ink shadow-wb-outline transition-[color,box-shadow] outline-none focus-visible:shadow-wb-focus";

/**
 * One remark row — "Remarks (for sender)" or "Remarks (for recipient)".
 * BOTH rows always render (legacy parity); `enabled=false` paints the
 * read-only gray textarea the legacy module-style banks show for the
 * recipient row.
 *
 * <p>When disabled: no placeholder (matches the empty gray box in the
 * legacy screenshots), `readOnly` so the value can't change, and the
 * byte counter still shows `0/<max>`. The disabled value is never sent
 * — the composer routes the sender remark to the engine instead.
 */
function RemarkField({
    label, required, enabled, value, onChange, maxBytes, placeholder,
}: {
    label:       string;
    required:    boolean;
    enabled:     boolean;
    value:       string;
    onChange:    (next: string) => void;
    maxBytes:    number;
    placeholder: string;
}) {
    return (
        <FieldLabel
            required={required}
            text={label}
            rightSlot={`${utf8ByteLength(value)}/${maxBytes}`}
        >
            <textarea
                value={value}
                onChange={enabled
                    ? (e) => onChange(clampUtf8Bytes(sanitizeRemark(e.target.value), maxBytes))
                    : undefined}
                rows={2}
                readOnly={!enabled}
                aria-disabled={!enabled || undefined}
                placeholder={enabled ? placeholder : ""}
                className={cn(
                    REMARK_TEXTAREA_CLASS,
                    !enabled && "cursor-not-allowed bg-wb-bg-active text-wb-muted",
                )}
                maxLength={maxBytes}
            />
        </FieldLabel>
    );
}

function Step1Form(props: {
    source:                OwnAccountSourceRow;
    /** All transferable VND source rows (already filtered to
     *  `canTransfer && ccyCd==='VND'`). Drives the From Bank
     *  dropdown — Figma 167:15759 shows the user can pick any of
     *  their accounts, not just the row they clicked Transfer on. */
    availableSources:      OwnAccountSourceRow[];
    sourceKey:             string;
    onSourceChange:        (next: string) => void;
    targets:               OwnAccountTargetRow[];
    targetsBusy:           boolean;
    targetKey:             string;
    onTargetChange:        (next: string) => void;
    amount:                string;
    onAmountChange:        (next: string) => void;
    acctPassword:          string;
    onAcctPasswordChange:  (next: string) => void;
    feeBearer:             "A" | "B";
    onFeeBearerChange:     (next: "A" | "B") => void;
    /** True for forced-fee banks (IBK, Woori) — radios render disabled
     *  and pinned to the forced bearer. */
    feeForced:             boolean;
    /** Per-bank remark-row policy (legacy parity). BOTH rows always
     *  render; the recipient row is disabled/read-only for module-style
     *  banks (Vietcom/Shinhan/VIETIN) and editable for Woori/IBK. */
    senderRemarkEnabled:    boolean;
    senderRemarkRequired:   boolean;
    recipientRemarkEnabled: boolean;
    recipientRemarkRequired: boolean;
    /** Per-bank, per-direction UTF-8 byte limit for the sender remark. */
    senderRemarkLimit:     number;
    /** Per-bank, per-direction UTF-8 byte limit for the recipient remark. */
    recipientRemarkLimit:  number;
    rmrkRecipient:         string;
    onRmrkRecipientChange: (next: string) => void;
    rmrkSender:            string;
    onRmrkSenderChange:    (next: string) => void;
    onUpdateBalance:       () => void;
    updating:              boolean;
    /** False when the selected source bank has no saved Login
     *  Credentials — disables Update Balance (needs the bank-login
     *  scrape) and shows the explanatory tooltip. */
    hasCredentials:        boolean;
    noCredentialsTooltip:  string;
}) {
    const { t, locale } = useTranslation();
    return (
        // `<DialogContent>` is `flex flex-col` + `max-h-[calc(100vh-32px)]`
        // + `overflow-hidden`, so the body needs `min-h-0 flex-1
        // overflow-y-auto` to scroll within the cap while the header +
        // footer stay pinned. Without these, tall forms (Step-1 has
        // five sections: bank info / target / amount / transaction
        // details / remarks) get clipped — see screenshot 2026-05-20.
        //
        // `custom-scrollbar-y` applies the WeCMS thin/rounded scrollbar
        // (Figma WB365 nodes 9184:17484 / 9184:10787) — same utility
        // every other scroll region in the app uses (DataTableShell,
        // ReportLayout, BankFilterPopover, etc.) per CLAUDE.md §6c.
        <DialogBody className="custom-scrollbar-y flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
            <section className="flex flex-col gap-4">
                <h3 className="text-wb-14 font-semibold text-wb-ink">
                    {t("own_account_transfer.composer.section.bank_info")}
                </h3>

                <FieldLabel required text={t("own_account_transfer.composer.from_bank")}>
                    <AccountPickerSelect
                        value={props.sourceKey}
                        onChange={props.onSourceChange}
                        options={props.availableSources.map((src) => ({
                            key:   `${src.bankCd}:${src.acctNo}`,
                            label: formatAccountOption(src.bankNm, src.acctNo, src.acctTypeCd, src.ccyCd),
                        }))}
                        placeholderLabel={t("own_account_transfer.composer.choose_target")}
                    />
                </FieldLabel>

                <FieldLabel text={t("own_account_transfer.composer.available_balance")}>
                    <div className="flex items-center gap-2">
                        <Input
                            value={formatAmount(props.source.available, props.source.ccyCd, false)}
                            readOnly
                            // `h-8 py-2` overrides shadcn `<Input>`'s
                            // `h-11 py-3` default. Figma 167:15759
                            // specifies 16px content + 8px vertical
                            // padding = 32px total — `h-8`.
                            className="h-8 flex-1 bg-wb-bg-active py-2 text-right"
                        />
                        {/* Update Balance needs the bank-login scrape;
                            disable + tooltip when the source bank's Login
                            Credentials were deleted. The shared <Tooltip>
                            wraps the button in a hover-owning <span> so the
                            message shows even while the button is disabled. */}
                        <Tooltip content={!props.hasCredentials ? props.noCredentialsTooltip : undefined}>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={props.onUpdateBalance}
                                disabled={props.updating || !props.hasCredentials}
                                // h-8 matches the sibling Input + the
                                // From Bank / To Bank select triggers.
                                className="h-8 shrink-0"
                            >
                                {t("own_account_transfer.composer.update_balance")}
                            </Button>
                        </Tooltip>
                    </div>
                    {props.source.lastInquiryAt && (
                        <p className="text-wb-12 font-medium text-wb-muted">
                            {t("own_account_transfer.composer.last_updated_at", {
                                // `lastInquiryAt` (= ACCT_BAL_LST_INQ_DTM) is
                                // the RAW UTC 14-char wall-clock the backend
                                // now ships (the pre-shift was removed so the
                                // relative-time cell stops double-shifting).
                                // Convert UTC→Vietnam-local + per-locale date
                                // here via the shared helper. Empty → "".
                                when: composeLastUpdated(props.source.lastInquiryAt, locale),
                            })}
                        </p>
                    )}
                </FieldLabel>

                {/* Per-bank password visibility — legacy
                    `trns_0001_007.ts:1124-1149` disables the field
                    for Vietin/Vietcom/IBK (their engines don't read
                    `acctNumPWD`). Refactor matches via the shared
                    `isPasswordRequiredFor` matrix — required + enabled
                    for Shinhan/Woori/KEBHana, disabled + no asterisk
                    for the rest. The field stays visible so the form
                    layout stays stable across source-bank changes. */}
                {(() => {
                    const pwdRequired = isPasswordRequiredFor(props.source.bankCd);
                    return (
                        <FieldLabel
                            required={pwdRequired}
                            text={t("own_account_transfer.composer.account_password")}
                        >
                            <Input
                                type="password"
                                value={props.acctPassword}
                                onChange={(e) => props.onAcctPasswordChange(e.target.value)}
                                placeholder={t("own_account_transfer.composer.account_password_placeholder")}
                                autoComplete="new-password"
                                disabled={!pwdRequired}
                                className="h-8 py-2"
                            />
                        </FieldLabel>
                    );
                })()}

                <FieldLabel required text={t("own_account_transfer.composer.to_bank")}>
                    <AccountPickerSelect
                        value={props.targetKey}
                        onChange={props.onTargetChange}
                        disabled={props.targetsBusy}
                        options={props.targets.map((tgt) => ({
                            key:   `${tgt.bankCd}:${tgt.acctNo}`,
                            label: formatAccountOption(tgt.bankNm, tgt.acctNo, tgt.acctTypeCd ?? "03", tgt.ccyCd ?? "VND"),
                        }))}
                        placeholderLabel={
                            props.targetsBusy
                                ? t("own_account_transfer.composer.loading_targets")
                                : t("own_account_transfer.composer.choose_target")
                        }
                    />
                </FieldLabel>

                <FieldLabel required text={t("own_account_transfer.composer.transfer_amount")}>
                    {/* Thousands-separator on display, raw digits in
                       state. Legacy `trns_0001_007.ts:1178-1184` masks
                       the amount with `_inputNumberDefaultMask` for
                       VND (vi-VN dot grouping). We strip non-digits on
                       every keystroke so the stored value can be
                       `Number(...)`-parsed directly by `parsedAmount`,
                       and re-format for display. */}
                    <Input
                        type="text"
                        inputMode="numeric"
                        value={formatVndDigits(props.amount)}
                        onChange={(e) => props.onAmountChange(stripToDigits(e.target.value))}
                        placeholder="0"
                        className="h-8 py-2 text-right"
                    />
                </FieldLabel>
            </section>

            <section className="flex flex-col gap-4">
                <h3 className="text-wb-14 font-semibold text-wb-ink">
                    {t("own_account_transfer.composer.section.transaction_details")}
                </h3>

                {/* Fee radios — per-bank policy (audit fix 2026-06-01).
                    Forced banks (IBK forces key N/val 2 → "B"; Woori
                    pins Sender → "A") render disabled radios checked at
                    the forced value; the disabled inputs can't fire
                    onChange so the payload always carries the legacy
                    forced value. Editable banks (Vietcom/Shinhan/VIETIN)
                    behave as before. */}
                <FieldLabel text={t("own_account_transfer.composer.transaction_fee")}>
                    <div className="flex items-center gap-6">
                        <label className={cn(
                            "flex items-center gap-2 text-wb-13 font-medium text-wb-ink",
                            props.feeForced ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                        )}>
                            <input
                                type="radio"
                                name="oat-fee-bearer"
                                value="A"
                                checked={props.feeBearer === "A"}
                                onChange={() => props.onFeeBearerChange("A")}
                                disabled={props.feeForced}
                                className="size-4 accent-brand"
                            />
                            {t("own_account_transfer.composer.fee_sender")}
                        </label>
                        <label className={cn(
                            "flex items-center gap-2 text-wb-13 font-medium text-wb-ink",
                            props.feeForced ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                        )}>
                            <input
                                type="radio"
                                name="oat-fee-bearer"
                                value="B"
                                checked={props.feeBearer === "B"}
                                onChange={() => props.onFeeBearerChange("B")}
                                disabled={props.feeForced}
                                className="size-4 accent-brand"
                            />
                            {t("own_account_transfer.composer.fee_recipient")}
                        </label>
                    </div>
                </FieldLabel>

                {/* Remark rows — legacy parity (audit fix 2026-06-01b).
                    BOTH rows ALWAYS render with the legacy labels
                    "Remarks (for sender)" / "Remarks (for recipient)".
                    The recipient row is read-only/disabled (gray) for
                    module-style banks (Vietcom/Shinhan/VIETIN) and
                    editable for Woori/IBK — never hidden. Required marks,
                    enabled state, and per-bank/per-direction byte limits
                    all come from the bank policy (legacy `:486-491,
                    558-576,1258-1316`). The "company name" placeholder
                    shows on every enabled field (UI copy); the actual
                    COMP_NM auto-fill happens at submit for Vietcom +
                    Shinhan only. */}
                <RemarkField
                    label={t("own_account_transfer.composer.remark_sender")}
                    required={props.senderRemarkRequired}
                    enabled={props.senderRemarkEnabled}
                    value={props.rmrkSender}
                    onChange={props.onRmrkSenderChange}
                    maxBytes={props.senderRemarkLimit}
                    placeholder={t("own_account_transfer.composer.remark_sender_placeholder")}
                />
                <RemarkField
                    label={t("own_account_transfer.composer.remark_recipient")}
                    required={props.recipientRemarkRequired}
                    enabled={props.recipientRemarkEnabled}
                    value={props.rmrkRecipient}
                    onChange={props.onRmrkRecipientChange}
                    maxBytes={props.recipientRemarkLimit}
                    placeholder={t("own_account_transfer.composer.remark_sender_placeholder")}
                />
            </section>
        </DialogBody>
    );
}

/* ===================================================================
 *  Small render helpers
 * ================================================================= */

function FieldLabel({
    text, required, rightSlot, children,
}: {
    text:       string;
    required?:  boolean;
    rightSlot?: React.ReactNode;
    children:   React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <label className={cn(
                    "text-wb-13 font-medium text-wb-ntrl-8",
                    required && "after:ml-0.5 after:text-wb-status-rejected-text after:content-['*']",
                )}>
                    {text}
                </label>
                {rightSlot && (
                    <span className="text-wb-12 font-medium text-wb-muted">{rightSlot}</span>
                )}
            </div>
            {children}
        </div>
    );
}

/* -------------------------------------------------------------------
 *  AccountPickerSelect — custom popover dropdown used for both
 *  From Bank and To Bank in Step-1.
 *
 *  The native <select> falls back to OS chrome (system font, OS
 *  scrollbar, no design-token control) which doesn't match the
 *  WeCMS visual system. This control mirrors the BankFilterPopover
 *  pattern from the page (custom <ul> + <li> with brand-highlight
 *  on the selected row + outside-click + Esc to dismiss).
 * ----------------------------------------------------------------- */
type AccountPickerOption = { key: string; label: string };

function AccountPickerSelect({
    value, onChange, options, placeholderLabel, disabled,
}: {
    value:            string;
    onChange:         (next: string) => void;
    options:          AccountPickerOption[];
    /** Trigger label shown when no option is selected (and the
     *  option list is hidden). Mirrors legacy "Select" placeholder. */
    placeholderLabel: string;
    disabled?:        boolean;
}) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef    = useRef<HTMLUListElement>(null);

    const selected = options.find((o) => o.key === value) ?? null;

    // Outside-click + Esc dismiss. Deferred to the next microtask so
    // the mousedown that opened the popover doesn't immediately close
    // it (the trigger button lives outside the <ul>).
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            if (cancelled) return;
            document.addEventListener("mousedown", onDocClick);
            document.addEventListener("keydown", onKey);
        }, 0);
        const onDocClick = (e: MouseEvent) => {
            const t = e.target as Node;
            if (listRef.current?.contains(t)) return;
            if (triggerRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => !disabled && setOpen((o) => !o)}
                disabled={disabled}
                // Visually identical to `<Input>` (components/ui/input.tsx)
                // with the composer's Figma-spec compact sizing:
                // `h-8 rounded-[6px] bg-background px-3 text-wb-14
                // shadow-wb-outline`. Figma 167:15759 dictates 32px total
                // (16px content + 8px vertical padding); the shadow IS
                // the border (no explicit `border` class) — matches every
                // other text input the composer renders.
                className={cn(
                    "flex h-8 w-full items-center justify-between gap-2 rounded-[6px] bg-background px-3 text-left text-wb-14 font-medium text-wb-ntrl-8 shadow-wb-outline transition-[color,box-shadow] outline-none",
                    "focus-visible:shadow-wb-focus",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                )}
            >
                <span className={cn("truncate", !selected && "text-wb-muted")}>
                    {selected ? selected.label : placeholderLabel}
                </span>
                {/* Chevron — inline SVG so we don't pull in lucide just for one glyph. */}
                <svg className="size-3.5 shrink-0 text-wb-ntrl-6" viewBox="0 0 12 12" fill="none">
                    <path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </button>

            {open && options.length > 0 && (
                <ul
                    ref={listRef}
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto overflow-x-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
                >
                    {options.map((opt) => {
                        const isSelected = opt.key === value;
                        return (
                            <li
                                key={opt.key}
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                    onChange(opt.key);
                                    setOpen(false);
                                }}
                                className={cn(
                                    "cursor-pointer truncate whitespace-nowrap px-3 py-2 text-wb-13 font-medium",
                                    isSelected
                                        ? "bg-brand text-white"
                                        : "text-wb-ntrl-8 hover:bg-wb-bg-active",
                                )}
                            >
                                {opt.label}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

/** Compose the account-row label used by both From Bank and To Bank
 *  dropdowns. Format: `BankName  AcctNo  Current (VND)` — Figma
 *  167:15759. `acctTypeCd === "03"` → "Current"; everything else
 *  falls back to "Savings" (Path A scope = VND own-account only). */
function formatAccountOption(
    bankNm:     string,
    acctNo:     string,
    acctTypeCd: string,
    ccyCd:      string,
): string {
    const kind = acctTypeCd === "03" ? "Current" : "Savings";
    return `${bankNm} ${acctNo} ${kind} (${ccyCd})`;
}

/* ===================================================================
 *  Engine outcome parser
 * ================================================================= */

export type EngineOutcome = {
    bankTxId:   string | null;
    /** Engine-echoed `remitAmt`, normalized to a VND integer-digit
     *  string. `null` when the engine reported no (parseable) amount —
     *  the caller then falls back to the composed amount, exactly as
     *  legacy's else-branch does. */
    actualAmt:  string | null;
    /** `Output.ErrorCode` VERBATIM. Empty string when the engine job
     *  carried no code; NEVER a synthesized sentinel. */
    trnsStts:   string | null;
    trnsMsg:    string | null;
    /** `Output.Result.transfer[0].fee` — legacy `FEE`. */
    fee:        number | null;
    /** `Output.Result.transfer[0].memo` — legacy `RMRK`. */
    memo:       string | null;
    /** `Output.Result.transfer[0].memo2` — legacy `RMRK2`. */
    memo2:      string | null;
    /** `Output.Result.transfer[0].acceptName` — legacy `OWAC_NM`. */
    acceptName: string | null;
    /** `Output.Result.transfer[0].acctNum` — legacy `OUT_ACCT_NO`
     *  (`trns_0001_007.ts:2157`). Recorded, never used to look an account up. */
    outAcctNo:  string | null;
    /** `Output.Result.transfer[0].remitAcctNum` — legacy `IN_ACCT_NO` (`:2163`). */
    inAcctNo:   string | null;
    /** `Output.Result.transfer[0].currency` — legacy `CCY_CD` (`:2158`). */
    ccyCd:      string | null;
};
/** Engine error code for an explicit user cancellation. The legacy
 *  bundle's quit-confirmation "Yes" path aborts with this code +
 *  ErrorMessage "You have canceled the operation."
 *  (`nxisas_v2.js` `run_afterLoginFail`). */
const LOGIN_CANCEL_CODE = "LOGIN_CAN";

/** Engine success code. Legacy gates the success branch of the transfer
 *  result mapping on `objOutput.ErrorCode == "00000000"`
 *  (`trns_0001_007.ts:2156`). */
const ENGINE_SUCCESS_STTS = "00000000";

/** The one engine code legacy replaces with its own sentence instead of
 *  showing the bank's `ErrorMessage` — see {@link getScrapingMessage}. */
const ENGINE_CODE_SENDER_ACCT_BLOCKED = "80002411";

/** Engine code legacy treats as an unexpected system fault: it suppresses the
 *  bank's own text and shows the generic `WBE9999` sentence instead. Same
 *  handling on the TRANSFER path (`trns_0001_007.ts:886-888`) and the BALANCE
 *  path (`:1722-1723`), and identically in the sibling account-inquiry screens
 *  (`fnsh_0001_001.ts:1271`). */
const ENGINE_CODE_UNEXPECTED = "8000F110";

/**
 * Engine codes legacy classifies as **OTP** failures — verbatim from the
 * shared `trns_0001.errorOTPCode` array (`trns_0001_001.ts:167-168`).
 *
 * <p>Hardcoded on the shared `trns_0001` object; not configuration, not
 * per-bank. Their only effect is the message source: legacy shows the bank's
 * RAW `ErrorMessage` for these (and for {@link TRANSFER_PASSWORD_ERROR_CODES})
 * rather than routing through `getScrapingMessage`
 * (`trns_0001_007.ts:876-882` vs `:889-898`).
 *
 * <p><b>There is no OTP re-prompt in legacy.</b> The branch's comment
 * ("wrong OTP, Save transfer information then auto load Popup OTP") is an
 * unimplemented `TODO` — the branch does exactly what the generic branch does.
 */
const OTP_ERROR_CODES: readonly string[] = [
    "80003270", "80003271", "80003272", "80003273", "80003274", "80003275",
    "80003276", "80003277", "80003278", "8000327A", "8000327B", "8000327C",
    "8000327D",
];

/**
 * Engine codes legacy classifies as **transfer-password** failures — verbatim
 * from `trns_0001.errorTrnsPwdCode` (`trns_0001_001.ts:170-171`).
 *
 * <p><b>`80003232` is deliberately absent.</b> The legacy comment on `:169`
 * lists seven codes including it, but the array holds only six — so
 * `80003232` falls through to the generic branch and gets the
 * `getScrapingMessage` treatment. Reproduced verbatim: this is legacy
 * behaviour to match, not a defect to correct here.
 */
const TRANSFER_PASSWORD_ERROR_CODES: readonly string[] = [
    "80003230", "80003231", "80003233", "80003234", "80003235", "80003236",
];

/**
 * Deep-scan an engine callback payload for the {@link LOGIN_CANCEL_CODE}
 * user-cancel marker. The engine resolves `runScraping` with a free-form
 * shape that varies by bank + path — sometimes a flat object
 * (`{ErrorCode:"LOGIN_CAN"}`), sometimes an array of job headers each
 * carrying a nested `Output:{ErrorCode:"LOGIN_CAN"}` (as seen in the
 * `objOutput` console dump). A flat top-level field read misses the
 * nested case, so we recurse (depth-bounded) over arrays + objects and
 * match any status-bearing key equal to "LOGIN_CAN".
 *
 * <p>Used to treat a confirmed Cancel as an expected, silent user
 * cancellation — never an error toast, never a persisted record.
 */
function isLoginCancelled(raw: unknown, depth = 0): boolean {
    if (raw == null || depth > 6) return false;
    if (typeof raw === "string") return raw === LOGIN_CANCEL_CODE;
    if (Array.isArray(raw)) return raw.some((v) => isLoginCancelled(v, depth + 1));
    if (typeof raw === "object") {
        const o = raw as Record<string, unknown>;
        for (const k of ["ErrorCode", "errorCode", "trnsStts", "status", "TRNS_STTS"]) {
            if (typeof o[k] === "string" && o[k] === LOGIN_CANCEL_CODE) return true;
        }
        for (const v of Object.values(o)) {
            if (v && typeof v === "object" && isLoginCancelled(v, depth + 1)) return true;
        }
    }
    return false;
}

/**
 * Locate the engine job `Output` object inside a TRANSFER scrape result
 * — the transfer twin of {@link findBalanceOutput}.
 *
 * <p>Engine shape (`nxisas_v2.js:2073/2187/2227/2245` resolve the main
 * callback with `_v2nxisas.orgObj`): an ARRAY of org-objs, each carrying
 * a `result` ARRAY of job records, each job record carrying an `Output`
 * with {@code ErrorCode} / {@code ErrorMessage} and — on success —
 * {@code Result.transfer[0]}.
 *
 * <p>Legacy (`trns_0001_007.ts:2144-2175`, identical in the sibling
 * bulk screen `trns_0001_001.ts:1767-1799`) iterates
 * `$.each(result) → $.each(obj.result)` and assigns
 * `transferObj1.TRNS_STTS = objOutput.ErrorCode` on EVERY iteration, so
 * the LAST job record of the LAST org-obj wins. This walk reproduces
 * that selection exactly.
 *
 * <p>Flatter shapes (a bare job record, or an object that already looks
 * like an `Output`) are accepted as a fallback for engine variants that
 * don't nest. Depth-bounded; never throws.
 */
function findTransferOutput(raw: unknown, depth = 0): Record<string, unknown> | null {
    if (!raw || typeof raw !== "object" || depth > 6) return null;
    // Top-level array of org-objs — last Output wins (legacy parity).
    if (Array.isArray(raw)) {
        let found: Record<string, unknown> | null = null;
        for (const org of raw) {
            const o = findTransferOutput(org, depth + 1);
            if (o) found = o;
        }
        return found;
    }
    const r = raw as Record<string, unknown>;
    // org-obj with a `result` (lowercase) array of job records — legacy
    // `$.each(obj.result, …)`; the last job's Output wins.
    const jobs = r.result;
    if (Array.isArray(jobs)) {
        let found: Record<string, unknown> | null = null;
        for (const job of jobs) {
            if (job && typeof job === "object") {
                const out = (job as Record<string, unknown>).Output;
                if (out && typeof out === "object") {
                    found = out as Record<string, unknown>; // last job's Output
                }
            }
        }
        if (found) return found;
    }
    // A single job record carrying an `Output`.
    if (r.Output && typeof r.Output === "object") {
        return r.Output as Record<string, unknown>;
    }
    // Already an Output-like object (flat engine variant).
    if (typeof r.ErrorCode === "string" || typeof r.errorCode === "string"
        || typeof r.status === "string" || r.Result != null) {
        return r;
    }
    return null;
}

/**
 * Normalize an engine-reported amount to a VND integer-digit string.
 *
 * <p>The intake DTO constrains `requested_amt` / `actual_amt` to
 * {@code \d{1,15}} (VND has no fractional unit), so a bank that echoes
 * a grouped or decimal-suffixed string (`"3.362.692"`, `"3,362,692"`,
 * `"3362692.00"`) must be normalized or the POST would 400 — and a 400
 * here loses the record of a transfer the bank may already have made.
 * Anything that cannot be reduced to plain digits returns `null`, and
 * the caller falls back to the composed amount (legacy's else-branch
 * stores the entered `remitAmt` in exactly that situation).
 */
function parseEngineAmount(raw: unknown): string | null {
    if (typeof raw === "number") {
        return Number.isFinite(raw) && raw >= 0 && Number.isInteger(raw)
            ? String(raw) : null;
    }
    if (typeof raw !== "string") return null;
    // Strip currency symbols / spaces, keep digits + separators.
    let s = raw.trim().replace(/[^\d.,]/g, "");
    if (s.length === 0) return null;
    // Drop an all-zero DECIMAL tail ("3362692.00" / "3362692,00").
    //
    // The tail must be 1-2 digits to be a decimal fraction. Fixed 2026-08-18:
    // this was `/[.,]0+$/`, which also matched the last THOUSANDS GROUP of any
    // grouped amount ending in zeros — "1,200,000" lost ",000" and parsed as
    // 1200, and "1.500.000" parsed as 1500. That corrupted both the balance
    // read and `actual_amt` on the transfer path, understating a real transfer
    // by 1000x. A 3-digit trailing group is grouping, never a fraction.
    s = s.replace(/[.,]0{1,2}$/, "");
    // Remaining separators are thousands grouping (id-ID dots or commas).
    s = s.replace(/[.,]/g, "");
    return /^\d{1,15}$/.test(s) ? s : null;
}

/**
 * Port of legacy {@code trns_0001_007.getScrapingMessage}
 * (`trns_0001_007.ts:138-141`, identical in `trns_0001_001.ts:210-213`):
 *
 * <pre>{@code
 *   if (code == "80002411") return ML.get('trns_0001_007_js80002411', …);
 *   else return msg;
 * }</pre>
 *
 * One special-cased code; every other code shows the bank's own
 * {@code ErrorMessage} verbatim. The only refactor addition is the last
 * fallback: when the engine reported no message at all, legacy renders
 * `WBE1135` with a blank MSG placeholder, so the existing generic
 * sentence stands in rather than an empty dialog body.
 */
export function getScrapingMessage(
    code: string | null | undefined,
    msg:  string | null | undefined,
    t:    (key: string) => string,
): string {
    if ((code ?? "").trim() === ENGINE_CODE_SENDER_ACCT_BLOCKED) {
        return t("own_account_transfer.composer.error.engine_80002411");
    }
    return (msg ?? "").trim()
        || t("own_account_transfer.composer.error.engine_failed");
}

/**
 * Pick the failure text for a TRANSFER outcome the way legacy's branch chain
 * does (`trns_0001_007.ts:857-905`). Three distinct sources, in legacy's own
 * order of precedence:
 *
 * <ol>
 *   <li>{@code 8000F110} → the generic {@code WBE9999} sentence; the bank's own
 *       text is deliberately suppressed (`:886-888`).</li>
 *   <li>An OTP or transfer-password code → the bank's <b>RAW</b>
 *       {@code ErrorMessage}, because those two branches build
 *       {@code dObj = {dataObj:{MSG: result.TRNS_MSG}}} (`:859`, `:867`, `:878`)
 *       and never call {@code getScrapingMessage}.</li>
 *   <li>Anything else → {@link getScrapingMessage}, so the {@code 80002411}
 *       substitution applies (`:893-898`).</li>
 * </ol>
 *
 * <p>Legacy shows all three through {@code WBE1135}, whose body template is
 * literally {@code #{MSG}} — i.e. the dialog text IS this string.
 */
export function resolveTransferErrorMessage(
    code: string | null | undefined,
    msg:  string | null | undefined,
    t:    (key: string) => string,
): string {
    const c = (code ?? "").trim();
    if (c === ENGINE_CODE_UNEXPECTED) {
        return t("own_account_transfer.composer.error.engine_unexpected");
    }
    if (OTP_ERROR_CODES.includes(c) || TRANSFER_PASSWORD_ERROR_CODES.includes(c)) {
        // Raw bank message — legacy's OTP / transfer-password `dObj`.
        return (msg ?? "").trim()
            || t("own_account_transfer.composer.error.engine_failed");
    }
    return getScrapingMessage(c, msg, t);
}

/**
 * Pick the failure text for a BALANCE outcome the way legacy does
 * (`trns_0001_007.ts:1717-1731`, identical at `trns_0001_001.ts:1312-1321`):
 *
 * <ul>
 *   <li>{@code 8000F110} → generic {@code WBE9999}.</li>
 *   <li>Code AND message both non-blank → {@code WBW1103}, whose body is
 *       "An error occurred during the Online Account Inquiry process." followed
 *       by the raw {@code [code] : message} detail.</li>
 *   <li>Otherwise → {@code null}: legacy's {@code STTS != "" && MSG != ""}
 *       guard fails and <b>no dialog is shown at all</b>.</li>
 * </ul>
 */
export function resolveBalanceErrorMessage(
    code: string | null | undefined,
    msg:  string | null | undefined,
    t:    (key: string, vars?: Record<string, string | number>) => string,
): string | null {
    const c = (code ?? "").trim();
    const m = (msg  ?? "").trim();
    if (c === ENGINE_CODE_UNEXPECTED) {
        return t("own_account_transfer.composer.error.engine_unexpected");
    }
    if (c.length > 0 && m.length > 0) {
        return t("own_account_transfer.composer.error.balance_inquiry_failed",
                 { detail: `[${c}] : ${m}` });
    }
    return null;
}

/** `Output.Result.transfer[0].fee` → the wire's numeric `fee` (legacy
 *  `FEE`, a DECIMAL column). Reuses {@link parseEngineAmount} so a
 *  grouped/decimal bank string still lands as a number; unparseable →
 *  `null` (column stays NULL, as it does today). */
function toWireFee(raw: unknown): number | null {
    const digits = parseEngineAmount(raw);
    return digits === null ? null : Number(digits);
}

/** Trim an engine-supplied string to the intake DTO's `@Size` ceiling.
 *  A bank memo longer than the column would 400 the POST and lose the
 *  record of a transfer that already happened; legacy has no such
 *  constraint on the client side. Blank/absent → `null` so the caller's
 *  `??` falls through to the composed value (legacy else-branch). */
function clampWire(value: string | null, maxLen: number): string | null {
    if (value === null) return null;
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

/**
 * Parse the engine's TRANSFER callback payload — legacy
 * `trns_0001_007.ts:2144-2175`.
 *
 * <p>Field-for-field port of the legacy mapping:
 * <pre>
 *   transferObj1.TRNS_STTS = objOutput.ErrorCode;         // verbatim
 *   transferObj1.TRNS_MSG  = objOutput.ErrorMessage;
 *   if (objOutput.ErrorCode == "00000000" && objOutput.Result.transfer) {
 *       TRSC_AMT = Result.transfer[0].remitAmt;
 *       FEE      = Result.transfer[0].fee;
 *       RMRK     = Result.transfer[0].memo;
 *       RMRK2    = Result.transfer[0].memo2;
 *       OWAC_NM  = Result.transfer[0].acceptName;
 *   } else { …keeps the composed values… }
 * </pre>
 *
 * <p>The status is returned VERBATIM — `""` when the job carried no
 * `ErrorCode`, exactly as legacy initializes `TRNS_STTS: ""`. There is
 * no `"99999999"` fallback: that value is a Transfer-History
 * "Failed" FILTER sentinel (`trns_0003_001_view.jsp:158`) and legacy
 * never stores it as a transfer result.
 */
export function parseEngineOutcome(raw: unknown): EngineOutcome {
    const empty: EngineOutcome = {
        bankTxId: null, actualAmt: null, trnsStts: null, trnsMsg: null,
        fee: null, memo: null, memo2: null, acceptName: null,
        outAcctNo: null, inAcctNo: null, ccyCd: null,
    };
    const out = findTransferOutput(raw);
    if (!out) return empty;

    // Legacy reads `objOutput.ErrorCode` / `.ErrorMessage` directly.
    // `readString` returns null for a missing/blank value; normalize the
    // status to "" so the wire carries legacy's initial value rather
    // than an invented code.
    const status  = readString(out, ["ErrorCode", "errorCode", "status"]) ?? "";
    const message = readString(out, ["ErrorMessage", "errorMessage", "message"]);

    // Success payload — `Output.Result.transfer[0]`. Legacy gates on
    // BOTH `ErrorCode == "00000000"` AND the presence of
    // `Result.transfer`; on anything else it keeps the composed values,
    // which the caller supplies.
    const result   = (out.Result ?? out.result) as Record<string, unknown> | undefined;
    const trnsArr  = result && Array.isArray((result as { transfer?: unknown }).transfer)
        ? (result as { transfer: unknown[] }).transfer
        : undefined;
    const row = status === ENGINE_SUCCESS_STTS
                && trnsArr && trnsArr.length > 0
                && typeof trnsArr[0] === "object" && trnsArr[0] !== null
        ? trnsArr[0] as Record<string, unknown>
        : null;
    if (!row) {
        return { ...empty, trnsStts: status, trnsMsg: message };
    }
    return {
        // Legacy maps NO engine field to TRS_ID / TRNS_STLM_ID on this
        // screen (`WSVC.trns_0002_001_c001.xml` carries TRS_ID only for
        // the duplicate check and the composer never sets it), so the
        // settlement id stays empty here too.
        bankTxId:   null,
        actualAmt:  parseEngineAmount(row.remitAmt),
        trnsStts:   status,
        trnsMsg:    message,
        fee:        toWireFee(row.fee),
        memo:       readString(row, ["memo"]),
        memo2:      readString(row, ["memo2"]),
        acceptName: readString(row, ["acceptName"]),
        // Legacy overwrites OUT_ACCT_NO / IN_ACCT_NO / CCY_CD from the same
        // row on success (`trns_0001_007.ts:2157-2158, 2163`). Recorded only.
        outAcctNo:  readString(row, ["acctNum"]),
        inAcctNo:   readString(row, ["remitAcctNum"]),
        ccyCd:      readString(row, ["currency"]),
    };
}

/* -------------------------------------------------------------------
 *  Amount input formatting helpers (Path A scope is VND-only — legacy
 *  `trns_0001_007.ts:1178-1184` masks the amount with the vi-VN
 *  thousands grouping when `CCY_CD === 'VND'`). When the FCY variant
 *  is ported, swap `vi-VN` for the source row's locale.
 * ----------------------------------------------------------------- */

/** Strip every non-digit character. Pasted text, accidental commas,
 *  thousand-separator dots from copy/paste — everything is stripped
 *  so the state value can be `Number(...)`-parsed directly. */
function stripToDigits(raw: string): string {
    return raw.replace(/[^\d]/g, "");
}

/**
 * Sanitize a remark string for bank IB submission. Mirrors legacy
 * `common.app.sanitize` referenced at `trns_0001_007.ts:560, 564,
 * 575, 576` — replaces non-breaking spaces (U+00A0) with regular
 * spaces. Vietnamese keyboard layouts emit NBSP from `AltGr+Space`
 * and several bank IB sites reject the character outright; the
 * legacy composer runs this sanitize step before every remark
 * post-process, and the refactor follows.
 *
 * <p>Intentionally narrow — does NOT strip control chars, emojis,
 * or any other character class. Legacy only handles NBSP.
 */
function sanitizeRemark(raw: string): string {
    return raw.replace(/ /g, " ");
}

/** Format a raw-digit string with VND thousands grouping (dots).
 *  Empty input → empty string so the placeholder ("0") still shows.
 *  Leading zeros are dropped (`007` → `7`). Routes through the shared
 *  `formatAmount(..., "VND", false)` (id-ID locale, 0dp) so the live
 *  typing preview matches every other VND amount in the app — no inline
 *  `Intl.NumberFormat` duplicate (CLAUDE.md shared-formatter rule). */
function formatVndDigits(rawDigits: string): string {
    if (!rawDigits) return "";
    return formatAmount(rawDigits, "VND", false);
}

/**
 * Parse the BALANCE engine callback. Legacy
 * `trns_0001_007.ts:1645-1655` reads `Result.balance[0]` for the
 * successful payload (`availableBal` + `balance`) and the top-level
 * `ErrorCode` / `ErrorMessage` for diagnostics.
 *
 * On engine failure the balance fields stay null and Spring records
 * the failed status as an audit row — the displayed source row
 * doesn't change.
 */
export type BalanceOutcome = {
    bal:     number | null;
    realAmt: number | null;
    status:  string | null;
    message: string | null;
};

/**
 * Locate the engine job `Output` object inside a BALANCE scrape result.
 *
 * <p>Legacy shape (`trns_0001_007.ts:1635-1656`): `runScraping` resolves
 * with an ARRAY of org-objs; each org-obj has a `result` ARRAY of job
 * records; each job record carries an `Output` object with
 * {@code ErrorCode} / {@code ErrorMessage} and (on success)
 * {@code Result.balance[0]}. Legacy iterates and lets the LAST job
 * record win, so we do the same. Falls back to flatter shapes (a bare
 * job record, or a flat object that already looks like an Output) for
 * engine variants that don't nest. Depth-bounded; never throws.
 */
function findBalanceOutput(raw: unknown, depth = 0): Record<string, unknown> | null {
    if (!raw || typeof raw !== "object" || depth > 6) return null;
    // Top-level array of org-objs — last Output wins (legacy parity).
    if (Array.isArray(raw)) {
        let found: Record<string, unknown> | null = null;
        for (const org of raw) {
            const o = findBalanceOutput(org, depth + 1);
            if (o) found = o;
        }
        return found;
    }
    const r = raw as Record<string, unknown>;
    // org-obj with a `result` (lowercase) array of job records.
    const jobs = r.result;
    if (Array.isArray(jobs)) {
        let found: Record<string, unknown> | null = null;
        for (const job of jobs) {
            if (job && typeof job === "object") {
                const out = (job as Record<string, unknown>).Output;
                if (out && typeof out === "object") {
                    found = out as Record<string, unknown>; // last job's Output
                }
            }
        }
        if (found) return found;
    }
    // A single job record carrying an `Output`.
    if (r.Output && typeof r.Output === "object") {
        return r.Output as Record<string, unknown>;
    }
    // Already an Output-like object (flat engine variant).
    if (typeof r.ErrorCode === "string" || typeof r.errorCode === "string"
        || typeof r.status === "string" || r.Result != null || r.balance != null) {
        return r;
    }
    return null;
}

export function parseBalanceOutcome(raw: unknown): BalanceOutcome {
    // The engine resolves with a nested array→result[]→Output shape
    // (legacy `trns_0001_007.ts:1635-1656`). Navigate to the job Output
    // FIRST — a top-level field read misses the nested ErrorCode and a
    // successful refresh would be persisted as "99999999" (Failed). The
    // success code lives at `Output.ErrorCode` and the balance at
    // `Output.Result.balance[0]`. (fix 2026-06-01)
    const out = findBalanceOutput(raw);
    if (!out) {
        return { bal: null, realAmt: null, status: null, message: null };
    }
    const status  = readString(out, ["ErrorCode", "errorCode", "status"]);
    const message = readString(out, ["ErrorMessage", "errorMessage", "message"]);
    // Successful payload — `Output.Result.balance[0]`. Walk defensively;
    // fall back to the Output's own fields for engine variants that flatten.
    const result  = (out.Result ?? out.result) as Record<string, unknown> | undefined;
    const balArr  = result && Array.isArray((result as { balance?: unknown }).balance)
        ? (result as { balance: unknown[] }).balance
        : undefined;
    const balRow  = balArr && balArr.length > 0 && typeof balArr[0] === "object" && balArr[0] !== null
        ? balArr[0] as Record<string, unknown>
        : out;
    const bal     = readNumber(balRow, ["balance", "bal", "BAL"]);
    const realAmt = readNumber(balRow, ["availableBal", "available", "realAmt", "REAL_AMT"]);
    return { bal, realAmt, status, message };
}

function readString(o: Record<string, unknown>, keys: string[]): string | null {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === "string" && v.trim().length > 0) return v;
    }
    return null;
}

/**
 * Read a numeric field off a decrypted engine row.
 *
 * Delegates the string case to {@link parseEngineAmount}, which is the single
 * place that knows how the engine formats amounts. Fixed 2026-08-18: this used
 * to do `Number(v.replace(/[^\d.-]/g, ""))`, which mis-read every grouped
 * amount the engine actually sends — `"3.362.692"` became `NaN` (multiple
 * decimal points) and `"3,362,692"` became `3362692` only by accident of the
 * commas being stripped. It also mapped `""` to `0`, so a blank balance field
 * looked like a real zero balance instead of "absent", which is the difference
 * between showing the user a wrong number and correctly refusing the refresh.
 *
 * Returns `null` when no key holds a usable value — callers treat `null` as
 * "the engine did not report this", never as zero.
 */
function readNumber(o: Record<string, unknown>, keys: string[]): number | null {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string") {
            const normalized = parseEngineAmount(v);
            if (normalized === null) continue;   // blank / unparseable → try the next key
            const n = Number(normalized);
            if (Number.isFinite(n)) return n;
        }
    }
    return null;
}

/* ===================================================================
 *  Tiny utilities
 * ================================================================= */

/**
 * Generate a 36-char UUID v4 (8-4-4-4-12 with hyphens — 36 total,
 * within the backend's 32-64 length window). Uses
 * `crypto.randomUUID()` when available (modern browsers) and a
 * crypto.getRandomValues fallback otherwise. Both stay browser-only;
 * the dialog is "use client" and never runs server-side.
 */
function makeIdempotencyKey(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    // Fallback — 16 bytes from crypto.getRandomValues, formatted as
    // RFC 4122 v4 UUID (8-4-4-4-12).
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

/** True for values that must never reach the UI as text — null,
 *  undefined, empty, or the literal strings "undefined" / "null" that a
 *  DOM-scrape can yield when a template field was unset. */
function isMeaninglessLabel(v: string | null | undefined): boolean {
    if (v == null) return true;
    const s = v.trim().toLowerCase();
    return s === "" || s === "undefined" || s === "null";
}

/**
 * Resolve the "Recipient Bank" display label for the Transfer
 * Confirmation popup, with a never-undefined fallback chain
 * (2026-06-01e):
 *   1. the value the confirm-bridge extracted from the legacy popup
 *      (the bank's own confirmation text, e.g.
 *      "SHINHAN BANK | Shinhan Bank Vietnam Limited (970424)") — used
 *      verbatim when it is a real value;
 *   2. else the composer's selected To-Bank name + NAPAS code
 *      (e.g. "Shinhan(Vietnam) (970424)");
 *   3. else the bank name alone;
 *   4. else the bank code;
 *   5. else "" (never "undefined" / "null").
 */
function resolveRecipientBankLabel(
    fromBridge: string | null | undefined,
    target: OwnAccountTargetRow | null,
): string {
    if (!isMeaninglessLabel(fromBridge)) return (fromBridge as string).trim();
    if (!target) return "";
    const napas = !isMeaninglessLabel(target.napasBankCd)
        ? ` (${target.napasBankCd})`
        : "";
    if (!isMeaninglessLabel(target.bankNm)) return `${target.bankNm}${napas}`.trim();
    if (!isMeaninglessLabel(target.bankCd)) return `${target.bankCd}${napas}`.trim();
    return "";
}

/** yyyymmdd in UTC. Engine's `remitDate` field. */
function nowYyyymmddUtc(): string {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`;
}

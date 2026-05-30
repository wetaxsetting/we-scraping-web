"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDialog } from "@/components/shared/dialog";
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
import { ApiCallError, postBalanceRefresh } from "@/lib/api/banking";
import { formatAmount } from "@/lib/currency";
import { formatDateTimeForView } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";
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
import { QnaDialog } from "@/app/(dashboard)/banking/credentials/QnaDialog";
import OtpAuthDialog from "./OtpAuthDialog";
import TransferConfirmationDialog from "./TransferConfirmationDialog";
import { cn } from "@/lib/utils";
import type {
    ApiBalanceRefreshRequest,
    ApiOwnAccountTransferScrapingResultRequest,
} from "@/lib/types/api";

import { buildNxisasOrgObj } from "./bank-profiles";
import type { NxisasOrgObj } from "./bank-profiles";
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
        console.log("[oat-composer] QNA listener mounted");
        const onChallenge = (e: CustomEvent<NxisasQnaChallenge>) => {
            console.log("[oat-composer] received QNA challenge → rendering <QnaDialog>", {
                bankName:  e.detail.bankName,
                loginId:   e.detail.loginId,
                questions: e.detail.questions.length,
            });
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
            console.log("[oat-composer] received CONFIRM challenge → rendering <TransferConfirmationDialog>", {
                sender:    e.detail.data.senderAccount,
                amount:    e.detail.data.transferAmount,
                recipient: e.detail.data.recipientName,
                showOtp:   e.detail.data.showPwdArea && e.detail.data.showOtpPwdArea,
            });
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
            console.log("[oat-composer] received OTP challenge → rendering <OtpAuthDialog>", {
                bankName: e.detail.data.bankName,
            });
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

    // --- Derived ---------------------------------------------------
    const target = useMemo(() => {
        if (!targetKey) return null;
        return targets.find((t) => `${t.bankCd}:${t.acctNo}` === targetKey) ?? null;
    }, [targets, targetKey]);

    const parsedAmount = useMemo(() => {
        const cleaned = amount.replace(/[^\d]/g, "");
        return cleaned === "" ? NaN : Number(cleaned);
    }, [amount]);

    const validation: OwnAccountTransferComposerValidation = useMemo(() => {
        if (!currentSource) return { ok: false, field: "target", messageKey: "" };
        return data.validateDraft({
            source: currentSource,
            target,
            amount: parsedAmount,
            acctPassword,
            remarkForSender: rmrkSender,
        });
    }, [currentSource, target, parsedAmount, acctPassword, rmrkSender, data]);

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

        const draft: OwnAccountTransferDraft = {
            source: currentSource,
            target,
            transferType:   currentSource.bankCd === target.bankCd ? "SAME_BANK" : "NAPAS",
            amount:         parsedAmount,
            acctPassword,
            feeBearer,
            remarkForRecipient: rmrkRecipient,
            remarkForSender:    rmrkSender,
            idempotencyKey: idempotencyKeyRef.current,
        };

        // 1. Build the engine payload + run the scrape (browser-side).
        const orgObj: NxisasOrgObj = buildNxisasOrgObj({
            draft,
            internal:  draft.transferType === "SAME_BANK",
            remitDate: nowYyyymmddUtc(),
        });

        let engineResult: unknown;
        try {
            engineResult = await engine.runScraping([orgObj]);
        } catch (err) {
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

        // 2. Parse the engine outcome. Legacy returns a free-form
        //    object; we read tx id + status defensively.
        const outcome = parseEngineOutcome(engineResult);

        // 3. POST the result to Spring.
        const req: ApiOwnAccountTransferScrapingResultRequest = {
            idempotency_key:      draft.idempotencyKey,
            transfer_type:        draft.transferType,
            source_bank_cd:       draft.source.bankCd,
            source_acct_no:       draft.source.acctNo,
            target_bank_cd:       draft.target.bankCd,
            target_napas_bank_cd: draft.target.napasBankCd,
            target_acct_no:       draft.target.acctNo,
            target_owac_nm:       draft.target.acctNickNm,
            ccy_cd:               "VND",
            requested_amt:        String(draft.amount),
            actual_amt:           String(outcome.actualAmt ?? draft.amount),
            bank_tx_id:           outcome.bankTxId ?? "",
            trns_stts:            outcome.trnsStts ?? "99999999",
            trns_msg:             outcome.trnsMsg,
            fee:                  null,
            fee_dfr_sbj:          draft.feeBearer,
            rmrk:                 draft.remarkForRecipient || null,
            rmrk2:                draft.remarkForSender    || null,
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
            // again. Status code surfaces in the system dialog.
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: t("own_account_transfer.composer.error.engine_failed"),
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
        currentSource, target, submitting, parsedAmount, acctPassword, feeBearer,
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

        // 3. Parse the engine callback. Legacy reads
        //    `Result.balance[0]` for the successful payload and
        //    `ErrorCode` / `ErrorMessage` for the diagnostic strings.
        const parsed = parseBalanceOutcome(engineResult);
        const req: ApiBalanceRefreshRequest = {
            bank_cd:           currentSource.bankCd,
            acct_no:           currentSource.acctNo,
            bal:               parsed.bal,
            real_amt:          parsed.realAmt,
            acct_bal_inq_stts: parsed.status ?? "99999999",
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

        // 4. Engine reported a non-success status — Spring already
        //    persisted the failed status + message for audit, now
        //    surface it to the user so they know the displayed
        //    balance was NOT refreshed.
        if (parsed.status && parsed.status !== "00000000") {
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: parsed.message
                    ?? t("own_account_transfer.composer.error.engine_failed"),
                errorCode:   parsed.status,
            });
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
                    cancelNxisasQna(qnaChallenge.popup);
                    setQnaChallenge(null);
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
                data={confirmChallenge.data}
                onSubmit={(otpPwd) => {
                    submitNxisasConfirm(confirmChallenge.popup, otpPwd);
                }}
                onCancel={() => {
                    cancelNxisasConfirm(confirmChallenge.popup);
                    setConfirmChallenge(null);
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
                    cancelNxisasOtp(otpChallenge.popup);
                    setOtpChallenge(null);
                }}
            />
        ) : null}
        <Dialog
            open={source !== null}
            onOpenChange={(open) => { if (!open) handleClose(); }}
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
                    feeBearer={feeBearer}
                    onFeeBearerChange={setFeeBearer}
                    rmrkRecipient={rmrkRecipient}
                    onRmrkRecipientChange={setRmrkRecipient}
                    rmrkSender={rmrkSender}
                    onRmrkSenderChange={setRmrkSender}
                    onUpdateBalance={handleUpdateBalance}
                    updating={updating}
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
                        onClick={handleClose}
                        disabled={stickySubmitting}
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
    rmrkRecipient:         string;
    onRmrkRecipientChange: (next: string) => void;
    rmrkSender:            string;
    onRmrkSenderChange:    (next: string) => void;
    onUpdateBalance:       () => void;
    updating:              boolean;
}) {
    const { t } = useTranslation();
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
                        <Button
                            type="button"
                            variant="outline"
                            onClick={props.onUpdateBalance}
                            disabled={props.updating}
                            // h-8 matches the sibling Input + the
                            // From Bank / To Bank select triggers.
                            className="h-8 shrink-0"
                        >
                            {t("own_account_transfer.composer.update_balance")}
                        </Button>
                    </div>
                    {props.source.lastInquiryAt && (
                        <p className="text-wb-12 font-medium text-wb-muted">
                            {t("own_account_transfer.composer.last_updated_at", {
                                // Figma 167:15759 shows DD-MM-YYYY HH:MM
                                // (no seconds); `formatDateTimeForView`
                                // returns DD-MM-YYYY HH:MM:SS so we slice
                                // off the trailing ":SS".
                                when: formatDateTimeForView(props.source.lastInquiryAt).slice(0, -3),
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

                <FieldLabel text={t("own_account_transfer.composer.transaction_fee")}>
                    <div className="flex items-center gap-6">
                        <label className="flex cursor-pointer items-center gap-2 text-wb-13 font-medium text-wb-ink">
                            <input
                                type="radio"
                                name="oat-fee-bearer"
                                value="A"
                                checked={props.feeBearer === "A"}
                                onChange={() => props.onFeeBearerChange("A")}
                                className="size-4 accent-brand"
                            />
                            {t("own_account_transfer.composer.fee_sender")}
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-wb-13 font-medium text-wb-ink">
                            <input
                                type="radio"
                                name="oat-fee-bearer"
                                value="B"
                                checked={props.feeBearer === "B"}
                                onChange={() => props.onFeeBearerChange("B")}
                                className="size-4 accent-brand"
                            />
                            {t("own_account_transfer.composer.fee_recipient")}
                        </label>
                    </div>
                </FieldLabel>

                {/* Figma 167:15759 — sender remark FIRST (required *),
                    recipient remark SECOND (optional). Don't reverse;
                    the sender memo lands on the bank statement and
                    needs the prominent slot. */}
                <FieldLabel
                    required
                    text={t("own_account_transfer.composer.remark_sender")}
                    rightSlot={`${props.rmrkSender.length}/210`}
                >
                    <textarea
                        value={props.rmrkSender}
                        onChange={(e) => props.onRmrkSenderChange(sanitizeRemark(e.target.value).slice(0, 210))}
                        rows={2}
                        placeholder={t("own_account_transfer.composer.remark_sender_placeholder")}
                        className="min-h-[48px] w-full resize-none rounded-[6px] bg-background px-3 py-2 text-wb-14 font-medium text-wb-ink shadow-wb-outline transition-[color,box-shadow] outline-none focus-visible:shadow-wb-focus"
                        maxLength={210}
                    />
                </FieldLabel>

                <FieldLabel
                    text={t("own_account_transfer.composer.remark_recipient")}
                    rightSlot={`${props.rmrkRecipient.length}/210`}
                >
                    <textarea
                        value={props.rmrkRecipient}
                        onChange={(e) => props.onRmrkRecipientChange(sanitizeRemark(e.target.value).slice(0, 210))}
                        rows={2}
                        placeholder={t("own_account_transfer.composer.remark_placeholder")}
                        className="min-h-[48px] w-full resize-none rounded-[6px] bg-background px-3 py-2 text-wb-14 font-medium text-wb-ink shadow-wb-outline transition-[color,box-shadow] outline-none focus-visible:shadow-wb-focus"
                        maxLength={210}
                    />
                </FieldLabel>
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

type EngineOutcome = {
    bankTxId:   string | null;
    actualAmt:  number | null;
    trnsStts:   string | null;
    trnsMsg:    string | null;
};

/**
 * Parse the engine's free-form callback payload. The legacy bundle's
 * callback shape varies by bank; we read defensively from the common
 * field names and fall back to a generic shape. Anything missing
 * surfaces as null so the server-side validation gets a chance to
 * reject (rather than silently writing bad data).
 */
function parseEngineOutcome(raw: unknown): EngineOutcome {
    if (!raw || typeof raw !== "object") {
        return { bankTxId: null, actualAmt: null, trnsStts: null, trnsMsg: null };
    }
    const r = raw as Record<string, unknown>;
    // Walk a priority list — legacy banks emit different field names.
    const bankTxId  = readString(r, ["bankTxId", "transactionId", "tranNo", "TraceNo"]);
    const amount    = readNumber(r, ["amount", "balance"]);
    const status    = readString(r, ["trnsStts", "ErrorCode", "errorCode", "status"]);
    const message   = readString(r, ["trnsMsg", "ErrorMessage", "errorMessage", "message"]);
    return {
        bankTxId:  bankTxId,
        actualAmt: amount,
        trnsStts:  status,
        trnsMsg:   message,
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

/** Format a raw-digit string with vi-VN thousands grouping (dots).
 *  Empty input → empty string so the placeholder ("0") still shows.
 *  Leading zeros are dropped (`007` → `7`). */
function formatVndDigits(rawDigits: string): string {
    if (!rawDigits) return "";
    const n = Number(rawDigits);
    if (!Number.isFinite(n)) return "";
    // `new Intl.NumberFormat("vi-VN")` produces dot-grouped output
    // (1.234.567) — matches Figma 167:15759 + the page's existing
    // `formatAmount(..., "VND", false)` rendering.
    return new Intl.NumberFormat("vi-VN").format(n);
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
type BalanceOutcome = {
    bal:     number | null;
    realAmt: number | null;
    status:  string | null;
    message: string | null;
};

function parseBalanceOutcome(raw: unknown): BalanceOutcome {
    if (!raw || typeof raw !== "object") {
        return { bal: null, realAmt: null, status: null, message: null };
    }
    const r = raw as Record<string, unknown>;
    const status  = readString(r, ["ErrorCode", "errorCode", "status"]);
    const message = readString(r, ["ErrorMessage", "errorMessage", "message"]);
    // Successful payload — `Result.balance[0]`. Walk defensively;
    // fall back to top-level fields for engine variants that flatten.
    const result  = (r.Result ?? r.result) as Record<string, unknown> | undefined;
    const balArr  = result && Array.isArray((result as { balance?: unknown }).balance)
        ? (result as { balance: unknown[] }).balance
        : undefined;
    const balRow  = balArr && balArr.length > 0 && typeof balArr[0] === "object" && balArr[0] !== null
        ? balArr[0] as Record<string, unknown>
        : r;
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

function readNumber(o: Record<string, unknown>, keys: string[]): number | null {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string") {
            const n = Number(v.replace(/[^\d.-]/g, ""));
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

/** yyyymmdd in UTC. Engine's `remitDate` field. */
function nowYyyymmddUtc(): string {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`;
}

"use client";

/**
 * Transfer Confirmation dialog for Own Account Transfer — React
 * replacement for the legacy NXiSAS bundle's
 * {@code _confirm_transfer_template} popup at {@code nxisas_v2.js:619-774}.
 *
 * <p>Mirrors the legacy template section-for-section:
 *
 * <ol>
 *   <li>Title bar           ← {@code #{ML_TRNS_CONF}} "Transfer Confirmation"</li>
 *   <li>Sender Account      ← {@code #{ML_SND_ACCT_INFO}} group
 *        <ul>
 *          <li>Sender Account  ← {@code #{ML_SND_ACCT}} / {@code #{SND_ACCT}}</li>
 *          <li>Transfer Amount ← {@code #{ML_TRNS_AMT}} / {@code #{TRNS_AMT}}</li>
 *        </ul>
 *   </li>
 *   <li>Recipient Account   ← {@code #{ML_RECP_ACCT_INFO}} group
 *        <ul>
 *          <li>Recipient Bank  ← {@code #{ML_RECP_BANK}} / {@code #{RECP_BANK}}</li>
 *          <li>Account No.     ← {@code #{ML_RECP_ACCT_NO}} / {@code #{RECP_ACCT_NO}}</li>
 *          <li>Recipient Name  ← {@code #{ML_RECP_NM}} / {@code #{RECP_NM}}</li>
 *        </ul>
 *   </li>
 *   <li>Transaction Details ← {@code #{ML_TRNS_DETL}} group; each row
 *        gated by a {@code show*} visibility flag the bundle fills
 *        per-bank in {@code nxisas_v2.js:1374-1473}.</li>
 *   <li>OTP / Password area ← {@code #{PWD_AREA}} wrapper
 *        <ul>
 *          <li>OTP block          OTP Password input +
 *              {@code (ID: <userName>)} subtext + side-panel
 *              Transaction Code in brand red</li>
 *          <li>Transfer Pwd block (hidden by default; bank flips
 *              {@code #TRNS_PWD} visible when needed)</li>
 *        </ul>
 *   </li>
 *   <li>Footer              ← centered Cancel + wide Confirm</li>
 * </ol>
 *
 * <p><b>Wiring</b>: {@link lib/nxisas/confirm-bridge.ts} observes the
 * bundle's hidden {@code .layerCont.transfer_confirmation} popup,
 * extracts its values into {@link TransferConfirmationData}, and
 * dispatches {@code wb:nxisas-confirm-challenge}. The Own Account
 * Transfer composer listens for the event and renders this dialog.
 * Submit/Cancel route back to the bridge which hydrates the hidden
 * legacy DOM + triggers the bundle's existing jQuery click handlers
 * ({@code .btn-area a.confirm} / {@code .btn-area a.cancel} at
 * {@code nxisas_v2.js:137 / 78}), so the bundle's
 * {@code _v2nxisas.execute(...)} continuation runs unchanged.
 *
 * <p>This component is the single source of UI truth for the Transfer
 * Confirmation popup. The static-UI dev preview at
 * {@link components/banking/own-account-transfer/preview/NxisasSecondaryAuthPreview}
 * imports this component and feeds it mock data — there is no second
 * implementation.
 */

import { useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { ModalInput } from "@/components/shared/modal-form";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ===================================================================
 *  Public type — payload the bridge extracts from the legacy popup
 * ================================================================= */

/**
 * Substitution values for the legacy {@code _confirm_transfer_template}
 * ({@code nxisas_v2.js:619-774}). Field names mirror the legacy
 * template's {@code #{…}} tokens verbatim so
 * {@link lib/nxisas/confirm-bridge.ts} can extract values from the
 * engine-injected DOM directly into this shape — no field renaming or
 * remapping required.
 *
 * <p>Visibility flags ({@code show*Area}) mirror the legacy template's
 * {@code style="#{XXX_AREA}"} placeholders — populated by
 * {@code nxisas_v2.js:1344-1509} ({@code run2ndCert} confirm branch)
 * with either an empty string (visible) or {@code "display:none"}
 * (hidden), per bank.
 *
 * <p>Exported so the confirm bridge + the OAT composer + the dev
 * preview can share one type definition.
 */
export type TransferConfirmationData = {
    senderAccount:    string;
    transferAmount:   string;
    recipientBank:    string;
    recipientAcctNo:  string;
    recipientName:    string;
    showFeeStts:      boolean;
    transferFeeStts?: string;
    showFeeAmt:       boolean;
    feeAmount?:       string;
    showRmrk:         boolean;
    remark?:          string;
    showRmrkSender:   boolean;
    remarkSender?:    string;
    showRmrkRecp:     boolean;
    remarkRecipient?: string;
    showPwdArea:      boolean;
    showOtpPwdArea:   boolean;
    showTrnsPwdArea:  boolean;
    transactionCode?: string;
    userName:         string;
};

type TransferConfirmationDialogProps = {
    open:     boolean;
    /** Values to display. Built by the confirm-bridge from the hidden
     *  {@code .layerCont.transfer_confirmation} DOM at runtime, or by
     *  the dev preview from its mock data. */
    data:     TransferConfirmationData;
    /** Called with the typed OTP string on Confirm. The confirm-bridge
     *  writes it back into the hidden legacy {@code input[name='otp_pwd']}
     *  and triggers {@code .btn-area a.confirm} to continue the bundle's
     *  {@code _v2nxisas.execute(...)} flow. */
    onSubmit: (otpPwd: string) => void;
    /** Called on Cancel / X. The confirm-bridge triggers the bundle's
     *  {@code .btn-area a.cancel} click. */
    onCancel: () => void;
};

/* ===================================================================
 *  Component
 * ================================================================= */

export default function TransferConfirmationDialog({
    open,
    data: c,
    onSubmit,
    onCancel,
}: TransferConfirmationDialogProps) {
    const { t } = useTranslation();
    const [otpPwd, setOtpPwd]   = useState("");
    const [trnsPwd, setTrnsPwd] = useState("");

    // Confirm enabled when every visible required password is filled.
    const otpFilled  = !c.showOtpPwdArea  || otpPwd.trim().length > 0;
    const trnsFilled = !c.showTrnsPwdArea || trnsPwd.trim().length > 0;
    const canConfirm = otpFilled && trnsFilled;

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
            {/* Common modal style — matches the New Firm Banking dialog
                (`rounded-2xl`, `p-0` + own padding, text-wb-16 title,
                h-8 footer buttons). `hideClose` mirrors the legacy
                Transfer Confirmation (no X — Cancel is the only dismiss,
                which routes through the WBC1140 quit confirmation).
                stackLevel={4} keeps it above the composer (L1). */}
            {/* Width = 860px — legacy parity. The legacy popup wrapper is
                `.layerCont middle transfer_confirmation` (`nxisas_v2.js:621`),
                and `.layerCont.middle .layerPopupWrap` is `width: 860px`
                (`assets_v2/css/_common.css:1874`) with no media query
                narrowing it. §3a allows `max-w-*` to vary per feature dialog;
                everything else here stays on the common modal style.

                The `min(...)` guard is load-bearing: `<DialogContent>` is
                `position: fixed` + `w-full`, so width resolves to
                `min(100vw, max-w)` — a bare `860px` would sit edge-to-edge on
                any viewport below 860px, including the supported 768px
                breakpoint. `calc(100vw-32px)` keeps a 16px gutter, mirroring
                the primitive's own `max-h-[calc(100vh-32px)]`. */}
            <DialogContent
                stackLevel={4}
                hideClose
                className="max-w-[min(860px,calc(100vw-32px))] rounded-2xl p-0"
                aria-describedby={undefined}
                closeOnOutsideClick={false}
                closeOnEscape={false}
            >
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 px-6 pt-6 pb-4">
                    <DialogTitle asChild>
                        <h2 className="text-wb-16 font-semibold leading-[18px] text-wb-dark">
                            {t("own_account_transfer.engine.confirm_transfer.title")}
                        </h2>
                    </DialogTitle>
                </div>

                <div className="custom-scrollbar-y flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-2">
                    {/* Card 1 — Sender + Recipient + Transaction Details.
                        Light grouping card (`bg-wb-bg-sidebar`) with the
                        legacy three-section structure preserved; only the
                        typography/spacing is aligned to the common modal
                        style. */}
                    <div className="flex flex-col gap-5 rounded-md bg-wb-bg-sidebar p-5">
                        <ConfirmSection title={t("own_account_transfer.engine.confirm_transfer.sender_section")}>
                            <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.sender_account")}>
                                {c.senderAccount}
                            </ConfirmRow>
                            <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.transfer_amount")}>
                                {c.transferAmount}
                            </ConfirmRow>
                        </ConfirmSection>

                        <div role="separator" className="border-t border-wb-ntrl-4" />

                        <ConfirmSection title={t("own_account_transfer.engine.confirm_transfer.recipient_section")}>
                            <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.recipient_bank")}>
                                {c.recipientBank}
                            </ConfirmRow>
                            <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.recipient_acct_no")}>
                                {c.recipientAcctNo}
                            </ConfirmRow>
                            <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.recipient_name")}>
                                {c.recipientName}
                            </ConfirmRow>
                        </ConfirmSection>

                        <div role="separator" className="border-t border-wb-ntrl-4" />

                        <ConfirmSection title={t("own_account_transfer.engine.confirm_transfer.details_section")}>
                            {c.showFeeStts && (
                                <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.transfer_fee")}>
                                    {c.transferFeeStts}
                                </ConfirmRow>
                            )}
                            {c.showFeeAmt && (
                                <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.fee_amount")}>
                                    {c.feeAmount}
                                </ConfirmRow>
                            )}
                            {c.showRmrk && (
                                <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.remarks")}>
                                    {c.remark}
                                </ConfirmRow>
                            )}
                            {c.showRmrkSender && (
                                <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.remarks_sender")}>
                                    {c.remarkSender}
                                </ConfirmRow>
                            )}
                            {c.showRmrkRecp && (
                                <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.remarks_recipient")}>
                                    {c.remarkRecipient}
                                </ConfirmRow>
                            )}
                        </ConfirmSection>
                    </div>

                    {/* Card 2 — OTP / Transfer Password
                        Figma 270:7354: separate card matching card 1's
                        surface treatment so the OTP block reads as a
                        distinct "what the user must enter NOW" group. */}
                    {c.showPwdArea && (
                        <div className="flex flex-col gap-5 rounded-md bg-wb-bg-sidebar p-5">
                            {c.showOtpPwdArea && (
                                <ConfirmSection title="OTP">
                                    <div className="flex flex-wrap items-start justify-between gap-6">
                                        {/* Left column — OTP label + 230px input + (ID:…) subtext */}
                                        <div className="flex items-start gap-4">
                                            <label
                                                htmlFor="confirm-otp-pwd"
                                                className="w-[120px] shrink-0 pt-2 text-wb-14 font-medium leading-4 text-wb-ntrl-8"
                                            >
                                                {t("own_account_transfer.engine.confirm_transfer.otp_password")}
                                            </label>
                                            <div className="flex flex-col gap-1.5">
                                                <ModalInput
                                                    id="confirm-otp-pwd"
                                                    type="password"
                                                    autoComplete="one-time-code"
                                                    value={otpPwd}
                                                    onChange={(e) => setOtpPwd(e.target.value)}
                                                    autoFocus
                                                    className="w-[230px]"
                                                />
                                                <p className="text-wb-13 font-medium text-wb-muted">
                                                    {t("own_account_transfer.engine.confirm_transfer.id_label", {
                                                        userName: c.userName,
                                                    })}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Right column — Transaction Code (red,
                                            mirrors legacy `.code-num` styling).
                                            `pr-10` mirrors Figma 270:7369's
                                            right-side padding so the code
                                            isn't flush against the card edge. */}
                                        <div className="flex flex-col items-start pr-10">
                                            <p className="pb-1 text-wb-13 font-medium text-wb-ntrl-8">
                                                {t("own_account_transfer.engine.confirm_transfer.transaction_code")}
                                            </p>
                                            <p className="text-wb-24 font-semibold tracking-wide text-wb-red-07">
                                                {c.transactionCode}
                                            </p>
                                        </div>
                                    </div>
                                </ConfirmSection>
                            )}
                            {c.showTrnsPwdArea && (
                                <ConfirmSection
                                    title={t("own_account_transfer.engine.confirm_transfer.transfer_password_section")}
                                >
                                    <FieldLabel
                                        required
                                        text={t("own_account_transfer.engine.confirm_transfer.transfer_password")}
                                    >
                                        <ModalInput
                                            type="password"
                                            autoComplete="new-password"
                                            value={trnsPwd}
                                            onChange={(e) => setTrnsPwd(e.target.value)}
                                            placeholder={t("own_account_transfer.engine.confirm_transfer.enter_transfer_password")}
                                            className="w-[230px]"
                                        />
                                    </FieldLabel>
                                    <p className="text-wb-13 font-medium text-wb-muted">
                                        {t("own_account_transfer.engine.confirm_transfer.id_label", {
                                            userName: c.userName,
                                        })}
                                    </p>
                                </ConfirmSection>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer — common modal style (New Firm Banking):
                    borderless, right-aligned, h-8 buttons. Cancel routes
                    through the legacy quit confirmation; Confirm is
                    disabled (gray) until every visible password is filled. */}
                <div className="flex shrink-0 items-center justify-end gap-2 px-6 py-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                    >
                        {t("own_account_transfer.engine.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={() => onSubmit(otpPwd)}
                        disabled={!canConfirm}
                        aria-busy={undefined}
                        className={cn(
                            "flex h-8 items-center justify-center rounded-md px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn",
                            canConfirm
                                ? "cursor-pointer bg-brand hover:bg-brand-hover"
                                : "cursor-not-allowed bg-wb-ntrl-4",
                        )}
                    >
                        {t("own_account_transfer.engine.confirm")}
                    </button>
                </div>
              </div>
            </DialogContent>
        </Dialog>
    );
}

/* ===================================================================
 *  Internal helpers — section + row + field-label primitives
 * ================================================================= */

/**
 * Group container for one section of the legacy
 * {@code _confirm_transfer_template}. Figma 270:7290 paints a
 * {@code [blue 6px dot] [section name]} row above each group — the
 * dot is the section affordance, the name is muted Arial-Bold 13.
 * Maps to {@code bg-brand} for the dot + {@code text-wb-muted} for
 * the label so the rhythm matches the live Figma without inventing
 * a new color.
 */
function ConfirmSection({
    title, children,
}: { title: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-3.5">
            <div className="flex items-center gap-1.5">
                <span aria-hidden className="size-1.5 shrink-0 rounded-sm bg-brand" />
                <h3 className="text-wb-13 font-semibold text-wb-muted">{title}</h3>
            </div>
            <div className="flex flex-col gap-3">{children}</div>
        </section>
    );
}

/**
 * Single label/value row inside a {@link ConfirmSection}.
 * Figma 270:7296: label column is fixed at 200px (Arial Bold 14,
 * {@code #333}), value column is the remaining flex space (Arial
 * Regular 14, {@code #1a1a1a}). Maps to {@code text-wb-14 font-semibold}
 * and {@code text-wb-14 font-normal} against the closest ink tokens;
 * values wrap so long bank names or remarks don't blow out the layout.
 */
function ConfirmRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3">
            {/* Label/value typography aligned to the common modal style
                (New Firm Banking `ModalField`): label `text-wb-14 / 500`
                muted, value `text-wb-14 / 500` ink. */}
            <dt className="w-[180px] shrink-0 text-wb-14 font-medium leading-4 text-wb-ntrl-8">{label}</dt>
            <dd className="min-w-0 flex-1 break-words text-wb-14 font-medium text-wb-ink">{children}</dd>
        </div>
    );
}

/**
 * Field label + control wrapper used by the Transfer Password row
 * (the only path that uses a typed input outside the OTP card).
 * Mirrors the composer's {@code FieldLabel} shape so form rhythm
 * stays consistent across composer + engine modals.
 */
function FieldLabel({
    text, required, children,
}: {
    text:      string;
    required?: boolean;
    children:  React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label
                className={cn(
                    "text-wb-14 font-medium leading-4 text-wb-ntrl-8",
                    required && "after:ml-0.5 after:text-wb-status-rejected-text after:content-['*']",
                )}
            >
                {text}
            </label>
            {children}
        </div>
    );
}

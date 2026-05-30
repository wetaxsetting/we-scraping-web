"use client";

/**
 * OTP Authentication dialog — React replacement for the legacy NXiSAS
 * bundle's {@code _otp_template} popup at {@code nxisas_v2.js:384-415}.
 *
 * <p>Mirrors the legacy template section-for-section per Figma 274:7783:
 *
 * <ol>
 *   <li>Bank name row    ← bundle's {@code .top > p} populated with
 *        {@code #{BANK_INFO}#{ADDITIONAL_INFO}}.</li>
 *   <li>OTP image panel  ← bundle's {@code .OTP-img > figure > img}
 *        pointing at {@code /assets_v2/images/common/OTP.jpg}.</li>
 *   <li>OTP input row    ← bundle's {@code .item-table > li} with the
 *        required label {@code .required} and the
 *        {@code input[name='res']} text field.</li>
 *   <li>Footer           ← bundle's {@code .btn-area} with
 *        {@code a.btn-st.common.cancel} + {@code a.btn-st.primary.save}.</li>
 * </ol>
 *
 * <p><b>Wiring</b>: {@link lib/nxisas/otp-bridge.ts} observes the
 * bundle's hidden {@code .layerCont.otp} popup, extracts its bank-name
 * label into {@link OtpAuthChallenge}, and dispatches
 * {@code wb:nxisas-otp-challenge}. The Own Account Transfer composer
 * listens for the event and renders this dialog. Submit/Cancel route
 * back to the bridge which hydrates the hidden legacy DOM
 * ({@code input[name='res'].value = otp}) and triggers the bundle's
 * existing jQuery click handlers ({@code .btn-st.primary.save} /
 * {@code .btn-st.common.cancel} at {@code nxisas_v2.js:137 / 78}), so
 * the bundle's {@code _v2nxisas.execute(...)} continuation runs
 * unchanged.
 *
 * <p>This component is the single source of UI truth for the OTP
 * popup. The static-UI dev preview at
 * {@link components/banking/own-account-transfer/preview/NxisasSecondaryAuthPreview}
 * imports this component and feeds it mock data — there is no second
 * implementation.
 *
 * <p>Format mirrors the Settings / Add VAS Account popup family
 * (CLAUDE.md §3a + §3b): {@code rounded-2xl} radius, {@code px-6 py-6}
 * body, {@code border-t px-6 py-3 gap-2 justify-end} footer, canonical
 * {@code h-8 px-3 text-wb-14-tight font-medium} button chrome.
 */

import { useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";

/* ===================================================================
 *  Public type — payload the bridge extracts from the legacy popup
 * ================================================================= */

/**
 * Substitution values for the legacy {@code _otp_template}
 * ({@code nxisas_v2.js:384-415}). Field names mirror the legacy
 * template's {@code #{…}} tokens so
 * {@link lib/nxisas/otp-bridge.ts} can extract values from the
 * engine-injected DOM directly into this shape — no field renaming or
 * remapping required.
 *
 * <p>Exported so the otp-bridge + the OAT composer + the dev preview
 * can share one type definition.
 */
export type OtpAuthData = {
    /** Bank name + any additional info string the bundle composed
     *  into the {@code .top > p} cell. Rendered as the modal's first
     *  body row (Figma 274:7798). */
    bankName: string;
};

type OtpAuthDialogProps = {
    open:     boolean;
    /** Values to display. Built by the otp-bridge from the hidden
     *  {@code .layerCont.otp} DOM at runtime, or by the dev preview
     *  from its mock data. */
    data:     OtpAuthData;
    /** Called with the typed OTP string when the user confirms. The
     *  otp-bridge writes it back into the hidden legacy
     *  {@code input[name='res']} and triggers
     *  {@code .btn-st.primary.save} to continue the bundle's
     *  {@code _v2nxisas.execute(...)} flow. */
    onSubmit: (otp: string) => void;
    /** Called on Cancel / X. The otp-bridge triggers the bundle's
     *  {@code .btn-st.common.cancel} click. */
    onCancel: () => void;
};

/* ===================================================================
 *  Component
 * ================================================================= */

export default function OtpAuthDialog({
    open,
    data,
    onSubmit,
    onCancel,
}: OtpAuthDialogProps) {
    const { t } = useTranslation();
    const [otp, setOtp] = useState("");

    // No reset effect is needed: the production composer renders
    // `{otpChallenge ? <OtpAuthDialog /> : null}` so the dialog
    // unmounts when a challenge clears and remounts with fresh
    // state on the next one (retry after a wrong code). The dev
    // preview also conditionally mounts the modal. If a future
    // consumer keeps the dialog mounted while toggling `open`,
    // pass `key={challengeId}` on the parent side to force a
    // remount rather than reintroducing a setState-in-effect.

    const canConfirm = otp.trim().length > 0;

    /**
     * Submitting the form lets Enter from inside the input fire the
     * primary OK action (mirrors the legacy `_otp_template` UX — the
     * bundle binds `keydown.enter` on `input[name="res"]` to the same
     * delegate as the save button).
     */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canConfirm) return;
        onSubmit(otp);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) onCancel();
            }}
        >
            <DialogContent
                // Same `stackLevel` as the sibling 2nd-cert dialogs
                // (`<QnaDialog>` / `<TransferConfirmationDialog>`) so
                // the engine surfaces paint identically above the
                // composer.
                stackLevel={2}
                // Figma 274:7783 caps the modal at ~660 px (580 px
                // image panel + 20 px each side + ~20 px X-icon
                // gutter). `rounded-2xl` + `p-0` matches the Settings
                // family rhythm (CLAUDE.md §3b.C "Modal radius").
                className="max-w-[660px] rounded-2xl p-0"
                aria-describedby={undefined}
                closeOnOutsideClick={false}
                closeOnEscape={false}
            >
                {/* Radix requires a DialogTitle for screen-reader
                    a11y, but Figma 274:7783 shows no visible title
                    bar — the bank name carries the heading role
                    visually. Render the title `sr-only` so the modal
                    is announced as "OTP" without painting a title
                    row. */}
                <DialogTitle asChild>
                    <h2 className="sr-only">
                        {t("own_account_transfer.engine.otp.title")}
                    </h2>
                </DialogTitle>

                {/* `<form>` lets Enter from inside the input fire the
                    OK button (`type="submit"`) — matches legacy
                    `_otp_template` behaviour without an explicit key
                    handler. */}
                <form onSubmit={handleSubmit} className="flex flex-col">
                    {/* Body — Settings standard `px-6 py-6` padding
                        (CLAUDE.md §3a). */}
                    <div className="flex flex-col px-6 py-6">
                        {/* Bank name — Figma 274:7798. First body
                            row, no separate title bar. */}
                        <p className="text-wb-15 font-normal text-wb-ink">
                            {data.bankName}
                        </p>

                        {/* OTP token illustration panel — Figma
                            274:7800. `bg-wb-bg-sidebar` (#f5f5f5) is
                            the closest project token to Figma's
                            #f7f7f7 and is already the shared "muted
                            card" surface across the app. The bundle's
                            `_otp_template:394` references
                            `/assets_v2/images/common/OTP.jpg`; this
                            component reuses the same asset so the
                            React modal and the legacy DOM stay in
                            visual lockstep. */}
                        <div className="mt-2.5 flex h-[108px] w-full items-center justify-center rounded-md bg-wb-bg-sidebar">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/assets_v2/images/common/OTP.jpg"
                                alt=""
                                aria-hidden
                                className="h-[68px] w-auto object-contain"
                            />
                        </div>

                        {/* OTP input row — label LEFT (180 px fixed
                            column per Figma 274:7815), input RIGHT
                            (flex-1). The red round dot follows the
                            label (Figma 274:7819) instead of the
                            project's default `after:content-['*']`
                            asterisk because the Figma frame
                            explicitly shows a filled circle. */}
                        <div className="mt-5 flex items-center">
                            <label
                                htmlFor="nxisas-otp-input"
                                className="flex w-[180px] shrink-0 cursor-pointer items-center gap-1.5"
                            >
                                <span className="text-wb-15 font-normal text-wb-ink">
                                    {t("own_account_transfer.engine.otp.label")}
                                </span>
                                <span aria-hidden className="size-1.5 rounded-full bg-wb-red-07" />
                                <span className="sr-only">{t("common.required")}</span>
                            </label>
                            <Input
                                id="nxisas-otp-input"
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder={t("own_account_transfer.engine.otp.placeholder")}
                                className="h-9 flex-1 py-2"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Footer — Settings family rhythm: `border-t
                        px-6 py-3 gap-2 justify-end` (CLAUDE.md §3a).
                        Canonical button chrome (`h-8 px-3
                        text-wb-14-tight font-medium`) keeps this
                        consistent with every other Settings dialog
                        footer — never inlines Figma's `#1565c0`. */}
                    <div className="flex shrink-0 items-center justify-end gap-2 border-t border-wb-border-sidebar px-6 py-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("own_account_transfer.engine.cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={!canConfirm}
                            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {t("own_account_transfer.engine.ok")}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

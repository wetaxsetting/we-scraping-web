"use client";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

type EngineNotInstalledDialogProps = {
    open:    boolean;
    onClose: () => void;
};

/**
 * "Download and Install the WECMS Program" popup — Figma 271:7388.
 *
 * <p>Surfaced by {@link OwnAccountTransferPage} when
 * {@link useNxisasEngine} reports {@code status === "not_installed"}.
 * Replaces the inline engine-banner for the not-installed case so the
 * download CTA is the single, prominent UX surface instead of a thin
 * pill above the filter row.
 *
 * <p>Behaviour:
 * <ul>
 *   <li>Outside-click and ESC dismissal are disabled — the user must
 *       acknowledge the prompt via the X close icon or the Download
 *       button (the {@code <a>}-based primary follows the existing
 *       {@code /nxisas/file/NXiSAS.exe} download path).</li>
 *   <li>The download URL matches the legacy banner so the installer
 *       served stays a single source of truth.</li>
 * </ul>
 */
export default function EngineNotInstalledDialog({
    open,
    onClose,
}: EngineNotInstalledDialogProps) {
    const { t } = useTranslation();

    // Body paragraph carries an inline-bolded "Download" reference to
    // the CTA at the footer. Use a placeholder split so the localized
    // download label (single source of truth — drives both the bold
    // word and the button text) survives translation.
    const downloadCta = t("own_account_transfer.engine.install_modal.download_cta");
    const description = t(
        "own_account_transfer.engine.install_modal.description",
        { download: "__BOLD_DOWNLOAD__" },
    );
    const [descBefore, descAfter] = description.split("__BOLD_DOWNLOAD__");

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent
                // Engine prompt is the gate to the entire transfer flow,
                // so neither outside-click nor ESC may dismiss it — only
                // the X icon and the Download CTA close the modal (per
                // CLAUDE.md §"Modal stack — interaction & close behaviour").
                closeOnOutsideClick={false}
                closeOnEscape={false}
                aria-describedby={undefined}
                // `rounded-2xl` (16 px) + `p-0` matches the Settings
                // family rhythm (AddNewContactDialog, NewFirmBankingDialog,
                // etc. — see CLAUDE.md §3b.C "Modal radius"). The body
                // section below owns the inner padding so the hero icon
                // can sit above the title without forcing the standard
                // DialogHeader layout.
                className="max-w-[500px] rounded-2xl p-0"
            >
                {/* Body — Figma 271:7389 shows a centered hero (icon +
                    title) above the left-aligned copy, which doesn't fit
                    the standard left-aligned DialogHeader slot. We keep
                    the custom layout but use the Settings standard
                    `px-6` horizontal padding so the surface rhythm
                    matches every other Settings dialog. */}
                <div className="flex flex-col px-6 pb-5 pt-9">
                    {/* Orange speaker icon — Figma 271:7391. The 48px
                        amber circle reuses the same `#F5A524` warning
                        token that powers the system-dialog warning icon
                        ({@link DialogIcon}), so the colour stays
                        consistent across both Figma-named warning
                        surfaces in the app. */}
                    <div className="flex justify-center">
                        <span
                            aria-hidden
                            className="flex size-12 items-center justify-center rounded-full bg-[#F5A524]"
                        >
                            <SpeakerIcon />
                        </span>
                    </div>

                    {/* Title — bold + centered per Figma 271:7396.
                        Token chain matches the Settings compact-dialog
                        title rule (CLAUDE.md §3b.A): `text-wb-16
                        font-semibold tracking-wb-tight text-wb-dark`. */}
                    <DialogTitle asChild>
                        <h2 className="mt-5 text-center text-wb-16 font-semibold tracking-wb-tight text-wb-dark">
                            {t("own_account_transfer.engine.install_modal.title")}
                        </h2>
                    </DialogTitle>

                    {/* Body paragraph — `text-wb-14-relaxed` (14/22)
                        matches the Figma 23.1px leading closely; bolded
                        "Download" reference is composed inline from the
                        same localized CTA label. */}
                    <p className="mt-5 text-wb-14-relaxed font-normal text-wb-ntrl-8">
                        {descBefore}
                        <strong className="font-semibold text-wb-ink">
                            {`'${downloadCta}'`}
                        </strong>
                        {descAfter}
                    </p>

                    {/* Recommended Requirements — heading + bulleted
                        list. Bullets are inline literals (Figma 271:7407
                        carries the "• " glyph as part of the text, not
                        as a list-marker) so there's no `<ul>` markers
                        to override. */}
                    <section className="mt-5 flex flex-col gap-1">
                        <p className="text-wb-14 font-normal text-wb-ntrl-8">
                            {t("own_account_transfer.engine.install_modal.requirements_heading")}
                        </p>
                        <ul className="flex flex-col">
                            <RequirementLine>
                                {t("own_account_transfer.engine.install_modal.requirement_device")}
                            </RequirementLine>
                            <RequirementLine>
                                {t("own_account_transfer.engine.install_modal.requirement_os")}
                            </RequirementLine>
                            <RequirementLine>
                                {t("own_account_transfer.engine.install_modal.requirement_browser")}
                            </RequirementLine>
                        </ul>
                    </section>

                    {/* Contact Us for Troubleshooting */}
                    <section className="mt-4 flex flex-col gap-1">
                        <p className="text-wb-14 font-normal text-wb-ntrl-8">
                            {t("own_account_transfer.engine.install_modal.contact_heading")}
                        </p>
                        <ul className="flex flex-col">
                            <li className="text-wb-14-relaxed font-normal text-wb-ntrl-8">
                                {t("own_account_transfer.engine.install_modal.contact_zalo")}
                            </li>
                            <li className="text-wb-14-relaxed font-normal text-wb-ntrl-8">
                                {t("own_account_transfer.engine.install_modal.contact_kakao")}
                            </li>
                        </ul>
                    </section>
                </div>

                {/* Footer — Settings family rhythm: `border-t px-6 py-3
                    gap-2 justify-end` (CLAUDE.md §3a). Figma 271:7422
                    shows a divider + right-aligned Download CTA; the
                    canonical footer chrome reproduces both. */}
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-wb-border-sidebar px-6 py-3">
                    {/* The installer is served from `/nxisas/file/NXiSAS.exe`
                        — same path the legacy `<EngineStatusBanner>` link
                        targets. Keep the URL in lockstep across both
                        surfaces so a backend move only edits one place
                        (search the repo for the literal). */}
                    <a
                        href="/nxisas/file/NXiSAS.exe"
                        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                    >
                        {downloadCta}
                    </a>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * One bullet line inside the "Recommended Requirements" group. The "• "
 * glyph is part of the rendered text (Figma 271:7407 — the bullet is
 * inline, not a `list-style` marker) so the row aligns left with no
 * leading indentation.
 */
function RequirementLine({ children }: { children: React.ReactNode }) {
    return (
        <li className="text-wb-14-relaxed font-normal text-wb-ntrl-8">
            {children}
        </li>
    );
}

/**
 * Inline speaker / megaphone glyph centered inside the orange badge.
 * 24×24 viewBox matching Figma 271:7392; rendered in white against the
 * amber circle.
 */
function SpeakerIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <path
                d="M4 9.5h3.2L13 5v14L7.2 14.5H4Z"
                fill="white"
            />
            <path
                d="M15.8 8.8c1.1 1 1.7 2.3 1.7 3.7s-.6 2.7-1.7 3.7"
                stroke="white"
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
            />
            <path
                d="M18.5 6.4c1.9 1.6 3 4 3 6.6s-1.1 5-3 6.6"
                stroke="white"
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
            />
        </svg>
    );
}

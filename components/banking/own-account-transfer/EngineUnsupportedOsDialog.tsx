"use client";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

type EngineUnsupportedOsDialogProps = {
    open:    boolean;
    onClose: () => void;
};

/**
 * "System requirements for Real-Time Online Inquiry" popup — Figma
 * 272:7700.
 *
 * <p>Surfaced by {@link OwnAccountTransferPage} when
 * {@link useNxisasEngine} reports {@code status === "unsupported_os"}
 * (non-Windows). Replaces the inline engine banner for the unsupported
 * OS case so the requirements are presented as a modal acknowledgment
 * instead of a thin warning pill — the user must close the dialog to
 * proceed.
 *
 * <p>This popup is the sibling surface to
 * {@link EngineNotInstalledDialog} (Figma 271:7388) — they share the
 * same chrome (orange amber icon, centered title, left-aligned body,
 * bottom-right primary button) but render distinct CTAs:
 * {@code Download} for the not-installed case (kicks off the
 * installer) and {@code Close} for the unsupported-OS case (no
 * installer exists for macOS / Linux).
 */
export default function EngineUnsupportedOsDialog({
    open,
    onClose,
}: EngineUnsupportedOsDialogProps) {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent
                // Outside-click + ESC are disabled — the user must
                // acknowledge the requirements via the X icon or the
                // Close button (per CLAUDE.md §"Modal stack —
                // interaction & close behaviour").
                closeOnOutsideClick={false}
                closeOnEscape={false}
                aria-describedby={undefined}
                // `rounded-2xl` + `p-0` matches the Settings family
                // rhythm (CLAUDE.md §3b.C "Modal radius"). Body owns
                // its own padding so the centered hero icon can sit
                // above the title.
                className="max-w-[540px] rounded-2xl p-0"
            >
                {/* Body — Figma 272:7701 shows a centered hero (icon +
                    title) above a left-aligned requirements list. We
                    keep the custom layout but normalize the horizontal
                    padding to the Settings standard `px-6` so the
                    surface rhythm matches every other Settings dialog
                    (CLAUDE.md §3b.E "No inline px sizes"). */}
                <div className="flex flex-col items-center px-6 pb-5 pt-9">
                    {/* Orange speaker icon — Figma 272:7703. Reuses the
                        `#F5A524` amber token from the shared
                        {@link DialogIcon} warning variant so both
                        engine prompts share one colour. */}
                    <span
                        aria-hidden
                        className="flex size-12 items-center justify-center rounded-full bg-[#F5A524]"
                    >
                        <SpeakerIcon />
                    </span>

                    {/* Title — bold + centered per Figma 272:7707.
                        Token chain matches the Settings compact-dialog
                        title rule (CLAUDE.md §3b.A). */}
                    <DialogTitle asChild>
                        <h2 className="mt-4 text-center text-wb-16 font-semibold tracking-wb-tight text-wb-dark">
                            {t("own_account_transfer.engine.unsupported_os_modal.title")}
                        </h2>
                    </DialogTitle>

                    {/* Body — left-aligned, 380px width, with the
                        intro line followed by 3 bullet rows and the
                        macOS note (which uses `*` prefix, not the
                        `・` glyph the bullet rows do). */}
                    <div className="mt-5 flex w-full max-w-[380px] flex-col self-center">
                        <p className="text-wb-14-relaxed font-normal text-wb-ntrl-8">
                            {t("own_account_transfer.engine.unsupported_os_modal.intro")}
                        </p>
                        <ul className="mt-1 flex flex-col">
                            <BulletLine>
                                {t("own_account_transfer.engine.unsupported_os_modal.requirement_device")}
                            </BulletLine>
                            <BulletLine>
                                {t("own_account_transfer.engine.unsupported_os_modal.requirement_os")}
                            </BulletLine>
                            <li className="text-wb-14-relaxed font-normal text-wb-ntrl-8">
                                {t("own_account_transfer.engine.unsupported_os_modal.macos_note")}
                            </li>
                            <BulletLine>
                                {t("own_account_transfer.engine.unsupported_os_modal.requirement_browser")}
                            </BulletLine>
                        </ul>
                    </div>
                </div>

                {/* Footer — Settings family rhythm: `border-t px-6
                    py-3 gap-2 justify-end` (CLAUDE.md §3a). Reuses
                    the canonical primary button chrome (`h-8 px-3
                    text-wb-14-tight font-medium` + `bg-brand`); never
                    inlines Figma's `#1565c0` since `bg-brand` is the
                    only sanctioned primary blue. */}
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-wb-border-sidebar px-6 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                    >
                        {t("own_account_transfer.engine.unsupported_os_modal.close_cta")}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * One requirement row with the leading `・` glyph baked into the i18n
 * string (Figma 272:7713 — the bullet is inline literal, not a
 * `list-style` marker). Same shape as the install-modal's
 * {@code RequirementLine} so both engine prompts read identically.
 */
function BulletLine({ children }: { children: React.ReactNode }) {
    return (
        <li className="text-wb-14-relaxed font-normal text-wb-ntrl-8">
            {children}
        </li>
    );
}

/**
 * Inline speaker / megaphone glyph centered inside the orange badge.
 * 24×24 viewBox matching Figma 272:7704; rendered in white against the
 * amber circle. Twin of the icon in {@link EngineNotInstalledDialog}.
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

"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import DialogIcon from "./DialogIcon";
import type { DialogOptions } from "./types";

/*
 * SystemDialog — Figma-matched modal for the four system feedback types
 * (warning / error / success / confirmation). Nodes 9452:29515, 9452:29528,
 * 9452:29541, 9452:29559.
 *
 * Spec (identical across all four):
 *   Card       : rounded-12, shadow 0 2 30 rgba(0,0,0,0.08), bg-white
 *   Header     : 24px close button, justify-end, pt-14 px-14
 *   Body       : 38px icon + 18/600 black title + 14/22 500 #404040 body,
 *                divider 1px rgba(0,0,0,0.15), gap-10, px-24 py-20
 *   Footer     : right-aligned button row, p-14 gap-10
 *   Primary    : bg #0060b9, rounded-6, 13/600 white, tracking -0.01em
 *   Secondary  : bg white, border #e0e0e0, 13/500 black (confirmation only)
 *   Overlay    : added here (not in Figma) — rgba(0,0,0,0.45) full-screen
 */

const DEFAULT_TITLE_KEY: Record<DialogOptions["type"], string> = {
    warning: "dialog.warning",
    error: "dialog.error",
    success: "dialog.success",
    confirmation: "dialog.confirmation",
};

type SystemDialogProps = DialogOptions & {
    open: boolean;
    /** Called when the dialog is dismissed for any reason (X / ESC / overlay / Cancel / OK). */
    onDismiss: () => void;
};

export default function SystemDialog({
    open,
    type,
    title,
    description,
    errorCode,
    uuid,
    confirmText,
    cancelText,
    dismissible = true,
    onClose,
    onConfirm,
    onCancel,
    onDismiss,
}: SystemDialogProps) {
    const { t } = useTranslation();
    const titleId = useId();
    const descriptionId = useId();
    const cardRef = useRef<HTMLDivElement>(null);
    const primaryRef = useRef<HTMLButtonElement>(null);

    const isConfirmation = type === "confirmation";
    const primaryLabel = confirmText ?? t(isConfirmation ? "dialog.continue" : "dialog.ok");
    const secondaryLabel = cancelText ?? t("dialog.cancel");
    const resolvedTitle = title ?? t(DEFAULT_TITLE_KEY[type]);

    // Focus the primary action when opened; return focus to the previous
    // active element when closed. Also lock body scroll while open.
    useEffect(() => {
        if (!open) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        primaryRef.current?.focus();
        return () => {
            document.body.style.overflow = prevOverflow;
            previouslyFocused?.focus?.();
        };
    }, [open]);

    // ESC closes when dismissible; trap Tab inside the card.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && dismissible) {
                e.stopPropagation();
                handleClose();
                return;
            }
            if (e.key === "Tab" && cardRef.current) {
                const focusables = cardRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                );
                if (focusables.length === 0) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, dismissible]);

    if (!open || typeof document === "undefined") return null;

    const handleClose = () => {
        onClose?.();
        onDismiss();
    };

    const handleConfirm = () => {
        onConfirm?.();
        onDismiss();
    };

    const handleCancel = () => {
        onCancel?.();
        onDismiss();
    };

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
            onMouseDown={(e) => {
                // Dismiss when the backdrop itself is clicked (not the card).
                if (e.target === e.currentTarget && dismissible) handleClose();
            }}
        >
            <div
                ref={cardRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className="flex w-full max-w-[500px] flex-col rounded-[12px] bg-white shadow-[0_2px_30px_0_rgba(0,0,0,0.08)]"
            >
                {/* Header — close button */}
                <div className="flex items-center justify-end px-[14px] pt-[14px]">
                    <button
                        type="button"
                        aria-label={t("dialog.close")}
                        onClick={handleClose}
                        disabled={!dismissible}
                        className={cn(
                            "flex size-6 items-center justify-center rounded-sm text-wb-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                            dismissible ? "hover:bg-black/5" : "invisible",
                        )}
                    >
                        <X className="size-[18px]" strokeWidth={2} />
                    </button>
                </div>

                {/* Body — icon, title, description, optional error-code + uuid trailer */}
                <div className="flex flex-col items-center gap-[10px] border-b border-black/15 px-6 py-5 text-center">
                    <DialogIcon type={type} className="flex size-[38px] items-center justify-center" />
                    <h2
                        id={titleId}
                        className="text-wb-18 font-semibold text-black"
                    >
                        {resolvedTitle}
                    </h2>
                    <div
                        id={descriptionId}
                        className="w-full text-wb-14-relaxed font-medium text-wb-ntrl-8"
                    >
                        {description && <p className="whitespace-pre-line">{description}</p>}
                        {errorCode && <p>{t("dialog.error_code", { code: errorCode })}</p>}
                        {uuid && <p className="break-all">{t("dialog.uuid", { uuid })}</p>}
                    </div>
                </div>

                {/* Footer — button rail */}
                <div className="flex items-center justify-end gap-[10px] p-[14px]">
                    {isConfirmation && (
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="flex items-center gap-1 rounded-md border border-wb-border-sidebar bg-white px-[14px] py-[8px] text-wb-13 font-medium tracking-wb-tight text-black hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                        >
                            {secondaryLabel}
                        </button>
                    )}
                    <button
                        ref={primaryRef}
                        type="button"
                        onClick={handleConfirm}
                        className="flex items-center gap-1 rounded-md bg-brand px-[14px] py-[8px] text-wb-13 font-semibold tracking-wb-tight text-white hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                        {primaryLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

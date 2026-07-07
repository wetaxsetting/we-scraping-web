"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { modalStack } from "@/lib/modalStack";
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
 *
 * z-index — `z-[100]`, intentionally above every shadcn `<Dialog>`
 * `stackLevel` slot (max L5 → `z-[91]` per components/ui/dialog.tsx). The
 * SystemDialog is the canonical "always-on-top feedback" surface — when
 * a Save / error / success fires from inside a stacked modal chain
 * (Settings → Registered → Login ID/PW → Select Bank Accounts → success),
 * the popup MUST render above the chain or the user sees nothing. Do
 * not lower this; if a deeper stackLevel is added to dialog.tsx, bump
 * this past it too.
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
    destructive = false,
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

    // ESC closes when dismissible; trap Tab inside the card. The shared
    // modalStack gates ESC so a SystemDialog opened above a stacked
    // Radix chain only consumes its OWN Escape — pressing ESC while a
    // popover or inner control inside the dialog is focused still works
    // because nothing else above us is on the stack.
    useEffect(() => {
        if (!open) return;
        const stackId = modalStack.push();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && dismissible) {
                if (!modalStack.isTop(stackId)) return;
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
        return () => {
            document.removeEventListener("keydown", onKey);
            modalStack.pop(stackId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, dismissible]);

    // OUTSIDE-CLICK POLICY — system dialogs (Success / Warning / Error /
    // Confirmation) are intentionally NOT dismissable by clicking the
    // dim backdrop. They only close via:
    //   - the OK / Confirm primary button       → handleConfirm
    //   - the Cancel button (confirmation type)  → handleCancel
    //   - the X close button (top-right)         → handleClose
    //   - the ESC key (accessibility, gated by `dismissible`) → handleClose
    // Rationale: feedback / decision dialogs in this app convey a
    // committed result (a save just succeeded, an error just occurred,
    // a destructive action needs explicit confirmation). A stray
    // backdrop click during a stacked-modal flow (e.g. Settings →
    // Registered → Login ID/PW → ... → success) would silently miss
    // the user's acknowledgement and leave the chain in an undefined
    // state. Closing must stay an explicit, intentional action.
    //
    // The `pointer-events-auto` class on the wrapper (further below)
    // remains load-bearing — it lets the OK / Cancel / X buttons
    // receive clicks even when a Radix DismissableLayer underneath has
    // set `body { pointer-events: none }`, AND it makes the layer
    // below SystemDialog fully non-interactive while the dialog is up.
    // Do NOT add a backdrop `onMouseDown` / `onPointerDown` /
    // document-level pointerdown listener here.

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
            // `pointer-events-auto` is load-bearing: when SystemDialog
            // opens on top of a stacked Radix `<Dialog>` chain (Settings →
            // Registered → Select Bank Accounts → success), Radix has
            // already set `body { pointer-events: none }` via its modal
            // DismissableLayer. Without re-enabling pointer events on
            // this portal, OK / Cancel / X all silently fail and clicks
            // fall through to the Radix dialog underneath, which DOES
            // have `pointer-events: auto` set on its content. Setting
            // `pointer-events: auto` here also makes this layer absorb
            // every wheel / pointer / touch event aimed at the chain
            // below — that's what gives us the "background
            // non-interactive while a system dialog is up" behaviour
            // (clicks land on the inert backdrop and do nothing,
            // because by policy this dialog has no outside-click
            // handler — see the OUTSIDE-CLICK POLICY block above).
            className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
            // Backdrop dismissal is handled by the document-level
            // `pointerdown` capture-phase listener above — keeping a
            // React `onMouseDown` here too would double-fire and could
            // race with the listener under Radix DismissableLayer.
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

                {/* Body — icon, title, description, optional error-code + uuid trailer.

                   Message rendering must stay readable for every message
                   length + shape a call site can throw at it — a two-word
                   success ack, a multi-line validation list, and a raw
                   backend I/O error carrying an unbreakable URL / API path
                   (e.g. "…coocon.co.kr:8443/overseas/finance/scrap/…"). Two
                   safeguards make that work:

                     • `wrap-anywhere` (overflow-wrap:anywhere) lets long
                       URLs / paths wrap at ANY point instead of overflowing
                       the card or breaking raggedly outside it. It is an
                       inherited property, so setting it on the description
                       container covers every child paragraph.
                     • `max-h-[60vh]` + `overflow-y-auto` keeps the icon +
                       title pinned and scrolls only the message body when a
                       stack-trace-length error would otherwise push the OK
                       button off-screen.

                   `text-center` stays (Figma spec, shared by all four
                   types) but is paired with `whitespace-pre-line` so callers
                   that pass "\n"-separated multi-line copy keep their line
                   breaks. `space-y-1` opens a small gap between the message
                   and the (Error Code) / UUID diagnostic trailer so they no
                   longer read as one glued paragraph. */}
                <div className="flex flex-col items-center gap-[10px] border-b border-black/15 px-6 py-5 text-center">
                    <DialogIcon type={type} className="flex size-[38px] shrink-0 items-center justify-center" />
                    <h2
                        id={titleId}
                        className="wrap-anywhere text-wb-18 font-semibold text-black"
                    >
                        {resolvedTitle}
                    </h2>
                    <div
                        id={descriptionId}
                        className="custom-scrollbar-y max-h-[60vh] w-full space-y-1 overflow-y-auto wrap-anywhere text-wb-14-relaxed font-medium text-wb-ntrl-8"
                    >
                        {description && <p className="whitespace-pre-line">{description}</p>}
                        {errorCode && <p>{t("dialog.error_code", { code: errorCode })}</p>}
                        {uuid && <p className="break-all">{t("dialog.uuid", { uuid })}</p>}
                    </div>
                </div>

                {/* Footer — button rail.

                   Confirmation type renders BOTH buttons: secondary
                   (Cancel) on the left, primary (Continue / Delete) on
                   the right. The primary button is ALWAYS rendered for
                   every type; only Cancel is gated by `isConfirmation`.
                   Don't add conditional gating around the primary
                   button — every type (success / error / warning /
                   confirmation) needs the OK / Continue affordance.

                   Destructive variant (`destructive: true` + `type ===
                   "confirmation"`) reuses the SAME proven
                   `--color-destructive` token that
                   {@code components/ui/button.tsx}'s `destructive`
                   variant uses (`bg-destructive` /
                   `hover:bg-destructive/90`). Earlier revisions tried
                   the WB365-feature `wb-red-07` token but that one
                   resolved as transparent in some build environments
                   (Tailwind 4 JIT cache miss against tokens used in
                   only one file), painting the destructive button
                   white-on-white and effectively invisible. The
                   shadcn-default `destructive` token is registered in
                   `@theme inline` against both light + dark scopes
                   and is exercised everywhere shadcn `<Button
                   variant="destructive">` is used — the safest source
                   of truth for "destructive intent" in this project. */}
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
                        className={cn(
                            "flex items-center gap-1 rounded-md px-[14px] py-[8px] text-wb-13 font-semibold tracking-wb-tight text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                            destructive
                                ? "bg-destructive hover:bg-destructive/90"
                                : "bg-brand hover:bg-brand-hover",
                        )}
                    >
                        {primaryLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

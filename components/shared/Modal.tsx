"use client";

import type { ReactNode } from "react";

import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, type DialogStackLevel } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Feature dialog with the WeInvoice chrome (UI Spec v1.0): 16/600 title row,
 * scrollable body, right-aligned footer. Built on the shared shadcn
 * `<Dialog>` primitive (CLAUDE.md §3a) so stacking, focus trap, ESC handling
 * and the modal stack stay owned by one place — only the width varies.
 *
 * `stackLevel` must match the dialog's position in the open chain (a modal
 * opened from inside another modal passes 2).
 */
export function Modal({
    open,
    onClose,
    title,
    children,
    footer,
    width = 560,
    className,
    bodyClassName,
    closeOnBackdrop,
    stackLevel = 1,
}: {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    /** Max width in px (or any CSS length). */
    width?: number | string;
    className?: string;
    bodyClassName?: string;
    closeOnBackdrop?: boolean;
    stackLevel?: DialogStackLevel;
}) {
    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent
                stackLevel={stackLevel}
                closeOnOutsideClick={closeOnBackdrop}
                aria-describedby={undefined}
                className={cn("max-h-[92vh] rounded-2xl", className)}
                // Width is per-dialog data (Figma / spec px), not a design token.
                style={{ maxWidth: width }}
            >
                <DialogHeader className="shrink-0 border-b border-wb-border-sidebar px-5 pt-4 pb-4">
                    <DialogTitle className="text-wb-16">{title}</DialogTitle>
                </DialogHeader>
                <DialogBody className={cn("custom-scrollbar min-h-0 flex-1 overflow-auto px-5 py-4", bodyClassName)}>{children}</DialogBody>
                {footer && <DialogFooter className="shrink-0 px-5">{footer}</DialogFooter>}
            </DialogContent>
        </Dialog>
    );
}

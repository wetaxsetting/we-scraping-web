"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DialogKind } from "./types";

export type ToastItem = { id: number; kind: DialogKind; text: string };

const ICON: Record<DialogKind, React.ReactNode> = {
    info: <Info className="size-5 text-brand" />,
    success: <CheckCircle2 className="size-5 text-wb-status-approved-text" />,
    warning: <AlertTriangle className="size-5 text-wb-warning" />,
    error: <XCircle className="size-5 text-wb-status-rejected-text" />,
};

/**
 * Bottom-right toast stack owned by <DialogProvider>. Toasts never block the
 * page (pointer-events only on the cards) and sit above the SystemDialog
 * layer so a toast fired after a dialog closes stays visible.
 */
export default function Toaster({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
    if (toasts.length === 0) return null;
    return (
        <div className="pointer-events-none fixed right-4 bottom-4 z-[110] flex flex-col gap-2">
            {toasts.map((x) => (
                <div
                    key={x.id}
                    role="status"
                    className={cn(
                        "wb-fade-in pointer-events-auto flex max-w-[420px] min-w-[280px] items-start gap-2.5 rounded-lg border bg-white px-4 py-3 shadow-wb-popup",
                        x.kind === "error" ? "border-wb-red-04" : "border-wb-border-sidebar",
                    )}
                >
                    <span className="shrink-0">{ICON[x.kind]}</span>
                    <span className="flex-1 text-wb-13 font-medium text-wb-ink">{x.text}</span>
                    <button
                        type="button"
                        aria-label="Close"
                        className="cursor-pointer text-wb-ntrl-5 hover:text-wb-ink"
                        onClick={() => onDismiss(x.id)}
                    >
                        <X className="size-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}

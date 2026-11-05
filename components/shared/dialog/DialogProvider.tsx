"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import SystemDialog from "./SystemDialog";
import Toaster, { type ToastItem } from "./Toaster";
import type { DialogApi, DialogKind, DialogOptions, DialogType } from "./types";

/*
 * Global dialog system.
 *
 * Mount <DialogProvider> once near the root of the app (done in app/layout.tsx).
 * Any client component can then call `useDialog()`; there is only ever a
 * single system dialog on screen — a new call replaces the current one.
 *
 * Usage:
 *   const dialog = useDialog();
 *   dialog.open({ type: "error", description: "Something went wrong." });
 *
 *   // Promise helpers (WeInvoice screens):
 *   await dialog.alert({ title: t("dialog.error"), message: "…", kind: "error" });
 *   if (await dialog.confirm({ title: t("dialog.confirmation"), message: "…" })) { … }
 *   dialog.toast(t("…saved"), "success");
 */

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
    const ctx = useContext(DialogContext);
    if (!ctx) {
        throw new Error("useDialog() must be used inside <DialogProvider>");
    }
    return ctx;
}

const KIND_TO_TYPE: Record<DialogKind, DialogType> = {
    info: "warning",
    warning: "warning",
    success: "success",
    error: "error",
};

const TOAST_MS = 3800;

export default function DialogProvider({ children }: { children: ReactNode }) {
    const [dialog, setDialog] = useState<DialogOptions | null>(null);
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const toastSeq = useRef(0);

    const open = useCallback((options: DialogOptions) => {
        setDialog(options);
    }, []);

    const close = useCallback(() => {
        setDialog(null);
    }, []);

    const alert = useCallback<DialogApi["alert"]>(
        (o) =>
            new Promise<void>((resolve) => {
                setDialog({
                    type: KIND_TO_TYPE[o.kind ?? "info"],
                    title: o.title,
                    description: o.message,
                    onClose: () => resolve(),
                    onConfirm: () => resolve(),
                });
            }),
        [],
    );

    const confirm = useCallback<DialogApi["confirm"]>(
        (o) =>
            new Promise<boolean>((resolve) => {
                setDialog({
                    type: "confirmation",
                    title: o.title,
                    description: o.message,
                    confirmText: o.confirmLabel,
                    cancelText: o.cancelLabel,
                    destructive: o.danger,
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false),
                    onClose: () => resolve(false),
                });
            }),
        [],
    );

    const dismissToast = useCallback((id: number) => {
        setToasts((list) => list.filter((x) => x.id !== id));
    }, []);

    const toast = useCallback<DialogApi["toast"]>(
        (text, kind = "success") => {
            const id = ++toastSeq.current;
            setToasts((list) => [...list, { id, kind, text }]);
            setTimeout(() => dismissToast(id), TOAST_MS);
        },
        [dismissToast],
    );

    const api = useMemo<DialogApi>(() => ({ open, close, alert, confirm, toast }), [open, close, alert, confirm, toast]);

    return (
        <DialogContext.Provider value={api}>
            {children}
            {dialog && (
                <SystemDialog
                    open
                    {...dialog}
                    onDismiss={close}
                />
            )}
            <Toaster toasts={toasts} onDismiss={dismissToast} />
        </DialogContext.Provider>
    );
}

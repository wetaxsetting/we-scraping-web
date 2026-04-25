"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import SystemDialog from "./SystemDialog";
import type { DialogApi, DialogOptions } from "./types";

/*
 * Global dialog system.
 *
 * Mount <DialogProvider> once near the root of the app (done in app/layout.tsx).
 * Any client component can then call `useDialog().open({...})` to show one of
 * the four Figma-matched dialogs; there is only ever a single dialog on screen
 * — a new call replaces the current one.
 *
 * Usage:
 *   const dialog = useDialog();
 *   dialog.open({ type: "error", description: "Something went wrong." });
 *   dialog.open({
 *       type: "confirmation",
 *       title: "Sign out?",
 *       description: "You will be returned to the login page.",
 *       confirmText: "Sign out",
 *       onConfirm: () => signOut(),
 *   });
 */

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
    const ctx = useContext(DialogContext);
    if (!ctx) {
        throw new Error("useDialog() must be used inside <DialogProvider>");
    }
    return ctx;
}

export default function DialogProvider({ children }: { children: ReactNode }) {
    const [dialog, setDialog] = useState<DialogOptions | null>(null);

    const open = useCallback((options: DialogOptions) => {
        setDialog(options);
    }, []);

    const close = useCallback(() => {
        setDialog(null);
    }, []);

    const api = useMemo<DialogApi>(() => ({ open, close }), [open, close]);

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
        </DialogContext.Provider>
    );
}

"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import SettingsModal from "./SettingsModal";
import type { SettingsPanelKey } from "./types";

type SettingsModalApi = {
    /** Open the Settings popup. Optionally focuses a specific panel on open. */
    open: (panel?: SettingsPanelKey) => void;
    close: () => void;
};

const SettingsModalContext = createContext<SettingsModalApi | null>(null);

/**
 * Read the Settings modal controls. Any component mounted under
 * <SettingsModalProvider> (currently <AppShell>, so every dashboard route)
 * can call `useSettingsModal().open()` to pop the modal — including the
 * top-nav "Settings" menu in <Header>. Page components no longer own the
 * open/close state; the provider does.
 */
export function useSettingsModal(): SettingsModalApi {
    const ctx = useContext(SettingsModalContext);
    if (!ctx) {
        throw new Error("useSettingsModal() must be used inside <SettingsModalProvider>");
    }
    return ctx;
}

/**
 * Global controller for the Settings popup modal. Mounted once inside
 * <AppShell> so the modal is rendered on top of every authenticated page
 * without each page having to wire its own `<SettingsModal>` instance.
 *
 * Conditional-mount (`{state && <SettingsModal … />}`) is intentional:
 * closing the modal unmounts its subtree so the active panel / toggle
 * overrides reset cleanly on the next open, matching the "starts fresh"
 * expectation of a popup.
 */
export default function SettingsModalProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<{ panel: SettingsPanelKey } | null>(null);

    const open = useCallback((panel: SettingsPanelKey = "purpose") => {
        setState({ panel });
    }, []);

    const close = useCallback(() => {
        setState(null);
    }, []);

    const api = useMemo<SettingsModalApi>(() => ({ open, close }), [open, close]);

    return (
        <SettingsModalContext.Provider value={api}>
            {children}
            {state && (
                <SettingsModal open onClose={close} initialPanel={state.panel} />
            )}
        </SettingsModalContext.Provider>
    );
}

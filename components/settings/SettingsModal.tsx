"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import PurposePanel from "./purpose/PurposePanel";
import SettingsNav from "./SettingsNav";
import type { SettingsPanelKey } from "./types";

type SettingsModalProps = {
    open: boolean;
    onClose: () => void;
    /** Which panel to show when the modal first opens. Defaults to "purpose". */
    initialPanel?: SettingsPanelKey;
};

/**
 * Shell for the Settings popup modal — Figma 9196:11717.
 *
 * Structure:
 *   - Fullscreen dimmed overlay, portal-mounted to <body>.
 *   - Centered white card (1116 x 736) — `flex min-h-0 flex-row`.
 *   - Left: <SettingsNav> — menu items, scrolls independently.
 *   - Right: active panel (<PurposePanel> today, more to come).
 *
 * The shell is dumb: it owns "which panel is active", overlay/ESC
 * dismissal, and the close + back affordances. Each panel owns its
 * own header / tabs / scroll container.
 *
 * Callers conditionally render this component (`{open && <SettingsModal … />}`)
 * so that closing the modal unmounts internal state — re-opening then starts
 * fresh from `initialPanel` without an imperative reset.
 */
export default function SettingsModal({
    open,
    onClose,
    initialPanel = "purpose",
}: SettingsModalProps) {
    const { t } = useTranslation();
    const cardRef = useRef<HTMLDivElement>(null);
    const [panel, setPanel] = useState<SettingsPanelKey>(initialPanel);

    // Lock body scroll while open; close on ESC.
    useEffect(() => {
        if (!open) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener("keydown", onKey);
        };
    }, [open, onClose]);

    if (!open || typeof document === "undefined") return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={cardRef}
                role="dialog"
                aria-modal="true"
                aria-label={t("settings.title")}
                className={cn(
                    // Fixed 1300×760 to match legacy `.layerCont.setting-pagepopup-ver2
                    // .layerPopupWrap` (dev.wecms.vn). `max-w`/`max-h` with the
                    // viewport-minus-32 fallback keeps the card on-screen when the
                    // viewport is smaller than the fixed size (the overlay's `p-4`
                    // provides the 16px inset on each side).
                    "flex h-[var(--w-wb-settings-card-h)] max-h-[calc(100vh-32px)] w-[var(--w-wb-settings-card)] max-w-[calc(100vw-32px)] overflow-hidden rounded-[12px] bg-white shadow-[0_2px_30px_0_rgba(0,0,0,0.08)]",
                )}
            >
                <SettingsNav
                    active={panel}
                    onChange={setPanel}
                />

                {/* Right column — flex-col so the panel controls its own
                   internal scroll region (tabs/table/Add-button layout). */}
                <div className="relative flex min-w-0 flex-1 flex-col">
                    {/* Close affordance (Esc + X) lives on the shell, not the
                       panel, so every future panel gets the same behaviour
                       without re-implementing it. */}
                    <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
                        <span className="text-wb-12 font-medium text-wb-muted">
                            {t("settings.esc")}
                        </span>
                        <button
                            type="button"
                            aria-label={t("settings.close")}
                            onClick={onClose}
                            className="flex size-6 cursor-pointer items-center justify-center rounded-sm text-wb-ink hover:bg-black/5"
                        >
                            <X className="size-[18px]" strokeWidth={2} />
                        </button>
                    </div>

                    {panel === "purpose" ? (
                        <PurposePanel />
                    ) : (
                        <PanelPlaceholder labelKey={`settings.nav.${panel}`} />
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}

/**
 * Neutral placeholder for settings panels that have not been built yet
 * (VAS Account, Contacts, Approval Line, …). Keeps the shell swappable
 * without leaving empty whitespace the first time a user clicks a nav
 * item that hasn't been implemented.
 */
function PanelPlaceholder({ labelKey }: { labelKey: string }) {
    const { t } = useTranslation();
    return (
        <div className="flex min-h-0 flex-1 items-center justify-center p-10">
            <h3 className="text-wb-18 font-semibold text-wb-dark">{t(labelKey)}</h3>
        </div>
    );
}

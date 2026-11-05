import type { ReactNode } from "react";

export type DialogType = "warning" | "error" | "success" | "confirmation";

/**
 * Shape accepted by `useDialog().open()`. All fields except `type` are optional
 * so callers can pass only what is relevant to their message.
 *
 *  - Warning / Error / Success → single primary button labelled `confirmText`
 *    (defaults to "OK"). `onConfirm` fires on click.
 *  - Confirmation             → secondary "Cancel" + primary "Continue".
 *    `onConfirm` fires on Continue, `onCancel` on Cancel / close.
 *
 * Provide `errorCode` / `uuid` to render the standard diagnostic trailer under
 * the main description (mirrors the JEX error dialog).
 */
export type DialogOptions = {
    type: DialogType;
    title?: string;
    description?: ReactNode;
    errorCode?: string;
    uuid?: string;
    confirmText?: string;
    cancelText?: string;
    /** Show header close button + allow ESC / overlay click to dismiss. Defaults true. */
    dismissible?: boolean;
    /**
     * Render the primary button in the WB365 danger ramp (red) instead
     * of brand blue. Use for destructive confirmations (delete, revoke,
     * disconnect, …) where the user should pause before clicking. Only
     * meaningful for `type: "confirmation"` — ignored for warning /
     * error / success.
     */
    destructive?: boolean;
    onClose?: () => void;
    onConfirm?: () => void;
    onCancel?: () => void;
};

/**
 * Feedback tone for the Promise helpers and toasts. `info` renders with the
 * Warning chrome — per CLAUDE.md "Dialog variant", Warning is the variant for
 * purely informational notices.
 */
export type DialogKind = "info" | "success" | "warning" | "error";

/** Imperative handle returned by `useDialog()`. */
export type DialogApi = {
    open: (options: DialogOptions) => void;
    close: () => void;
    /**
     * Promise sugar over `open()` — resolves when the user dismisses the
     * single-button dialog. Added for the WeInvoice screens (UI Spec v1.0),
     * which await feedback inline instead of passing callbacks.
     */
    alert: (o: { title: string; message?: ReactNode; kind?: DialogKind }) => Promise<void>;
    /**
     * Promise sugar over a `confirmation` dialog — resolves `true` on the
     * primary button, `false` on Cancel / close. `danger` maps to
     * `destructive` (red primary).
     */
    confirm: (o: {
        title: string;
        message?: ReactNode;
        confirmLabel?: string;
        cancelLabel?: string;
        danger?: boolean;
        kind?: DialogKind;
    }) => Promise<boolean>;
    /** Non-blocking bottom-right toast that auto-dismisses after ~4 s. */
    toast: (text: string, kind?: DialogKind) => void;
};

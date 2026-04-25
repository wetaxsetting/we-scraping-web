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
    onClose?: () => void;
    onConfirm?: () => void;
    onCancel?: () => void;
};

/** Imperative handle returned by `useDialog()`. */
export type DialogApi = {
    open: (options: DialogOptions) => void;
    close: () => void;
};

"use client";

import { useEffect, useState } from "react";

import PasswordConfirmationDialog from "@/components/shared/popups/PasswordConfirmationDialog";
import { useDialog } from "@/components/shared/dialog";
import { login, LoginError } from "@/lib/auth/client";
import {
    onReAuthRequest,
    resolveReAuth,
} from "@/lib/auth/sessionExpired";
import { tokenStorage, userStorage } from "@/lib/auth/storage";
import { useTranslation } from "@/lib/i18n";

/**
 * Global session-expired re-auth controller.
 *
 * Subscribes to {@link onReAuthRequest} so any HTTP 401 anywhere in the
 * app surfaces the same Lock Screen popup (legacy JEX `comm_0300_001`
 * parity — see `WECMS DEV/.../jex.wabooks.custom_v2.js:91-117`). The
 * shared `<PasswordConfirmationDialog>` (Figma 83:12764) renders the
 * UI; this component owns only the bus subscription, the
 * re-authentication logic, and the cancel-redirect path.
 *
 * Per CLAUDE.md "Modal stack — interaction & close behaviour" §8 the
 * dialog primitive owns body scroll lock, focus trap, ESC dismissal,
 * and overlay click handling — none of those are reimplemented here.
 *
 * `stackLevel={5}` so a token expiry mid-flow renders above any open
 * Settings → Registered → … chain (max content z is `z-[91]`).
 *
 * Errors from the re-auth attempt route through `useDialog().open(...)`
 * (the global system dialog at `z-[100]`) — single source of truth for
 * warning / error / success / confirmation surfaces.
 */

/**
 * Synthetic identity used by the URL-driven preview mode. Lets the
 * dialog be inspected (and its UI tweaked) without requiring a real
 * 401 + a populated `userStorage`. Switched on by appending
 * `?preview=session-expired` to any authenticated route.
 */
const PREVIEW_USER = {
    userId:      "wecms@wecambodia.com",
    userName:    "krongkampuchea@gmail.com",
    bizKey:      "VN_VNM0004_000001",
    langCode:    "EN",
    companyName: "CONG TY TNHH WEBCASH VN",
    role:        "USER" as const,
    productType: "F",
    taxId:       "1201496252",
} as const;

/** Detect `?preview=session-expired` synchronously at mount.
 *  Returning a boolean from a lazy `useState` initializer avoids the
 *  cascading-`setState`-in-effect lint warning that fires when state
 *  is written inside `useEffect(() => { setX(...) }, [])`. */
function detectPreviewMode(): boolean {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("preview") === "session-expired";
}

export default function SessionExpiredDialog() {
    const { t } = useTranslation();
    const dialog = useDialog();

    /** True when the dialog was opened via `?preview=session-expired` —
     *  in that mode every action is local: no real `login()` call, no
     *  token clear, no redirect. Pure UI rehearsal. Initialized
     *  synchronously so the preview opens on first render. */
    const [previewMode, setPreviewMode] = useState<boolean>(detectPreviewMode);
    const [open, setOpen] = useState<boolean>(detectPreviewMode);
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Subscribe to the bus once. The handler just opens the dialog —
    // the bus tracks the underlying Promise so multiple concurrent 401s
    // collapse to a single open instance.
    useEffect(() => {
        return onReAuthRequest(() => {
            setPassword("");
            setSubmitting(false);
            setPreviewMode(false);
            setOpen(true);
        });
    }, []);

    const close = () => {
        setOpen(false);
        setPassword("");
        setSubmitting(false);
        setPreviewMode(false);
    };

    const cancel = () => {
        if (previewMode) {
            // Preview mode: just close, no redirect, no token clear.
            close();
            return;
        }
        close();
        // Cancel — the interceptor rejects the original promise; the
        // dashboard layout's `/me` failure path then redirects. Tokens
        // are cleared here so a stale token cannot satisfy the next
        // page render before the redirect lands.
        tokenStorage.clear();
        userStorage.clear();
        resolveReAuth("cancelled");
        if (typeof window !== "undefined") {
            window.location.assign("/login");
        }
    };

    const submit = async () => {
        if (submitting || !password) return;
        if (previewMode) {
            // Preview mode: simulate the full flow locally so the
            // submitting → error → idle states can be inspected without
            // hitting the API. Typing "wrong" pretends to fail; anything
            // else pretends to succeed.
            setSubmitting(true);
            window.setTimeout(() => {
                if (password === "wrong") {
                    setSubmitting(false);
                    setPassword("");
                    dialog.open({
                        type: "error",
                        title: t("dialog.error"),
                        description: t("session.error_generic"),
                        errorCode: "WBE1009",
                    });
                } else {
                    close();
                }
            }, 600);
            return;
        }
        const user = userStorage.get();
        if (!user) {
            // Without a known userId we cannot re-auth — fall through
            // to the cancel path so the user lands on /login fresh.
            cancel();
            return;
        }
        setSubmitting(true);
        try {
            // Re-auth always finalises against the user's current
            // company (the BIZ_KEY their JWT was issued for). Even
            // multi-company users skip the chooser here — they came
            // from a working session at a specific BIZ_KEY and the
            // dialog's job is to refresh that session, not to pick a
            // different company.
            const rec = await login(user.userId, password, user.bizKey);
            if (rec.kind === "chooser") {
                // Defensive: the user's company memberships changed
                // mid-session (link removed). Force a full re-login.
                resolveReAuth("cancelled");
                close();
                return;
            }
            tokenStorage.set(rec.accessToken);
            userStorage.set(rec.stored);
            resolveReAuth("re_authenticated");
            close();
        } catch (err) {
            setSubmitting(false);
            setPassword("");
            // Route the error through the global system dialog
            // (CLAUDE.md "Dialogs & modals" — system messages always go
            // through useDialog()). The system layer renders at z-[100]
            // so it stacks above this re-auth popup. Code carries the
            // server-supplied trace_id for support escalation.
            if (err instanceof LoginError) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: err.message || t("session.error_generic"),
                    errorCode: err.code,
                    uuid: err.traceId,
                });
            } else {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("session.error_generic"),
                });
            }
        }
    };

    if (!open) return null;

    const user = previewMode ? PREVIEW_USER : userStorage.get();
    const companyName = user?.companyName ?? t("session.title");
    // Figma 83:12764 renders BUSI_INFM.TAX_ID in brackets — the
    // user-facing company tax / business registration number. The
    // internal `bizKey` (WeCMS tenant key, e.g. VN_VNM0004_000001)
    // and the login `userId` are NEVER user-facing here.
    const companyId   = user?.taxId || undefined;
    const userName    = user?.userName ?? "";
    const userId      = user?.userId ?? "";
    const emailLine   = userName || userId;

    return (
        <PasswordConfirmationDialog
            // Stack above any Settings/L1-L4 chain. Max content z is
            // z-[91]; the system dialog (errors above) renders at
            // z-[100] so password-error toasts still sit on top.
            stackLevel={5}
            // Figma 83:12764 ships no visible close button — the only
            // exits are Enter (re-auth) or ESC (cancel → /login). The
            // primitive's ESC handler routes through cancel() via
            // onClose, registered with the shared modalStack.
            showClose={false}
            accessibleTitle={t("session.title")}
            companyName={companyName}
            companyId={companyId}
            userEmail={emailLine}
            passwordAriaLabel={t("session.password_placeholder")}
            passwordPlaceholder={t("session.password_placeholder")}
            value={password}
            onChange={setPassword}
            onClose={cancel}
            onSave={submit}
            saveDisabled={submitting}
        />
    );
}

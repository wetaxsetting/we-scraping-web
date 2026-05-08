"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Lock, Monitor } from "lucide-react";

import { login, LoginError } from "@/lib/auth/client";
import {
    onReAuthRequest,
    resolveReAuth,
} from "@/lib/auth/sessionExpired";
import { tokenStorage, userStorage } from "@/lib/auth/storage";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Global session-expired re-auth dialog. Mirrors Figma 83:12764 — a
 * minimal centred card with a monitor-lock glyph, the company name +
 * bracketed user id on two lines, the user's email, and a single
 * password input with a leading lock icon. Enter submits; there is no
 * explicit "Continue" button. ESC cancels and bounces the user to
 * `/login` (no inline close affordance — the design is intentionally
 * spare).
 *
 * Mounted once inside the dashboard layout. Subscribes to
 * {@link onReAuthRequest} so any 401 anywhere in the app surfaces the
 * same modal, then resolves the bus on success / cancel so the Axios
 * interceptor can retry the original request (or bounce the user to
 * `/login` if they give up).
 */

/**
 * Synthetic identity used by the URL-driven preview mode. Lets the
 * dialog be inspected (and its UI tweaked) without requiring a real
 * 401 + a populated `userStorage`. Switched on by appending
 * `?preview=session-expired` to any authenticated route.
 */
const PREVIEW_USER = {
    userId:      "1201496252",
    userName:    "krongkampuchea@gmail.com",
    bizKey:      "VN_VNM0004_000001",
    langCode:    "EN",
    companyName: "CONG TY TNHH WEBCASH VN",
} as const;

export default function SessionExpiredDialog() {
    const { t } = useTranslation();
    const titleId = useId();
    const inputRef = useRef<HTMLInputElement>(null);

    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState("");
    const [error, setError] = useState<{ code: string; message: string } | null>(null);
    const [submitting, setSubmitting] = useState(false);
    /** True when the dialog was opened via `?preview=session-expired` —
     *  in that mode every action is local: no real `login()` call, no
     *  token clear, no redirect. Pure UI rehearsal. */
    const [previewMode, setPreviewMode] = useState(false);

    // Subscribe to the bus once. The handler just opens the dialog —
    // the bus tracks the underlying Promise so multiple concurrent 401s
    // collapse to a single open instance.
    useEffect(() => {
        return onReAuthRequest(() => {
            setPassword("");
            setError(null);
            setSubmitting(false);
            setPreviewMode(false);
            setOpen(true);
        });
    }, []);

    // Preview hook — opens the dialog when the URL carries
    // `?preview=session-expired`. Runs once on mount; the flag stays in
    // place until the user closes the dialog. Toggle the URL off once
    // you're done so a refresh doesn't re-open it.
    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        if (params.get("preview") === "session-expired") {
            setPassword("");
            setError(null);
            setSubmitting(false);
            setPreviewMode(true);
            setOpen(true);
        }
    }, []);

    // Lock body scroll + focus the password input when opened.
    useEffect(() => {
        if (!open) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        // Defer focus until after the portal is mounted
        const id = window.setTimeout(() => inputRef.current?.focus(), 0);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.clearTimeout(id);
        };
    }, [open]);

    // ESC closes (treated as cancel — the only way out of the modal,
    // matching the Figma which carries no visible close button).
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                cancel();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const close = () => {
        setOpen(false);
        setPassword("");
        setError(null);
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
        // Cancel — the interceptor will reject the original promise
        // and the dashboard layout's `/me` failure path will redirect
        // to /login. Tokens are cleared here so the redirect is forced.
        tokenStorage.clear();
        userStorage.clear();
        resolveReAuth("cancelled");
        if (typeof window !== "undefined") {
            window.location.assign("/login");
        }
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting || !password) return;
        if (previewMode) {
            // Preview mode: simulate the full flow locally so the
            // submitting → error → idle states can be inspected without
            // hitting the API. Typing the literal "wrong" pretends to
            // fail; anything else pretends to succeed.
            setSubmitting(true);
            setError(null);
            window.setTimeout(() => {
                if (password === "wrong") {
                    setSubmitting(false);
                    setError({
                        code: "WBE1009",
                        message: "Incorrect password (preview).",
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
        setError(null);
        try {
            const rec = await login(user.userId, password);
            tokenStorage.set(rec.access_token);
            userStorage.set({
                userId:      rec.userId,
                userName:    rec.userName,
                bizKey:      rec.bizKey,
                langCode:    rec.langCode,
                companyName: rec.companyName,
            });
            resolveReAuth("re_authenticated");
            close();
        } catch (err) {
            setSubmitting(false);
            if (err instanceof LoginError) {
                setError({ code: err.code, message: err.message });
            } else {
                setError({ code: "UNKNOWN", message: t("session.error_generic") });
            }
        }
    };

    if (!open || typeof document === "undefined") return null;

    const user = previewMode ? PREVIEW_USER : userStorage.get();
    const company = user?.companyName ?? "";
    const userId = user?.userId ?? "";
    const userNm = user?.userName ?? "";

    return createPortal(
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
            // Backdrop click is NOT a dismiss for this modal — the user
            // must explicitly cancel via ESC (which redirects). This
            // prevents accidental data loss in the page underneath.
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Card — Figma 83:12764. rounded-8, white, gap-26, px-34. */}
            <form
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={`${titleId}-desc`}
                onSubmit={submit}
                className="flex w-full max-w-[320px] flex-col items-center justify-center gap-[26px] rounded-lg bg-white px-[34px] py-[34px] shadow-[0_2px_30px_0_rgba(0,0,0,0.08)]"
            >
                {/* Identity block — icon + company/[USER_ID] on two lines.
                   Figma 83:12765: gap-12 between icon and text. */}
                <div className="flex w-full flex-col items-center gap-3">
                    {/* Monitor + lock — Figma 83:12767/68. Composed from
                       lucide glyphs (CLAUDE.md §6b allows lucide for
                       chrome) so we don't ship a one-off SVG asset. */}
                    <div className="relative size-12 text-brand" aria-hidden>
                        <Monitor className="size-12" strokeWidth={1.5} />
                        <span className="absolute right-1.5 top-3 flex size-3.5 items-center justify-center rounded-sm bg-brand">
                            <Lock className="size-2.5 text-white" strokeWidth={3} />
                        </span>
                    </div>

                    <p
                        id={titleId}
                        className="text-center text-wb-14-relaxed font-medium text-wb-ink"
                    >
                        {company || t("session.title")}
                        {userId && (
                            <>
                                <br />
                                [{userId}]
                            </>
                        )}
                    </p>
                </div>

                {/* Email + password block — Figma 83:12775. gap-12 between
                   email line and the password input. */}
                <div
                    id={`${titleId}-desc`}
                    className="flex w-full flex-col items-stretch gap-3"
                >
                    {userNm && (
                        <p className="text-center text-wb-14 font-medium text-wb-ink">
                            {userNm}
                        </p>
                    )}
                    {/* Password input — Figma 83:12777. h-32, rounded-6,
                       1px outline shadow, leading lock icon, no
                       placeholder text (the field's affordance is the
                       lock glyph + Enter to submit). */}
                    <div
                        className={cn(
                            "flex h-8 w-full items-center gap-1 overflow-clip rounded-md bg-white px-2 py-2 shadow-[0_0_0_1px_var(--color-wb-ntrl-4)]",
                            error && "shadow-[0_0_0_1px_var(--color-destructive)]",
                        )}
                    >
                        <Lock
                            className="size-4 shrink-0 text-wb-ntrl-6"
                            strokeWidth={1.8}
                            aria-hidden
                        />
                        <input
                            ref={inputRef}
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            aria-label={t("session.password_placeholder")}
                            placeholder={t("session.password_placeholder")}
                            disabled={submitting}
                            className="h-full flex-1 bg-transparent text-wb-14 font-medium text-wb-ink outline-none placeholder:text-wb-ntrl-5"
                        />
                    </div>
                    {error && (
                        <p
                            role="alert"
                            className="text-center text-wb-12 font-medium text-wb-error"
                        >
                            {error.message || t("session.error_generic")}
                        </p>
                    )}
                    {submitting && !error && (
                        <p className="text-center text-wb-12 font-medium text-wb-ntrl-6">
                            {t("session.submitting")}
                        </p>
                    )}
                </div>

                {/* Hidden submit button — keeps Enter-to-submit working
                   without a visible CTA per the Figma. Screen readers
                   still announce a submit affordance. */}
                <button type="submit" className="sr-only" tabIndex={-1}>
                    {t("session.confirm")}
                </button>
            </form>
        </div>,
        document.body,
    );
}

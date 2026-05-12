"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import FormField from "@/components/auth/FormField";
import IconInput from "@/components/auth/IconInput";
import PasswordInput from "@/components/auth/PasswordInput";
import CompanyChooser from "@/components/auth/CompanyChooser";
import { useDialog } from "@/components/shared/dialog";
import { loginSchema, type LoginFormValues } from "@/app/(auth)/login/loginSchema";
import { login, LoginError, type CompanyChoice } from "@/lib/auth/client";
import { savedIdStorage, tokenStorage, userStorage } from "@/lib/auth/storage";
import { useTranslation } from "@/lib/i18n";
import { HOME_ROUTE } from "@/lib/routes";

/**
 * Last-resort placeholder when the server didn't send a {@code trace_id}
 * (e.g. a pure network failure where there's no response body at all).
 * Same JEX-style format the backend uses so the user-visible string
 * stays consistent — but in this branch the id only correlates with
 * the browser console, not server logs.
 */
function localTraceId(): string {
    const now = new Date();
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    const ts =
        `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
        `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const rand = Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join("");
    return `${ts}PT${rand}LOCL`;
}

/*
 * Two-step flow (multi-company support, 2026-05-11):
 *   1. User submits credentials → POST /api/v1/auth/login (no biz_key).
 *      - If the backend has a single active link, it returns the JWT
 *        immediately and we persist + navigate as before.
 *      - If the backend has two or more links, it returns a chooser
 *        envelope (companies_available, no token). The form switches
 *        to <CompanyChooser>, keeping credentials in memory.
 *   2. User picks a company → POST /api/v1/auth/login again with the
 *      same credentials + the chosen biz_key. Backend re-validates,
 *      issues the JWT scoped to that BIZ_KEY.
 *
 * Credentials are held in component state between the two calls. A
 * page refresh discards them — the user re-enters and starts the
 * flow again. We never persist plaintext credentials, and we never
 * issue an interim "half-authenticated" token client-side.
 */

/**
 * Pending state captured after a successful credentials submit when the
 * backend asked for company selection. Holds the user's credentials in
 * memory so the chooser step can resend them with the chosen BIZ_KEY.
 */
interface PendingChooser {
    userId: string;
    password: string;
    saveId: boolean;
    userName: string;
    companies: CompanyChoice[];
}

export default function LoginForm() {
    const router = useRouter();
    const dialog = useDialog();
    const { t } = useTranslation();
    const [saveId, setSaveId] = useState(false);
    const [chooser, setChooser] = useState<PendingChooser | null>(null);
    const [chooserSubmitting, setChooserSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        setFocus,
        formState: { errors, isSubmitting },
        resetField,
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: { userId: "", password: "" },
    });

    // Field order drives which validation message surfaces first in the
    // Warning dialog — matches the visual order of the form.
    const FIELD_ORDER: (keyof LoginFormValues)[] = ["userId", "password"];

    // Rehydrate "Save ID" on mount (browser-only; localStorage is not
    // available during SSR). startTransition defers the state update so
    // it doesn't cascade synchronously inside the effect.
    useEffect(() => {
        const savedId = savedIdStorage.get();
        if (savedId) {
            setValue("userId", savedId);
            startTransition(() => setSaveId(true));
            setFocus("password");
        } else {
            setFocus("userId");
        }
    }, [setValue, setFocus]);

    /** Persist the authenticated session and navigate to home. Shared
     *  between the single-link auto-pick path and the multi-link
     *  finalize path. */
    const completeLogin = (
        userId: string,
        savedFlag: boolean,
        rec: { stored: import("@/lib/auth/storage").StoredUser; accessToken: string },
    ) => {
        tokenStorage.set(rec.accessToken);
        userStorage.set(rec.stored);
        if (savedFlag) {
            savedIdStorage.set(userId);
        } else {
            savedIdStorage.clear();
        }
        router.push(HOME_ROUTE);
    };

    /** Render the user-facing error dialog with the backend code +
     *  trace id when present. Identical handling on both legs of the
     *  two-step flow. */
    const reportError = (err: unknown, onClose?: () => void) => {
        const isLoginError = err instanceof LoginError;
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: isLoginError ? err.message : t("dialog.unexpected_error"),
            errorCode: isLoginError ? err.code : undefined,
            uuid: (isLoginError && err.traceId) || localTraceId(),
            onClose,
        });
    };

    // ---------------------------------------------------------------
    // Step 1 — credentials submit. May resolve to the chooser branch.
    // ---------------------------------------------------------------
    const onSubmit = handleSubmit(
        async (values) => {
            try {
                const result = await login(values.userId, values.password);
                if (result.kind === "authenticated") {
                    completeLogin(values.userId, saveId, result);
                    return;
                }
                // Chooser branch: keep credentials in component state
                // and swap to the chooser UI. The credentials never
                // leave memory.
                setChooser({
                    userId:   values.userId,
                    password: values.password,
                    saveId,
                    userName: result.userName,
                    companies: result.companies,
                });
            } catch (err) {
                reportError(err, () => {
                    resetField("password");
                    setFocus("password");
                });
            }
        },
        // Invalid submit — client-side validation failed. React Hook Form
        // guarantees the API call (onValid above) is NOT invoked in this
        // branch, so validation aborts the network request by construction.
        (fieldErrors) => {
            for (const field of FIELD_ORDER) {
                const key = fieldErrors[field]?.message;
                if (key) {
                    dialog.open({
                        type: "error",
                        title: t("dialog.error"),
                        description: t(key),
                        onClose: () => setFocus(field),
                    });
                    return;
                }
            }
        },
    );

    // ---------------------------------------------------------------
    // Step 2 — chooser finalize. Resends credentials + chosen BIZ_KEY.
    // ---------------------------------------------------------------
    const finalizeChooser = async (bizKey: string) => {
        if (!chooser) return;
        setChooserSubmitting(true);
        try {
            const result = await login(chooser.userId, chooser.password, bizKey);
            if (result.kind === "chooser") {
                // Backend gave us another chooser instead of a token —
                // user's links changed between calls. Refresh the
                // available list and stay in chooser mode.
                setChooser({
                    ...chooser,
                    companies: result.companies,
                });
                setChooserSubmitting(false);
                return;
            }
            completeLogin(chooser.userId, chooser.saveId, result);
        } catch (err) {
            setChooserSubmitting(false);
            reportError(err);
        }
    };

    const cancelChooser = () => {
        // Drop the in-memory credentials and return to step 1. Re-focus
        // the password field so the user can immediately re-enter it.
        setChooser(null);
        setChooserSubmitting(false);
        setTimeout(() => {
            resetField("password");
            setFocus("password");
        }, 0);
    };

    // ---------------------------------------------------------------
    // Render — chooser step takes over when active.
    // ---------------------------------------------------------------
    if (chooser) {
        return (
            <CompanyChooser
                userId={chooser.userId}
                userName={chooser.userName}
                companies={chooser.companies}
                onSelect={finalizeChooser}
                onCancel={cancelChooser}
                submitting={chooserSubmitting}
            />
        );
    }

    return (
        <section
            className="
                flex w-full max-w-full min-w-0 flex-col items-center bg-white
                px-[20px] pt-[164px] pb-[32px]
                md:order-2 md:flex-1 md:basis-1/2 md:justify-center md:px-[24px] md:pt-0 md:pb-0
            "
        >
            {/* Form area — 360px max-width to match the compact 15px form */}
            <div className="flex w-full max-w-[360px] flex-col gap-[32px]">
                {/* WeCMS logo — Figma 199:7833 etc.: 218.824 × 48 fixed */}
                <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/images/login/wecms-logo.png"
                        alt="WeCMS"
                        width={219}
                        height={48}
                        className="block h-[40px] w-[182.353px] md:h-[44px] md:w-[200.589px] xl:h-[48px] xl:w-[218.824px]"
                    />
                </div>

                <form
                    noValidate
                    onSubmit={onSubmit}
                    className="flex w-full flex-col gap-[24px]"
                >
                    <div className="flex flex-col gap-[16px]">
                        <div className="flex flex-col gap-[12px]">
                            <FormField id="userId" label={t("login.user_id_label")}>
                                <IconInput
                                    id="userId"
                                    type="text"
                                    iconSrc="/images/login/ico-user.svg"
                                    placeholder={t("login.user_id_placeholder")}
                                    autoComplete="username"
                                    aria-invalid={!!errors.userId}
                                    {...register("userId")}
                                />
                            </FormField>

                            <FormField id="password" label={t("login.password_label")}>
                                <PasswordInput
                                    id="password"
                                    placeholder={t("login.password_placeholder")}
                                    autoComplete="current-password"
                                    aria-invalid={!!errors.password}
                                    toggleShowLabel={t("login.show_password")}
                                    toggleHideLabel={t("login.hide_password")}
                                    {...register("password")}
                                />
                            </FormField>
                        </div>

                        {/* Save ID — compact 15px label paired with an 18×18
                           checkbox so the row sits at ≈ 18 high. */}
                        <div className="flex items-center gap-[8px]">
                            <Checkbox
                                id="SAVE_ID"
                                checked={saveId}
                                onCheckedChange={(v) => setSaveId(v === true)}
                                className="size-[18px] rounded-[4px]"
                            />
                            <Label
                                htmlFor="SAVE_ID"
                                className="cursor-pointer text-wb-15 font-medium tracking-[-0.6px] text-wb-ntrl-8"
                            >
                                {t("login.save_id")}
                            </Label>
                        </div>
                    </div>

                    {/* Login button — compact: h-[40px], 15px label tracking-[-0.15px] */}
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        aria-busy={isSubmitting}
                        className="h-[40px] w-full rounded-[8px] bg-brand text-wb-15 font-medium tracking-[-0.15px] text-white shadow-wb-brand-btn hover:bg-brand-hover"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                                {t("login.logging_in")}
                            </>
                        ) : (
                            t("login.login_button")
                        )}
                    </Button>
                </form>
            </div>
        </section>
    );
}

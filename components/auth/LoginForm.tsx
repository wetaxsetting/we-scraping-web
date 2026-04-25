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
import { useDialog } from "@/components/shared/dialog";
import { loginSchema, type LoginFormValues } from "@/app/(auth)/login/loginSchema";
import { login, LoginError } from "@/lib/auth/client";
import { savedIdStorage, tokenStorage, userStorage } from "@/lib/auth/storage";
import { useTranslation } from "@/lib/i18n";
import { HOME_ROUTE } from "@/lib/routes";

/**
 * Sprint 0 stub for the JEX-style request correlation UUID. The backend does
 * not yet surface one on error responses, so we mint a client-side value in
 * the same shape (`YYYYMMDDHHMMSS` + `PT` + 14 digits + `DEVL`) purely for
 * display in the Error dialog. Replace with a real ID once `COMMON_HEAD.UUID`
 * lands in `wecms-api-main`.
 */
function makeMockUuid(): string {
    const now = new Date();
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    const ts =
        `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
        `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const rand = Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join("");
    return `${ts}PT${rand}DEVL`;
}

/*
 * Typography — Figma WB365 (node 4728:40155 Desktop + 5976:25972 Laptop):
 *   Input placeholder / value → text-wb-16 → lg:text-wb-18, Medium
 *   Save ID label             → text-wb-14 → lg:text-wb-16 → 2xl:text-wb-18, Medium
 *   Login button              → text-wb-16 → lg:text-wb-18, Medium
 *
 * Login failure surfaces through the global <DialogProvider> — see useDialog()
 * below. The old inline error alert was removed when the shared Error dialog
 * replaced it.
 */

export default function LoginForm() {
    const router = useRouter();
    const dialog = useDialog();
    const { t } = useTranslation();
    const [saveId, setSaveId] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        setFocus,
        formState: { errors, isSubmitting },
        resetField,
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: { USER_ID: "", USER_PW: "" },
    });

    // Field order drives which validation message surfaces first in the
    // Warning dialog — matches the visual order of the form.
    const FIELD_ORDER: (keyof LoginFormValues)[] = ["USER_ID", "USER_PW"];

    // Rehydrate "Save ID" on mount (browser-only; localStorage is not
    // available during SSR). startTransition defers the state update so
    // it doesn't cascade synchronously inside the effect.
    useEffect(() => {
        const savedId = savedIdStorage.get();
        if (savedId) {
            setValue("USER_ID", savedId);
            startTransition(() => setSaveId(true));
            setFocus("USER_PW");
        } else {
            setFocus("USER_ID");
        }
    }, [setValue, setFocus]);

    const onSubmit = handleSubmit(
        async (values) => {
            try {
                const rec = await login(values.USER_ID, values.USER_PW);
                tokenStorage.set(rec.TOKEN);
                userStorage.set({
                    USER_ID: rec.USER_ID,
                    USER_NM: rec.USER_NM,
                    BIZ_KEY: rec.BIZ_KEY,
                    LANG_CD: rec.LANG_CD,
                    CMPN_NM: rec.CMPN_NM,
                });
                if (saveId) {
                    savedIdStorage.set(rec.USER_ID);
                } else {
                    savedIdStorage.clear();
                }
                router.push(HOME_ROUTE);
            } catch (err) {
                const isLoginError = err instanceof LoginError;
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: isLoginError ? err.message : t("dialog.unexpected_error"),
                    errorCode: isLoginError ? err.code : undefined,
                    uuid: makeMockUuid(),
                    onClose: () => {
                        resetField("USER_PW");
                        setFocus("USER_PW");
                    },
                });
            }
        },
        // Invalid submit — client-side validation failed. React Hook Form
        // guarantees the API call (onValid above) is NOT invoked in this
        // branch, so validation aborts the network request by construction.
        // Zod messages hold translation keys (see loginSchema.ts).
        (fieldErrors) => {
            for (const field of FIELD_ORDER) {
                const key = fieldErrors[field]?.message;
                if (key) {
                    dialog.open({
                        type: "warning",
                        title: t("dialog.warning"),
                        description: t(key),
                        onClose: () => setFocus(field),
                    });
                    return;
                }
            }
        },
    );

    return (
        <section className="flex min-h-screen w-full flex-col items-center bg-white px-6 py-10 sm:px-10 md:px-8 md:pt-[160px] md:pb-[48px] lg:pt-[248px] 2xl:pt-[306px]">
            <div className="mx-auto flex w-full max-w-[420px] flex-col gap-[40px] lg:gap-[48px]">
                {/* WeCMS logo — 218.824 × 48 @ Figma */}
                <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/images/login/wecms-logo.png"
                        alt="WeCMS"
                        width={219}
                        height={48}
                        className="block h-[40px] w-[182px] lg:h-[44px] lg:w-[200px] 2xl:h-[48px] 2xl:w-[219px]"
                    />
                </div>

                <div className="flex flex-col gap-[24px] lg:gap-[32px]">
                    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-[24px]">
                        <div className="flex flex-col gap-[16px]">
                            <FormField id="USER_ID" label={t("login.user_id_label")}>
                                <IconInput
                                    id="USER_ID"
                                    type="text"
                                    iconSrc="/images/login/ico-user.svg"
                                    placeholder={t("login.user_id_placeholder")}
                                    autoComplete="username"
                                    aria-invalid={!!errors.USER_ID}
                                    {...register("USER_ID")}
                                />
                            </FormField>

                            <FormField id="USER_PW" label={t("login.password_label")}>
                                <PasswordInput
                                    id="USER_PW"
                                    placeholder={t("login.password_placeholder")}
                                    autoComplete="current-password"
                                    aria-invalid={!!errors.USER_PW}
                                    toggleShowLabel={t("login.show_password")}
                                    toggleHideLabel={t("login.hide_password")}
                                    {...register("USER_PW")}
                                />
                            </FormField>

                            {/* Save ID — Figma: responsive 14 → 16 → 18, Medium -0.04em #404040 */}
                            <div className="flex items-center gap-[10px]">
                                <Checkbox
                                    id="SAVE_ID"
                                    checked={saveId}
                                    onCheckedChange={(v) => setSaveId(v === true)}
                                    className="size-[18px] rounded-[4px] lg:size-[20px] 2xl:size-[24px]"
                                />
                                <Label
                                    htmlFor="SAVE_ID"
                                    className="cursor-pointer text-wb-14 font-medium tracking-wb-tighter text-wb-ntrl-8 lg:text-wb-16 2xl:text-wb-18"
                                >
                                    {t("login.save_id")}
                                </Label>
                            </div>
                        </div>

                        {/* Login button — Figma: 18/24 Medium on #0060b9, rounded-8, shadow-wb-brand-btn */}
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            aria-busy={isSubmitting}
                            className="h-[44px] w-full rounded-[8px] bg-brand text-wb-16 font-medium tracking-wb-tight text-white shadow-wb-brand-btn hover:bg-brand-hover lg:h-[48px] lg:text-wb-18"
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
            </div>
        </section>
    );
}

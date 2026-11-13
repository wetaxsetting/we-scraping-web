"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { AuthError, signup } from "@/lib/weinvoice/auth";

/** Same rules as the backend (`WeInvoiceAccountService`): it re-checks them and answers WBE3038 / WBE3039. */
export const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Field = "name" | "email" | "password" | "confirm";

/** Client-side check of the sign-up form: field → i18n key of the first problem. */
export function validateSignup(v: { name: string; email: string; password: string; confirm: string }): Partial<Record<Field, string>> {
    const errors: Partial<Record<Field, string>> = {};
    if (!v.name.trim()) errors.name = "signup.err.required";
    if (!v.email.trim()) errors.email = "signup.err.required";
    else if (!EMAIL.test(v.email.trim())) errors.email = "signup.err.email";
    if (!v.password) errors.password = "signup.err.required";
    else if (v.password.length < MIN_PASSWORD || !/\p{L}/u.test(v.password) || !/\d/.test(v.password)) errors.password = "signup.err.password";
    if (v.password && v.confirm !== v.password) errors.confirm = "signup.err.confirm";
    return errors;
}

/**
 * WeInvoice self sign-up card (docs/features/weinvoice/weinvoice-self-signup-2026-11-13.md). On success the backend
 * has already signed the user in; `onDone` navigates on.
 */
export function SignupForm({ onDone }: { onDone: () => void }) {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [show, setShow] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        setErr("");
        const found = validateSignup({ name, email, password, confirm });
        setErrors(found);
        if (Object.keys(found).length) return;
        setBusy(true);
        try {
            await signup({ email, name, password, phone, companyName });
            onDone();
        } catch (ex) {
            const a = ex instanceof AuthError ? ex : new AuthError("WBE_CLIENT_PARSE", String(ex));
            setErr(a.code === "WBE_NETWORK" ? t("login.network_error") : `${a.message} (${a.code})`);
            setBusy(false);
        }
    };

    const fieldError = (f: Field) => errors[f] && <p className="mt-1 text-wb-12 text-wb-status-error-text">{t(errors[f]!, { n: MIN_PASSWORD })}</p>;
    const input = "mt-1.5 h-11 w-full rounded-md px-3 text-wb-14 shadow-wb-outline outline-none focus:shadow-wb-focus";

    return (
        <form onSubmit={submit} noValidate className="w-full max-w-[400px] rounded-2xl bg-white p-8 shadow-wb-popup">
            <div className="mb-1 flex items-center gap-2 lg:hidden">
                <span className="text-wb-22 font-bold tracking-wb-tighter text-brand">WeInvoice</span>
            </div>
            <h2 className="text-wb-24 font-bold tracking-wb-tight text-wb-dark">{t("signup.title")}</h2>
            <p className="mt-1 text-wb-13 text-wb-ntrl-6">{t("signup.subtitle")}</p>

            <Row id="su-name" label={t("signup.name")} required>
                <input id="su-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={input} />
                {fieldError("name")}
            </Row>
            <Row id="su-email" label={t("signup.email")} required>
                <input id="su-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
                {fieldError("email")}
            </Row>
            <div className="grid gap-x-3 sm:grid-cols-2">
                <Row id="su-phone" label={t("signup.phone")}>
                    <input id="su-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
                </Row>
                <Row id="su-company" label={t("signup.company")}>
                    <input id="su-company" autoComplete="organization" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={input} />
                </Row>
            </div>
            <Row id="su-pw" label={t("signup.password")} required>
                <div className="relative">
                    <input
                        id="su-pw"
                        type={show ? "text" : "password"}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${input} pr-10`}
                    />
                    <button type="button" aria-label={t(show ? "signup.hide_password" : "signup.show_password")} onClick={() => setShow((v) => !v)} className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-wb-ntrl-5">
                        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                </div>
                {errors.password ? fieldError("password") : <p className="mt-1 text-wb-12 text-wb-ntrl-6">{t("signup.password_hint", { n: MIN_PASSWORD })}</p>}
            </Row>
            <Row id="su-confirm" label={t("signup.confirm")} required>
                <input id="su-confirm" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
                {fieldError("confirm")}
            </Row>

            {err && <p role="alert" className="mt-3 text-wb-12 text-wb-status-error-text">{err}</p>}
            <Button type="submit" variant="primary" className="mt-6 h-11 w-full text-wb-15" disabled={busy}>
                {busy ? t("signup.submitting") : t("signup.submit")}
            </Button>
            <p className="mt-5 text-center text-wb-13 text-wb-ntrl-6">
                {t("signup.have_account")}{" "}
                <Link href="/login" className="font-semibold text-brand hover:underline">{t("signup.sign_in")}</Link>
            </p>
        </form>
    );
}

function Row({ id, label, required, children }: { id: string; label: string; required?: boolean; children: ReactNode }) {
    return (
        <div className="mt-4">
            <label htmlFor={id} className="block text-wb-13 font-medium text-wb-ntrl-8">
                {label}
                {required && <span className="ml-0.5 text-wb-status-error-text">*</span>}
            </label>
            {children}
        </div>
    );
}

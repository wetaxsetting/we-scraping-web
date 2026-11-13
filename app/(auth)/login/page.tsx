"use client";

import { ArrowLeft, Building2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthShell, nextPath } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { AuthError, login, type CompanyChoice } from "@/lib/weinvoice/auth";

/**
 * Login — WeCMS login layout (brand-soft canvas, navy marketing band, white form card). UI Spec v1.0 §Đăng nhập.
 * Real `POST /api/v1/auth/login`; a user linked to several companies picks one, then the same
 * credentials are re-posted with its `biz_key`.
 */
export default function LoginPage() {
    const router = useRouter();
    const { t } = useTranslation();
    const [userId, setUserId] = useState("");
    const [pw, setPw] = useState("");
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [companies, setCompanies] = useState<CompanyChoice[] | null>(null);

    const goNext = () => router.replace(nextPath());

    const attempt = async (bizKey?: string) => {
        setErr("");
        setBusy(true);
        try {
            const res = await login(userId.trim(), pw, bizKey);
            if (res.kind === "chooser") {
                setCompanies(res.companies);
                setBusy(false);
                return;
            }
            goNext();
        } catch (e) {
            const a = e instanceof AuthError ? e : new AuthError("WBE_CLIENT_PARSE", String(e));
            setErr(a.code === "WBE_NETWORK" ? t("login.network_error") : `${a.message} (${a.code})`);
            setBusy(false);
        }
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId.trim() || !pw) {
            setErr(t("login.required"));
            return;
        }
        await attempt();
    };

    return (
        <AuthShell>
            {companies ? (
                <div className="w-full max-w-[400px] rounded-2xl bg-white p-8 shadow-wb-popup">
                    <button type="button" onClick={() => { setCompanies(null); setErr(""); }} className="mb-3 flex cursor-pointer items-center gap-1 text-wb-13 font-medium text-wb-ntrl-7 hover:text-wb-ink">
                        <ArrowLeft className="size-4" /> {t("login.back")}
                    </button>
                    <h2 className="text-wb-22 font-bold tracking-wb-tight text-wb-dark">{t("login.choose_company")}</h2>
                    <ul className="mt-4 flex flex-col gap-2">
                        {companies.map((c) => (
                            <li key={c.bizKey}>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => attempt(c.bizKey)}
                                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-3 text-left text-wb-14 font-medium text-wb-ink shadow-wb-outline hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Building2 className="size-4 shrink-0 text-brand" />
                                    {c.companyName}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {err && <p className="mt-3 text-wb-12 text-wb-status-error-text">{err}</p>}
                </div>
            ) : (
                <form onSubmit={submit} className="w-full max-w-[400px] rounded-2xl bg-white p-8 shadow-wb-popup">
                    <div className="mb-1 flex items-center gap-2 lg:hidden">
                        <span className="text-wb-22 font-bold tracking-wb-tighter text-brand">WeInvoice</span>
                    </div>
                    <h2 className="text-wb-24 font-bold tracking-wb-tight text-wb-dark">{t("login.title")}</h2>
                    <p className="mt-1 text-wb-13 text-wb-ntrl-6">{t("login.subtitle")}</p>

                    <label htmlFor="login-user" className="mt-6 block text-wb-13 font-medium text-wb-ntrl-8">{t("login.user")}</label>
                    <input
                        id="login-user"
                        autoComplete="username"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        className="mt-1.5 h-11 w-full rounded-md px-3 text-wb-14 shadow-wb-outline outline-none focus:shadow-wb-focus"
                    />
                    <label htmlFor="login-pw" className="mt-4 block text-wb-13 font-medium text-wb-ntrl-8">{t("login.password")}</label>
                    <div className="relative mt-1.5">
                        <input
                            id="login-pw"
                            type={show ? "text" : "password"}
                            autoComplete="current-password"
                            value={pw}
                            onChange={(e) => setPw(e.target.value)}
                            className="h-11 w-full rounded-md px-3 pr-10 text-wb-14 shadow-wb-outline outline-none focus:shadow-wb-focus"
                        />
                        <button type="button" onClick={() => setShow((v) => !v)} className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-wb-ntrl-5">
                            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                    </div>
                    {err && <p className="mt-2 text-wb-12 text-wb-status-error-text">{err}</p>}
                    <Button type="submit" variant="primary" className="mt-6 h-11 w-full text-wb-15" disabled={busy}>
                        {busy ? t("login.signing_in") : t("login.submit")}
                    </Button>
                    <p className="mt-5 text-center text-wb-13 text-wb-ntrl-6">
                        {t("login.no_account")}{" "}
                        <Link href="/register" className="font-semibold text-brand hover:underline">{t("login.register")}</Link>
                    </p>
                </form>
            )}
        </AuthShell>
    );
}

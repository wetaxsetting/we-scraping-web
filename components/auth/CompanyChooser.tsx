"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import type { CompanyChoice } from "@/lib/auth/client";
import { KNOWN_PRODUCT_TYPES } from "@/lib/auth/storage";

/**
 * Second step of the multi-company login flow. Renders one row per
 * available company; the user picks one and clicks Continue, which
 * re-posts the credentials together with the chosen BIZ_KEY.
 *
 * <p><b>Exceptional path — not the normal production UX.</b> Current
 * WeCMS operation treats one user as belonging to a single active
 * company, so production logins resolve directly to the dashboard
 * without this screen ever rendering. This component is the safe
 * fallback for the rare case where a real user genuinely has ≥ 2
 * active USER_BUSI_CONN_INFM links — kept implemented so multi-link
 * users do not error out, NOT promoted as routine UX. See
 * {@code wecms-api/CLAUDE.md} §"Operational model: one user =
 * one company account" for the canonical business rule.
 *
 * The component is intentionally credential-less — the parent
 * (LoginForm) keeps userId + password in memory between the two
 * calls. If the user navigates away or refreshes, the in-memory
 * credentials are lost and they restart at the credentials step.
 *
 * Typography follows the global tokens (`text-page-title`, `text-body`
 * etc. mapped to the WeCMS scale in tailwind config); no inline
 * font-size overrides.
 */
export interface CompanyChooserProps {
    /** User identifier shown above the company list — purely visual,
     *  the actual JWT is bound to the credentials, not to this string. */
    userId: string;
    /** Display name shown next to the user id. */
    userName: string;
    /** Companies the backend authorised this user for. The chooser
     *  never invents BIZ_KEYs — the user can only pick from this list. */
    companies: CompanyChoice[];
    /** Called when the user confirms a selection. Parent finalises the
     *  login by re-posting credentials with the chosen BIZ_KEY. */
    onSelect: (bizKey: string) => void | Promise<void>;
    /** Called when the user backs out — parent restores the
     *  credentials form (userId + password fields). */
    onCancel: () => void;
    /** True while the parent's finalize call is in flight. Disables
     *  inputs to prevent double-submission. */
    submitting?: boolean;
}

export default function CompanyChooser(props: CompanyChooserProps) {
    const { userId, userName, companies, onSelect, onCancel, submitting } = props;
    const { t } = useTranslation();
    const firstRef = useRef<HTMLButtonElement | null>(null);
    const [selected, setSelected] = useState<string | null>(
        companies.length > 0 ? companies[0].bizKey : null,
    );

    // Defensive: if the list shape changes (unlikely after mount but the
    // login retry path could send a different list), re-seed selection
    // to the first option so the Continue button is never enabled
    // against a stale BIZ_KEY.
    useEffect(() => {
        if (companies.length === 0) {
            setSelected(null);
            return;
        }
        if (!selected || !companies.some((c) => c.bizKey === selected)) {
            setSelected(companies[0].bizKey);
        }
    }, [companies, selected]);

    // Focus the first option on mount so keyboard users land on the
    // list without an extra Tab.
    useEffect(() => {
        firstRef.current?.focus();
    }, []);

    const onSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selected || submitting) return;
        await onSelect(selected);
    };

    return (
        <section
            className="
                flex w-full max-w-full min-w-0 flex-col items-center bg-white
                px-[20px] pt-[164px] pb-[32px]
                md:order-2 md:flex-1 md:basis-1/2 md:justify-center md:px-[24px] md:pt-0 md:pb-0
            "
        >
            <div className="flex w-full max-w-[420px] flex-col gap-[32px]">
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

                <form noValidate onSubmit={onSubmit} className="flex w-full flex-col gap-[24px]">
                    <div className="flex flex-col gap-[8px]">
                        <h1 className="text-page-title text-wb-ntrl-9">
                            {t("login.chooser_title")}
                        </h1>
                        <p className="text-body text-wb-ntrl-7">
                            {t("login.chooser_description")}
                        </p>
                        <p className="text-helper text-wb-ntrl-6">
                            {userName ? `${userName} · ${userId}` : userId}
                        </p>
                    </div>

                    <ul
                        role="radiogroup"
                        aria-label={t("login.chooser_title")}
                        className="flex flex-col gap-[8px]"
                    >
                        {companies.map((c, idx) => {
                            const isSelected = c.bizKey === selected;
                            const roleLabel = c.role === "ADMIN"
                                ? t("login.chooser_role_admin")
                                : t("login.chooser_role_user");
                            // Product-type label: only resolved when the letter
                            // is in the refactor's recognised set. Deferred
                            // legacy letters (W/R/B/E/U/L/S/P/C/D/T) round-trip
                            // but render no badge — display gating only, never
                            // a security boundary.
                            const isKnownPrdt = (KNOWN_PRODUCT_TYPES as readonly string[]).includes(c.productType);
                            const productLabel = isKnownPrdt
                                ? t(`auth.prdt_type.${c.productType.toLowerCase()}`)
                                : null;
                            return (
                                <li key={c.bizKey}>
                                    <button
                                        ref={idx === 0 ? firstRef : null}
                                        type="button"
                                        role="radio"
                                        aria-checked={isSelected}
                                        disabled={submitting}
                                        onClick={() => setSelected(c.bizKey)}
                                        className={
                                            "flex w-full items-start justify-between gap-[12px] rounded-[8px] border px-[16px] py-[12px] text-left transition-colors " +
                                            (isSelected
                                                ? "border-brand bg-brand/5"
                                                : "border-wb-ntrl-3 bg-white hover:bg-wb-ntrl-1")
                                        }
                                    >
                                        <span className="flex min-w-0 flex-col gap-[4px]">
                                            <span className="text-section-title text-wb-ntrl-9 truncate">
                                                {c.companyName || c.bizKey}
                                            </span>
                                            <span className="text-helper text-wb-ntrl-6 truncate">
                                                {productLabel
                                                    ? `${productLabel} · ${c.bizKey}`
                                                    : c.bizKey}
                                            </span>
                                        </span>
                                        <span
                                            className={
                                                "shrink-0 self-start rounded-full px-[8px] py-[2px] text-helper " +
                                                (c.role === "ADMIN"
                                                    ? "bg-brand/10 text-brand"
                                                    : "bg-wb-ntrl-2 text-wb-ntrl-7")
                                            }
                                        >
                                            {roleLabel}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    <div className="flex gap-[12px]">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={submitting}
                            onClick={onCancel}
                            className="h-[40px] flex-1 rounded-[8px] text-button"
                        >
                            {t("login.chooser_back")}
                        </Button>
                        <Button
                            type="submit"
                            disabled={!selected || submitting}
                            aria-busy={submitting}
                            className="h-[40px] flex-[2] rounded-[8px] bg-brand text-button text-white shadow-wb-brand-btn hover:bg-brand-hover"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" aria-hidden />
                                    {t("login.logging_in")}
                                </>
                            ) : (
                                t("login.chooser_continue")
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </section>
    );
}

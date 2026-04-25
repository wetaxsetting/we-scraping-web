"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Globe, Lock, Pencil, Power } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import { logout } from "@/lib/auth/client";
import { userStorage, type StoredUser } from "@/lib/auth/storage";
import { LOCALES, useTranslation, type Locale } from "@/lib/i18n";

/*
 * Profile dropdown — Figma node 9523:20132 (🏀 Sandbox WeCMS).
 *
 * Single-view main popup with a secondary "side popover" for language
 * selection: clicking the Languages row toggles a small floating card
 * anchored to the left of the profile popup, keeping the rest of the
 * menu (Change Password, Logout) visible in the background.
 *
 * Selected language is rendered in brand blue with a check glyph; the
 * selection is applied immediately so the Languages row label + app
 * chrome update in place. The side popover stays open until the user
 * clicks elsewhere or presses Escape, so the new checkmark is visible.
 *
 * Icons : The exported assets for ico_spark, ico_world, ico_keylock, ico_power,
 *         and the avatar-edit pencil are not yet in public/assets/ — lucide
 *         fallbacks are used for now and should be replaced once Sonny exports
 *         the Figma assets (CLAUDE.md § 6d).
 */

const LOCALE_LABEL_KEY: Record<Locale, string> = {
    EN: "profile.language_english",
    KO: "profile.language_korean",
    VI: "profile.language_vietnamese",
};

type ProfileMenuProps = {
    /** Override the avatar image shown on the trigger + popup header. */
    avatarSrc?: string;
};

export default function ProfileMenu({
    avatarSrc = "/assets/header/avatar.svg",
}: ProfileMenuProps) {
    const router = useRouter();
    const dialog = useDialog();
    const { t, locale, setLocale } = useTranslation();
    const [open, setOpen] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    const [user, setUser] = useState<StoredUser | null>(null);
    const [isPending, startLogout] = useTransition();
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setUser(userStorage.get());
    }, []);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (langOpen) {
                    setLangOpen(false);
                } else {
                    setOpen(false);
                }
            }
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open, langOpen]);

    // Collapse the language side-popover whenever the profile popup closes
    // so the next open starts fresh.
    useEffect(() => {
        if (!open) setLangOpen(false);
    }, [open]);

    const handleLogout = useCallback(() => {
        setOpen(false);
        dialog.open({
            type: "confirmation",
            title: t("dialog.confirmation"),
            description: t("logout.confirm_description"),
            confirmText: t("dialog.yes"),
            cancelText: t("dialog.no"),
            onConfirm: () => {
                startLogout(async () => {
                    await logout();
                    router.replace("/login");
                });
            },
        });
    }, [dialog, router, t]);

    const handleSelectLocale = (next: Locale) => {
        // No-op if the user re-selects the already-active locale.
        if (next === locale) return;
        // Confirm before switching — the target language's native name is
        // looked up in the locale files (where it is identical across locales,
        // e.g. "Tiếng Việt" stays "Tiếng Việt" in EN / KO / VI JSON). The rest
        // of the prompt renders in the **current** locale so the user reads a
        // language they already understand. Applying only happens on Yes.
        const languageName = t(LOCALE_LABEL_KEY[next]);
        dialog.open({
            type: "confirmation",
            title: t("dialog.confirmation"),
            description: t("language.confirm_description", { language: languageName }),
            confirmText: t("dialog.yes"),
            cancelText: t("dialog.no"),
            onConfirm: () => setLocale(next),
        });
    };

    const name = user?.USER_NM ?? t("profile.guest");
    const secondary = user?.USER_ID ?? "";

    return (
        <div ref={wrapperRef} className="relative">
            <button
                type="button"
                aria-label={t("nav.account_menu")}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="flex size-8 cursor-pointer items-center justify-center rounded-full transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarSrc} alt={t("nav.account_menu")} className="size-8 rounded-full" />
            </button>

            {open && (
                <div
                    role="menu"
                    aria-label={t("nav.account_menu")}
                    className="absolute right-0 top-full z-40 mt-2 w-[280px] max-w-[calc(100vw-16px)] overflow-hidden rounded-[10px] bg-white shadow-[0_1px_1px_0_rgba(0,0,0,0.1),0_0_2px_0_rgba(0,0,0,0.1),0_6px_20px_0_rgba(0,0,0,0.1)]"
                >
                    {/* User block */}
                    <div className="flex flex-col items-center gap-[10px] border-b border-wb-ntrl-4 px-[10px] pt-4 pb-[14px]">
                        <div className="relative">
                            <div className="flex size-[78px] items-center justify-center overflow-hidden rounded-full bg-brand-soft shadow-[0_0_3.714px_1.857px_rgba(0,0,0,0.04)] ring-[3px] ring-white">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={avatarSrc} alt="" aria-hidden className="size-full object-cover" />
                            </div>
                            <button
                                type="button"
                                aria-label={t("profile.edit_photo")}
                                className="absolute bottom-0 right-0 flex size-7 cursor-pointer items-center justify-center rounded-full bg-white shadow-[0_2px_4px_2px_rgba(0,0,0,0.06)] hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                            >
                                <Pencil className="size-4 text-wb-ink" strokeWidth={2} />
                            </button>
                        </div>
                        <div className="flex flex-col items-center gap-[2px] text-center">
                            <p className="text-wb-16 font-medium tracking-wb-tight text-wb-ink">
                                {name}
                            </p>
                            {secondary && (
                                <p className="text-wb-14 font-medium tracking-wb-tight text-wb-ink opacity-50">
                                    {secondary}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Languages — click toggles the side popover */}
                    <div className="relative border-b border-wb-ntrl-4 px-[5px] py-4">
                        <button
                            type="button"
                            role="menuitem"
                            aria-haspopup="menu"
                            aria-expanded={langOpen}
                            onClick={() => setLangOpen((v) => !v)}
                            className="flex h-8 w-full cursor-pointer items-center justify-between rounded-[5px] px-[10px] py-[6px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                        >
                            <div className="flex items-center gap-[10px]">
                                <Globe className="size-[18px] text-wb-ink" strokeWidth={2} />
                                <span className="text-wb-14 font-medium tracking-wb-tight text-wb-ink">
                                    {t("profile.languages")}
                                </span>
                            </div>
                            <div className="flex items-center gap-[6px]">
                                <span className="text-wb-14 font-medium tracking-wb-tight text-black">
                                    {t(LOCALE_LABEL_KEY[locale])}
                                </span>
                                {langOpen ? (
                                    <ChevronUp className="size-[18px] text-wb-ink" strokeWidth={2} />
                                ) : (
                                    <ChevronDown className="size-[18px] text-wb-ink" strokeWidth={2} />
                                )}
                            </div>
                        </button>

                        {/* Side popover — anchored below the Languages row, right-aligned
                           inside the profile popup so it never escapes the container. */}
                        {langOpen && (
                            <div
                                role="menu"
                                aria-label={t("profile.languages")}
                                className="absolute right-2 top-full z-50 w-[140px] rounded-[10px] bg-white py-2 shadow-[0_1px_1px_0_rgba(0,0,0,0.1),0_0_2px_0_rgba(0,0,0,0.1),0_6px_20px_0_rgba(0,0,0,0.1)]"
                            >
                                {LOCALES.map((l) => {
                                    const active = l === locale;
                                    return (
                                        <button
                                            key={l}
                                            type="button"
                                            role="menuitemradio"
                                            aria-checked={active}
                                            onClick={() => handleSelectLocale(l)}
                                            className="flex h-9 w-full cursor-pointer items-center justify-between rounded-[5px] px-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                                        >
                                            <span
                                                className={
                                                    active
                                                        ? "text-wb-14 font-semibold tracking-wb-tight text-brand"
                                                        : "text-wb-14 font-medium tracking-wb-tight text-wb-ink"
                                                }
                                            >
                                                {t(LOCALE_LABEL_KEY[l])}
                                            </span>
                                            {active && (
                                                <Check className="size-[16px] text-brand" strokeWidth={2.5} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Change Password */}
                    <div className="px-[5px] py-4">
                        <button
                            type="button"
                            role="menuitem"
                            className="flex h-8 w-full cursor-pointer items-center gap-[10px] rounded-[5px] px-[10px] py-[6px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                        >
                            <Lock className="size-[18px] text-wb-ink" strokeWidth={2} />
                            <span className="text-wb-14 font-medium tracking-wb-tight text-wb-ink">
                                {t("profile.change_password")}
                            </span>
                        </button>
                    </div>

                    {/* Logout rail */}
                    <button
                        type="button"
                        role="menuitem"
                        disabled={isPending}
                        onClick={handleLogout}
                        className="flex w-full cursor-pointer items-center gap-[10px] border-t border-wb-ntrl-4 bg-[#f2f2f2] px-4 py-[23px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/30 disabled:cursor-wait disabled:opacity-60"
                    >
                        <Power className="size-[18px] text-wb-ink" strokeWidth={2} />
                        <span className="text-wb-14 font-medium tracking-wb-tight text-wb-ink">
                            {isPending ? t("profile.signing_out") : t("profile.logout")}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}

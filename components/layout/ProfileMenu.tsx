"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Globe, Lock } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import ChangePasswordDialog from "@/components/layout/ChangePasswordDialog";
import EditIcon from "@/components/shared/icons/EditIcon";
import UserAvatar from "@/components/shared/UserAvatar";
import { ApiCallError } from "@/lib/api/banking";
import { uploadMyImage } from "@/lib/api/users";
import { avatarColorFor } from "@/lib/avatar";
import { logout } from "@/lib/auth/client";
import { userStorage, type StoredUser } from "@/lib/auth/storage";
import { LOCALES, useTranslation, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Self-service avatar upload allow-list — mirrors the backend
 *  ({@code UserImageService.ALLOWED_EXTENSIONS}). SVG is intentionally
 *  excluded (F-02 stored-XSS guard); the backend rejects it too. */
const AVATAR_ALLOWED_EXT = ["jpg", "jpeg", "png", "gif"] as const;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/*
 * Profile dropdown — Figma node 65:21424 (Sonny-Dev).
 *
 * Language submenu: absolutely positioned below the Languages row
 * (top: 100% of the row wrapper, right: 16 px from the dropdown's right edge).
 * The submenu floats over the Change Password / Logout rows — no layout shift
 * in the main card and no viewport overflow on any screen size.
 *
 * The outer card must NOT use overflow-hidden (that would clip the submenu).
 * Instead, rounded-t-* / rounded-b-* are applied to the first (user block)
 * and last (logout rail) children so the card shape is still correct.
 *
 * Power glyph uses the Figma SVG (red filled circle); the rest of the
 * row icons fall back to lucide at the Figma neutral tone (#737373).
 */

const LOCALE_LABEL_KEY: Record<Locale, string> = {
    EN: "profile.language_english",
    KO: "profile.language_korean",
    VI: "profile.language_vietnamese",
};

export default function ProfileMenu() {
    const router = useRouter();
    const dialog = useDialog();
    const { t, locale, setLocale } = useTranslation();
    const [open, setOpen] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    const [pwOpen, setPwOpen] = useState(false);
    const [user, setUser] = useState<StoredUser | null>(null);
    const [isPending, startLogout] = useTransition();
    // Bumps after a successful upload so both <UserAvatar> instances
    // re-fetch the photo via the `?v=` cache-buster.
    const [imageVersion, setImageVersion] = useState(0);
    const [uploading, setUploading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Collapse the language popover whenever the profile popup closes
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
            onConfirm: () => {
                setLocale(next);
                setLangOpen(false);
            },
        });
    };

    const name = user?.userName ?? t("profile.guest");
    const secondary = user?.userId ?? "";

    // Avatar identity — same disc colour + photo-fetch contract as
    // Settings > Users (<UserAvatar> fetches the JWT-bearing blob and
    // falls back to the initials disc on WBE2113 / no photo). The header
    // resolves the signed-in user's OWN photo via the shared non-admin
    // GET; the `?v=` cache-buster flips after each upload.
    const avatarColor = avatarColorFor(user?.userId ?? "guest");
    const avatarImageUrl = user?.userId
        ? `/api/v1/users/${encodeURIComponent(user.userId)}/image?v=${imageVersion}`
        : null;

    const handleEditPhoto = useCallback(() => {
        if (uploading) return;
        fileInputRef.current?.click();
    }, [uploading]);

    const handleFileSelected = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            // Reset the input so re-picking the same file still fires onChange.
            event.target.value = "";
            if (!file) return;

            // Client-side validation mirrors the backend allow-list so a
            // friendly dialog fires before the round-trip.
            const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
            if (!(AVATAR_ALLOWED_EXT as readonly string[]).includes(ext)) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("settings.users.upload.error.extension", {
                        allowed: AVATAR_ALLOWED_EXT.join(", "),
                    }),
                });
                return;
            }
            if (file.size <= 0) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("settings.users.upload.error.empty"),
                });
                return;
            }
            if (file.size > AVATAR_MAX_BYTES) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("settings.users.upload.error.size", { cap: "2 MB" }),
                });
                return;
            }

            setUploading(true);
            try {
                await uploadMyImage(file);
                // Re-fetch both avatars against a fresh cache-buster.
                setImageVersion((v) => v + 1);
                dialog.open({
                    type: "success",
                    title: t("dialog.success"),
                    description: t("profile.photo_updated"),
                });
            } catch (err) {
                const code = err instanceof ApiCallError ? err.code : "NETWORK";
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description:
                        err instanceof Error ? err.message : "Failed to upload photo",
                    errorCode: code,
                });
            } finally {
                setUploading(false);
            }
        },
        [dialog, t],
    );

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
                <UserAvatar
                    name={name}
                    color={avatarColor}
                    userId={user?.userId}
                    imageUrl={avatarImageUrl}
                    className="size-8 text-wb-11"
                />
            </button>

            {open && (
                /*
                 * NO overflow-hidden here — the language submenu is absolutely
                 * positioned and would be clipped by it. Instead we apply
                 * rounded-t-* / rounded-b-* directly to the first and last
                 * children that carry non-white backgrounds.
                 */
                <div
                    role="menu"
                    aria-label={t("nav.account_menu")}
                    className="absolute right-0 top-full z-40 mt-2 w-[280px] max-w-[calc(100vw-16px)] rounded-[10px] bg-white shadow-wb-popup"
                >
                    {/* User block — rounded-t clips the top corners */}
                    <div className="flex flex-col items-center gap-[10px] rounded-t-[10px] border-b border-wb-ntrl-4 px-[10px] pt-4 pb-[14px]">
                        <div className="relative">
                            <div className="size-16 overflow-hidden rounded-full shadow-[0_0_3.048px_1.524px_rgba(0,0,0,0.04)] ring-[2.462px] ring-white/10">
                                <UserAvatar
                                    name={name}
                                    color={avatarColor}
                                    userId={user?.userId}
                                    imageUrl={avatarImageUrl}
                                    className="size-full text-wb-24"
                                />
                            </div>
                            <button
                                type="button"
                                aria-label={t("profile.edit_photo")}
                                onClick={handleEditPhoto}
                                disabled={uploading}
                                className="absolute -bottom-1 -right-1 flex cursor-pointer items-center justify-center rounded-full bg-white p-[6px] shadow-[0_2px_4px_2px_rgba(0,0,0,0.06)] hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-wait disabled:opacity-60"
                            >
                                <EditIcon className="size-4 text-wb-ntrl-6" />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif"
                                className="hidden"
                                onChange={handleFileSelected}
                            />
                        </div>
                        <div className="flex flex-col items-center text-center">
                            {/* Name = popup-title scale (text-wb-16 / 600), matching
                                the New Firm Banking / compact Settings dialog title.
                                Email = body scale (text-wb-13), one step down, kept
                                muted via opacity. Both bumped up from the previous
                                14 / 12 so the card reads at the Settings typography
                                scale. */}
                            <p className="text-wb-16 font-semibold tracking-wb-tight text-wb-ink">
                                {name}
                            </p>
                            {secondary && (
                                <p className="text-wb-13 font-medium tracking-wb-tight text-wb-ink opacity-50">
                                    {secondary}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Languages — submenu drops below the row, right-aligned */}
                    <div className="relative border-b border-wb-ntrl-4">
                        <button
                            type="button"
                            role="menuitem"
                            aria-haspopup="menu"
                            aria-expanded={langOpen}
                            onClick={() => setLangOpen((v) => !v)}
                            className="flex w-full cursor-pointer items-center justify-between px-4 py-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/30"
                        >
                            <div className="flex items-center gap-[10px]">
                                <Globe className="size-[18px] text-wb-ntrl-6" strokeWidth={2} />
                                <span className="text-wb-14 font-medium tracking-wb-tight text-wb-ink">
                                    {t("profile.languages")}
                                </span>
                            </div>
                            <div className="flex items-center gap-[6px]">
                                <span className="text-wb-14 font-medium tracking-wb-tight text-wb-ink">
                                    {t(LOCALE_LABEL_KEY[locale])}
                                </span>
                                <ChevronDown
                                    className={cn(
                                        "size-[18px] text-wb-ink transition-transform duration-150",
                                        langOpen && "rotate-180",
                                    )}
                                    strokeWidth={2}
                                />
                            </div>
                        </button>

                        {/*
                         * Submenu anchored to the bottom-right of the Languages row:
                         * top-full  → sits directly below the row border
                         * right-4   → 16 px from the dropdown's right edge (stays inside
                         *             the 280 px card on every screen size, no overflow)
                         * z-50 floats above the main card's z-40
                         */}
                        {langOpen && (
                            <div
                                role="menu"
                                aria-label={t("profile.languages")}
                                className="absolute top-full right-4 z-50 w-[152px] overflow-hidden rounded-[10px] bg-white py-1 shadow-wb-popup"
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
                                            className={cn(
                                                "flex h-8 w-full cursor-pointer items-center justify-between px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/30",
                                                active ? "hover:bg-brand/5" : "hover:bg-black/5",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "text-wb-14 tracking-wb-tight",
                                                    active
                                                        ? "font-semibold text-brand"
                                                        : "font-medium text-wb-ink",
                                                )}
                                            >
                                                {t(LOCALE_LABEL_KEY[l])}
                                            </span>
                                            {active && (
                                                <Check className="size-4 shrink-0 text-brand" strokeWidth={2.5} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Change Password */}
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            setOpen(false);
                            setPwOpen(true);
                        }}
                        className="flex w-full cursor-pointer items-center gap-[10px] px-4 py-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/30"
                    >
                        <Lock className="size-[18px] text-wb-ntrl-6" strokeWidth={2} />
                        <span className="text-wb-14 font-medium tracking-wb-tight text-wb-ink">
                            {t("profile.change_password")}
                        </span>
                    </button>

                    {/* Logout rail — rounded-b clips the bottom corners */}
                    <button
                        type="button"
                        role="menuitem"
                        disabled={isPending}
                        onClick={handleLogout}
                        className="flex w-full cursor-pointer items-center gap-[10px] rounded-b-[10px] border-t border-wb-ntrl-4 bg-wb-bg-sidebar px-4 py-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/30 disabled:cursor-wait disabled:opacity-60"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/header/ico-power.svg"
                            alt=""
                            aria-hidden
                            className="size-[18px]"
                        />
                        <span className="text-wb-14 font-medium tracking-wb-tight text-wb-ink">
                            {isPending ? t("profile.signing_out") : t("profile.logout")}
                        </span>
                    </button>
                </div>
            )}

            <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
        </div>
    );
}

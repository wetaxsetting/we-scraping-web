"use client";

import { UploadCloud } from "lucide-react";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
    type DragEvent,
} from "react";

import { useDialog } from "@/components/shared/dialog";
import { ApiCallError } from "@/lib/api/banking";
import {
    deleteUserImage,
    fetchUserImageBlob,
    uploadUserImage,
} from "@/lib/api/userManagement";
import { useTranslation } from "@/lib/i18n";

import type { SettingsUser } from "./types";

type UserAvatarUploadProps = {
    /** Selected user, if any. Required for the upload to fire — Add
     *  mode (no user yet) keeps the disc visible but inert; avatars
     *  are uploaded AFTER the user is created. */
    user?: SettingsUser;
    /** Notifies the parent when the avatar changes so it can refresh
     *  its in-memory user list with the new `user_img_url`. */
    onChange?: (next: SettingsUser) => void;
    /** When true, the component renders the photo (or empty state)
     *  but never accepts clicks / drops. Used by the view-mode Info
     *  panel, where editing requires switching to Edit mode first. */
    readOnly?: boolean;
};

/**
 * Dotted upload disc shown on the right side of the user Info form —
 * Figma 142:17631.
 *
 * 134 × 134 circle. When the user has no avatar (or no user is
 * selected) it renders the dashed brand-blue border + cloud icon +
 * "Drag & drop / or browse" copy. When the user already has an
 * avatar, the same circle renders the existing photo (fetched as a
 * Blob via the JWT-protected streaming endpoint) and the hover
 * affordance overlays the prompt so the user can replace it.
 *
 * <p>File pipeline:
 * <ol>
 *   <li>User browses or drops a file.</li>
 *   <li>Component validates against the same allow-list the backend
 *       enforces (jpg / jpeg / png / gif / svg, ≤ 2 MB) — surfaced as
 *       a friendly dialog before the network call.</li>
 *   <li>Optimistic preview shows the selected file immediately.</li>
 *   <li>POST {@code /api/v1/settings/users/{user_id}/image}; on
 *       success the parent is notified with the refreshed row whose
 *       {@code user_img_url} carries the cache-busted streaming URL.</li>
 *   <li>On failure the optimistic preview is rolled back to the
 *       previously-persisted image (or the empty state).</li>
 * </ol>
 */
export default function UserAvatarUpload({
    user,
    onChange,
    readOnly = false,
}: UserAvatarUploadProps) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const inputRef = useRef<HTMLInputElement | null>(null);

    /** Local object URL — flips between three sources:
     *  1. null         → render the empty (dashed) state
     *  2. server blob  → hydrate from `user.imageUrl` via JWT fetch
     *  3. local file   → optimistic preview during upload */
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [busy, setBusy] = useState(false);

    const userId = user?.loginId;
    const serverUrl = user?.imageUrl ?? null;

    // Hydrate from the server every time the selected user (or their
    // image URL — the `?v=<save>` cache-buster changes on every upload)
    // shifts. Object URLs are revoked on cleanup so we don't leak.
    useEffect(() => {
        if (!userId || !serverUrl) {
            setPreviewUrl(null);
            return;
        }
        let cancelled = false;
        let createdUrl: string | null = null;
        fetchUserImageBlob(userId)
            .then((blob) => {
                if (cancelled) return;
                if (!blob) {
                    setPreviewUrl(null);
                    return;
                }
                createdUrl = URL.createObjectURL(blob);
                setPreviewUrl(createdUrl);
            })
            .catch((err) => {
                if (cancelled) return;
                // Surface non-404 errors; missing avatar (WBE2113) is
                // returned as null from the API helper and handled above.
                const code = err instanceof ApiCallError ? err.code : "NETWORK";
                if (code !== "WBE2113") {
                    dialog.open({
                        type: "error",
                        title: t("dialog.error"),
                        description:
                            err instanceof Error ? err.message : "Failed to load avatar",
                        errorCode: code,
                    });
                }
                setPreviewUrl(null);
            });
        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [userId, serverUrl, dialog, t]);

    const openPicker = useCallback(() => {
        if (busy || readOnly) return;
        if (!userId) {
            dialog.open({
                type: "warning",
                title: t("dialog.warning"),
                description: t("settings.users.upload.create_first"),
            });
            return;
        }
        inputRef.current?.click();
    }, [busy, readOnly, userId, dialog, t]);

    const handleFile = useCallback(
        async (file: File) => {
            if (!userId) return;

            // Client-side validation mirrors the backend allow-list so
            // a friendly dialog fires before the round-trip.
            const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
            const allowed = ["jpg", "jpeg", "png", "gif", "svg"];
            if (!allowed.includes(ext)) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("settings.users.upload.error.extension", {
                        allowed: allowed.join(", "),
                    }),
                });
                return;
            }
            const maxBytes = 2 * 1024 * 1024;
            if (file.size <= 0) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("settings.users.upload.error.empty"),
                });
                return;
            }
            if (file.size > maxBytes) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("settings.users.upload.error.size", { cap: "2 MB" }),
                });
                return;
            }

            // Optimistic preview — swap to the local object URL while
            // the upload is in flight. On failure we revoke and fall
            // back to the previous URL via the `useEffect` reseed.
            const optimistic = URL.createObjectURL(file);
            const previous = previewUrl;
            setPreviewUrl(optimistic);
            setBusy(true);
            try {
                const row = await uploadUserImage(userId, file);
                onChange?.({
                    ...(user as SettingsUser),
                    imageUrl: row.user_img_url ?? null,
                });
                // The useEffect above will refetch from the server on
                // the new cache-buster, which revokes `optimistic` for
                // us via its cleanup. No manual revoke here to avoid
                // a momentary broken-image flash.
            } catch (err) {
                URL.revokeObjectURL(optimistic);
                setPreviewUrl(previous);
                const code = err instanceof ApiCallError ? err.code : "NETWORK";
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description:
                        err instanceof Error ? err.message : "Failed to upload avatar",
                    errorCode: code,
                });
            } finally {
                setBusy(false);
            }
        },
        [userId, previewUrl, dialog, t, onChange, user],
    );

    const handleInputChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            // Reset so re-selecting the same file fires the change.
            e.target.value = "";
            if (file) handleFile(file);
        },
        [handleFile],
    );

    const handleDrop = useCallback(
        (e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsDragging(false);
            if (!userId || busy || readOnly) return;
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
        },
        [userId, busy, readOnly, handleFile],
    );

    const handleDragOver = useCallback(
        (e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            if (!userId || busy || readOnly) return;
            setIsDragging(true);
        },
        [userId, busy, readOnly],
    );

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleRemove = useCallback(async () => {
        if (!userId || busy) return;
        setBusy(true);
        try {
            const row = await deleteUserImage(userId);
            onChange?.({
                ...(user as SettingsUser),
                imageUrl: row.user_img_url ?? null,
            });
            setPreviewUrl(null);
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "NETWORK";
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description:
                    err instanceof Error ? err.message : "Failed to remove avatar",
                errorCode: code,
            });
        } finally {
            setBusy(false);
        }
    }, [userId, busy, dialog, t, onChange, user]);

    const hasImage = !!previewUrl;

    return (
        <div className="flex shrink-0 flex-col items-center gap-2">
            <div
                role={readOnly ? "img" : "button"}
                tabIndex={readOnly ? -1 : 0}
                onClick={readOnly ? undefined : openPicker}
                onKeyDown={
                    readOnly
                        ? undefined
                        : (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openPicker();
                              }
                          }
                }
                onDrop={readOnly ? undefined : handleDrop}
                onDragOver={readOnly ? undefined : handleDragOver}
                onDragLeave={readOnly ? undefined : handleDragLeave}
                aria-label={t("settings.users.upload.aria")}
                aria-busy={busy}
                aria-disabled={readOnly || !userId || busy}
                className={[
                    "group relative flex size-[134px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-full bg-white text-center transition-colors",
                    readOnly ? "cursor-default border border-black/10" : "cursor-pointer border border-dashed",
                    !readOnly && isDragging ? "border-brand bg-brand-soft/40" : "",
                    !readOnly && !isDragging ? "border-brand" : "",
                    !readOnly && (!userId || busy) ? "cursor-not-allowed opacity-70" : "",
                ].join(" ")}
            >
                {hasImage ? (
                    <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={previewUrl}
                            alt={t("settings.users.upload.alt", {
                                name: user?.name ?? "",
                            })}
                            className="size-full object-cover"
                        />
                        {readOnly ? null : (
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                                <UploadCloud className="size-6" strokeWidth={1.6} />
                                <span className="text-wb-13 font-medium leading-tight">
                                    {t("settings.users.upload.replace")}
                                </span>
                            </div>
                        )}
                    </>
                ) : readOnly ? (
                    <span
                        className="text-[42px] font-semibold text-wb-ink"
                        style={{ backgroundColor: user?.avatarColor }}
                    >
                        {initialsOf(user?.name ?? "")}
                    </span>
                ) : (
                    <>
                        <UploadCloud className="size-7 text-brand" strokeWidth={1.5} />
                        <p className="mt-2 text-wb-13 font-medium leading-tight text-wb-ink">
                            {t("settings.users.upload.drag_drop")}
                        </p>
                        <p className="text-wb-13 font-medium leading-tight text-wb-ink">
                            {t("settings.users.upload.or")}{" "}
                            <span className="text-brand">
                                {t("settings.users.upload.browse")}
                            </span>
                        </p>
                    </>
                )}
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/svg+xml"
                    onChange={handleInputChange}
                    className="sr-only"
                    aria-hidden
                    tabIndex={-1}
                />
            </div>
            {hasImage && userId && !readOnly ? (
                <button
                    type="button"
                    onClick={handleRemove}
                    disabled={busy}
                    className="cursor-pointer text-wb-12 font-medium text-wb-muted hover:text-wb-ink disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {t("settings.users.upload.remove")}
                </button>
            ) : null}
        </div>
    );
}

function initialsOf(name: string): string {
    return (
        name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join("") || "?"
    );
}

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
import DeleteIcon from "@/components/shared/icons/DeleteIcon";
import { ApiCallError } from "@/lib/api/banking";
import { fetchUserImageBlob } from "@/lib/api/userManagement";
import { useTranslation } from "@/lib/i18n";

import type { PendingAvatarChange, SettingsUser } from "./types";

type UserAvatarUploadProps = {
    /** Selected user, if any. Required for a pick to be allowed — Add
     *  mode (no user yet) keeps the disc visible but inert; avatars
     *  are handled AFTER the user is created. */
    user?: SettingsUser;
    /**
     * Deferred-commit callback (Edit mode). The avatar is **not**
     * persisted when the admin picks or removes a photo — the choice is
     * reported here as a pending change and shown as a local preview
     * only. The panel commits it in its Save handler (upload / delete)
     * and discards it on Cancel / user-switch. Mirrors legacy
     * `comm_0190_003` (stage the file on select via `u002`, commit to the
     * user on `u001` / Save). `null` clears a pending change.
     */
    onPendingChange?: (change: PendingAvatarChange | null) => void;
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
 * Blob via the JWT-protected streaming endpoint) and hovering it
 * reveals a legacy-style trash Delete button.
 *
 * <p><b>Deferred commit.</b> Picking or removing a photo does NOT hit
 * the network — it only updates the local preview and reports a
 * {@link PendingAvatarChange} to the parent via {@link onPendingChange}.
 * The panel's Save handler is what actually uploads / deletes; a Cancel
 * or user-switch discards the pending change (legacy `comm_0190_003`
 * stage-on-select / commit-on-Save parity).
 */
export default function UserAvatarUpload({
    user,
    onPendingChange,
    readOnly = false,
}: UserAvatarUploadProps) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const inputRef = useRef<HTMLInputElement | null>(null);
    /** A locally-created object URL for the pending-upload preview —
     *  tracked so it can be revoked when replaced or on unmount. */
    const localUrlRef = useRef<string | null>(null);

    /** Local object URL — flips between three sources:
     *  1. null         → render the empty (dashed) state
     *  2. server blob  → hydrate from `user.imageUrl` via JWT fetch
     *  3. local file   → pending-pick preview (not yet persisted) */
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const userId = user?.loginId;
    const serverUrl = user?.imageUrl ?? null;

    // Hydrate the persisted photo when the selected user (or their image
    // URL — the `?v=<save>` cache-buster) changes. This is the initial
    // state only; a pending pick/remove replaces `previewUrl` locally and
    // this effect's deps don't change during editing, so it never
    // clobbers an in-progress choice. Object URLs are revoked on cleanup.
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

    // Revoke a lingering pending-preview object URL on unmount.
    useEffect(
        () => () => {
            if (localUrlRef.current) {
                URL.revokeObjectURL(localUrlRef.current);
                localUrlRef.current = null;
            }
        },
        [],
    );

    const openPicker = useCallback(() => {
        if (readOnly) return;
        if (!userId) {
            dialog.open({
                type: "warning",
                title: t("dialog.warning"),
                description: t("settings.users.upload.create_first"),
            });
            return;
        }
        inputRef.current?.click();
    }, [readOnly, userId, dialog, t]);

    const handleFile = useCallback(
        (file: File) => {
            if (!userId) return;

            // Client-side validation mirrors the backend allow-list so a
            // friendly dialog fires before the change is staged. SVG is
            // intentionally excluded (backend rejects it — F-02).
            const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
            const allowed = ["jpg", "jpeg", "png", "gif"];
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
            if (file.size <= 0) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("settings.users.upload.error.empty"),
                });
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("settings.users.upload.error.size", { cap: "2 MB" }),
                });
                return;
            }

            // Stage the pick locally — persisted only when the panel Save
            // runs. Revoke any earlier pending preview first.
            const url = URL.createObjectURL(file);
            if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
            localUrlRef.current = url;
            setPreviewUrl(url);
            onPendingChange?.({ kind: "upload", file });
        },
        [userId, dialog, t, onPendingChange],
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
            if (!userId || readOnly) return;
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
        },
        [userId, readOnly, handleFile],
    );

    const handleDragOver = useCallback(
        (e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            if (!userId || readOnly) return;
            setIsDragging(true);
        },
        [userId, readOnly],
    );

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleRemove = useCallback(() => {
        // Stage the removal — the persisted photo is deleted only when the
        // panel Save runs. Cancel discards this via the parent.
        if (localUrlRef.current) {
            URL.revokeObjectURL(localUrlRef.current);
            localUrlRef.current = null;
        }
        setPreviewUrl(null);
        onPendingChange?.({ kind: "remove" });
    }, [onPendingChange]);

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
                aria-disabled={readOnly || !userId}
                className={[
                    "group relative flex size-[134px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-full bg-white text-center transition-colors",
                    readOnly ? "cursor-default border border-black/10" : "cursor-pointer border border-dashed",
                    !readOnly && isDragging ? "border-brand bg-brand-soft/40" : "",
                    !readOnly && !isDragging ? "border-brand" : "",
                    !readOnly && !userId ? "cursor-not-allowed opacity-70" : "",
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
                            // Legacy parity (resl_0001_001 / comm_0190_003): when a
                            // photo exists the hover overlay is a clear DELETE button
                            // (icon only, white trash on a darkened photo). The dark
                            // tint is pointer-events-none so a click that misses the
                            // trash bubbles to the container and re-opens the picker
                            // (implicit replace); the trash stops propagation and
                            // stages the removal.
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemove();
                                    }}
                                    aria-label={t("settings.users.upload.remove")}
                                    className="pointer-events-auto flex cursor-pointer items-center justify-center rounded-md p-2 text-white transition-colors hover:bg-white/10"
                                >
                                    <DeleteIcon className="size-6" />
                                </button>
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
                    accept="image/jpeg,image/png,image/gif"
                    onChange={handleInputChange}
                    className="sr-only"
                    aria-hidden
                    tabIndex={-1}
                />
            </div>
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

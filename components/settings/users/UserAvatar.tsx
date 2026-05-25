"use client";

import { useEffect, useState } from "react";

import { fetchUserImageBlob } from "@/lib/api/userManagement";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
    name: string;
    /** CSS colour for the disc background (e.g. "#fae6e6"). */
    color: string;
    /** Login id — required for the per-row JWT-bearing photo fetch. */
    userId?: string;
    /** Streaming URL the backend ships when the user has an uploaded
     *  avatar (e.g. `/api/v1/settings/users/{id}/image?v=<save>`).
     *  When present, this component fetches the blob via the JWT-
     *  protected endpoint and renders it; otherwise it falls back to
     *  the initials disc. The `?v=<save>` cache-buster flips on every
     *  upload — re-fires the effect so refreshed photos hydrate. */
    imageUrl?: string | null;
    className?: string;
};

/**
 * 42 px circular avatar — renders the user's uploaded photo when one
 * exists, otherwise an initials disc on a soft pastel background.
 *
 * Mirrors the legacy WeCMS user list (Figma 142:23110 / live
 * `fnsh_0001_001`): rows show the photo where available, the
 * coloured initials disc otherwise.
 *
 * The photo is fetched as a Blob via the JWT-bearing
 * `GET /api/v1/settings/users/{id}/image` endpoint and exposed to the
 * `<img>` tag through `URL.createObjectURL`. Object URLs are revoked
 * on cleanup so a long-lived list panel does not leak memory.
 */
export default function UserAvatar({
    name,
    color,
    userId,
    imageUrl,
    className,
}: UserAvatarProps) {
    const initials =
        name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join("") || "?";

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Hydrate the photo blob whenever the user changes or the cache-
    // buster flips. Failures (missing photo, 401, network) degrade
    // silently to the initials disc — list rows must keep rendering.
    useEffect(() => {
        if (!userId || !imageUrl) {
            setPreviewUrl(null);
            return;
        }
        let cancelled = false;
        let createdUrl: string | null = null;
        fetchUserImageBlob(userId)
            .then((blob) => {
                if (cancelled || !blob) return;
                createdUrl = URL.createObjectURL(blob);
                setPreviewUrl(createdUrl);
            })
            .catch(() => {
                /* Initials-disc fallback — list rows never surface an
                 * error dialog because they can't recover from one. */
            });
        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [userId, imageUrl]);

    return (
        <div
            aria-hidden
            className={cn(
                "flex size-[42px] shrink-0 items-center justify-center overflow-hidden rounded-full text-wb-13 font-semibold text-wb-ink",
                className,
            )}
            style={previewUrl ? undefined : { backgroundColor: color }}
        >
            {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={previewUrl}
                    alt=""
                    aria-hidden
                    className="size-full object-cover"
                />
            ) : (
                initials
            )}
        </div>
    );
}

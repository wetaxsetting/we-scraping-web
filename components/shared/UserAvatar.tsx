"use client";

import { useEffect, useState } from "react";

import { fetchUserImageBlobByUrl } from "@/lib/api/users";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
    name: string;
    /** CSS colour for the disc background (e.g. "#fae6e6"). Compute it
     *  with `avatarColorFor(id)` from `@/lib/avatar` so the same user
     *  keeps the same colour across every screen. */
    color: string;
    /** Login / user id — used only as a stable identity hint (kept for
     *  call-site readability); the photo is fetched from {@link imageUrl}. */
    userId?: string;
    /** Streaming URL the backend ships when the user has an uploaded
     *  avatar. Two shapes flow through here:
     *   - Settings > Users: `/api/v1/settings/users/{id}/image?v=<save>`
     *   - Approver / signer surfaces: `/api/v1/users/{id}/image`
     *  When present, this component fetches the blob via the JWT-bearing
     *  endpoint and renders it; otherwise it falls back to the initials
     *  disc. The `?v=<save>` cache-buster (when present) flips on every
     *  upload — re-fires the effect so refreshed photos hydrate. */
    imageUrl?: string | null;
    /** Extra classes — the canonical way to size the avatar per surface.
     *  Defaults to the User Management 42 px disc with 13 px initials;
     *  callers override via Tailwind size + `text-wb-*` tokens (e.g.
     *  `size-7 text-wb-11` for the 28 px approver popover, `size-5
     *  text-wb-10` for the 20 px payment chip). Width/height and initials
     *  size are the only per-surface variance — shape, palette, weight,
     *  and photo treatment stay identical to User Management. */
    className?: string;
};

/**
 * Shared circular user avatar — renders the user's uploaded photo when
 * one exists, otherwise an initials disc on a soft pastel background.
 *
 * <p>Single source of avatar logic across the product: Settings > Users
 * (the visual source of truth), the Approval Line approver popover, and
 * the Payment approval-status popup all render this component so the
 * photo / initials behaviour, palette, font, and radius are identical.
 *
 * <p>The photo is fetched as a Blob via the JWT-bearing image endpoint
 * (a plain `<img src>` would omit the Authorization header) and exposed
 * to the `<img>` tag through `URL.createObjectURL`. Object URLs are
 * revoked on cleanup so a long-lived list / popover does not leak memory.
 * Failures (missing photo, 401, network) degrade silently to the initials
 * disc — avatar rows must keep rendering.
 */
export default function UserAvatar({
    name,
    color,
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

    // Hydrate the photo blob whenever the image URL changes (identity or
    // cache-buster). Failures degrade silently to the initials disc.
    // The preview is reset in cleanup (not synchronously in the effect
    // body) so switching to a user with no image — or unmounting — clears
    // the stale photo without a render-phase setState.
    useEffect(() => {
        if (!imageUrl) return;
        let cancelled = false;
        let createdUrl: string | null = null;
        fetchUserImageBlobByUrl(imageUrl)
            .then((blob) => {
                if (cancelled || !blob) return;
                createdUrl = URL.createObjectURL(blob);
                setPreviewUrl(createdUrl);
            })
            .catch(() => {
                /* Initials-disc fallback — avatar rows never surface an
                 * error dialog because they can't recover from one. */
            });
        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
            setPreviewUrl(null);
        };
    }, [imageUrl]);

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

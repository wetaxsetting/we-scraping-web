/**
 * Shared avatar colour logic — the single source of truth for the
 * pastel disc background the `<UserAvatar>` initials fallback paints.
 *
 * <p>Lifted out of `components/settings/users/types.ts` (2026-06-30) so
 * every avatar surface — Settings > Users, the Approval Line approver
 * popover, and the Payment approval-status popup — computes the SAME
 * colour for the same user id. Hashing `userId` against the palette
 * keeps the colour identity-stable across reloads and across screens.
 */

/** Stable pastel palette used for avatar discs when the user has no
 *  uploaded image. */
export const AVATAR_COLORS = [
    "#fae6e6",
    "#e6f0fa",
    "#e9f5ee",
    "#fdf6e3",
    "#f3e8ff",
    "#fff0e6",
    "#e6fafa",
];

/** Deterministic pastel colour for a user id — same id → same colour
 *  across renders, sessions, and screens. */
export function avatarColorFor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
    }
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

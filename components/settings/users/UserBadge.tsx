import { cn } from "@/lib/utils";

import type { UserRole } from "./types";

type UserBadgeProps = {
    role: UserRole;
    label: string;
    className?: string;
};

/**
 * Role pill — Figma 142:23115 (Admin) and 142:23122 / 142:23129 (User).
 *
 * Two static variants:
 *   - Admin: muted green chip on a soft mint bg
 *   - User:  olive text on a soft yellow bg
 *
 * The hex values are taken straight from the Figma frame; they have no
 * sibling in the brand token set so they live as inline arbitrary
 * Tailwind classes here. If the design language adds a "role" token
 * later, swap these for the named token in one place.
 */
const ROLE_STYLE: Record<UserRole, string> = {
    admin: "bg-wb-status-approved-bg border-[rgba(33,150,83,0.1)] text-wb-status-approved-text",
    user: "bg-wb-status-pending-bg border-[rgba(86,100,0,0.1)] text-wb-status-pending-text",
};

export default function UserBadge({ role, label, className }: UserBadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-wb-13 font-medium leading-none",
                ROLE_STYLE[role],
                className,
            )}
        >
            {label}
        </span>
    );
}

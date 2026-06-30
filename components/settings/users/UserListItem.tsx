"use client";

import UserAvatar from "@/components/shared/UserAvatar";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { SettingsUser } from "./types";
import UserBadge from "./UserBadge";

type UserListItemProps = {
    user: SettingsUser;
    selected?: boolean;
    onSelect?: (id: string) => void;
};

/**
 * Single row in the Users list panel — Figma 142:23110 (default) and
 * 142:23335 (selected).
 *
 * Layout: 42 px avatar disc + name (with optional "(You)" suffix) and
 * role pill on the first line, email muted on the second. The whole
 * row is `gap-3 py-2.5` matching Figma's row rhythm.
 *
 * Selected rows take the `#edf7ff` light-blue background. The row is
 * a button so keyboard activation (Enter / Space) flips the selection
 * just like a click.
 */
export default function UserListItem({ user, selected, onSelect }: UserListItemProps) {
    const { t } = useTranslation();
    const roleLabel = t(
        user.role === "admin" ? "settings.users.role.admin" : "settings.users.role.user",
    );
    return (
        <button
            type="button"
            onClick={() => onSelect?.(user.id)}
            aria-current={selected ? "true" : undefined}
            className={cn(
                "flex cursor-pointer items-center gap-3 py-2.5 pr-5 text-left transition-colors",
                selected ? "bg-brand-soft" : "hover:bg-black/[0.02]",
            )}
        >
            <UserAvatar
                name={user.name}
                color={user.avatarColor}
                userId={user.loginId}
                imageUrl={user.imageUrl}
            />
            <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-1">
                    <span className="text-wb-14-tight font-medium text-wb-ink">
                        {user.name}
                        {user.isCurrentUser ? ` ${t("settings.users.you_suffix")}` : null}
                    </span>
                    <UserBadge role={user.role} label={roleLabel} />
                </div>
                <span className="truncate text-wb-13 font-medium leading-5 text-wb-muted">
                    {user.email}
                </span>
            </div>
        </button>
    );
}

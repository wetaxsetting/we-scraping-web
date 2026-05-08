"use client";

import { ChevronRight, Plus } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { SettingsUser } from "./types";
import UserListItem from "./UserListItem";

type UsersListPanelProps = {
    users: SettingsUser[];
    selectedUserId: string | null;
    /** When `true`, highlights the Add-a-user row instead of any user
     *  row — even if `selectedUserId` is also set. The two flags are
     *  mutually exclusive in `<UsersPanel>` but the panel guards
     *  defensively so a future caller can't accidentally double-highlight. */
    isAddingUser: boolean;
    onSelectUser: (id: string) => void;
    onAddUser: () => void;
};

/**
 * Left list panel — user rows + Add-a-user affordance (Figma 142:23109 /
 * 142:23334 + 142:17631 active-add).
 *
 * Owns the body of the list column only. The search input lives one
 * level up in the shared toolbar grid (see `<UsersPanel>`) so its
 * horizontal dividers can span both columns without per-panel border
 * duplication.
 *
 * Container has no left/right padding; each row owns its own
 * `pl-6 pr-5` so a selected user's `bg-[#edf7ff]` highlight bleeds to
 * both column edges (matching Figma 142:23335). Add row uses the same
 * row padding for visual rhythm and takes the same highlight bg when
 * `isAddingUser` is true.
 *
 * Static UI: clicking a user row updates `selectedUserId`; clicking
 * Add-a-user calls `onAddUser` which flips the panel to add mode.
 */
export default function UsersListPanel({
    users,
    selectedUserId,
    isAddingUser,
    onSelectUser,
    onAddUser,
}: UsersListPanelProps) {
    const { t } = useTranslation();

    return (
        <div className="flex min-h-0 flex-col gap-0.5">
            {users.map((user) => (
                <UserListItem
                    key={user.id}
                    user={user}
                    selected={!isAddingUser && user.id === selectedUserId}
                    onSelect={onSelectUser}
                />
            ))}

            <button
                type="button"
                onClick={onAddUser}
                aria-current={isAddingUser ? "true" : undefined}
                className={cn(
                    "flex cursor-pointer items-center justify-between py-2.5 pl-6 pr-5 text-left transition-colors",
                    isAddingUser ? "bg-brand-soft" : "hover:bg-black/[0.02]",
                )}
            >
                <span className="flex items-center gap-3">
                    <span
                        aria-hidden
                        className="flex size-[42px] items-center justify-center rounded-full border border-dashed border-brand text-brand"
                    >
                        <Plus className="size-[18px]" strokeWidth={2} />
                    </span>
                    <span className="text-wb-14-tight font-medium text-brand">
                        {t("settings.users.add_user")}
                    </span>
                </span>
                <ChevronRight
                    className="size-[18px] shrink-0 text-wb-ink opacity-50"
                    strokeWidth={2}
                />
            </button>
        </div>
    );
}

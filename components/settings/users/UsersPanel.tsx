"use client";

import { useCallback, useMemo, useState } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";

import AddUserInfoForm from "./AddUserInfoForm";
import EditUserInfoForm from "./EditUserInfoForm";
import { mockUsers } from "./mockData";
import type { UserDetailTabKey } from "./types";
import UserDetailView from "./UserDetailView";
import UserMenuEntitlementPanel from "./UserMenuEntitlementPanel";
import UsersEmptyState from "./UsersEmptyState";
import UsersListPanel from "./UsersListPanel";
import UserTabs from "./UserTabs";

/**
 * Users panel — Settings popup submenu (Figma 142:22998 empty state +
 * 142:23223 selected-user view + 142:17631 add-user mode).
 *
 * Layout (top → bottom, all inside the modal's right column):
 *   [Header]    — "User Management" title + plan-limit subtitle. The
 *                 right edge stays clear of the shell's Esc/X via `pr-24`.
 *   [Toolbar]   — single grid row spanning both columns. Owns one
 *                 `border-y` so the top + bottom horizontal dividers
 *                 are guaranteed continuous across the whole panel
 *                 width (no per-column duplication, no height drift).
 *                   · Left  (360 px) — search input
 *                   · Right (1 fr)   — Info / Menu Entitlement tabs +
 *                                       Edit button (view mode) OR
 *                                       Cancel + Save buttons (add mode)
 *   [Body]      — second grid row sharing the same column template,
 *                 so the right-column `border-l` lines up exactly with
 *                 the toolbar's right column.
 *
 * Padding is hoisted to a single `pl-6` on the outer flex container so
 * everything below — title, horizontal dividers, search input, user
 * rows — shares one left-edge origin (24 px from the modal's
 * sidebar-content boundary).
 *
 * Mode state — three mutually-exclusive surfaces:
 *   `selectedUserId !== null && !isEditing && !isAddingUser` → view mode
 *   `selectedUserId !== null && isEditing`                   → edit mode
 *   `isAddingUser`                                           → add mode
 *   none                                                     → empty state
 *
 * Selecting a list row resets `isAddingUser` + `isEditing` and forces
 * `activeTab = "info"` (every selection lands on Info first). Clicking
 * "Add a user" flips to add mode and clears the selection. Edit is
 * triggered from the toolbar's pencil button while a user is selected;
 * Cancel / Save in edit mode reverts to view mode. The forms are all
 * uncontrolled so cancelling drops local edits via unmount.
 *
 * Tab visibility:
 *   - Add mode → both tabs visible (the user is being created and may
 *     end up either Admin or User).
 *   - View / edit of an Admin → Menu Entitlement is hidden (admins
 *     have implicit full menu access). The active tab is force-pinned
 *     to "info" via `effectiveTab` regardless of `activeTab` state.
 *   - View / edit of a User → both tabs visible.
 *
 * Static UI: search keyword + active tab live in local state (no API).
 * Edit / Save / Delete / Add are no-ops until the create / edit flow
 * lands.
 */
export default function UsersPanel() {
    const { t } = useTranslation();
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [keyword, setKeyword] = useState("");
    const [activeTab, setActiveTab] = useState<UserDetailTabKey>("info");

    const selectedUser = useMemo(
        () => mockUsers.find((u) => u.id === selectedUserId) ?? null,
        [selectedUserId],
    );

    const isAdminSelected = !!selectedUser && selectedUser.role === "admin";
    const hideMenuEntitlement = isAdminSelected;
    const effectiveTab: UserDetailTabKey = hideMenuEntitlement ? "info" : activeTab;

    const handleSelectUser = useCallback((id: string) => {
        setSelectedUserId(id);
        setIsAddingUser(false);
        setIsEditing(false);
        setActiveTab("info");
    }, []);

    const handleStartAddUser = useCallback(() => {
        setIsAddingUser(true);
        setSelectedUserId(null);
        setIsEditing(false);
        setActiveTab("info");
    }, []);

    const handleCancelAddUser = useCallback(() => {
        setIsAddingUser(false);
    }, []);

    const handleStartEditing = useCallback(() => {
        setIsEditing(true);
    }, []);

    const handleCancelEditing = useCallback(() => {
        setIsEditing(false);
    }, []);

    const searchPlaceholder = t("settings.users.search_placeholder");

    return (
        <div className="flex min-h-0 flex-1 flex-col pl-6">
            {/* Header */}
            <div className="shrink-0 pb-5 pt-14 pr-24">
                <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                    {t("settings.users.title")}
                </h3>
                <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                    {t("settings.users.description")}
                </p>
            </div>

            {/* Toolbar — grid row with shared horizontal dividers. Lives
               inside the outer `pl-6`, so `border-y` starts 24 px from
               the modal's left edge — aligned with the title above. */}
            <div className="grid shrink-0 grid-cols-1 border-y border-wb-ntrl-4 md:grid-cols-[360px_1fr]">
                <div className="py-4 pr-4">
                    <div className="relative">
                        <Search
                            className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-wb-ntrl-5"
                            strokeWidth={1.8}
                        />
                        <Input
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder={searchPlaceholder}
                            aria-label={searchPlaceholder}
                            className="h-8 rounded-md pl-8 pr-2 text-wb-14-tight font-medium placeholder:text-wb-ntrl-5"
                        />
                    </div>
                </div>
                <div className="flex items-center justify-between gap-3 border-wb-ntrl-4 p-4 md:border-l max-md:border-t">
                    <UserTabs
                        activeTab={effectiveTab}
                        onChange={setActiveTab}
                        hideMenuEntitlement={hideMenuEntitlement}
                    />
                    {isAddingUser ? (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleCancelAddUser}
                                className="flex h-8 cursor-pointer items-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-dark shadow-wb-btn hover:bg-black/[0.03]"
                            >
                                {t("settings.users.cancel")}
                            </button>
                            <button
                                type="button"
                                className="flex h-8 cursor-pointer items-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                            >
                                {t("settings.users.save")}
                            </button>
                        </div>
                    ) : selectedUser && isEditing ? (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleCancelEditing}
                                className="flex h-8 cursor-pointer items-center gap-1 rounded-md border border-destructive bg-white px-3 text-wb-14-tight font-medium text-destructive hover:bg-destructive/5"
                            >
                                <Trash2 className="size-4" strokeWidth={1.8} />
                                {t("settings.users.delete")}
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelEditing}
                                className="flex h-8 cursor-pointer items-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                            >
                                {t("settings.users.save")}
                            </button>
                        </div>
                    ) : selectedUser ? (
                        <button
                            type="button"
                            onClick={handleStartEditing}
                            className="flex h-8 cursor-pointer items-center gap-1 rounded-md bg-white px-2 text-wb-14-tight font-medium tracking-wb-tight text-wb-dark shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            <Pencil className="size-4" strokeWidth={1.8} />
                            {t("settings.users.edit")}
                        </button>
                    ) : null}
                </div>
            </div>

            {/* Body — same column template so the right-column vertical
               divider continues from the toolbar's right column. */}
            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[360px_1fr]">
                <UsersListPanel
                    users={mockUsers}
                    selectedUserId={selectedUserId}
                    isAddingUser={isAddingUser}
                    onSelectUser={handleSelectUser}
                    onAddUser={handleStartAddUser}
                />
                <div className="flex min-h-0 flex-col border-wb-ntrl-4 md:border-l max-md:border-t">
                    {isAddingUser ? (
                        effectiveTab === "info" ? (
                            <AddUserInfoForm />
                        ) : (
                            <UserMenuEntitlementPanel />
                        )
                    ) : selectedUser ? (
                        effectiveTab === "info" ? (
                            isEditing ? (
                                <EditUserInfoForm user={selectedUser} />
                            ) : (
                                <UserDetailView user={selectedUser} />
                            )
                        ) : (
                            <UserMenuEntitlementPanel user={selectedUser} />
                        )
                    ) : (
                        <UsersEmptyState />
                    )}
                </div>
            </div>
        </div>
    );
}

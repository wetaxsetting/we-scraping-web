"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import { Input } from "@/components/ui/input";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { ApiCallError } from "@/lib/api/banking";
import {
    createUserMgmt,
    deleteUserMgmt,
    fetchUserMgmtList,
    updateUserMgmt,
} from "@/lib/api/userManagement";
import { useTranslation } from "@/lib/i18n";

import AddUserInfoForm from "./AddUserInfoForm";
import EditUserInfoForm from "./EditUserInfoForm";
import type { SettingsUser, UserDetailTabKey, UserListMeta } from "./types";
import { mapUserRow, toCreateRequest, toUpdateRequest } from "./types";
import UserDetailView from "./UserDetailView";
import UserMenuEntitlementPanel from "./UserMenuEntitlementPanel";
import UsersEmptyState from "./UsersEmptyState";
import UsersListPanel from "./UsersListPanel";
import UserTabs from "./UserTabs";
import { useUserFormHandleRef } from "./useUserFormHandle";

/**
 * Users panel — Settings popup submenu (Figma 142:22998 empty state +
 * 142:23223 selected-user view + 142:17631 add-user mode).
 *
 * Live data via `/api/v1/settings/users`. Mock seed retired with the
 * MR that wired the Spring `UserManagementController`. No plan cap —
 * legacy JEX defines a 5-user limit but never throws it; the refactor
 * preserves the unrestricted behaviour. The subtitle shows the active
 * count for visibility, not as a gate.
 *
 * <p>Menu Entitlement tab is wired to `USER_MENU_AUTH_INFM` via the
 * Spring `MenuEntitlementService` (V126 migration). Edit-mode Save
 * persists both the Info form (when the active tab is `info`) AND
 * the entitlement draft (when the active tab is `menu_entitlement`).
 * Admin users hide the tab entirely — they implicitly have full
 * access.
 *
 * <p>Mode state — three mutually-exclusive surfaces:
 *   `selectedUserId !== null && !isEditing && !isAddingUser` → view mode
 *   `selectedUserId !== null && isEditing`                   → edit mode
 *   `isAddingUser`                                           → add mode
 *   none                                                     → empty state
 */
export default function UsersPanel() {
    const { t } = useTranslation();
    const dialog = useDialog();

    // Server-loaded state.
    const [users, setUsers] = useState<SettingsUser[]>([]);
    const [meta, setMeta]   = useState<UserListMeta>({ totalCount: 0 });
    const [loading, setLoading] = useState(true);
    const [saving,  setSaving]  = useState(false);

    /* Smooth the loading + saving indicators so fast cached responses
     * don't flash the "Loading…" placeholder or button-disabled state
     * on/off below the table. Both downstream consumers read from
     * these sticky views so the visible state stays stable. */
    const stickyLoading   = useStickyLoading(loading);
    const stickySaving    = useStickyLoading(saving);

    // UI state.
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [isAddingUser, setIsAddingUser]     = useState(false);
    const [isEditing,    setIsEditing]        = useState(false);
    const [keyword,      setKeyword]          = useState("");
    const [activeTab,    setActiveTab]        = useState<UserDetailTabKey>("info");

    const addFormRef    = useUserFormHandleRef();
    const editFormRef   = useUserFormHandleRef();

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchUserMgmtList();
            const mapped = res.users.map(mapUserRow);
            setUsers(mapped);
            setMeta({ totalCount: res.total_count });
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "NETWORK";
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: err instanceof Error ? err.message : "Failed to load users",
                errorCode: code,
            });
        } finally {
            setLoading(false);
        }
    }, [dialog, t]);

    useEffect(() => {
        reload();
    }, [reload]);

    const filteredUsers = useMemo(() => {
        const q = keyword.trim().toLowerCase();
        const matches = q
            ? users.filter(
                  (u) =>
                      u.name.toLowerCase().includes(q) ||
                      u.loginId.toLowerCase().includes(q) ||
                      u.email.toLowerCase().includes(q),
              )
            : users;
        // Admins first, then regular users. Array.prototype.sort is
        // stable in modern engines so server order is preserved within
        // each role group. Matches Figma 142:23334 list ordering.
        return [...matches].sort((a, b) => {
            if (a.role === b.role) return 0;
            return a.role === "admin" ? -1 : 1;
        });
    }, [users, keyword]);

    const selectedUser = useMemo(
        () => users.find((u) => u.id === selectedUserId) ?? null,
        [users, selectedUserId],
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

    // --- Save handlers --------------------------------------------------

    const reportError = useCallback(
        (err: unknown) => {
            const code = err instanceof ApiCallError ? err.code : "NETWORK";
            const fallback = err instanceof Error ? err.message : "Request failed";
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: fallback,
                errorCode: code,
            });
        },
        [dialog, t],
    );

    const handleSaveAdd = useCallback(async () => {
        const draft = addFormRef.current?.collect();
        if (!draft) return;
        setSaving(true);
        try {
            await createUserMgmt(toCreateRequest(draft));
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("settings.users.success.created"),
            });
            setIsAddingUser(false);
            await reload();
        } catch (err) {
            reportError(err);
        } finally {
            setSaving(false);
        }
    }, [addFormRef, dialog, t, reload, reportError]);

    const handleSaveEdit = useCallback(async () => {
        if (!selectedUser) return;
        const draft = editFormRef.current?.collect();
        if (!draft) return;
        setSaving(true);
        try {
            await updateUserMgmt(selectedUser.loginId, toUpdateRequest(draft));
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("settings.users.success.updated"),
            });
            setIsEditing(false);
            await reload();
        } catch (err) {
            reportError(err);
        } finally {
            setSaving(false);
        }
    }, [selectedUser, editFormRef, dialog, t, reload, reportError]);

    const handleDelete = useCallback(() => {
        if (!selectedUser) return;
        dialog.open({
            type: "confirmation",
            title: t("dialog.confirmation"),
            description: t("settings.users.confirm.delete", { name: selectedUser.name }),
            confirmText: t("dialog.continue"),
            cancelText:  t("dialog.cancel"),
            onConfirm: async () => {
                setSaving(true);
                try {
                    await deleteUserMgmt(selectedUser.loginId);
                    dialog.open({
                        type: "success",
                        title: t("dialog.success"),
                        description: t("settings.users.success.deleted"),
                    });
                    setSelectedUserId(null);
                    setIsEditing(false);
                    await reload();
                } catch (err) {
                    reportError(err);
                } finally {
                    setSaving(false);
                }
            },
        });
    }, [selectedUser, dialog, t, reload, reportError]);

    const searchPlaceholder = t("settings.users.search_placeholder");
    const description = t("settings.users.description");

    return (
        <div className="flex min-h-0 flex-1 flex-col pl-6">
            {/* Header */}
            <div className="shrink-0 pb-5 pt-14 pr-24">
                <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                    {t("settings.users.title")}
                </h3>
                <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                    {description}
                </p>
            </div>

            {/* Toolbar */}
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
                                disabled={stickySaving}
                                className="flex h-8 cursor-pointer items-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-dark shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {t("settings.users.cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveAdd}
                                disabled={stickySaving}
                                className="flex h-8 cursor-pointer items-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {t("settings.users.save")}
                            </button>
                        </div>
                    ) : selectedUser && isEditing && effectiveTab === "info" ? (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={stickySaving}
                                className="flex h-8 cursor-pointer items-center gap-1 rounded-md border border-destructive bg-white px-3 text-wb-14-tight font-medium text-destructive hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Trash2 className="size-4" strokeWidth={1.8} />
                                {t("settings.users.delete")}
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveEdit}
                                disabled={stickySaving}
                                className="flex h-8 cursor-pointer items-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {t("settings.users.save")}
                            </button>
                        </div>
                    ) : selectedUser && effectiveTab === "info" ? (
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

            {/* Body */}
            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[360px_1fr]">
                <UsersListPanel
                    users={filteredUsers}
                    selectedUserId={selectedUserId}
                    isAddingUser={isAddingUser}
                    onSelectUser={handleSelectUser}
                    onAddUser={handleStartAddUser}
                />
                <div className="flex min-h-0 flex-col border-wb-ntrl-4 md:border-l max-md:border-t">
                    {isAddingUser ? (
                        effectiveTab === "info" ? (
                            <AddUserInfoForm ref={addFormRef} />
                        ) : (
                            // Entitlements for a not-yet-created user
                            // would need a follow-up PUT after the
                            // POST. Out of scope: keep this tab in
                            // view mode during Add — entitlements are
                            // edited after creation.
                            <UserMenuEntitlementPanel />
                        )
                    ) : selectedUser ? (
                        effectiveTab === "info" ? (
                            isEditing ? (
                                <EditUserInfoForm
                                    key={selectedUser.id}
                                    ref={editFormRef}
                                    user={selectedUser}
                                    onAvatarChange={(next) =>
                                        setUsers((prev) =>
                                            prev.map((u) =>
                                                u.id === next.id ? next : u,
                                            ),
                                        )
                                    }
                                />
                            ) : (
                                <UserDetailView user={selectedUser} />
                            )
                        ) : (
                            <UserMenuEntitlementPanel
                                key={selectedUser.id}
                                user={selectedUser}
                            />
                        )
                    ) : (
                        <UsersEmptyState loading={stickyLoading} />
                    )}
                </div>
            </div>
        </div>
    );
}

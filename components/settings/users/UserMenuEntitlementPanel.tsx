"use client";

import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useState,
} from "react";

import { useDialog } from "@/components/shared/dialog";
import { ApiCallError } from "@/lib/api/banking";
import { fetchMenuEntitlement } from "@/lib/api/userManagement";
import { useTranslation } from "@/lib/i18n";

import MenuEntitlementRow from "./MenuEntitlementRow";
import MenuEntitlementSection from "./MenuEntitlementSection";
import { ENTITLEMENT_SECTIONS, type EntitlementSection } from "./mockMenuEntitlements";
import type { SettingsUser } from "./types";

type UserMenuEntitlementPanelProps = {
    /** Currently used only for the aria-label so screen readers know
     *  whose entitlements are on screen plus the user id the fetch
     *  call targets. Optional so the same panel can render in
     *  add-user mode (no selected user yet) — entitlements are saved
     *  AFTER the user is created. */
    user?: SettingsUser;
    /** Toggles the panel between view (disabled checkboxes) and
     *  edit (interactive). Owned by the parent `<UsersPanel>` toolbar. */
    isEditing?: boolean;
};

/** Imperative handle exposed by the panel so the parent toolbar can
 *  read the current draft set on Save. Returns null when no fetch has
 *  completed (add mode) or the panel is in view mode. */
export type MenuEntitlementPanelHandle = {
    collect(): string[] | null;
};

/**
 * Menu Entitlement detail body — Figma 142:22279.
 *
 * Three-column grid: [category 220 px] · [item label 1 fr] · [checkbox auto].
 * The grid is shared across the top "Allow full menu access" row, every
 * section header (Banking / Payment / Add-on Service / Settings), and
 * every group's sub-item rows — so all checkboxes line up in one
 * vertical column on the right edge regardless of nesting depth.
 *
 * Wire backing — Spring `MenuEntitlementService`:
 *   · GET  /api/v1/settings/users/{user_id}/menu-entitlement
 *   · PUT  /api/v1/settings/users/{user_id}/menu-entitlement
 *
 * Y-only storage: the wire response carries only the GRANTED slugs;
 * the panel builds a `Set<string>` and renders each row's checked
 * state by membership. Save (parent Save in edit mode) collects the
 * draft via the imperative handle and PUTs the full list.
 */
const UserMenuEntitlementPanel = forwardRef<
    MenuEntitlementPanelHandle,
    UserMenuEntitlementPanelProps
>(function UserMenuEntitlementPanel({ user, isEditing = false }, handleRef) {
    const { t } = useTranslation();
    const dialog = useDialog();
    // Initial draft is empty so add-mode (no user) renders immediately
    // without a fetch round-trip and the load effect can confine its
    // setState calls to async callbacks (react-hooks/set-state-in-effect).
    const [draft, setDraft] = useState<Set<string>>(() => new Set());

    useImperativeHandle(handleRef, () => ({
        collect(): string[] {
            return Array.from(draft);
        },
    }));

    // Pre-compute the full set of item slugs once — used by the top
    // "Allow full menu access" row to flip every grant in one click.
    const allItemIds = useMemo(
        () =>
            ENTITLEMENT_SECTIONS.flatMap((section) =>
                section.groups.flatMap((g) => g.items.map((i) => i.id)),
            ),
        [],
    );

    // Load entitlements whenever the selected user changes. Synchronous
    // setState inside the effect body is forbidden by
    // `react-hooks/set-state-in-effect`, so every state mutation here
    // runs inside an async callback — the empty-state case is already
    // covered by the lazy initial value above.
    const userId = user?.loginId;
    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        fetchMenuEntitlement(userId)
            .then((res) => {
                if (cancelled) return;
                setDraft(new Set(res.menu_auth_cds));
            })
            .catch((err) => {
                if (cancelled) return;
                const code = err instanceof ApiCallError ? err.code : "NETWORK";
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description:
                        err instanceof Error ? err.message : "Failed to load entitlements",
                    errorCode: code,
                });
                setDraft(new Set());
            });
        return () => {
            cancelled = true;
        };
    }, [userId, dialog, t]);

    const handleToggle = useCallback((itemId: string, checked: boolean) => {
        setDraft((prev) => {
            const next = new Set(prev);
            if (checked) next.add(itemId);
            else next.delete(itemId);
            return next;
        });
    }, []);

    const handleSectionToggle = useCallback(
        (section: EntitlementSection, checked: boolean) => {
            setDraft((prev) => {
                const next = new Set(prev);
                for (const group of section.groups) {
                    for (const item of group.items) {
                        if (checked) next.add(item.id);
                        else next.delete(item.id);
                    }
                }
                return next;
            });
        },
        [],
    );

    const handleAllToggle = useCallback(
        (checked: boolean) => {
            setDraft(() => (checked ? new Set(allItemIds) : new Set()));
        },
        [allItemIds],
    );

    const editable = isEditing;
    const allGranted = allItemIds.every((id) => draft.has(id));

    return (
        <div
            className="custom-scrollbar-y flex min-h-0 flex-1 flex-col overflow-y-auto p-6"
            aria-label={
                user
                    ? t("settings.users.menu.aria_panel", { name: user.name })
                    : t("settings.users.menu.aria_panel_new")
            }
        >
            <div className="grid w-full grid-cols-[220px_1fr_auto]">
                <MenuEntitlementRow
                    label={t("settings.users.menu.allow_full_access")}
                    checked={allGranted}
                    onCheckedChange={editable ? handleAllToggle : undefined}
                    disabled={!editable}
                />
                {ENTITLEMENT_SECTIONS.map((section) => (
                    <MenuEntitlementSection
                        key={section.id}
                        section={section}
                        granted={draft}
                        onToggle={editable ? handleToggle : undefined}
                        onSectionToggle={editable ? handleSectionToggle : undefined}
                    />
                ))}
            </div>
        </div>
    );
});

export default UserMenuEntitlementPanel;

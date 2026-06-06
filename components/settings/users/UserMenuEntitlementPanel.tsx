"use client";

import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from "react";

import { useDialog } from "@/components/shared/dialog";
import { useNavigation } from "@/hooks/useNavigation";
import { ApiCallError } from "@/lib/api/banking";
import { fetchMenuEntitlement, saveMenuEntitlement } from "@/lib/api/userManagement";
import { useTranslation } from "@/lib/i18n";

import { buildEntitlementSections, type EntitlementSection } from "./entitlementTree";
import MenuEntitlementRow from "./MenuEntitlementRow";
import MenuEntitlementSection from "./MenuEntitlementSection";
import type { SettingsUser } from "./types";

type UserMenuEntitlementPanelProps = {
    /** Currently used only for the aria-label so screen readers know
     *  whose entitlements are on screen plus the user id the fetch
     *  call targets. Optional so the same panel can render in
     *  add-user mode (no selected user yet) — entitlements are saved
     *  AFTER the user is created. */
    user?: SettingsUser;
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
 * state by membership. Every toggle PUTs the full slug list
 * immediately — there is no Edit mode for this tab. The optimistic
 * UI rolls back on error and surfaces a system dialog. Add-user
 * mode (no user id yet) keeps checkboxes inert; entitlements are
 * granted AFTER the user is created.
 */
const UserMenuEntitlementPanel = forwardRef<
    MenuEntitlementPanelHandle,
    UserMenuEntitlementPanelProps
>(function UserMenuEntitlementPanel({ user }, handleRef) {
    const { t } = useTranslation();
    const dialog = useDialog();
    // Initial draft is empty so add-mode (no user) renders immediately
    // without a fetch round-trip and the load effect can confine its
    // setState calls to async callbacks (react-hooks/set-state-in-effect).
    const [draft, setDraft] = useState<Set<string>>(() => new Set());

    // `draftRef` mirrors `draft` synchronously so toggle handlers can
    // compute the next set OUTSIDE the setState updater. Firing the PUT
    // inside a setState updater is a side-effect-in-updater bug: React
    // StrictMode double-invokes updaters in dev, which fired two
    // identical PUTs and was a source of the concurrent-save race.
    const draftRef = useRef<Set<string>>(new Set());
    // Last set the server confirmed — the rollback target on error.
    const confirmedRef = useRef<Set<string>>(new Set());
    // Latest desired set awaiting save (coalesces rapid toggles) + an
    // in-flight guard so only ONE PUT is ever in flight per panel. This
    // serialises overlapping toggles into sequential PUTs instead of
    // concurrent ones.
    const pendingRef = useRef<Set<string> | null>(null);
    const savingRef = useRef(false);

    const applyDraft = useCallback((next: Set<string>) => {
        draftRef.current = next;
        setDraft(next);
    }, []);

    useImperativeHandle(handleRef, () => ({
        collect(): string[] {
            return Array.from(draft);
        },
    }));

    // The grantable universe is the resolved product navigation tree
    // (`GET /api/v1/navigation`) — an admin loads the full product tree, so an
    // H tenant has no Add-on / Daily Cash / Cash Flow / e-Invoice leaves and an
    // H admin can neither see nor grant them. The product-invariant Settings
    // section is appended by the builder (Settings is not in the nav tree).
    const nav = useNavigation();
    const sections = useMemo(
        () => buildEntitlementSections(nav.tree),
        [nav.tree],
    );

    // Pre-compute the full set of item slugs — used by the top "Allow full
    // menu access" row to flip every (product-scoped) grant in one click.
    const allItemIds = useMemo(
        () => sections.flatMap((section) => section.groups.flatMap((g) => g.items.map((i) => i.id))),
        [sections],
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
                const loaded = new Set(res.menu_auth_cds);
                confirmedRef.current = new Set(loaded);
                applyDraft(loaded);
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
                confirmedRef.current = new Set();
                applyDraft(new Set());
            });
        return () => {
            cancelled = true;
        };
    }, [userId, dialog, t, applyDraft]);

    // Serialised auto-save. Optimistic — the UI is flipped by the
    // caller; `commit` records the latest desired set and drains it one
    // PUT at a time. Only ONE request is ever in flight (savingRef), so
    // two quick toggles produce two SEQUENTIAL PUTs, never two
    // concurrent ones — removing the client side of the delete+insert
    // race. On error the UI rolls back to the last server-confirmed set.
    const pump = useCallback(async () => {
        // Single in-flight guard: if a drain loop is already running it
        // will pick up whatever `commit` queued, so a second entry is a
        // no-op. JS is single-threaded, so the loop-exit → savingRef=false
        // transition is atomic (no `await` between the final
        // `pendingRef === null` check and the reset), leaving no window
        // to strand a queued edit.
        if (!userId || savingRef.current) return;
        savingRef.current = true;
        try {
            while (pendingRef.current !== null) {
                const target = pendingRef.current;
                pendingRef.current = null;
                try {
                    await saveMenuEntitlement(userId, {
                        menu_auth_cds: Array.from(target),
                    });
                    confirmedRef.current = target;
                } catch (err) {
                    // Drop any queued edit and roll the UI back to the last
                    // confirmed server state so the panel stays consistent.
                    pendingRef.current = null;
                    applyDraft(new Set(confirmedRef.current));
                    const code = err instanceof ApiCallError ? err.code : "NETWORK";
                    dialog.open({
                        type: "error",
                        title: t("dialog.error"),
                        description:
                            err instanceof Error
                                ? err.message
                                : "Failed to update entitlements",
                        errorCode: code,
                    });
                    break;
                }
            }
        } finally {
            savingRef.current = false;
        }
    }, [userId, dialog, t, applyDraft]);

    const commit = useCallback(
        (next: Set<string>) => {
            if (!userId) return;
            pendingRef.current = next;
            void pump();
        },
        [userId, pump],
    );

    // Toggle handlers compute the next set from `draftRef` (always
    // current, even between renders for rapid clicks), update the UI,
    // then commit — the PUT is fired OUTSIDE the setState updater.
    const handleToggle = useCallback(
        (itemId: string, checked: boolean) => {
            const next = new Set(draftRef.current);
            if (checked) next.add(itemId);
            else next.delete(itemId);
            applyDraft(next);
            commit(next);
        },
        [applyDraft, commit],
    );

    const handleSectionToggle = useCallback(
        (section: EntitlementSection, checked: boolean) => {
            const next = new Set(draftRef.current);
            for (const group of section.groups) {
                for (const item of group.items) {
                    if (checked) next.add(item.id);
                    else next.delete(item.id);
                }
            }
            applyDraft(next);
            commit(next);
        },
        [applyDraft, commit],
    );

    const handleAllToggle = useCallback(
        (checked: boolean) => {
            const next = checked ? new Set(allItemIds) : new Set<string>();
            applyDraft(next);
            commit(next);
        },
        [allItemIds, applyDraft, commit],
    );

    // Add-user mode has no user id yet — checkboxes stay inert until
    // the user is created. Otherwise every checkbox is interactive
    // and saves on click.
    const editable = !!userId;
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
                {sections.map((section) => (
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

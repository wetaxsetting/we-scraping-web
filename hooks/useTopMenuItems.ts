"use client";

import { useMemo } from "react";

import {
    TOP_MENU_BY_KEY,
    topMenuItems,
    type TopMenuItem,
    type TopMenuKey,
} from "@/components/layout/topMenu";
import { useNavigation } from "@/hooks/useNavigation";
import { firstRouteInSubtree } from "@/lib/api/navigation";
import type { StoredUser } from "@/lib/auth/storage";
import { isSectionAllowed } from "@/lib/menuAuth";

/**
 * API navigation node id → top-menu presentation key. Settings is intentionally
 * absent: it is a modal trigger, not a navigation-tree node, so it is appended
 * separately and gated by its own section grant.
 */
const NODE_ID_TO_TOP_MENU_KEY: Record<string, TopMenuKey> = {
    banking: "banking",
    payment: "payment",
    "addon-service": "addon",
};

/**
 * Ordered top-menu items for the current session, sourced from the resolved
 * navigation tree (`GET /api/v1/navigation` via {@link useNavigation}) — the
 * same product-scoped, permission-filtered set the sidebar consumes (Phase 2).
 * Shared by the desktop `<Header>` top nav and the mobile `<Sidebar>` MENU
 * module switcher so both stay in lockstep.
 *
 * - **Modules** (Banking / Payment / Add-on Service) come from the tree's
 *   depth-0 nodes in `seq` order. An H tenant's tree omits Add-on, so it never
 *   appears; a module whose children are all ungranted collapses out
 *   server-side.
 * - **Settings** is not a tree node (it opens the Settings modal); it is
 *   appended last and gated by `isSectionAllowed("settings", …)` — unchanged
 *   behavior, `menuAuth` is not modified.
 * - **Preview / loading / error** fall back to the static list so the shell
 *   never renders a blank top nav (see inline notes).
 */
export function useTopMenuItems(user: StoredUser | null): TopMenuItem[] {
    const nav = useNavigation();

    return useMemo(() => {
        // Preview mode / no session: no JWT → no tree. Show the full static
        // module list, matching the pre-API behavior for `?preview=1`.
        if (!user) return topMenuItems;

        let modules: TopMenuItem[];
        if (nav.tree) {
            modules = [];
            for (const node of nav.tree.topMenus) {
                const key = NODE_ID_TO_TOP_MENU_KEY[node.id];
                const item = key ? TOP_MENU_BY_KEY[key] : undefined;
                if (!item) continue;
                // Land the module link on the first granted leaf route in the
                // resolved (permission-filtered) tree, not the static module
                // home. A user without the default leaf (e.g. Arthur holds
                // `payment-internal-transfer-scheduled` but not
                // `payment-approval-box`) would otherwise be bounced back to
                // Banking by the `isRouteAllowed` guard. The static `href` is
                // the fallback only when the subtree somehow carries no route
                // (it shouldn't — the backend collapses empty parents).
                const resolvedHref = firstRouteInSubtree(node) ?? item.href;
                modules.push(resolvedHref === item.href ? item : { ...item, href: resolvedHref });
            }
        } else {
            // Loading / error: fall back to the static modules filtered by the
            // section grant (pre-Phase-3 behavior) so the top nav isn't blank
            // while `/navigation` resolves. Reconciles to the product-scoped
            // set once the (cached) tree lands.
            modules = topMenuItems.filter(
                (item) => item.key !== "settings" && isSectionAllowed(item.key, user),
            );
        }

        const settings = isSectionAllowed("settings", user)
            ? [TOP_MENU_BY_KEY.settings]
            : [];
        return [...modules, ...settings];
    }, [nav.tree, user]);
}

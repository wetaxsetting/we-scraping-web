import { api } from "@/lib/axios";
import { ApiCallError } from "@/lib/api/banking";
import type {
    ApiMenuNode,
    ApiNavigationResponse,
    ApiResponse,
} from "@/lib/types/api";

/**
 * Navigation API client — `GET /api/v1/navigation`. Mirrors
 * `wecms-api/.../domain/navigation/controller/NavigationController.java`.
 *
 * The backend selects the product tree from the session's `prdt_type` (read
 * from the signed JWT, never a client param) and returns the **already
 * resolved** visible tree: `Product Tree ∩ grants` for a normal user, the
 * full product tree for an admin. The frontend renders it directly — the
 * permission intersection is the backend's job (`lib/menuAuth.ts` stays the
 * source of truth for route guards + the top-nav module switcher, unchanged).
 *
 * snake→camel translation is the boundary mapper below (this is the
 * navigation domain's boundary; kept local to avoid a cross-import cycle with
 * `lib/api/mappers.ts`).
 */

/** Camel in-memory node. Mirrors {@link ApiMenuNode} with semantic names. */
export interface MenuNode {
    id: string;
    permissionCd: string | null;
    parentId: string | null;
    depth: number;
    seq: number;
    label: string;
    route: string | null;
    icon: string | null;
    legacyMnuId: string | null;
    legacyWsvcId: string | null;
    children: MenuNode[];
}

export interface NavigationTree {
    productType: string;
    menuGroupId: string | null;
    topMenus: MenuNode[];
}

function toMenuNode(n: ApiMenuNode): MenuNode {
    return {
        id: n.id,
        permissionCd: n.permission_cd,
        parentId: n.parent_id,
        depth: n.depth,
        seq: n.seq,
        label: n.label,
        route: n.route,
        icon: n.icon,
        legacyMnuId: n.legacy_mnu_id,
        legacyWsvcId: n.legacy_wsvc_id,
        children: (n.children ?? []).map(toMenuNode),
    };
}

function toNavigationTree(res: ApiNavigationResponse): NavigationTree {
    return {
        productType: res.product_type,
        menuGroupId: res.menu_group_id,
        topMenus: (res.top_menus ?? []).map(toMenuNode),
    };
}

/**
 * Fetch the resolved navigation tree for the current session. Throws
 * {@link ApiCallError} on a business error / network failure so the caller
 * (the `useNavigation` hook) can degrade to an empty rail safely.
 */
export async function fetchNavigation(): Promise<NavigationTree> {
    try {
        const res = await api.get<ApiResponse<ApiNavigationResponse>>("/api/v1/navigation");
        const body = res.data;
        if (body.status.error || !body.data) {
            throw new ApiCallError(body.status.code, body.status.message);
        }
        return toNavigationTree(body.data);
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

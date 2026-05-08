/**
 * VAS Account panel — Figma 9194:8615 (Settings popup submenu).
 *
 * The table is a two-level tree: parent rows (3-digit code, e.g. 111 / 112 /
 * 113) own a set of child rows (4-digit code, e.g. 1111 / 1112). The flat
 * row list below carries `kind: "parent" | "child"` so the table renderer
 * can switch styling without holding a separate parent / child collection
 * (mirrors the canonical pattern from Chart of Accounts).
 */
export type VasAccountStatus = "active" | "inactive";

export type VasAccountRow =
    | {
        id: string;
        kind: "parent";
        vasCode: string;
        accountName: string;
        status: VasAccountStatus;
    }
    | {
        id: string;
        kind: "child";
        vasCode: string;
        accountName: string;
        parentCode: string;
        status: VasAccountStatus;
    };

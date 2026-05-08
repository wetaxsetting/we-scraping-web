/**
 * Static user list for the View Permission / Withdrawal Permission
 * dialogs (Figma 166:24840 / 166:25059). Shared between both popups —
 * each opens with its own initial selection state per the screenshot.
 */
export type PermissionUserType = "admin" | "user";

export type PermissionUser = {
    id: string;
    /** Display name (Korean in the Figma mock data). */
    name: string;
    userId: string;
    type: PermissionUserType;
    phone: string;
};

export const mockPermissionUsers: PermissionUser[] = [
    {
        id: "u1",
        name: "김세명",
        userId: "eyeflat@coocon.net",
        type: "admin",
        phone: "010-667-788",
    },
    {
        id: "u2",
        name: "노규훈",
        userId: "ngh@webcash.co.kr",
        type: "user",
        phone: "010-667-788",
    },
    {
        id: "u3",
        name: "홍길동",
        userId: "ngh@webcash.co.kr",
        type: "user",
        phone: "010-667-788",
    },
    {
        id: "u4",
        name: "신누리",
        userId: "ngh@webcash.co.kr",
        type: "user",
        phone: "010-667-788",
    },
    {
        id: "u5",
        name: "김경식",
        userId: "ikks@nav3er.com",
        type: "user",
        phone: "010-667-788",
    },
];

/**
 * Per-popup default selection / disabled state. Mirrors the Figma
 * mock — Admin is pre-locked (disabled checkbox, fixed visible state)
 * for one popup, the matching admin row is the actively-selected
 * highlighted row for the other.
 */
export type PermissionInitial = {
    selectedIds: ReadonlySet<string>;
    disabledIds: ReadonlySet<string>;
};

export const VIEW_PERMISSION_INITIAL: PermissionInitial = {
    selectedIds: new Set(["u1", "u2"]),
    disabledIds: new Set(["u1"]),
};

export const WITHDRAWAL_PERMISSION_INITIAL: PermissionInitial = {
    selectedIds: new Set(["u1", "u2"]),
    disabledIds: new Set(["u2"]),
};

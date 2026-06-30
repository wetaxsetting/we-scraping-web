/**
 * Users panel — Settings popup submenu (Figma 142:22998).
 *
 * In-memory types for the Settings > Users panel. Wire ↔ in-memory
 * translation happens once at the API boundary in `mapUserRow` /
 * `toCreateRequest` / `toUpdateRequest` (this file). Components never
 * see snake_case.
 */

import { avatarColorFor } from "@/lib/avatar";
import type {
    ApiUserMgmtCreateRequest,
    ApiUserMgmtRow,
    ApiUserMgmtUpdateRequest,
} from "@/lib/types/api";

// Re-exported from the shared module so existing imports from this file
// keep working; the canonical home is `@/lib/avatar` (used by every
// avatar surface — Users, Approval Line, Payment approval popup).
export { avatarColorFor, AVATAR_COLORS } from "@/lib/avatar";

export type UserRole = "admin" | "user";

export type SettingsUser = {
    id: string;
    /** Display name (no "(You)" suffix — the panel adds it for the current user). */
    name: string;
    email: string;
    role: UserRole;
    /**
     * Background colour for the avatar disc when no photo is wired yet.
     * Keeps the row colourful while the real avatar pipeline is missing.
     * Computed deterministically from `id` so the same user keeps the
     * same colour across renders / sessions.
     */
    avatarColor: string;
    /** Marks the row that represents the signed-in user. */
    isCurrentUser?: boolean;
    /** Telephone country dialling code without leading "+" (e.g. "84").
     *  Wire ships a free-form `clph_no` carrying the full number; the
     *  panel defaults the country code to the project's standard `"84"`
     *  until a real country picker lands. */
    phoneCountryCode: string;
    /** Telephone number, free-form per locale (e.g. "23 900 534"). */
    phoneNumber: string;
    /** Login ID — equal to `user_id` on the wire (USER_INFM PK). */
    loginId: string;
    /** Job title within the company (e.g. "Manager", "Accountant"). */
    position: string;
    /** Department / business unit (e.g. "Finance", "Operations"). */
    department: string;
    /** Streaming URL for the user's uploaded avatar, or null when the
     *  user has no avatar set. Wire shape:
     *  `/api/v1/settings/users/{user_id}/image?v=<save_file_nm>` —
     *  the `v=` cache-buster flips on every upload. The panel wraps
     *  the URL in a JWT-bearing Blob fetch so the bytes can hydrate
     *  an `<img src>` tag. */
    imageUrl: string | null;
};

/** Top tabs on the right detail panel. Static for the empty-state pass. */
export type UserDetailTabKey = "info" | "menu_entitlement";

/** Active-user count for the current tenant, shown in the panel
 *  subtitle. No plan cap — legacy JEX defines a 5-user limit but
 *  never throws it (verified by Grep across the full JEX source);
 *  the refactor preserves the unrestricted behaviour. */
export type UserListMeta = {
    totalCount: number;
};

/** Translate the wire row into the in-memory `SettingsUser` shape the
 *  panel renders. Splitting `clph_no` into country code + number is
 *  deferred until a real country picker lands — for now the whole
 *  string goes into `phoneNumber` and the country code defaults to "84". */
export function mapUserRow(row: ApiUserMgmtRow): SettingsUser {
    return {
        id:               row.user_id,
        name:             row.user_nm,
        email:            row.eml,
        role:             row.is_admin ? "admin" : "user",
        avatarColor:      avatarColorFor(row.user_id),
        isCurrentUser:    row.is_current_user,
        phoneCountryCode: "84",
        phoneNumber:      row.clph_no ?? "",
        loginId:          row.user_id,
        position:         row.posi_nm ?? "",
        department:       row.dept_nm ?? "",
        imageUrl:         row.user_img_url ?? null,
    };
}

/** Input the form collects (Add or Edit mode). Edit mode omits
 *  `loginId` (immutable) and may omit `password`. */
export type UserFormDraft = {
    fullName:    string;
    position:    string;
    department:  string;
    phoneCode:   string;
    phoneNumber: string;
    email:       string;
    loginId:     string;
    password:    string;
    setAsAdmin:  boolean;
};

/** Build the create-request wire body from a form draft. */
export function toCreateRequest(draft: UserFormDraft): ApiUserMgmtCreateRequest {
    return {
        user_id:      draft.loginId.trim(),
        user_pw:      draft.password,
        user_nm:      draft.fullName.trim(),
        eml:          draft.email.trim(),
        clph_no:      draft.phoneNumber.trim(),
        posi_nm:      draft.position.trim(),
        dept_nm:      draft.department.trim(),
        set_as_admin: draft.setAsAdmin,
    };
}

/** Build the update-request wire body. Empty password = "keep
 *  existing"; the backend leaves the hash untouched. */
export function toUpdateRequest(draft: UserFormDraft): ApiUserMgmtUpdateRequest {
    const body: ApiUserMgmtUpdateRequest = {
        user_nm:      draft.fullName.trim(),
        eml:          draft.email.trim(),
        clph_no:      draft.phoneNumber.trim(),
        posi_nm:      draft.position.trim(),
        dept_nm:      draft.department.trim(),
        set_as_admin: draft.setAsAdmin,
    };
    if (draft.password && draft.password.length > 0) {
        body.user_pw = draft.password;
    }
    return body;
}

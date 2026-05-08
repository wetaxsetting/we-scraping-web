/**
 * Users panel — Settings popup submenu (Figma 142:22998).
 *
 * Static UI types for the user-management screen: a left list of tenant
 * users (one Admin + N Users), an "Add a user" affordance, and a right
 * detail pane that flips between Info / Menu Entitlement tabs. Until the
 * tenant-user API lands, the list is sourced from `mockUsers.ts`.
 */

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
     */
    avatarColor: string;
    /** Marks the row that represents the signed-in user. */
    isCurrentUser?: boolean;
    /** Telephone country dialling code without leading "+" (e.g. "84"). */
    phoneCountryCode: string;
    /** Telephone number, free-form per locale (e.g. "23 900 534"). */
    phoneNumber: string;
    /** Login ID — typically equal to email but stored separately. */
    loginId: string;
    /** Job title within the company (e.g. "Manager", "Accountant"). */
    position: string;
    /** Department / business unit (e.g. "Finance", "Operations"). */
    department: string;
};

/** Top tabs on the right detail panel. Static for the empty-state pass. */
export type UserDetailTabKey = "info" | "menu_entitlement";

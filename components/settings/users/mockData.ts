import type { SettingsUser } from "./types";

/**
 * Static mock users — Figma 142:23110 / 142:23117 / 142:23124 (list rows)
 * + Figma 142:23223 (Admin detail view).
 *
 * Three rows mirror the Figma frame so the empty-state submenu reads
 * the same in-product. Avatar colours are soft pastels — the real
 * avatar pipeline (uploaded photos / Gravatar) plugs in later without
 * touching this seed. Phone / loginId fields are populated with the
 * Admin detail-view values from Figma 142:23396 / 142:23398; the two
 * non-admin rows reuse the same shape so the static UI keeps working
 * if the user clicks one of them.
 */
export const mockUsers: SettingsUser[] = [
    {
        id: "amatak-amrin",
        name: "Amatak Amrin",
        email: "amatakamrin@gmail.com",
        role: "admin",
        avatarColor: "#fae6e6",
        isCurrentUser: true,
        phoneCountryCode: "84",
        phoneNumber: "23 900 534",
        loginId: "nearytepy@gmail.com",
        position: "CEO",
        department: "Management",
    },
    {
        id: "brasat-baking",
        name: "Brasat Baking",
        email: "brasatbakong@gmail.com",
        role: "user",
        avatarColor: "#e6f0fa",
        phoneCountryCode: "84",
        phoneNumber: "23 900 534",
        loginId: "brasatbakong@gmail.com",
        position: "Accountant",
        department: "Finance",
    },
    {
        id: "khet-preahvihea",
        name: "Khet Preahvihea",
        email: "khetpreahvihear@gmail.com",
        role: "user",
        avatarColor: "#e9f5ee",
        phoneCountryCode: "84",
        phoneNumber: "23 900 534",
        loginId: "khetpreahvihear@gmail.com",
        position: "Manager",
        department: "Operations",
    },
];

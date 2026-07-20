const TOKEN_KEY    = "wecms_token";
const USER_KEY     = "wecms_user";
const SAVED_ID_KEY = "wecms_saved_user_id";

/**
 * In-memory user shape held in {@code wecms_user} localStorage. Field
 * names are camelCase with semantic full words (CTO directive 2026-05-08):
 * `userName` not `user_nm`, `langCode` not `lang_cd`, `companyName` not
 * `cmpn_nm`. The wire shape stays `user_id`/`user_nm`/`biz_key`/
 * `lang_cd`/`cmpn_nm` per the legacy column contract; translation to
 * this in-memory shape happens once at the auth boundary in
 * {@code lib/auth/client.ts#toStoredUser}.
 *
 * <p>{@link role} is the user's authority **within the currently
 * selected company** — {@code "ADMIN"} when the backend resolved a
 * BUSI_ADMN_INFM row for the (BIZ_KEY, USER_ID) pair at login finalize,
 * {@code "USER"} otherwise. The same person can be ADMIN at one
 * company and USER at another, so this field is per-session, not
 * per-account. Components should gate admin-only UI via this field
 * rather than guessing from {@link userName} / {@link userId}.
 *
 * <p>{@link productType} is the verbatim {@code BUSI_INFM.PRDT_TYPE}
 * letter for the active company, echoed from the JWT claim by
 * {@code /api/v1/auth/me}. Stored as a raw {@code string} so legacy
 * tenants on un-modelled letters round-trip cleanly; UI gating uses
 * {@link isProductType} from {@code lib/auth/client.ts} which checks
 * against {@link KNOWN_PRODUCT_TYPES}.
 *
 * <p><b>Security note.</b> {@code productType} drives UI display +
 * gating only. The backend never trusts a frontend-sent product type
 * outside the login response — see {@code wecms-api/CLAUDE.md
 * §Product-type rule}.
 */
export type UserRole = "ADMIN" | "USER";

/** Refactor-recognised product types. Other legacy letters are
 *  carried verbatim in {@link StoredUser#productType} but not in this
 *  union — code that branches on product type should use
 *  {@link KnownProductType}. */
export const KNOWN_PRODUCT_TYPES = ["F", "M", "H"] as const;
export type KnownProductType = typeof KNOWN_PRODUCT_TYPES[number];

export interface StoredUser {
    userId: string;
    userName: string;
    bizKey: string;
    langCode: string;
    companyName: string;
    role: UserRole;
    /** Raw {@code BUSI_INFM.PRDT_TYPE} letter for the active company
     *  (any legacy code, may be empty string when the company row
     *  carries no value). Use {@code isProductType(user, "H")} from
     *  {@code lib/auth/client.ts} for safe gating. */
    productType: string;
    /** Verbatim {@code BUSI_INFM.TAX_ID} for the active company —
     *  the user-facing company tax / business registration number
     *  rendered in the Lock Screen popup (Figma 83:12764). Empty
     *  string when the row carries no value. The internal
     *  {@link bizKey} is the WeCMS tenant identifier and must
     *  NEVER surface to the user; always use {@code taxId} for any
     *  identity card / re-auth chrome. */
    taxId: string;
    /** Menu Authorization (MENU-1). {@code allMenus = true} for admins
     *  (bypass — every menu visible). For a normal user it is false and
     *  {@link allowedMenuCds} holds the granted leaf slugs (e.g.
     *  {@code addon-einvoices-sales}) used by {@code lib/menuAuth.ts} to
     *  filter the top nav, sidebar, and routes. Populated from {@code
     *  /api/v1/auth/me}; the login response does not carry menus, so it
     *  is resolved on the dashboard's mount {@code fetchMe()}. */
    allMenus: boolean;
    allowedMenuCds: string[];
}

const hasWindow = (): boolean => typeof window !== "undefined";

/**
 * Presence-cookie lifetime (seconds). This cookie exists ONLY so the edge
 * proxy (`proxy.ts`, no access to localStorage) can gate protected routes
 * on "has this browser authenticated at all". It is deliberately NOT tied
 * to the JWT / session expiration: the authoritative signal that a session
 * is invalid is the backend **HTTP 401** (surfaced via the lock popup),
 * never this cookie's age.
 *
 * `null` → write a **session cookie** (no `Max-Age`): it survives every
 * navigation/reload within the browser session and is dropped when the
 * browser closes. That matches how the Axios Authorization header behaves —
 * it reads the token from localStorage, which also survives every
 * navigation/reload — so the proxy gate and the interceptor gate agree for
 * the whole browser session. The old fixed 1h `Max-Age` was the source of
 * the inconsistent popup: it expired the cookie on an independent clock, so
 * a soft-expired session redirected on navigation (proxy) but popped on XHR
 * (interceptor).
 *
 * Set a positive number ONLY if browser-restart persistence becomes an
 * approved product requirement — and keep it clearly distinct from the JWT
 * TTL. It must never be treated as the session-expiry timer.
 */
const TOKEN_COOKIE_MAX_AGE: number | null = null;

const writeTokenCookie = (token: string) => {
    if (!hasWindow()) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    const maxAge = TOKEN_COOKIE_MAX_AGE != null ? `; Max-Age=${TOKEN_COOKIE_MAX_AGE}` : "";
    document.cookie =
        `${TOKEN_KEY}=${encodeURIComponent(token)}; Path=/${maxAge}; SameSite=Lax${secure}`;
};

const clearTokenCookie = () => {
    if (!hasWindow()) return;
    document.cookie = `${TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
};

export const tokenStorage = {
    set(token: string) {
        if (hasWindow()) {
            window.localStorage.setItem(TOKEN_KEY, token);
            writeTokenCookie(token);
        }
    },
    get(): string | null {
        return hasWindow() ? window.localStorage.getItem(TOKEN_KEY) : null;
    },
    clear() {
        if (hasWindow()) {
            window.localStorage.removeItem(TOKEN_KEY);
            clearTokenCookie();
        }
    },
};

export const userStorage = {
    set(user: StoredUser) {
        if (hasWindow()) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    get(): StoredUser | null {
        if (!hasWindow()) return null;
        const raw = window.localStorage.getItem(USER_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw) as StoredUser;
        } catch {
            return null;
        }
    },
    clear() {
        if (hasWindow()) window.localStorage.removeItem(USER_KEY);
    },
};

export const savedIdStorage = {
    set(userId: string) {
        if (hasWindow()) window.localStorage.setItem(SAVED_ID_KEY, userId);
    },
    get(): string {
        return hasWindow() ? window.localStorage.getItem(SAVED_ID_KEY) ?? "" : "";
    },
    clear() {
        if (hasWindow()) window.localStorage.removeItem(SAVED_ID_KEY);
    },
};

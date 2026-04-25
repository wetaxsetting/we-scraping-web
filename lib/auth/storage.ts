const TOKEN_KEY    = "wecms_token";
const USER_KEY     = "wecms_user";
const SAVED_ID_KEY = "wecms_saved_user_id";

export interface StoredUser {
    USER_ID: string;
    USER_NM: string;
    BIZ_KEY: string;
    LANG_CD: string;
    CMPN_NM: string;
}

const hasWindow = (): boolean => typeof window !== "undefined";

/**
 * Mirror the auth token into a cookie so Next.js middleware (edge runtime,
 * no access to localStorage) can gate protected routes. The cookie is
 * non-HttpOnly on purpose: Axios reads the token from localStorage for the
 * Authorization header, and the middleware only needs to see whether the
 * caller is authenticated at all. Sprint 0 stays R&D-local, so same-site
 * Lax + a 1h max-age matches the default JWT TTL in the backend.
 */
const TOKEN_COOKIE_MAX_AGE = 60 * 60;

const writeTokenCookie = (token: string) => {
    if (!hasWindow()) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
        `${TOKEN_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=${TOKEN_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
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

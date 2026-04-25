import axios, { AxiosError } from "axios";
import { api } from "@/lib/axios";
import { tokenStorage, userStorage, type StoredUser } from "@/lib/auth/storage";
import type { ApiResponse, LoginResponseRec, MeResponseRec } from "@/lib/types/api";

export class LoginError extends Error {
    code: string;
    constructor(code: string, message: string) {
        super(message);
        this.code = code;
    }
}

export async function login(
    userId: string,
    userPw: string,
): Promise<LoginResponseRec> {
    try {
        const res = await api.post<ApiResponse<LoginResponseRec>>(
            "/api/v1/auth/login",
            { USER_ID: userId, USER_PW: userPw },
        );
        const body = res.data;
        if (body.COMMON_HEAD.ERROR || !body.REC) {
            throw new LoginError(body.COMMON_HEAD.CODE, body.COMMON_HEAD.MESSAGE);
        }
        return body.REC;
    } catch (err) {
        if (err instanceof LoginError) throw err;
        if (axios.isAxiosError(err)) {
            const ax = err as AxiosError<ApiResponse<unknown>>;
            const head = ax.response?.data?.COMMON_HEAD;
            if (head) throw new LoginError(head.CODE, head.MESSAGE);
            throw new LoginError("NETWORK", ax.message);
        }
        throw new LoginError("UNKNOWN", "Unexpected error");
    }
}

/**
 * Rehydrate the current session from the server of record. The dashboard
 * layout calls this on mount so sidebar/profile chrome reflects the live
 * user state rather than whatever happens to be sitting in localStorage
 * (which can drift if the token is revoked or rotated server-side).
 *
 * Throws {@link LoginError} on any failure; the layout handles that by
 * clearing local state and redirecting to `/login`.
 */
export async function fetchMe(): Promise<StoredUser> {
    try {
        const res  = await api.get<ApiResponse<MeResponseRec>>("/api/v1/auth/me");
        const body = res.data;
        if (body.COMMON_HEAD.ERROR || !body.REC) {
            throw new LoginError(body.COMMON_HEAD.CODE, body.COMMON_HEAD.MESSAGE);
        }
        return body.REC;
    } catch (err) {
        if (err instanceof LoginError) throw err;
        if (axios.isAxiosError(err)) {
            const ax   = err as AxiosError<ApiResponse<unknown>>;
            const head = ax.response?.data?.COMMON_HEAD;
            if (head) throw new LoginError(head.CODE, head.MESSAGE);
            throw new LoginError("NETWORK", ax.message);
        }
        throw new LoginError("UNKNOWN", "Unexpected error");
    }
}

/**
 * Sprint 0 logout: best-effort call to the backend for audit/symmetry,
 * then clear local auth state unconditionally. A network failure must
 * not leave the user stuck logged in on the client.
 *
 * Invariant: only auth-scoped keys (`wecms_token`, `wecms_user`) are cleared.
 * The i18n preference (`wecms_locale`, owned by LocaleProvider) and the
 * "Save ID" preference (`wecms_saved_user_id`, owned by savedIdStorage) are
 * user preferences, not auth state, and must survive logout so the login
 * page renders in the language the user last selected. Do NOT add
 * `localStorage.clear()` or remove the locale key here.
 */
export async function logout(): Promise<void> {
    try {
        await api.post<ApiResponse<null>>("/api/v1/auth/logout");
    } catch {
        // Swallow — client-side cleanup still runs below.
    } finally {
        tokenStorage.clear();
        userStorage.clear();
    }
}

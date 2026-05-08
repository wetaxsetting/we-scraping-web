import axios, { AxiosError } from "axios";
import { api } from "@/lib/axios";
import { tokenStorage, userStorage, type StoredUser } from "@/lib/auth/storage";
import type { ApiResponse, LoginResponseRec, MeResponseRec } from "@/lib/types/api";

/**
 * Typed error every auth call rejects with. Carries the backend
 * {@code status.code} + {@code status.message} when the server
 * responded, the original Axios message when the network failed, or
 * the JS-level error string when something local broke (TypeError on
 * an unexpected response shape, etc.). `traceId` is populated when
 * the server returned one — the LoginForm renders it verbatim in the
 * error dialog so the user can quote it back to support and ops can
 * grep the same id in server logs.
 */
export class LoginError extends Error {
    code: string;
    traceId?: string;
    constructor(code: string, message: string, traceId?: string) {
        super(message);
        this.code = code;
        this.traceId = traceId;
    }
}

/**
 * Translate the lowercase wire shape into the in-memory {@link StoredUser}
 * the rest of the frontend reads as semantic camelCase. The legacy column
 * abbreviations (`user_nm`, `lang_cd`, `cmpn_nm`) only live on the wire;
 * everything from the auth boundary inward sees `userName`, `langCode`,
 * `companyName`.
 */
function toStoredUser(rec: LoginResponseRec | MeResponseRec): StoredUser {
    return {
        userId:      rec.user_id,
        userName:    rec.user_nm,
        bizKey:      rec.biz_key,
        langCode:    rec.lang_cd,
        companyName: rec.cmpn_nm,
    };
}

/**
 * Convert any unexpected error into a {@link LoginError} that carries
 * useful diagnostic info instead of the legacy {@code UNKNOWN} +
 * {@code Unexpected error} fall-through. Three branches:
 * <ol>
 *   <li>The server responded — read {@code status.code} /
 *       {@code status.message} / {@code trace_id} verbatim.</li>
 *   <li>Network / no response — surface {@code WBE_NETWORK} +
 *       the Axios message.</li>
 *   <li>Local JS error (TypeError on a malformed response shape,
 *       etc.) — surface {@code WBE_CLIENT_PARSE} + the JS message
 *       so the dev console + dialog at least show what blew up.</li>
 * </ol>
 */
function toLoginError(err: unknown): LoginError {
    if (err instanceof LoginError) return err;
    if (axios.isAxiosError(err)) {
        const ax = err as AxiosError<ApiResponse<unknown>>;
        const head = ax.response?.data?.status;
        const traceId = ax.response?.data?.trace_id;
        if (head) return new LoginError(head.code, head.message, traceId);
        return new LoginError("WBE_NETWORK", ax.message || "Network error", traceId);
    }
    const message = err instanceof Error ? err.message : String(err ?? "Unknown error");
    if (typeof console !== "undefined") {
        console.error("[auth] Unexpected client-side error:", err);
    }
    return new LoginError("WBE_CLIENT_PARSE", message);
}

export async function login(
    userId: string,
    userPw: string,
): Promise<StoredUser & { access_token: string; expires_in: number }> {
    try {
        const res = await api.post<ApiResponse<LoginResponseRec>>(
            "/api/v1/auth/login",
            { user_id: userId, user_pw: userPw },
        );
        const body = res.data;
        if (!body || !body.status) {
            throw new LoginError(
                "WBE_CLIENT_PARSE",
                "Server returned an unexpected response shape (missing `status`).",
            );
        }
        if (body.status.error || !body.data) {
            throw new LoginError(body.status.code, body.status.message, body.trace_id);
        }
        const stored = toStoredUser(body.data);
        return {
            ...stored,
            access_token: body.data.access_token,
            expires_in: body.data.expires_in,
        };
    } catch (err) {
        throw toLoginError(err);
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
        if (!body || !body.status) {
            throw new LoginError(
                "WBE_CLIENT_PARSE",
                "Server returned an unexpected response shape (missing `status`).",
            );
        }
        if (body.status.error || !body.data) {
            throw new LoginError(body.status.code, body.status.message, body.trace_id);
        }
        return toStoredUser(body.data);
    } catch (err) {
        throw toLoginError(err);
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

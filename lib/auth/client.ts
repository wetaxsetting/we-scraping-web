import axios, { AxiosError } from "axios";
import { api } from "@/lib/axios";
import {
    KNOWN_PRODUCT_TYPES,
    tokenStorage,
    userStorage,
    type KnownProductType,
    type StoredUser,
    type UserRole,
} from "@/lib/auth/storage";
import type {
    ApiResponse,
    ChangePasswordRequestRec,
    CompanyOptionRec,
    LoginRequestRec,
    LoginResponseRec,
    MeResponseRec,
} from "@/lib/types/api";

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
 * One option the user can pick from the company-chooser screen. Mirrors
 * the wire shape ({@link CompanyOptionRec}) on its camelCase side.
 *
 * <p><b>Exceptional path.</b> Current WeCMS operation treats one user
 * as belonging to a single active company, so production logins
 * never hit the chooser — {@link CompanyChoice} only exists for the
 * rare case where a user has ≥ 2 active links. See
 * {@code wecms-api/CLAUDE.md} §"Operational model" for the rule.
 *
 * <p>{@link productType} carries the raw {@code BUSI_INFM.PRDT_TYPE}
 * letter for the option so the chooser UI can render a product label
 * (WeCMS / WeCMS Lumens / HAENGSUNG Electronics). It is display-only:
 * the JWT is only issued after the user finalises a company pick, so
 * any product-type-driven gating happens off the post-finalize
 * {@link StoredUser#productType}, never off this chooser value.
 */
export interface CompanyChoice {
    bizKey: string;
    companyName: string;
    role: UserRole;
    productType: string;
}

/** Result of {@link login}. Discriminated by {@code kind}:
 *  <ul>
 *    <li>{@code "authenticated"} — **normal production path**. The user
 *        has exactly one active company link; JWT is issued in the
 *        same call. The form persists the token + user and navigates
 *        to the dashboard.</li>
 *    <li>{@code "chooser"} — **exceptional path** for the rare user
 *        with ≥ 2 active company links. The form renders the company
 *        picker, then calls {@link login} again with the chosen
 *        {@link CompanyChoice#bizKey}. Current WeCMS operation does
 *        not treat this as a routine flow — see
 *        {@code wecms-api/CLAUDE.md} §"Operational model".</li>
 *  </ul>
 */
export type LoginResult =
    | {
          kind: "authenticated";
          stored: StoredUser;
          accessToken: string;
          expiresIn: number;
      }
    | {
          kind: "chooser";
          userId: string;
          userName: string;
          companies: CompanyChoice[];
      };

function normaliseRole(raw: string | undefined): UserRole {
    return raw === "ADMIN" ? "ADMIN" : "USER";
}

/** Trim + null-coalesce to empty string so {@link StoredUser#productType}
 *  is always a plain string (avoids `undefined`/`null` divergence in
 *  consumers). Unknown legacy letters are still preserved verbatim;
 *  use {@link isProductType} for safe gating. */
function normaliseProductType(raw: string | null | undefined): string {
    if (raw == null) return "";
    const trimmed = raw.trim();
    return trimmed;
}

/**
 * Translate an authenticated-shape login (or {@code /me}) response into
 * the in-memory {@link StoredUser}. The legacy column abbreviations
 * (`user_nm`, `lang_cd`, `cmpn_nm`, `auth_gr_cd`, `prdt_type`) only
 * live on the wire; everything from the auth boundary inward sees
 * `userName`, `langCode`, `companyName`, `role`, `productType`.
 */
function toStoredUser(rec: LoginResponseRec | MeResponseRec): StoredUser {
    const role = normaliseRole(rec.auth_gr_cd);
    // Menu Authorization (MENU-1) is only on the /me shape; the login
    // response carries no menus. When absent (login), default an admin
    // to allMenus=true and a normal user to an empty grant set — the
    // dashboard's mount fetchMe() then fills in the real grants before
    // menus render, so the empty interim is never displayed.
    const menuRec = rec as Partial<MeResponseRec>;
    return {
        userId:      rec.user_id,
        userName:    rec.user_nm,
        bizKey:      rec.biz_key ?? "",
        langCode:    rec.lang_cd ?? "EN",
        companyName: rec.cmpn_nm ?? "",
        role,
        productType: normaliseProductType(rec.prdt_type),
        taxId:       rec.tax_id ?? "",
        allMenus:    menuRec.all_menus ?? (role === "ADMIN"),
        allowedMenuCds: menuRec.allowed_menu_cds ?? [],
    };
}

function toCompanyChoice(rec: CompanyOptionRec): CompanyChoice {
    return {
        bizKey:      rec.biz_key,
        companyName: rec.cmpn_nm,
        role:        normaliseRole(rec.auth_gr_cd),
        productType: normaliseProductType(rec.prdt_type),
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

/**
 * Two-step login. The backend resolves the tenant from
 * USER_BUSI_CONN_INFM:
 *
 * <ul>
 *   <li>If the user has exactly one active link, the JWT is issued
 *       in the same call and the result is {@code {kind:
 *       "authenticated"}}.</li>
 *   <li>If the user has two or more active links and {@code bizKey}
 *       is omitted, the backend returns the available companies and
 *       no token. Result is {@code {kind: "chooser"}}; the caller
 *       renders the picker and re-invokes {@link login} with the
 *       same credentials plus the chosen {@code bizKey}.</li>
 *   <li>Wrong / unknown {@code bizKey} → backend returns
 *       {@code WBE1009} (LoginError, same path as bad credentials).</li>
 * </ul>
 *
 * The frontend never invents a BIZ_KEY — it only sends back values
 * the backend itself listed in {@code companies_available}.
 */
export async function login(
    userId: string,
    userPw: string,
    bizKey?: string,
): Promise<LoginResult> {
    try {
        const body: LoginRequestRec = bizKey
            ? { user_id: userId, user_pw: userPw, biz_key: bizKey }
            : { user_id: userId, user_pw: userPw };
        const res = await api.post<ApiResponse<LoginResponseRec>>(
            "/api/v1/auth/login",
            body,
        );
        const env = res.data;
        if (!env || !env.status) {
            throw new LoginError(
                "WBE_CLIENT_PARSE",
                "Server returned an unexpected response shape (missing `status`).",
            );
        }
        if (env.status.error || !env.data) {
            throw new LoginError(env.status.code, env.status.message, env.trace_id);
        }

        const payload = env.data;
        // Chooser branch — backend returned the list of companies and no token.
        if (payload.companies_available && payload.companies_available.length > 0
                && !payload.access_token) {
            return {
                kind: "chooser",
                userId:   payload.user_id,
                userName: payload.user_nm,
                companies: payload.companies_available.map(toCompanyChoice),
            };
        }

        // Authenticated branch — token + tenant fields present.
        if (!payload.access_token) {
            throw new LoginError(
                "WBE_CLIENT_PARSE",
                "Login response had neither `access_token` nor `companies_available`.",
            );
        }
        return {
            kind: "authenticated",
            stored: toStoredUser(payload),
            accessToken: payload.access_token,
            expiresIn: payload.expires_in ?? 0,
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

/**
 * Self-service password change for the logged-in user.
 * {@code POST /api/v1/auth/change-password}.
 *
 * <p>Wire body is snake_case ({@link ChangePasswordRequestRec}); the
 * caller passes the camelCase form values and this boundary translates.
 * Resolves on success; rejects with {@link LoginError} carrying the
 * backend {@code status.code} on any failure so the caller can surface
 * the standard error dialog. Notable codes:
 * <ul>
 *   <li>{@code WBE2091} — current password is wrong
 *       ("Password confirmation failed.").</li>
 *   <li>{@code WBE_CHANGE_PASSWORD_MISMATCH} — new ≠ confirm (server-side
 *       backstop; the frontend zod schema catches this first).</li>
 *   <li>{@code WBE_CHANGE_PASSWORD_REUSED} — password used within the
 *       last 3 changes.</li>
 *   <li>{@code WBE_VALIDATION} — a required field was blank.</li>
 * </ul>
 */
export async function changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
): Promise<void> {
    try {
        const body: ChangePasswordRequestRec = {
            current_password: currentPassword,
            new_password: newPassword,
            confirm_password: confirmPassword,
        };
        const res = await api.post<ApiResponse<null>>(
            "/api/v1/auth/change-password",
            body,
        );
        const env = res.data;
        if (!env || !env.status) {
            throw new LoginError(
                "WBE_CLIENT_PARSE",
                "Server returned an unexpected response shape (missing `status`).",
            );
        }
        if (env.status.error) {
            throw new LoginError(env.status.code, env.status.message, env.trace_id);
        }
    } catch (err) {
        throw toLoginError(err);
    }
}

/** Convenience predicate used by admin-gated UI. Reads the current
 *  StoredUser; returns false when no user is signed in or when the
 *  user's role at the active company is USER. */
export function isAdmin(user: StoredUser | null | undefined): boolean {
    return user?.role === "ADMIN";
}

/**
 * Type-safe gate for product-type-aware UI. Returns true only when
 * the user's active company has the given known product type
 * (one of {@code "F"} / {@code "M"} / {@code "H"}). Use this in
 * components instead of comparing {@code user.productType} to a raw
 * string — the helper restricts {@code code} to the recognised set,
 * so a typo (`"f"`, `"X"`) is a TypeScript error at the call site
 * rather than a silent always-false at runtime.
 *
 * <p>Returns false for any deferred legacy letter (the 11 codes not
 * in {@link KNOWN_PRODUCT_TYPES}) so screens that gate on F / M / H
 * degrade safely when a future tenant ships an un-modelled product
 * type.
 *
 * <p><b>Security note.</b> Product-type gating on the frontend is for
 * UX only. The backend enforces tenant + product-type security via
 * the signed JWT — never trust a {@code productType} value the user
 * could have edited in localStorage as anything more than a display
 * hint.
 */
export function isProductType(
    user: StoredUser | null | undefined,
    code: KnownProductType,
): boolean {
    if (!user) return false;
    if (!(KNOWN_PRODUCT_TYPES as readonly string[]).includes(user.productType)) {
        return false;
    }
    return user.productType === code;
}

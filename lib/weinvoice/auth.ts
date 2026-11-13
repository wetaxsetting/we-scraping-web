"use client";

import axios from "axios";

import { api } from "@/lib/axios";
import { tokenStorage, userStorage, type StoredUser } from "@/lib/auth/storage";
import type { ApiResponse, CompanyOptionRec, LoginResponseRec, MeResponseRec } from "@/lib/types/api";

/**
 * Real authentication against the backend (`/api/v1/auth/*`, contract verified
 * against `we-scraping-api` source — see
 * docs/features/weinvoice/weinvoice-api-integration-2026-11-03.md).
 *
 * The JWT goes through the shared `tokenStorage` (localStorage + the
 * `wecms_token` presence cookie that `proxy.ts` gates on); the user profile
 * through `userStorage` (`wecms_user`). Translation snake_case → camelCase
 * happens here, once.
 */
export type Session = { userId: string; name: string; companyName: string; taxId: string; role: "ADMIN" | "USER" };

export class AuthError extends Error {
    constructor(
        public code: string,
        message: string,
        public traceId?: string,
    ) {
        super(message);
    }
}

export type CompanyChoice = { bizKey: string; companyName: string };

export type LoginResult = { kind: "authenticated" } | { kind: "chooser"; companies: CompanyChoice[] };

function toStoredUser(rec: LoginResponseRec | MeResponseRec): StoredUser {
    const role = rec.auth_gr_cd === "ADMIN" ? "ADMIN" : "USER";
    const me = rec as Partial<MeResponseRec>;
    return {
        userId: rec.user_id,
        userName: rec.user_nm,
        bizKey: rec.biz_key ?? "",
        langCode: rec.lang_cd ?? "VI",
        companyName: rec.cmpn_nm ?? "",
        role,
        productType: (rec.prdt_type ?? "").trim(),
        taxId: rec.tax_id ?? "",
        allMenus: me.all_menus ?? role === "ADMIN",
        allowedMenuCds: me.allowed_menu_cds ?? [],
    };
}

/** Error envelope → AuthError; no response → WBE_NETWORK; anything else → WBE_CLIENT_PARSE. */
function toAuthError(err: unknown): AuthError {
    if (err instanceof AuthError) return err;
    if (axios.isAxiosError(err)) {
        const body = err.response?.data as ApiResponse<unknown> | undefined;
        if (body?.status) return new AuthError(body.status.code, body.status.message, body.trace_id);
        return new AuthError("WBE_NETWORK", err.message || "Network error");
    }
    return new AuthError("WBE_CLIENT_PARSE", err instanceof Error ? err.message : String(err));
}

function unwrap<T>(body: ApiResponse<T> | undefined): T {
    if (!body?.status) throw new AuthError("WBE_CLIENT_PARSE", "Unexpected response shape (missing `status`).");
    if (body.status.error || body.data === undefined) throw new AuthError(body.status.code, body.status.message, body.trace_id);
    return body.data;
}

/**
 * First call: `user_id` + `user_pw`. A user linked to several companies gets
 * `{ kind: "chooser" }`; call again with the chosen `bizKey` to finish.
 */
export async function login(userId: string, password: string, bizKey?: string): Promise<LoginResult> {
    try {
        const res = await api.post<ApiResponse<LoginResponseRec>>("/api/v1/auth/login", {
            user_id: userId,
            user_pw: password,
            ...(bizKey ? { biz_key: bizKey } : {}),
        });
        const data = unwrap(res.data);
        if (!data.access_token) {
            const companies = (data.companies_available ?? []).map((c: CompanyOptionRec) => ({ bizKey: c.biz_key, companyName: c.cmpn_nm }));
            if (companies.length === 0) throw new AuthError("WBE_CLIENT_PARSE", "Login response had neither `access_token` nor `companies_available`.");
            return { kind: "chooser", companies };
        }
        tokenStorage.set(data.access_token);
        userStorage.set(toStoredUser(data));
        return { kind: "authenticated" };
    } catch (err) {
        throw toAuthError(err);
    }
}

export type SignupInput = { email: string; name: string; password: string; phone?: string; companyName?: string };

/**
 * WeInvoice self sign-up (`POST /api/v1/auth/signup`, public). The backend creates a WeInvoice-owned account and
 * signs it in — the response is a login response, stored the same way.
 * Backend record: we-scraping-api docs/features/addon-service/weinvoice/weinvoice-self-signup-2026-11-13.md
 */
export async function signup(input: SignupInput): Promise<void> {
    try {
        const res = await api.post<ApiResponse<LoginResponseRec>>("/api/v1/auth/signup", {
            email: input.email.trim(),
            user_nm: input.name.trim(),
            user_pw: input.password,
            ...(input.phone?.trim() ? { clph_no: input.phone.trim() } : {}),
            ...(input.companyName?.trim() ? { cmpn_nm: input.companyName.trim() } : {}),
        });
        const data = unwrap(res.data);
        if (!data.access_token) throw new AuthError("WBE_CLIENT_PARSE", "Sign-up response had no `access_token`.");
        tokenStorage.set(data.access_token);
        userStorage.set(toStoredUser(data));
    } catch (err) {
        throw toAuthError(err);
    }
}

/** Rehydrate the profile from the server of record; throws AuthError when the token is no longer valid. */
export async function fetchMe(): Promise<void> {
    try {
        const res = await api.get<ApiResponse<MeResponseRec>>("/api/v1/auth/me");
        userStorage.set(toStoredUser(unwrap(res.data)));
    } catch (err) {
        throw toAuthError(err);
    }
}

/** Server-side revoke (best effort), then clear only the auth keys — `wecms_locale` survives. */
export async function logout(): Promise<void> {
    try {
        await api.post("/api/v1/auth/logout");
    } catch {
        /* already invalid — local cleanup below still runs */
    } finally {
        tokenStorage.clear();
        userStorage.clear();
    }
}

export const session = {
    get(): Session | null {
        if (!tokenStorage.get()) return null;
        const u = userStorage.get();
        return u ? { userId: u.userId, name: u.userName, companyName: u.companyName, taxId: u.taxId, role: u.role } : null;
    },
    /** Local-only cleanup (used when the server already rejected the token). */
    clear() {
        tokenStorage.clear();
        userStorage.clear();
    },
};

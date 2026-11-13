import axios, { type AxiosError } from "axios";

import { tokenStorage, userStorage } from "@/lib/auth/storage";

/**
 * Shared HTTP transport for the backend (`NEXT_PUBLIC_API_BASE_URL`).
 *
 *  - Request: `Authorization: Bearer <token>` from `wecms_token`, and
 *    `Accept-Language` from the active locale so `WBExxxx` messages come back
 *    in VI / EN / KO.
 *  - Response: a 401 on any non-auth endpoint means the session is gone —
 *    clear the local session and go to `/login?next=…`. Auth endpoints return
 *    their own 401s to the caller (wrong password, expired token on /me).
 */
const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export const api = axios.create({
    baseURL,
    headers: { "Content-Type": "application/json" },
});

const LANG_HEADER: Record<string, string> = { VI: "vi", EN: "en", KO: "ko" };

api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = tokenStorage.get();
        if (token) config.headers.Authorization = `Bearer ${token}`;
        try {
            const locale = window.localStorage.getItem("wecms_locale") ?? "VI";
            config.headers["Accept-Language"] = LANG_HEADER[locale] ?? "vi";
        } catch {
            /* storage blocked — server default language */
        }
    }
    return config;
});

const AUTH_PATHS = ["/api/v1/auth/login", "/api/v1/auth/signup", "/api/v1/auth/logout", "/api/v1/auth/me"];

api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        const url = error.config?.url ?? "";
        if (error.response?.status === 401 && !AUTH_PATHS.some((p) => url.endsWith(p)) && typeof window !== "undefined") {
            tokenStorage.clear();
            userStorage.clear();
            const next = `${window.location.pathname}${window.location.search}`;
            window.location.replace(`/login?next=${encodeURIComponent(next)}`);
        }
        return Promise.reject(error);
    },
);

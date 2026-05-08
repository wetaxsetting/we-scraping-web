import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { requestReAuth } from "@/lib/auth/sessionExpired";

const baseURL =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export const api = axios.create({
    baseURL,
    headers: { "Content-Type": "application/json" },
});

// Attach the JWT from localStorage (browser only) so subsequent calls are
// authenticated once the user has logged in.
api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = window.localStorage.getItem("wecms_token");
        if (token) {
            config.headers = config.headers ?? {};
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

/**
 * 401 / session-expired handling. When any authenticated call returns
 * HTTP 401 we surface the global `<SessionExpiredDialog>` (via the
 * `requestReAuth` bus) and — on success — retry the original request
 * once with the freshly-issued token. Auth endpoints themselves are
 * skipped so a wrong-password attempt inside the dialog (which calls
 * `/api/v1/auth/login` and may legitimately return 401) does not loop.
 *
 * `_isRetry` is set on the retried request so a second 401 falls
 * through to the caller instead of opening the dialog again — that way
 * a permanently broken token still surfaces the original error.
 */

const AUTH_PATHS = [
    "/api/v1/auth/login",
    "/api/v1/auth/logout",
    "/api/v1/auth/me",
];

type RetryableConfig = InternalAxiosRequestConfig & { _isRetry?: boolean };

function isAuthEndpoint(url: string | undefined): boolean {
    if (!url) return false;
    return AUTH_PATHS.some((p) => url === p || url.endsWith(p));
}

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const status = error.response?.status;
        const config = error.config as RetryableConfig | undefined;
        if (
            status !== 401 ||
            !config ||
            config._isRetry ||
            isAuthEndpoint(config.url)
        ) {
            return Promise.reject(error);
        }

        const outcome = await requestReAuth();
        if (outcome !== "re_authenticated") {
            return Promise.reject(error);
        }

        // Re-issue with the new token (request interceptor reads it from
        // localStorage on every call, so just flag and resend).
        config._isRetry = true;
        return api.request(config);
    },
);

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
 * 401 / session-expired handling. The lock popup is for the
 * **active-usage** case only (confirmed requirement §1): while the app
 * is already loaded and the user is working, an in-page API call that
 * returns HTTP 401 surfaces the global `<SessionExpiredDialog>` (via the
 * `requestReAuth` bus) and — on success — retries the original request
 * once with the freshly-issued token, so the user resumes on the same
 * screen.
 *
 * Excluded endpoints never open the popup:
 *  - `/api/v1/auth/login` + `/api/v1/auth/logout` — a wrong-password
 *    attempt inside the popup calls `/login` and legitimately 401s on
 *    bad credentials; opening the popup on it would recurse.
 *  - `/api/v1/auth/me` — the page-load / reload rehydration call, fired
 *    only by the dashboard layout at mount. A 401 here means the session
 *    was already invalid when the page loaded (F5, reload, reopen, direct
 *    navigation). Per the confirmed requirement (§2) that case redirects
 *    cleanly to `/login` and does NOT show the popup, so it is left to the
 *    layout's catch handler. Excluding /me is exactly what makes
 *    reload → /login while in-page → popup.
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

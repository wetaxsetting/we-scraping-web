/**
 * HTTP helpers for the WeInvoice endpoints (`/api/v1/weinvoice/*`) — used only when
 * DATA_SOURCE === "api". Built on the shared transport (`lib/axios.ts`: Bearer token,
 * Accept-Language, 401 → /login).
 *
 *  - JSON calls unwrap the `ApiResponse` envelope (`status.error`, not the HTTP code, decides).
 *  - Failures become `WeInvoiceApiError` with the backend code, `HTTP_<n>` when the body is not an
 *    envelope (e.g. an endpoint that does not exist yet), or `WBE_NETWORK` when nothing came back.
 *  - Engine jobs return `request_id`; `waitForRequest` polls `GET /requests/{request_id}`.
 */
import axios, { type AxiosRequestConfig } from "axios";

import { api } from "@/lib/axios";
import type { ApiResponse } from "@/lib/types/api";
import { camelize, snakify } from "@/lib/api/weinvoice/wire";
import { sleep } from "@/lib/utils";

export const WEINVOICE_BASE = "/api/v1/weinvoice";

export class WeInvoiceApiError extends Error {
    constructor(
        public code: string,
        message: string,
        public traceId?: string,
    ) {
        super(message);
    }
}

export function toApiError(err: unknown): WeInvoiceApiError {
    if (err instanceof WeInvoiceApiError) return err;
    if (axios.isAxiosError(err)) {
        const env = err.response?.data as ApiResponse<unknown> | undefined;
        if (env && typeof env === "object" && env.status) return new WeInvoiceApiError(env.status.code, env.status.message, env.trace_id);
        if (err.response) return new WeInvoiceApiError(`HTTP_${err.response.status}`, err.message);
        return new WeInvoiceApiError("WBE_NETWORK", err.message || "Network error");
    }
    return new WeInvoiceApiError("WBE_CLIENT_PARSE", err instanceof Error ? err.message : String(err));
}

function unwrap<T>(body: ApiResponse<T> | undefined, allowEmpty = false): T {
    if (!body || typeof body !== "object" || !body.status) throw new WeInvoiceApiError("WBE_CLIENT_PARSE", "Unexpected response shape (missing `status`).");
    if (body.status.error) throw new WeInvoiceApiError(body.status.code, body.status.message, body.trace_id);
    if (body.data === undefined && !allowEmpty) throw new WeInvoiceApiError("WBE_CLIENT_PARSE", "Response has no `data`.");
    return body.data as T;
}

type Method = "get" | "post" | "put" | "patch" | "delete";

/** Blob → text; falls back to FileReader where `Blob.text()` is missing (older engines, jsdom). */
const readText = (b: Blob): Promise<string> =>
    typeof b.text === "function"
        ? b.text()
        : new Promise((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve(String(r.result));
              r.onerror = () => reject(r.error);
              r.readAsText(b);
          });

/**
 * JSON request. `params` / `body` are given in UI camelCase and sent snake_case; the response
 * `data` comes back camelCased. Pass `raw: true` to skip key conversion of the response.
 */
export async function wiRequest<T>(method: Method, path: string, opts: { params?: object; body?: unknown; raw?: boolean; allowEmpty?: boolean } = {}): Promise<T> {
    try {
        const config: AxiosRequestConfig = { method, url: `${WEINVOICE_BASE}${path}`, params: opts.params ? snakify(opts.params) : undefined, data: opts.body !== undefined ? snakify(opts.body) : undefined };
        const res = await api.request<ApiResponse<unknown>>(config);
        const data = unwrap(res.data, opts.allowEmpty);
        return (opts.raw ? data : camelize(data)) as T;
    } catch (err) {
        throw toApiError(err);
    }
}

export const wiGet = <T>(path: string, params?: object) => wiRequest<T>("get", path, { params });
export const wiPost = <T>(path: string, body?: unknown, params?: object) => wiRequest<T>("post", path, { body, params, allowEmpty: true });
export const wiPut = <T>(path: string, body?: unknown) => wiRequest<T>("put", path, { body, allowEmpty: true });
export const wiPatch = <T>(path: string, body?: unknown) => wiRequest<T>("patch", path, { body, allowEmpty: true });
export const wiDelete = <T>(path: string) => wiRequest<T>("delete", path, { allowEmpty: true });

/** Multipart upload (field names are sent exactly as given). Response `data` is camelCased. */
export async function wiUpload<T>(path: string, form: FormData): Promise<T> {
    try {
        const res = await api.post<ApiResponse<unknown>>(`${WEINVOICE_BASE}${path}`, form, { headers: { "Content-Type": "multipart/form-data" } });
        return camelize(unwrap(res.data, true)) as T;
    } catch (err) {
        throw toApiError(err);
    }
}

/**
 * Binary download (`Content-Disposition` filename). A JSON error envelope sent with a blob
 * response type is decoded and rethrown as WeInvoiceApiError.
 */
export async function wiDownload(method: "get" | "post", path: string, opts: { params?: object; body?: unknown; fallbackName: string }): Promise<{ blob: Blob; fileName: string }> {
    try {
        const res = await api.request<Blob>({
            method,
            url: `${WEINVOICE_BASE}${path}`,
            params: opts.params ? snakify(opts.params) : undefined,
            data: opts.body !== undefined ? snakify(opts.body) : undefined,
            responseType: "blob",
        });
        const blob = res.data;
        if (blob.type.includes("application/json")) unwrap(JSON.parse(await readText(blob)) as ApiResponse<unknown>);
        const cd = String(res.headers["content-disposition"] ?? "");
        const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
        const plain = cd.match(/filename="?([^";]+)"?/i);
        const fileName = star ? decodeURIComponent(star[1]) : plain ? plain[1] : opts.fallbackName;
        return { blob, fileName };
    } catch (err) {
        if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
            try {
                unwrap(JSON.parse(await readText(err.response.data)) as ApiResponse<unknown>);
            } catch (inner) {
                throw toApiError(inner);
            }
        }
        throw toApiError(err);
    }
}

/** `GET /requests/{request_id}` (camelCased) — backend `EngineRequestResponse`. `partial` is a finished state. */
export type EngineRequest = {
    requestId: string;
    type?: "sync" | "fetch_xml" | "fetch_pdf" | "login_test" | "import" | "test_data";
    companyMst?: string;
    status: "queued" | "running" | "done" | "partial" | "failed" | "cancelled";
    step?: string | null;
    progress?: Record<string, unknown> | null;
    result?: Record<string, unknown> | null;
    error?: string | null;
    cancelRequested?: boolean;
    createdAt?: string;
    startedAt?: string | null;
    finishedAt?: string | null;
};

/** Poll an engine job until it leaves queued/running. Stops early when `signal.cancelled`. */
export async function waitForRequest(requestId: string, onProgress?: (r: EngineRequest) => void, signal?: { cancelled: boolean }, intervalMs = 1000, timeoutMs = 10 * 60_000): Promise<EngineRequest> {
    const started = Date.now();
    for (;;) {
        const r = await wiGet<EngineRequest>(`/requests/${encodeURIComponent(requestId)}`);
        onProgress?.(r);
        if (r.status !== "queued" && r.status !== "running") return r;
        if (signal?.cancelled) return { ...r, status: "cancelled" };
        if (Date.now() - started > timeoutMs) throw new WeInvoiceApiError("WBE_TIMEOUT", "The engine did not finish in time.");
        await sleep(intervalMs);
    }
}

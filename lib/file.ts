import { ApiCallError } from "@/lib/api/banking";
import { api } from "@/lib/axios";
import type { ApiResponse } from "@/lib/types/api";

/**
 * Shared file-download helper. First consumer: the ERP Transaction
 * History panel's File column.
 *
 * <p>The JWT lives in {@code localStorage}, so a plain
 * {@code <a href download>} navigation would not carry the Bearer
 * header. This helper fires an authenticated XHR via the global
 * {@link api} axios instance (Bearer interceptor + 401 re-auth
 * automatically applied), reads the response as a {@code Blob}, then
 * drives a synthetic anchor click to trigger the browser's download
 * UI. The blob URL is revoked on the next tick so memory stays
 * bounded.
 *
 * <p>Filename resolution:
 * <ol>
 *   <li>Backend {@code Content-Disposition: attachment; filename*=UTF-8''…}
 *       (preferred — backend emits the RFC 5987 form for the saved-
 *       file-name).</li>
 *   <li>Caller-supplied {@code filename} fallback (typically the
 *       row's original filename, used when the server header is
 *       missing or unparseable).</li>
 * </ol>
 *
 * <p>Error handling — if the server responds with the JSON error
 * envelope instead of binary, this helper parses it and throws
 * {@link ApiCallError} carrying the {@code status.code}. The caller
 * routes the error to {@code useDialog().open({ type: "error",
 * errorCode })} per project convention. Pure network failures (no
 * response body) throw {@link ApiCallError} with code
 * {@code "NETWORK"}.
 *
 * <p>OQ-FE-1 (resolved 2026-05-11): the {@code ?token=<jwt>} URL-query
 * alternative was rejected for log-leak risk. The XHR-blob approach
 * keeps the JWT off the URL.
 *
 * @param url       fully-qualified or relative download URL — the
 *                  axios baseURL prefixes relative paths.
 * @param fallback  filename to suggest to the browser when the
 *                  response carries no {@code Content-Disposition}.
 *                  Almost always the row's `orgFileNm`.
 */
export async function downloadFile(url: string, fallback: string): Promise<void> {
    let response: { data: unknown; headers: unknown };
    try {
        response = await api.get<unknown>(url, {
            responseType: "blob",
            /* Tell axios we accept either the file bytes OR a JSON
             * error envelope. Either way we get a Blob; the helper
             * sniffs the content-type and rehydrates JSON when present. */
            transformResponse: [],
        });
    } catch (err) {
        // Axios threw before / during the request — convert into an
        // ApiCallError so the caller's catch block can route through
        // the global dialog.
        const e = err as {
            response?: { data?: unknown; headers?: Record<string, string> };
            message?: string;
        };
        if (e.response) {
            // Server responded but axios marked the response as failed
            // (e.g. HTTP 4xx/5xx). Re-route through the JSON-envelope
            // parse path so the caller sees the typed error.
            const code = await maybeReadEnvelope(e.response.data);
            if (code) {
                throw new ApiCallError(code.code, code.message);
            }
        }
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }

    const contentType =
        readHeader(response.headers, "content-type") ?? "application/octet-stream";

    // Sniff the JSON-envelope failure path — backend emits HTTP 200 +
    // `application/json` for known business errors (per the project's
    // BusinessException contract), so 200 alone is not enough to
    // assume success.
    if (contentType.toLowerCase().includes("application/json")) {
        const code = await maybeReadEnvelope(response.data);
        if (code) throw new ApiCallError(code.code, code.message);
        // JSON content with no recognisable envelope — surface as an
        // unexpected error rather than triggering a download of the
        // bytes-of-JSON.
        throw new ApiCallError("WBE9999", "Unexpected response shape");
    }

    const blob = response.data instanceof Blob
        ? response.data
        : toBlob(response.data, contentType);
    const objectUrl = URL.createObjectURL(blob);

    const filename =
        parseContentDispositionFilename(readHeader(response.headers, "content-disposition")) ??
        fallback;

    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    // Revoke after a tick so the browser has time to start the download
    // before the URL becomes unreachable. 1 tick is enough — every
    // major browser kicks off the save the moment `.click()` returns.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

/* ----------------------------------------------------------------------
 *  Helpers
 * ---------------------------------------------------------------------- */

/** Case-insensitive header read — axios normalises header names but
 *  the standalone-test response shape can be either. The headers object
 *  is typed loosely (`unknown`) because axios's response carries a
 *  rich header type with optional values per RFC; we treat any
 *  non-string entry as absent. */
function readHeader(headers: unknown, name: string): string | undefined {
    if (!headers || typeof headers !== "object") return undefined;
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
        if (k.toLowerCase() === lower && typeof v === "string") return v;
    }
    return undefined;
}

/** Parse the canonical RFC 5987 {@code filename*=UTF-8''…} form first
 *  (URL-decoded), then the legacy quoted {@code filename="…"} form.
 *  Returns {@code undefined} when no filename is present. */
function parseContentDispositionFilename(header: string | undefined): string | undefined {
    if (!header) return undefined;
    const rfc5987 = /filename\*\s*=\s*[^']*'[^']*'([^;]+)/i.exec(header);
    if (rfc5987) {
        try {
            return decodeURIComponent(rfc5987[1].trim().replace(/^"|"$/g, ""));
        } catch {
            // Fall through to the legacy form.
        }
    }
    const legacy = /filename\s*=\s*"([^"]+)"/i.exec(header) ?? /filename\s*=\s*([^;]+)/i.exec(header);
    if (legacy) return legacy[1].trim();
    return undefined;
}

/** Try to read the project's JSON envelope out of a Blob / string /
 *  object payload. Returns {@code null} when the payload doesn't
 *  match the shape — caller assumes it's a real file body in that
 *  case. */
async function maybeReadEnvelope(
    data: unknown,
): Promise<{ code: string; message: string } | null> {
    let parsed: unknown;
    try {
        if (data instanceof Blob) {
            const text = await data.text();
            parsed = JSON.parse(text);
        } else if (typeof data === "string") {
            parsed = JSON.parse(data);
        } else {
            parsed = data;
        }
    } catch {
        return null;
    }
    const env = parsed as Partial<ApiResponse<unknown>> | null | undefined;
    const status = env?.status;
    if (status?.error && status.code) {
        return { code: status.code, message: status.message ?? "Error" };
    }
    return null;
}

/** Coerce a non-Blob axios payload into a Blob — only used when axios
 *  receives a non-Blob response (raw string / ArrayBuffer / etc.).
 *  Avoiding `Uint8Array` here because TypeScript's default lib types
 *  it with `ArrayBufferLike` (incl. `SharedArrayBuffer`), which is not
 *  assignable to `BlobPart`'s narrower `ArrayBufferView<ArrayBuffer>`. */
function toBlob(data: unknown, type: string): Blob {
    if (data instanceof ArrayBuffer) return new Blob([data], { type });
    if (typeof data === "string") return new Blob([data], { type });
    return new Blob([String(data ?? "")], { type });
}

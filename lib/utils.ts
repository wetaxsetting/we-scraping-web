import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
    extend: {
        classGroups: {
            // Classify all text-wb-{number} tokens as font-size so they don't
            // conflict with text-wb-{name} color tokens (e.g. text-wb-ink).
            "font-size": [
                {
                    text: [
                        {
                            wb: [
                                "10", "11", "12", "13",
                                "14", "14-tight", "14-loose",
                                "15", "16", "18", "22", "24", "28", "34",
                            ],
                        },
                    ],
                },
            ],
        },
    },
});

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Wire `file_size` (decimal bytes, serialised verbatim) → human-readable
 *  "x.xx KB" / "x.xx MB" suffix. Returns the raw value when parsing fails so
 *  attachment chips never display "NaN KB". Shared by every Payment detail /
 *  Approval Details surface that renders an uploaded-file chip — the per-page
 *  copies in the Scheduled Payment pages are being retired onto this one. */
export function formatFileSize(bytesStr: string): string {
    const n = Number(bytesStr);
    if (!Number.isFinite(n) || n <= 0) return bytesStr;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** Safe localStorage helpers — every access is wrapped (private mode / blocked storage). */
export const storage = {
    get<T>(key: string, fallback: T): T {
        try {
            const raw = window.localStorage.getItem(key);
            return raw ? (JSON.parse(raw) as T) : fallback;
        } catch {
            return fallback;
        }
    },
    set(key: string, value: unknown) {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch {
            /* ignore */
        }
    },
    remove(key: string) {
        try {
            window.localStorage.removeItem(key);
        } catch {
            /* ignore */
        }
    },
};

export function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

/** Save an in-memory Blob through a transient `<a download>` (client-only). */
export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

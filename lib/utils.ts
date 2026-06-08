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

import { cn } from "@/lib/utils";

/**
 * Translucent spinner overlay for a region that is refetching.
 *
 * `useApiData` is stale-while-revalidate: it keeps the previous rows on screen
 * during a refetch so the table never flashes empty. The trade-off is that the
 * old values stay readable right up until the new ones swap in, which reads as
 * a jump. Covering the region while `loading` is true turns that into a plain
 * wait.
 *
 * The host element must establish a positioning context (`relative`).
 */
export default function LoadingOverlay({
    className,
}: {
    /** Extra classes on the overlay — e.g. a different scrim or z-index. */
    className?: string;
}) {
    return (
        <div
            className={cn(
                "absolute inset-0 z-10 flex items-center justify-center bg-white/60",
                className,
            )}
            role="status"
            aria-live="polite"
        >
            <svg className="size-8 animate-spin text-brand" viewBox="0 0 24 24" fill="none">
                <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                />
                <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
            </svg>
        </div>
    );
}

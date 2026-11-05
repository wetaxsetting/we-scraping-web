import { cn } from "@/lib/utils";

/** Tiny file badge (XML / PDF) — filled when the file exists, dashed when missing. */
export function FileBadge({ label, on, onClick, title }: { label: string; on: boolean; onClick?: () => void; title?: string }) {
    return (
        <button
            type="button"
            data-ignore-row-click
            title={title}
            onClick={onClick}
            disabled={!onClick}
            className={cn(
                "inline-flex h-5 items-center rounded px-1.5 text-wb-10 font-semibold tracking-wide",
                on ? "bg-brand-softer text-brand" : "border border-dashed border-wb-ntrl-4 text-wb-ntrl-5",
                onClick && "cursor-pointer hover:opacity-80",
            )}
        >
            {label}
        </button>
    );
}

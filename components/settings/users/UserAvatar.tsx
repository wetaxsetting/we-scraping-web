import { cn } from "@/lib/utils";

type UserAvatarProps = {
    name: string;
    /** CSS colour for the disc background (e.g. "#fae6e6"). */
    color: string;
    className?: string;
};

/**
 * 42 px circular avatar — initials disc placeholder.
 *
 * The Figma frame uses uploaded portrait photos for each user; until the
 * tenant-user API ships avatar URLs we render the user's initials on a
 * soft pastel disc. Swap to `<img>` rendering once the photo pipeline
 * lands without touching list-row markup.
 */
export default function UserAvatar({ name, color, className }: UserAvatarProps) {
    const initials =
        name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join("") || "?";
    return (
        <div
            aria-hidden
            className={cn(
                "flex size-[42px] shrink-0 items-center justify-center overflow-hidden rounded-full text-wb-13 font-semibold text-wb-ink",
                className,
            )}
            style={{ backgroundColor: color }}
        >
            {initials}
        </div>
    );
}

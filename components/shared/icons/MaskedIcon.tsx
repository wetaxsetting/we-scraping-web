import { cn } from "@/lib/utils";

/**
 * MaskedIcon — renders a monochrome `public/assets/` SVG as a CSS mask so the
 * glyph adopts the element's text color via `bg-current`.
 *
 * This is the recolorable counterpart to <DownloadIcon>'s plain `<img>`. A
 * named Figma icon still ships as a committed SVG under `public/assets/` and is
 * never substituted with a lucide / Heroicons glyph (CLAUDE.md §8a) — but the
 * Edit (`ico_pen`) and Delete (`ico_trash`) glyphs appear across the app in
 * many colors (dark edit, gray edit, red delete, ink delete, or simply
 * inheriting the parent button's color). A fixed-fill `<img>` cannot recolor,
 * so we mask the asset instead: only the SVG's alpha channel drives the mask,
 * and `bg-current` paints the visible pixels in `currentColor` — exactly how a
 * lucide icon inherited color from its parent. The SVG file remains the single
 * source of truth for the shape; its own fill value is irrelevant here.
 *
 * Pass size + color through `className` just like a lucide icon
 * (e.g. `"size-4 text-wb-red-07"`, or omit color to inherit the parent).
 */
export default function MaskedIcon({
    src,
    className = "size-4",
}: {
    src: string;
    className?: string;
}) {
    return (
        <span
            aria-hidden
            className={cn("inline-block shrink-0 bg-current", className)}
            style={{
                WebkitMaskImage: `url(${src})`,
                maskImage: `url(${src})`,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
                WebkitMaskSize: "contain",
                maskSize: "contain",
            }}
        />
    );
}

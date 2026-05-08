import { cn } from "@/lib/utils";

/**
 * Bank-name → brand colour map. Used by the static placeholder mark in
 * the Edit Bank Account dialog (Figma 142:21385). Real licensed bank
 * assets land later under `public/assets/banks/`; until then we render a
 * coloured text block per bank so the dialog reads recognisably without
 * shipping copyrighted artwork.
 */
const BANK_BRAND: Record<string, { bg: string; fg: string; tagline?: string }> = {
    Agri: { bg: "#A30B14", fg: "#FFFFFF" },
    BIDV: { bg: "#0E6B3E", fg: "#FFFFFF" },
    "VIETIN BANK": { bg: "#0061A8", fg: "#FFFFFF" },
    HD: { bg: "#E30613", fg: "#FFFFFF" },
    "Woori VN": { bg: "#0046A8", fg: "#FFFFFF" },
    SHB: {
        bg: "#F58220",
        fg: "#FFFFFF",
        tagline: "Đối tác tin cậy, giải pháp phù hợp",
    },
    ABBANK: { bg: "#003478", fg: "#FFFFFF" },
    ACB: { bg: "#005BAA", fg: "#FFFFFF" },
};

const FALLBACK = { bg: "#3F3F46", fg: "#FFFFFF" } as const;

type BankBrandLogoProps = {
    bankName: string;
    className?: string;
};

/**
 * Static placeholder bank logo for the Edit Bank Account dialog. Renders
 * the bank name on a brand-coloured block plus an optional Vietnamese
 * tagline (currently SHB only) below the mark — mirrors the Figma frame's
 * SHB lock-up at a level of fidelity that doesn't require shipping
 * licensed artwork. Swap to a real SVG under `public/assets/banks/` later
 * by extending {@link BANK_BRAND} with an `asset` field and rendering
 * `<img>` instead of the styled text block.
 */
export default function BankBrandLogo({ bankName, className }: BankBrandLogoProps) {
    const brand = BANK_BRAND[bankName] ?? FALLBACK;
    return (
        <div className={cn("flex flex-col items-start gap-0.5", className)}>
            <div
                aria-hidden
                className="flex h-10 min-w-[114px] items-center justify-center rounded-md px-4 text-wb-18 font-bold tracking-wb-tight"
                style={{ backgroundColor: brand.bg, color: brand.fg }}
            >
                {bankName}
            </div>
            {brand.tagline && (
                <span className="text-wb-11 font-normal italic text-wb-ntrl-8">
                    {brand.tagline}
                </span>
            )}
        </div>
    );
}

import { resolveBankLogoUrlByNapas } from "@/components/shared/popups/selectBankBanks";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { BankBrand } from "./types";

type BankLogoProps = {
    bank: BankBrand;
    bankName: string;
    /** NAPAS bank code ({@code out_bank_cd} on the wire — {@code 970424}
     *  Shinhan / {@code 970436} Vietcombank / {@code 970457} Woori).
     *  When supplied, the renderer prefers the curated brand PNG from
     *  {@code /banklogo/icon/} resolved via
     *  {@link resolveBankLogoUrlByNapas} — the same registry Login
     *  Credentials and Bank Account consume. Falls back to the inline
     *  SVG marks ({@code woori}, {@code shinhan}) or the
     *  coloured-initial chip when the NAPAS code is unknown or absent. */
    bankCd?: string;
    className?: string;
};

/**
 * Bank logo for the Firm Banking Settings linked-account list (Figma 134:17061).
 *
 * Renders a 36 × 36 circular mark per bank. WOORI and SHINHAN ship as
 * inline SVG marks that visually approximate the Figma frame's branded
 * artwork without committing licensed brand assets to the repo. Other
 * banks fall back to a brand-coloured circle with the bank's initial —
 * swap to a real SVG under `public/assets/banks/{bank}.svg` later
 * without touching row markup.
 */
const BANK_BRAND_COLOR: Record<BankBrand, string> = {
    woori: "#0046A8",
    shinhan: "#0E3A6B",
    bidv: "#0E6B3E",
    vcb: "#007A33",
    hd_bank: "#E30613",
};

function WooriMark() {
    // Figma 134:17105 — navy circle with a layered white wave/cream lower
    // band. Two clipped paths approximate the wave + the cream segment.
    return (
        <svg
            viewBox="0 0 36 36"
            className="block size-full"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <defs>
                <clipPath id="woori-clip">
                    <circle cx="18" cy="18" r="18" />
                </clipPath>
            </defs>
            <g clipPath="url(#woori-clip)">
                <rect width="36" height="36" fill="#0046A8" />
                <path
                    d="M-2 22 Q9 13 18 22 T38 22 L38 38 L-2 38 Z"
                    fill="#FFFFFF"
                />
                <path
                    d="M-2 26 Q9 19 18 26 T38 26 L38 38 L-2 38 Z"
                    fill="#F5E6C8"
                />
            </g>
        </svg>
    );
}

function ShinhanMark() {
    // Figma 134:17114 — navy disc crossed by a teal swoosh and a lighter
    // mid-blue accent. Three layered paths inside a circular clip path.
    return (
        <svg
            viewBox="0 0 36 36"
            className="block size-full"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <defs>
                <clipPath id="shinhan-clip">
                    <circle cx="18" cy="18" r="18" />
                </clipPath>
            </defs>
            <g clipPath="url(#shinhan-clip)">
                <rect width="36" height="36" fill="#0E3A6B" />
                <path
                    d="M-2 24 Q18 4 38 24 L38 32 Q18 14 -2 32 Z"
                    fill="#00A5C5"
                />
                <path
                    d="M-2 20 Q18 6 38 20 L38 14 Q18 0 -2 14 Z"
                    fill="#5DADE2"
                    opacity="0.55"
                />
            </g>
        </svg>
    );
}

export default function BankLogo({ bank, bankName, bankCd, className }: BankLogoProps) {
    const { locale } = useTranslation();
    const initial = bankName.trim().charAt(0).toUpperCase() || "B";
    // Prefer the curated PNG brand asset (Login Credentials parity);
    // fall back to the inline SVG marks for the two banks the static
    // UI predated the registry for, then to the coloured-initial chip.
    const logoUrl = bankCd ? resolveBankLogoUrlByNapas(bankCd, locale) : undefined;
    const inlineMark = !logoUrl && (bank === "woori" || bank === "shinhan");
    const chip = !logoUrl && !inlineMark;
    return (
        <div
            aria-hidden
            className={cn(
                "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full",
                chip && "text-wb-13 font-semibold text-white",
                className,
            )}
            style={chip ? { backgroundColor: BANK_BRAND_COLOR[bank] } : undefined}
        >
            {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={logoUrl}
                    alt=""
                    aria-hidden
                    className="block size-full object-contain"
                />
            ) : bank === "woori" ? (
                <WooriMark />
            ) : bank === "shinhan" ? (
                <ShinhanMark />
            ) : (
                <span className="leading-none">{initial}</span>
            )}
        </div>
    );
}

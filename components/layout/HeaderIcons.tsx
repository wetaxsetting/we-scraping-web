/**
 * Top-menu icons — two distinct SVGs per menu entry (inactive + active).
 *
 * Inactive is drawn for the blue `bg-brand` header (white outlines + gold
 * accents). Active is drawn for the white tab background (`#0069B9`
 * outlines + gold accents, and — for Banking/Payment — an extra gold
 * "fill" block that emphasises the selected module).
 *
 * Paths are copied verbatim from Figma (`imgGroup6007`, `imgGroup6004`,
 * `imgGroup1000001816`, `imgGroup1000001819`) rather than tinted via
 * `currentColor`, because the Figma designs genuinely differ between
 * states — not just in colour — and the task spec is explicit: "Do NOT
 * simulate with color only".
 *
 * Settings active + Add-on Service active are not separately exported in
 * Figma; per spec they mirror the Banking/Payment pattern (white → brand
 * blue swap on outlines, gold accents unchanged).
 */

type IconProps = { className?: string };

const GOLD = "#F5BB1E";
const BRAND = "#0069B9";

// ─── Banking ────────────────────────────────────────────────────────────

export function IconBankingInactive({ className }: IconProps) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden
        >
            <rect y="10" width="24" height="2" fill="white" />
            <rect x="12" y="22" width="12" height="2" rx="1" fill={GOLD} />
            <rect x="12" y="19" width="12" height="2" rx="1" fill={GOLD} />
            <rect x="12" y="16" width="12" height="2" rx="1" fill={GOLD} />
            <path d="M20 0C22.2091 0 24 1.79086 24 4V14H22V4C22 2.89543 21.1046 2 20 2H4C2.89543 2 2 2.89543 2 4V20C2 21.1046 2.89543 22 4 22H10V24H4C1.79086 24 0 22.2091 0 20V4C2.57702e-07 1.79086 1.79086 0 4 0H20Z" fill="white" />
        </svg>
    );
}

export function IconBankingActive({ className }: IconProps) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden
        >
            <path d="M0 4C0 1.79086 1.79086 0 4 0H20C22.2091 0 24 1.79086 24 4V12H0V4Z" fill={GOLD} />
            <rect y="10" width="24" height="2" fill={BRAND} />
            <rect x="12" y="22" width="12" height="2" rx="1" fill={GOLD} />
            <rect x="12" y="19" width="12" height="2" rx="1" fill={GOLD} />
            <rect x="12" y="16" width="12" height="2" rx="1" fill={GOLD} />
            <path d="M20 0C22.2091 0 24 1.79086 24 4V14H22V4C22 2.89543 21.1046 2 20 2H4C2.89543 2 2 2.89543 2 4V20C2 21.1046 2.89543 22 4 22H10V24H4C1.79086 24 0 22.2091 0 20V4C2.57702e-07 1.79086 1.79086 0 4 0H20Z" fill={BRAND} />
        </svg>
    );
}

// ─── Payment ────────────────────────────────────────────────────────────

export function IconPaymentInactive({ className }: IconProps) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden
        >
            <rect x="4" y="4" width="5" height="5" rx="1" fill="white" />
            <path d="M20 3L20 8C20 8.55228 20.4477 9 21 9C21.5523 9 22 8.55228 22 8L22 3C22 2.44772 21.5523 2 21 2C20.4477 2 20 2.44772 20 3Z" fill={GOLD} />
            <path d="M21 1.31134e-07L18 4L24 4L21 1.31134e-07Z" fill={GOLD} />
            <path d="M18 2.62268e-07V2H4C2.89543 2 2 2.89543 2 4V11H24V20C24 22.2091 22.2091 24 20 24H4C1.79086 24 0 22.2091 0 20V4C2.57702e-07 1.79086 1.79086 2.62268e-07 4 2.62268e-07H18ZM2 20C2 21.1046 2.89543 22 4 22H20C21.1046 22 22 21.1046 22 20V13H2V20Z" fill="white" />
        </svg>
    );
}

export function IconPaymentActive({ className }: IconProps) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden
        >
            <path d="M0 11H24V20C24 22.2091 22.2091 24 20 24H4C1.79086 24 0 22.2091 0 20V11Z" fill={GOLD} />
            <rect x="4" y="4" width="5" height="5" rx="1" fill={BRAND} />
            <path d="M20 3L20 8C20 8.55228 20.4477 9 21 9C21.5523 9 22 8.55228 22 8L22 3C22 2.44772 21.5523 2 21 2C20.4477 2 20 2.44772 20 3Z" fill={GOLD} />
            <path d="M21 1.31134e-07L18 4L24 4L21 1.31134e-07Z" fill={GOLD} />
            <path d="M18 2.62268e-07V2H4C2.89543 2 2 2.89543 2 4V11H24V20C24 22.2091 22.2091 24 20 24H4C1.79086 24 0 22.2091 0 20V4C2.57702e-07 1.79086 1.79086 2.62268e-07 4 2.62268e-07H18ZM2 20C2 21.1046 2.89543 22 4 22H20C21.1046 22 22 21.1046 22 20V13H2V20Z" fill={BRAND} />
        </svg>
    );
}

// ─── Add-on Service ─────────────────────────────────────────────────────
// Figma exports a 24×24 SVG + a separate 12×4 white "connector" pill that
// sits at the top-centre of the icon. We inline both layers into one SVG
// so each variant is a single component.

export function IconAddonInactive({ className }: IconProps) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden
        >
            <rect x="8" y="12" width="12" height="2" fill={GOLD} />
            <rect x="8" y="8" width="12" height="2" fill={GOLD} />
            <rect x="4" y="12" width="2" height="2" fill={GOLD} />
            <rect x="4" y="8" width="2" height="2" fill={GOLD} />
            <rect x="8" y="16" width="12" height="2" fill={GOLD} />
            <rect x="4" y="16" width="2" height="2" fill={GOLD} />
            <path d="M20 0C22.2091 0 24 1.79086 24 4V20C24 22.2091 22.2091 24 20 24H4C1.79086 24 0 22.2091 0 20V4C2.57702e-07 1.79086 1.79086 0 4 0H20ZM4 2C2.89543 2 2 2.89543 2 4V20C2 21.1046 2.89543 22 4 22H20C21.1046 22 22 21.1046 22 20V4C22 2.89543 21.1046 2 20 2H4Z" fill="white" />
            <rect x="6" y="0" width="12" height="4" rx="1" fill="white" />
        </svg>
    );
}

export function IconAddonActive({ className }: IconProps) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden
        >
            <rect x="8" y="12" width="12" height="2" fill={GOLD} />
            <rect x="8" y="8" width="12" height="2" fill={GOLD} />
            <rect x="4" y="12" width="2" height="2" fill={GOLD} />
            <rect x="4" y="8" width="2" height="2" fill={GOLD} />
            <rect x="8" y="16" width="12" height="2" fill={GOLD} />
            <rect x="4" y="16" width="2" height="2" fill={GOLD} />
            <path d="M20 0C22.2091 0 24 1.79086 24 4V20C24 22.2091 22.2091 24 20 24H4C1.79086 24 0 22.2091 0 20V4C2.57702e-07 1.79086 1.79086 0 4 0H20ZM4 2C2.89543 2 2 2.89543 2 4V20C2 21.1046 2.89543 22 4 22H20C21.1046 22 22 21.1046 22 20V4C22 2.89543 21.1046 2 20 2H4Z" fill={BRAND} />
            <rect x="6" y="0" width="12" height="4" rx="1" fill={BRAND} />
        </svg>
    );
}

// ─── Settings ───────────────────────────────────────────────────────────

export function IconSettingsInactive({ className }: IconProps) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden
        >
            <path d="M16.6807 8C17.164 8.00002 17.5286 8.29011 17.6328 8.75879L17.9971 10.3223C18.2351 10.4041 18.4511 10.4853 18.6445 10.582L20.0283 9.73438C20.4299 9.51123 20.8538 9.56998 21.1885 9.875L22.1553 10.8281C22.5048 11.163 22.5416 11.6318 22.2812 12.041L21.4561 13.4023C21.5379 13.5809 21.6346 13.7971 21.709 14.0352L23.249 14.4072C23.7175 14.5115 24 14.8764 24 15.3525V16.6846C24 17.1682 23.7175 17.5335 23.249 17.6377L21.6943 18.0098C21.6274 18.218 21.5375 18.4339 21.4482 18.6348L22.2666 19.9668C22.5269 20.3686 22.4822 20.8595 22.1475 21.1943L21.1953 22.1396C20.8606 22.4743 20.3918 22.5186 19.9902 22.2656L18.6445 21.4404C18.4511 21.5372 18.2276 21.6258 17.9971 21.7002L17.6328 23.2412C17.5286 23.7099 17.164 24 16.6807 24H15.3271C14.8438 24 14.4718 23.7099 14.375 23.2412L14.0029 21.7002C13.7723 21.6258 13.5563 21.5372 13.3555 21.4404L12.0098 22.2656C11.6082 22.5186 11.1394 22.4743 10.8047 22.1396L9.85254 21.1943C9.51791 20.8596 9.47272 20.3686 9.74023 19.9668L10.5586 18.6348C10.4619 18.4339 10.3726 18.218 10.3057 18.0098L8.75098 17.6377C8.28247 17.5335 8 17.1682 8 16.6846V15.3525C8.00001 14.8764 8.28251 14.5115 8.75098 14.4072L10.291 14.0352C10.3654 13.7971 10.4621 13.5809 10.5439 13.4023L9.71875 12.041C9.46587 11.6318 9.49522 11.163 9.84473 10.8281L10.8047 9.88281C11.1468 9.56299 11.5705 9.51116 11.9795 9.73438L13.3486 10.5752C13.5494 10.4785 13.7724 10.3885 14.0029 10.3066L14.375 8.75879C14.4718 8.29014 14.8438 8 15.3271 8H16.6807ZM16 12C13.7909 12 12 13.7909 12 16C12 18.2091 13.7909 20 16 20C18.2091 20 20 18.2091 20 16C20 13.7909 18.2091 12 16 12Z" fill={GOLD} />
            <path d="M20 0C22.2091 0 24 1.79086 24 4V8H22V4C22 2.89543 21.1046 2 20 2H4C2.89543 2 2 2.89543 2 4V20C2 21.1046 2.89543 22 4 22H8V24H4C1.79086 24 0 22.2091 0 20V4C2.57702e-07 1.79086 1.79086 0 4 0H20Z" fill="white" />
        </svg>
    );
}

export function IconSettingsActive({ className }: IconProps) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden
        >
            <path d="M16.6807 8C17.164 8.00002 17.5286 8.29011 17.6328 8.75879L17.9971 10.3223C18.2351 10.4041 18.4511 10.4853 18.6445 10.582L20.0283 9.73438C20.4299 9.51123 20.8538 9.56998 21.1885 9.875L22.1553 10.8281C22.5048 11.163 22.5416 11.6318 22.2812 12.041L21.4561 13.4023C21.5379 13.5809 21.6346 13.7971 21.709 14.0352L23.249 14.4072C23.7175 14.5115 24 14.8764 24 15.3525V16.6846C24 17.1682 23.7175 17.5335 23.249 17.6377L21.6943 18.0098C21.6274 18.218 21.5375 18.4339 21.4482 18.6348L22.2666 19.9668C22.5269 20.3686 22.4822 20.8595 22.1475 21.1943L21.1953 22.1396C20.8606 22.4743 20.3918 22.5186 19.9902 22.2656L18.6445 21.4404C18.4511 21.5372 18.2276 21.6258 17.9971 21.7002L17.6328 23.2412C17.5286 23.7099 17.164 24 16.6807 24H15.3271C14.8438 24 14.4718 23.7099 14.375 23.2412L14.0029 21.7002C13.7723 21.6258 13.5563 21.5372 13.3555 21.4404L12.0098 22.2656C11.6082 22.5186 11.1394 22.4743 10.8047 22.1396L9.85254 21.1943C9.51791 20.8596 9.47272 20.3686 9.74023 19.9668L10.5586 18.6348C10.4619 18.4339 10.3726 18.218 10.3057 18.0098L8.75098 17.6377C8.28247 17.5335 8 17.1682 8 16.6846V15.3525C8.00001 14.8764 8.28251 14.5115 8.75098 14.4072L10.291 14.0352C10.3654 13.7971 10.4621 13.5809 10.5439 13.4023L9.71875 12.041C9.46587 11.6318 9.49522 11.163 9.84473 10.8281L10.8047 9.88281C11.1468 9.56299 11.5705 9.51116 11.9795 9.73438L13.3486 10.5752C13.5494 10.4785 13.7724 10.3885 14.0029 10.3066L14.375 8.75879C14.4718 8.29014 14.8438 8 15.3271 8H16.6807ZM16 12C13.7909 12 12 13.7909 12 16C12 18.2091 13.7909 20 16 20C18.2091 20 20 18.2091 20 16C20 13.7909 18.2091 12 16 12Z" fill={GOLD} />
            <path d="M20 0C22.2091 0 24 1.79086 24 4V8H22V4C22 2.89543 21.1046 2 20 2H4C2.89543 2 2 2.89543 2 4V20C2 21.1046 2.89543 22 4 22H8V24H4C1.79086 24 0 22.2091 0 20V4C2.57702e-07 1.79086 1.79086 0 4 0H20Z" fill={BRAND} />
        </svg>
    );
}

import type { ReactNode } from "react";

/**
 * Auth screens layout shell.
 *
 * Mobile (Figma 199:7830) → single column, form first, marketing block below.
 *   `min-h-screen` lets the page grow taller than the viewport so the user
 *   can scroll through (form → marketing → bottom band) on a small phone.
 *
 * Tablet+ (Figma 199:7493 / 199:7230 / 199:6973) → two-column 50/50 split,
 *   marketing on the LEFT, form on the RIGHT. CSS `order` flips visual order
 *   at md+ since DOM order is form-first (mobile reading order).
 *   `md:h-screen` + `md:overflow-hidden` cap the wrapper at 100vh so neither
 *   the document nor the page itself scrolls — content is sized down (in
 *   `LoginForm` + `MarketingPanel`) to fit within the shortest supported
 *   viewport (Tablet 992×800).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden md:h-screen md:min-h-0 md:flex-row md:overflow-hidden">
            {children}
        </div>
    );
}

import { useTranslation } from "@/lib/i18n";

/**
 * Empty-state body for the Users detail panel — Figma 142:23162.
 *
 * Centered shield-and-user illustration + "No user selected" headline +
 * two-line muted description. The illustration is an inline SVG that
 * approximates Figma's `imgGroup6042` asset (a soft-gradient shield
 * with a person silhouette) so the panel ships self-contained without
 * pulling in a one-off PNG.
 */
type UsersEmptyStateProps = {
    /** Optional — render a muted "Loading…" line below the headline
     *  while the panel's initial list fetch is in-flight. Static
     *  illustration stays in place so the layout doesn't shift when
     *  the load completes. */
    loading?: boolean;
};

export default function UsersEmptyState({ loading = false }: UsersEmptyStateProps) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-9 px-6">
            <EmptyStateIllustration />
            <div className="flex flex-col items-center gap-2.5 text-center">
                <h3 className="text-wb-22 font-semibold text-wb-dark">
                    {t("settings.users.empty.title")}
                </h3>
                <p className="text-wb-13 font-medium leading-5 text-wb-muted">
                    {loading ? (
                        t("common.loading")
                    ) : (
                        <>
                            {t("settings.users.empty.description_line1")}
                            <br aria-hidden />
                            {t("settings.users.empty.description_line2")}
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}

function EmptyStateIllustration() {
    return (
        <svg
            viewBox="0 0 119 86"
            className="h-[86px] w-[119px]"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <defs>
                <linearGradient id="users-empty-shield" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F5C24A" />
                    <stop offset="55%" stopColor="#E89B2D" />
                    <stop offset="100%" stopColor="#B36B17" />
                </linearGradient>
                <linearGradient id="users-empty-disc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E5E5E5" />
                    <stop offset="100%" stopColor="#B5B5B5" />
                </linearGradient>
                <linearGradient id="users-empty-person" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9CA3AF" />
                    <stop offset="100%" stopColor="#6B7280" />
                </linearGradient>
            </defs>

            {/* Soft grey disc behind the shield + person — gives the
                composition the same "material" feel as the Figma asset. */}
            <ellipse cx="74" cy="58" rx="38" ry="22" fill="url(#users-empty-disc)" opacity="0.55" />

            {/* Shield — left-leaning gold/amber gradient. */}
            <path
                d="M30 6 L58 0 L58 38 C58 56 46 70 30 78 C14 70 2 56 2 38 L2 12 Z"
                transform="translate(8 0)"
                fill="url(#users-empty-shield)"
            />
            {/* Shield highlight ridge */}
            <path
                d="M16 8 L38 4 L38 22 L16 22 Z"
                transform="translate(8 0)"
                fill="#FFFFFF"
                opacity="0.18"
            />

            {/* Person silhouette — head + shoulders rendered behind the
                shield's right edge, mirroring the Figma frame. */}
            <g transform="translate(60 18)">
                <circle cx="22" cy="14" r="14" fill="url(#users-empty-person)" />
                <path
                    d="M2 56 C2 40 12 32 22 32 C32 32 42 40 42 56 L42 60 L2 60 Z"
                    fill="url(#users-empty-person)"
                />
            </g>
        </svg>
    );
}

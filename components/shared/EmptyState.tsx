import type { ReactNode } from "react";

/** Centered empty / no-data placeholder for tables and panels. */
export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-14 text-center">
            {icon && <div className="mb-1 text-wb-ntrl-5 [&_svg]:size-10">{icon}</div>}
            <p className="text-wb-14 font-semibold text-wb-ntrl-8">{title}</p>
            {hint && <p className="max-w-[420px] text-wb-13 text-wb-ntrl-6">{hint}</p>}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

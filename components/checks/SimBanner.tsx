"use client";

import { FlaskConical } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

/** Small banner shown on screens whose registry / portal data is simulated in the MVP. */
export function SimBanner({ k = "sim.registry" }: { k?: string }) {
    const { t } = useTranslation();
    return (
        <p className="flex items-start gap-2 rounded-md bg-wb-bg-sidebar px-3 py-2 text-wb-12 text-wb-ntrl-7">
            <FlaskConical className="mt-0.5 size-4 shrink-0 text-brand" />
            {t(k)}
        </p>
    );
}

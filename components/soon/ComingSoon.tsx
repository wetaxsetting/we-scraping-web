"use client";

import { CalendarClock, CheckCircle2 } from "lucide-react";
import { usePathname } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import { StatusPill } from "@/components/shared/StatusPill";
import { useTranslation } from "@/lib/i18n";
import { itemFor } from "@/lib/weinvoice/nav";

/**
 * Placeholder for modules outside the MVP — shows what the module will do
 * (from the Function List) and in which phase, so the menu already reflects
 * the full product scope during the demo.
 */
export default function ComingSoon() {
    const { t } = useTranslation();
    const item = itemFor(usePathname());
    if (!item) return null;
    const features = [1, 2, 3, 4, 5].map((i) => t(`soon.${item.key}.f${i}`)).filter((s) => !s.startsWith("soon."));
    const Icon = item.icon;
    return (
        <PageLayout>
            <PageHeader title={t(`nav.i.${item.key}`)}>
                <StatusPill size="sm" variant="progress" label={t("soon.phase", { p: item.phase })} />
            </PageHeader>
            <div className="flex max-w-[760px] flex-col gap-4 rounded-xl bg-wb-bg-card p-6 shadow-wb-card">
                <div className="flex items-start gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon className="size-6" /></span>
                    <div>
                        <p className="text-wb-16 font-semibold text-wb-ink">{t("soon.title")}</p>
                        <p className="mt-1 text-wb-13 leading-5 text-wb-ntrl-7">{t(`soon.${item.key}.desc`)}</p>
                    </div>
                </div>
                {features.length > 0 && (
                    <ul className="flex flex-col gap-2 border-t border-wb-border-sidebar pt-4">
                        {features.map((f) => (
                            <li key={f} className="flex items-start gap-2 text-wb-13 text-wb-ntrl-8">
                                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
                                {f}
                            </li>
                        ))}
                    </ul>
                )}
                <p className="flex items-center gap-1.5 text-wb-12 text-wb-ntrl-6"><CalendarClock className="size-4" />{t("soon.note")}</p>
            </div>
        </PageLayout>
    );
}

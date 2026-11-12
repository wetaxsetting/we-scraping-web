"use client";

import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";

import PageLayout from "@/components/shared/PageLayout";
import { MailboxConnect } from "@/components/upload/MailboxConnect";
import { useStore } from "@/lib/api/weinvoice/store";
import { useTranslation } from "@/lib/i18n";

/**
 * Nguồn → Kết nối email: header (working MST + "read only" pill) over the 4 connection tiles,
 * the selected panel and the connected-mailbox list (MailboxConnect).
 */
export default function MailboxPage() {
    const { t } = useTranslation();
    const activeTaxId = useStore((s) => s.activeTaxId);
    return (
        <PageLayout>
            <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-5 py-4 md:py-8">
                <div>
                    <Link href="/sources/email" className="mb-2 inline-flex items-center gap-1 text-wb-12 font-medium text-wb-ntrl-6 hover:text-brand">
                        <ArrowLeft className="size-3.5" />
                        {t("nav.i.email")}
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <h1 className="text-wb-24 font-bold tracking-wb-tight text-wb-dark">{t("nav.i.mailbox")}</h1>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-wb-status-approved-bg px-2.5 py-0.5 text-wb-12 font-medium text-wb-status-approved-text">
                            <ShieldCheck className="size-3.5" />
                            {t("mbx.readonly_pill")}
                        </span>
                    </div>
                    <p className="mt-1 text-wb-14 text-wb-ntrl-7">{t("mbx.page_subtitle_mst", { mst: activeTaxId || "—" })}</p>
                </div>
                <MailboxConnect />
            </div>
        </PageLayout>
    );
}

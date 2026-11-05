"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import PageLayout from "@/components/shared/PageLayout";
import { MailboxConnect } from "@/components/upload/MailboxConnect";
import { useTranslation } from "@/lib/i18n";

/**
 * Nguồn → Kết nối email — "Đồng bộ hoá đơn từ email" (layout of Invoy /gmail):
 * centered column, Gmail / Outlook selector cards, connect form, App Password guide.
 * MVP: UI simulation only (see lib/api/mailbox.ts).
 */
export default function MailboxPage() {
    const { t } = useTranslation();
    return (
        <PageLayout>
            <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5 py-4 md:py-8">
                <div>
                    <Link href="/sources/email" className="mb-2 inline-flex items-center gap-1 text-wb-12 font-medium text-wb-ntrl-6 hover:text-brand">
                        <ArrowLeft className="size-3.5" />
                        {t("nav.i.email")}
                    </Link>
                    <h1 className="text-wb-24 font-bold tracking-wb-tight text-wb-dark">{t("mbx.page_title")}</h1>
                    <p className="mt-1 text-wb-14 text-wb-ntrl-7">{t("mbx.page_subtitle")}</p>
                </div>
                <MailboxConnect variant="page" />
            </div>
        </PageLayout>
    );
}

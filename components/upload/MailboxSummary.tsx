"use client";

import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import { mailboxesAvailable } from "@/lib/api/weinvoice/mailbox";
import { useStore } from "@/lib/api/weinvoice/store";
import { fmtDateTime } from "@/lib/weinvoice/format";

/**
 * Compact card on "Hoá đơn từ email": mailbox status + link to the full "Đồng bộ hoá đơn từ email" page.
 * api mode: mailbox connections are not on the server yet — the card says so and has no link.
 */
export function MailboxSummary() {
    const { t } = useTranslation();
    const activeTaxId = useStore((s) => s.activeTaxId);
    const all = useStore((s) => s.mailboxes);
    const boxes = useMemo(() => (all ?? []).filter((m) => m.taxId === activeTaxId), [all, activeTaxId]);
    return (
        <div className="flex h-full flex-col gap-3 rounded-lg bg-wb-bg-card p-4 shadow-wb-card">
            <div className="flex items-center gap-2">
                <Mail className="size-5 text-brand" />
                <p className="text-wb-14 font-semibold">{t("mbx.title")}</p>
                <span className="ml-auto text-wb-12 text-wb-ntrl-6">Gmail · Outlook</span>
            </div>
            {!mailboxesAvailable() ? (
                <p className="text-wb-12 leading-5 text-wb-ntrl-6">{t("common.not_on_server")}</p>
            ) : boxes.length === 0 ? (
                <p className="text-wb-12 leading-5 text-wb-ntrl-6">{t("mbx.sum_none")}</p>
            ) : (
                <ul className="flex flex-col gap-1.5">
                    {boxes.map((b) => (
                        <li key={b.id} className="flex items-center gap-2 text-wb-13">
                            <CheckCircle2 className="size-4 text-wb-status-approved-text" />
                            <b className="font-semibold">{b.address}</b>
                            <span className="text-wb-12 text-wb-ntrl-6">
                                · {b.provider === "gmail" ? "Gmail" : "Outlook"}
                                {b.lastScanAt && <> · {t("mbx.last_scan", { d: fmtDateTime(b.lastScanAt) })}</>}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {mailboxesAvailable() && (
                <Link
                    href="/sources/mailbox"
                    className="mt-auto inline-flex h-8 w-fit items-center gap-2 rounded-md bg-brand px-3 text-wb-13 font-medium text-white hover:bg-brand-hover shadow-wb-brand-btn"
                >
                    {boxes.length ? t("mbx.manage") : t("mbx.open")}
                    <ArrowRight className="size-4" />
                </Link>
            )}
        </div>
    );
}

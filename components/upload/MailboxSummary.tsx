"use client";

import { ArrowRight, CheckCircle2, CircleAlert, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import { appliesTo, loadMailboxes, mailboxesRemote } from "@/lib/api/weinvoice/mailbox";
import { useStore } from "@/lib/api/weinvoice/store";
import { fmtDateTime } from "@/lib/weinvoice/format";

/**
 * Compact card on "Hoá đơn từ email": the mailboxes feeding the working MST + link to "Kết nối email".
 * api mode loads `GET /mailboxes` on mount; a failure leaves the card empty (the full page shows the error).
 */
export function MailboxSummary() {
    const { t } = useTranslation();
    const activeTaxId = useStore((s) => s.activeTaxId);
    const all = useStore((s) => s.mailboxes);
    const boxes = useMemo(() => (all ?? []).filter((m) => appliesTo(m, activeTaxId)), [all, activeTaxId]);
    useEffect(() => {
        if (mailboxesRemote()) loadMailboxes().catch(() => undefined);
    }, []);
    return (
        <div className="flex h-full flex-col gap-3 rounded-lg bg-wb-bg-card p-4 shadow-wb-card">
            <div className="flex items-center gap-2">
                <Mail className="size-5 text-brand" />
                <p className="text-wb-14 font-semibold">{t("mbx.title")}</p>
                <span className="ml-auto text-wb-12 text-wb-ntrl-6">Gmail · Outlook · IMAP</span>
            </div>
            {boxes.length === 0 ? (
                <p className="text-wb-12 leading-5 text-wb-ntrl-6">{t("mbx.sum_none")}</p>
            ) : (
                <ul className="flex flex-col gap-1.5">
                    {boxes.map((b) => {
                        const ok = (b.status ?? "connected") === "connected";
                        return (
                            <li key={b.id} className="flex min-w-0 items-center gap-2 text-wb-13">
                                {ok ? <CheckCircle2 className="size-4 shrink-0 text-wb-status-approved-text" /> : <CircleAlert className="size-4 shrink-0 text-wb-status-error-text" />}
                                <b className="truncate font-semibold">{b.address}</b>
                                <span className="truncate text-wb-12 text-wb-ntrl-6">
                                    · {t(`mbx.tile.${b.provider}`)}
                                    {!ok && <> · {t(`mbx.status.${b.status}`)}</>}
                                    {ok && b.lastScanAt && <> · {t("mbx.last_scan", { d: fmtDateTime(b.lastScanAt) })}</>}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
            <Link
                href="/sources/mailbox"
                className="mt-auto inline-flex h-8 w-fit items-center gap-2 rounded-md bg-brand px-3 text-wb-13 font-medium text-white hover:bg-brand-hover shadow-wb-brand-btn"
            >
                {boxes.length ? t("mbx.manage") : t("mbx.open")}
                <ArrowRight className="size-4" />
            </Link>
        </div>
    );
}

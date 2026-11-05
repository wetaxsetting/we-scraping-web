"use client";

import { AtSign, CheckCircle2, Copy, MailPlus, Paperclip } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/shared/dialog";
import { MailboxSummary } from "@/components/upload/MailboxSummary";
import { StatusPill } from "@/components/shared/StatusPill";
import type { StatusPillVariant as PillVariant } from "@/components/shared/StatusPill";
import { getEmailAddress, mockEmailAddress, simulateIncomingEmail, type EmailMessageRow, type EmailResult } from "@/lib/api/weinvoice/mailbox";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { fmtDateTime } from "@/lib/weinvoice/format";
import { useTranslation } from "@/lib/i18n";
import { useStore } from "@/lib/api/weinvoice/store";
import { getInvoice } from "@/lib/api/weinvoice/invoices";
import type { EmailMessage } from "@/lib/weinvoice/types";
import { sleep } from "@/lib/utils";

const V: Record<EmailMessage["result"] | EmailResult, PillVariant> = { matched: "progress", new: "success", duplicate: "neutral", no_invoice: "warning", unmatched: "pending", error: "failed" };

/** api mode keeps the backend result (`unmatched` / `error` have no `EmailMessage` value) in `apiResult`. */
const resultOf = (m: EmailMessage): EmailMessage["result"] | EmailResult => (m as EmailMessageRow).apiResult ?? m.result;

/**
 * Nguồn → Hoá đơn từ email.
 * Recommended channel: one inbound address per company (no mailbox password stored).
 * Mailbox: Gmail (App Password, IMAP read-only) / Outlook (Microsoft OAuth) — see MailboxConnect.
 */
export default function EmailPage() {
    const { t } = useTranslation();
    const { toast } = useDialog();
    const activeTaxId = useStore((s) => s.activeTaxId);
    const emails = useStore((s) => s.emails);
    useStore((s) => s.invoices); // re-render when an email import adds / merges an invoice
    const [simulating, setSimulating] = useState(false);
    const [copied, setCopied] = useState(false);
    // api mode: the address comes from GET /email/address (per MST); mock: the prototype's address.
    // `configured: false` → the server has no mail domain yet: say so instead of showing "—".
    const [apiAddress, setApiAddress] = useState<{ taxId: string; address: string; configured: boolean } | null>(null);
    useEffect(() => {
        if (DATA_SOURCE !== "api" || !activeTaxId) return;
        let live = true;
        getEmailAddress(activeTaxId).then(
            (a) => live && setApiAddress({ taxId: activeTaxId, address: a.address ?? "", configured: a.configured }),
            () => live && setApiAddress({ taxId: activeTaxId, address: "", configured: true }),
        );
        return () => {
            live = false;
        };
    }, [activeTaxId]);
    const current = apiAddress?.taxId === activeTaxId ? apiAddress : null;
    const address = DATA_SOURCE === "api" ? (current?.address ?? "") : mockEmailAddress(activeTaxId);
    const unconfigured = DATA_SOURCE === "api" && current?.configured === false;

    const simulate = async () => {
        setSimulating(true);
        await sleep(1200);
        try {
            await simulateIncomingEmail(activeTaxId);
            toast(t("mail.sim_done"), "success");
        } catch {
            toast(t("mail.sim_failed"), "error");
        } finally {
            setSimulating(false);
        }
    };

    return (
        <PageLayout>
            <PageHeader title={t("nav.i.email")} subtitle={t("mail.subtitle")}>
                {/* Demo-only: simulating an incoming email does not exist against the backend. */}
                {DATA_SOURCE !== "api" && (
                    <Button size="md" variant="brand" icon={<MailPlus />} onClick={simulate} disabled={simulating}>
                        {simulating ? t("mail.receiving") : t("mail.simulate")}
                    </Button>
                )}
            </PageHeader>

            <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-lg bg-wb-bg-card p-4 shadow-wb-card lg:col-span-1">
                    <div className="flex items-center gap-2">
                        <AtSign className="size-5 text-brand" />
                        <p className="text-wb-14 font-semibold">{t("mail.inbound_title")}</p>
                        <StatusPill size="sm" variant="success" label={t("mail.recommended")} className="ml-auto" />
                    </div>
                    <p className="mt-2 text-wb-12 leading-5 text-wb-ntrl-6">{t("mail.inbound_hint")}</p>
                    <div className="mt-3 flex items-center gap-2 rounded-md bg-white px-3 py-2 shadow-wb-outline">
                        <span className="min-w-0 flex-1 truncate font-mono text-wb-13 font-semibold text-brand">{address || "—"}</span>
                        <button
                            className="cursor-pointer text-wb-ntrl-6 hover:text-brand disabled:cursor-default disabled:opacity-40"
                            disabled={!address}
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(address);
                                } catch {
                                    /* ignore */
                                }
                                setCopied(true);
                                setTimeout(() => setCopied(false), 1200);
                            }}
                        >
                            {copied ? <CheckCircle2 className="size-4 text-wb-status-approved-text" /> : <Copy className="size-4" />}
                        </button>
                    </div>
                    {unconfigured && <p className="mt-2 text-wb-12 text-wb-warn-text">{t("mail.address_unconfigured")}</p>}
                </div>
                <div className="lg:col-span-2">
                    <MailboxSummary />
                </div>
            </div>

            <div className="overflow-hidden rounded-lg shadow-wb-card">
                <div className="flex items-center justify-between border-b border-wb-border-sidebar px-4 py-3">
                    <h3 className="text-wb-14 font-semibold">{t("mail.inbox")}</h3>
                    <span className="text-wb-12 text-wb-ntrl-6">{t("mail.inbox_hint")}</span>
                </div>
                <div className="custom-scrollbar overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-wb-13">
                        <thead>
                            <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar text-left font-semibold text-wb-ntrl-8">
                                <th className="px-3">{t("mail.col.received")}</th>
                                <th className="px-3">{t("mail.col.from")}</th>
                                <th className="px-3">{t("mail.col.subject")}</th>
                                <th className="px-3">{t("mail.col.attachments")}</th>
                                <th className="px-3">{t("mail.col.invoice")}</th>
                                <th className="px-3">{t("up.col.result")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {emails.map((m) => (
                                <tr key={m.id} className="h-[var(--h-wb-table-row)] border-b border-wb-table-border font-medium">
                                    <td className="px-3 whitespace-nowrap text-wb-ntrl-7">{fmtDateTime(m.receivedAt)}</td>
                                    <td className="px-3">{m.from}</td>
                                    <td className="max-w-[300px] truncate px-3" title={m.subject}>{m.subject}</td>
                                    <td className="px-3">
                                        {m.attachments.length ? (
                                            <span className="flex items-center gap-1 text-wb-ntrl-7" title={m.attachments.join("\n")}>
                                                <Paperclip className="size-3.5" />
                                                {m.attachments.map((a) => a.split(".").pop()?.toUpperCase()).join(", ")}
                                            </span>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                    <td className="px-3 text-wb-12">
                                        <InvoiceRef id={m.invoiceRef} />
                                    </td>
                                    <td className="px-3"><StatusPill size="sm" variant={V[resultOf(m)]} label={t(`mail.r.${resultOf(m)}`)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </PageLayout>
    );
}

/** Email → linked invoice as "Ký hiệu · Số" (opens the invoice detail); "—" when there is none. */
function InvoiceRef({ id }: { id?: string }) {
    const inv = id ? getInvoice(id) : undefined;
    if (!inv) return <>—</>;
    return (
        <Link className="font-mono text-brand hover:underline" href={`/invoices/${inv.direction}/?open=${inv.id}`}>
            {inv.templateNo}
            {inv.symbol} · {inv.number}
        </Link>
    );
}

"use client";

import { CheckCircle2, ChevronDown, ExternalLink, Eye, EyeOff, HelpCircle, KeyRound, Loader2, Mail, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/shared/dialog";
import { Modal } from "@/components/shared/Modal";
import { EmptyState } from "@/components/shared/EmptyState";
import { connectMailbox, disconnectMailbox, mailboxesAvailable, scanMailbox, validateAppPassword, validateMailAddress, type MailProvider } from "@/lib/api/weinvoice/mailbox";
import { fmtDateTime } from "@/lib/weinvoice/format";
import { useTranslation } from "@/lib/i18n";
import { useStore } from "@/lib/api/weinvoice/store";
import { cn } from "@/lib/utils";

/**
 * Nguồn → Hoá đơn từ email → connect a mailbox (same flow as Invoy /gmail):
 *  - Gmail / Google Workspace: address + 16-char App Password (IMAP, read-only) — no Google CASA review needed.
 *  - Outlook / Microsoft 365: Microsoft sign-in (OAuth, Mail.Read) — basic-auth IMAP is disabled by Microsoft.
 * MVP: simulated; the app password is validated for format only and NEVER stored.
 * api mode: mailbox connections are not in the published API — a "not available on the server yet"
 * state is shown instead of the forms (no request is sent).
 */
export function MailboxConnect({ variant = "card" }: { variant?: "card" | "page" }) {
    const { t } = useTranslation();
    const { toast } = useDialog();
    const activeTaxId = useStore((s) => s.activeTaxId);
    const all = useStore((s) => s.mailboxes); // select the raw array (stable ref) — filtering inside the selector loops useSyncExternalStore
    const boxes = useMemo(() => (all ?? []).filter((m) => m.taxId === activeTaxId), [all, activeTaxId]);
    const [tab, setTab] = useState<MailProvider>("gmail");
    const box = boxes.find((b) => b.provider === tab);

    if (!mailboxesAvailable()) {
        return (
            <div className={cn("flex flex-col", variant === "page" ? "rounded-lg bg-white shadow-wb-card" : "rounded-lg bg-wb-bg-card shadow-wb-card")}>
                <EmptyState icon={<Mail />} title={t("mbx.title")} hint={t("common.not_on_server")} />
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col", variant === "page" ? "gap-4" : "gap-3 rounded-lg bg-wb-bg-card p-4 shadow-wb-card")}>
            {variant === "card" && (
                <div>
                    <p className="text-wb-14 font-semibold">{t("mbx.title")}</p>
                    <p className="text-wb-12 text-wb-ntrl-6">{t("mbx.subtitle")}</p>
                </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
                {(["gmail", "outlook"] as const).map((p) => {
                    const b = boxes.find((x) => x.provider === p);
                    const on = tab === p;
                    return (
                        <button
                            key={p}
                            type="button"
                            onClick={() => setTab(p)}
                            className={cn(
                                cn("flex cursor-pointer items-center gap-3 rounded-lg border-2 text-left transition-colors", variant === "page" ? "px-5 py-4" : "px-4 py-3"),
                                on ? "border-brand bg-brand-soft" : "border-wb-border-sidebar bg-white hover:border-brand/40",
                            )}
                        >
                            <span className={cn("flex size-9 items-center justify-center rounded-md", on ? "bg-brand text-white" : "bg-wb-bg-sidebar text-wb-ntrl-6")}>
                                <Mail className="size-5" />
                            </span>
                            <span className="min-w-0">
                                <span className="flex items-center gap-2 text-wb-14 font-semibold text-wb-ink">
                                    {p === "gmail" ? "Gmail" : "Outlook / Microsoft 365"}
                                    {p === "outlook" && <span className="rounded-sm bg-brand px-1.5 text-wb-10 leading-4 font-bold text-white">{t("mbx.new")}</span>}
                                </span>
                                <span className={cn("block truncate text-wb-12", b ? "font-medium text-wb-status-approved-text" : "text-wb-ntrl-6")}>
                                    {b ? `${t("mail.connected")} · ${b.address}` : t("mail.not_connected")}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {box ? (
                <ConnectedBox
                    box={box}
                    onScan={async () => {
                        try {
                            const r = await scanMailbox(box.id);
                            toast(t("mbx.scan_done", { n: r.found }), "success");
                        } catch {
                            toast(t("mbx.scan_failed"), "error");
                        }
                    }}
                    onDisconnect={async () => {
                        try {
                            await disconnectMailbox(box.id);
                            toast(t("mbx.disconnected"));
                        } catch (e) {
                            toast((e as Error).message, "error");
                        }
                    }}
                />
            ) : tab === "gmail" ? (
                <GmailForm taxId={activeTaxId} />
            ) : (
                <OutlookForm taxId={activeTaxId} />
            )}
        </div>
    );
}

function ConnectedBox({ box, onScan, onDisconnect }: { box: { address: string; provider: MailProvider; connectedAt: string; lastScanAt?: string; method: string }; onScan: () => Promise<void>; onDisconnect: () => Promise<void> }) {
    const { t } = useTranslation();
    const { confirm } = useDialog();
    const [busy, setBusy] = useState(false);
    return (
        <div className="rounded-lg border border-wb-border-sidebar bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
                <CheckCircle2 className="size-5 text-wb-status-approved-text" />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-wb-14 font-semibold">{box.address}</p>
                    <p className="text-wb-12 text-wb-ntrl-6">
                        {t(`mbx.method.${box.method}`)} · {t("mbx.connected_at", { d: fmtDateTime(box.connectedAt) })}
                        {box.lastScanAt && <> · {t("mbx.last_scan", { d: fmtDateTime(box.lastScanAt) })}</>}
                    </p>
                </div>
                <Button
                    size="wb-sm"
                    variant="brand"
                    icon={busy ? <Loader2 className="wb-spin" /> : <RefreshCw />}
                    disabled={busy}
                    onClick={async () => {
                        setBusy(true);
                        await onScan();
                        setBusy(false);
                    }}
                >
                    {busy ? t("mbx.scanning") : t("mbx.scan")}
                </Button>
                <Button
                    size="wb-sm"
                    variant="neutral"
                    icon={<Unplug />}
                    onClick={async () => {
                        if (await confirm({ title: t("mail.disconnect"), message: t("mbx.disconnect_confirm", { a: box.address }), danger: true, confirmLabel: t("mail.disconnect") })) await onDisconnect();
                    }}
                >
                    {t("mail.disconnect")}
                </Button>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-wb-12 text-wb-ntrl-6">
                <ShieldCheck className="size-4 text-wb-status-approved-text" />
                {t("mbx.readonly")}
            </p>
        </div>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-wb-13 font-semibold text-wb-ntrl-8">{label}</span>
            {children}
            {error && <span className="text-wb-12 text-wb-status-error-text">{error}</span>}
        </label>
    );
}
const inputCls = (err?: string) => cn("h-10 w-full rounded-md bg-white px-3 text-wb-14 shadow-wb-outline outline-none focus:shadow-wb-focus", err && "shadow-[0_0_0_1px_#c50712]");

function GmailForm({ taxId }: { taxId: string }) {
    const { t } = useTranslation();
    const { toast } = useDialog();
    const [address, setAddress] = useState("");
    const [pw, setPw] = useState("");
    const [show, setShow] = useState(false);
    const [errs, setErrs] = useState<{ a?: string; p?: string; server?: string }>({});
    const [busy, setBusy] = useState("");
    const [guide, setGuide] = useState(true);

    const submit = async () => {
        const e = { a: validateMailAddress(address) ? undefined : t("mbx.err_address"), p: validateAppPassword(pw) ? undefined : t("mbx.err_pw") };
        setErrs(e);
        if (e.a || e.p) return;
        let r: Awaited<ReturnType<typeof connectMailbox>>;
        try {
            r = await connectMailbox({ taxId, provider: "gmail", address: address.trim(), appPassword: pw }, (s) => setBusy(t(`mbx.step.${s}`)));
        } catch (err) {
            setErrs({ server: (err as Error).message });
            return;
        } finally {
            setBusy("");
            setPw(""); // never kept in the browser after the attempt
        }
        if (!r.ok) {
            setErrs({ server: t(`mbx.err.${r.error}`) });
            return;
        }
        toast(t("mbx.connected_toast", { a: address.trim() }));
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-wb-border-sidebar bg-white p-4">
                <p className="mb-3 flex items-center gap-2 text-wb-14 font-semibold">
                    <KeyRound className="size-4 text-brand" />
                    {t("mbx.gmail_title")}
                </p>
                <div className="grid gap-3">
                    <Field label={t("mbx.gmail_address")} error={errs.a}>
                        <input className={inputCls(errs.a)} type="email" autoComplete="off" placeholder="ban@gmail.com" value={address} onChange={(e) => setAddress(e.target.value)} />
                    </Field>
                    <Field label={t("mbx.app_pw")} error={errs.p}>
                        <span className="relative">
                            <input
                                className={cn(inputCls(errs.p), "pr-10 font-mono tracking-wider")}
                                type={show ? "text" : "password"}
                                autoComplete="new-password"
                                placeholder="vd: abcd efgh ijkl mnop"
                                value={pw}
                                onChange={(e) => setPw(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && submit()}
                            />
                            <button type="button" onClick={() => setShow((v) => !v)} className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer p-1 text-wb-ntrl-6 hover:text-brand" aria-label="toggle">
                                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                        </span>
                    </Field>
                    {errs.server && <p className="rounded-md bg-wb-status-rejected-bg px-3 py-2 text-wb-12 text-wb-status-rejected-text">{errs.server}</p>}
                    <div className="flex flex-wrap items-center gap-3">
                        <Button size="md" variant="primary" icon={busy ? <Loader2 className="wb-spin" /> : <Mail />} onClick={submit} disabled={!!busy}>
                            {busy || t("mail.connect")}
                        </Button>
                    </div>
                    <p className="flex items-start gap-1.5 text-wb-12 text-wb-ntrl-6">
                        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-wb-status-approved-text" />
                        {t("mbx.gmail_safe")}
                    </p>
                </div>
            </div>

            <div className="rounded-lg border border-wb-border-sidebar bg-white">
                <button type="button" onClick={() => setGuide((v) => !v)} className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left">
                    <HelpCircle className="size-5 text-brand" />
                    <span className="flex-1 text-wb-14 font-semibold">{t("mbx.guide_title")}</span>
                    <ChevronDown className={cn("size-4 text-wb-ntrl-6 transition-transform", guide && "rotate-180")} />
                </button>
                {guide && (
                    <div className="border-t border-wb-border-sidebar px-4 py-3">
                        <p className="mb-3 text-wb-13 text-wb-ntrl-8">{t("mbx.guide_intro")}</p>
                        <ol className="flex flex-col gap-3">
                            {[1, 2, 3, 4].map((n) => (
                                <li key={n} className="flex items-start gap-3 text-wb-13 text-wb-ntrl-8">
                                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-wb-12 font-bold text-white">{n}</span>
                                    <span className="pt-0.5">
                                        {t(`mbx.guide_${n}`)}
                                        {n === 1 && <GuideLink href="https://myaccount.google.com/signinoptions/twosv" label={t("mbx.link_2sv")} />}
                                        {n === 2 && <GuideLink href="https://myaccount.google.com/apppasswords" label={t("mbx.link_apppw")} />}
                                    </span>
                                </li>
                            ))}
                        </ol>
                        <p className="mt-3 rounded-md bg-wb-bg-sidebar px-3 py-2 text-wb-12 text-wb-ntrl-7">{t("mbx.guide_note")}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function GuideLink({ href, label }: { href: string; label: string }) {
    return (
        <a href={href} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 font-semibold text-brand hover:underline">
            {label}
            <ExternalLink className="size-3" />
        </a>
    );
}

function OutlookForm({ taxId }: { taxId: string }) {
    const { t } = useTranslation();
    const { toast } = useDialog();
    const [open, setOpen] = useState(false);
    const [address, setAddress] = useState("");
    const [err, setErr] = useState("");
    /** Mock only (api mode never renders this form): the simulated Microsoft consent dialog. */
    const signIn = () => setOpen(true);
    return (
        <div className="rounded-lg border border-wb-border-sidebar bg-white p-4">
            <p className="mb-1 flex items-center gap-2 text-wb-14 font-semibold">
                <KeyRound className="size-4 text-brand" />
                {t("mbx.outlook_title")}
            </p>
            <p className="mb-3 text-wb-12 text-wb-ntrl-6">{t("mbx.outlook_hint")}</p>
            <Button size="md" variant="primary" icon={<Mail />} onClick={signIn}>
                {t("mbx.ms_signin")}
            </Button>
            <p className="mt-3 flex items-start gap-1.5 text-wb-12 text-wb-ntrl-6">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-wb-status-approved-text" />
                {t("mbx.outlook_safe")}
            </p>
            <Modal
                open={open}
                onClose={() => setOpen(false)}
                width={460}
                title={t("mail.oauth_title", { p: "Microsoft" })}
                footer={
                    <>
                        <Button size="md" variant="neutral" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
                        <Button size="md"
                            variant="primary"
                            onClick={async () => {
                                if (!validateMailAddress(address)) return setErr(t("mbx.err_address"));
                                await connectMailbox({ taxId, provider: "outlook", address: address.trim() });
                                toast(t("mbx.connected_toast", { a: address.trim() }));
                                setOpen(false);
                            }}
                        >
                            {t("mail.allow_demo")}
                        </Button>
                    </>
                }
            >
                <Field label={t("mbx.ms_address")} error={err}>
                    <input className={inputCls(err)} type="email" placeholder="ketoan@congty.com" value={address} onChange={(e) => setAddress(e.target.value)} />
                </Field>
                <p className="mt-3 text-wb-13 leading-5 text-wb-ntrl-7">{t("mail.oauth_msg")}</p>
                <ul className="mt-2 list-disc pl-5 text-wb-13 text-wb-ntrl-7">
                    <li>{t("mbx.ms_scope")}</li>
                    <li>{t("mail.scope2")}</li>
                </ul>
                <p className="mt-3 rounded-md bg-wb-warn-bg px-3 py-2 text-wb-12 text-wb-warn-text">{t("mail.oauth_note")}</p>
            </Modal>
        </div>
    );
}


"use client";

import {
    AtSign,
    CheckCircle2,
    ChevronDown,
    Cloud,
    Copy,
    ExternalLink,
    Eye,
    EyeOff,
    Forward,
    HelpCircle,
    KeyRound,
    Loader2,
    LogIn,
    Mail,
    Pencil,
    RefreshCw,
    Server,
    ShieldCheck,
    Unplug,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/shared/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Modal } from "@/components/shared/Modal";
import { Select } from "@/components/shared/Select";
import { StatusPill, type StatusPillVariant } from "@/components/shared/StatusPill";
import {
    DEFAULT_IMAP_PORT,
    GMAIL_HOST,
    appliesTo,
    connectMailbox,
    connectMicrosoftDemo,
    disconnectMailbox,
    getEmailAddress,
    loadMailboxes,
    mailboxesRemote,
    microsoftAuthorize,
    microsoftSignInIsDemo,
    parseFolders,
    readMicrosoftReturn,
    scanMailbox,
    stripMicrosoftReturn,
    updateMailbox,
    validateMailAddress,
    validateMailboxInput,
    type Mailbox,
    type MailboxFieldErrors,
    type MailboxInput,
    type MailboxScope,
    type MailboxStatus,
    type TlsMode,
} from "@/lib/api/weinvoice/mailbox";
import { useStore } from "@/lib/api/weinvoice/store";
import { fmtDateTime } from "@/lib/weinvoice/format";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Invoices › Sources › Kết nối email (approved layout, feature record
 * docs/features/weinvoice/weinvoice-mailbox-connections-2026-11-12.md):
 *  - 4 tiles: Gmail (App Password) · Outlook / Microsoft 365 (Microsoft sign-in) · company mail (IMAP)
 *    · forwarding address (no password);
 *  - the panel of the selected tile; "Check and connect" logs in once (backend → engine), saved only if it works;
 *  - the list of connected mailboxes: status, last scan, Scan now · Edit · Disconnect (· Sign in again).
 * Secrets live only in the input while typing and are cleared after every attempt (§3.10).
 */
type Tile = "gmail" | "outlook" | "imap" | "forward";
const TILES: { id: Tile; icon: ReactNode }[] = [
    { id: "gmail", icon: <Mail /> },
    { id: "outlook", icon: <Cloud /> },
    { id: "imap", icon: <Server /> },
    { id: "forward", icon: <Forward /> },
];
const KIND_ICON: Record<Mailbox["provider"], ReactNode> = { gmail: <Mail />, outlook: <Cloud />, imap: <Server /> };
const STATUS_PILL: Record<MailboxStatus, StatusPillVariant> = { connected: "success", error: "failed", expired: "warning" };

type LoadState = { status: "loading" | "ready" } | { status: "error"; message: string };

export function MailboxConnect() {
    const { t } = useTranslation();
    const { toast, alert } = useDialog();
    const activeTaxId = useStore((s) => s.activeTaxId);
    const all = useStore((s) => s.mailboxes); // select the raw array (stable ref) — filtering inside the selector loops useSyncExternalStore
    const boxes = useMemo(() => (all ?? []).filter((m) => appliesTo(m, activeTaxId)), [all, activeTaxId]);
    const [tile, setTile] = useState<Tile>("gmail");
    const [editing, setEditing] = useState<Mailbox | null>(null);
    const [load, setLoad] = useState<LoadState>(() => (mailboxesRemote() ? { status: "loading" } : { status: "ready" }));

    const reload = () =>
        loadMailboxes().then(
            () => setLoad({ status: "ready" }),
            (e: Error) => setLoad({ status: "error", message: e.message }),
        );

    // Once on mount: the Microsoft return (`?ms=ok` / `?ms=error&reason=`) → message + clean URL; then load the list.
    useEffect(() => {
        const ret = readMicrosoftReturn(window.location.search);
        if (ret) {
            window.history.replaceState(null, "", stripMicrosoftReturn(window.location.href));
            if (ret.status === "ok") toast(t("mbx.ms_ok"), "success");
            else {
                const key = `mbx.ms_reason.${ret.reason}`;
                const reason = t(key);
                void alert({ title: t("mbx.ms_error_title"), message: reason === key ? t("mbx.ms_error", { r: ret.reason }) : reason, kind: "error" }).then(() => setTile("outlook"));
            }
        }
        if (mailboxesRemote()) void reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
    }, []);

    const pick = (id: Tile) => {
        setTile(id);
        setEditing(null);
    };
    const edit = (b: Mailbox) => {
        setTile(b.provider);
        setEditing(b);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label={t("mbx.tiles_label")}>
                {TILES.map(({ id, icon }) => {
                    const on = tile === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => pick(id)}
                            className={cn(
                                "flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                                on ? "border-brand bg-brand-soft" : "border-wb-border-sidebar bg-white hover:border-brand/40",
                            )}
                        >
                            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md [&_svg]:size-5", on ? "bg-brand text-white" : "bg-wb-bg-sidebar text-wb-ntrl-6")}>{icon}</span>
                            <span className="min-w-0">
                                <span className="block truncate text-wb-14 font-semibold text-wb-ink">{t(`mbx.tile.${id}`)}</span>
                                <span className="block truncate text-wb-12 text-wb-ntrl-6">{t(`mbx.tile.${id}_sub`)}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {tile === "gmail" || tile === "imap" ? (
                <PasswordForm key={`${tile}-${editing?.id ?? "new"}`} kind={tile} taxId={activeTaxId} editing={editing?.provider === tile ? editing : null} onDone={() => setEditing(null)} />
            ) : tile === "outlook" ? (
                <MicrosoftPanel key={`ms-${editing?.id ?? "new"}`} taxId={activeTaxId} reauth={editing?.provider === "outlook" ? editing : null} onDone={() => setEditing(null)} />
            ) : (
                <ForwardPanel taxId={activeTaxId} />
            )}

            <ConnectedList boxes={boxes} load={load} onRetry={() => {
                    setLoad({ status: "loading" });
                    void reload();
                }} onEdit={edit} />
        </div>
    );
}

/* ------------------------------------------------------------------ shared bits */

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
    return (
        <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-wb-13 font-semibold text-wb-ntrl-8">{label}</span>
            {children}
            {error ? <span className="text-wb-12 text-wb-status-error-text">{error}</span> : hint ? <span className="text-wb-12 text-wb-ntrl-6">{hint}</span> : null}
        </label>
    );
}
const inputCls = (err?: string) => cn("h-10 w-full rounded-md bg-white px-3 text-wb-14 shadow-wb-outline outline-none focus:shadow-wb-focus disabled:bg-wb-bg-sidebar disabled:text-wb-ntrl-6", err && "shadow-[0_0_0_1px_#c50712]");

function PanelCard({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: string; children: ReactNode }) {
    return (
        <div className="rounded-lg border border-wb-border-sidebar bg-white p-4">
            <p className="mb-1 flex items-center gap-2 text-wb-14 font-semibold [&_svg]:size-4 [&_svg]:text-brand">
                {icon}
                {title}
            </p>
            {hint && <p className="mb-3 text-wb-12 leading-5 text-wb-ntrl-6">{hint}</p>}
            <div className={cn("grid gap-3", !hint && "mt-3")}>{children}</div>
        </div>
    );
}

/** "Applies to MST" + "Folders to scan" — shared by the Gmail, IMAP and Microsoft forms. */
function ScopeFolders({ taxId, scope, setScope, folders, setFolders }: { taxId: string; scope: MailboxScope; setScope: (s: MailboxScope) => void; folders: string; setFolders: (s: string) => void }) {
    const { t } = useTranslation();
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("mbx.scope")}>
                <Select<MailboxScope>
                    fullWidth
                    value={scope}
                    onChange={setScope}
                    options={[
                        { value: "one", label: t("mbx.scope_one", { mst: taxId }) },
                        { value: "all", label: t("mbx.scope_all") },
                    ]}
                />
            </Field>
            <Field label={t("mbx.folders")} hint={t("mbx.folders_hint")}>
                <input className={inputCls()} autoComplete="off" placeholder="INBOX" value={folders} onChange={(e) => setFolders(e.target.value)} />
            </Field>
        </div>
    );
}

function SecretInput({ value, onChange, placeholder, error, mono, onEnter }: { value: string; onChange: (v: string) => void; placeholder?: string; error?: string; mono?: boolean; onEnter?: () => void }) {
    const { t } = useTranslation();
    const [show, setShow] = useState(false);
    return (
        <span className="relative">
            <input
                className={cn(inputCls(error), "pr-10", mono && "font-mono tracking-wider")}
                type={show ? "text" : "password"}
                autoComplete="new-password"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer p-1 text-wb-ntrl-6 hover:text-brand" aria-label={t("mbx.toggle_pw")}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
        </span>
    );
}

const fieldMsg = (t: (k: string) => string, kind: MailboxInput["provider"], errs: MailboxFieldErrors) => ({
    address: errs.address && t("mbx.err_address"),
    password: errs.password === "required" ? t("mbx.err_pw_required") : errs.password && (kind === "gmail" ? t("mbx.err_pw") : t("mbx.err_pw_required")),
    imapHost: errs.imapHost && t("mbx.err_host"),
    imapPort: errs.imapPort && t("mbx.err_port"),
});

/* ------------------------------------------------------------------ Gmail / IMAP */

function PasswordForm({ kind, taxId, editing, onDone }: { kind: "gmail" | "imap"; taxId: string; editing: Mailbox | null; onDone: () => void }) {
    const { t } = useTranslation();
    const { toast } = useDialog();
    const isEdit = !!editing;
    const [address, setAddress] = useState(editing?.address ?? "");
    const [pw, setPw] = useState("");
    const [host, setHost] = useState(editing?.imapHost ?? "");
    const [port, setPort] = useState(String(editing?.imapPort ?? DEFAULT_IMAP_PORT));
    const [tls, setTls] = useState<TlsMode>(editing?.tlsMode ?? "ssl");
    const [login, setLogin] = useState(editing?.loginId && editing.loginId !== editing.address ? editing.loginId : "");
    const [scope, setScope] = useState<MailboxScope>(editing?.scope ?? "one");
    const [folders, setFolders] = useState((editing?.folders ?? ["INBOX"]).join(","));
    const [errs, setErrs] = useState<ReturnType<typeof fieldMsg> & { server?: string }>({ address: undefined, password: undefined, imapHost: undefined, imapPort: undefined });
    const [busy, setBusy] = useState("");
    const [guide, setGuide] = useState(!isEdit);

    const submit = async () => {
        if (busy) return;
        const input: MailboxInput = { provider: kind, address, password: pw, imapHost: host, imapPort: port, tlsMode: tls, loginId: login, folders: parseFolders(folders), scope, taxId };
        const fe = validateMailboxInput(input, isEdit ? "edit" : "create");
        const msgs = fieldMsg(t, kind, fe);
        setErrs(msgs);
        if (Object.values(msgs).some(Boolean)) return;
        setBusy(t("mbx.checking"));
        try {
            const onStep = (s: string) => setBusy(t(`mbx.step.${s}`, { h: kind === "gmail" ? GMAIL_HOST : host.trim() }));
            const r = editing ? await updateMailbox(editing.id, input, onStep) : await connectMailbox(input, onStep);
            if (!r.ok) {
                setErrs((e) => ({ ...e, server: t(`mbx.err.${r.error}`) }));
                return;
            }
            toast(t(isEdit ? "mbx.saved_toast" : "mbx.connected_toast", { a: r.box.address }), "success");
            onDone();
            if (!isEdit) {
                setAddress("");
                setHost("");
                setLogin("");
            }
        } catch (err) {
            setErrs((e) => ({ ...e, server: (err as Error).message }));
        } finally {
            setBusy("");
            setPw(""); // never kept in the browser after the attempt (§3.10)
        }
    };

    const pwLabel = kind === "gmail" ? t("mbx.app_pw") : t("mbx.imap_pw");
    return (
        <div className="flex flex-col gap-3">
            <PanelCard
                icon={kind === "gmail" ? <KeyRound /> : <Server />}
                title={editing ? t("mbx.edit_title", { a: editing.address }) : kind === "gmail" ? t("mbx.gmail_title") : t("mbx.imap_title")}
                hint={kind === "imap" ? t("mbx.imap_hint") : undefined}
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={kind === "gmail" ? t("mbx.gmail_address") : t("mbx.imap_address")} error={errs.address}>
                        <input className={inputCls(errs.address)} type="email" autoComplete="off" disabled={isEdit} placeholder={kind === "gmail" ? "ban@gmail.com" : "ketoan@congty.vn"} value={address} onChange={(e) => setAddress(e.target.value)} />
                    </Field>
                    {kind === "imap" && (
                        <Field label={t("mbx.imap_login")}>
                            <input className={inputCls()} autoComplete="off" placeholder={t("mbx.imap_login_ph")} value={login} onChange={(e) => setLogin(e.target.value)} />
                        </Field>
                    )}
                    {kind === "imap" && (
                        <Field label={t("mbx.imap_host")} error={errs.imapHost}>
                            <input className={inputCls(errs.imapHost)} autoComplete="off" placeholder="mail.congty.vn" value={host} onChange={(e) => setHost(e.target.value)} />
                        </Field>
                    )}
                    {kind === "imap" && (
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={t("mbx.imap_port")} error={errs.imapPort}>
                                <input className={inputCls(errs.imapPort)} inputMode="numeric" autoComplete="off" value={port} onChange={(e) => setPort(e.target.value)} />
                            </Field>
                            <Field label={t("mbx.imap_tls")}>
                                <Select<TlsMode>
                                    fullWidth
                                    value={tls}
                                    onChange={setTls}
                                    options={[
                                        { value: "ssl", label: t("mbx.tls.ssl") },
                                        { value: "starttls", label: t("mbx.tls.starttls") },
                                    ]}
                                />
                            </Field>
                        </div>
                    )}
                    <Field label={pwLabel} error={errs.password} hint={isEdit ? t("mbx.pw_keep") : undefined}>
                        <SecretInput value={pw} onChange={setPw} error={errs.password} mono={kind === "gmail"} placeholder={kind === "gmail" ? t("mbx.app_pw_ph") : undefined} onEnter={submit} />
                    </Field>
                </div>
                <ScopeFolders taxId={taxId} scope={scope} setScope={setScope} folders={folders} setFolders={setFolders} />
                {errs.server && (
                    <p role="alert" className="rounded-md bg-wb-status-rejected-bg px-3 py-2 text-wb-12 text-wb-status-rejected-text">
                        {errs.server}
                    </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                    <Button size="md" variant="primary" icon={busy ? <Loader2 className="wb-spin" /> : <CheckCircle2 />} onClick={submit} disabled={!!busy}>
                        {busy || (isEdit ? t("mbx.check_save") : t("mbx.check_connect"))}
                    </Button>
                    {isEdit && (
                        <Button size="md" variant="neutral" onClick={onDone} disabled={!!busy}>
                            {t("common.cancel")}
                        </Button>
                    )}
                </div>
                <p className="flex items-start gap-1.5 text-wb-12 text-wb-ntrl-6">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-wb-status-approved-text" />
                    {t("mbx.check_note")}
                </p>
            </PanelCard>

            {kind === "gmail" && (
                <div className="rounded-lg border border-wb-border-sidebar bg-white">
                    <button type="button" aria-expanded={guide} onClick={() => setGuide((v) => !v)} className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left">
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
            )}
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

/* ------------------------------------------------------------------ Outlook / Microsoft 365 */

function MicrosoftPanel({ taxId, reauth, onDone }: { taxId: string; reauth: Mailbox | null; onDone: () => void }) {
    const { t } = useTranslation();
    const { toast, alert } = useDialog();
    const [scope, setScope] = useState<MailboxScope>(reauth?.scope ?? "one");
    const [folders, setFolders] = useState((reauth?.folders ?? ["INBOX"]).join(","));
    const [busy, setBusy] = useState(false);
    // mock only: the simulated Microsoft consent dialog
    const [demoOpen, setDemoOpen] = useState(false);
    const [demoAddress, setDemoAddress] = useState(reauth?.address ?? "");
    const [demoErr, setDemoErr] = useState("");

    const signIn = async () => {
        if (microsoftSignInIsDemo()) return setDemoOpen(true);
        setBusy(true);
        try {
            const r = await microsoftAuthorize({ scope, taxId, folders: parseFolders(folders) });
            if (r.ok) {
                window.location.assign(r.url); // leaves the app; the backend callback returns to /sources/mailbox?ms=…
                return;
            }
            await alert({ title: t("mbx.ms_not_configured_title"), message: t("mbx.ms_not_configured"), kind: "info" });
        } catch (err) {
            await alert({ title: t("mbx.ms_error_title"), message: (err as Error).message, kind: "error" });
        } finally {
            setBusy(false);
        }
    };

    return (
        <PanelCard icon={<Cloud />} title={reauth ? t("mbx.ms_reauth", { a: reauth.address }) : t("mbx.outlook_title")} hint={t("mbx.outlook_hint")}>
            <ScopeFolders taxId={taxId} scope={scope} setScope={setScope} folders={folders} setFolders={setFolders} />
            <div className="flex flex-wrap items-center gap-3">
                <Button size="md" variant="primary" icon={busy ? <Loader2 className="wb-spin" /> : <LogIn />} onClick={signIn} disabled={busy}>
                    {t("mbx.ms_signin")}
                </Button>
                {reauth && (
                    <Button size="md" variant="neutral" onClick={onDone} disabled={busy}>
                        {t("common.cancel")}
                    </Button>
                )}
            </div>
            <p className="rounded-md bg-wb-warn-bg px-3 py-2 text-wb-12 text-wb-warn-text">{t("mbx.ms_admin_note")}</p>
            <p className="flex items-start gap-1.5 text-wb-12 text-wb-ntrl-6">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-wb-status-approved-text" />
                {t("mbx.outlook_safe")}
            </p>
            <Modal
                open={demoOpen}
                onClose={() => setDemoOpen(false)}
                width={460}
                title={t("mail.oauth_title", { p: "Microsoft" })}
                footer={
                    <>
                        <Button size="md" variant="neutral" onClick={() => setDemoOpen(false)}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            size="md"
                            variant="primary"
                            onClick={async () => {
                                if (!validateMailAddress(demoAddress)) return setDemoErr(t("mbx.err_address"));
                                const box = await connectMicrosoftDemo({ address: demoAddress, scope, taxId, folders: parseFolders(folders) });
                                toast(t("mbx.connected_toast", { a: box.address }), "success");
                                setDemoOpen(false);
                                onDone();
                            }}
                        >
                            {t("mail.allow_demo")}
                        </Button>
                    </>
                }
            >
                <Field label={t("mbx.ms_address")} error={demoErr}>
                    <input className={inputCls(demoErr)} type="email" placeholder="ketoan@congty.com" value={demoAddress} onChange={(e) => setDemoAddress(e.target.value)} />
                </Field>
                <p className="mt-3 text-wb-13 leading-5 text-wb-ntrl-7">{t("mail.oauth_msg")}</p>
                <ul className="mt-2 list-disc pl-5 text-wb-13 text-wb-ntrl-7">
                    <li>{t("mbx.ms_scope")}</li>
                    <li>{t("mail.scope2")}</li>
                </ul>
                <p className="mt-3 rounded-md bg-wb-warn-bg px-3 py-2 text-wb-12 text-wb-warn-text">{t("mail.oauth_note")}</p>
            </Modal>
        </PanelCard>
    );
}

/* ------------------------------------------------------------------ Forwarding */

function ForwardPanel({ taxId }: { taxId: string }) {
    const { t } = useTranslation();
    const { toast } = useDialog();
    const [res, setRes] = useState<{ taxId: string; address: string; configured: boolean; failed?: boolean } | null>(null);
    useEffect(() => {
        if (!taxId) return;
        let live = true;
        getEmailAddress(taxId).then(
            (a) => live && setRes({ taxId, address: a.address ?? "", configured: a.configured }),
            () => live && setRes({ taxId, address: "", configured: true, failed: true }),
        );
        return () => {
            live = false;
        };
    }, [taxId]);
    const cur = res?.taxId === taxId ? res : null;
    return (
        <PanelCard icon={<AtSign />} title={t("mail.inbound_title")} hint={t("mail.inbound_hint")}>
            <div className="flex min-w-0 items-center gap-2 rounded-md bg-white px-3 py-2 shadow-wb-outline">
                <span className="min-w-0 flex-1 truncate font-mono text-wb-13 font-semibold text-brand">{cur ? cur.address || "—" : t("common.loading")}</span>
                <Button
                    size="wb-sm"
                    variant="neutral"
                    icon={<Copy />}
                    disabled={!cur?.address}
                    onClick={async () => {
                        try {
                            await navigator.clipboard.writeText(cur?.address ?? "");
                            toast(t("mbx.copied"), "success");
                        } catch {
                            /* clipboard blocked — the address stays visible for manual copy */
                        }
                    }}
                >
                    {t("mbx.copy")}
                </Button>
            </div>
            {cur && !cur.configured && <p className="text-wb-12 text-wb-warn-text">{t("mail.address_unconfigured")}</p>}
            {cur?.failed && <p className="text-wb-12 text-wb-status-error-text">{t("mbx.forward_failed")}</p>}
        </PanelCard>
    );
}

/* ------------------------------------------------------------------ connected list */

function ConnectedList({ boxes, load, onRetry, onEdit }: { boxes: Mailbox[]; load: LoadState; onRetry: () => void; onEdit: (b: Mailbox) => void }) {
    const { t } = useTranslation();
    return (
        <div className="overflow-hidden rounded-lg bg-white shadow-wb-card">
            <div className="flex items-center gap-2 border-b border-wb-border-sidebar px-4 py-3">
                <h3 className="flex-1 text-wb-14 font-semibold">{t("mbx.list_title")}</h3>
                {load.status === "loading" && <Loader2 className="wb-spin size-4 text-wb-ntrl-6" aria-label={t("common.loading")} />}
            </div>
            {load.status === "error" ? (
                <EmptyState
                    icon={<Mail />}
                    title={t("mbx.list_error")}
                    hint={load.message}
                    action={
                        <Button size="wb-sm" variant="neutral" icon={<RefreshCw />} onClick={onRetry}>
                            {t("common.retry")}
                        </Button>
                    }
                />
            ) : boxes.length === 0 ? (
                load.status === "ready" && <EmptyState icon={<Mail />} title={t("mbx.list_empty")} hint={t("mbx.sum_none")} />
            ) : (
                <ul className="divide-y divide-wb-border-sidebar">
                    {boxes.map((b) => (
                        <MailboxRow key={b.id} box={b} onEdit={() => onEdit(b)} />
                    ))}
                </ul>
            )}
        </div>
    );
}

function MailboxRow({ box, onEdit }: { box: Mailbox; onEdit: () => void }) {
    const { t } = useTranslation();
    const { confirm, toast } = useDialog();
    const [busy, setBusy] = useState<"" | "scan" | "remove">("");
    const status: MailboxStatus = box.status ?? "connected";
    const expiredMs = status === "expired" && box.provider === "outlook";

    const scan = async () => {
        setBusy("scan");
        try {
            const r = await scanMailbox(box.id);
            toast(t("mbx.scan_done", { n: r.found }), "success");
        } catch (e) {
            toast(t("mbx.scan_failed_reason", { m: (e as Error).message }), "error");
        } finally {
            setBusy("");
        }
    };
    const remove = async () => {
        if (!(await confirm({ title: t("mail.disconnect"), message: t("mbx.disconnect_confirm", { a: box.address }), danger: true, confirmLabel: t("mail.disconnect") }))) return;
        setBusy("remove");
        try {
            await disconnectMailbox(box.id);
            toast(t("mbx.disconnected"));
        } catch (e) {
            toast((e as Error).message, "error");
        } finally {
            setBusy("");
        }
    };

    const scope = box.scope === "all" ? t("mbx.scope_all") : t("mbx.scope_mst", { mst: box.taxId });
    return (
        <li className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-wb-bg-sidebar text-wb-ntrl-7 [&_svg]:size-5" title={t(`mbx.tile.${box.provider}`)}>
                {KIND_ICON[box.provider]}
            </span>
            <div className="min-w-0 flex-1 basis-56">
                <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-wb-14 font-semibold">{box.address}</span>
                    <StatusPill size="sm" variant={STATUS_PILL[status]} label={t(`mbx.status.${status}`)} />
                </p>
                <p className="truncate text-wb-12 text-wb-ntrl-6">
                    {t(`mbx.method.${box.method}`)} · {scope} · {(box.folders ?? ["INBOX"]).join(", ")}
                </p>
                {status !== "connected" && box.statusMessage ? (
                    <p className="text-wb-12 text-wb-status-error-text">{box.statusMessage}</p>
                ) : (
                    <p className="text-wb-12 text-wb-ntrl-6">{box.lastScanAt ? t("mbx.last_scan_found", { d: fmtDateTime(box.lastScanAt), n: box.lastScanInvoices ?? 0 }) : t("mbx.never_scanned")}</p>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {expiredMs ? (
                    <Button size="wb-sm" variant="brand" icon={<LogIn />} onClick={onEdit}>
                        {t("mbx.reauth")}
                    </Button>
                ) : (
                    <Button size="wb-sm" variant="brand" icon={busy === "scan" ? <Loader2 className="wb-spin" /> : <RefreshCw />} disabled={!!busy || status === "expired"} onClick={scan}>
                        {busy === "scan" ? t("mbx.scanning") : t("mbx.scan")}
                    </Button>
                )}
                <Button size="wb-sm" variant="neutral" icon={<Pencil />} disabled={!!busy} onClick={onEdit}>
                    {t("common.edit")}
                </Button>
                <Button size="wb-sm" variant="neutral" icon={busy === "remove" ? <Loader2 className="wb-spin" /> : <Unplug />} disabled={!!busy} onClick={remove}>
                    {t("mail.disconnect")}
                </Button>
            </div>
        </li>
    );
}

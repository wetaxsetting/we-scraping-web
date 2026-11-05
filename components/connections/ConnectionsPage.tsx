"use client";

import { CheckCircle2, KeyRound, Loader2, Pencil, Plus, RefreshCcw, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import SyncDialog from "@/components/sync/SyncDialog";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/shared/IconButton";
import { useDialog } from "@/components/shared/dialog";
import { Modal } from "@/components/shared/Modal";
import { StatusPill } from "@/components/shared/StatusPill";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { addConnection, apiErrorText, changePassword, getCompanyMeta, getQuotaMax, makeCaptcha, removeConnection, setActiveTaxId, updateConnection, type ConnectError } from "@/lib/api/weinvoice/sync";
import { fmtDateTime } from "@/lib/weinvoice/format";
import { useTranslation } from "@/lib/i18n";
import { useStore } from "@/lib/api/weinvoice/store";
import type { GdtConnection } from "@/lib/weinvoice/types";
import { cn, sleep } from "@/lib/utils";

/** Nguồn → Kết nối CQT: manage tax IDs connected to hoadondientu.gdt.gov.vn. */
export default function ConnectionsPage() {
    const { t } = useTranslation();
    const { confirm, toast, alert } = useDialog();
    const params = useSearchParams();
    const connections = useStore((s) => s.connections);
    const activeTaxId = useStore((s) => s.activeTaxId);
    const [addOpen, setAddOpen] = useState(false);
    const [addKey, setAddKey] = useState(0); // remounts AddDialog so every open starts from an empty form
    const [pwFor, setPwFor] = useState<GdtConnection | null>(null);
    const [labelFor, setLabelFor] = useState<GdtConnection | null>(null);
    const [syncFor, setSyncFor] = useState<string | null>(null);
    // API mode: quota.max from GET /companies (read on each render; loadCompanies updates the store right after).
    const maxConnections = getQuotaMax();

    const openAdd = () => {
        setAddKey((k) => k + 1);
        setAddOpen(true);
    };

    // `?add=1` (e.g. "Thêm MST" from the header MST menu) opens the dialog — adjusted during render.
    const addParam = params.get("add") === "1";
    const [seenAddParam, setSeenAddParam] = useState(false);
    if (addParam !== seenAddParam) {
        setSeenAddParam(addParam);
        if (addParam) {
            setAddKey((k) => k + 1);
            setAddOpen(true);
        }
    }

    return (
        <PageLayout>
            <PageHeader title={t("nav.i.gdt")} subtitle={t("conn.subtitle")}>
                <span className="text-wb-13 text-wb-ntrl-6">{t("conn.quota", { n: connections.length, max: maxConnections })}</span>
                <Button size="md"
                    variant="primary"
                    icon={<Plus />}
                    onClick={() => (connections.length >= maxConnections ? alert({ title: t("conn.err.quota"), kind: "warning", message: t("conn.err.quota_msg", { max: maxConnections }) }) : openAdd())}
                >
                    {t("conn.add")}
                </Button>
            </PageHeader>

            <div className="overflow-hidden rounded-lg shadow-wb-card">
                <div className="custom-scrollbar overflow-x-auto">
                    <table className="w-full min-w-[980px] border-collapse">
                        <thead>
                            <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar text-left text-wb-13 font-semibold text-wb-ntrl-8">
                                <th className="px-3">{t("conn.col.mst")}</th>
                                <th className="px-3">{t("conn.col.company")}</th>
                                <th className="px-3">{t("conn.col.label")}</th>
                                <th className="px-3">{t("conn.col.status")}</th>
                                <th className="px-3">{t("conn.col.last_sync")}</th>
                                <th className="w-[230px] px-3 text-center">{t("inv.col.actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {connections.map((c) => (
                                <tr key={c.taxId} className={cn("h-[var(--h-wb-table-row)] border-b border-wb-table-border text-wb-13 font-medium", c.taxId === activeTaxId && "bg-brand-soft/60")}>
                                    <td className="px-3">
                                        <span className="font-mono">{c.taxId}</span>
                                        {c.taxId === activeTaxId && <span className="ml-2 rounded-sm bg-brand px-1.5 py-0.5 text-wb-10 font-semibold text-white">{t("conn.working")}</span>}
                                    </td>
                                    <td className="max-w-[340px] truncate px-3" title={c.companyName}>{c.companyName}</td>
                                    <td className="px-3 text-wb-ntrl-7">{c.label || "—"}</td>
                                    <td className="px-3">
                                        <ConnectionStatus conn={c} />
                                    </td>
                                    <td className="px-3 text-wb-ntrl-7">{c.lastSyncAt ? fmtDateTime(c.lastSyncAt) : t("conn.never")}</td>
                                    <td className="px-3">
                                        <div className="flex items-center justify-center gap-0.5">
                                            {c.taxId !== activeTaxId && (
                                                <Button size="wb-sm" variant="neutral" onClick={() => setActiveTaxId(c.taxId)} className="mr-1">
                                                    {t("conn.use")}
                                                </Button>
                                            )}
                                            <IconButton title={t("inv.sync")} onClick={() => setSyncFor(c.taxId)}><RefreshCcw /></IconButton>
                                            <IconButton title={t("conn.change_pw")} onClick={() => setPwFor(c)}><KeyRound /></IconButton>
                                            <IconButton title={t("conn.edit_label")} onClick={() => setLabelFor(c)}><Pencil /></IconButton>
                                            <IconButton
                                                title={t("common.delete")}
                                                className="hover:text-wb-red-07"
                                                onClick={async () => {
                                                    if (await confirm({ title: t("conn.delete_title"), message: t("conn.delete_msg", { mst: c.taxId }), danger: true, confirmLabel: t("common.delete") })) {
                                                        try {
                                                            await removeConnection(c.taxId);
                                                            toast(t("conn.deleted", { mst: c.taxId }));
                                                        } catch (e) {
                                                            alert({ title: t("dialog.error"), kind: "error", message: apiErrorText(e) });
                                                        }
                                                    }
                                                }}
                                            >
                                                <Trash2 />
                                            </IconButton>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg bg-wb-bg-card p-4 shadow-wb-card">
                        <p className="text-wb-13 font-semibold text-wb-ink">{t(`conn.info${i}_title`)}</p>
                        <p className="mt-1 text-wb-12 leading-5 text-wb-ntrl-6">{t(`conn.info${i}`)}</p>
                    </div>
                ))}
            </div>

            <AddDialog key={addKey} open={addOpen} onClose={() => setAddOpen(false)} />
            <PasswordDialog key={`pw-${pwFor?.taxId ?? ""}`} conn={pwFor} onClose={() => setPwFor(null)} />
            <LabelDialog key={`label-${labelFor?.taxId ?? ""}`} conn={labelFor} onClose={() => setLabelFor(null)} />
            <SyncDialog open={!!syncFor} taxId={syncFor ?? undefined} onClose={() => setSyncFor(null)} />
        </PageLayout>
    );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
    const { label, hint, error, className, ...rest } = props;
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-wb-13 font-medium text-wb-ntrl-8">{label}</span>
            <input {...rest} className={cn("h-10 rounded-md px-3 text-wb-14 shadow-wb-outline outline-none focus:shadow-wb-focus", error && "shadow-[0_0_0_1px_#c50712]", className)} />
            {error ? <span className="text-wb-12 text-wb-status-error-text">{error}</span> : hint ? <span className="text-wb-12 text-wb-ntrl-6">{hint}</span> : null}
        </label>
    );
}

/** Add MST — login to GDT; captcha is solved automatically (Invoy "Tự điền captcha"). */
function AddDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { t } = useTranslation();
    const { toast } = useDialog();
    const [taxId, setTaxId] = useState("");
    const [pw, setPw] = useState("");
    const [label, setLabel] = useState("");
    const [phase, setPhase] = useState<"form" | "captcha" | "login" | "ok" | "fail">("form");
    const [captcha, setCaptcha] = useState<{ code: string; src: string } | null>(null);
    const [typed, setTyped] = useState("");
    const [error, setError] = useState<ConnectError | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | undefined>();
    const [engineStep, setEngineStep] = useState<string | null>(null);

    const submit = async () => {
        setError(null);
        setErrorMsg(undefined);
        if (!/^\d{10}(-\d{3})?$/.test(taxId.trim())) {
            setError("invalid_tax_id");
            return;
        }
        if (DATA_SOURCE === "api") {
            // The engine solves the GDT captcha server-side: show its real step, never a simulated captcha.
            setCaptcha(null);
            setEngineStep(null);
            setPhase("login");
            // No GDT-username field on the form yet (open decision) → gdt_username = MST.
            const res = await addConnection({ taxId: taxId.trim(), password: pw, label: label.trim() }, setEngineStep);
            setPw(""); // never kept after the attempt (§3.10)
            if (res.ok) {
                setPhase("ok");
                setActiveTaxId(res.conn.taxId);
                toast(t("conn.added", { mst: res.conn.taxId }));
            } else {
                setError(res.error);
                setErrorMsg(res.message);
                setPhase("fail");
            }
            return;
        }
        const cap = makeCaptcha();
        setCaptcha(cap);
        setPhase("captcha");
        setTyped("");
        for (let i = 1; i <= cap.code.length; i++) {
            await sleep(260);
            setTyped(cap.code.slice(0, i));
        }
        await sleep(300);
        setPhase("login");
        const res = await addConnection({ taxId: taxId.trim(), password: pw, label: label.trim() });
        setPw(""); // the GDT password is never kept in the browser after the attempt (§3.10)
        if (res.ok) {
            setPhase("ok");
            setActiveTaxId(res.conn.taxId);
            toast(t("conn.added", { mst: res.conn.taxId }));
        } else {
            setError(res.error);
            setPhase("fail");
        }
    };

    const busy = phase === "captcha" || phase === "login";
    return (
        <Modal
            open={open}
            onClose={onClose}
            width={520}
            closeOnBackdrop={!busy}
            title={t("conn.add_title")}
            footer={
                phase === "ok" ? (
                    <Button size="md" variant="primary" onClick={onClose}>{t("common.close")}</Button>
                ) : (
                    <>
                        <Button size="md" variant="neutral" onClick={onClose} disabled={busy}>{t("common.cancel")}</Button>
                        <Button size="md" variant="primary" onClick={submit} disabled={busy || !taxId || !pw}>
                            {busy ? <Loader2 className="wb-spin" /> : null}
                            {phase === "fail" ? t("conn.retry") : t("conn.connect")}
                        </Button>
                    </>
                )
            }
        >
            {phase === "ok" ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <CheckCircle2 className="size-12 text-wb-status-approved-text" />
                    <p className="text-wb-16 font-semibold">{t("conn.ok_title")}</p>
                    <p className="text-wb-13 text-wb-ntrl-6">{t("conn.ok_msg")}</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <Input label={t("conn.f.mst")} value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="0109999003" hint={t("conn.f.mst_hint")} disabled={busy} error={error === "invalid_tax_id" ? t("conn.err.invalid_tax_id") : error === "exists" ? t("conn.err.exists") : undefined} />
                    <Input label={t("conn.f.password")} type="password" value={pw} onChange={(e) => setPw(e.target.value)} hint={t("conn.f.password_hint")} disabled={busy} />
                    <Input label={t("conn.f.label")} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("conn.f.label_ph")} disabled={busy} />
                    {(phase === "captcha" || phase === "login" || phase === "fail") && captcha && (
                        <div className="rounded-lg bg-wb-bg-sidebar p-3">
                            <p className="mb-2 text-wb-12 font-medium uppercase text-wb-ntrl-6">{t("conn.captcha")}</p>
                            <div className="flex items-center gap-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={captcha.src} alt="captcha" className="h-11 rounded border border-wb-ntrl-4" />
                                <input readOnly value={typed} className="h-10 w-28 rounded-md bg-white px-3 font-mono text-wb-16 font-bold tracking-widest text-brand shadow-wb-outline" />
                                <span className="flex items-center gap-1 text-wb-12 font-medium text-wb-status-approved-text">
                                    <ShieldCheck className="size-4" /> {t("sync.captcha_auto")}
                                </span>
                            </div>
                            {phase === "login" && (
                                <p className="mt-2 flex items-center gap-2 text-wb-13 text-wb-ntrl-7">
                                    <Loader2 className="size-4 wb-spin text-brand" /> {t("conn.logging_in")}
                                </p>
                            )}
                        </div>
                    )}
                    {phase === "login" && !captcha && (
                        <p className="flex items-center gap-2 rounded-lg bg-wb-bg-sidebar p-3 text-wb-13 text-wb-ntrl-7">
                            <Loader2 className="size-4 wb-spin text-brand" /> {engineStep === "login" || engineStep === "captcha" ? t(`sync.step.${engineStep}`) : t("conn.logging_in")}
                        </p>
                    )}
                    {phase === "fail" && error && error !== "invalid_tax_id" && error !== "exists" && (error !== "api" || errorMsg) && (
                        <div className="flex items-start gap-2 rounded-md bg-wb-status-rejected-bg px-3 py-2 text-wb-13 text-wb-status-rejected-text">
                            <XCircle className="mt-0.5 size-4 shrink-0" />
                            {/* `api`: a backend refusal with no screen message of its own (e.g. WBE1003) — its text + code only. */}
                            {error === "api" ? (
                                <span>{errorMsg}</span>
                            ) : (
                                <span>
                                    {t(`conn.err.${error}`)}
                                    {errorMsg && <span className="mt-0.5 block text-wb-12">{errorMsg}</span>}
                                </span>
                            )}
                        </div>
                    )}
                    <p className="text-wb-12 text-wb-ntrl-6">{t("conn.security_note")}</p>
                </div>
            )}
        </Modal>
    );
}

/**
 * Status cell. API mode shows the backend state from `CompanyItem`: `pending` (login test queued /
 * running) as "Đang đăng nhập Cục Thuế…", and `status_message` (the engine's reason) under the pill.
 */
function ConnectionStatus({ conn }: { conn: GdtConnection }) {
    const { t } = useTranslation();
    const meta = getCompanyMeta(conn.taxId);
    const pending = meta?.apiStatus === "pending";
    return (
        <div>
            <StatusPill
                size="sm"
                label={pending ? t("conn.logging_in") : t(`conn.status.${conn.status}`)}
                variant={pending ? "warning" : conn.status === "connected" ? "success" : conn.status === "expired" ? "warning" : "failed"}
            />
            {meta?.statusMessage && conn.status !== "connected" && (
                <p className="mt-0.5 max-w-[260px] truncate text-wb-11 text-wb-ntrl-6" title={meta.statusMessage}>
                    {meta.statusMessage}
                </p>
            )}
        </div>
    );
}

function PasswordDialog({ conn, onClose }: { conn: GdtConnection | null; onClose: () => void }) {
    const { t } = useTranslation();
    const { toast, alert } = useDialog();
    const [pw, setPw] = useState("");
    const [busy, setBusy] = useState(false);
    return (
        <Modal
            open={!!conn}
            onClose={onClose}
            width={460}
            title={t("conn.change_pw")}
            footer={
                <>
                    <Button size="md" variant="neutral" onClick={onClose}>{t("common.cancel")}</Button>
                    <Button size="md"
                        variant="primary"
                        disabled={!pw || busy}
                        onClick={async () => {
                            setBusy(true);
                            try {
                                // API: PUT /companies/{mst}/password → engine test-login; the password lives only in this input (§3.10).
                                await changePassword(conn!.taxId, pw);
                                toast(t("conn.pw_saved"));
                                onClose();
                            } catch (e) {
                                alert({ title: t("dialog.error"), kind: "error", message: apiErrorText(e) });
                            } finally {
                                setBusy(false);
                                setPw("");
                            }
                        }}
                    >
                        {t("common.save")}
                    </Button>
                </>
            }
        >
            <p className="mb-3 text-wb-13 text-wb-ntrl-7">{conn?.taxId} — {conn?.companyName}</p>
            <Input label={t("conn.f.new_password")} type="password" value={pw} onChange={(e) => setPw(e.target.value)} hint={t("conn.f.password_hint")} />
        </Modal>
    );
}

function LabelDialog({ conn, onClose }: { conn: GdtConnection | null; onClose: () => void }) {
    const { t } = useTranslation();
    const { alert } = useDialog();
    const [v, setV] = useState(conn?.label ?? "");
    return (
        <Modal
            open={!!conn}
            onClose={onClose}
            width={420}
            title={t("conn.edit_label")}
            footer={
                <>
                    <Button size="md" variant="neutral" onClick={onClose}>{t("common.cancel")}</Button>
                    <Button size="md"
                        variant="primary"
                        onClick={async () => {
                            try {
                                await updateConnection(conn!.taxId, { label: v.trim() });
                                onClose();
                            } catch (e) {
                                alert({ title: t("dialog.error"), kind: "error", message: apiErrorText(e) });
                            }
                        }}
                    >
                        {t("common.save")}
                    </Button>
                </>
            }
        >
            <Input label={t("conn.f.label")} value={v} onChange={(e) => setV(e.target.value)} placeholder={t("conn.f.label_ph")} />
        </Modal>
    );
}

"use client";

import { ArrowLeft, Lock, Pencil, Send, Trash2, Unlock, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import PageLayout from "@/components/shared/PageLayout";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/shared/IconButton";
import { LabeledCheckbox as Checkbox } from "@/components/shared/LabeledCheckbox";
import { useDialog } from "@/components/shared/dialog";
import { Modal } from "@/components/shared/Modal";
import { StatusPill } from "@/components/shared/StatusPill";
import { EmptyState } from "@/components/shared/EmptyState";
import { PERMS, PRESETS, removeSubAccount, resendInvite, saveSubAccount, setSubStatus, subAccountsAvailable, type Perm } from "@/lib/api/weinvoice/subaccounts";
import { fmtDateTime } from "@/lib/weinvoice/format";
import { useTranslation } from "@/lib/i18n";
import type { SubAccount } from "@/lib/api/weinvoice/mockData";
import { getState, useStore } from "@/lib/api/weinvoice/store";
import { cn } from "@/lib/utils";

/**
 * Quản lý tài khoản con (M11-F03) — Invoy layout + permissions per MST (MVP: simulated invite).
 * api mode: sub-accounts are not in the published API — a "not available on the server yet" state
 * replaces the list and the create button (no request is sent).
 */
export default function SubAccountsPage() {
    const { t } = useTranslation();
    const { confirm, toast } = useDialog();
    const subs = useStore((s) => s.subaccounts) ?? [];
    const conns = useStore((s) => s.connections);
    const [edit, setEdit] = useState<SubAccount | "new" | null>(null);
    /** Runs a sub-account mutation; a backend failure (api mode) is shown, never a fake success. */
    const run = async (op: () => Promise<unknown>): Promise<boolean> => {
        try {
            await op();
            return true;
        } catch (e) {
            toast((e as Error).message, "error");
            return false;
        }
    };

    return (
        <PageLayout>
            <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4 py-6">
                <div>
                    <Link href="/settings/general" className="mb-2 inline-flex items-center gap-1 text-wb-12 font-medium text-wb-ntrl-6 hover:text-brand">
                        <ArrowLeft className="size-3.5" />
                        {t("nav.i.general")}
                    </Link>
                    <h1 className="text-wb-22 font-bold tracking-wb-tight text-wb-dark">{t("sub.title")}</h1>
                    <p className="text-wb-13 text-wb-ntrl-6">{t("sub.subtitle")}</p>
                </div>
                {!subAccountsAvailable() ? (
                    <div className="rounded-lg bg-white shadow-wb-card">
                        <EmptyState icon={<Users />} title={t("sub.title")} hint={t("common.not_on_server")} />
                    </div>
                ) : (
                    <>
                    <div className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-wb-card">
                        <span className="flex items-center gap-2 text-wb-13 text-wb-ntrl-8">
                            <Users className="size-4 text-wb-ntrl-6" />
                            <b>{subs.length}</b> {t("sub.count")}
                        </span>
                        <Button size="md" variant="primary" icon={<UserPlus />} onClick={() => setEdit("new")}>{t("sub.create")}</Button>
                    </div>

                    {subs.length === 0 ? (
                        <div className="rounded-lg bg-white px-6 py-10 text-center shadow-wb-card">
                            <p className="text-wb-14 font-semibold">{t("sub.empty")}</p>
                            <p className="mx-auto mt-1 max-w-[420px] text-wb-13 text-wb-ntrl-6">{t("sub.empty_hint")}</p>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-lg shadow-wb-card">
                            <table className="w-full border-collapse text-wb-13">
                                <thead>
                                    <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar text-left font-semibold text-wb-ntrl-8">
                                        <th className="px-3">{t("sub.col.user")}</th>
                                        <th className="px-3">{t("sub.col.mst")}</th>
                                        <th className="px-3">{t("sub.col.perms")}</th>
                                        <th className="px-3">{t("sub.col.status")}</th>
                                        <th className="w-[120px] px-3" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {subs.map((a) => (
                                        <tr key={a.id} className="border-b border-wb-table-border align-top">
                                            <td className="px-3 py-2.5">
                                                <p className="font-semibold">{a.name}</p>
                                                <p className="text-wb-12 text-wb-ntrl-6">{a.email}</p>
                                                <p className="text-wb-11 text-wb-ntrl-5">{fmtDateTime(a.createdAt)}</p>
                                            </td>
                                            <td className="px-3 py-2.5 font-mono text-wb-12">{a.taxIds.join(", ")}</td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex max-w-[320px] flex-wrap gap-1">
                                                    {a.perms.map((p) => (
                                                        <span key={p} className="rounded-sm bg-brand-softer px-1.5 py-0.5 text-wb-11 font-medium text-brand">{t(`sub.perm.${p}`)}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <StatusPill size="sm" label={t(`sub.st.${a.status}`)} variant={a.status === "active" ? "success" : a.status === "invited" ? "progress" : "failed"} />
                                            </td>
                                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                {a.status === "invited" && (
                                                    <IconButton title={t("sub.resend")} onClick={async () => {
                                                        if (await run(() => resendInvite(a.id))) toast(t("sub.resent", { e: a.email }));
                                                    }}><Send /></IconButton>
                                                )}
                                                <IconButton title={t("common.edit")} onClick={() => setEdit(a)}><Pencil /></IconButton>
                                                <IconButton title={a.status === "locked" ? t("sub.unlock") : t("sub.lock")} onClick={() => void run(() => setSubStatus(a.id, a.status === "locked" ? "active" : "locked"))}>
                                                    {a.status === "locked" ? <Unlock /> : <Lock />}
                                                </IconButton>
                                                <IconButton
                                                    title={t("common.delete")}
                                                    onClick={async () => {
                                                        if (await confirm({ title: t("sub.delete_title"), message: a.email, danger: true, confirmLabel: t("common.delete") })) await run(() => removeSubAccount(a.id));
                                                    }}
                                                >
                                                    <Trash2 />
                                                </IconButton>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <p className="text-wb-12 text-wb-ntrl-6">{t("sub.note")}</p>
                    </>
                )}
            </div>
            {edit && <EditDialog acc={edit === "new" ? null : edit} conns={conns.map((c) => ({ taxId: c.taxId, name: c.companyName }))} onClose={() => setEdit(null)} />}
        </PageLayout>
    );
}

function EditDialog({ acc, conns, onClose }: { acc: SubAccount | null; conns: { taxId: string; name: string }[]; onClose: () => void }) {
    const { t } = useTranslation();
    const { toast } = useDialog();
    const [name, setName] = useState(acc?.name ?? "");
    const [email, setEmail] = useState(acc?.email ?? "");
    const [taxIds, setTaxIds] = useState<string[]>(acc?.taxIds ?? (conns[0] ? [conns[0].taxId] : []));
    const [perms, setPerms] = useState<string[]>(acc?.perms ?? PRESETS.accountant);
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);
    const toggle = (arr: string[], v: string, on: boolean) => (on ? Array.from(new Set([...arr, v])) : arr.filter((x) => x !== v));

    const save = async () => {
        if (!name.trim()) return setErr(t("sub.err_name"));
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErr(t("mbx.err_address"));
        if (!acc && getState().subaccounts?.some((x) => x.email.toLowerCase() === email.trim().toLowerCase())) return setErr(t("sub.err_email_exists"));
        if (!taxIds.length) return setErr(t("sub.err_mst"));
        if (!perms.length) return setErr(t("sub.err_perm"));
        setBusy(true);
        try {
            await saveSubAccount({ id: acc?.id, name: name.trim(), email: email.trim(), taxIds, perms });
        } catch (e) {
            setErr((e as Error).message);
            return;
        } finally {
            setBusy(false);
        }
        toast(acc ? t("sub.saved") : t("sub.invited", { e: email.trim() }));
        onClose();
    };

    return (
        <Modal
            open
            onClose={onClose}
            width={620}
            title={acc ? t("sub.edit_title") : t("sub.create")}
            footer={
                <>
                    <Button size="md" variant="neutral" onClick={onClose}>{t("common.cancel")}</Button>
                    <Button size="md" variant="primary" icon={acc ? undefined : <Send />} onClick={save} disabled={busy}>{acc ? t("common.save") : t("sub.send_invite")}</Button>
                </>
            }
        >
            <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-wb-13 font-semibold text-wb-ntrl-8">{t("sub.f_name")}</span>
                        <input className="h-10 rounded-md px-3 text-wb-14 shadow-wb-outline outline-none focus:shadow-wb-focus" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-wb-13 font-semibold text-wb-ntrl-8">{t("sub.f_email")}</span>
                        <input className="h-10 rounded-md px-3 text-wb-14 shadow-wb-outline outline-none focus:shadow-wb-focus" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ketoan@congty.vn" disabled={!!acc} />
                    </label>
                </div>
                <div>
                    <p className="mb-1.5 text-wb-13 font-semibold text-wb-ntrl-8">{t("sub.f_mst")}</p>
                    <div className="flex flex-col gap-1.5 rounded-md bg-wb-bg-sidebar p-3">
                        {conns.map((c) => (
                            <Checkbox key={c.taxId} checked={taxIds.includes(c.taxId)} onChange={(on) => setTaxIds((x) => toggle(x, c.taxId, on))} label={<span><b className="font-mono">{c.taxId}</b> <span className="text-wb-ntrl-6">· {c.name}</span></span>} />
                        ))}
                    </div>
                </div>
                <div>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <p className="text-wb-13 font-semibold text-wb-ntrl-8">{t("sub.f_perms")}</p>
                        {Object.keys(PRESETS).map((k) => (
                            <button key={k} type="button" onClick={() => setPerms(PRESETS[k])} className={cn("cursor-pointer rounded-full px-2.5 py-0.5 text-wb-12 font-medium ring-1", JSON.stringify([...perms].sort()) === JSON.stringify([...PRESETS[k]].sort()) ? "bg-brand text-white ring-brand" : "text-brand ring-brand/30 hover:bg-brand-soft")}>
                                {t(`sub.preset.${k}`)}
                            </button>
                        ))}
                    </div>
                    <div className="grid gap-1.5 rounded-md bg-wb-bg-sidebar p-3 sm:grid-cols-2">
                        {PERMS.map((p: Perm) => (
                            <Checkbox key={p} checked={perms.includes(p)} onChange={(on) => setPerms((x) => toggle(x, p, on))} label={<span className="flex flex-col"><span>{t(`sub.perm.${p}`)}</span><span className="text-wb-11 font-normal text-wb-ntrl-6">{t(`sub.perm_hint.${p}`)}</span></span>} />
                        ))}
                    </div>
                </div>
                {err && <p className="rounded-md bg-wb-status-rejected-bg px-3 py-2 text-wb-12 text-wb-status-rejected-text">{err}</p>}
                {!acc && <p className="text-wb-12 text-wb-ntrl-6">{t("sub.invite_note")}</p>}
            </div>
        </Modal>
    );
}

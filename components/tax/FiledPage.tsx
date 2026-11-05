"use client";

import { AlertTriangle, Eye, EyeOff, FileText, Landmark, Link2, Link2Off, Loader2, RefreshCw, Receipt, Bell } from "lucide-react";
import { useMemo, useState } from "react";

import { SimBanner } from "@/components/checks/SimBanner";
import PageLayout from "@/components/shared/PageLayout";
import { Button } from "@/components/ui/button";
import { LabeledCheckbox as Checkbox } from "@/components/shared/LabeledCheckbox";
import { useDialog } from "@/components/shared/dialog";
import { Modal } from "@/components/shared/Modal";
import { StatusPill } from "@/components/shared/StatusPill";
import { makeCaptcha } from "@/lib/api/weinvoice/sync";
import { connectPortal, disconnectPortal, portalData } from "@/lib/api/weinvoice/taxportal";
import { fmtDate, fmtMoney } from "@/lib/weinvoice/format";
import { useTranslation } from "@/lib/i18n";
import { useStore } from "@/lib/api/weinvoice/store";
import { cn } from "@/lib/utils";

type Tab = "returns" | "slips" | "notices";

/**
 * Thuế › Tờ khai đã nộp / Giấy nộp tiền (M06-F04/F05, §3.8) — tax e-service portal, SIMULATED.
 * Data comes from lib/api/weinvoice/taxportal.ts (deterministic mock per MST).
 * The password only lives in the connect dialog's local input state while the
 * user types; it is never written to the store or returned (§3.10).
 */
export default function FiledPage() {
    const { t } = useTranslation();
    const { confirm, toast } = useDialog();
    const taxId = useStore((s) => s.activeTaxId);
    const portals = useStore((s) => s.portals);
    const portal = useMemo(() => (portals ?? []).find((p) => p.taxId === taxId), [portals, taxId]);
    const data = useMemo(() => (portal ? portalData(taxId) : null), [portal, taxId]);
    const [tab, setTab] = useState<Tab>("returns");
    const [open, setOpen] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const tabs: { k: Tab; icon: React.ReactNode; n: number }[] = [
        { k: "returns", icon: <FileText className="size-4" />, n: data?.returns.length ?? 0 },
        { k: "slips", icon: <Receipt className="size-4" />, n: data?.slips.length ?? 0 },
        { k: "notices", icon: <Bell className="size-4" />, n: data?.notices.length ?? 0 },
    ];

    return (
        <PageLayout>
            <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 py-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-wb-22 font-bold tracking-wb-tight text-wb-dark">{t("filed.title")}</h1>
                        <p className="text-wb-13 text-wb-ntrl-6">{t("filed.subtitle")}</p>
                    </div>
                    {portal && (
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1.5 rounded-md bg-wb-status-approved-bg px-2.5 py-1 text-wb-12 font-semibold text-wb-status-approved-text">
                                <Link2 className="size-3.5" />
                                {t("filed.connected_as", { a: portal.account })}
                            </span>
                            <Button size="md"
                                variant="neutral"
                                icon={syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                                disabled={syncing}
                                onClick={async () => {
                                    setSyncing(true);
                                    await new Promise((r) => setTimeout(r, 1200));
                                    setSyncing(false);
                                    toast(t("filed.synced"));
                                }}
                            >
                                {t("filed.sync")}
                            </Button>
                            <Button size="md"
                                variant="neutral"
                                icon={<Link2Off />}
                                onClick={async () => {
                                    if (await confirm({ title: t("filed.disconnect_title"), message: portal.account, danger: true, confirmLabel: t("filed.disconnect") })) disconnectPortal(taxId);
                                }}
                            >
                                {t("filed.disconnect")}
                            </Button>
                        </div>
                    )}
                </div>
                <SimBanner k="sim.portal" />

                {!portal || !data ? (
                    <div className="rounded-lg bg-white px-6 py-12 text-center shadow-wb-card">
                        <Landmark className="mx-auto mb-3 size-10 text-wb-ntrl-5" />
                        <p className="text-wb-15 font-semibold">{t("filed.empty")}</p>
                        <p className="mx-auto mt-1 max-w-[480px] text-wb-13 text-wb-ntrl-6">{t("filed.empty_hint")}</p>
                        <Button size="md" className="mt-4" variant="primary" icon={<Link2 />} onClick={() => setOpen(true)}>
                            {t("filed.connect")}
                        </Button>
                    </div>
                ) : (
                    <div className="rounded-lg bg-white shadow-wb-card">
                        <div className="flex gap-1 border-b border-wb-table-border px-3">
                            {tabs.map((x) => (
                                <button
                                    key={x.k}
                                    type="button"
                                    onClick={() => setTab(x.k)}
                                    className={cn("-mb-px flex h-11 cursor-pointer items-center gap-1.5 border-b-2 px-3 text-wb-13 font-semibold", tab === x.k ? "border-brand text-brand" : "border-transparent text-wb-ntrl-6 hover:text-wb-ink")}
                                >
                                    {x.icon}
                                    {t(`filed.tab.${x.k}`)}
                                    <span className="rounded-full bg-wb-bg-sidebar px-1.5 text-wb-11">{x.n}</span>
                                </button>
                            ))}
                        </div>
                        <div className="overflow-x-auto p-3">
                            {tab === "returns" && (
                                <table className="w-full min-w-[900px] border-collapse text-wb-13">
                                    <thead>
                                        <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar text-left font-semibold text-wb-ntrl-8">
                                            <th className="px-3">{t("filed.c.form")}</th>
                                            <th className="px-3">{t("filed.c.period")}</th>
                                            <th className="px-3">{t("filed.c.kind")}</th>
                                            <th className="px-3">{t("filed.c.submitted")}</th>
                                            <th className="px-3">{t("filed.c.code")}</th>
                                            <th className="px-3 text-right">{t("filed.c.amount")}</th>
                                            <th className="px-3">{t("filed.c.status")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.returns.map((r) => (
                                            <tr key={r.id} className="border-b border-wb-table-border">
                                                <td className="px-3 py-2.5">
                                                    <p className="font-semibold">{r.form}</p>
                                                    <p className="text-wb-11 text-wb-ntrl-6">{r.name}</p>
                                                </td>
                                                <td className="px-3 py-2.5">{r.period}</td>
                                                <td className="px-3 py-2.5">{r.kind === "add" ? <span className="rounded-sm bg-wb-warn-bg px-1.5 py-0.5 text-wb-11 font-semibold text-wb-warn-text">{t("filed.kind.add")}</span> : t("filed.kind.main")}</td>
                                                <td className="px-3 py-2.5 text-wb-12">{fmtDate(r.submittedAt)}</td>
                                                <td className="px-3 py-2.5 font-mono text-wb-12">{r.code}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums">{r.amount != null ? fmtMoney(r.amount) : "—"}</td>
                                                <td className="px-3 py-2.5"><StatusPill size="sm" label={r.status === "accepted" ? t("filed.st.accepted") : t("filed.st.received")} variant={r.status === "accepted" ? "success" : "progress"} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            {tab === "slips" && (
                                <table className="w-full min-w-[900px] border-collapse text-wb-13">
                                    <thead>
                                        <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar text-left font-semibold text-wb-ntrl-8">
                                            <th className="px-3">{t("filed.c.ref")}</th>
                                            <th className="px-3">{t("filed.c.paid")}</th>
                                            <th className="px-3">{t("filed.c.content")}</th>
                                            <th className="px-3">{t("filed.c.chapter")}</th>
                                            <th className="px-3">{t("filed.c.bank")}</th>
                                            <th className="px-3 text-right">{t("filed.c.amount")}</th>
                                            <th className="px-3">{t("filed.c.status")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.slips.map((s) => (
                                            <tr key={s.id} className="border-b border-wb-table-border">
                                                <td className="px-3 py-2.5 font-mono text-wb-12">{s.ref}</td>
                                                <td className="px-3 py-2.5 text-wb-12">{fmtDate(s.paidAt)}</td>
                                                <td className="max-w-[320px] px-3 py-2.5">{s.content}</td>
                                                <td className="px-3 py-2.5 text-wb-12">{s.chapter} / {s.subItem}</td>
                                                <td className="px-3 py-2.5 text-wb-12">{s.bank}</td>
                                                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{fmtMoney(s.amount)}</td>
                                                <td className="px-3 py-2.5"><StatusPill size="sm" label={t("filed.st.paid")} variant="success" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-wb-bg-sidebar font-semibold">
                                            <td className="px-3 py-2.5" colSpan={5}>{t("filed.total_paid")}</td>
                                            <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(data.slips.reduce((a, s) => a + s.amount, 0))}</td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                            {tab === "notices" && (
                                <ul className="divide-y divide-wb-table-border">
                                    {data.notices.map((n) => (
                                        <li key={n.id} className="flex items-start gap-3 px-2 py-3">
                                            <Bell className="mt-0.5 size-4 text-brand" />
                                            <div className="flex-1">
                                                <p className="text-wb-13 font-semibold">{n.title}</p>
                                                <p className="text-wb-12 text-wb-ntrl-6">{fmtDate(n.date)} · {n.ref}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
                <p className="text-wb-12 text-wb-ntrl-6">{t("filed.note")}</p>
            </div>
            {open && <ConnectDialog taxId={taxId} onClose={() => setOpen(false)} onDone={() => { setOpen(false); toast(t("filed.connected")); }} />}
        </PageLayout>
    );
}

function ConnectDialog({ taxId, onClose, onDone }: { taxId: string; onClose: () => void; onDone: () => void }) {
    const { t } = useTranslation();
    const [kind, setKind] = useState<"org" | "person">("org");
    const [account, setAccount] = useState(`${taxId}-QL`);
    const [password, setPassword] = useState("");
    const [show, setShow] = useState(false);
    const [remember, setRemember] = useState(true);
    const [cap, setCap] = useState(() => makeCaptcha(5));
    const [code, setCode] = useState("");
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!account.trim() || !password) return setErr(t("filed.err_required"));
        if (code.trim().length !== 5) return setErr(t("filed.err_captcha"));
        setBusy(true);
        setErr("");
        const r = await connectPortal({ taxId, account: account.trim(), password, kind, captcha: code, expected: cap.code });
        setBusy(false);
        if (r.ok) return onDone();
        setErr(r.error === "captcha" ? t("filed.err_captcha") : t("filed.err_auth"));
        setCap(makeCaptcha(5));
        setCode("");
    };

    const input = "h-10 w-full rounded-md px-3 text-wb-14 shadow-wb-outline outline-none focus:shadow-wb-focus";
    return (
        <Modal
            open
            onClose={onClose}
            width={520}
            title={t("filed.connect")}
            footer={
                <>
                    <Button size="md" variant="neutral" onClick={onClose}>{t("common.cancel")}</Button>
                    <Button size="md" variant="primary" icon={busy ? <Loader2 className="animate-spin" /> : <Link2 />} disabled={busy} onClick={submit}>{t("filed.connect_btn")}</Button>
                </>
            }
        >
            <div className="grid gap-4">
                <p className="flex gap-2 rounded-md bg-wb-warn-bg px-3 py-2 text-wb-12 text-wb-warn-text">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    {t("filed.only_etax")}
                </p>
                <div className="flex rounded-md bg-wb-bg-sidebar p-0.5">
                    {(["org", "person"] as const).map((k) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => { setKind(k); setAccount(k === "org" ? `${taxId}-QL` : ""); }}
                            className={cn("h-8 flex-1 cursor-pointer rounded text-wb-13 font-semibold", kind === k ? "bg-white text-brand shadow-wb-btn" : "text-wb-ntrl-7")}
                        >
                            {t(`filed.kind_${k}`)}
                        </button>
                    ))}
                </div>
                <label className="flex flex-col gap-1.5">
                    <span className="text-wb-13 font-semibold text-wb-ntrl-8">{t("filed.f_account")}</span>
                    <input className={input} value={account} onChange={(e) => setAccount(e.target.value)} placeholder={kind === "org" ? `${taxId}-QL` : "0123456789"} />
                    <span className="text-wb-11 text-wb-ntrl-6">{kind === "org" ? t("filed.account_hint_org") : t("filed.account_hint_person")}</span>
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className="text-wb-13 font-semibold text-wb-ntrl-8">{t("filed.f_password")}</span>
                    <div className="relative">
                        <input className={cn(input, "pr-10")} type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
                        <button type="button" onClick={() => setShow((x) => !x)} className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer p-1 text-wb-ntrl-6" title={t("filed.toggle_pw")}>
                            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                    </div>
                </label>
                <Checkbox checked={remember} onChange={setRemember} label={t("filed.remember")} />
                <div className="flex flex-col gap-1.5">
                    <span className="text-wb-13 font-semibold text-wb-ntrl-8">{t("filed.f_captcha")}</span>
                    <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cap.src} alt={t("filed.f_captcha")} className="h-11 rounded-md ring-1 ring-wb-table-border" />
                        <button type="button" onClick={() => { setCap(makeCaptcha(5)); setCode(""); }} className="cursor-pointer rounded-md p-2 text-wb-ntrl-6 hover:bg-black/5" title={t("filed.refresh_captcha")}>
                            <RefreshCw className="size-4" />
                        </button>
                        <input className={cn(input, "w-[140px] font-mono uppercase tracking-widest")} maxLength={5} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
                    </div>
                    <span className="text-wb-11 text-wb-ntrl-6">{t("filed.captcha_tip")}</span>
                </div>
                {err && <p className="rounded-md bg-wb-status-rejected-bg px-3 py-2 text-wb-12 text-wb-status-rejected-text">{err}</p>}
            </div>
        </Modal>
    );
}

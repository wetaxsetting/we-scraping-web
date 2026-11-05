"use client";

import { CheckCircle2, Circle, Loader2, RefreshCcw, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";

import { monthOptions } from "@/components/invoices/period";
import { Select } from "@/components/shared/Select";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/shared/dialog";
import { Modal } from "@/components/shared/Modal";
import { refreshAfterSync } from "@/lib/api/weinvoice/remote";
import { apiErrorText, runSync, type SyncProgress } from "@/lib/api/weinvoice/sync";
import { useTranslation } from "@/lib/i18n";
import { useStore } from "@/lib/api/weinvoice/store";
import type { SyncRun } from "@/lib/weinvoice/types";
import { cn } from "@/lib/utils";

/**
 * "Đồng bộ" — pull invoices from the GDT portal for a period.
 * Shows the real engine steps: login → captcha (auto-solved) → list by batch → XML per invoice.
 */
export default function SyncDialog({ open, onClose, defaultFrom, taxId }: { open: boolean; onClose: () => void; defaultFrom?: string; taxId?: string }) {
    const { t } = useTranslation();
    const { toast, alert } = useDialog();
    const connections = useStore((s) => s.connections);
    const activeTaxId = useStore((s) => s.activeTaxId);
    const [mst, setMst] = useState(taxId ?? activeTaxId);
    const [dir, setDir] = useState<"both" | "purchase" | "sales">("both");
    const [from, setFrom] = useState(defaultFrom ?? "2026-10");
    const [to, setTo] = useState("2026-10");
    const [prog, setProg] = useState<SyncProgress | null>(null);
    const [result, setResult] = useState<SyncRun | null>(null);
    const signal = useRef({ cancelled: false });

    // Reset the form each time the dialog opens (state adjusted during render, not in an effect).
    const openKey = open ? `${taxId ?? activeTaxId}|${defaultFrom ?? ""}` : "";
    const [prevOpenKey, setPrevOpenKey] = useState("");
    if (openKey !== prevOpenKey) {
        setPrevOpenKey(openKey);
        if (open) {
            setMst(taxId ?? activeTaxId);
            setFrom(defaultFrom ?? "2026-10");
            setTo(defaultFrom && defaultFrom > "2026-10" ? defaultFrom : "2026-10");
            setProg(null);
            setResult(null);
        }
    }

    const running = !!prog && !result;
    const months = monthOptions().map((m) => ({ value: m, label: `${m.slice(5)}/${m.slice(0, 4)}` }));

    const start = async () => {
        signal.current = { cancelled: false };
        setResult(null);
        try {
            const run = await runSync({ taxId: mst, direction: dir, fromMonth: from <= to ? from : to, toMonth: from <= to ? to : from }, setProg, signal.current);
            setResult(run);
            void refreshAfterSync(mst);
            toast(t("sync.toast_done", { n: run.newCount, x: run.xmlCount }));
        } catch (e) {
            // API mode: POST /sync-runs refused (WBE3016 period, WBE3023 > 36 months, WBE3024 no password, …)
            // or polling failed — back to the form, show the backend message + code.
            setProg(null);
            alert({ title: t("dialog.error"), kind: "error", message: apiErrorText(e) });
        }
    };

    const stepState = (s: SyncProgress["step"]) => {
        const order = ["login", "captcha", "list", "xml", "done"];
        if (!prog) return "todo";
        const cur = order.indexOf(prog.step);
        const me = order.indexOf(s);
        return cur > me ? "done" : cur === me ? (s === "done" ? "done" : "doing") : "todo";
    };

    const steps: { key: SyncProgress["step"]; label: string; detail?: React.ReactNode }[] = [
        { key: "login", label: t("sync.step.login"), detail: mst },
        {
            key: "captcha",
            label: t("sync.step.captcha"),
            detail: prog?.captcha && (
                <span className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={prog.captcha.src} alt="captcha" className="h-8 rounded border border-wb-ntrl-4" />
                    <span className="font-mono text-wb-13 font-bold tracking-widest text-brand">{prog.captcha.code}</span>
                    <span className="flex items-center gap-1 text-wb-12 text-wb-status-approved-text">
                        <ShieldCheck className="size-3.5" /> {t("sync.captcha_auto")}
                    </span>
                </span>
            ),
        },
        { key: "list", label: t("sync.step.list"), detail: prog && prog.step !== "login" && prog.step !== "captcha" ? t("sync.listed", { n: prog.listed, m: prog.month ? `${prog.month.slice(5)}/${prog.month.slice(0, 4)}` : "", b: prog.batch ?? "" }) : undefined },
        { key: "xml", label: t("sync.step.xml"), detail: prog && (prog.step === "xml" || prog.step === "done") ? `${prog.xmlDone}/${prog.xmlTotal}` : undefined },
        { key: "done", label: t("sync.step.done") },
    ];

    return (
        <Modal
            open={open}
            onClose={() => {
                if (running) signal.current.cancelled = true;
                onClose();
            }}
            width={620}
            closeOnBackdrop={!running}
            title={t("sync.title")}
            footer={
                result ? (
                    <Button size="md" variant="primary" onClick={onClose}>{t("common.close")}</Button>
                ) : running ? (
                    <Button size="md" variant="danger" onClick={() => (signal.current.cancelled = true)}>{t("sync.stop")}</Button>
                ) : (
                    <>
                        <Button size="md" variant="neutral" onClick={onClose}>{t("common.cancel")}</Button>
                        <Button size="md" variant="primary" icon={<RefreshCcw />} onClick={start} disabled={!connections.length}>
                            {t("sync.start")}
                        </Button>
                    </>
                )
            }
        >
            {!prog && (
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t("sync.mst")} full>
                        <Select value={mst} fullWidth options={connections.map((c) => ({ value: c.taxId, label: `${c.taxId} — ${c.companyName}` }))} onChange={setMst} />
                    </Field>
                    <Field label={t("sync.direction")} full>
                        <div className="flex rounded-md bg-white p-0.5 shadow-wb-outline">
                            {(["both", "purchase", "sales"] as const).map((d) => (
                                <button key={d} onClick={() => setDir(d)} className={cn("h-8 flex-1 cursor-pointer rounded-[5px] text-wb-13 font-medium", dir === d ? "bg-brand text-white" : "hover:bg-wb-bg-sidebar")}>
                                    {t(`sync.dir.${d}`)}
                                </button>
                            ))}
                        </div>
                    </Field>
                    <Field label={t("sync.from")}>
                        <Select value={from} fullWidth options={months} onChange={setFrom} />
                    </Field>
                    <Field label={t("sync.to")}>
                        <Select value={to} fullWidth options={months} onChange={setTo} />
                    </Field>
                    <p className="rounded-md bg-brand-soft px-3 py-2 text-wb-12 leading-5 text-wb-ntrl-7 sm:col-span-2">{t("sync.note")}</p>
                </div>
            )}
            {prog && (
                <div className="flex flex-col">
                    {steps.map((s) => {
                        const st = stepState(s.key);
                        return (
                            <div key={s.key} className="flex items-start gap-3 border-b border-wb-border-sidebar py-2.5 last:border-0">
                                {st === "done" ? <CheckCircle2 className="mt-0.5 size-5 text-wb-status-approved-text" /> : st === "doing" ? <Loader2 className="mt-0.5 size-5 wb-spin text-brand" /> : <Circle className="mt-0.5 size-5 text-wb-ntrl-4" />}
                                <div className="min-w-0 flex-1">
                                    <p className={cn("text-wb-14 font-medium", st === "todo" ? "text-wb-ntrl-5" : "text-wb-ink")}>{s.label}</p>
                                    {s.detail && st !== "todo" && <div className="mt-0.5 text-wb-12 text-wb-ntrl-6">{s.detail}</div>}
                                    {s.key === "xml" && prog.xmlTotal > 0 && st !== "todo" && (
                                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-wb-ntrl-3">
                                            <div className="h-full bg-brand transition-all" style={{ width: `${(prog.xmlDone / prog.xmlTotal) * 100}%` }} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {result && (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                            <Stat label={t("sync.res.new")} v={result.newCount} />
                            <Stat label={t("sync.res.updated")} v={result.updatedCount} />
                            <Stat label={t("sync.res.xml")} v={result.xmlCount} />
                        </div>
                    )}
                    {result?.status === "partial" && <p className="mt-2 text-wb-12 text-wb-warn-text">{t("sync.partial_note")}</p>}
                </div>
            )}
        </Modal>
    );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
    return (
        <div className={cn("flex flex-col gap-1.5", full && "sm:col-span-2")}>
            <span className="text-wb-13 font-medium text-wb-ntrl-8">{label}</span>
            {children}
        </div>
    );
}

function Stat({ label, v }: { label: string; v: number }) {
    return (
        <div className="rounded-lg bg-wb-bg-card p-3 text-center shadow-wb-card">
            <p className="text-wb-22 font-bold text-brand">{v}</p>
            <p className="text-wb-12 text-wb-ntrl-6">{label}</p>
        </div>
    );
}

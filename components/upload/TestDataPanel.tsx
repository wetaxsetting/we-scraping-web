"use client";

import { FlaskConical, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/shared/dialog";
import { loadTestData, testDataAvailable, type TestDataReport } from "@/lib/api/weinvoice/testdata";
import { useTranslation } from "@/lib/i18n";

/**
 * MVP-only card (Nguồn hoá đơn → Tải lên): the engine loads its TestData folder in one click.
 * Shown only in API mode when the backend enables test data (`GET /me` → `test_data_enabled`);
 * see lib/api/weinvoice/testdata.ts.
 */
export function TestDataPanel() {
    const { t } = useTranslation();
    const router = useRouter();
    const { confirm, toast, alert } = useDialog();
    const [info, setInfo] = useState<{ ok: boolean; folder?: string; xml?: number; pdf?: number } | null>(null);
    const [busy, setBusy] = useState("");
    const [report, setReport] = useState<TestDataReport | null>(null);

    useEffect(() => {
        testDataAvailable().then(setInfo);
    }, []);

    if (!info?.ok) return null;

    const run = async () => {
        if (!(await confirm({ title: t("td.load"), message: t("td.confirm"), confirmLabel: t("td.load_btn") }))) return;
        setBusy("…");
        try {
            const r = await loadTestData(setBusy);
            setReport(r);
            toast(t("td.done", { n: r.created }));
        } catch (e) {
            await alert({ title: t("td.load"), kind: "error", message: (e as Error).message === "no_folder" ? t("td.no_folder") : (e as Error).message });
        } finally {
            setBusy("");
            testDataAvailable().then(setInfo);
        }
    };

    return (
        <div className="rounded-lg border border-brand/20 bg-brand-soft p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <FlaskConical className="mt-0.5 size-5 shrink-0 text-brand" />
                    <div className="min-w-0">
                        <p className="text-wb-14 font-semibold text-wb-ink">
                            {t("td.title")} <span className="ml-1 rounded-sm bg-white px-1.5 py-0.5 text-wb-11 font-semibold text-brand">MVP</span>
                        </p>
                        {info.ok ? (
                            <p className="text-wb-12 text-wb-ntrl-7">
                                <span className="font-mono">{info.folder}</span>
                                {info.xml !== undefined && <> · {t("td.counts", { x: info.xml, p: info.pdf ?? 0 })}</>}
                            </p>
                        ) : (
                            <p className="text-wb-12 text-wb-ntrl-7">{t("td.no_folder")}</p>
                        )}
                        <p className="text-wb-12 text-wb-ntrl-6">{t("td.hint")}</p>
                    </div>
                </div>
                <Button size="md" variant="primary" icon={busy ? <Loader2 className="wb-spin" /> : <FlaskConical />} onClick={run} disabled={!info.ok || !!busy}>
                    {busy ? `${t("td.loading")} ${busy}` : t("td.load_btn")}
                </Button>
            </div>
            {report && (
                <div className="mt-3 grid gap-1 rounded-md bg-white p-3 text-wb-12 text-wb-ntrl-8">
                    <p>
                        ✅ {t("td.r_xml", { n: report.created, total: report.xmlTotal })}
                        {report.duplicate > 0 && <> · {t("td.r_dup", { n: report.duplicate })}</>}
                        {report.newTaxIds.length > 0 && <> · {t("td.r_mst", { m: Array.from(new Set(report.newTaxIds)).join(", ") })}</>}
                    </p>
                    <p>🔑 {t("td.r_codes", { n: report.codesApplied })}{report.codesUnmatched.length > 0 && <span className="text-wb-warn-text"> · {t("td.r_codes_miss", { l: report.codesUnmatched.join(", ") })}</span>}</p>
                    <p>📄 {t("td.r_pdf", { n: report.pdfAttached })}{report.pdfUnmatched.length > 0 && <span className="text-wb-warn-text"> · {t("td.r_pdf_miss", { l: report.pdfUnmatched.join(", ") })}</span>}</p>
                    {report.errors.map((e) => (
                        <p key={e.file} className="text-wb-status-rejected-text">❌ {e.file}: {e.error}</p>
                    ))}
                    <div>
                        <button type="button" className="cursor-pointer font-semibold text-brand hover:underline" onClick={() => router.push("/invoices/purchase")}>
                            {t("td.open_list")} →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

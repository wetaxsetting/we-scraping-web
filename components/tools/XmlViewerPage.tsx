"use client";

import { ExternalLink, FileCode2, Plus, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import InvoiceSheet from "@/components/invoices/InvoiceSheet";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/shared/dialog";
import { importParsed } from "@/lib/api/weinvoice/invoices";
import { useTranslation } from "@/lib/i18n";
import { getState } from "@/lib/api/weinvoice/store";
import { findProvider, originalInvoiceUrl } from "@/lib/weinvoice/providers";
import type { Invoice } from "@/lib/weinvoice/types";
import { cn } from "@/lib/utils";
import { parseInvoiceXml, type ParsedXml } from "@/lib/weinvoice/xml";

/** Công cụ → Xem hoá đơn từ XML: render any e-invoice XML (vendor not supported yet / offline file). */
export default function XmlViewerPage() {
    const { t } = useTranslation();
    const { toast, alert } = useDialog();
    const input = useRef<HTMLInputElement>(null);
    const [drag, setDrag] = useState(false);
    const [doc, setDoc] = useState<{ parsed: ParsedXml; raw: string; name: string } | null>(null);

    const open = async (f: File) => {
        const raw = await f.text();
        try {
            setDoc({ parsed: parseInvoiceXml(raw), raw, name: f.name });
        } catch {
            alert({ title: t("files.invalid_xml"), kind: "error", message: t("files.invalid_xml_msg") });
        }
    };

    const asInvoice: Invoice | null = doc
        ? { ...doc.parsed, id: "preview", direction: "purchase", files: [], tags: [], source: "upload", syncedAt: "", lookupUrl: originalInvoiceUrl(doc.parsed.providerTaxId ?? doc.parsed.provider, doc.parsed.lookupCode, { company: doc.parsed.lookupCompany, sellerTaxId: doc.parsed.sellerTaxId, buyerTaxId: doc.parsed.buyerTaxId, number: doc.parsed.number })?.url ?? "" }
        : null;
    const prov = doc ? findProvider(doc.parsed.providerTaxId ?? doc.parsed.provider) : undefined;
    const link = doc ? originalInvoiceUrl(doc.parsed.providerTaxId ?? doc.parsed.provider, doc.parsed.lookupCode, { company: doc.parsed.lookupCompany, sellerTaxId: doc.parsed.sellerTaxId, buyerTaxId: doc.parsed.buyerTaxId, number: doc.parsed.number }) : null;

    return (
        <PageLayout>
            <PageHeader title={t("nav.i.xml_viewer")} subtitle={t("xv.subtitle")}>
                {doc && (
                    <>
                        <Button size="md" variant="neutral" onClick={() => setDoc(null)}>{t("xv.other")}</Button>
                        <Button size="md"
                            variant="primary"
                            icon={<Plus />}
                            onClick={async () => {
                                try {
                                    const res = await importParsed(doc.parsed, doc.raw, doc.name, getState().activeTaxId, "upload");
                                    toast(res.outcome === "foreign" ? t("up.o.foreign") : t(`up.o.${res.outcome}`), res.outcome === "new" || res.outcome === "merged" ? "success" : "info");
                                } catch (e) {
                                    // API mode: POST /uploads failed or the engine reported an error for this file.
                                    const err = e as { code?: string; message?: string };
                                    toast(`${err.message ?? String(e)}${err.code && err.code !== err.message ? ` (${err.code})` : ""}`, "error");
                                }
                            }}
                        >
                            {t("xv.add")}
                        </Button>
                    </>
                )}
            </PageHeader>
            {!asInvoice ? (
                <div
                    onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) open(f); }}
                    onClick={() => input.current?.click()}
                    className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-16 text-center", drag ? "border-brand bg-brand-soft" : "border-wb-ntrl-4 bg-wb-bg-card hover:border-brand")}
                >
                    <UploadCloud className="size-10 text-brand" />
                    <p className="text-wb-16 font-semibold">{t("xv.drop")}</p>
                    <p className="text-wb-13 text-wb-ntrl-6">{t("xv.hint")}</p>
                    <input ref={input} type="file" accept=".xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) open(f); e.target.value = ""; }} />
                </div>
            ) : (
                <div className="flex flex-col gap-2 rounded-lg bg-wb-bg-sidebar p-4">
                    <p className="flex items-center gap-1.5 text-wb-12 text-wb-ntrl-6"><FileCode2 className="size-4" />{doc?.name}</p>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-white px-4 py-3 text-wb-13 shadow-wb-card">
                        <span>
                            <span className="text-wb-ntrl-6">{t("detail.provider")}: </span>
                            <b>{prov ? `${prov.name}` : t("xv.unknown_provider")}</b>
                            {prov && <span className="text-wb-12 text-wb-ntrl-6"> · {t("common.mst")} {prov.taxId}</span>}
                        </span>
                        <span>
                            <span className="text-wb-ntrl-6">{t("detail.lookup_code")}: </span>
                            <b className="font-mono">{doc?.parsed.lookupCode || "—"}</b>
                        </span>
                        {link && (
                            <a href={link.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover">
                                <ExternalLink className="size-4" />
                                {link.direct ? t("files.open_original", { p: prov?.name ?? "" }) : t("inv.open_portal")}
                            </a>
                        )}
                    </div>
                    <InvoiceSheet inv={asInvoice} />
                </div>
            )}
        </PageLayout>
    );
}

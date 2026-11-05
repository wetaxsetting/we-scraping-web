"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import SearchInput from "@/components/shared/SearchInput";
import { Select } from "@/components/shared/Select";
import { StatusPill } from "@/components/shared/StatusPill";
import { useTranslation } from "@/lib/i18n";
import { listProviders, type ProviderLinkStatus, type ProviderList, type ProviderRec } from "@/lib/api/weinvoice/providers";
import { WeInvoiceApiError } from "@/lib/api/weinvoice/http";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { useStore } from "@/lib/api/weinvoice/store";
import { PROVIDERS, type Provider } from "@/lib/weinvoice/providers";

type Filter = "all" | "lookup" | "captcha" | "nolink" | "verify" | "used";

/**
 * api mode: the screen's filters on the server's `link_status` (ok · check · missing). "captcha" and
 * "used" are not server states — they are fetched unfiltered and narrowed on the client; "lookup"
 * is `ok` without a captcha endpoint.
 */
const SERVER_FILTER: Record<Filter, ProviderLinkStatus | undefined> = { all: undefined, used: undefined, captcha: undefined, lookup: "ok", nolink: "missing", verify: "check" };
const clientFilter = (f: Filter, p: ProviderRec) =>
    f === "used" ? p.invoiceCount > 0 : f === "captcha" ? !!p.captchaUrl : f === "lookup" ? !p.captchaUrl : true;

/** One table row, from the static catalogue (mock) or `GET /providers` (api). */
type Row = Omit<Provider, "lookupUrl"> & { lookupUrl: string | null; note: "verify" | "captcha" | "nolink" | "ok"; used?: number };

/**
 * api mode: GET /providers (keyword + link status on the server, debounced) with the tenant's
 * invoice count per provider. Returns null in mock mode.
 */
function useApiProviders(q: string, filter: Filter) {
    const [state, setState] = useState<{ key: string; list?: ProviderList; error?: string } | null>(null);
    const kw = q.trim();
    const linkStatus = SERVER_FILTER[filter];
    const key = `${kw}|${linkStatus ?? ""}`;
    useEffect(() => {
        if (DATA_SOURCE !== "api") return;
        let live = true;
        const timer = setTimeout(() => {
            listProviders({ keyword: kw, linkStatus }).then(
                (list) => live && setState({ key, list }),
                (e: Error) => live && setState({ key, error: e instanceof WeInvoiceApiError ? `${e.message} (${e.code})` : e.message }),
            );
        }, 300);
        return () => {
            live = false;
            clearTimeout(timer);
        };
    }, [key, kw, linkStatus]);
    if (DATA_SOURCE !== "api") return null;
    return { loading: state?.key !== key, list: state?.list, error: state?.key === key ? state.error : undefined };
}

/** Công cụ → Danh mục tổ chức cung cấp HĐĐT (lookup portals used to fetch original PDFs). */
export default function ProvidersPage() {
    const { t } = useTranslation();
    const invoices = useStore((s) => s.invoices);
    const [q, setQ] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const remote = useApiProviders(q, filter);

    const usage = useMemo(() => {
        const m = new Map<string, number>();
        invoices.forEach((i) => i.providerTaxId && m.set(i.providerTaxId, (m.get(i.providerTaxId) ?? 0) + 1));
        return m;
    }, [invoices]);

    const noLink = (p: Provider) => p.lookupUrl === p.web;
    const localRows = PROVIDERS.filter((p) => {
        const kw = q.trim().toLowerCase();
        if (kw && !`${p.name} ${p.fullName} ${p.taxId} ${p.web} ${p.lookupUrl}`.toLowerCase().includes(kw)) return false;
        if (filter === "lookup") return !noLink(p) && !p.captchaUrl;
        if (filter === "captcha") return !!p.captchaUrl;
        if (filter === "nolink") return noLink(p);
        if (filter === "used") return usage.has(p.taxId);
        if (filter === "verify") return !!p.verify;
        return true;
    });
    // api mode: the server already filtered by keyword + link status; the rest is narrowed here.
    const apiRows: Row[] = (remote?.list?.rows ?? [])
        .filter((p) => clientFilter(filter, p))
        .map((p) => ({
            ...p,
            captchaUrl: p.captchaUrl ?? undefined,
            verify: p.verify ?? undefined,
            note: p.linkStatus === "check" ? "verify" : p.linkStatus === "missing" ? "nolink" : p.captchaUrl ? "captcha" : "ok",
            used: p.invoiceCount || undefined,
        }));
    const mockRows: Row[] = localRows.map((p) => ({ ...p, note: p.verify ? "verify" : p.captchaUrl ? "captcha" : noLink(p) ? "nolink" : "ok", used: usage.get(p.taxId) }));
    const rows: Row[] = remote ? apiRows : mockRows;
    const total = remote ? apiRows.length : PROVIDERS.length;
    const host = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");

    return (
        <PageLayout>
            <PageHeader title={t("nav.i.providers")} subtitle={t("prov.subtitle", { n: total })} />
            <div className="flex flex-wrap items-center gap-2">
                <SearchInput value={q} onChange={setQ} placeholder={t("prov.search_ph")} className="md:w-[360px]" />
                <Select
                    value={filter}
                    prefix={t("prov.filter")}
                    width={260}
                    highlight={filter !== "all"}
                    options={(["all", "lookup", "captcha", "nolink", "verify", "used"] as const).map((v) => ({ value: v, label: t(`prov.f.${v}`) }))}
                    onChange={setFilter}
                />
                <span className="text-wb-13 text-wb-ntrl-6">{remote?.loading ? t("common.loading") : t("common.showing", { from: rows.length ? 1 : 0, to: rows.length, total })}</span>
            </div>
            <div className="flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-lg shadow-wb-card">
                <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
                    <table className="w-full min-w-[1320px] table-fixed border-collapse text-wb-13">
                        <colgroup>
                            <col style={{ width: 56 }} />
                            <col style={{ width: 150 }} />
                            <col style={{ width: 330 }} />
                            <col style={{ width: 116 }} />
                            <col style={{ width: 190 }} />
                            <col />
                            <col style={{ width: 150 }} />
                            <col style={{ width: 90 }} />
                        </colgroup>
                        <thead className="sticky top-0 z-10">
                            <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar text-left font-semibold text-wb-ntrl-8">
                                <th className="px-3">STT</th>
                                <th className="px-3">{t("prov.col.name")}</th>
                                <th className="px-3">{t("prov.col.company")}</th>
                                <th className="px-3">{t("common.mst")}</th>
                                <th className="px-3">Website</th>
                                <th className="px-3">{t("prov.col.lookup")}</th>
                                <th className="px-3">{t("prov.col.note")}</th>
                                <th className="px-3 text-right">{t("prov.col.used")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {remote?.error && (
                                <tr>
                                    <td colSpan={8} className="px-3 py-6 text-center text-wb-status-error-text">{remote.error}</td>
                                </tr>
                            )}
                            {remote && !remote.loading && !remote.error && rows.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-3 py-6 text-center text-wb-ntrl-6">{t("common.no_data")}</td>
                                </tr>
                            )}
                            {rows.map((p) => (
                                <tr key={p.taxId} className="h-12 border-b border-wb-table-border font-medium">
                                    <td className="px-3 text-wb-ntrl-6">{p.stt}</td>
                                    <td className="truncate px-3 text-brand-hover" title={p.name}>{p.name}</td>
                                    <td className="truncate px-3" title={p.fullName}>{p.fullName}</td>
                                    <td className="px-3 font-mono text-wb-12">{p.taxId}</td>
                                    <td className="truncate px-3">
                                        <a className="text-wb-ntrl-7 hover:text-brand hover:underline" href={p.web} target="_blank" rel="noreferrer" title={p.web}>{host(p.web)}</a>
                                    </td>
                                    <td className="truncate px-3">
                                        {p.lookupUrl ? (
                                            <a className="inline-flex max-w-full items-center gap-1 text-brand hover:underline" href={p.lookupUrl} target="_blank" rel="noreferrer" title={p.lookupUrl}>
                                                <span className="truncate">{host(p.lookupUrl)}</span>
                                                <ExternalLink className="size-3 shrink-0" />
                                            </a>
                                        ) : (
                                            "—"
                                        )}
                                        {p.altLookupUrls?.map((u) => (
                                            <a key={u} className="block truncate text-wb-12 text-brand/80 hover:underline" href={u} target="_blank" rel="noreferrer" title={u}>+ {host(u)}</a>
                                        ))}
                                    </td>
                                    <td className="px-3">
                                        {p.note === "verify" ? (
                                            <span title={p.verify}><StatusPill size="sm" variant="failed" label={t("prov.note.verify")} /></span>
                                        ) : p.note === "captcha" ? (
                                            <StatusPill size="sm" variant="warning" label={t("prov.note.captcha")} />
                                        ) : p.note === "nolink" ? (
                                            <StatusPill size="sm" variant="neutral" label={t("prov.note.nolink")} />
                                        ) : (
                                            <StatusPill size="sm" variant="success" label={t("prov.note.ok")} />
                                        )}
                                    </td>
                                    <td className="px-3 text-right tabular-nums">{p.used ?? "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <p className="text-wb-12 text-wb-ntrl-6">{t("prov.note")}</p>
        </PageLayout>
    );
}

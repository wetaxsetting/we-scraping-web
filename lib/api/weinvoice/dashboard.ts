/*
 * Dashboard data (screen 03 "Tổng quan").
 *
 * API: `GET /api/v1/weinvoice/dashboard?company_mst=&year=` — backend `DashboardResponse`
 * (interface-specification.md § "App and dashboard"). Used when DATA_SOURCE === "api".
 * MOCK: the same numbers computed from the in-memory store (default).
 *
 * Rules (02_Yeu_cau_nghiep_vu.md §3.1, §3.6 + note §03): scoped to the working MST; cancelled and
 * replaced invoices excluded from KPIs / months / top partners; amounts in VND.
 */
import axios from "axios";

import { api } from "@/lib/axios";
import { partnerOf } from "@/lib/api/weinvoice/invoices";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { getState } from "@/lib/api/weinvoice/store";
import type { ApiResponse, DashboardResponseRec } from "@/lib/types/api";
import { hasFile, isNoCode } from "@/lib/weinvoice/types";

export type DashboardSummary = {
    count: number;
    salesCount: number;
    purchaseCount: number;
    salesTotal: number;
    purchaseTotal: number;
    outVat: number;
    inVat: number;
    /** Always 12 entries, month 1–12. */
    months: { m: number; sales: number; purchase: number }[];
    missingXml: number;
    noCodeNoXml: number;
    missingPdf: number;
    incomplete: { month: string; fetched: number; total: number }[];
    lastSyncedAt: string | null;
    lastRun: { startedAt: string; newCount: number } | null;
    top: { taxId: string; name: string; total: number; count: number }[];
};

export class DashboardError extends Error {
    constructor(
        public code: string,
        message: string,
    ) {
        super(message);
    }
}

/**
 * Wire → in-memory, exactly once. `months[].month` is "yyyy-MM"; missing months are filled with zeros
 * so the chart always has 12 bars. The backend's `last_sync` has no "new invoices" count, so the
 * "last run" line (mock-only detail) is omitted in API mode — the header shows `last_sync.finished_at`.
 */
export function toDashboardSummary(rec: DashboardResponseRec): DashboardSummary {
    const byMonth = new Map(rec.months.map((x) => [Number(x.month.slice(5)), x]));
    return {
        count: rec.kpis.count,
        salesCount: rec.kpis.sales_count,
        purchaseCount: rec.kpis.purchase_count,
        salesTotal: rec.kpis.sales_total,
        purchaseTotal: rec.kpis.purchase_total,
        outVat: rec.kpis.out_vat,
        inVat: rec.kpis.in_vat,
        months: Array.from({ length: 12 }, (_, i) => ({
            m: i + 1,
            sales: byMonth.get(i + 1)?.sales ?? 0,
            purchase: byMonth.get(i + 1)?.purchase ?? 0,
        })),
        missingXml: rec.data_status.missing_xml,
        noCodeNoXml: rec.data_status.no_code_no_xml,
        missingPdf: rec.data_status.missing_pdf,
        incomplete: rec.data_status.incomplete_periods.map((x) => ({ month: x.month, fetched: x.got ?? 0, total: x.total ?? 0 })),
        lastSyncedAt: rec.last_sync?.finished_at ?? null,
        lastRun: null,
        top: rec.top_suppliers.map((p) => ({ taxId: p.tax_id, name: p.name, total: p.total, count: p.count })),
    };
}

async function fetchFromApi(companyMst: string, year: number): Promise<DashboardSummary> {
    try {
        const res = await api.get<ApiResponse<DashboardResponseRec>>("/api/v1/weinvoice/dashboard", { params: { company_mst: companyMst, year } });
        const body = res.data;
        if (!body?.status) throw new DashboardError("WBE_CLIENT_PARSE", "Unexpected response shape (missing `status`).");
        if (body.status.error || !body.data) throw new DashboardError(body.status.code, body.status.message);
        return toDashboardSummary(body.data);
    } catch (err) {
        if (err instanceof DashboardError) throw err;
        if (axios.isAxiosError(err)) {
            const env = err.response?.data as ApiResponse<unknown> | undefined;
            if (env?.status) throw new DashboardError(env.status.code, env.status.message);
            if (err.response) throw new DashboardError(`HTTP_${err.response.status}`, err.message);
            throw new DashboardError("WBE_NETWORK", err.message || "Network error");
        }
        throw new DashboardError("WBE_CLIENT_PARSE", err instanceof Error ? err.message : String(err));
    }
}

/** Same numbers from the mock store (the pre-API behaviour of the screen). */
export function computeFromStore(companyMst: string, year: number): DashboardSummary {
    const s = getState();
    const y = String(year);
    const mine = s.invoices.filter(
        (i) =>
            (i.direction === "purchase" ? i.buyerTaxId === companyMst : i.sellerTaxId === companyMst) &&
            i.issueDate.startsWith(y) &&
            i.status !== "cancelled" &&
            i.status !== "replaced",
    );
    const sales = mine.filter((i) => i.direction === "sales");
    const purchase = mine.filter((i) => i.direction === "purchase");
    const sum = (xs: typeof mine, f: (i: (typeof mine)[number]) => number) => xs.reduce((a, i) => a + f(i), 0);
    const months = Array.from({ length: 12 }, (_, m) => {
        const key = `${y}-${String(m + 1).padStart(2, "0")}`;
        return { m: m + 1, sales: sum(sales.filter((i) => i.issueDate.startsWith(key)), (i) => i.total), purchase: sum(purchase.filter((i) => i.issueDate.startsWith(key)), (i) => i.total) };
    });
    const partners = new Map<string, { taxId: string; name: string; total: number; count: number }>();
    purchase.forEach((i) => {
        const p = partnerOf(i);
        const cur = partners.get(p.taxId) ?? { taxId: p.taxId, name: p.name, total: 0, count: 0 };
        cur.total += i.total;
        cur.count++;
        partners.set(p.taxId, cur);
    });
    const run = s.history.find((h) => h.taxId === companyMst);
    return {
        count: mine.length,
        salesCount: sales.length,
        purchaseCount: purchase.length,
        salesTotal: sum(sales, (i) => i.total),
        purchaseTotal: sum(purchase, (i) => i.total),
        outVat: sum(sales, (i) => i.tax),
        inVat: sum(purchase, (i) => i.tax),
        months,
        missingXml: mine.filter((i) => !hasFile(i, "xml") && !isNoCode(i)).length,
        noCodeNoXml: mine.filter((i) => !hasFile(i, "xml") && isNoCode(i)).length,
        missingPdf: mine.filter((i) => !hasFile(i, "pdf")).length,
        incomplete: s.incomplete.filter((x) => x.taxId === companyMst).map((x) => ({ month: x.month, fetched: x.fetched, total: x.total })),
        lastSyncedAt: s.connections.find((c) => c.taxId === companyMst)?.lastSyncAt || null,
        lastRun: run ? { startedAt: run.startedAt, newCount: run.newCount } : null,
        top: Array.from(partners.values()).sort((a, b) => b.total - a.total).slice(0, 5),
    };
}

export async function getDashboard(companyMst: string, year: number): Promise<DashboardSummary> {
    return DATA_SOURCE === "api" ? fetchFromApi(companyMst, year) : computeFromStore(companyMst, year);
}

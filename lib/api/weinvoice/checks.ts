/*
 * MOCK checks — WeInvoice static UI (02_Yeu_cau_nghiep_vu.md §3.7).
 *
 * Runs the "Pre-filing invoice check" and "Supplier risk" checks over the
 * in-memory store, against the SIMULATED taxpayer registry in registry.ts.
 * Results are deterministic. Network latency / progress is simulated with
 * short timers so the progress UI can be exercised.
 *
 * The seed (mockData.ts) carries no signing / coding timestamps, no
 * abnormal VAT rates and only one name per partner, so three DEMO overlays
 * are derived here by hash (never written back to the store):
 *   - signed / coded dates for a few invoices (checkDates),
 *   - an out-of-range VAT rate on a few invoices (scanTaxRates),
 *   - an abbreviated name variant for one supplier (supplierRisk / checkValidity).
 * Replace with the backend checks once they exist; only this module changes.
 */
import { lookupTaxpayer, matchLevel, similarity, stableHash, type MatchLevel, type TaxpayerRecord } from "@/lib/api/weinvoice/registry";
import { getState } from "@/lib/api/weinvoice/store";
import { fullSymbol, hasFile, type Direction, type Invoice } from "@/lib/weinvoice/types";

export type PeriodKind = "month" | "quarter" | "year";
export function periodRange(kind: PeriodKind, n: number, year: number): { from: string; to: string; label: string } {
    const pad = (x: number) => String(x).padStart(2, "0");
    const last = (y: number, m: number) => new Date(y, m, 0).getDate();
    if (kind === "year") return { from: `${year}-01-01`, to: `${year}-12-31`, label: `${year}` };
    if (kind === "quarter") {
        const m1 = (n - 1) * 3 + 1, m3 = m1 + 2;
        return { from: `${year}-${pad(m1)}-01`, to: `${year}-${pad(m3)}-${last(year, m3)}`, label: `Q${n}/${year}` };
    }
    return { from: `${year}-${pad(n)}-01`, to: `${year}-${pad(n)}-${last(year, n)}`, label: `${pad(n)}/${year}` };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Invoices of the working MST (§3.1) in one direction and period. */
const scope = (taxId: string, direction: Direction, from: string, to: string): Invoice[] =>
    getState().invoices.filter(
        (i) => i.direction === direction && (direction === "purchase" ? i.buyerTaxId : i.sellerTaxId) === taxId && i.issueDate >= from && i.issueDate <= to,
    );

/* ---------- DEMO overlays (see file header) ---------- */

/** Supplier whose invoices alternate between the full name and an abbreviated one. */
const MULTI_NAME: Record<string, (name: string) => string> = {
    "0109787878": (n) => n.replace("CÔNG TY CỔ PHẦN", "CÔNG TY CP"),
};
const partnerParty = (inv: Invoice) => {
    const p = inv.direction === "purchase" ? { taxId: inv.sellerTaxId, name: inv.sellerName, address: inv.sellerAddress } : { taxId: inv.buyerTaxId, name: inv.buyerName, address: inv.buyerAddress };
    const variant = MULTI_NAME[p.taxId];
    if (variant && Number(inv.number) % 2 === 1) p.name = variant(p.name);
    return p;
};

const addDays = (d: string, n: number) => {
    const x = new Date(`${d}T00:00:00`);
    x.setDate(x.getDate() + n);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

/* ---------- Review items (3 sections) ---------- */

export type ReviewItems = {
    total: number;
    lifecycle: Invoice[]; // huỷ / thay thế / điều chỉnh
    noXml: Invoice[];
};
export function reviewItems(taxId: string, direction: Direction, from: string, to: string): ReviewItems {
    const inv = scope(taxId, direction, from, to);
    return {
        total: inv.length,
        lifecycle: inv.filter((i) => i.status !== "original"),
        noXml: inv.filter((i) => !hasFile(i, "xml")),
    };
}

export type DateIssue = { inv: Invoice; issue: "signed_diff" | "coded_late"; signed?: string; coded?: string };
/** Signing / CQT-coding date different from the issue date (simulated timestamps, see header). */
export async function checkDates(taxId: string, direction: Direction, from: string, to: string): Promise<{ checked: number; issues: DateIssue[] }> {
    const inv = scope(taxId, direction, from, to).filter((i) => i.status !== "cancelled");
    await sleep(500);
    const issues: DateIssue[] = [];
    for (const i of inv) {
        const h = stableHash(`dates|${i.id}`);
        if (h % 13 === 0) {
            const signed = addDays(i.issueDate, 1 + (h % 3));
            issues.push({ inv: i, issue: "signed_diff", signed, coded: i.cqtCode ? signed : undefined });
        } else if (i.cqtCode && h % 17 === 0) {
            issues.push({ inv: i, issue: "coded_late", signed: i.issueDate, coded: addDays(i.issueDate, 1 + (h % 4)) });
        }
    }
    return { checked: inv.length, issues };
}

/* ---------- Partner validity vs registry ---------- */

export type PartnerProblem = "address_diff" | "name_diff" | "not_found" | "inactive";
export type ValidityRow = { inv: Invoice; reason: PartnerProblem };
export type ValidityResult = { checkedPartners: number; problems: ValidityRow[]; okCount: number; byReason: Record<PartnerProblem, number> };

/** One reason per invoice, most severe first: not found → inactive → name → address. */
function problemOf(reg: TaxpayerRecord, name: string, address: string): PartnerProblem | null {
    if (!reg.found) return "not_found";
    if (reg.status !== "active") return "inactive";
    if (similarity(name, reg.name) < 0.95) return "name_diff";
    if (similarity(address, reg.address) < 0.95) return "address_diff";
    return null;
}

export async function checkValidity(
    taxId: string, direction: Direction, from: string, to: string,
    onProgress?: (done: number, total: number, current: { taxId: string; name: string; state: "checking" | "done" }[]) => void,
): Promise<ValidityResult> {
    // Cancelled invoices are not declared, so they are not checked.
    const inv = scope(taxId, direction, from, to).filter((i) => i.status !== "cancelled");
    const partners = Array.from(new Map(inv.map((i) => [partnerParty(i).taxId, partnerParty(i).name])).entries());
    const regs = new Map<string, TaxpayerRecord>();
    const recent: { taxId: string; name: string; state: "checking" | "done" }[] = [];
    for (let k = 0; k < partners.length; k++) {
        const [pid, name] = partners[k];
        recent.push({ taxId: pid, name, state: "checking" });
        if (recent.length > 4) recent.shift();
        onProgress?.(k, partners.length, [...recent]);
        await sleep(180 + (stableHash(pid) % 220));
        regs.set(pid, lookupTaxpayer(pid));
        recent[recent.length - 1] = { ...recent[recent.length - 1], state: "done" };
        onProgress?.(k + 1, partners.length, [...recent]);
    }
    const byReason: Record<PartnerProblem, number> = { address_diff: 0, name_diff: 0, not_found: 0, inactive: 0 };
    const problems: ValidityRow[] = [];
    for (const i of inv) {
        const p = partnerParty(i);
        const reason = problemOf(regs.get(p.taxId)!, p.name, p.address);
        if (!reason) continue;
        byReason[reason]++;
        problems.push({ inv: i, reason });
    }
    return { checkedPartners: partners.length, problems, okCount: inv.length - problems.length, byReason };
}

/* ---------- Supplier risk ---------- */

export type RiskRow = {
    taxId: string;
    invoiceName: string;
    invoiceAddress: string;
    namesOnInvoices: string[];
    invoiceCount: number;
    reg: TaxpayerRecord;
    nameScore: number;
    addrScore: number;
    level: MatchLevel | "na";
    rating: "safe" | "review" | "high";
};
export type RiskChip = "all" | "warned" | "multi_name" | "mismatch" | "high" | "review" | "not_found";

function rate(reg: TaxpayerRecord, level: RiskRow["level"], names: number): RiskRow["rating"] {
    if (!reg.found || reg.status === "closed" || reg.status === "absconded" || level === "major") return "high";
    if (reg.status !== "active" || reg.warned || level === "minor" || names > 1) return "review";
    return "safe";
}

export async function supplierRisk(
    taxId: string, direction: Direction, from: string, to: string,
    onProgress?: (done: number, total: number) => void,
): Promise<RiskRow[]> {
    const inv = scope(taxId, direction, from, to);
    const groups = new Map<string, Invoice[]>();
    inv.forEach((i) => {
        const id = partnerParty(i).taxId;
        groups.set(id, [...(groups.get(id) ?? []), i]);
    });
    const out: RiskRow[] = [];
    let done = 0;
    onProgress?.(0, groups.size);
    for (const [pid, list] of groups) {
        await sleep(150 + (stableHash(pid) % 200));
        const sorted = [...list].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
        const latest = partnerParty(sorted[0]);
        const names = Array.from(new Set(sorted.map((i) => partnerParty(i).name)));
        const reg = lookupTaxpayer(pid);
        const nameScore = reg.found ? similarity(latest.name, reg.name) : 0;
        const addrScore = reg.found ? similarity(latest.address, reg.address) : 0;
        const level = reg.found ? matchLevel(Math.min(nameScore, addrScore)) : "na";
        out.push({ taxId: pid, invoiceName: latest.name, invoiceAddress: latest.address, namesOnInvoices: names, invoiceCount: list.length, reg, nameScore, addrScore, level, rating: rate(reg, level, names.length) });
        onProgress?.(++done, groups.size);
    }
    const order = { high: 0, review: 1, safe: 2 } as const;
    return out.sort((a, b) => order[a.rating] - order[b.rating] || b.invoiceCount - a.invoiceCount);
}

export function chipOf(r: RiskRow, chip: RiskChip): boolean {
    switch (chip) {
        case "all": return true;
        case "warned": return r.reg.warned;
        case "multi_name": return r.namesOnInvoices.length > 1;
        case "mismatch": return r.level === "minor" || r.level === "major";
        case "high": return r.rating === "high";
        case "review": return r.rating === "review";
        case "not_found": return !r.reg.found;
    }
}

/* ---------- Abnormal VAT rates ---------- */

const VALID = new Set([0, 5, 8, 10, -1]);
export type RateIssue = { inv: Invoice; rates: number[]; kind: "invalid" | "multi" };
export const rateLabel = (r: number) => (r < 0 ? "KCT" : `${r}%`);

/** Rates printed on the invoice lines (plus the DEMO out-of-range overlay, see header). */
function ratesOf(inv: Invoice): number[] {
    const rates = Array.from(new Set(inv.items.map((i) => i.vatRate)));
    const h = stableHash(`rate|${inv.id}`);
    if (h % 29 === 0) return [h % 2 ? 7 : 12];
    return rates;
}

export async function scanTaxRates(taxId: string, direction: Direction, from: string, to: string, onProgress?: (d: number, t: number) => void): Promise<{ checked: number; issues: RateIssue[] }> {
    const inv = scope(taxId, direction, from, to).filter((i) => i.status !== "cancelled");
    const issues: RateIssue[] = [];
    const batch = 20;
    for (let k = 0; k < inv.length; k += batch) {
        onProgress?.(k, inv.length);
        await sleep(120);
        for (const i of inv.slice(k, k + batch)) {
            const rates = ratesOf(i);
            if (rates.some((r) => !VALID.has(r))) issues.push({ inv: i, rates, kind: "invalid" });
            else if (rates.length > 1) issues.push({ inv: i, rates, kind: "multi" });
        }
    }
    onProgress?.(inv.length, inv.length);
    return { checked: inv.length, issues };
}

/* ---------- Taxpayer lookup ---------- */

export const LOOKUP_LIMIT = 100;
/** Split on whitespace / comma / semicolon; valid = 10 digits or 10-3 (branch), capped at 100 per run (§3.7). */
export function parseTaxIdList(text: string): { valid: string[]; invalid: string[]; overflow: number } {
    const parts = text.split(/[\s,;\t]+/).map((s) => s.trim()).filter(Boolean);
    const uniq = Array.from(new Set(parts));
    const ok = uniq.filter((s) => /^\d{10}(-\d{3})?$/.test(s));
    return { valid: ok.slice(0, LOOKUP_LIMIT), invalid: uniq.filter((s) => !/^\d{10}(-\d{3})?$/.test(s)), overflow: Math.max(0, ok.length - LOOKUP_LIMIT) };
}
export async function lookupOne(taxId: string): Promise<TaxpayerRecord> {
    await sleep(160 + (stableHash(taxId) % 260));
    return lookupTaxpayer(taxId);
}
export const invoiceRef = (i: Invoice) => `${fullSymbol(i)} · ${i.number}`;

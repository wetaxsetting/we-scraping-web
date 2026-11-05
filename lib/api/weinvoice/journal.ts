/*
 * Auto journal (Tự động hạch toán, §3.9) — MOCK implementation over the
 * in-memory store for the static WeInvoice UI.
 *
 * Proposes debit/credit lines for the active MST's invoices in a period under
 * TT200 or TT133. User rules live in state.journalRules (reset on reload) and
 * override the defaults. Everything is computed client-side from the seeded
 * invoices; the production posting engine (and the Excel file — backend owns
 * XLSX generation) belongs to weinvoice-api.
 */

import { fullSymbol, isCashRegister, type Direction, type Invoice } from "@/lib/weinvoice/types";
import { getState, setState } from "@/lib/api/weinvoice/store";
import { partnerOf } from "@/lib/api/weinvoice/invoices";
import { sleep } from "@/lib/utils";

export type Regime = "tt200" | "tt133";
export type CaseKey = "service" | "goods" | "sales";

export type JournalRule = {
    id: string;
    direction: Direction;
    partnerTaxId?: string; // empty = any partner
    keyword?: string; // matched against item names (case/diacritics-insensitive)

    main: string;

    counter: string;
    createdAt: string;
};

export type JournalEntry = {
    id: string;
    invId: string;
    direction: Direction;
    date: string;
    ref: string;
    partnerTaxId: string;
    partnerName: string;
    desc: string;
    debit: string;
    credit: string;
    amount: number;
    caseKey: CaseKey;
    ruleId?: string;
    line: "main" | "vat";
};

export const ACCOUNTS: Record<string, string> = {
    "111": "Tiền mặt",
    "112": "Tiền gửi ngân hàng",
    "131": "Phải thu của khách hàng",
    "1331": "Thuế GTGT được khấu trừ",
    "1332": "Thuế GTGT được khấu trừ của TSCĐ",
    "152": "Nguyên liệu, vật liệu",
    "153": "Công cụ, dụng cụ",
    "156": "Hàng hoá",
    "211": "Tài sản cố định hữu hình",
    "242": "Chi phí trả trước",
    "331": "Phải trả người bán",
    "3331": "Thuế GTGT đầu ra phải nộp",
    "511": "Doanh thu bán hàng và cung cấp dịch vụ",
    "5111": "Doanh thu bán hàng hoá",
    "5113": "Doanh thu cung cấp dịch vụ",
    "627": "Chi phí sản xuất chung",
    "641": "Chi phí bán hàng",
    "642": "Chi phí quản lý doanh nghiệp",
    "6421": "Chi phí bán hàng",
    "6422": "Chi phí quản lý doanh nghiệp",
    "811": "Chi phí khác",
};
export const accName = (a: string) => ACCOUNTS[a] ?? "";

export function defaults(regime: Regime): Record<CaseKey, { debit: string[]; credit: string[] }> {
    const cost = regime === "tt133" ? "6422" : "642";
    return {
        service: { debit: [cost, "1331"], credit: ["331"] },
        goods: { debit: ["156", "1331"], credit: ["331"] },
        sales: { debit: ["131"], credit: ["511", "3331"] },
    };
}

/** Lower-case, strip Vietnamese diacritics (đ → d), collapse spaces — for keyword matching. */
const norm = (s: string): string =>
    s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

const SERVICE_RE = /dich vu|cuoc|phi |phi$|thue (van phong|nha|xe|mat bang)|sua chua|bao tri|bao duong|tu van|van chuyen|quang cao|dien|nuoc|internet|vien thong|an uong|khach san|ve may bay|dao tao|phan mem|ban quyen|thue bao|hosting|bao hiem/;
/** Units that only make sense for a service (time, occurrence, subscription, metered utility, meal). */
const SERVICE_UNITS = new Set(["thang", "lan", "goi", "chuyen", "gio", "ngay", "ky", "nam", "suat", "thue bao", "kwh", "m3", "khoan", "dich vu", "tuan"]);

/*
 * Service vs goods for a PURCHASE invoice — deterministic heuristic (no
 * product catalogue in the MVP):
 *   1. An item is a "service" when its normalised name matches SERVICE_RE
 *      (fees, freight, utilities, rent, software licences, consulting …) OR its
 *      unit is a service unit (Tháng, Lần, Gói, Chuyến, Suất, kWh …).
 *      Everything else (Cái, Hộp, Ram, Lít, Bộ, Thùng …) counts as goods.
 *   2. The invoice is "service" when service items make up MORE than half of
 *      its pre-tax value; otherwise "goods" (ties → goods, i.e. stock 156).
 *   Note: "nuoc" also matches bottled water by name — the unit rule does not
 *   override a name hit; a user rule (keyword) is the escape hatch.
 * Sales invoices are always "sales".
 */
function isServiceItem(name: string, unit: string): boolean {
    return SERVICE_RE.test(norm(name)) || SERVICE_UNITS.has(norm(unit));
}

export function classify(inv: Invoice): CaseKey {
    if (inv.direction === "sales") return "sales";
    let service = 0;
    let total = 0;
    for (const it of inv.items) {
        const v = Math.abs(it.amount);
        total += v;
        if (isServiceItem(it.name, it.unit)) service += v;
    }
    if (total === 0) return inv.items.some((it) => isServiceItem(it.name, it.unit)) ? "service" : "goods";
    return service * 2 > total ? "service" : "goods";
}

export function listRules(): JournalRule[] {
    return getState().journalRules ?? [];
}

export function saveRule(r: Omit<JournalRule, "id" | "createdAt">): void {
    const rule: JournalRule = {
        ...r,
        partnerTaxId: r.partnerTaxId || undefined,
        keyword: r.keyword?.trim() || undefined,
        id: `jr-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
        createdAt: new Date().toISOString(),
    };
    setState((s) => {
        s.journalRules = [...(s.journalRules ?? []), rule];
    });
}

export function removeRule(id: string): void {
    setState((s) => {
        s.journalRules = (s.journalRules ?? []).filter((r) => r.id !== id);
    });
}

/*
 * A rule applies when its direction matches AND every condition it sets
 * matches (partner MST equal; keyword contained in any item name, both
 * normalised). Most specific wins: partner+keyword > partner > keyword; ties →
 * the most recently created rule.
 */
function matchRule(inv: Invoice, rules: JournalRule[]): JournalRule | undefined {
    const partner = partnerOf(inv).taxId;
    const names = inv.items.map((i) => norm(i.name));
    const score = (r: JournalRule) => (r.partnerTaxId ? 2 : 0) + (r.keyword ? 1 : 0);
    return rules
        .filter((r) => r.direction === inv.direction)
        .filter((r) => r.partnerTaxId || r.keyword)
        .filter((r) => !r.partnerTaxId || r.partnerTaxId === partner)
        .filter((r) => {
            const kw = r.keyword ? norm(r.keyword) : "";
            return !kw || names.some((n) => n.includes(kw));
        })
        .sort((a, b) => score(b) - score(a) || b.createdAt.localeCompare(a.createdAt))[0];
}

export type JournalResult = { entries: JournalEntry[]; invoices: number; skipped: { cancelled: number; replaced: number; cashRegister: number }; byRule: number };

/*
 * Lines per invoice (§3.9):
 *   purchase  main: Dr <cost/goods account> / Cr <counter, default 331>   = pre-tax value
 *             vat : Dr 1331                 / Cr <counter>                = VAT
 *   sales     main: Dr <counter, default 131> / Cr <revenue, default 511> = pre-tax value
 *             vat : Dr <counter>              / Cr 3331                   = VAT
 * A rule replaces the main account (main) and the settlement account (counter).
 * The VAT line is omitted when the invoice carries no VAT (0% / KCT), so a
 * 0-amount line is never proposed.
 * Skipped: cancelled and replaced invoices (the replacement is posted instead),
 * and cash-register invoices (4th KHHDon char = M) unless includeCashRegister.
 * Amounts are taken in the invoice currency (the seed is VND only; FX
 * conversion is a backend concern).
 * Descriptions ("Diễn giải") are generated in Vietnamese on purpose: they are
 * voucher data destined for Vietnamese books, not UI copy.
 */
export async function proposeJournal(opts: { taxId: string; from: string; to: string; regime: Regime; includeCashRegister: boolean }): Promise<JournalResult> {
    await sleep(500);
    const { taxId, from, to, regime, includeCashRegister } = opts;
    const rules = listRules();
    const def = defaults(regime);
    const skipped = { cancelled: 0, replaced: 0, cashRegister: 0 };
    let invoices = 0;
    let byRule = 0;
    const entries: JournalEntry[] = [];

    const scope = getState()
        .invoices.filter((i) => (i.direction === "purchase" ? i.buyerTaxId : i.sellerTaxId) === taxId)
        .filter((i) => i.issueDate >= from && i.issueDate <= to)
        .sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.number.localeCompare(b.number));

    for (const inv of scope) {
        if (inv.status === "cancelled") { skipped.cancelled++; continue; }
        if (inv.status === "replaced") { skipped.replaced++; continue; }
        if (isCashRegister(inv) && !includeCashRegister) { skipped.cashRegister++; continue; }
        invoices++;
        const caseKey = classify(inv);
        const rule = matchRule(inv, rules);
        if (rule) byRule++;
        const p = partnerOf(inv);
        const ref = `${fullSymbol(inv)}-${inv.number}`;
        const first = inv.items[0]?.name ?? "";
        const more = inv.items.length > 1 ? ` (+${inv.items.length - 1})` : "";
        const base = { invId: inv.id, direction: inv.direction, date: inv.issueDate, ref, partnerTaxId: p.taxId, partnerName: p.name, caseKey, ruleId: rule?.id };

        if (inv.direction === "purchase") {
            const counter = rule?.counter ?? def[caseKey].credit[0];
            const main = rule?.main ?? def[caseKey].debit[0];
            entries.push({ ...base, id: `${inv.id}-main`, line: "main", desc: `${caseKey === "service" ? "Mua dịch vụ" : "Mua hàng"}: ${first}${more}`, debit: main, credit: counter, amount: inv.preTax });
            if (inv.tax !== 0) entries.push({ ...base, id: `${inv.id}-vat`, line: "vat", desc: `Thuế GTGT đầu vào HĐ ${inv.number}`, debit: def[caseKey].debit[1] ?? "1331", credit: counter, amount: inv.tax });
        } else {
            const counter = rule?.counter ?? def.sales.debit[0];
            const main = rule?.main ?? def.sales.credit[0];
            entries.push({ ...base, id: `${inv.id}-main`, line: "main", desc: `Bán hàng/dịch vụ: ${first}${more}`, debit: counter, credit: main, amount: inv.preTax });
            if (inv.tax !== 0) entries.push({ ...base, id: `${inv.id}-vat`, line: "vat", desc: `Thuế GTGT đầu ra HĐ ${inv.number}`, debit: counter, credit: def.sales.credit[1] ?? "3331", amount: inv.tax });
        }
    }
    return { entries, invoices, skipped, byRule };
}

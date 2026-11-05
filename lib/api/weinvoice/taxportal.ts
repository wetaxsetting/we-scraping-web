/*
 * Tax e-service portal (thuedientu / dichvucong.gdt.gov.vn) — MOCK implementation
 * over the in-memory store, for the static WeInvoice UI (§3.8).
 *
 * Nothing here talks to the real portal. connectPortal() only checks the
 * captcha the user typed against the locally drawn one (makeCaptcha in
 * sync.ts), validates the account format and records a PortalConnection in
 * the store — the password is never stored or returned (§3.10). portalData()
 * fabricates deterministic, fictional returns / payment slips / notices from
 * a hash of the MST so every reload shows the same rows. The real sign-in,
 * PDF download and daily sync are a weinvoice-api decision.
 */
import { getState, setState } from "@/lib/api/weinvoice/store";
import type { PortalConnection } from "@/lib/api/weinvoice/mockData";
import { sleep } from "@/lib/utils";

export type FiledReturnKind = "main" | "add";
export type FiledReturnStatus = "accepted" | "received";

export type FiledReturn = { id: string; form: string; name: string; period: string; kind: FiledReturnKind; submittedAt: string; status: FiledReturnStatus; code: string; amount?: number };
export type PaymentSlip = { id: string; ref: string; paidAt: string; chapter: string; subItem: string; content: string; amount: number; bank: string; status: "paid" };
export type TaxNotice = { id: string; date: string; title: string; ref: string };

export type ConnectPortalResult = { ok: false; error: "captcha" } | { ok: false; error: "auth" } | { ok: true; error?: undefined };

/**
 * Organisation accounts are `<MST>-QL` (admin), `-VP` or `-CV`; a bare MST gets
 * `-QL` appended (as the portal does). Individuals sign in with their personal
 * MST (10 digits) or 12-digit citizen ID. Returns the normalised account, or
 * null when the format is wrong.
 */
export function normalizePortalAccount(taxId: string, account: string, kind: "org" | "person"): string | null {
    const a = account.trim().toUpperCase();
    if (kind === "person") return /^(\d{10}|\d{12})$/.test(a) ? a : null;
    const m = /^(\d{10}(?:-\d{3})?)(?:-(QL|VP|CV))?$/.exec(a);
    if (!m || m[1] !== taxId) return null;
    return `${m[1]}-${m[2] ?? "QL"}`;
}

export async function connectPortal(p: { taxId: string; account: string; password: string; kind: "org" | "person"; captcha: string; expected: string }): Promise<ConnectPortalResult> {
    await sleep(800);
    if (p.captcha.trim().toUpperCase() !== p.expected.toUpperCase()) return { ok: false, error: "captcha" };
    const account = normalizePortalAccount(p.taxId, p.account, p.kind);
    // Mock rule so the error path can be demoed (same as sync.ts): passwords shorter than 6 chars are "wrong".
    if (!account || p.password.length < 6) return { ok: false, error: "auth" };
    const conn: PortalConnection = { taxId: p.taxId, account, kind: p.kind, connectedAt: new Date().toISOString() };
    setState((s) => {
        s.portals = [...(s.portals ?? []).filter((x) => x.taxId !== p.taxId), conn];
    });
    return { ok: true };
}

export function disconnectPortal(taxId: string): void {
    setState((s) => {
        s.portals = (s.portals ?? []).filter((x) => x.taxId !== taxId);
    });
}

export const portalOf = (taxId: string): PortalConnection | undefined => (getState().portals ?? []).find((p) => p.taxId === taxId);

/** FNV-1a — stable seed per MST/period so mock rows never change between renders. */
function h(s: string): number {
    let x = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        x ^= s.charCodeAt(i);
        x = Math.imul(x, 0x01000193);
    }
    return x >>> 0;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** Amount in [lo, hi] rounded to thousands, derived from a key. */
const amt = (key: string, lo: number, hi: number) => Math.round((lo + (h(key) % (hi - lo))) / 1000) * 1000;
const txCode = (key: string) => `11320${String(h(key) % 10 ** 9).padStart(9, "0")}`;

/** Demo "today" is 30/10/2026 (same as the seed), so filings run through Sep 2026. */
const LAST_MONTH = 9;
const YEAR = 2026;
const BANKS = ["Vietcombank", "BIDV", "VietinBank", "Agribank"];

/*
 * Budget classification codes on the slips (fictional company, real code list):
 * chapter 754 = private economic organisations; sub-items 1701 VAT on domestic
 * goods/services, 1052 CIT, 1001 PIT on salaries, 2862 business licence fee.
 */
export function portalData(taxId: string): { returns: FiledReturn[]; slips: PaymentSlip[]; notices: TaxNotice[] } {
    const returns: FiledReturn[] = [];
    const slips: PaymentSlip[] = [];
    const notices: TaxNotice[] = [];
    const monthlyVat = h(taxId) % 2 === 0;
    const bank = BANKS[h(`${taxId}|bank`) % BANKS.length];

    const addReturn = (r: Omit<FiledReturn, "id" | "code" | "status">, subItem?: string, content?: string) => {
        const key = `${taxId}|${r.form}|${r.period}|${r.kind}`;
        const ret: FiledReturn = { ...r, id: `fr-${h(key).toString(36)}`, code: txCode(key), status: h(`${key}|st`) % 5 === 0 ? "received" : "accepted" };
        returns.push(ret);
        if (subItem && content && ret.amount && ret.amount > 0) {
            const paid = new Date(`${r.submittedAt}T00:00:00`);
            paid.setDate(paid.getDate() + (h(`${key}|d`) % 3));
            slips.push({
                id: `ps-${h(`${key}|slip`).toString(36)}`,
                ref: `GNT${String(h(`${key}|ref`) % 10 ** 10).padStart(10, "0")}`,
                paidAt: `${paid.getFullYear()}-${pad(paid.getMonth() + 1)}-${pad(paid.getDate())}`,
                chapter: "754",
                subItem,
                content: `${content} ${r.period}`,
                amount: ret.amount,
                bank,
                status: "paid",
            });
        }
    };

    // VAT (01/GTGT): monthly or quarterly filer depending on the MST. Due the 20th / last day of the next period.
    if (monthlyVat) {
        for (let m = 1; m <= LAST_MONTH; m++) {
            const period = `${pad(m)}/${YEAR}`;
            addReturn({ form: "01/GTGT", name: "Tờ khai thuế GTGT (khấu trừ)", period, kind: "main", submittedAt: `${YEAR}-${pad(m + 1)}-${pad(15 + (h(`${taxId}|${m}`) % 5))}`, amount: amt(`${taxId}|vat|${m}`, 12_000_000, 96_000_000) }, "1701", "Thuế GTGT hàng sản xuất, kinh doanh trong nước kỳ");
        }
    } else {
        for (let q = 1; q <= LAST_MONTH / 3; q++) {
            const period = `Q${q}/${YEAR}`;
            addReturn({ form: "01/GTGT", name: "Tờ khai thuế GTGT (khấu trừ)", period, kind: "main", submittedAt: `${YEAR}-${pad(q * 3 + 1)}-${pad(20 + (h(`${taxId}|q${q}`) % 8))}`, amount: amt(`${taxId}|vat|q${q}`, 40_000_000, 260_000_000) }, "1701", "Thuế GTGT hàng sản xuất, kinh doanh trong nước kỳ");
        }
    }
    // One supplementary VAT return for a deterministic past period.
    const addM = 2 + (h(`${taxId}|add`) % 5);
    addReturn({ form: "01/GTGT", name: "Tờ khai thuế GTGT (khấu trừ) — bổ sung", period: monthlyVat ? `${pad(addM)}/${YEAR}` : `Q1/${YEAR}`, kind: "add", submittedAt: `${YEAR}-${pad(addM + 3)}-${pad(5 + (h(`${taxId}|addd`) % 10))}`, amount: amt(`${taxId}|vatadd`, 1_000_000, 9_000_000) }, "1701", "Thuế GTGT bổ sung kỳ");

    // PIT withholding (05/KK-TNCN), quarterly.
    for (let q = 1; q <= LAST_MONTH / 3; q++) {
        addReturn({ form: "05/KK-TNCN", name: "Tờ khai khấu trừ thuế TNCN", period: `Q${q}/${YEAR}`, kind: "main", submittedAt: `${YEAR}-${pad(q * 3 + 1)}-${pad(18 + (h(`${taxId}|pit${q}`) % 10))}`, amount: amt(`${taxId}|pit|${q}`, 3_000_000, 28_000_000) }, "1001", "Thuế TNCN từ tiền lương, tiền công");
    }
    // Annual filings for the previous year.
    addReturn({ form: "03/TNDN", name: "Tờ khai quyết toán thuế TNDN", period: `${YEAR - 1}`, kind: "main", submittedAt: `${YEAR}-03-${pad(20 + (h(`${taxId}|cit`) % 10))}`, amount: amt(`${taxId}|cit`, 60_000_000, 480_000_000) }, "1052", "Thuế TNDN quyết toán năm");
    addReturn({ form: "05/QTT-TNCN", name: "Tờ khai quyết toán thuế TNCN", period: `${YEAR - 1}`, kind: "main", submittedAt: `${YEAR}-03-${pad(25 + (h(`${taxId}|pitq`) % 6))}` });
    addReturn({ form: "B01-DN", name: "Báo cáo tài chính năm", period: `${YEAR - 1}`, kind: "main", submittedAt: `${YEAR}-03-${pad(26 + (h(`${taxId}|bctc`) % 5))}` });
    // Business licence fee (paid by 30/01, no return needed after the first year).
    slips.push({ id: `ps-${h(`${taxId}|lpmb`).toString(36)}`, ref: `GNT${String(h(`${taxId}|lpmbref`) % 10 ** 10).padStart(10, "0")}`, paidAt: `${YEAR}-01-${pad(10 + (h(`${taxId}|lpmbd`) % 15))}`, chapter: "754", subItem: "2862", content: `Lệ phí môn bài năm ${YEAR}`, amount: h(taxId) % 3 === 0 ? 2_000_000 : 3_000_000, bank, status: "paid" });

    // Notices (acknowledgement / acceptance letters from the tax authority).
    const sorted = [...returns].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    sorted.slice(0, 5).forEach((r, i) => {
        notices.push({ id: `tn-${r.id}`, date: r.submittedAt, title: `Thông báo chấp nhận hồ sơ khai thuế điện tử — ${r.form} kỳ ${r.period}`, ref: `${String(1000 + (h(`${r.id}|n`) % 9000))}/TB-TĐT` });
        if (i === 1) notices.push({ id: `tn-${r.id}-due`, date: r.submittedAt, title: `Thông báo về việc nộp tiền thuế, tiền chậm nộp — kỳ ${r.period}`, ref: `${String(1000 + (h(`${r.id}|d`) % 9000))}/TB-CCT` });
    });

    return {
        returns: sorted,
        slips: slips.sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
        notices: notices.sort((a, b) => b.date.localeCompare(a.date)),
    };
}

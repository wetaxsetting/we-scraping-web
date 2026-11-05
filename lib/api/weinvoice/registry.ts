/*
 * MOCK taxpayer registry — WeInvoice static UI (02_Yeu_cau_nghiep_vu.md §3.7).
 *
 * The official source (tracuunnt.gdt.gov.vn) is captcha-protected and has no
 * public API; the production data source is still to be decided by Dev & PO.
 * Until then every record here is SIMULATED (`source: "sim"`) and fully
 * deterministic: the same tax ID always yields the same record (FNV-1a hash).
 *  - Tax IDs that appear on invoices in the store reuse the name / address
 *    printed on those invoices, so most partners "match".
 *  - A fixed set of seed partners (DEMO) carries deliberate findings —
 *    suspended / absconded / closed / not found / renamed / moved / GDT
 *    warning — so Invoice check and Supplier risk always have something to show.
 *  - Unknown tax IDs get a hash-driven status mix and a generated identity.
 *  - A result the user recorded by hand from the GDT page (saveGdtVerified)
 *    overrides the simulation everywhere (`source: "gdt"`).
 * Nothing is fetched from any third-party site.
 */
import { MY_COMPANIES } from "@/lib/api/weinvoice/mockData";
import type { GdtVerified } from "@/lib/api/weinvoice/mockData";
import { getState, setState } from "@/lib/api/weinvoice/store";

export type TaxpayerStatus = "active" | "suspended" | "closed" | "absconded" | "not_found";

export type TaxpayerRecord = {
    taxId: string;
    found: boolean;
    status: TaxpayerStatus;
    name: string;
    address: string;
    representative: string;
    startDate: string; // yyyy-mm-dd
    companyType: string;
    industry: string;
    taxOffice: string;
    phone: string;

    warned: boolean;
    newId?: string; // TT86/2024: personal MST → 12-digit ID number

    source: "sim" | "gdt";
    checkedAt?: string;
};

export const MST_RE = /^\d{10}(-\d{3})?$/;

/** FNV-1a 32-bit — stable across reloads / browsers. */
function hash(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
/** Exposed for the check simulations (lib/api/weinvoice/checks.ts) so they stay deterministic. */
export const stableHash = hash;

const SURN = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Ngô"];
const MID = ["Văn", "Thị", "Minh", "Thanh", "Hữu", "Ngọc", "Quốc", "Thu"];
const GIV = ["An", "Bình", "Châu", "Dũng", "Hà", "Hùng", "Lan", "Long", "Mai", "Nam", "Phúc", "Quân", "Sơn", "Trang", "Tuấn", "Vy"];
const IND = ["Bán buôn thực phẩm", "Bán lẻ hàng hoá tổng hợp", "Dịch vụ vận tải hàng hoá", "Sản xuất bao bì", "Bán buôn văn phòng phẩm", "Dịch vụ ăn uống", "Xây dựng công trình dân dụng", "Hoạt động dịch vụ CNTT"];
const TYPES = ["Công ty TNHH một thành viên", "Công ty TNHH hai thành viên trở lên", "Công ty cổ phần ngoài quốc doanh"];
const TRADE = ["THƯƠNG MẠI", "DỊCH VỤ", "ĐẦU TƯ", "SẢN XUẤT", "XUẤT NHẬP KHẨU", "CÔNG NGHỆ"];
const BRAND = ["HOÀNG LONG", "PHÚ THỊNH", "AN KHANG", "MINH PHÁT", "THÀNH CÔNG", "ĐẠI VIỆT", "TÂN TIẾN", "HẢI ĐĂNG", "KIM NGÂN", "SAO MAI"];
const STREET = ["Lê Lợi", "Trần Phú", "Nguyễn Trãi", "Hai Bà Trưng", "Lý Thường Kiệt", "Phan Chu Trinh", "Võ Thị Sáu", "Điện Biên Phủ"];
const PERSONAL_TYPE = "Hộ kinh doanh / cá nhân";

/** Province by tax-ID prefix (first 2 digits = issuing province, simplified). */
function province(taxId: string): { city: string; office: string; phone: string } {
    const p = taxId.slice(0, 2);
    if (p === "01") return { city: "Hà Nội", office: "Thuế TP Hà Nội", phone: "024" };
    if (p === "03") return { city: "TP. Hồ Chí Minh", office: "Thuế TP Hồ Chí Minh", phone: "028" };
    if (p === "04") return { city: "Đà Nẵng", office: "Thuế TP Đà Nẵng", phone: "0236" };
    return { city: "Bình Dương", office: "Thuế tỉnh Bình Dương", phone: "0274" };
}

/** Name / address as printed on the invoices in the store (most frequent name wins). */
function fromInvoices(taxId: string): { name: string; address: string } | null {
    const own = MY_COMPANIES.find((c) => c.taxId === taxId);
    if (own) return { name: own.name, address: own.address };
    const seen = new Map<string, { n: number; address: string }>();
    for (const i of getState().invoices) {
        const party = i.sellerTaxId === taxId ? { name: i.sellerName, address: i.sellerAddress } : i.buyerTaxId === taxId ? { name: i.buyerName, address: i.buyerAddress } : null;
        if (!party) continue;
        const cur = seen.get(party.name);
        seen.set(party.name, { n: (cur?.n ?? 0) + 1, address: party.address });
    }
    let best: { name: string; address: string; n: number } | null = null;
    for (const [name, v] of seen) if (!best || v.n > best.n) best = { name, address: v.address, n: v.n };
    return best && { name: best.name, address: best.address };
}

/** Older / newer address variants used to simulate "address differs from GDT". */
const ADDR_OLD = [
    (a: string) => a.replace(/Phường [^,]+/, "Phường 12").replace(/(TP\.?|Thành phố) Hồ Chí Minh/, "Quận 7, TP Hồ Chí Minh"),
    (a: string) => a.replace(/, [^,]+$/, ", Tỉnh Lâm Đồng"),
    (a: string) => a.split(",").slice(0, 2).join(",") + ", Huyện Đức Linh, Bình Thuận",
];

/**
 * Seed partners with a deliberate registry finding (fictional tax IDs from mockData.ts).
 * status = registry status; addr = registry address (post-merger / moved);
 * addrOld = index into ADDR_OLD; cp = TNHH → CP rename; warned = GDT risk warning.
 */
const DEMO: Record<string, { status?: TaxpayerStatus; addr?: string; addrOld?: number; cp?: boolean; warned?: boolean }> = {
    // suppliers (purchase)
    "0102333444": { status: "suspended" }, // Vận tải Bắc Nam — tạm ngừng kinh doanh
    "0316565656": { status: "absconded", warned: true }, // Nông Trại Xanh — không hoạt động tại địa chỉ đăng ký
    "0310555666": { addr: "Lô C4 KCN Tân Tạo, Phường Tân Tạo, TP. Hồ Chí Minh" }, // registry has the post-merger address
    "0313909090": { cp: true }, // Xăng dầu Thành Phát — TNHH → CP on the registry
    "0312121212": { warned: true }, // Hương Sen — GDT risk warning, still active
    "0108343434": { addrOld: 2 }, // Đông Á — moved
    // customers (sales)
    "0402363636": { status: "closed" }, // Du lịch Sông Hàn — chấm dứt hiệu lực MST
    "0315858585": { addrOld: 0 },
    "0106474747": { status: "not_found" },
};

export const GDT_LOOKUP_URL = "https://tracuunnt.gdt.gov.vn/tcnnt/mstdn.jsp";

const pad = (n: number, w: number) => String(n).padStart(w, "0");
const at = <T,>(xs: T[], h: number, salt: number) => xs[(h >>> salt) % xs.length];

function emptyRecord(taxId: string): TaxpayerRecord {
    return { taxId, found: false, status: "not_found", name: "", address: "", representative: "", startDate: "", companyType: "", industry: "", taxOffice: "", phone: "", warned: false, source: "sim" };
}

/** Simulated registry lookup — synchronous, deterministic. */
export function lookupTaxpayer(taxIdRaw: string): TaxpayerRecord {
    const taxId = taxIdRaw.trim();
    if (!MST_RE.test(taxId)) return emptyRecord(taxId);

    const verified = getState().gdtVerified?.[taxId];
    if (verified) {
        const found = verified.status !== "not_found";
        return {
            ...emptyRecord(taxId),
            found,
            status: verified.status,
            name: found ? verified.name : "",
            address: found ? verified.address : "",
            representative: verified.representative ?? "",
            taxOffice: verified.taxOffice ?? "",
            source: "gdt",
            checkedAt: verified.checkedAt,
        };
    }

    const base = taxId.slice(0, 10);
    const branch = taxId.length > 10;
    const h = hash(taxId);
    const demo = DEMO[taxId] ?? {};
    const known = fromInvoices(taxId);
    const prov = province(base);
    const personal = base.charAt(0) === "8";

    let status: TaxpayerStatus;
    if (demo.status) status = demo.status;
    else if (known) status = "active";
    else {
        const r = h % 100;
        status = r < 68 ? "active" : r < 78 ? "suspended" : r < 84 ? "closed" : r < 89 ? "absconded" : "not_found";
    }
    if (status === "not_found") return emptyRecord(taxId);

    const representative = `${at(SURN, h, 3)} ${at(MID, h, 7)} ${at(GIV, h, 11)}`;
    let name: string;
    let address: string;
    if (known) {
        name = known.name;
        address = known.address;
    } else if (personal) {
        name = representative.toUpperCase();
        address = `Số ${(h % 180) + 1} ${at(STREET, h, 5)}, ${prov.city}`;
    } else {
        name = `CÔNG TY TNHH ${at(TRADE, h, 2)} ${at(BRAND, h, 9)}`;
        address = `Số ${(h % 180) + 1} ${at(STREET, h, 5)}, Phường ${(h % 15) + 1}, ${prov.city}`;
    }
    if (branch && !known) name = `CHI NHÁNH ${name}`;
    if (demo.addr) address = demo.addr;
    if (demo.addrOld !== undefined) address = ADDR_OLD[demo.addrOld](address);
    let companyType = personal ? PERSONAL_TYPE : at(TYPES, h, 13);
    if (demo.cp) {
        name = name.replace("CÔNG TY TNHH", "CÔNG TY CỔ PHẦN");
        companyType = TYPES[2];
    } else if (/CỔ PHẦN/.test(name)) companyType = TYPES[2];

    const year = 2008 + (h % 17);
    return {
        taxId,
        found: true,
        status,
        name,
        address,
        representative,
        startDate: `${year}-${pad(((h >>> 4) % 12) + 1, 2)}-${pad(((h >>> 8) % 28) + 1, 2)}`,
        companyType,
        industry: at(IND, h, 17),
        taxOffice: prov.office,
        phone: `${prov.phone} ${pad((h >>> 6) % 10_000, 4)} ${pad((h >>> 14) % 10_000, 4)}`,
        warned: demo.warned ?? (!known && h % 17 === 0),
        // TT86/2024: from 01/07/2025 a personal MST is replaced by the 12-digit personal ID number.
        newId: personal ? `0${pad((h >>> 1) % 100, 2)}${pad(h % 1_000_000_000, 9)}` : undefined,
        source: "sim",
    };
}

/** Lower-case, strip Vietnamese diacritics / punctuation and expand common abbreviations. */
const norm = (s: string): string =>
    s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[đĐ]/g, "d")
        .toLowerCase()
        .replace(/[.,;:()\-–/]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => ({ cp: "co phan", tp: "thanh pho", q: "quan", p: "phuong", tx: "thi xa", kcn: "khu cong nghiep" })[w] ?? w)
        .join(" ");

/** Dice coefficient over character bigrams of the normalised strings (0..1). */
export function similarity(a: string, b: string): number {
    const x = norm(a);
    const y = norm(b);
    if (!x && !y) return 1;
    if (!x || !y) return 0;
    if (x === y) return 1;
    const grams = (s: string) => {
        const m = new Map<string, number>();
        for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
        return m;
    };
    const gx = grams(x);
    const gy = grams(y);
    let inter = 0;
    gx.forEach((n, g) => (inter += Math.min(n, gy.get(g) ?? 0)));
    return (2 * inter) / (x.length - 1 + (y.length - 1));
}

export type MatchLevel = "match" | "minor" | "major";
/** ≥ 95 % = match, ≥ 75 % = minor difference, otherwise major (same thresholds as the Supplier-risk drawer). */
export const matchLevel = (p: number): MatchLevel => (p >= 0.95 ? "match" : p >= 0.75 ? "minor" : "major");

/** Record (or clear with `null`) a result the user looked up by hand on tracuunnt.gdt.gov.vn. */
export function saveGdtVerified(taxId: string, v: Omit<GdtVerified, "checkedAt"> | null): void {
    setState((s) => {
        const map = { ...(s.gdtVerified ?? {}) };
        if (v) map[taxId] = { ...v, checkedAt: new Date().toISOString() };
        else delete map[taxId];
        s.gdtVerified = map;
    });
}

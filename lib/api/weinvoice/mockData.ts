/*
 * MOCK DATA — WeInvoice static UI (feature record:
 * docs/features/weinvoice/weinvoice-p1-ui-transformation-2026-11-03.md).
 *
 * The UI Spec v1.0 handover ships this file as an empty stub ("Dev decides the
 * data model"). The team chose "static UI + mockData" for P1, so this module
 * generates a deterministic demo dataset that exercises every screen state:
 * purchase / sales, missing XML / PDF, no-code (K…) and cash-register (…M…)
 * invoices, replacement ↔ replaced pairs, cancelled invoices, an incomplete
 * sync period, a "needs password" MST, sync history, email intake and
 * sub-accounts. All names / tax IDs are FICTIONAL — never put real customer
 * data here (00_DOC_TRUOC.md › Lưu ý bảo mật).
 *
 * Types below are the shape the UI renders — the backend contract may differ.
 */
import type { EmailMessage, GdtConnection, Invoice, InvoiceFile, InvoiceItem, InvoiceStatus, SyncRun, Tag } from "@/lib/weinvoice/types";
import { PROVIDERS } from "@/lib/weinvoice/providers";

export type Company = { taxId: string; name: string; address: string; username: string; label: string };
export type Partner = { taxId: string; name: string; address: string; cat: string; provider: string; symbol: string };

export const MY_COMPANIES: Company[] = [
    { taxId: "0109876543", name: "CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ AN PHÁT", address: "Số 12 Phố Huế, Phường Hàng Bài, Quận Hoàn Kiếm, Hà Nội", username: "0109876543", label: "Trụ sở" },
    { taxId: "0318765432", name: "CÔNG TY CỔ PHẦN SẢN XUẤT MINH TÂM", address: "45 Nguyễn Văn Linh, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh", username: "0318765432", label: "Nhà máy" },
    { taxId: "0401234567", name: "CÔNG TY TNHH DỊCH VỤ BIỂN XANH", address: "88 Bạch Đằng, Phường Hải Châu 1, Quận Hải Châu, Đà Nẵng", username: "0401234567", label: "Chi nhánh" },
];

/** Provider tax IDs from the catalogue (<MSTTCGP>). */
const MISA = "0101243150";
const VNPT = "0100684378";
const VIETTEL = "0100109106";
const BKAV = "0101360697";
const FPT = "0104128565";
const EASY = "0105987432";
const MINV = "0106026495";

export const SUPPLIERS: Partner[] = [
    { taxId: "0106111222", name: "CÔNG TY CỔ PHẦN VĂN PHÒNG PHẨM HỒNG HÀ MỚI", address: "25 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội", cat: "office", provider: MISA, symbol: "C26THH" },
    { taxId: "0102333444", name: "CÔNG TY TNHH VẬN TẢI NHANH BẮC NAM", address: "Km 9 Quốc lộ 1A, Hoàng Mai, Hà Nội", cat: "transport", provider: VIETTEL, symbol: "C26TVT" },
    { taxId: "0310555666", name: "CÔNG TY CỔ PHẦN BAO BÌ PHƯƠNG NAM", address: "Lô C4 KCN Tân Tạo, Bình Tân, TP. Hồ Chí Minh", cat: "packaging", provider: VNPT, symbol: "C26TPN" },
    { taxId: "0105777888", name: "CÔNG TY TNHH GIẢI PHÁP PHẦN MỀM SAO KHUÊ", address: "Tầng 8, 72 Trần Duy Hưng, Cầu Giấy, Hà Nội", cat: "it", provider: FPT, symbol: "C26TSK" },
    { taxId: "0107999000", name: "CÔNG TY TNHH ĐIỆN LỰC TIÊU DÙNG THĂNG LONG", address: "15 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội", cat: "utility", provider: VNPT, symbol: "C26TEL" },
    { taxId: "0312121212", name: "CÔNG TY TNHH NHÀ HÀNG HƯƠNG SEN", address: "102 Lê Lợi, Quận 1, TP. Hồ Chí Minh", cat: "food", provider: MINV, symbol: "C26MHS" },
    { taxId: "0108343434", name: "CÔNG TY CỔ PHẦN THIẾT BỊ CÔNG NGHIỆP ĐÔNG Á", address: "Lô 5 KCN Quang Minh, Mê Linh, Hà Nội", cat: "equipment", provider: BKAV, symbol: "C26TDA" },
    { taxId: "0316565656", name: "CÔNG TY TNHH THỰC PHẨM SẠCH NÔNG TRẠI XANH", address: "33 Võ Văn Kiệt, Quận 5, TP. Hồ Chí Minh", cat: "food", provider: EASY, symbol: "K26TNX" },
    { taxId: "0109787878", name: "CÔNG TY CỔ PHẦN VIỄN THÔNG KẾT NỐI VIỆT", address: "60 Nguyễn Chí Thanh, Đống Đa, Hà Nội", cat: "telecom", provider: VIETTEL, symbol: "C26TKV" },
    { taxId: "0313909090", name: "CÔNG TY TNHH XĂNG DẦU THÀNH PHÁT", address: "Quốc lộ 13, Thủ Đức, TP. Hồ Chí Minh", cat: "fuel", provider: MISA, symbol: "C26MTP" },
];

export const CUSTOMERS: Partner[] = [
    { taxId: "0104141414", name: "CÔNG TY CỔ PHẦN BÁN LẺ TOÀN CẦU", address: "200 Bà Triệu, Hai Bà Trưng, Hà Nội", cat: "retail", provider: MISA, symbol: "C26TAP" },
    { taxId: "0311252525", name: "CÔNG TY TNHH PHÂN PHỐI HOÀNG KIM", address: "18 Cộng Hoà, Tân Bình, TP. Hồ Chí Minh", cat: "distribution", provider: MISA, symbol: "C26TAP" },
    { taxId: "0402363636", name: "CÔNG TY TNHH DU LỊCH SÔNG HÀN", address: "9 Trần Phú, Hải Châu, Đà Nẵng", cat: "travel", provider: MISA, symbol: "C26TAP" },
    { taxId: "0106474747", name: "CÔNG TY CỔ PHẦN XÂY DỰNG NAM VIỆT", address: "75 Láng Hạ, Đống Đa, Hà Nội", cat: "construction", provider: MISA, symbol: "C26TAP" },
    { taxId: "0315858585", name: "CÔNG TY TNHH KỸ THUẬT ÁNH DƯƠNG", address: "41 Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh", cat: "engineering", provider: MISA, symbol: "C26TAP" },
];

export const DEFAULT_TAGS: Tag[] = [
    { id: "tag-paid", name: "Đã thanh toán", color: "#04662e" },
    { id: "tag-review", name: "Cần kiểm tra", color: "#c50712" },
    { id: "tag-project", name: "Dự án A", color: "#0060b9" },
    { id: "tag-asset", name: "Tài sản", color: "#8a5a00" },
];

/** Item catalogue per partner category — name, unit, unit price, VAT rate (-1 = KCT). */
const ITEMS: Record<string, [string, string, number, number][]> = {
    office: [["Giấy in A4 Double A 80gsm", "Ram", 72_000, 10], ["Bút bi Thiên Long TL-027", "Hộp", 55_000, 10], ["Sổ tay bìa da A5", "Quyển", 48_000, 10]],
    transport: [["Cước vận chuyển hàng hoá Hà Nội - TP.HCM", "Chuyến", 8_500_000, 8], ["Phí bốc xếp", "Lần", 600_000, 8]],
    packaging: [["Thùng carton 5 lớp 60x40x40", "Cái", 18_500, 10], ["Băng keo trong 5cm", "Cuộn", 14_000, 10], ["Màng PE quấn pallet", "Cuộn", 165_000, 10]],
    it: [["Phí bản quyền phần mềm kế toán 12 tháng", "Gói", 12_000_000, 10], ["Dịch vụ hỗ trợ kỹ thuật", "Tháng", 2_500_000, 10]],
    utility: [["Tiền điện sinh hoạt bậc 4", "kWh", 2_998, 8], ["Phí công tơ", "Tháng", 30_000, 8]],
    food: [["Suất ăn trưa văn phòng", "Suất", 45_000, 8], ["Nước uống đóng chai 500ml", "Thùng", 96_000, 8]],
    equipment: [["Máy khoan bê tông Bosch GBH 2-26", "Cái", 4_350_000, 10], ["Bộ mũi khoan đa năng", "Bộ", 690_000, 10]],
    telecom: [["Cước Internet cáp quang doanh nghiệp", "Tháng", 1_650_000, 10], ["Cước di động trả sau", "Thuê bao", 350_000, 10]],
    fuel: [["Xăng RON 95-V", "Lít", 23_450, 10], ["Dầu DO 0,05S", "Lít", 20_870, 10]],
    retail: [["Dịch vụ tư vấn triển khai hệ thống", "Gói", 35_000_000, 10], ["Phí bảo trì định kỳ", "Tháng", 4_000_000, 10]],
    distribution: [["Hàng hoá phân phối theo hợp đồng", "Lô", 62_000_000, 10]],
    travel: [["Dịch vụ tổ chức sự kiện", "Gói", 48_000_000, 8]],
    construction: [["Dịch vụ thiết kế kỹ thuật", "Gói", 120_000_000, 10]],
    engineering: [["Dịch vụ lắp đặt thiết bị", "Lần", 18_000_000, 10], ["Sách chuyên ngành kỹ thuật", "Quyển", 250_000, -1]],
};

/* ---------- deterministic PRNG (same dataset on every load) ---------- */

let seed = 20261103;
function rnd(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
}
const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const pad = (n: number, w: number) => String(n).padStart(w, "0");

const numberSeq = new Map<string, number>();
function nextNumber(sellerTaxId: string, symbol: string): string {
    const k = `${sellerTaxId}|${symbol}`;
    const n = (numberSeq.get(k) ?? int(10, 400)) + int(1, 9);
    numberSeq.set(k, n);
    return pad(n, 8);
}

function lookupUrlFor(providerTaxId: string): string {
    return PROVIDERS.find((p) => p.taxId === providerTaxId)?.lookupUrl ?? "";
}

function providerName(providerTaxId: string): string {
    return PROVIDERS.find((p) => p.taxId === providerTaxId)?.name ?? "";
}

function itemsFor(cat: string): InvoiceItem[] {
    const catalogue = ITEMS[cat] ?? ITEMS.office;
    const lines = int(1, Math.min(3, catalogue.length));
    const chosen = [...catalogue].sort(() => rnd() - 0.5).slice(0, lines);
    return chosen.map(([name, unit, price, vatRate]) => {
        const qty = price > 5_000_000 ? int(1, 2) : price > 500_000 ? int(1, 6) : int(5, 120);
        return { name, unit, qty, price, amount: qty * price, vatRate };
    });
}

let idSeq = 0;
/** Build one invoice between `company` and partner `p` (`direction` from the company's point of view). */
export function makeInvoice(company: Company, p: Partner, direction: "purchase" | "sales", date: string): Invoice {
    const seller = direction === "purchase" ? { taxId: p.taxId, name: p.name, address: p.address } : { taxId: company.taxId, name: company.name, address: company.address };
    const buyer = direction === "purchase" ? { taxId: company.taxId, name: company.name, address: company.address } : { taxId: p.taxId, name: p.name, address: p.address };
    const items = itemsFor(p.cat);
    const preTax = items.reduce((s, i) => s + i.amount, 0);
    const tax = Math.round(items.reduce((s, i) => s + (i.vatRate > 0 ? (i.amount * i.vatRate) / 100 : 0), 0));
    const symbol = p.symbol;
    const number = nextNumber(seller.taxId, symbol);
    const noCode = symbol.charAt(0) === "K";
    const lookupCode = `${providerName(p.provider).slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X")}${pad(int(0, 99_999_999), 8)}`;
    const id = `inv-${++idSeq}`;
    const syncedAt = `${date}T${pad(int(7, 20), 2)}:${pad(int(0, 59), 2)}:00`;
    const files: InvoiceFile[] = [];
    if (!noCode) files.push({ id: `${id}-xml`, kind: "xml", name: `${seller.taxId}_1${symbol}_${number}.xml`, size: int(6_000, 14_000), origin: "gdt", addedAt: syncedAt });
    return {
        id,
        direction,
        issueDate: date,
        templateNo: "1",
        symbol,
        number,
        sellerTaxId: seller.taxId,
        sellerName: seller.name,
        sellerAddress: seller.address,
        buyerTaxId: buyer.taxId,
        buyerName: buyer.name,
        buyerAddress: buyer.address,
        currency: "VND",
        preTax,
        tax,
        total: preTax + tax,
        status: "original",
        cqtCode: noCode ? "" : `00${pad(int(0, 9_999_999), 7)}${pad(int(0, 9_999_999), 7)}${pad(int(0, 99_999), 5)}${pad(int(0, 9_999), 4)}`.slice(0, 34).toUpperCase(),
        provider: providerName(p.provider),
        providerTaxId: p.provider,
        lookupCode: p.provider === BKAV ? "" : lookupCode,
        lookupUrl: lookupUrlFor(p.provider),
        paymentMethod: pick(["TM/CK", "CK", "TM"]),
        items,
        files,
        tags: [],
        source: noCode ? pick(["email", "upload"] as const) : "gdt",
        syncedAt,
    };
}

/* ---------- other entity shapes the UI renders ---------- */

export type Mailbox = {
    id: string;
    taxId: string;
    provider: "gmail" | "outlook";
    address: string;
    method: "imap_app_password" | "oauth_graph";
    connectedAt: string;
    lastScanAt?: string;
};

export type SubAccount = {
    id: string;
    name: string;
    email: string;
    taxIds: string[]; // MST the sub-account may work on
    perms: string[]; // see lib/api/weinvoice/subaccounts.ts PERMS
    status: "invited" | "active" | "locked";
    createdAt: string;
};

/** Tax e-service portal (dichvucong.gdt.gov.vn) connection per MST — mock: no password stored. */
export type GdtVerified = { name: string; address: string; status: "active" | "suspended" | "closed" | "absconded" | "not_found"; representative?: string; taxOffice?: string; checkedAt: string };
export type PortalConnection = { taxId: string; account: string; kind: "org" | "person"; connectedAt: string };

export type DemoState = {
    version: number;
    invoices: Invoice[];
    connections: GdtConnection[];
    tags: Tag[];
    history: SyncRun[];
    emails: EmailMessage[];
    mailboxes?: Mailbox[];
    subaccounts?: SubAccount[];
    portals?: PortalConnection[];
    gdtVerified?: Record<string, GdtVerified>;
    journalRules?: import("@/lib/api/weinvoice/journal").JournalRule[];
    activeTaxId: string;
    /** Periods (yyyy-mm) whose sync stopped mid-way — drives the "incomplete" banner. */
    incomplete: { taxId: string; month: string; fetched: number; total: number }[];
    savedAt?: number;
};

export const STATE_VERSION = 5;

/** Demo months: Jan → Oct 2026 (the spec demo is dated 30/10/2026). */
const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];

function generateInvoices(): Invoice[] {
    seed = 20261103;
    idSeq = 0;
    numberSeq.clear();
    const out: Invoice[] = [];
    MY_COMPANIES.slice(0, 2).forEach((company, ci) => {
        for (const month of MONTHS) {
            const purchases = ci === 0 ? int(14, 22) : int(6, 10);
            const sales = ci === 0 ? int(5, 9) : int(3, 5);
            for (let i = 0; i < purchases; i++) out.push(makeInvoice(company, pick(SUPPLIERS), "purchase", `${month}-${pad(int(1, 28), 2)}`));
            for (let i = 0; i < sales; i++) {
                const c = pick(CUSTOMERS);
                out.push(makeInvoice(company, { ...c, symbol: ci === 0 ? "C26TAP" : "C26TMT" }, "sales", `${month}-${pad(int(1, 28), 2)}`));
            }
        }
    });

    // File coverage: most GDT invoices also have the vendor PDF; some lack it.
    for (const inv of out) {
        if (inv.cqtCode && rnd() < 0.62) {
            inv.files.push({ id: `${inv.id}-pdf`, kind: "pdf", name: `${inv.sellerTaxId}_1${inv.symbol}_${inv.number}.pdf`, size: int(60_000, 240_000), origin: "vendor", addedAt: inv.syncedAt });
        }
        // A handful of GDT invoices whose XML was not fetched yet (drives "Lấy XML còn thiếu").
        if (inv.cqtCode && rnd() < 0.05) inv.files = inv.files.filter((f) => f.kind !== "xml");
        if (!inv.cqtCode) {
            inv.files.push({ id: `${inv.id}-xml`, kind: "xml", name: `${inv.sellerTaxId}_1${inv.symbol}_${inv.number}.xml`, size: int(6_000, 12_000), origin: inv.source === "email" ? "email" : "upload", addedAt: inv.syncedAt });
        }
        if (rnd() < 0.18) inv.tags.push(pick(DEFAULT_TAGS).id);
    }

    // Lifecycle variety: cancelled, replacement ↔ replaced, adjustment ↔ adjusted.
    const purchase = out.filter((i) => i.direction === "purchase" && i.cqtCode);
    const setStatus = (inv: Invoice | undefined, s: InvoiceStatus) => inv && (inv.status = s);
    setStatus(purchase[7], "cancelled");
    setStatus(purchase[41], "cancelled");
    for (const [a, b, kind] of [[12, 13, "replace"], [60, 61, "adjust"], [95, 96, "replace"]] as const) {
        const old = purchase[a];
        const neu = purchase[b];
        if (!old || !neu) continue;
        neu.sellerTaxId = old.sellerTaxId;
        neu.sellerName = old.sellerName;
        neu.sellerAddress = old.sellerAddress;
        neu.symbol = old.symbol;
        neu.provider = old.provider;
        neu.providerTaxId = old.providerTaxId;
        old.status = kind === "replace" ? "replaced" : "adjusted";
        neu.status = kind === "replace" ? "replacement" : "adjustment";
        old.relatedId = neu.id;
        neu.relatedId = old.id;
    }
    return out.sort((a, b) => b.issueDate.localeCompare(a.issueDate));
}

/** Seeded demo state — every screen has data to show. */
export function buildSeed(): DemoState {
    const invoices = generateInvoices();
    const connections: GdtConnection[] = [
        { taxId: MY_COMPANIES[0].taxId, companyName: MY_COMPANIES[0].name, username: MY_COMPANIES[0].username, label: MY_COMPANIES[0].label, status: "connected", lastSyncAt: "2026-10-30T08:15:00", createdAt: "2026-01-05T09:00:00" },
        { taxId: MY_COMPANIES[1].taxId, companyName: MY_COMPANIES[1].name, username: MY_COMPANIES[1].username, label: MY_COMPANIES[1].label, status: "connected", lastSyncAt: "2026-10-29T17:40:00", createdAt: "2026-02-11T10:30:00" },
        { taxId: MY_COMPANIES[2].taxId, companyName: MY_COMPANIES[2].name, username: MY_COMPANIES[2].username, label: MY_COMPANIES[2].label, status: "expired", lastSyncAt: "2026-08-02T11:05:00", createdAt: "2026-03-20T14:00:00" },
    ];
    const history: SyncRun[] = [
        { id: "run-6", taxId: MY_COMPANIES[0].taxId, companyName: MY_COMPANIES[0].name, direction: "both", fromMonth: "2026-10", toMonth: "2026-10", startedAt: "2026-10-30T08:14:02", durationSec: 74, newCount: 18, updatedCount: 2, xmlCount: 18, status: "partial", message: "gdt_batch_limit", trigger: "schedule" },
        { id: "run-5", taxId: MY_COMPANIES[1].taxId, companyName: MY_COMPANIES[1].name, direction: "both", fromMonth: "2026-09", toMonth: "2026-10", startedAt: "2026-10-29T17:38:40", durationSec: 52, newCount: 12, updatedCount: 0, xmlCount: 12, status: "success", trigger: "manual" },
        { id: "run-4", taxId: MY_COMPANIES[0].taxId, companyName: MY_COMPANIES[0].name, direction: "both", fromMonth: "2026-09", toMonth: "2026-09", startedAt: "2026-10-01T07:00:11", durationSec: 96, newCount: 27, updatedCount: 1, xmlCount: 26, status: "success", trigger: "schedule" },
        { id: "run-3", taxId: MY_COMPANIES[2].taxId, companyName: MY_COMPANIES[2].name, direction: "both", fromMonth: "2026-08", toMonth: "2026-08", startedAt: "2026-08-02T11:04:20", durationSec: 9, newCount: 0, updatedCount: 0, xmlCount: 0, status: "failed", message: "gdt_login_failed", trigger: "bulk" },
        { id: "run-2", taxId: MY_COMPANIES[1].taxId, companyName: MY_COMPANIES[1].name, direction: "purchase", fromMonth: "2026-01", toMonth: "2026-08", startedAt: "2026-09-02T09:20:00", durationSec: 310, newCount: 64, updatedCount: 0, xmlCount: 64, status: "success", trigger: "bulk" },
        { id: "run-1", taxId: MY_COMPANIES[0].taxId, companyName: MY_COMPANIES[0].name, direction: "both", fromMonth: "2026-01", toMonth: "2026-08", startedAt: "2026-09-01T10:02:00", durationSec: 640, newCount: 211, updatedCount: 0, xmlCount: 205, status: "success", trigger: "manual" },
    ];
    const noCode = invoices.filter((i) => !i.cqtCode);
    const emails: EmailMessage[] = [
        { id: "mail-1", receivedAt: "2026-10-28T09:12:00", from: "hoadon@nongtraixanh.example", subject: "Hoá đơn điện tử số 00000412 - Nông Trại Xanh", attachments: ["0316565656_1K26TNX_00000412.xml", "0316565656_1K26TNX_00000412.pdf"], result: "new", invoiceRef: noCode[0]?.id },
        { id: "mail-2", receivedAt: "2026-10-27T15:40:00", from: "einvoice@misa.example", subject: "Thông báo phát hành hoá đơn điện tử", attachments: ["invoice.xml", "invoice.pdf"], result: "matched", invoiceRef: invoices.find((i) => i.provider === "MISA" && i.direction === "purchase")?.id },
        { id: "mail-3", receivedAt: "2026-10-25T08:05:00", from: "noreply@vanchuyen.example", subject: "[Nhắc lại] Hoá đơn tháng 10", attachments: ["HD_00000123.xml"], result: "duplicate" },
        { id: "mail-4", receivedAt: "2026-10-22T11:30:00", from: "marketing@shop.example", subject: "Ưu đãi cuối tháng", attachments: [], result: "no_invoice" },
    ];
    return {
        version: STATE_VERSION,
        invoices,
        connections,
        tags: DEFAULT_TAGS.map((t) => ({ ...t })),
        history,
        emails,
        mailboxes: [
            { id: "mbx-1", taxId: MY_COMPANIES[0].taxId, provider: "gmail", address: "hoadon.anphat@gmail.example", method: "imap_app_password", connectedAt: "2026-06-10T10:00:00", lastScanAt: "2026-10-30T07:30:00" },
        ],
        subaccounts: [
            { id: "sub-1", name: "Nguyễn Thu Trang", email: "trang.ketoan@anphat.example", taxIds: [MY_COMPANIES[0].taxId], perms: ["view", "download", "upload", "tag", "report"], status: "active", createdAt: "2026-03-01T09:00:00" },
            { id: "sub-2", name: "Trần Minh Quân", email: "quan.tc@minhtam.example", taxIds: [MY_COMPANIES[1].taxId], perms: ["view", "download"], status: "invited", createdAt: "2026-10-20T14:00:00" },
            { id: "sub-3", name: "Lê Hoàng Nam", email: "nam.le@anphat.example", taxIds: [MY_COMPANIES[0].taxId, MY_COMPANIES[1].taxId], perms: ["view"], status: "locked", createdAt: "2026-02-15T08:30:00" },
        ],
        portals: [{ taxId: MY_COMPANIES[0].taxId, account: `${MY_COMPANIES[0].taxId}-QL`, kind: "org", connectedAt: "2026-07-01T09:00:00" }],
        gdtVerified: {},
        journalRules: [],
        activeTaxId: MY_COMPANIES[0].taxId,
        incomplete: [{ taxId: MY_COMPANIES[0].taxId, month: "2026-10", fetched: 18, total: 26 }],
    };
}

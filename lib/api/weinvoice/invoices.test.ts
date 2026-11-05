import { beforeEach, describe, expect, it } from "vitest";

import { filterInvoices, getInvoice, importParsed, kpisFor, removeFile } from "@/lib/api/weinvoice/invoices";
import { getState, resetState, setState } from "@/lib/api/weinvoice/store";
import type { ParsedXml } from "@/lib/weinvoice/xml";

const ACTIVE = "0109876543";

function parsedFrom(id: string, patch: Partial<ParsedXml> = {}): ParsedXml {
    const inv = getInvoice(id)!;
    return {
        issueDate: inv.issueDate,
        templateNo: inv.templateNo,
        symbol: inv.symbol,
        number: inv.number,
        sellerTaxId: inv.sellerTaxId,
        sellerName: inv.sellerName,
        sellerAddress: inv.sellerAddress,
        buyerTaxId: inv.buyerTaxId,
        buyerName: inv.buyerName,
        buyerAddress: inv.buyerAddress,
        currency: inv.currency,
        preTax: inv.preTax,
        tax: inv.tax,
        total: inv.total,
        status: "original",
        cqtCode: inv.cqtCode,
        provider: "",
        providerTaxId: inv.providerTaxId,
        lookupCode: "",
        paymentMethod: inv.paymentMethod,
        items: inv.items,
        ...patch,
    };
}

const withXml = () => getState().invoices.find((i) => i.files.some((f) => f.kind === "xml"))!;

beforeEach(() => resetState());

describe("importParsed — de-dup across channels (§3.2)", () => {
    it("reports a duplicate when the record already has XML", async () => {
        const inv = withXml();
        const before = getState().invoices.length;
        const xmlBefore = inv.files.filter((f) => f.kind === "xml").length;
        const r = await importParsed(parsedFrom(inv.id), "<HDon/>", "a.xml", ACTIVE, "upload");
        expect(r.outcome).toBe("duplicate");
        expect(getState().invoices).toHaveLength(before);
        expect(getInvoice(inv.id)!.files.filter((f) => f.kind === "xml")).toHaveLength(xmlBefore);
    });

    it("merges the XML into a record that has none, and keeps the upload origin", async () => {
        const inv = withXml();
        setState((s) => {
            const x = s.invoices.find((i) => i.id === inv.id)!;
            x.files = x.files.filter((f) => f.kind !== "xml");
        });
        const r = await importParsed(parsedFrom(inv.id), "<HDon/>", "b.xml", ACTIVE, "email");
        expect(r.outcome).toBe("merged");
        expect(getInvoice(inv.id)!.files.find((f) => f.kind === "xml")?.origin).toBe("email");
    });

    it("treats the invoice number without leading zeros as the same key", async () => {
        const inv = withXml();
        const r = await importParsed(parsedFrom(inv.id, { number: String(Number(inv.number)) }), "<HDon/>", "c.xml", ACTIVE, "upload");
        expect(r.outcome).toBe("duplicate");
    });

    it("creates a new purchase invoice when the buyer is the working MST", async () => {
        const before = getState().invoices.length;
        const r = await importParsed(parsedFrom(withXml().id, { number: "99999999" }), "<HDon/>", "d.xml", ACTIVE, "upload");
        expect(r.outcome).toBe("new");
        expect(getState().invoices).toHaveLength(before + 1);
        if (r.outcome === "new") expect(r.invoice.direction).toBe("purchase");
    });

    it("returns 'foreign' when neither party is a managed MST", async () => {
        const r = await importParsed(parsedFrom(withXml().id, { number: "88888888", buyerTaxId: "0300000000", sellerTaxId: "0300000001" }), "<HDon/>", "e.xml", ACTIVE, "upload");
        expect(r.outcome).toBe("foreign");
    });
});

describe("filterInvoices / kpisFor", () => {
    it("scopes to the working MST and direction (§3.1)", () => {
        const rows = filterInvoices({ taxId: ACTIVE, direction: "sales", from: "2026-01-01", to: "2026-12-31" });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((r) => r.direction === "sales" && r.sellerTaxId === ACTIVE)).toBe(true);
    });

    it("filters no-code (K) invoices", () => {
        const rows = filterInvoices({ taxId: ACTIVE, direction: "purchase", from: "2026-01-01", to: "2026-12-31", kind: "no_code" });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((r) => r.symbol.startsWith("K"))).toBe(true);
    });

    it("excludes cancelled invoices from amount totals but still counts them", () => {
        const rows = filterInvoices({ taxId: ACTIVE, direction: "purchase", from: "2026-01-01", to: "2026-12-31" });
        const k = kpisFor(ACTIVE, "2026-01-01", "2026-12-31", rows);
        const live = rows.filter((r) => r.status !== "cancelled" && r.status !== "replaced");
        expect(k.count).toBe(rows.length);
        expect(k.total).toBe(live.reduce((s, r) => s + r.total, 0));
    });
});

describe("removeFile (§3.5)", () => {
    it("refuses to delete files that came from GDT / the provider", async () => {
        const inv = getState().invoices.find((i) => i.files.some((f) => f.origin === "gdt"))!;
        const f = inv.files.find((x) => x.origin === "gdt")!;
        await expect(removeFile(inv.id, f.id)).rejects.toThrow("protected_file");
    });
});

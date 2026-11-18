import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/weinvoice/source", () => ({ DATA_SOURCE: "mock" }));

import { needsLookupCode } from "@/lib/api/weinvoice/invoices";
import type { Invoice } from "@/lib/weinvoice/types";

// docs/issues/weinvoice-needs-lookup-code-by-provider-2026-11-18.md — mock rule = backend ProviderLookup.needsCode.

const inv = (providerTaxId: string, extra: Partial<Invoice> = {}) =>
    ({ id: "1", provider: "", providerTaxId, lookupCode: "", files: [], ...extra }) as unknown as Invoice;

describe("needsLookupCode (mock) — by provider", () => {
    it("catalogue provider, no code, no PDF → needs a code", () => {
        expect(needsLookupCode(inv("0104128565"))).toBe(true); // FPT
    });
    it("not once the original PDF is there, nor with a code", () => {
        expect(needsLookupCode(inv("0104128565", { files: [{ id: "p", kind: "pdf" }] as Invoice["files"] }))).toBe(false);
        expect(needsLookupCode(inv("0104128565", { lookupCode: "SEC123" }))).toBe(false);
    });
    it("providers that look up without a code never need one", () => {
        for (const mst of ["0101360697", "0314743623", "0314209362", "0108971656", "0109282176", "0302712571"]) {
            expect(needsLookupCode(inv(mst))).toBe(false);
        }
    });
});

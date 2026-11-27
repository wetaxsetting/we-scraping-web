import { describe, expect, it } from "vitest";
import { PROVIDERS } from "./providers";

// docs/bugs/weinvoice-tax24-lookup-url-fix-2026-11-27.md — the Tax24 row pointed at the product marketing page.
describe("provider catalogue lookup links", () => {
    it("sends Tax24 to its public invoice verify page", () => {
        const tax24 = PROVIDERS.find((p) => p.taxId === "0102454468");
        expect(tax24?.lookupUrl).toBe("https://tax24.com.vn/thuedientu/xac-minh-hoa-don");
        expect(tax24?.captchaUrl).toBe("https://tax24.com.vn/thuedientu/servlet/ImageServlet");
    });

    it("never links a provider's lookup to a product / service marketing page", () => {
        const marketing = PROVIDERS.filter((p) => /san-pham-dich-vu/.test(p.lookupUrl ?? ""));
        expect(marketing.map((p) => p.taxId)).toEqual([]);
    });
});

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => "/invoices/purchase",
}));

import InvoiceListPage from "@/components/invoices/InvoiceListPage";
import { DialogProvider } from "@/components/shared/dialog";
import { resetState } from "@/lib/api/weinvoice/store";
import { LocaleProvider } from "@/lib/i18n";

// docs/issues/weinvoice-provider-pill-tooltip-hide-url-2026-11-18.md — the provider pill tooltip carried a second line
// "Mở hoá đơn gốc: <lookup URL>"; only the provider line stays, the pill still opens the original in a new tab.

describe("InvoiceListPage — provider pill tooltip", () => {
    beforeEach(() => {
        window.localStorage.setItem("wecms_locale", "VI");
        resetState();
    });

    it("shows the provider name and MST only, no 'Mở hoá đơn gốc' / URL line", async () => {
        render(
            <LocaleProvider>
                <DialogProvider>
                    <InvoiceListPage direction="purchase" />
                </DialogProvider>
            </LocaleProvider>,
        );

        const pills = (await screen.findAllByRole("link")).filter((a) => a.getAttribute("target") === "_blank" && a.getAttribute("title"));
        expect(pills.length).toBeGreaterThan(0);
        for (const a of pills) {
            const title = a.getAttribute("title")!;
            expect(title).not.toContain("\n");
            expect(title).not.toMatch(/Mở hoá đơn gốc|Mở cổng tra cứu|https?:\/\//);
        }
        expect(pills.some((a) => /MST \d{10}/.test(a.getAttribute("title")!))).toBe(true);
        expect(pills.every((a) => a.getAttribute("href"))).toBe(true); // still opens the original
    });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn(), source: { DATA_SOURCE: "api" as "api" | "mock" } }));

vi.mock("@/lib/axios", async (io) => {
    const real = await io<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, request: h.request } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);
vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => "/invoices/purchase",
}));

import { RangePanel, rangeLabel } from "@/components/invoices/DateRangePicker";
import InvoiceListPage from "@/components/invoices/InvoiceListPage";
import { currentMonthKey, isFutureMonth, monthsRange, parseDmy, periodRange, rangeKey } from "@/components/invoices/period";
import { DialogProvider } from "@/components/shared/dialog";
import { resetState, setState } from "@/lib/api/weinvoice/store";
import { LocaleProvider } from "@/lib/i18n";

// docs/features/weinvoice/weinvoice-invoice-screen-v1-2-2026-11-27.md — UI Spec v1.2 §3.6 B1 / B2: range picker (year,
// months, quarters, halves, from–to), months after today locked, end ≤ today; the list opens on the current month.

const TODAY = "2026-11-27";
const vi_ = (k: string, p?: Record<string, string | number>) => `${k}${p ? JSON.stringify(p) : ""}`;

describe("period helpers", () => {
    it("default period = the current month", () => {
        expect(currentMonthKey(new Date(2026, 10, 27))).toBe("m2026-11");
        expect(periodRange(currentMonthKey(new Date(2026, 1, 3)))).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    });

    it("range keys round-trip; months after today are future; a range never ends after today", () => {
        expect(periodRange(rangeKey("2026-01-15", "2026-03-02"))).toEqual({ from: "2026-01-15", to: "2026-03-02" });
        expect(isFutureMonth(2026, 11, TODAY)).toBe(false);
        expect(isFutureMonth(2026, 12, TODAY)).toBe(true);
        expect(monthsRange(2026, 10, 12, TODAY)).toEqual({ from: "2026-10-01", to: TODAY }); // Q IV cut at today
        expect(monthsRange(2026, 12, 12, TODAY)).toBeNull();
        expect(monthsRange(2025, 7, 12, TODAY)).toEqual({ from: "2025-07-01", to: "2025-12-31" });
    });

    it("typed dates: dd/mm/yyyy only, real calendar days", () => {
        expect(parseDmy("5/3/2026")).toBe("2026-03-05");
        expect(parseDmy("31/02/2026")).toBeNull();
        expect(parseDmy("2026-03-05")).toBeNull();
    });

    it("trigger label: month, whole year, months span, days", () => {
        expect(rangeLabel("2026-03-01", "2026-03-31", vi_)).toBe('drp.month_y{"m":3,"y":2026}');
        expect(rangeLabel("2025-01-01", "2025-12-31", vi_)).toBe('drp.year_n{"y":2025}');
        expect(rangeLabel("2026-01-01", "2026-03-31", vi_)).toBe('drp.month_y{"m":1,"y":2026} → drp.month_y{"m":3,"y":2026}');
        expect(rangeLabel("2026-01-15", "2026-02-02", vi_)).toBe("15/01/2026 → 02/02/2026");
    });
});

const inVi = (ui: React.ReactNode) => render(<LocaleProvider>{ui}</LocaleProvider>);

describe("RangePanel", () => {
    beforeEach(() => window.localStorage.setItem("wecms_locale", "VI"));

    it("locks months / quarters / halves after today and applies a quarter cut at today", () => {
        const onApply = vi.fn();
        inVi(<RangePanel from="2026-11-01" to="2026-11-30" today={TODAY} onCancel={vi.fn()} onApply={onApply} />);
        expect(screen.getByTestId("drp-m12")).toBeDisabled();
        expect(screen.getByTestId("drp-m11")).toBeEnabled();
        expect(screen.getByTestId("drp-q4")).toBeEnabled();
        expect(screen.getByTestId("drp-h2")).toBeEnabled();
        expect(screen.getByText("Tháng 12")).toBeInTheDocument();
        expect(document.querySelector('[data-day="2026-11-28"]')).toBeDisabled();

        fireEvent.click(screen.getByTestId("drp-q4"));
        expect(screen.getByTestId("drp-from")).toHaveValue("01/10/2026");
        expect(screen.getByTestId("drp-to")).toHaveValue("27/11/2026");
        fireEvent.click(screen.getByTestId("drp-apply"));
        expect(onApply).toHaveBeenCalledWith("2026-10-01", TODAY);
    });

    it("picks a month, the whole year (end = today), or a typed range; Huỷ applies nothing", () => {
        const onApply = vi.fn();
        const onCancel = vi.fn();
        inVi(<RangePanel from="2026-11-01" to="2026-11-30" today={TODAY} onCancel={onCancel} onApply={onApply} />);
        fireEvent.click(screen.getByTestId("drp-m3"));
        fireEvent.click(screen.getByTestId("drp-apply"));
        expect(onApply).toHaveBeenLastCalledWith("2026-03-01", "2026-03-31");

        fireEvent.click(screen.getByTestId("drp-whole-year"));
        fireEvent.click(screen.getByTestId("drp-apply"));
        expect(onApply).toHaveBeenLastCalledWith("2026-01-01", TODAY);

        fireEvent.change(screen.getByTestId("drp-from"), { target: { value: "15/01/2026" } });
        fireEvent.change(screen.getByTestId("drp-to"), { target: { value: "02/02/2026" } });
        fireEvent.click(screen.getByTestId("drp-apply"));
        expect(onApply).toHaveBeenLastCalledWith("2026-01-15", "2026-02-02");

        // an end after today cannot be applied
        fireEvent.change(screen.getByTestId("drp-to"), { target: { value: "30/11/2026" } });
        expect(screen.getByTestId("drp-apply")).toBeDisabled();

        fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
        expect(onCancel).toHaveBeenCalled();
        expect(onApply).toHaveBeenCalledTimes(3);
    });

    it("calendar: first click = start, second = end", () => {
        const onApply = vi.fn();
        inVi(<RangePanel from="2026-11-01" to="2026-11-30" today={TODAY} onCancel={vi.fn()} onApply={onApply} />);
        fireEvent.click(document.querySelector('[data-day="2026-11-03"]')!);
        expect(screen.getByTestId("drp-apply")).toBeDisabled(); // waiting for the end day
        fireEvent.click(document.querySelector('[data-day="2026-11-10"]')!);
        fireEvent.click(screen.getByTestId("drp-apply"));
        expect(onApply).toHaveBeenCalledWith("2026-11-03", "2026-11-10");
    });
});

describe("InvoiceListPage — default period (B2) and range picker (B1)", () => {
    const ok = (data: unknown) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } });
    type Call = { url: string; params?: Record<string, unknown> };
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 10, 27, 9, 0));
        h.request.mockReset();
        h.request.mockImplementation(async (cfg: Call) =>
            cfg.url.endsWith("/invoices/facets")
                ? ok({ providers: [], partners: [] })
                : cfg.url.endsWith("/invoices")
                  ? ok({ rows: [], total_count: 0, page: 0, size: 20, kpis: {}, incomplete_periods: [] })
                  : ok(null),
        );
        window.localStorage.setItem("wecms_locale", "VI");
        resetState();
        setState((s) => {
            s.activeTaxId = "0100000001";
        });
    });
    afterEach(() => vi.useRealTimers());

    it("asks for the current month, shows it on the picker, and asks again for the applied range", async () => {
        render(
            <LocaleProvider>
                <DialogProvider>
                    <InvoiceListPage direction="purchase" />
                </DialogProvider>
            </LocaleProvider>,
        );
        const lists = () => h.request.mock.calls.map(([c]) => c as Call).filter((c) => c.url === "/api/v1/weinvoice/invoices");
        await waitFor(() => expect(lists().length).toBeGreaterThan(0));
        expect(lists()[0].params).toMatchObject({ from: "2026-11-01", to: "2026-11-30" });
        expect(screen.getByTestId("drp-trigger")).toHaveTextContent("Tháng 11/2026");
        expect(screen.queryByText("01/11/2026 – 30/11/2026")).toBeNull(); // the range text line is gone

        fireEvent.click(screen.getByTestId("drp-trigger"));
        fireEvent.click(screen.getByTestId("drp-q1"));
        fireEvent.click(screen.getByTestId("drp-apply"));
        await waitFor(() => expect(lists().some((c) => c.params?.from === "2026-01-01" && c.params?.to === "2026-03-31")).toBe(true));
        expect(screen.getByTestId("drp-trigger")).toHaveTextContent("Tháng 1/2026 → Tháng 3/2026");
    });
});

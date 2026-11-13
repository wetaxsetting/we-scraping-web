import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addMonths, currentMonth, fitSyncTo, fmtMonth, syncRangeEnd } from "@/components/invoices/period";
import { MonthPicker } from "@/components/shared/MonthPicker";
import { LocaleProvider } from "@/lib/i18n";

// docs/issues/weinvoice-month-picker-2026-11-13.md — the old list stopped at 10/2026 and started at 01/2025.

describe("month helpers", () => {
    it("reads the current month from the clock", () => {
        expect(currentMonth(new Date(2026, 10, 13))).toBe("2026-11");
        expect(currentMonth(new Date(2027, 0, 1))).toBe("2027-01");
    });

    it("shifts across year boundaries", () => {
        expect(addMonths("2026-11", 2)).toBe("2027-01");
        expect(addMonths("2026-01", -1)).toBe("2025-12");
        expect(addMonths("2026-11", -35)).toBe("2023-12");
        expect(fmtMonth("2026-09")).toBe("09/2026");
    });

    it("keeps a sync range inside the backend rules (from ≤ to ≤ now, ≤ 36 months)", () => {
        expect(syncRangeEnd("2026-05", "2026-11")).toBe("2026-11");
        expect(syncRangeEnd("2022-01", "2026-11")).toBe("2024-12");
        expect(fitSyncTo("2026-09", "2026-03", "2026-11")).toBe("2026-09");
        expect(fitSyncTo("2022-01", "2026-11", "2026-11")).toBe("2024-12");
        expect(fitSyncTo("2026-01", "2026-04", "2026-11")).toBe("2026-04");
    });
});

describe("MonthPicker", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 10, 13));
    });
    afterEach(() => vi.useRealTimers());

    const renderPicker = (props: Partial<Parameters<typeof MonthPicker>[0]> = {}) => {
        const onChange = vi.fn();
        render(
            <LocaleProvider>
                <MonthPicker value="2026-10" onChange={onChange} {...props} />
            </LocaleProvider>,
        );
        return onChange;
    };
    const cell = (label: string) => screen.getByRole("button", { name: label });

    it("offers the current month and disables future months", () => {
        const onChange = renderPicker();
        fireEvent.click(screen.getByRole("button", { name: /10\/2026/ }));
        expect(screen.getByText("2026")).toBeTruthy();
        expect((cell("Tháng 12") as HTMLButtonElement).disabled).toBe(true);
        expect((cell("Tháng 11") as HTMLButtonElement).disabled).toBe(false);
        fireEvent.click(cell("Tháng 11"));
        expect(onChange).toHaveBeenCalledWith("2026-11");
    });

    it("navigates back to earlier years, down to the minimum", () => {
        const onChange = renderPicker({ min: "2025-06" });
        fireEvent.click(screen.getByRole("button", { name: /10\/2026/ }));
        expect((screen.getByRole("button", { name: "Năm sau" }) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByRole("button", { name: "Năm trước" }));
        expect(screen.getByText("2025")).toBeTruthy();
        expect((screen.getByRole("button", { name: "Năm trước" }) as HTMLButtonElement).disabled).toBe(true);
        expect((cell("Tháng 5") as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(cell("Tháng 6"));
        expect(onChange).toHaveBeenCalledWith("2025-06");
    });

    it("shortcuts pick this month and last month", () => {
        const onChange = renderPicker();
        fireEvent.click(screen.getByRole("button", { name: /10\/2026/ }));
        fireEvent.click(screen.getByRole("button", { name: "Tháng trước" }));
        expect(onChange).toHaveBeenLastCalledWith("2026-10");
        fireEvent.click(screen.getByRole("button", { name: /10\/2026/ }));
        fireEvent.click(screen.getByRole("button", { name: "Tháng này" }));
        expect(onChange).toHaveBeenLastCalledWith("2026-11");
    });

    it("shows the placeholder when no month is chosen", () => {
        renderPicker({ value: "", placeholder: "Chọn tháng…" });
        expect(screen.getByText("Chọn tháng…")).toBeTruthy();
    });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
    source: { DATA_SOURCE: "api" as "api" | "mock" },
    list: vi.fn(),
    get: vi.fn(),
    save: vi.fn(),
    lock: vi.fn(),
}));

vi.mock("@/lib/api/weinvoice/source", () => h.source);
vi.mock("@/lib/api/weinvoice/vatDeclarations", async (io) => {
    const real = await io<typeof import("@/lib/api/weinvoice/vatDeclarations")>();
    return { ...real, listVatDeclarations: h.list, getVatDeclaration: h.get, saveVatDeclaration: h.save, lockVatDeclaration: h.lock };
});

import VatReturnPage from "@/components/tax/VatReturnPage";
import { DialogProvider } from "@/components/shared/dialog";
import { resetState, setState } from "@/lib/api/weinvoice/store";
import { LocaleProvider } from "@/lib/i18n";

// docs/features/weinvoice/weinvoice-vat-declaration-engine-invoices-2026-11-25.md

const MST = "0319232069";
const detail = (status: "DRAFT" | "LOCKED") => ({
    sid: 7, periodType: "M", periodValue: 10, declYear: 2026, periodLabel: "10/2026", status,
    tpName: "CÔNG TY TNHH VÍ DỤ", tpTaxCode: MST, activityCode: "00", activityName: "x", fromDt: "2026-10-01", toDt: "2026-10-31",
    indicators: { ct21: "0", ct22: "0", ct32: "2200000", ct33: "176000", ct40: "176000", ct43: "0" },
});

function renderPage() {
    return render(
        <LocaleProvider>
            <DialogProvider>
                <VatReturnPage />
            </DialogProvider>
        </LocaleProvider>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    h.source.DATA_SOURCE = "api";
    resetState();
    setState((s) => {
        s.activeTaxId = MST;
    });
    h.list.mockResolvedValue({ rows: [{ sid: 7, periodType: "M", periodValue: 10, declYear: 2026, periodLabel: "10/2026", status: "DRAFT", prevCredit: "0", taxAmount: "176000", carriedForward: "0", modDtm: null }], totalCount: 1 });
    h.get.mockResolvedValue(detail("DRAFT"));
    h.save.mockResolvedValue(detail("DRAFT"));
});

describe("Kê khai thuế GTGT", () => {
    it("lists the working MST's declarations and opens one", async () => {
        renderPage();
        expect(await screen.findByText("176.000")).toBeTruthy();
        expect(h.list).toHaveBeenCalledWith(MST, { year: new Date().getFullYear() });
        fireEvent.click(screen.getByText("176.000"));
        await waitFor(() => expect(h.get).toHaveBeenCalledWith(MST, 7));
    });

    it("draft: edits a white cell and saves only that cell", async () => {
        renderPage();
        fireEvent.click(await screen.findByText("176.000"));
        // [22] is the first editable input (carry-forward credit); derived cells such as [40] are not inputs.
        const inputs = await screen.findAllByRole("textbox");
        const ct22 = inputs[0] as HTMLInputElement;
        fireEvent.change(ct22, { target: { value: "1.500.000" } });
        fireEvent.click(screen.getByText("Lưu bản nháp"));
        await waitFor(() => expect(h.save).toHaveBeenCalledWith(MST, 7, { ct22: "1500000" }));
    });

    it("locked: no inputs, exports offered", async () => {
        h.get.mockResolvedValue(detail("LOCKED"));
        renderPage();
        fireEvent.click(await screen.findByText("176.000"));
        expect(await screen.findByText("XML (HTKK)")).toBeTruthy();
        expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    });

    it("mock mode: explains the server is needed, calls nothing", () => {
        h.source.DATA_SOURCE = "mock";
        renderPage();
        expect(screen.getByText("Tờ khai GTGT cần kết nối máy chủ WeInvoice.")).toBeTruthy();
        expect(h.list).not.toHaveBeenCalled();
    });
});

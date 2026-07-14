import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EInvoiceDetailHistoryDialog from "./EInvoiceDetailHistoryDialog";

/**
 * Legacy-parity guard for the e-Invoice "Latest Inquiry" popup (refactor
 * port of {@code nxisas_einvhis_dt}). Shared by Sales + Expenses via the
 * {@code variant} prop; these tests pin:
 *
 *   • title + party-name column heading switch by variant (Buyer vs Seller);
 *   • the read-only inquiry date range renders DD-MM-YYYY from the ISO
 *     bounds (root-cause fix: the old bare "~" came from feeding an ISO
 *     string into a yyyyMMdd-only formatter);
 *   • the five legacy columns render;
 *   • View Details renders only when a handler is supplied and calls it;
 *   • the correct backend `type` is sent per variant (Sales↔Expense data
 *     isolation);
 *   • row data + VND amount + locale date render;
 *   • loading → empty state ordering (empty never shows while loading);
 *   • close via the X affordance.
 *
 * i18n + the addon API are mocked; EllipsisTooltip is stubbed to a plain
 * span so the assertions target this component's orchestration only.
 */

const h = vi.hoisted(() => ({
    fetchDetailMock: vi.fn(),
}));

vi.mock("@/lib/api/addon", () => ({
    fetchEInvoiceDetailHistory: h.fetchDetailMock,
}));

vi.mock("@/lib/i18n", () => ({
    useTranslation: () => ({ t: (key: string) => key, locale: "EN" }),
}));

// EllipsisTooltip pulls ResizeObserver + a portal — irrelevant here; render
// the raw text so the counterparty cell is assertable.
vi.mock("@/components/shared/EllipsisTooltip", () => ({
    default: ({ text }: { text: string }) => <span>{text}</span>,
}));

function detailRow(over: Record<string, unknown> = {}) {
    return {
        doc_id: "DOC1",
        disp_doc_id: "1C26TWV-231",
        issu_dt: "20260601",
        trco_cmnm: "CÔNG TY TNHH PLATEL VINA",
        totl_amt: "6000000",
        einv_invoice_status: "Hóa đơn mới",
        ...over,
    };
}

beforeEach(() => {
    h.fetchDetailMock.mockReset().mockResolvedValue({ rows: [detailRow()] });
});

const BASE = {
    modDtm: "20260601120000",
    startIso: "2026-06-01",
    endIso: "2026-06-30",
    onClose: vi.fn(),
};

describe("EInvoiceDetailHistoryDialog — shared layout + date range", () => {
    it("renders the read-only inquiry range as DD-MM-YYYY (root-cause fix)", async () => {
        render(<EInvoiceDetailHistoryDialog variant="SALES" {...BASE} onClose={vi.fn()} />);
        // Was previously blank ("~") because formatDateLang got an ISO string.
        expect(await screen.findByText("01-06-2026")).toBeTruthy();
        expect(screen.getByText("30-06-2026")).toBeTruthy();
    });

    it("renders the five legacy columns", async () => {
        render(<EInvoiceDetailHistoryDialog variant="SALES" {...BASE} onClose={vi.fn()} />);
        await screen.findByText("einvoice_detail.col.date");
        expect(screen.getByText("einvoice_detail.col.invoice_no")).toBeTruthy();
        expect(screen.getByText("einvoice_detail.col.amount")).toBeTruthy();
        expect(screen.getByText("einvoice_detail.col.status")).toBeTruthy();
    });

    it("renders View Details when a handler is supplied and invokes it", async () => {
        const onViewDetails = vi.fn();
        render(
            <EInvoiceDetailHistoryDialog
                variant="SALES"
                {...BASE}
                onClose={vi.fn()}
                onViewDetails={onViewDetails}
            />,
        );
        const btn = await screen.findByRole("button", {
            name: "einvoice_detail.view_details",
        });
        fireEvent.click(btn);
        expect(onViewDetails).toHaveBeenCalledTimes(1);
    });

    it("fires View Details only once on repeated clicks (no duplicate navigation)", async () => {
        const onViewDetails = vi.fn();
        render(
            <EInvoiceDetailHistoryDialog
                variant="SALES"
                {...BASE}
                onClose={vi.fn()}
                onViewDetails={onViewDetails}
            />,
        );
        const btn = await screen.findByRole("button", {
            name: "einvoice_detail.view_details",
        });
        fireEvent.click(btn);
        fireEvent.click(btn);
        fireEvent.click(btn);
        expect(onViewDetails).toHaveBeenCalledTimes(1);
    });

    it("hides View Details when no handler is supplied (never a dead button)", async () => {
        render(<EInvoiceDetailHistoryDialog variant="SALES" {...BASE} onClose={vi.fn()} />);
        await screen.findByText("einvoice_detail.col.date");
        expect(
            screen.queryByRole("button", { name: "einvoice_detail.view_details" }),
        ).toBeNull();
    });

    it("closes via the X affordance", async () => {
        const onClose = vi.fn();
        render(<EInvoiceDetailHistoryDialog variant="SALES" {...BASE} onClose={onClose} />);
        fireEvent.click(await screen.findByRole("button", { name: "Close" }));
        expect(onClose).toHaveBeenCalled();
    });
});

describe("EInvoiceDetailHistoryDialog — data rendering", () => {
    it("renders row data with VND amount + locale (EN) date", async () => {
        render(<EInvoiceDetailHistoryDialog variant="SALES" {...BASE} onClose={vi.fn()} />);
        expect(await screen.findByText("1C26TWV-231")).toBeTruthy();
        expect(screen.getByText("CÔNG TY TNHH PLATEL VINA")).toBeTruthy();
        // ISSU_DT 20260601 → EN DD-MMM-YYYY.
        expect(screen.getByText("01-Jun-2026")).toBeTruthy();
        // VND, id-ID thousands + ₫ symbol.
        expect(screen.getByText(/6\.000\.000/)).toBeTruthy();
        // Raw stored status string rendered (colour via EInvoiceStatusText).
        expect(screen.getByText("Hóa đơn mới")).toBeTruthy();
    });

    it("shows the empty state only after a resolved empty result", async () => {
        h.fetchDetailMock.mockResolvedValue({ rows: [] });
        render(<EInvoiceDetailHistoryDialog variant="SALES" {...BASE} onClose={vi.fn()} />);
        expect(await screen.findByText("common.no_data_found")).toBeTruthy();
    });

    it("shows the loading indicator (not the empty state) while resolving", async () => {
        let resolve: (v: { rows: unknown[] }) => void = () => {};
        h.fetchDetailMock.mockReturnValue(
            new Promise((r) => {
                resolve = r;
            }),
        );
        render(<EInvoiceDetailHistoryDialog variant="SALES" {...BASE} onClose={vi.fn()} />);
        expect(screen.getByText("common.loading")).toBeTruthy();
        expect(screen.queryByText("common.no_data_found")).toBeNull();
        resolve({ rows: [] });
        await screen.findByText("common.no_data_found");
    });
});

describe("EInvoiceDetailHistoryDialog — Sales / Expense isolation", () => {
    it("Sales: buyer heading + SALES backend type", async () => {
        render(<EInvoiceDetailHistoryDialog variant="SALES" {...BASE} onClose={vi.fn()} />);
        expect(
            await screen.findByRole("heading", { name: "einvoice_detail.title_sales" }),
        ).toBeTruthy();
        expect(screen.getByText("einvoice_detail.col.buyer")).toBeTruthy();
        expect(screen.queryByText("einvoice_detail.col.seller")).toBeNull();
        expect(h.fetchDetailMock).toHaveBeenCalledWith(
            expect.objectContaining({ type: "SALES", from: "20260601", to: "20260630" }),
        );
    });

    it("Expense: seller heading + EXPENSE backend type", async () => {
        render(<EInvoiceDetailHistoryDialog variant="EXPENSE" {...BASE} onClose={vi.fn()} />);
        expect(
            await screen.findByRole("heading", { name: "einvoice_detail.title_expenses" }),
        ).toBeTruthy();
        expect(screen.getByText("einvoice_detail.col.seller")).toBeTruthy();
        expect(screen.queryByText("einvoice_detail.col.buyer")).toBeNull();
        await waitFor(() =>
            expect(h.fetchDetailMock).toHaveBeenCalledWith(
                expect.objectContaining({ type: "EXPENSE" }),
            ),
        );
    });
});

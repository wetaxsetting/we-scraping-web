import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EInvoicesClient from "./EInvoicesClient";

/**
 * "View e-Invoice Details" modal wiring — pins the confirmed behaviour:
 *
 *   • a list-row click opens the shared ViewEInvoiceDetailsModal;
 *   • the SAME shared modal component serves both variants (Sales + Expense);
 *   • Sales resolves `invoiceType="sales"`, Expense resolves `"expense"` —
 *     derived from the client's own `type`, so the variant can't cross.
 *
 * The heavy page + modal children and every data hook are stubbed so the
 * assertions target this client's orchestration only. The EInvoicesPage stub
 * exposes a button that fires the real `onRowClick` the client passed down;
 * the ViewEInvoiceDetailsModal stub surfaces its `open` + `invoiceType` props.
 */

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/lib/i18n", () => ({
    useTranslation: () => ({ t: (k: string) => k, locale: "EN" }),
}));

vi.mock("@/lib/api/useApiData", () => ({
    useApiData: () => ({ data: undefined, loading: false }),
}));

vi.mock("@/lib/api/mappers", () => ({
    mapEInvoiceRow: (r: unknown) => r,
    mapEInvoiceTotal: (r: unknown) => r,
}));

vi.mock("@/lib/api/addon", () => ({ fetchEInvoices: vi.fn() }));

vi.mock("@/hooks/useStickyLoading", () => ({ useStickyLoading: (v: unknown) => v }));

vi.mock("@/hooks/useTableSort", () => ({
    useTableSort: () => ({
        sortField: null,
        sortDirection: null,
        sortParams: null,
        toggleSort: vi.fn(),
    }),
}));

vi.mock("@/hooks/useExcelExport", () => ({ useExcelExport: () => vi.fn() }));

vi.mock("@/components/shared/dialog", () => ({ useDialog: () => ({ open: vi.fn() }) }));

// Page stub — exposes a button that fires the real onRowClick with a fake row.
vi.mock("./EInvoicesPage", () => ({
    default: ({ onRowClick }: { onRowClick?: (row: unknown) => void }) => (
        <button type="button" onClick={() => onRowClick?.({ id: "row-1" })}>
            open-details
        </button>
    ),
}));

// Update modal stub — kept inert; unrelated to this test.
vi.mock("./UpdateEInvoiceModal", () => ({ default: () => null }));

// Shared View-details modal stub — surfaces open + invoiceType.
vi.mock("@/components/addon/einvoices/ViewEInvoiceDetailsModal", () => ({
    default: ({ open, invoiceType }: { open: boolean; invoiceType: string }) => (
        <div
            data-testid="view-details-modal"
            data-open={String(open)}
            data-invoice-type={invoiceType}
        />
    ),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("EInvoicesClient — View e-Invoice Details modal", () => {
    it("Sales: row click opens the shared modal with invoiceType=sales", () => {
        render(<EInvoicesClient type="SALES" translationPrefix="sales_einvoices" />);

        const modal = screen.getByTestId("view-details-modal");
        // Closed on first paint.
        expect(modal.getAttribute("data-open")).toBe("false");
        expect(modal.getAttribute("data-invoice-type")).toBe("sales");

        fireEvent.click(screen.getByText("open-details"));
        expect(
            screen.getByTestId("view-details-modal").getAttribute("data-open"),
        ).toBe("true");
    });

    it("Expense: row click opens the shared modal with invoiceType=expense", () => {
        render(
            <EInvoicesClient type="EXPENSE" translationPrefix="expenses_einvoices" />,
        );

        const modal = screen.getByTestId("view-details-modal");
        expect(modal.getAttribute("data-invoice-type")).toBe("expense");

        fireEvent.click(screen.getByText("open-details"));
        expect(
            screen.getByTestId("view-details-modal").getAttribute("data-open"),
        ).toBe("true");
    });
});

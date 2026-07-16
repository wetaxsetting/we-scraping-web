import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import EInvoiceTable from "./EInvoiceTable";
import type { EInvoiceRow } from "./types";

/**
 * EInvoiceTable row-click guard — a body-row click opens the details modal
 * via `onRowClick`, but clicks that originate on an interactive control
 * (checkbox, button, link, dropdown, or `[data-ignore-row-click]`) are
 * ignored so the row click never hijacks those affordances.
 */

vi.mock("@/lib/i18n", () => ({
    useTranslation: () => ({ t: (k: string) => k, locale: "EN" }),
}));

const ROW: EInvoiceRow = {
    id: "inv-1",
    date: "20241014",
    time: "112646",
    invoiceNo: "1C24TWV-1231",
    invoiceType: "Original",
    buyerName: "CÔNG TY TNHH MTV AJTOTAL",
    mstCode: "1101901122-003",
    buyerStatus: "",
    currency: "VND",
    totalAmount: "7000000",
    invoiceStatus: "Original",
    taxAmount: "0",
    amountBeforeTax: "7000000",
};

function getBodyRow(): HTMLElement {
    // getAllByRole("row") → [header row, body row].
    const rows = screen.getAllByRole("row");
    return rows[rows.length - 1];
}

describe("EInvoiceTable — row click", () => {
    it("calls onRowClick with the row when a cell is clicked", () => {
        const onRowClick = vi.fn();
        render(<EInvoiceTable rows={[ROW]} onRowClick={onRowClick} />);

        fireEvent.click(screen.getByText("1C24TWV-1231"));
        expect(onRowClick).toHaveBeenCalledTimes(1);
        expect(onRowClick).toHaveBeenCalledWith(ROW);
    });

    it("does NOT call onRowClick when a checkbox inside the row is clicked", () => {
        const onRowClick = vi.fn();
        render(<EInvoiceTable rows={[ROW]} onRowClick={onRowClick} />);

        const cell = getBodyRow().querySelector("td")!;
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        cell.appendChild(checkbox);

        fireEvent.click(checkbox);
        expect(onRowClick).not.toHaveBeenCalled();
    });

    it("does NOT call onRowClick when an action button inside the row is clicked", () => {
        const onRowClick = vi.fn();
        render(<EInvoiceTable rows={[ROW]} onRowClick={onRowClick} />);

        const cell = getBodyRow().querySelector("td")!;
        const button = document.createElement("button");
        button.textContent = "act";
        cell.appendChild(button);

        fireEvent.click(button);
        expect(onRowClick).not.toHaveBeenCalled();
    });

    it("does not attach a click handler when onRowClick is omitted", () => {
        render(<EInvoiceTable rows={[ROW]} />);
        // No throw / no handler — clicking a cell is a no-op.
        fireEvent.click(screen.getByText("1C24TWV-1231"));
        expect(getBodyRow()).toBeInTheDocument();
    });
});

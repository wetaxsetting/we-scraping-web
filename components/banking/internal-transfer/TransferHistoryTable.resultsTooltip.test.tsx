/**
 * Regression coverage for the Transfer History **Results** cell tooltip.
 *
 * <p>Guards the defect fixed 2026-08-19: the cell carried a native
 * `title={row.statusMessage}` attribute, so the bank's failure message showed
 * as the browser's own OS tooltip — unstyled, viewport-wide on a long message
 * (it overlapped the row below on SIT), delayed, and unreachable by keyboard.
 *
 * <p>Legacy behaviour under test — `trns_0003_001.ts`:
 * <ul>
 *   <li>`:318` the Results `<td>` carries `class="show_message_error"` on
 *       EVERY row, and `:127-133` toggle a `.error_message` layer on
 *       mouseenter / mouseleave — a custom hover layer, never a `title`.</li>
 *   <li>`:288` + `:319` render that layer **only when `TRNS_MSG` is
 *       non-empty**, with NO branch on `TRNS_STTS`. So the gate is the
 *       message, not the status.</li>
 * </ul>
 *
 * @see ../../../docs/bugs/transfer-history-results-tooltip-2026-08-19.md
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "@/lib/i18n";

import TransferHistoryTable from "./TransferHistoryTable";
import type { TransferRow } from "./types";

/* ===================================================================
 *  Fixtures — the failed Vietcom → Shinhan rows from the SIT report
 * ================================================================= */

const FAIL_MESSAGE =
    "The transaction failed, since the financial institution`s webpage was modified. "
    + "please check and try again later.";

function row(overrides: Partial<TransferRow> = {}): TransferRow {
    return {
        id:            "1",
        date:          "18-08-2026",
        time:          "17:43",
        fromBank:      "Vietcom",
        fromCurrency:  "VND",
        fromAccount:   "0441000688210",
        toBank:        "ShinhanBank",
        toCurrency:    "VND",
        toAccount:     "700022499445",
        amount:        "10.000",
        remarks:       "Vietcom 210 to Shinhan 445",
        status:        "failed",
        statusMessage: FAIL_MESSAGE,
        lastUpdate:    "18-08-2026 17:43",
        ...overrides,
    };
}

function renderTable(rows: TransferRow[]) {
    // `<LocaleProvider>` matches the established component-test pattern in
    // this repo (see `transaction-history/confirmedCellReadOnly.test.tsx`) —
    // the table calls `useTranslation()`, which throws without it. The
    // provider loads the real EN messages, so `t(...)` returns translations.
    return render(
        <LocaleProvider>
            <table>
                <TransferHistoryTable rows={rows} />
            </table>
        </LocaleProvider>,
    );
}

/** The Results cell — last `<td>` of the first body row. */
function resultsCell(): HTMLElement {
    const cells = document.querySelectorAll("tbody tr:first-child td");
    const cell = cells[cells.length - 1];
    if (!cell) throw new Error("Results cell not found");
    return cell as HTMLElement;
}

/* ===================================================================
 *  Tests
 * ================================================================= */

describe("Transfer History — Results cell tooltip", () => {
    it("renders NO native title attribute anywhere in the row", () => {
        // THE REGRESSION. The old cell shipped `title={row.statusMessage}`,
        // which produced the OS tooltip instead of the product's.
        renderTable([row()]);
        expect(resultsCell().hasAttribute("title")).toBe(false);
        expect(document.querySelectorAll("tbody [title]")).toHaveLength(0);
    });

    it("shows the bank message through the shared Tooltip on hover", () => {
        renderTable([row()]);
        // Not in the DOM until hovered — the shared Tooltip is portal-mounted
        // on demand, unlike a `title` which is always an attribute.
        expect(screen.queryByRole("tooltip")).toBeNull();

        fireEvent.mouseEnter(resultsCell().firstElementChild as HTMLElement);

        const tip = screen.getByRole("tooltip");
        expect(tip).not.toBeNull();
        expect(tip.textContent).toContain("financial institution");
    });

    it("hides the tooltip again on mouse leave", () => {
        renderTable([row()]);
        const trigger = resultsCell().firstElementChild as HTMLElement;
        fireEvent.mouseEnter(trigger);
        expect(screen.queryByRole("tooltip")).not.toBeNull();
        fireEvent.mouseLeave(trigger);
        expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("is keyboard reachable — focus opens it, blur closes it", () => {
        // A native `title` never opens on focus; this is the accessibility
        // gain of the shared component.
        renderTable([row()]);
        const trigger = resultsCell().firstElementChild as HTMLElement;
        fireEvent.focus(trigger);
        expect(screen.queryByRole("tooltip")).not.toBeNull();
        fireEvent.blur(trigger);
        expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("renders no tooltip trigger at all when the row carries no message", () => {
        // Legacy `:319` omits the `.error_message` layer for an empty
        // `TRNS_MSG`; `<Tooltip>` mirrors that by rendering children bare.
        renderTable([row({ status: "success", statusMessage: "" })]);
        const cell = resultsCell();
        expect(cell.hasAttribute("title")).toBe(false);
        fireEvent.mouseEnter(cell.firstElementChild as HTMLElement);
        expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("gates on the MESSAGE, not on the status — legacy `:288` / `:319`", () => {
        // Legacy does not branch on TRNS_STTS for the hover layer. A success
        // row that did carry a message would still show it. (The engine
        // returns ErrorMessage "" on success, so this is not seen in
        // practice — but the rule is the message, not the status.)
        renderTable([row({ status: "success", statusMessage: "Partially processed." })]);
        fireEvent.mouseEnter(resultsCell().firstElementChild as HTMLElement);
        expect(screen.getByRole("tooltip").textContent).toContain("Partially processed.");
    });

    it("keeps the Failed label and the timestamp rendering unchanged", () => {
        renderTable([row()]);
        const cell = resultsCell();
        expect(cell.textContent).toContain("18-08-2026 17:43");
        // `<LocaleProvider>` loads the real EN messages, so the label resolves
        // to its translation rather than echoing the key.
        expect(cell.textContent).toContain("Failed");
    });
});

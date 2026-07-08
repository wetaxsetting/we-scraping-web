import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PurposeSelect, { type PurposeOption } from "@/components/shared/PurposeSelect";
import VasAccountSelect from "@/components/banking/transaction-history/VasAccountSelect";
import TransactionTable from "@/components/banking/transaction-history/TransactionTable";
import type {
    TransactionRow,
    VasAccountOption,
} from "@/components/banking/transaction-history/types";
import { LocaleProvider } from "@/lib/i18n";

/**
 * Regression — Transaction History confirmed-row classification cells
 * (legacy fnsh_0002_001 parity).
 *
 * Purpose / VAS Account / Contact Name all render through the same shared
 * SearchSelect via their thin picker adapters; PurposeSelect is exercised
 * here as the representative of the trio. The invariant under test:
 *
 *   - UNCONFIRMED row  → editable: an interactive affordance (pencil / clear
 *                        trigger button) is present so the user can pick.
 *   - CONFIRMED row    → read-only: NO interactive affordance; the picked
 *                        value renders as plain locked text (edit disabled
 *                        until Undo).
 *   - UNDO             → the row is unconfirmed again → editable affordance
 *                        is restored.
 *
 * The confirmed/unconfirmed state is driven by `readOnly` on the picker,
 * wired in the column registry as `readOnly={row.confirmed}`.
 */

const PURPOSE: PurposeOption = { useUsagCd: "31", code: "31", name: "Loan" };
const OPTIONS: PurposeOption[] = [PURPOSE];

function pickerElement(readOnly: boolean) {
    return (
        <LocaleProvider>
            <PurposeSelect
                value={PURPOSE}
                options={OPTIONS}
                recentUseUsagCds={[]}
                onChange={() => {}}
                onClear={() => {}}
                readOnly={readOnly}
            />
        </LocaleProvider>
    );
}

describe("Transaction History classification cell — confirmed-state read-only (fnsh_0002_001 parity)", () => {
    it("unconfirmed row → editable (interactive affordance present)", () => {
        render(pickerElement(false));
        // Value is shown …
        expect(screen.getByText("31 Loan")).toBeInTheDocument();
        // … and an interactive trigger (pencil / clear button) is available.
        expect(screen.queryByRole("button")).not.toBeNull();
    });

    it("confirmed row → read-only (value shown, no interactive affordance)", () => {
        render(pickerElement(true));
        expect(screen.getByText("31 Loan")).toBeInTheDocument();
        // No button, no dropdown trigger — editing is disabled until Undo.
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("undo → editable again (affordance restored after confirm)", () => {
        const { rerender } = render(pickerElement(false));
        expect(screen.queryByRole("button")).not.toBeNull(); // unconfirmed → editable

        rerender(pickerElement(true)); // Confirm → locked
        expect(screen.queryByRole("button")).toBeNull();
        expect(screen.getByText("31 Loan")).toBeInTheDocument();

        rerender(pickerElement(false)); // Undo → editable again
        expect(screen.queryByRole("button")).not.toBeNull();
    });
});

describe("Action cell (Confirm / Undo) tint — confirm-driven, not match-driven (fnsh_0002_001 parity)", () => {
    // Minimal rows — only the trailing action cell renders when
    // visibleColumns is empty, so we don't need to seed classification.
    // Both rows are unmatched (linkMatchYn 'N') to prove the tint follows
    // CONFIRM state, not match state.
    const rows = [
        { id: "row-confirmed", confirmed: true, linkMatchYn: "N" },
        { id: "row-unconfirmed", confirmed: false, linkMatchYn: "N" },
    ] as unknown as TransactionRow[];

    function renderTable() {
        return render(
            <LocaleProvider>
                <TransactionTable
                    rows={rows}
                    visibleColumns={[]}
                    currency="VND"
                    reportingAccountOptions={[]}
                    purposeOptions={[]}
                    recentPurposeUseUsagCds={[]}
                    vasAccountOptions={[]}
                    recentVasAcctCds={[]}
                    contactOptions={[]}
                    recentContactTrcoKeys={[]}
                />
            </LocaleProvider>,
        );
    }

    it("confirmed row → Undo cell has NO yellow background", () => {
        renderTable();
        const undoCell = screen.getByText("Undo").closest("td");
        expect(undoCell).not.toBeNull();
        expect(undoCell?.className).not.toContain("bg-[#FFFEDB]");
    });

    it("unconfirmed row → Confirm cell keeps the yellow background", () => {
        renderTable();
        const confirmCell = screen.getByText("Confirm").closest("td");
        expect(confirmCell).not.toBeNull();
        expect(confirmCell?.className).toContain("bg-[#FFFEDB]");
    });
});

describe("Confirmed by cell — name over date (fnsh_0002_001 parity)", () => {
    const COLS = [
        {
            field_id: "CONFIRMED_BY",
            field_nm: "Confirmed by",
            disp_ord: 1,
            disp_yn: "Y",
            use_yn: "Y",
            size: "160px",
            sort_yn: "N",
        },
    ] as unknown as Parameters<typeof TransactionTable>[0]["visibleColumns"];

    // Two confirmed rows: one with a UTC CNFM_DTM (10:30Z 2026-07-07 → still
    // 2026-07-07 in VN), one with no date. Default test locale is EN, so the
    // date renders "07-Jul-2026" (the locale-aware date used by Matched Date
    // too); under VI it renders "07-07-2026" as the live system shows.
    const rows = [
        {
            id: "row-dated",
            confirmed: true,
            confirmedBy: { name: "Kim Thu", date: "" },
            confirmedDtmRaw: "20260707033000",
            linkMatchYn: "N",
        },
        {
            id: "row-nodate",
            confirmed: true,
            confirmedBy: { name: "No Date User", date: "" },
            confirmedDtmRaw: undefined,
            linkMatchYn: "N",
        },
    ] as unknown as TransactionRow[];

    function renderTable() {
        return render(
            <LocaleProvider>
                <TransactionTable
                    rows={rows}
                    visibleColumns={COLS}
                    currency="VND"
                    reportingAccountOptions={[]}
                    purposeOptions={[]}
                    recentPurposeUseUsagCds={[]}
                    vasAccountOptions={[]}
                    recentVasAcctCds={[]}
                    contactOptions={[]}
                    recentContactTrcoKeys={[]}
                />
            </LocaleProvider>,
        );
    }

    it("renders the confirmer name AND the confirmed date under it", () => {
        renderTable();
        expect(screen.getByText("Kim Thu")).toBeInTheDocument();
        expect(screen.getByText("07-Jul-2026")).toBeInTheDocument();
    });

    it("renders only the name when the confirmed date is null", () => {
        renderTable();
        expect(screen.getByText("No Date User")).toBeInTheDocument();
        // Exactly one date line across both rows — the dated row only.
        expect(screen.queryAllByText("07-Jul-2026")).toHaveLength(1);
    });
});

describe("VAS Account read-only fallback — never blank when the wire carries the code", () => {
    it("renders the code alone when the name is unresolved (confirmed row, VAS master deactivated)", () => {
        const value: VasAccountOption = { vasAcctCd: "111", name: "" };
        render(
            <LocaleProvider>
                <VasAccountSelect
                    value={value}
                    options={[]}
                    recentVasAcctCds={[]}
                    onChange={() => {}}
                    onClear={() => {}}
                    readOnly
                />
            </LocaleProvider>,
        );
        // Code visible even though the active-VAS options list is empty …
        expect(screen.getByText("111")).toBeInTheDocument();
        // … and still read-only (no edit affordance).
        expect(screen.queryByRole("button")).toBeNull();
    });
});

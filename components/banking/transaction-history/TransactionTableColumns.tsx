/**
 * Shared `<colgroup>` for the Transaction History table. Both the main
 * table (thead + tbody) and the footer summary reuse this definition so
 * the Deposit / Withdraw totals and the matching columns line up at every
 * viewport width. Ten columns per Figma node 989:22011 — the left half
 * is the bank statement (Date/Time · Deposit · Withdraw · Balance ·
 * Remarks) and the right half is the matching / classification panel
 * (Purpose · VAS Account · Contacts Name · Confirmed by · Action).
 */
export default function TransactionTableColumns() {
    return (
        <colgroup>
            {/* Bank statement columns */}
            <col className="w-[140px]" />
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col className="w-[140px]" />
            <col className="w-[260px]" />
            {/* Matching panel columns */}
            <col className="w-[180px]" />
            <col className="w-[160px]" />
            <col className="w-[240px]" />
            <col className="w-[160px]" />
            <col className="w-[100px]" />
        </colgroup>
    );
}

export const TRANSACTION_COLUMN_COUNT = 10;

/** Minimum table width — matches the total col widths above. */
export const TRANSACTION_TABLE_MIN_WIDTH = "1620px";

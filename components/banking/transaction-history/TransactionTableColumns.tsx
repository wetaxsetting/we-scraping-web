/**
 * Shared `<colgroup>` for the Transaction History table. Both the main
 * table (thead + tbody) and the footer summary reuse this definition so
 * the Deposit / Withdrawal totals line up at every viewport width.
 *
 * Column order mirrors the legacy on-screen Transaction History table
 * (12 data columns + 1 trailing action column = 13 total) and the
 * matching V157 + V159 View Setting seed:
 *   1  Transaction ID  · 2  Date/Time  · 3  Deposit · 4  Withdrawal ·
 *   5  Balance         · 6  Remarks    · 7  File Name · 8  Matched Date ·
 *   9  Matched By      · 10 Purpose    · 11 Contact Name · 12 Confirmed by ·
 *   13 [action] — Confirm / Undo button (no header label)
 */
export default function TransactionTableColumns() {
    return (
        <colgroup>
            <col className="w-[160px]" /> {/* Transaction ID */}
            <col className="w-[160px]" /> {/* Date/Time      */}
            <col className="w-[140px]" /> {/* Deposit        */}
            <col className="w-[140px]" /> {/* Withdrawal     */}
            <col className="w-[140px]" /> {/* Balance        */}
            <col className="w-[240px]" /> {/* Remarks        */}
            <col className="w-[180px]" /> {/* File Name      */}
            <col className="w-[140px]" /> {/* Matched Date   */}
            <col className="w-[120px]" /> {/* Matched By     */}
            <col className="w-[140px]" /> {/* Purpose        */}
            <col className="w-[180px]" /> {/* Contact Name   */}
            <col className="w-[160px]" /> {/* Confirmed by   */}
            <col className="w-[110px]" /> {/* Action col     */}
        </colgroup>
    );
}

export const TRANSACTION_COLUMN_COUNT = 13;

/** Minimum table width — matches the total col widths above (2010px). */
export const TRANSACTION_TABLE_MIN_WIDTH = "2010px";

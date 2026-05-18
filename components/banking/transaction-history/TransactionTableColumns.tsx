/**
 * Shared `<colgroup>` for the Transaction History table. Both the main
 * table (thead + tbody) and the footer summary reuse this definition so
 * the Deposit / Withdrawal totals line up at every viewport width.
 *
 * Column order mirrors the legacy on-screen Transaction History table
 * (14 data columns + 1 trailing action column = 15 total) and the
 * matching View Setting seed plus the Reporting Account / VAS Account
 * inserts (legacy `fnsh_0200_001` parity):
 *   1  Transaction ID  · 2  Date/Time  · 3  Deposit · 4  Withdrawal ·
 *   5  Balance         · 6  Remarks    · 7  File Name · 8  Matched Date ·
 *   9  Matched By      · 10 Reporting Account · 11 Purpose ·
 *   12 VAS Account     · 13 Contact Name · 14 Confirmed by ·
 *   15 [action] — Confirm / Undo button (no header label)
 */
export default function TransactionTableColumns() {
    return (
        <colgroup>
            <col className="w-[160px]" /> {/* Transaction ID    */}
            <col className="w-[160px]" /> {/* Date/Time         */}
            <col className="w-[140px]" /> {/* Deposit           */}
            <col className="w-[140px]" /> {/* Withdrawal        */}
            <col className="w-[140px]" /> {/* Balance           */}
            <col className="w-[240px]" /> {/* Remarks           */}
            <col className="w-[180px]" /> {/* File Name         */}
            <col className="w-[140px]" /> {/* Matched Date      */}
            <col className="w-[120px]" /> {/* Matched By        */}
            <col className="w-[190px]" /> {/* Reporting Account */}
            <col className="w-[140px]" /> {/* Purpose           */}
            <col className="w-[200px]" /> {/* VAS Account       */}
            <col className="w-[180px]" /> {/* Contact Name      */}
            <col className="w-[160px]" /> {/* Confirmed by      */}
            <col className="w-[110px]" /> {/* Action col        */}
        </colgroup>
    );
}

export const TRANSACTION_COLUMN_COUNT = 15;

/** Minimum table width — matches the total col widths above (2400px). */
export const TRANSACTION_TABLE_MIN_WIDTH = "2400px";

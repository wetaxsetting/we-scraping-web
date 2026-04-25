/**
 * Shared `<colgroup>` for the Transfer Own Accounts table. Both the main
 * table (thead + tbody) and the footer summary reuse this definition so the
 * Balance / Available totals line up under their columns regardless of
 * viewport width. Mirrors the Approval Box shared-colgroup pattern so every
 * data-table page uses the same footer-alignment mechanism.
 */
export default function TransferOwnAccountsTableColumns() {
    return (
        <colgroup>
            <col className="w-[240px]" />
            <col className="w-[280px]" />
            <col className="w-[160px]" />
            <col className="w-[180px]" />
            <col className="w-[160px]" />
            <col className="w-[120px]" />
        </colgroup>
    );
}

export const TRANSFER_OWN_ACCOUNTS_COLUMN_COUNT = 6;

/**
 * Shared `<colgroup>` for the Transfer History table. Both the main table
 * (thead + tbody) and the footer summary reuse this definition so the
 * Transfer Amount total lines up under its column regardless of viewport
 * width. Mirrors the Approval Box shared-colgroup pattern.
 */
export default function TransferHistoryTableColumns() {
    return (
        <colgroup>
            <col className="w-[120px]" />
            <col className="w-[260px]" />
            <col className="w-[260px]" />
            <col className="w-[160px]" />
            <col />
            <col className="w-[140px]" />
        </colgroup>
    );
}

export const TRANSFER_HISTORY_COLUMN_COUNT = 6;

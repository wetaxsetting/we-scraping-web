"use client";

import { useApiData } from "@/lib/api/useApiData";
import {
    fetchBlockedChars,
    type BlockedCharsMap,
    type PymnType,
} from "@/lib/api/blockedChars";

/**
 * Mount-once fetch for active `BLOCKED_CHARS_RULE` rows scoped to one
 * `(bankCd, pymnType)` pair. Drives the column-header info-icon
 * tooltip on Excel-upload preview + Scheduled / Result detail tables.
 *
 * <p>Re-fires whenever `bankCd` or `pymnType` changes — bank selection
 * is per-upload context, so the hook lives at the same level as the
 * filter / withdrawal-bank state.
 *
 * <p>Returns an empty map (`{}`) on first render and on `bankCd`
 * blank — the matching `<BlockedCharsTooltip>` component renders
 * nothing when the field has no entry, so pages don't need a
 * loading-state branch.
 *
 * @example
 *   const blocked = useBlockedChars(withdrawalBankCd, "INTR");
 *   <TableHeaderCell
 *       label={<>Remarks <BlockedCharsTooltip
 *           fieldCd="RMKS"
 *           fieldNameKey="payment.field.remarks"
 *           blockedChars={blocked} />
 *       </>}
 *       ...
 *   />
 */
export function useBlockedChars(
    bankCd: string | null | undefined,
    pymnType: PymnType,
): BlockedCharsMap {
    const { data } = useApiData<BlockedCharsMap>(
        () => fetchBlockedChars(bankCd, pymnType),
        [bankCd ?? "", pymnType],
    );
    return data ?? {};
}

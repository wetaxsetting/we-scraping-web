import { formatUtcDtmByLanguage } from "@/lib/datetime";
import type { Locale } from "@/lib/i18n";

import type { FirmBankingLinkedAccount } from "./types";

/**
 * Compose the linked-account "Last Updated" display string.
 *
 * <p>`mod_dttm` / `reg_dttm` are **UTC instants** (FirmBankingSettingsService
 * writes `OffsetDateTime.now(UTC)`), so the raw value is shifted to the
 * display zone (Asia/Ho_Chi_Minh) and the calendar date is rendered per
 * the active language (EN `DD-MMM-YYYY` / KO `YYYY-MM-DD` / VI `DD-MM-YYYY`)
 * via the shared {@link formatUtcDtmByLanguage}. The editor display name
 * (legacy `LAST_EDTR`) is appended after the date — `"17-Jun-2026, Krong"`.
 *
 * <p>Falls back to the pre-formatted {@code lastUpdated} string for any
 * mock / legacy row that doesn't carry the raw timestamp.
 *
 * <p>Shared by the linked-accounts list row ({@code FirmBankingAccountItem})
 * and the detail dialog ({@code FirmBankingDetailsDialog}) so the two never
 * diverge (the two-call reuse rule).
 */
export function formatFirmBankingLastUpdated(
    account: Pick<
        FirmBankingLinkedAccount,
        "lastUpdated" | "lastUpdatedDtm" | "lastUpdatedEditor"
    >,
    locale: Locale,
): string {
    if (!account.lastUpdatedDtm) return account.lastUpdated;
    const { date } = formatUtcDtmByLanguage(account.lastUpdatedDtm, locale);
    const editor = (account.lastUpdatedEditor ?? "").trim();
    if (date && editor) return `${date}, ${editor}`;
    return date || editor || account.lastUpdated;
}

/**
 * Type definitions shared across the Card Management Add Card popup
 * chain (SelectBank → LoginIdPassword → SelectCards → save).
 */

/**
 * One scraped card row, in the shape the Select Cards dialog renders
 * and the save endpoint accepts. Carries the verbatim NXISAS scrape
 * output plus a {@code cardTypeLabel} derived locally for display —
 * the underlying {@code cardTypeCd} flows to the backend unchanged so
 * legacy code-table assumptions (e.g. {@code "01"} = credit) survive
 * the round-trip.
 */
export interface ScrapedCardDraft {
    /** Stable id for React keys — derived from card_no so re-renders
     *  preserve checkbox state. Falls back to a synthetic uuid when
     *  the scrape returns multiple rows with the same masked number. */
    id:             string;
    cardNo:         string;
    cardTypeCd:     string;
    /** Localised display label for {@code cardTypeCd} (e.g. "Debit
     *  card" / "Credit card"). Computed by the parent state machine
     *  from the locale + cardTypeCd. */
    cardTypeLabel:  string | null;
    cardNm:         string | null;
    cardHldrNm:     string;
    issuDt:         string | null;
    expiDt:         string | null;
    nxisasAcctType: string | null;
    pymnAcctNo:     string | null;
}

"use client";

import AccountInquiryClient from "../account-inquiry/AccountInquiryClient";
import { SCREEN_IDS } from "@/lib/viewSettingScreens";

/**
 * FCY variant — same client wrapper, different `currency` filter and
 * different i18n keys for the page title + summary tile.
 *
 * <p>FCY rule (live, 2026 product): the wire `currency=FCY` resolves
 * on the backend to {@code ccy_cd <> 'VND'}, so this page lists every
 * non-VND account (USD, KRW, EUR, …). The page exposes a second
 * dropdown ("All Currency") so the user can narrow to a single CCY —
 * when narrowed, the wire `currency` becomes that concrete CCY
 * ({@code USD}, {@code KRW}, …) and the backend filter switches to
 * {@code ccy_cd = <CCY>}. The bank dropdown still filters by bank;
 * the two work together.
 *
 * <p>Summary tiles are rendered one per CCY group in the result. With
 * "All Currency" selected the tile list shows every non-VND CCY found
 * in the filtered rows; with a concrete CCY selected the list collapses
 * to a single tile in that CCY. Mixed-currency totals are never
 * rendered.
 *
 * <p>The page binds {@code SCREEN_IDS.ACCOUNT_INQUIRY_FCY} so the View
 * Setting popover and the Excel export endpoint resolve to the FCY
 * scope — not VND.
 */
export default function AccountInquiryFcyClient() {
    return (
        <AccountInquiryClient
            currency="FCY"
            titleKey="account_inquiry.title_fcy"
            exportTitleKey="account_inquiry.export_title_fcy"
            // Per-CCY tile titles — interpolated with `{ccy}` so each
            // tile reads "TOTAL ACCOUNTS (USD)" / "TOTAL ACCOUNTS (KRW)"
            // etc. The static "TOTAL ACCOUNTS (FCY)" label is no longer
            // rendered (mixed-currency total is not meaningful).
            totalLabelKey="account_inquiry.total_label_ccy"
            viewSettingScreenId={SCREEN_IDS.ACCOUNT_INQUIRY_FCY}
            multiCurrencyMode
        />
    );
}

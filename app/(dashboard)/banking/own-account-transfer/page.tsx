import OwnAccountTransferClient from "@/components/banking/own-account-transfer/OwnAccountTransferClient";

export const metadata = {
    title: "Own Account Transfer — WeCMS",
};

/**
 * Banking > Own Account Transfer route. Mirrors legacy
 * {@code trns_0001_001}. Scope is VND-only, same-`biz_key` only
 * (OQ-A PO 2026-05-18) — both source and target must belong to the
 * caller's own ACCT_MSTR.
 *
 * The NXiSAS scraping bundle is loaded by the page itself (via
 * {@code useNxisasEngine}) rather than by a route layout so other
 * pages in the dashboard never pay the ~50 MB asset cost. The bundle
 * lives at {@code /public/nxisas/} as a verbatim vendor drop.
 */
export default function BankingOwnAccountTransferPage() {
    return <OwnAccountTransferClient />;
}

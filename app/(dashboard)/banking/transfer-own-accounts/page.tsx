import OwnAccountTransferClient from "@/components/banking/own-account-transfer/OwnAccountTransferClient";

export const metadata = {
    title: "Own Account Transfer — WeCMS",
};

/**
 * Banking > Own Account Transfer — canonical menu route
 * (`/banking/transfer-own-accounts`, mirrors legacy {@code trns_0001_001}).
 *
 * This route now renders the real NXiSAS composer page directly, so the
 * per-row Transfer button opens the Own Account Transfer popup IN PLACE —
 * no navigation, the URL stays on `/banking/transfer-own-accounts`. The
 * earlier split (a separate read-only list here that deep-linked to
 * `/banking/own-account-transfer?sourceAccountNo=…`) was consolidated on
 * 2026-06-06; the old in-page list components under
 * {@code components/banking/internal-transfer/TransferOwnAccounts*} were
 * retired with that change, and `/banking/own-account-transfer` now
 * redirects here.
 *
 * The NXiSAS scraping bundle is loaded by the page itself (via
 * {@code useNxisasEngine}) rather than by a route layout so other pages in
 * the dashboard never pay the ~50 MB asset cost.
 */
export default function BankingTransferOwnAccountsPage() {
    return <OwnAccountTransferClient />;
}

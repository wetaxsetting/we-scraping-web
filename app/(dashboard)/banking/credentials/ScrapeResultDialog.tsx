"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import type { ApiScrapedAccount } from "@/lib/api/bankCredentials";

type Props = {
    accounts: ApiScrapedAccount[];
    onClose: () => void;
};

/**
 * Shows the live gateway response after a successful scrape. The
 * spike intentionally does NOT persist scraped accounts into
 * {@code ACCT_MSTR} — mapping the gateway's 8-field result into the
 * 30+ column legacy entity is a follow-up feature (see plan §"Out of
 * scope for the spike"). This dialog is the demo surface that proves
 * the end-to-end loop closed.
 */
export function ScrapeResultDialog({ accounts, onClose }: Props) {
    const { t } = useTranslation();
    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[640px]">
                <DialogTitle>
                    {t("banking.credentials.result.title")}
                </DialogTitle>
                {accounts.length === 0 ? (
                    <p className="text-body text-gray-500 mt-3">
                        {t("banking.credentials.result.empty")}
                    </p>
                ) : (
                    <div className="mt-3 rounded border border-gray-200 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-[#e8ebed]">
                                <tr>
                                    <th className="px-3 py-2 text-left text-table-header">
                                        {t("banking.credentials.result.col.acct_num")}
                                    </th>
                                    <th className="px-3 py-2 text-left text-table-header">
                                        {t("banking.credentials.result.col.acct_name")}
                                    </th>
                                    <th className="px-3 py-2 text-right text-table-header">
                                        {t("banking.credentials.result.col.balance")}
                                    </th>
                                    <th className="px-3 py-2 text-left text-table-header">
                                        {t("banking.credentials.result.col.currency")}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {accounts.map((a, i) => (
                                    <tr key={`${a.acct_num ?? i}`} className="border-t border-gray-100">
                                        <td className="px-3 py-2 text-table-cell">{a.acct_num ?? "—"}</td>
                                        <td className="px-3 py-2 text-table-cell">{a.acct_name ?? "—"}</td>
                                        <td className="px-3 py-2 text-table-cell text-right">{a.balance != null ? formatAmount(a.balance, a.currency ?? "VND", false) : "—"}</td>
                                        <td className="px-3 py-2 text-table-cell">{a.currency ?? "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="flex justify-end mt-4">
                    <button
                        type="button"
                        className="h-9 px-4 rounded bg-brand text-white text-button"
                        onClick={onClose}
                    >
                        {t("common.close")}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

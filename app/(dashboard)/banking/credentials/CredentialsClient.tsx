"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiCallError } from "@/lib/api/banking";
import {
    deleteBankCredential,
    fetchBankCredentials,
    startScrape,
    submitScrapeOtp,
    type ApiBankCredentialRow,
    type ApiScrapeSessionResponse,
    type ApiScrapedAccount,
} from "@/lib/api/bankCredentials";
import { useTranslation } from "@/lib/i18n";
import { lookupScrapingResultMessage } from "@/lib/i18n/scrapingResultCodes";

import { AddCredentialDialog } from "./AddCredentialDialog";
import { OtpDialog } from "./OtpDialog";
import { ScrapeResultDialog } from "./ScrapeResultDialog";

/**
 * Credentials list + Add dialog + per-row "Update from bank" button.
 *
 * <p>The spike's user journey:
 *   1. Click Add → enter VCB credential → POST /api/v1/banking/credentials
 *   2. Row appears in the table.
 *   3. Click "Update from bank" → POST /api/v1/banking/scraping/account-list
 *      - If gateway returned OTP_REQUIRED → open OtpDialog
 *      - If COMPLETED → open ScrapeResultDialog
 *      - If ERROR → inline banner
 *   4. From OtpDialog → POST /{sessionId}/otp → same branching
 */
export default function CredentialsClient() {
    const { t } = useTranslation();
    const [rows, setRows] = useState<ApiBankCredentialRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [scrapingFor, setScrapingFor] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [challengePrompt, setChallengePrompt] = useState<string | null>(null);
    const [scrapedAccounts, setScrapedAccounts] = useState<ApiScrapedAccount[] | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchBankCredentials();
            setRows(res.items);
        } catch (err) {
            setError(humanError(err, t));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const handleScrape = async (seqNo: string) => {
        setError(null);
        setScrapingFor(seqNo);
        try {
            const res = await startScrape(seqNo);
            applyScrapeResult(res);
        } catch (err) {
            setError(humanError(err, t));
            setScrapingFor(null);
        }
    };

    const handleOtp = async (value: string) => {
        if (!sessionId) return;
        setError(null);
        try {
            const res = await submitScrapeOtp(sessionId, value);
            applyScrapeResult(res);
        } catch (err) {
            setError(humanError(err, t));
        }
    };

    const handleDelete = async (seqNo: string) => {
        setError(null);
        try {
            await deleteBankCredential(seqNo);
            await reload();
        } catch (err) {
            setError(humanError(err, t));
        }
    };

    function applyScrapeResult(res: ApiScrapeSessionResponse) {
        if (res.status === "COMPLETED") {
            setSessionId(null);
            setChallengePrompt(null);
            setScrapedAccounts(res.accounts ?? []);
            setScrapingFor(null);
            void reload();
            return;
        }
        if (res.status === "OTP_REQUIRED") {
            setSessionId(res.session_id);
            setChallengePrompt(res.challenge_prompt);
            return;
        }
        if (res.status === "ERROR") {
            // Prefer code-keyed i18n over the gateway's native-language
            // free-text message (which is often Korean for NXISAS).
            const localized = lookupScrapingResultMessage(res.error_code, t);
            setError(
                localized ??
                    res.error_message ??
                    res.error_code ??
                    t("banking.credentials.scrape.unknown_error"),
            );
            setSessionId(null);
            setChallengePrompt(null);
            setScrapingFor(null);
            return;
        }
        // CAPTCHA_REQUIRED / QNA_REQUIRED — out of scope for the spike
        setError(
            t("banking.credentials.scrape.unsupported_challenge"),
        );
        setSessionId(null);
        setChallengePrompt(null);
        setScrapingFor(null);
    }

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-page-title">
                    {t("banking.credentials.page_title")}
                </h1>
                <button
                    type="button"
                    className="h-9 px-4 rounded bg-brand text-white text-button"
                    onClick={() => setAddOpen(true)}
                >
                    {t("banking.credentials.add")}
                </button>
            </div>

            {error && (
                <div className="rounded border border-red-300 bg-red-50 px-4 py-2 text-body text-red-700">
                    {error}
                </div>
            )}

            <div className="rounded border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-[#e8ebed]">
                        <tr>
                            <th className="px-3 py-3 text-left text-table-header">#</th>
                            <th className="px-3 py-3 text-left text-table-header">
                                {t("banking.credentials.col.bank")}
                            </th>
                            <th className="px-3 py-3 text-left text-table-header">
                                {t("banking.credentials.col.username")}
                            </th>
                            <th className="px-3 py-3 text-left text-table-header">
                                {t("banking.credentials.col.status")}
                            </th>
                            <th className="px-3 py-3 text-left text-table-header">
                                {t("banking.credentials.col.last_update")}
                            </th>
                            <th className="px-3 py-3 text-right text-table-header"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td className="px-3 py-3 text-body text-gray-500" colSpan={6}>
                                    {t("banking.credentials.loading")}
                                </td>
                            </tr>
                        )}
                        {!loading && rows.length === 0 && (
                            <tr>
                                <td className="px-3 py-3 text-body text-gray-500" colSpan={6}>
                                    {t("banking.credentials.empty")}
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            rows.map((r) => (
                                <tr key={r.seq_no} className="border-t border-gray-100">
                                    <td className="px-3 py-3 text-table-cell">{r.seq_no}</td>
                                    <td className="px-3 py-3 text-table-cell">{r.bank_cd ?? "—"}</td>
                                    <td className="px-3 py-3 text-table-cell">{r.username ?? "—"}</td>
                                    <td className="px-3 py-3 text-table-cell">
                                        {r.acct_list_inq_stts ?? "—"}
                                    </td>
                                    <td className="px-3 py-3 text-table-cell">
                                        {r.lst_acct_list_inq_dt ?? r.mod_dtm ?? "—"}
                                    </td>
                                    <td className="px-3 py-3 text-right space-x-2">
                                        <button
                                            type="button"
                                            className="h-8 px-3 rounded border border-gray-300 text-button"
                                            disabled={scrapingFor === r.seq_no}
                                            onClick={() => handleScrape(r.seq_no)}
                                        >
                                            {scrapingFor === r.seq_no
                                                ? t("banking.credentials.updating")
                                                : t("banking.credentials.update_from_bank")}
                                        </button>
                                        <button
                                            type="button"
                                            className="h-8 px-3 rounded border border-gray-300 text-button text-red-600"
                                            onClick={() => handleDelete(r.seq_no)}
                                        >
                                            {t("banking.credentials.delete")}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>

            {addOpen && (
                <AddCredentialDialog
                    onClose={() => setAddOpen(false)}
                    onCreated={async () => {
                        setAddOpen(false);
                        await reload();
                    }}
                />
            )}

            {sessionId && (
                <OtpDialog
                    prompt={challengePrompt}
                    onSubmit={handleOtp}
                    onCancel={() => {
                        setSessionId(null);
                        setChallengePrompt(null);
                        setScrapingFor(null);
                    }}
                />
            )}

            {scrapedAccounts && (
                <ScrapeResultDialog
                    accounts={scrapedAccounts}
                    onClose={() => setScrapedAccounts(null)}
                />
            )}
        </div>
    );
}

function humanError(err: unknown, t: ReturnType<typeof useTranslation>["t"]): string {
    if (err instanceof ApiCallError) return `[${err.code}] ${err.message}`;
    if (err instanceof Error) return err.message;
    return t("banking.credentials.unknown_error");
}

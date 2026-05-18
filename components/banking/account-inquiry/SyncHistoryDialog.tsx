"use client";

import { useEffect, useMemo, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { formatDateChipNumeric } from "@/components/shared/DateField";
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import { ApiCallError, fetchSyncHistory } from "@/lib/api/banking";
import type { ApiSyncHistoryRow } from "@/lib/types/api";
import { useTranslation } from "@/lib/i18n";

/**
 * Bank Transaction Sync &gt; History popup. Lists past inquiry attempts
 * (one row per scrape call against {@code EXT_TRAN_CALL_HIS}) for the
 * current user and tenant. Mirrors legacy
 * {@code fnsh_0001_003} — the screenshot's "Lastest Inquiry History"
 * popup.
 *
 * <p>Filters:
 * <ul>
 *   <li>Date range — drives the wire {@code from_dt} / {@code to_dt}
 *       ({@code yyyyMMdd}).</li>
 *   <li>Bank dropdown — "All Banks" by default; options sourced from
 *       the {@link Props#availableBanks} list the parent passes in
 *       (same source as Account Inquiry's bank filter).</li>
 *   <li>Result radio — All / Success / Failed.</li>
 * </ul>
 *
 * <p>CLAUDE.md modal-stack: opens on top of the Sync popup (L1) so this
 * is L2. Outside-click + ESC are permitted (a side popup that's safe
 * to dismiss). Visual rhythm matches
 * {@link components/banking/account-inquiry/LatestTransactionHistoryDialog.tsx}.
 */
type BankOption = { bankCd: string; bankName: string };

type Props = {
    /** Bank list for the dropdown — typically every distinct bank the
     *  tenant has accounts at. Mirrors what the Account Inquiry bank
     *  filter shows. */
    availableBanks: BankOption[];
    /** Currency scope to send on the wire — "VND" / "FCY" / a concrete
     *  code / "ALL". Drives the popup's currency filter. */
    currency: string;
    /** Default start date in ISO `YYYY-MM-DD`. */
    startIso: string;
    /** Default end date in ISO `YYYY-MM-DD`. */
    endIso: string;
    onClose: () => void;
};

type ResultFilter = "all" | "success" | "failed";

export default function SyncHistoryDialog({
    availableBanks,
    currency,
    startIso: initialStartIso,
    endIso: initialEndIso,
    onClose,
}: Props) {
    const { t } = useTranslation();

    const [startIso, setStartIso] = useState(initialStartIso);
    const [endIso, setEndIso] = useState(initialEndIso);
    /** "" = All Banks; otherwise the legacy `BANK_CD`. */
    const [bankCd, setBankCd] = useState<string>("");
    const [resultFilter, setResultFilter] = useState<ResultFilter>("all");

    const [rows, setRows] = useState<ApiSyncHistoryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Refetch on every filter change. Plain `useEffect` is fine — the
    // popup volume is bounded by the date chips.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setErrorMessage(null);
        const fromDt = startIso.replaceAll("-", "");
        const toDt = endIso.replaceAll("-", "");
        (async () => {
            try {
                const res = await fetchSyncHistory({
                    fromDt,
                    toDt,
                    currency,
                    bankCd: bankCd || undefined,
                    result: resultFilter,
                });
                if (cancelled) return;
                setRows(res.rows ?? []);
            } catch (err) {
                if (cancelled) return;
                const msg =
                    err instanceof ApiCallError
                        ? err.message
                        : err instanceof Error
                          ? err.message
                          : t("dialog.error");
                setErrorMessage(msg);
                setRows([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [startIso, endIso, bankCd, resultFilter, currency, t]);

    // Sort bank options alphabetically by display name for the dropdown.
    // Backed by useMemo so re-renders don't reshuffle when state changes.
    const sortedBanks = useMemo(() => {
        return [...availableBanks].sort((a, b) =>
            a.bankName.localeCompare(b.bankName),
        );
    }, [availableBanks]);

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                stackLevel={2}
                className="max-w-[1100px] rounded-2xl p-0"
            >
                <div className="flex w-full flex-col p-5">
                    <DialogTitle asChild>
                        <h2 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                            {t("account_inquiry.sync.title")}
                        </h2>
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {t("sync_history.subtitle")}
                    </DialogDescription>

                    {/* ── Filter row: label + date range + bank + result ──── */}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <span className="text-wb-13 font-medium text-wb-ink">
                            {t("sync_history.title")}
                        </span>
                        <InteractiveDateRangePicker
                            startIso={startIso}
                            endIso={endIso}
                            onChange={({ start, end }) => {
                                setStartIso(start);
                                setEndIso(end);
                            }}
                            formatValue={formatDateChipNumeric}
                            separator="~"
                            portalled
                            // Anchor the dual-month popover to the
                            // calendar icon's LEFT edge so it extends
                            // rightward into the dialog's empty space.
                            // The default (right-edge anchor) pushes
                            // the popover off-screen to the left here
                            // because the icon sits in the dialog's
                            // left half.
                            expandRight
                        />

                        {/* Bank dropdown — native select for MVP. When a
                           shared <Select> primitive lands in the design
                           system, swap this for it without changing the
                           wire contract (`bankCd === ""` = All Banks). */}
                        <select
                            value={bankCd}
                            onChange={(e) => setBankCd(e.target.value)}
                            aria-label={t("sync_history.bank_all")}
                            className="h-[var(--h-wb-filter-btn)] cursor-pointer rounded-md bg-white px-2 text-wb-14-tight font-medium text-wb-ntrl-8 shadow-wb-btn outline-none"
                        >
                            <option value="">{t("sync_history.bank_all")}</option>
                            {sortedBanks.map((b) => (
                                <option key={b.bankCd} value={b.bankCd}>
                                    {b.bankName}
                                </option>
                            ))}
                        </select>

                        {/* Result radio group — All / Success / Failed.
                           Native radio inputs styled inline; matches the
                           screenshot's bullet + label layout. */}
                        <span className="ml-2 text-wb-13 font-medium text-wb-ink">
                            {t("sync_history.result")}
                        </span>
                        <ResultRadio
                            label={t("sync_history.result_all")}
                            checked={resultFilter === "all"}
                            onChange={() => setResultFilter("all")}
                        />
                        <ResultRadio
                            label={t("sync_history.result_success")}
                            checked={resultFilter === "success"}
                            onChange={() => setResultFilter("success")}
                        />
                        <ResultRadio
                            label={t("sync_history.result_failed")}
                            checked={resultFilter === "failed"}
                            onChange={() => setResultFilter("failed")}
                        />
                    </div>

                    {/* ── Table ──────────────────────────────────────── */}
                    <div className="custom-scrollbar mt-4 min-h-[300px] max-h-[480px] overflow-auto rounded-md border border-wb-border-sidebar bg-white">
                        {loading ? (
                            <div className="flex h-full min-h-[300px] items-center justify-center text-wb-13 text-wb-muted">
                                {t("common.loading")}
                            </div>
                        ) : errorMessage ? (
                            <div className="flex h-full min-h-[300px] items-center justify-center text-wb-13 font-medium text-wb-status-rejected-text">
                                {errorMessage}
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="flex h-full min-h-[300px] items-center justify-center text-wb-13 font-medium text-wb-muted">
                                {t("sync_history.empty")}
                            </div>
                        ) : (
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                                    <tr className="text-left">
                                        <Th>{t("sync_history.col.date")}</Th>
                                        <Th>{t("sync_history.col.bank")}</Th>
                                        <Th>{t("sync_history.col.account_no")}</Th>
                                        <Th>{t("sync_history.col.account_type")}</Th>
                                        <Th>{t("sync_history.col.date_range")}</Th>
                                        <Th>{t("sync_history.col.account_nickname")}</Th>
                                        <Th>{t("sync_history.col.result")}</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, i) => (
                                        <SyncHistoryRow
                                            key={`${r.ref_date}-${r.seq_no}-${i}`}
                                            row={r}
                                            t={t}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return (
        <th className="whitespace-nowrap px-3 py-2.5 text-wb-13 font-semibold text-wb-dark">
            {children}
        </th>
    );
}

function ResultRadio({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: () => void;
}) {
    return (
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-wb-13 font-medium text-wb-ink">
            <input
                type="radio"
                className="size-3.5 cursor-pointer accent-brand"
                checked={checked}
                onChange={onChange}
            />
            <span>{label}</span>
        </label>
    );
}

function SyncHistoryRow({
    row,
    t,
}: {
    row: ApiSyncHistoryRow;
    t: (key: string, vars?: Record<string, string | number>) => string;
}) {
    const success = row.rslt_cd === "00000000";
    const acctType = row.acct_type_key ? t(row.acct_type_key) : row.acct_type_nm;
    const ccyChip = row.ccy_cd ? ` (${row.ccy_cd})` : "";
    return (
        <tr className="border-t border-wb-border-sidebar hover:bg-wb-bg-sidebar/40">
            <td className="whitespace-nowrap px-3 py-2.5 text-wb-13 font-medium text-wb-ink">
                {formatRegDtm(row.reg_dtm)}
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-wb-13 font-medium text-wb-ink">
                {row.bank_nm || row.bank_cd}
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-wb-13 font-medium text-wb-ink">
                {row.acct_no}
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-wb-13 font-medium text-wb-ink">
                {acctType}
                {ccyChip}
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-wb-13 font-medium text-wb-ink">
                {formatYmd(row.start_date)} ~ {formatYmd(row.end_date)}
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-wb-13 font-medium text-wb-ink">
                {row.acct_nick_nm || "—"}
            </td>
            <td
                className={
                    "whitespace-nowrap px-3 py-2.5 text-wb-13 font-semibold " +
                    (success
                        ? "text-brand"
                        : "text-wb-status-rejected-text")
                }
                title={!success && row.err_cont ? row.err_cont : undefined}
            >
                {t(row.result_key)}
            </td>
        </tr>
    );
}

/** Format a `yyyyMMddHHmmss` audit timestamp as `dd-MM-yyyy HH:mm:ss`. */
function formatRegDtm(raw: string): string {
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(raw ?? "");
    if (!m) return raw ?? "";
    return `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}:${m[6]}`;
}

/** Format a `yyyyMMdd` date as `dd-MM-yyyy`. */
function formatYmd(raw: string): string {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(raw ?? "");
    if (!m) return raw ?? "";
    return `${m[3]}-${m[2]}-${m[1]}`;
}

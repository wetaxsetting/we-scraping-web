"use client";

import { useEffect, useRef, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { formatDateChipNumeric } from "@/components/shared/DateField";
import FilterDropdown from "@/components/shared/FilterDropdown";
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import Tooltip from "@/components/shared/Tooltip";
import { ApiCallError, fetchSyncHistory } from "@/lib/api/banking";
import type { ApiSyncHistoryRow } from "@/lib/types/api";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
 * {@link components/banking/account-inquiry/LatestTransactionHistoryModal.tsx}.
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
    const [bankOpen, setBankOpen] = useState(false);

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

    // Display order mirrors the Account Inquiry bank filter — the
    // parent passes the tenant's canonical list (the order the API
    // returns / the page caches). Sorting alphabetically here would
    // diverge from the main-page dropdown and was the source of the
    // ordering inconsistency.
    const selectedBank = availableBanks.find((b) => b.bankCd === bankCd);
    const bankTriggerValue = bankCd === "" || !selectedBank
        ? t("sync_history.bank_all")
        : selectedBank.bankName;

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                stackLevel={2}
                className="w-[1280px] max-w-[92vw] rounded-2xl p-0"
            >
                <div className="flex w-full flex-col px-6 py-6">
                    <DialogTitle asChild>
                        <h2 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                            {t("account_inquiry.sync.title")}
                        </h2>
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {t("sync_history.subtitle")}
                    </DialogDescription>

                    {/* ── Filter row: label + date range + bank + result ──── */}
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        <span className="text-wb-13 font-medium text-wb-ntrl-8">
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

                        {/* Bank dropdown — mirrors the Account Inquiry
                           filter chrome (shared <FilterDropdown> trigger +
                           sibling popover). `bankCd === ""` = All Banks
                           on the wire. */}
                        <div className="relative">
                            <FilterDropdown
                                value={bankTriggerValue}
                                onClick={() => setBankOpen((o) => !o)}
                                ariaLabel={t("sync_history.bank_all")}
                                className="w-[150px]"
                            />
                            {bankOpen && (
                                <BankDropdownPopover
                                    options={availableBanks}
                                    selected={bankCd}
                                    allLabel={t("sync_history.bank_all")}
                                    onSelect={(value) => {
                                        setBankCd(value);
                                        setBankOpen(false);
                                    }}
                                    onClose={() => setBankOpen(false)}
                                />
                            )}
                        </div>

                        {/* Result radio group — All / Success / Failed.
                           Native radio inputs styled inline; matches the
                           screenshot's bullet + label layout. */}
                        <span className="ml-2 text-wb-13 font-medium text-wb-ntrl-8">
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
                    <div className="mt-5 min-h-[300px] overflow-hidden rounded-md border border-wb-table-border bg-white">
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
                                    <tr className="border-b border-wb-table-border">
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

/** Bank dropdown option list — mirrors the Account Inquiry
 *  {@code BankFilterPopover} chrome so the two surfaces look and behave
 *  identically. Width is locked to {@code w-[150px]} matching the
 *  {@link FilterDropdown} trigger. Option order follows the parent-passed
 *  {@code options} array (no internal sort). */
function BankDropdownPopover({
    options,
    selected,
    allLabel,
    onSelect,
    onClose,
}: {
    options: BankOption[];
    selected: string;
    allLabel: string;
    onSelect: (value: string) => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLUListElement>(null);
    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [onClose]);
    return (
        <ul
            ref={ref}
            role="listbox"
            className="custom-scrollbar-y absolute left-0 top-full z-20 mt-1 max-h-64 w-[150px] overflow-y-auto overflow-x-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
        >
            <li
                role="option"
                aria-selected={selected === ""}
                onClick={() => onSelect("")}
                className={cn(
                    "cursor-pointer truncate whitespace-nowrap px-2 py-1.5 text-wb-14-tight font-medium text-wb-ntrl-8 hover:bg-wb-bg-active",
                    selected === "" && "bg-wb-bg-active",
                )}
            >
                {allLabel}
            </li>
            {options.map((b) => (
                <li
                    key={b.bankCd}
                    role="option"
                    aria-selected={selected === b.bankCd}
                    onClick={() => onSelect(b.bankCd)}
                    className={cn(
                        "cursor-pointer truncate whitespace-nowrap px-2 py-1.5 text-wb-14-tight font-medium text-wb-ntrl-8 hover:bg-wb-bg-active",
                        selected === b.bankCd && "bg-wb-bg-active",
                    )}
                >
                    {b.bankName}
                </li>
            ))}
        </ul>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return (
        <th className="whitespace-nowrap bg-wb-bg-sidebar px-3 py-3 text-left align-middle text-wb-13 font-semibold text-wb-dark">
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
        <tr className="h-[50px] border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]">
            <td className="whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink">
                {formatRegDtm(row.reg_dtm)}
            </td>
            <td className="whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink">
                {row.bank_nm || row.bank_cd}
            </td>
            <td className="whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink">
                {row.acct_no}
            </td>
            <td className="whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink">
                {acctType}
                {ccyChip}
            </td>
            <td className="whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink">
                {formatYmd(row.start_date)} ~ {formatYmd(row.end_date)}
            </td>
            <td className="whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink">
                {row.acct_nick_nm}
            </td>
            <td
                className={
                    "whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-semibold " +
                    (success
                        ? "text-brand"
                        : "text-wb-status-rejected-text")
                }
            >
                {success ? (
                    t(row.result_key)
                ) : (
                    <Tooltip
                        content={row.err_cont || t(row.result_key)}
                        placement="top"
                    >
                        {t(row.result_key)}
                    </Tooltip>
                )}
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

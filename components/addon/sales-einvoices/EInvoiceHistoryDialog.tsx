"use client";

import { useEffect, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import Tooltip from "@/components/shared/Tooltip";
import { fetchEInvoiceHistory } from "@/lib/api/addon";
import { formatDateLang, formatUtcDtmByLanguage } from "@/lib/datetime";
import { useTranslation, type Locale } from "@/lib/i18n";

/**
 * e-Invoice Latest Inquiry History popup — Sales / Expenses e-Invoice
 * "History" button entry. Mirrors the Bank Transaction Sync History
 * dialog visual contract byte-for-byte: 1280 × 92vw modal, sticky
 * Settings-style table header, Date / Type / Dates / Results columns,
 * All / Success / Fail radio filter, Tooltip on Fail rows surfacing
 * the failure reason.
 *
 * <p><strong>Wired (2026-06-03).</strong> Reads real data from
 * {@code GET /api/v1/addon/einvoices/history} (refactor port of legacy
 * {@code nxisas_einvhis_r001} — reads back {@code EXT_TRAN_CALL_HIS}).
 * Re-fetches when the date range, result filter, or variant changes;
 * the result filter (All / Success / Fail) maps to the backend
 * {@code status} param (legacy {@code STTS} 0/1).
 *
 * <p>{@code stackLevel={2}} — opens on top of the Update e-Invoice
 * Information popup (L1).
 */
type Props = {
    /** Drives the future per-variant fetch wiring. UI today is
     *  variant-agnostic; columns + filters are identical. */
    variant: "SALES" | "EXPENSE";
    /** Default start date in ISO `YYYY-MM-DD`. */
    startIso: string;
    /** Default end date in ISO `YYYY-MM-DD`. */
    endIso: string;
    onClose: () => void;
};

type ResultFilter = "all" | "success" | "fail";

type EInvoiceHistoryRow = {
    id: string;
    date: string;
    type: string;
    dates: string;
    result: "SUCCESS" | "FAIL";
    err?: string;
};

export default function EInvoiceHistoryDialog({
    variant,
    startIso: initialStartIso,
    endIso: initialEndIso,
    onClose,
}: Props) {
    const { t, locale } = useTranslation();

    const [startIso, setStartIso] = useState(initialStartIso);
    const [endIso, setEndIso] = useState(initialEndIso);
    const [resultFilter, setResultFilter] = useState<ResultFilter>("all");

    const [rows, setRows] = useState<EInvoiceHistoryRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    // Fetch on mount + whenever the date range, result filter, or
    // variant changes (legacy refetches server-side on STTS / date
    // change). Cancel-guarded so a stale response can't overwrite.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(false);
        (async () => {
            try {
                const res = await fetchEInvoiceHistory({
                    type: variant,
                    from: toYmd(startIso),
                    to: toYmd(endIso),
                    status: resultFilter === "all" ? undefined : resultFilter,
                });
                if (cancelled) return;
                setRows(
                    res.rows.map((r, i) => ({
                        id: `${r.svc_id}-${r.reg_dtm}-${i}`,
                        // REG_DTM is a UTC instant (the scrape-call audit
                        // timestamp, written `OffsetDateTime.now(UTC)`) →
                        // convert to VN local + locale date + HH:mm:ss.
                        date: fmtUtcDtm(r.reg_dtm, locale),
                        type:
                            r.type === "SALES"
                                ? t("einvoice_history.type_sales")
                                : r.type === "EXPENSE"
                                  ? t("einvoice_history.type_expenses")
                                  : r.svc_id,
                        // start/end are ISSU_DT calendar dates (date-only,
                        // zone-free) → locale-format only, no TZ shift.
                        dates: `${formatDateLang(r.start_date, locale)} ~ ${formatDateLang(r.end_date, locale)}`,
                        result: r.result,
                        err: r.err_message ?? undefined,
                    })),
                );
            } catch {
                if (!cancelled) {
                    setError(true);
                    setRows([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [variant, startIso, endIso, resultFilter, t, locale]);

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                stackLevel={2}
                className="w-[1100px] max-w-[calc(100vw-48px)] rounded-2xl p-0"
            >
                <div className="flex w-full flex-col px-6 py-6">
                    <DialogTitle asChild>
                        <h2 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                            {t("einvoice_history.title")}
                        </h2>
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {t("einvoice_history.title")}
                    </DialogDescription>

                    {/* ── Filter row: date range + result radio ───────── */}
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        {/* `portalled` escapes <DialogContent>'s
                           overflow:hidden so the calendar popups float
                           over the modal. `expandRight` anchors the
                           dual-month range popover to the chip-block's
                           LEFT edge so it extends rightward from under
                           the start chip — same anchoring the Bank
                           Sync history popup uses (Figma layout). The
                           single-date chip popovers auto-pick left vs
                           right alignment per the shared DateField
                           positioning logic. */}
                        <InteractiveDateRangePicker
                            startIso={startIso}
                            endIso={endIso}
                            onChange={({ start, end }) => {
                                setStartIso(start);
                                setEndIso(end);
                            }}
                            separator="~"
                            portalled
                            expandRight
                        />

                        <span className="ml-2 text-wb-13 font-medium text-wb-ntrl-8">
                            {t("einvoice_history.result")}
                        </span>
                        <ResultRadio
                            label={t("einvoice_history.result_all")}
                            checked={resultFilter === "all"}
                            onChange={() => setResultFilter("all")}
                        />
                        <ResultRadio
                            label={t("einvoice_history.result_success")}
                            checked={resultFilter === "success"}
                            onChange={() => setResultFilter("success")}
                        />
                        <ResultRadio
                            label={t("einvoice_history.result_fail")}
                            checked={resultFilter === "fail"}
                            onChange={() => setResultFilter("fail")}
                        />
                    </div>

                    {/* ── Table ──────────────────────────────────────── */}
                    <div className="mt-5 min-h-[300px] overflow-hidden rounded-md border border-wb-table-border bg-white">
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                                <tr className="border-b border-wb-table-border">
                                    <Th>{t("einvoice_history.col.date")}</Th>
                                    <Th>{t("einvoice_history.col.type")}</Th>
                                    <Th>{t("einvoice_history.col.dates")}</Th>
                                    <Th>{t("einvoice_history.col.results")}</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="h-[260px] text-center align-middle text-wb-13 font-medium text-wb-muted"
                                        >
                                            {t("einvoice_history.loading")}
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="h-[260px] text-center align-middle text-wb-13 font-medium text-wb-status-rejected-text"
                                        >
                                            {t("einvoice_history.load_error")}
                                        </td>
                                    </tr>
                                ) : rows.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="h-[260px] text-center align-middle text-wb-13 font-medium text-wb-muted"
                                        >
                                            {t("einvoice_history.empty")}
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((r) => (
                                        <EInvoiceHistoryRowComp
                                            key={r.id}
                                            row={r}
                                            t={t}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/** ISO `YYYY-MM-DD` → `YYYYMMDD` for the wire. */
function toYmd(iso: string): string {
    return iso.replace(/-/g, "");
}

/**
 * Format a UTC `yyyyMMddHHmmss` instant as a locale-aware
 * `<date> <HH:mm:ss>` in Vietnam local time. Used for the scrape-call
 * REG_DTM audit timestamp (a coherent UTC instant). Falls back to the
 * date alone when there is no time component.
 */
function fmtUtcDtm(s: string | null | undefined, locale: Locale): string {
    const { date, time } = formatUtcDtmByLanguage(s, locale);
    if (!date) return s?.trim() ?? "";
    return time ? `${date} ${time}` : date;
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

function EInvoiceHistoryRowComp({
    row,
    t,
}: {
    row: EInvoiceHistoryRow;
    t: (key: string, vars?: Record<string, string | number>) => string;
}) {
    const success = row.result === "SUCCESS";
    const resultLabel = success
        ? t("einvoice_history.result_success")
        : t("einvoice_history.result_fail");
    return (
        <tr className="h-[50px] border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]">
            <td className="whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink">
                {row.date}
            </td>
            <td className="whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink">
                {row.type}
            </td>
            <td className="whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink">
                {row.dates}
            </td>
            <td
                className={
                    "whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-semibold " +
                    (success ? "text-brand" : "text-wb-status-rejected-text")
                }
            >
                {success ? (
                    resultLabel
                ) : (
                    <Tooltip content={row.err || resultLabel} placement="top">
                        {resultLabel}
                    </Tooltip>
                )}
            </td>
        </tr>
    );
}

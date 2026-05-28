"use client";

import { useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { formatDateChipNumeric } from "@/components/shared/DateField";
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import Tooltip from "@/components/shared/Tooltip";
import { useTranslation } from "@/lib/i18n";

/**
 * e-Invoice Latest Inquiry History popup — Sales / Expenses e-Invoice
 * "History" button entry. Mirrors the Bank Transaction Sync History
 * dialog visual contract byte-for-byte: 1280 × 92vw modal, sticky
 * Settings-style table header, Date / Type / Dates / Results columns,
 * All / Success / Fail radio filter, Tooltip on Fail rows surfacing
 * the failure reason.
 *
 * <p><strong>Static UI.</strong> No backend endpoint exists for
 * e-Invoice inquiry history in {@code wecms-api} yet — rows render
 * as the empty state until the API lands. Date range + result-filter
 * state live local to the dialog so the chrome is identical to the
 * Bank Sync popup; swapping the static {@code rows} array for a
 * real fetch + filter pipeline (mirroring SyncHistoryDialog) is the
 * only step left when the endpoint arrives.
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
    startIso: initialStartIso,
    endIso: initialEndIso,
    onClose,
}: Props) {
    const { t } = useTranslation();

    const [startIso, setStartIso] = useState(initialStartIso);
    const [endIso, setEndIso] = useState(initialEndIso);
    const [resultFilter, setResultFilter] = useState<ResultFilter>("all");

    // Static UI seed — empty list mirrors the live "no data scraped
    // yet" path. When the API endpoint lands, swap this for the
    // useEffect + fetch + cancel pattern from SyncHistoryDialog.
    const rows: EInvoiceHistoryRow[] = [];

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
                            formatValue={formatDateChipNumeric}
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
                                {rows.length === 0 ? (
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

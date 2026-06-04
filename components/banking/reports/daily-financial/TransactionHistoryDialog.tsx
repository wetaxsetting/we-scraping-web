"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { PAGE_SIZE_OPTIONS } from "@/components/shared/Pagination";
import { fetchDailyFinancialTransactions } from "@/lib/api/banking";
import { mapDailyFinancialTransactionsResponse } from "@/lib/api/mappers";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { CurrentAccountRow, TxHistoryResponse } from "./types";

// Format yyyyMMdd -> yyyy-MM-dd for the As-of header chip. Falls back to
// the raw value when the shape does not match.
function formatAsOf(iso: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(iso);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : iso;
}

// Format HHmmss (legacy wire) -> HH:mm:ss for the Time column.
function formatTime(raw: string): string {
    if (!raw) return "";
    if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
    const m = /^(\d{2})(\d{2})(\d{2})$/.exec(raw);
    return m ? `${m[1]}:${m[2]}:${m[3]}` : raw;
}

type Props = {
    account: CurrentAccountRow;
    asOfIsoDate: string;
    includeInternalTransfers: boolean;
    onClose: () => void;
};

// Daily Financial Transaction History Details popup. UI follows the
// e-Invoice Latest Inquiry History popup. API + business logic unchanged.
export default function TransactionHistoryDialog({
    account,
    asOfIsoDate,
    includeInternalTransfers,
    onClose,
}: Props) {
    const { t } = useTranslation();
    const [data, setData] = useState<TxHistoryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]); // default 10
    const [page, setPage] = useState(1);

    const asOfWire = asOfIsoDate.replaceAll("-", "");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const wire = await fetchDailyFinancialTransactions({
                    asOf: asOfWire,
                    bankCd: account.bankCd,
                    acctNo: account.accountNo,
                    includeInternalTransfers,
                    page,
                    size: pageSize,
                });
                if (cancelled) return;
                setData(mapDailyFinancialTransactionsResponse(wire));
            } catch {
                if (!cancelled) {
                    setData({
                        totalCount: 0,
                        totalIn: "0",
                        totalOut: "0",
                        closingBalance: "0",
                        pageNo: page,
                        pageSize,
                        rows: [],
                    });
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [asOfWire, account.bankCd, account.accountNo, includeInternalTransfers, page, pageSize]);

    const totalCount = data?.totalCount ?? 0;
    const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
    const rows = data?.rows ?? [];

    const summary = t("report.daily_financial.tx_dialog.summary", {
        count: String(totalCount),
        debit: formatAmount(data?.totalOut ?? "0", account.currency, true),
        credit: formatAmount(data?.totalIn ?? "0", account.currency, true),
        balance: formatAmount(data?.closingBalance ?? "0", account.currency, true),
    });

    return (
        <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent
                stackLevel={2}
                className="w-[1024px] max-w-[92vw] rounded-2xl p-0"
            >
                <div className="flex w-full flex-col px-6 py-6">
                    <DialogTitle asChild>
                        <h2 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                            {t("report.daily_financial.tx_dialog.title")}
                        </h2>
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {t("report.daily_financial.tx_dialog.title")}
                    </DialogDescription>

                    {/* Header info row - As of / Bank/Account No. / Currency. */}
                    <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-2">
                        <InfoPair
                            label={t("report.as_of")}
                            value={formatAsOf(asOfIsoDate)}
                        />
                        <InfoPair
                            label={t("report.daily_financial.tx_dialog.bank_account")}
                            value={`${account.bank} / ${account.accountNo}`}
                        />
                        <InfoPair
                            label={t("report.daily_financial.col.currency")}
                            value={account.currency}
                        />
                    </div>

                    {/* Table - e-Invoice bordered box + sticky sidebar header. */}
                    <div className="mt-5 min-h-[300px] overflow-hidden rounded-md border border-wb-table-border bg-white">
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                                <tr className="border-b border-wb-table-border">
                                    <Th>{t("report.daily_financial.tx_dialog.col.time")}</Th>
                                    <Th align="right">{t("report.daily_financial.tx_dialog.col.debit")}</Th>
                                    <Th align="right">{t("report.daily_financial.tx_dialog.col.credit")}</Th>
                                    <Th align="right">{t("report.daily_financial.tx_dialog.col.balance")}</Th>
                                    <Th>{t("report.daily_financial.tx_dialog.col.remarks")}</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <EmptyRow>{t("common.loading")}</EmptyRow>
                                ) : rows.length === 0 ? (
                                    <EmptyRow>{t("report.daily_financial.tx_dialog.empty")}</EmptyRow>
                                ) : (
                                    rows.map((r, i) => {
                                        const isDebit = r.inOutDiv === "2";
                                        const isCredit = r.inOutDiv === "1";
                                        return (
                                            <tr
                                                key={`${r.transactionTime}-${i}`}
                                                className="h-[50px] border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]"
                                            >
                                                <Td>{formatTime(r.transactionTime)}</Td>
                                                <Td align="right">
                                                    {isDebit ? formatAmount(r.amount, account.currency, false) : ""}
                                                </Td>
                                                <Td align="right">
                                                    {isCredit ? formatAmount(r.amount, account.currency, false) : ""}
                                                </Td>
                                                <Td align="right">
                                                    {formatAmount(r.balanceAfter, account.currency, false)}
                                                </Td>
                                                <Td>{r.remark || ""}</Td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer - left: page-size / center: pagination / right: summary. */}
                    <div className="mt-4 flex items-center justify-between gap-4">
                        <PageSizeSelect
                            value={pageSize}
                            options={PAGE_SIZE_OPTIONS}
                            onSelect={(size) => {
                                setPageSize(size);
                                setPage(1);
                            }}
                        />

                        <div className="flex items-center gap-2.5">
                            {pageCount > 1 && (
                                <>
                                    <NavBtn
                                        aria-label="Previous page"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    >
                                        <ChevronLeft className="size-4" />
                                    </NavBtn>
                                    <span className="min-w-[64px] text-center text-wb-13 font-medium text-wb-ink">
                                        {page} / {pageCount}
                                    </span>
                                    <NavBtn
                                        aria-label="Next page"
                                        disabled={page >= pageCount}
                                        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                                    >
                                        <ChevronRight className="size-4" />
                                    </NavBtn>
                                </>
                            )}
                        </div>

                        <div className="whitespace-nowrap text-right text-wb-13 font-medium text-wb-ink">
                            {summary}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Header label/value pair - mirrors the e-Invoice popup label/value style.
function InfoPair({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-wb-13 font-medium text-wb-ntrl-8">{label}</span>
            <span className="text-wb-13 font-semibold text-wb-dark">{value}</span>
        </div>
    );
}

// Table header cell - e-Invoice Th style + optional right alignment.
function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
    return (
        <th
            className={cn(
                "whitespace-nowrap bg-wb-bg-sidebar px-3 py-3 align-middle text-wb-13 font-semibold text-wb-dark",
                align === "right" ? "text-right" : "text-left",
            )}
        >
            {children}
        </th>
    );
}

// Table body cell - e-Invoice row-cell style + optional right alignment.
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
    return (
        <td
            className={cn(
                "whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink",
                align === "right" ? "text-right" : "text-left",
            )}
        >
            {children}
        </td>
    );
}

// Empty / loading state - a real row spanning all columns, centered, with a
// fixed height so the modal does not collapse.
function EmptyRow({ children }: { children: React.ReactNode }) {
    return (
        <tr>
            <td
                colSpan={5}
                className="h-[260px] text-center align-middle text-wb-13 font-medium text-wb-muted"
            >
                {children}
            </td>
        </tr>
    );
}

// Page-size dropdown - shared Pagination dropdown visual, opens UPWARD
// (bottom-full) so the list never overflows below the modal footer.
function PageSizeSelect({
    value,
    options,
    onSelect,
}: {
    value: number;
    options: readonly number[];
    onSelect: (size: number) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex h-8 w-20 cursor-pointer items-center gap-2 overflow-clip rounded-md border border-wb-ntrl-4 bg-white px-2"
            >
                <span className="flex-1 truncate text-left text-wb-13 font-medium text-wb-ink">
                    {value}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/assets/pagination/ico-dropdown-chevron.svg"
                    alt=""
                    aria-hidden
                    className="size-4 shrink-0"
                />
            </button>
            {open && (
                <ul
                    className="absolute bottom-full left-0 z-20 mb-1 min-w-full overflow-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
                    role="listbox"
                >
                    {options.map((opt) => (
                        <li
                            key={opt}
                            role="option"
                            aria-selected={opt === value}
                            className={cn(
                                "cursor-pointer px-2 py-1.5 text-wb-13 font-medium text-wb-ink hover:bg-wb-bg-active",
                                opt === value && "bg-wb-bg-active",
                            )}
                            onClick={() => {
                                onSelect(opt);
                                setOpen(false);
                            }}
                        >
                            {opt}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// Pagination nav button - matches the shared Pagination ArrowBtn style.
function NavBtn({
    children,
    disabled = false,
    onClick,
    "aria-label": ariaLabel,
}: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    "aria-label"?: string;
}) {
    return (
        <button
            type="button"
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "flex size-7 items-center justify-center rounded-md border border-wb-ntrl-4 bg-white text-wb-ink hover:bg-neutral-50",
                !disabled && "cursor-pointer",
                disabled && "cursor-not-allowed opacity-40 hover:bg-white",
            )}
        >
            {children}
        </button>
    );
}

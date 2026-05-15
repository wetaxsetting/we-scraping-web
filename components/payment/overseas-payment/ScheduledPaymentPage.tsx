"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import PaymentScheduledBatchListPage from "@/components/payment/shared/PaymentScheduledBatchListPage";
import DateRangeFilter, { type DateRangeFilterValue } from "@/components/shared/DateRangeFilter";
import FilterDropdown from "@/components/shared/FilterDropdown";
import { fetchOverseasScheduledList, type ApiOverseasScheduledRow } from "@/lib/api/payment";
import { useApiData } from "@/lib/api/useApiData";
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { type OverseasScheduledRow } from "./types";
import OverseasExcelUploadModal from "./OverseasExcelUploadModal";

function todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function offsetDaysIso(iso: string, days: number): string {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Helper to format YYYYMMDDHHmmss to "DD-MM-YYYY\nHH:mm:ss"
function formatApiDateTime(dtm: string) {
    if (!dtm || dtm.length < 14) return dtm;
    const date = `${dtm.slice(6, 8)}-${dtm.slice(4, 6)}-${dtm.slice(0, 4)}`;
    const time = `${dtm.slice(8, 10)}:${dtm.slice(10, 12)}:${dtm.slice(12, 14)}`;
    return `${date}\n${time}`;
}

// Helper to format YYYYMMDD to "DD-MM-YYYY"
function formatApiDate(dt: string) {
    if (!dt || dt.length < 8) return dt;
    return `${dt.slice(6, 8)}-${dt.slice(4, 6)}-${dt.slice(0, 4)}`;
}

function mapApiRow(api: ApiOverseasScheduledRow): OverseasScheduledRow {
    return {
        id: api.ovrs_pymn_no,
        dateTime: formatApiDateTime(api.reg_dtm),
        fileName: api.file_nm || api.bnfc_nm || "-",
        txnCount: api.tot_trns_cnt,
        txnCurrency: api.ccy_cd,
        totalAmount: api.total_tran_amt.toString(),
        status: api.appr_stts === "APPROVED" ? "approved" : "pending",
        statusStep: "Step 1",
        requestor: api.draft_user_nm || api.reg_id || "-",
        approver: "-",
        approvalRef: api.doc_no || "-",
        approvalTitle: api.titl || "-",
        action: "transfer",
        scheduleDate: formatApiDate(api.pay_date),
    };
}

const STATUS_OPTIONS = [
    { value: "APPROVED", labelKey: "payment.status.approved" },
    { value: "PENDING", labelKey: "payment.status.pending" },
    { value: "REJECTED", labelKey: "payment.status.rejected" },
];

export default function OverseasScheduledPaymentPage() {
    const { t } = useTranslation();

    // 1. State
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    
    const [dateRange, setDateRange] = useState<DateRangeFilterValue>({
        mode: "manual",
        preset: "last_30_days",
        start: offsetDaysIso(todayIso(), -30),
        end: todayIso(),
    });

    const [statusOpen, setStatusOpen] = useState(false);
    const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // 2. Fetch
    const { data } = useApiData(
        () => fetchOverseasScheduledList({
            from_dt: dateRange.start.replace(/-/g, ""),
            to_dt: dateRange.end.replace(/-/g, ""),
            appr_type_cd: selectedStatuses.size > 0 ? Array.from(selectedStatuses) : undefined,
            keyword: search || undefined,
            page: page - 1,
            size: pageSize,
        }),
        [dateRange.start, dateRange.end, selectedStatuses, search, page, pageSize, refreshKey]
    );

    // 3. Mapping
    const displayRows = data && data.rows ? data.rows.map(mapApiRow) : [];
    const displayTotals = data && data.totals ? data.totals.map((tot) => ({
        currency: tot.ccy_cd,
        amount: tot.total_tran_amt.toString(),
    })) : [];

    const totalCount = data?.total_count || 0;
    const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

    // 4. Handlers
    const handleDateRangeChange = (val: DateRangeFilterValue) => {
        // Automatically compute preset dates to maintain consistency
        let nextStart = val.start;
        const nextEnd = todayIso();
        if (val.mode === "preset") {
            if (val.preset === "last_30_days") nextStart = offsetDaysIso(nextEnd, -30);
            if (val.preset === "last_90_days") nextStart = offsetDaysIso(nextEnd, -90);
            if (val.preset === "last_180_days") nextStart = offsetDaysIso(nextEnd, -180);
        }
        setDateRange({ ...val, start: nextStart, end: nextEnd });
        setPage(1);
    };

    const toggleStatus = (val: string) => {
        setSelectedStatuses((prev) => {
            const next = new Set(prev);
            if (next.has(val)) next.delete(val);
            else next.add(val);
            return next;
        });
        setPage(1);
    };

    // 5. Render
    const statusLabel = selectedStatuses.size === 0
        ? t("payment.internal.filter.all_status")
        : t("common.selected_count", { count: String(selectedStatuses.size) });

    return (
        <>
            <PaymentScheduledBatchListPage<OverseasScheduledRow>
                title={t("payment.overseas.scheduled_title")}
                rows={displayRows}
                rowDetailHref={(row) => `/payment/overseas-payment/scheduled-payment/${row.id}`}
                tableMinWidth="var(--w-wb-st-table-min-overseas)"
                extraColumn={{
                    key: "scheduleDate",
                    label: t("payment.internal.col.schedule_date"),
                    width: "var(--w-wb-st-schedule-date)",
                    render: (row) => (
                        <span className="block truncate text-wb-13 font-medium text-wb-ink">
                            {row.scheduleDate}
                        </span>
                    ),
                }}
                totals={displayTotals}
                // Controlled props
                search={search}
                onSearchChange={(v) => { setSearch(v); setPage(1); }}
                page={page}
                pageCount={pageCount}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                onExcelUpload={() => setIsUploadModalOpen(true)}
                onRequestApproval={() => { /* Placeholder for batch action */ }}
                toolbarFilters={
                    <>
                        {dateRange.mode === "manual" ? (
                            <InteractiveDateRangePicker
                                startIso={dateRange.start}
                                endIso={dateRange.end}
                                onChange={(range) =>
                                    handleDateRangeChange({
                                        ...dateRange,
                                        mode: "manual",
                                        start: range.start,
                                        end: range.end,
                                    })
                                }
                            />
                        ) : (
                            <DateRangeFilter
                                value={dateRange}
                                onChange={handleDateRangeChange}
                                presetClassName="w-[160px]"
                            />
                        )}
                        <div className="relative">
                            <FilterDropdown
                                label={statusLabel}
                                onClick={() => setStatusOpen((o) => !o)}
                                className="w-[160px]"
                            />
                            {statusOpen && (
                                <StatusFilterPopover
                                    selected={selectedStatuses}
                                    onToggle={toggleStatus}
                                    onClose={() => setStatusOpen(false)}
                                />
                            )}
                        </div>
                    </>
                }
            />

            {isUploadModalOpen && (
                <OverseasExcelUploadModal
                    onClose={() => setIsUploadModalOpen(false)}
                    onSaved={() => {
                        setIsUploadModalOpen(false);
                        setRefreshKey((k) => k + 1);
                    }}
                />
            )}
        </>
    );
}

function StatusFilterPopover({
    selected,
    onToggle,
    onClose,
}: {
    selected: Set<string>;
    onToggle: (val: string) => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const ref = useRef<HTMLUListElement>(null);

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [onClose]);

    return (
        <ul
            ref={ref}
            role="listbox"
            className="custom-scrollbar-y absolute left-0 top-full z-20 mt-1 max-h-64 w-[160px] overflow-y-auto overflow-x-hidden rounded-md border border-wb-ntrl-4 bg-white py-1 shadow-wb-card"
        >
            {STATUS_OPTIONS.map((opt) => {
                const checked = selected.has(opt.value);
                return (
                    <li
                        key={opt.value}
                        role="option"
                        aria-selected={checked}
                        onClick={() => onToggle(opt.value)}
                        className="flex cursor-pointer items-center justify-between px-3 py-1.5 text-wb-13 font-medium text-wb-ink hover:bg-wb-bg-active"
                    >
                        <span className="truncate">{t(opt.labelKey)}</span>
                        {checked && <Check className="size-4 shrink-0 text-brand" strokeWidth={2} />}
                    </li>
                );
            })}
        </ul>
    );
}

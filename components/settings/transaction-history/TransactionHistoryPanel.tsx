"use client";

import { useMemo, useState } from "react";

import { type DateRangeFilterValue } from "@/components/shared/DateRangeFilter";
import Pagination, { usePagination } from "@/components/shared/Pagination";
import { useTranslation } from "@/lib/i18n";

import TransactionHistoryFilters, {
    type TransactionTypeOption,
} from "./TransactionHistoryFilters";
import TransactionHistoryTable from "./TransactionHistoryTable";
import TransactionHistoryTabs from "./TransactionHistoryTabs";
import { MOCK_TAB_COUNTS, mockTransactionHistoryRows } from "./mockData";
import type { TransactionHistoryTabKey } from "./types";

/**
 * ERP Transaction History panel — Figma 134:16546 (Settings popup submenu).
 *
 * Layout (top → bottom, all inside the modal's right column):
 *   [Header]      — title + description (shrink-0); pr-24 clears the shell's Esc/X
 *   [Tabs]        — All / WeCMS → ERP / ERP → WeCMS / Deleted
 *   [Filters]     — date-range filter (preset / manual) + transaction type + Search
 *   [Table]       — ONLY this region scrolls (vertical + horizontal as needed)
 *   [Pagination]  — fixed at the bottom, OUTSIDE the scroll container
 *
 * `min-h-0` on the scroll cell is what lets the flex child shrink instead
 * of pushing the pagination off the modal — same shape as
 * <FirmBankingHistoryPanel>.
 *
 * The panel ships static UI: filters/tabs/pagination are wired to local
 * state so the controls feel live, but rows come from
 * mockTransactionHistoryRows. The legacy
 * /api/v1/settings/erp-transaction-history call slots in here once the
 * backend lands — the row shape already matches the expected
 * UPPER_SNAKE → camelCase mapping.
 */
export default function TransactionHistoryPanel() {
    const { t } = useTranslation();

    const [activeTab, setActiveTab] = useState<TransactionHistoryTabKey>("deleted");
    // Date-range state owns mode (preset | manual), the active preset, and
    // the manual ISO range seed. Same shape every page using the shared
    // <DateRangeFilter> follows; the parent decides how to translate
    // `preset` into a real date window when filtering data.
    const [dateRange, setDateRange] = useState<DateRangeFilterValue>({
        mode: "preset",
        preset: "last_30_days",
        start: "2025-01-05",
        end: "2025-01-30",
    });
    const [transactionType, setTransactionType] =
        useState<TransactionTypeOption>("all");
    const [keyword, setKeyword] = useState("");

    const filteredRows = useMemo(() => {
        return mockTransactionHistoryRows.filter((row) => {
            if (activeTab !== "all" && row.type !== activeTab) return false;
            if (
                transactionType !== "all" &&
                row.transactionType !== transactionType
            ) {
                return false;
            }
            const q = keyword.trim().toLowerCase();
            if (q) {
                const haystack = `${row.fileName} ${row.user}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [activeTab, transactionType, keyword]);

    const pagination = usePagination({ items: filteredRows, initialPageSize: 10 });

    // Surface the Figma "10 of 30" footer when the dataset is unfiltered;
    // once the user narrows the list, fall back to the actual filtered
    // count. Replace with the API's `TOTAL_CNT` field when wired.
    const isUnfiltered =
        transactionType === "all" && keyword.trim() === "";
    const total = isUnfiltered
        ? MOCK_TAB_COUNTS[activeTab]
        : filteredRows.length;
    const shown = Math.min(pagination.pageSize, filteredRows.length);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — pr-24 keeps clear of the shell's Esc/X affordance. */}
            <div className="flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-14 pr-24">
                <div className="min-w-0">
                    <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("settings.transaction_history.title")}
                    </h3>
                    <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                        {t("settings.transaction_history.description")}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="shrink-0 px-8">
                <TransactionHistoryTabs
                    active={activeTab}
                    counts={MOCK_TAB_COUNTS}
                    onChange={(key) => {
                        setActiveTab(key);
                        pagination.resetPage();
                    }}
                />
            </div>

            {/* Filters */}
            <div className="shrink-0 px-8 pb-3 pt-3">
                <TransactionHistoryFilters
                    dateRange={dateRange}
                    onDateRangeChange={(value) => {
                        setDateRange(value);
                        pagination.resetPage();
                    }}
                    transactionType={transactionType}
                    onTransactionTypeChange={(value) => {
                        setTransactionType(value);
                        pagination.resetPage();
                    }}
                    keyword={keyword}
                    onKeywordChange={(value) => {
                        setKeyword(value);
                        pagination.resetPage();
                    }}
                />
            </div>

            {/* Scroll region — table body scrolls; header is sticky inside. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8">
                <div className="custom-scrollbar h-full overflow-auto">
                    <TransactionHistoryTable rows={pagination.paged} />
                </div>
            </div>

            {/* Pagination — pinned below the scroll region. No top border:
               the Figma frame keeps the modal flat with only table row
               separators (CLAUDE.md → Settings popup). */}
            <div className="shrink-0 px-8 py-3">
                <Pagination
                    page={pagination.page}
                    pageCount={Math.max(1, Math.ceil(total / pagination.pageSize))}
                    pageSize={pagination.pageSize}
                    totalLabel={t("common.showing_of", {
                        shown: String(shown),
                        total: String(total),
                    })}
                    onPageChange={pagination.setPage}
                    onPageSizeChange={pagination.setPageSize}
                />
            </div>
        </div>
    );
}

"use client";

import { useMemo } from "react";

import DataTableShell from "@/components/shared/DataTableShell";
import FilterRow from "@/components/shared/FilterRow";
import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import PageHeader from "@/components/shared/PageHeader";
import type { SortDirection } from "@/hooks/useTableSort";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import TransferHistoryTable from "./TransferHistoryTable";
import TransferHistoryTableFooter from "./TransferHistoryTableFooter";
import type {
    TransferHistoryTotal,
    TransferRow,
    TransferStatus,
} from "./types";

/** Status sentinel emitted by the radio group → fed to the wire. The
 *  controller's `@Pattern` enforces `""` (all), `"00000000"` (success),
 *  `"99999999"` (failed). */
export type TransferHistoryStatusFilter = "" | "00000000" | "99999999";

/** Visible status radio. Maps 1:1 to the wire sentinel for the API call. */
export type StatusRadio = "all" | TransferStatus;

const STATUS_RADIOS: ReadonlyArray<StatusRadio> = ["all", "success", "failed"];

/** Wire-style sentinel for the radio's UI value. Source-of-truth for the
 *  bidirectional mapping the client wraps in `setStatusFilter`. */
export function radioToWire(radio: StatusRadio): TransferHistoryStatusFilter {
    if (radio === "success") return "00000000";
    if (radio === "failed")  return "99999999";
    return "";
}

type TransferHistoryPageProps = {
    /** Loaded rows for the current page. Empty array while loading / on error. */
    rows?: TransferRow[];
    /** Footer totals for the *full* filter scope — backend pre-aggregates
     *  so paging never narrows the footer figure. */
    total?: TransferHistoryTotal;

    /** ISO `YYYY-MM-DD` date range driving the API filter. */
    startIsoDate: string;
    endIsoDate:   string;
    onDateRangeChange: (range: { start: string; end: string }) => void;

    /** Currently-active radio. Defaults to "all". */
    statusRadio: StatusRadio;
    onStatusRadioChange: (radio: StatusRadio) => void;

    /** 1-based current page + selected page size + total rows in scope. */
    pageNo:     number;
    pageSize:   number;
    totalCount: number;
    onPageChange:     (pageNo: number) => void;
    onPageSizeChange: (pageSize: number) => void;

    /** Common-sort state from `useTableSort()` — `FIELD_ID` driving the
     *  current sort + direction + a click toggler. `null` field means
     *  the backend's default ORDER BY (legacy `REG_DTM DESC`). */
    sortField: string | null;
    sortDirection: SortDirection;
    onSort: (fieldId: string) => void;

    /** Loading / error chrome. Loading shows the body skeleton; the error
     *  banner replaces the table content (legacy parity — the banner
     *  surfaces the trace_id so the user can quote it to support). */
    loading: boolean;
    errorMessage?: string | null;
    errorCode?:    string | null;
};

const EMPTY_ROWS: TransferRow[] = [];
const EMPTY_TOTAL: TransferHistoryTotal = {
    currency: "VND",
    count: 0,
    total: "0",
};

export default function TransferHistoryPage(props: TransferHistoryPageProps) {
    const { t } = useTranslation();
    const {
        rows: rowsProp,
        total: totalProp,
        startIsoDate,
        endIsoDate,
        onDateRangeChange,
        statusRadio,
        onStatusRadioChange,
        pageNo,
        pageSize,
        totalCount,
        onPageChange,
        onPageSizeChange,
        sortField,
        sortDirection,
        onSort,
        loading,
        errorMessage,
        errorCode,
    } = props;

    const sourceRows = rowsProp ?? EMPTY_ROWS;
    const sourceTotal = totalProp ?? EMPTY_TOTAL;

    // Footer total count reflects the FULL filter scope (backend pre-
    // aggregates) — the legacy footer renders `${TOT_CNT} Transaction(s)`
    // not `${rows_on_page}`, so we surface `totalCount` here. The amount
    // and currency come from the totals payload.
    const totals = useMemo(
        () => ({
            ...sourceTotal,
            count: totalCount,
        }),
        [sourceTotal, totalCount],
    );

    const pageCount = Math.max(1, Math.ceil(Math.max(totalCount, 1) / pageSize));

    return (
        <PageLayout>
            {/*
              Transfer History intentionally renders no toolbar (list /
              print / export icons). Mirrors live JEX
              `https://test.wecms.vn/trns_0003_001.act` and resolves OQs
              from `docs/refactor-wecms/features/transfer-history.md`:
                §8.4 / OQ-5 — no View Setting popover (no list icon).
                §10  / OQ-7 — no Excel export in this MR.
                          — JEX page also has no print button.
              Adding the toolbar back is a deliberate scope-expansion
              decision and would need a fresh PO sign-off.
            */}
            <PageHeader title={t("transfer_history.title")} />

            <FilterRow>
                <InteractiveDateRangePicker
                    startIso={startIsoDate}
                    endIso={endIsoDate}
                    onChange={onDateRangeChange}
                />
                <div className="ml-2 flex flex-wrap items-center gap-4">
                    {STATUS_RADIOS.map((key) => (
                        <RadioButton
                            key={key}
                            active={statusRadio === key}
                            label={t(`transfer_history.filter.${key}`)}
                            onClick={() => onStatusRadioChange(key)}
                        />
                    ))}
                </div>
            </FilterRow>

            {errorMessage ? (
                <ErrorBanner
                    title={t("transfer_history.error.title")}
                    message={errorMessage}
                    code={errorCode ?? undefined}
                />
            ) : null}

            <DataTableShell
                footerMode="paginationWithTotals"
                table={
                    // VAS Account empty-state pattern
                    // (`components/settings/vas-account/VasAccountPanel.tsx`
                    // §216-226) — render the table chrome (colgroup +
                    // sticky header + empty tbody) always, and surface a
                    // single sibling flex-1 div BELOW the table that
                    // shows either the loading copy or the empty copy.
                    // Mirrors the live JEX behaviour at
                    // https://test.wecms.vn/trns_0003_001.act — column
                    // headers never disappear; the body region just shows
                    // a centred text label instead of skeleton bars.
                    <>
                        <TransferHistoryTable
                            rows={loading ? EMPTY_ROWS : sourceRows}
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={onSort}
                        />
                        {loading || sourceRows.length === 0 ? (
                            <div className="flex flex-1 items-center justify-center px-3 py-12 text-wb-13 font-medium text-wb-ntrl-6">
                                {loading
                                    ? t("transfer_history.loading")
                                    : errorMessage
                                        ? t("transfer_history.empty.after_error")
                                        : t("transfer_history.empty.default")}
                            </div>
                        ) : null}
                    </>
                }
                footer={
                    <TransferHistoryTableFooter
                        totals={totals}
                        className="mt-auto"
                    />
                }
                pagination={
                    <Pagination
                        page={pageNo}
                        pageCount={pageCount}
                        pageSize={pageSize}
                        totalLabel={t("common.showing_of", {
                            shown: String(sourceRows.length),
                            total: String(totalCount),
                        })}
                        onPageChange={onPageChange}
                        onPageSizeChange={onPageSizeChange}
                        className="shrink-0"
                    />
                }
            />
        </PageLayout>
    );
}

/* ---------------------------------------------------------------
 *  Internal presentational helpers
 * --------------------------------------------------------------- */

function RadioButton({
    active,
    label,
    onClick,
}: {
    active: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className="flex cursor-pointer items-center gap-2.5"
        >
            <span
                className={cn(
                    "relative flex size-[18px] shrink-0 items-center justify-center rounded-full border bg-white",
                    active ? "border-brand" : "border-wb-ntrl-4",
                )}
            >
                {active && <span className="size-2 rounded-full bg-brand" />}
            </span>
            <span className="text-wb-13 font-medium text-wb-ntrl-8">
                {label}
            </span>
        </button>
    );
}

/** Typed error banner — surfaces the localized message + the error
 *  `code` so the user can quote it back to support. Distinct from the
 *  global system-error dialog because this is non-blocking and
 *  in-context (matches the legacy `data.error.title` inline strip on
 *  the table). */
function ErrorBanner({
    title,
    message,
    code,
}: {
    title: string;
    message: string;
    code?: string;
}) {
    return (
        <div
            role="alert"
            className="my-2 flex items-start gap-3 rounded-md border border-wb-status-rejected-bg bg-wb-status-rejected-bg/40 px-3 py-2"
        >
            <span aria-hidden className="mt-0.5 size-2 shrink-0 rounded-full bg-wb-status-rejected-text" />
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-wb-13 font-semibold text-wb-status-rejected-text">
                    {title}
                </span>
                <span className="text-wb-13 font-normal text-wb-status-rejected-text">
                    {message}
                    {code ? (
                        <span className="ml-2 text-wb-11 font-normal text-wb-muted">
                            ({code})
                        </span>
                    ) : null}
                </span>
            </div>
        </div>
    );
}

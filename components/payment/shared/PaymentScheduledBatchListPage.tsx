"use client";

import { Check, ChevronDown, FileText, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import StatusBadge from "@/components/payment/approval-box/StatusBadge";
import type { ApprovalStatus } from "@/components/payment/approval-box/types";
import PaymentBatchTableFooter, {
    mergeBatchTotals,
    placeBatchFooterCells,
} from "@/components/payment/shared/PaymentBatchTableFooter";
import TableEmptyState from "@/components/payment/shared/TableEmptyState";
import DateRangeFilter, {
    type DateRangeFilterPreset,
    type DateRangeFilterValue,
} from "@/components/shared/DateRangeFilter";
import {
    ApproverPopoverCell,
    normalizeApproverStatus,
    type ApproverChainEntry,
} from "@/components/shared/approver";
import DataTableShell from "@/components/shared/DataTableShell";
import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import DownloadIcon from "@/components/shared/icons/DownloadIcon";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import {
    parseViewSettingPxSize,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { Checkbox } from "@/components/ui/checkbox";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { isProductType } from "@/lib/auth/client";
import { userStorage } from "@/lib/auth/storage";
import { formatAmount } from "@/lib/currency";
import { formatIsoDateByLanguage, formatUtcDtmByLanguage } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Common batch-file Scheduled row contract — every Payment module's
 * Scheduled list row satisfies this shape. Internal Transfer is the
 * canonical Figma reference (1:9972); Vendor (24:1398), Expense (25:7584),
 * Payroll (27:11294), and Overseas (29:14947) all show the same shape.
 *
 * Modules are free to extend this with module-specific fields (e.g.
 * Overseas's `scheduleDate`) — those are surfaced through the optional
 * `extraColumn` slot and never shoehorned into the canonical column list.
 */
export type ScheduledBatchAction = "transfer" | "document" | "complete";
export type ScheduledBatchRowHighlight = "selected" | "warning";

/** One approver row for the approver-cell click popup (legacy
 *  `pymn_0009_001` approver list). */
export type ScheduledBatchApprover = {
    /** Approver display name. */
    name: string;
    /** Single-letter status code (P/A/R/W/S) → `approval.approver_status.*`. */
    status: string;
    /** Pre-formatted approval datetime, or null when not yet acted ("-").
     *  Legacy fallback — prefer {@link actedAtRaw}. */
    actedAt: string | null;
    /** Raw legacy 14-char UTC `APPR_DTM` (or `MOD_DTM` for Overseas) wire
     *  value. Drives the locale + timezone-aware acted-at in the shared chip. */
    actedAtRaw?: string | null;
    /** Shared, non-admin avatar URL (`/api/v1/users/{apprvr_id}/image`) or null
     *  when the approver has no stored image. Threaded to the shared
     *  `<UserAvatar>` in the approver popover so the photo renders (else the
     *  pastel initials disc). */
    userImgUrl?: string | null;
};

/** Adapt the batch approver shape to the shared approver-popover entry. The
 *  batch wire carries no login id, so the name seeds the avatar colour and
 *  the array index supplies the sequence number; the photo is fetched from
 *  the backend-supplied `userImgUrl`. */
function scheduledBatchApproversToChain(
    approvers: ScheduledBatchApprover[],
): ApproverChainEntry[] {
    return approvers.map((a) => ({
        seed: a.name,
        name: a.name,
        status: normalizeApproverStatus(a.status),
        userImgUrl: a.userImgUrl ?? null,
        actedAt: a.actedAt,
        actedAtRaw: a.actedAtRaw ?? null,
    }));
}

export interface PaymentScheduledBatchRow {
    id: string;
    /** Two-line date + time, e.g. `"05-07-2025\n11:39:50"`. Legacy
     *  pre-formatted fallback — prefer {@link dateTimeRaw} so the cell
     *  formats locale + timezone aware. */
    dateTime: string;
    /**
     * Raw legacy 14-char UTC wire timestamp (e.g. `reg_dtm` / `trnf_dt`).
     * When set, the shared row renderer formats it locale-aware AND converts
     * UTC → Asia/Ho_Chi_Minh via {@code formatUtcDtmByLanguage} — the
     * canonical path. Falls back to splitting {@link dateTime} when absent.
     */
    dateTimeRaw?: string;
    fileName: string;
    txnCount: number;
    txnCurrency: string;
    totalAmount: string;
    status?: ApprovalStatus;
    statusStep?: string;
    requestor: string;
    approver: string;
    approverCount?: number;
    /** Full approval chain for the click popup; omit/empty → inert chevron
     *  (siblings without the data are unaffected). */
    approvers?: ScheduledBatchApprover[];
    approvalRef: string;
    /** Auto-generated approval reference number ({@code VO_YYMMDD_NNN}). Shown in the "Approval Ref" column; takes precedence over `approvalRef`. */
    docNo?: string | null;
    approvalTitle: string;
    action?: ScheduledBatchAction;
    rowHighlight?: ScheduledBatchRowHighlight;
    /**
     * Legacy `pymn_0009_001.createActionCell` gates Delete on
     * `!APPR_SEQ_NO && PRDT_TYPE !== 'H' && canDo('D')`. The page does
     * that derivation server-side and stamps this flag so the shared
     * shell can render the red Delete pill without reaching into the
     * legacy fields.
     */
    canDelete?: boolean;
    /**
     * Legacy `pymn_0009_001.createActionCell` always renders the
     * download arrow when `FILE_URL` is set. Pages set this flag when
     * a file is attached (uploaded Excel exists for the batch).
     */
    canDownloadFile?: boolean;
    /**
     * Disabled Transfer button — legacy `pymn_0009_001.ts:248-251`
     * disables when `currentDate < PAY_DATE` (scheduled in the future).
     */
    transferDisabled?: boolean;
}

/**
 * Optional module-specific column inserted between Total Transfer Amount and
 * Approval Status. Currently only used by Overseas Payment for its Schedule
 * Date column (Figma 29:14947). Header label rendering matches the canonical
 * columns; body rendering is the caller's responsibility.
 */
export interface ScheduledBatchExtraColumn<Row> {
    key: string;
    label: React.ReactNode;
    /** CSS width for the `<col>` (e.g. `"140px"`, `"var(--w-wb-st-schedule-date)"`). */
    width: string;
    align?: "left" | "right" | "center";
    render: (row: Row) => React.ReactNode;
    /** Backend FIELD_ID for this column; when set the header becomes sortable. */
    sortFieldId?: string;
}

type FooterTotal = { currency: string; amount: string };

/**
 * Period dropdown options. The translated label comes from
 * `payment.internal.filter.period.<key>` so each Payment module reuses
 * the same i18n surface.
 *
 * <p>"manual" pairs with a {@link ManualDateRange} prop on the shell —
 * pages render their own date inputs (or reuse {@code <DateField>}) and
 * supply the chosen window verbatim; the shared shell does NOT resolve
 * it to a days-back count.
 */
export type PeriodKey = "7d" | "30d" | "90d" | "180d" | "manual";

export type ManualDateRange = { fromDate: string; toDate: string };

/**
 * Sort direction reaching the shared shell — same shape the page's
 * `useTableSort` hook emits.
 */
export type ListSortDirection = "ASC" | "DESC" | null;

/**
 * Per-column sort mapping: maps the visible column key to the
 * backend FIELD_ID from the page's whitelist enum. Pages omit
 * columns that aren't in the whitelist so their headers stay
 * non-clickable. Column keys are stable identifiers used inside the
 * shared shell ({@code DATE_TIME}, {@code FILE_NAME}, etc.).
 */
export type ScheduledBatchSortable = Partial<
    Record<
        | "DATE_TIME"
        | "FILE_NAME"
        | "TXN_COUNT"
        | "TOTAL_AMOUNT"
        | "STATUS"
        | "REQUESTOR"
        | "APPROVER"
        | "APPROVAL_REF"
        | "APPROVAL_TITLE",
        string
    >
>;

export interface PaymentScheduledBatchListPageProps<Row extends PaymentScheduledBatchRow> {
    /** Already-translated page title (`t("payment.<module>.scheduled_title")`). */
    title: string;
    rows: Row[];
    /** Builds the row's detail-page route. */
    rowDetailHref: (row: Row) => string;
    /** Optional row-click interceptor. */
    onRowActivate?: (row: Row) => boolean | undefined;
    /** Optional cell-scoped click handler for the Approval Ref column. */
    onApprovalRefClick?: (row: Row) => void;
    /** Min-width of the table — bumped by callers that add `extraColumn`. */
    tableMinWidth?: string;
    /** Optional extra column inserted between Total Transfer Amount and Approval Status. */
    extraColumn?: ScheduledBatchExtraColumn<Row>;
    /**
     * Optional extra column inserted between Approval Status and Requestor.
     * Currently only used by Payroll Payment for its Payroll Type column
     * (legacy `pymn_0005_001` APPR_FUND_TP at disp_ord 7). Same contract as
     * {@link extraColumn}; header label + body rendering are the caller's
     * responsibility. Additive + optional — siblings that don't pass it are
     * unaffected.
     */
    extraColumnAfterStatus?: ScheduledBatchExtraColumn<Row>;
    /** Per-currency total amounts rendered in the sibling footer. */
    totals: FooterTotal[];
    /** Pre-translated label for the count cell. */
    countLabel?: string;
    /** Searchable string fields — defaults to fileName/requestor/approver/approvalRef/approvalTitle. */
    searchableFields?: (keyof Row & string)[];

    /* — Shared filtering + search state (opt-in) ———————————————————— */
    /** Controlled search value. If provided, disables internal filtering. */
    search?: string;
    /** Controlled search change handler. */
    onSearchChange?: (keyword: string) => void;
    /** Controlled page index (1-based). */
    page?: number;
    /** Controlled total pages. */
    pageCount?: number;
    /** Controlled page size. */
    pageSize?: number;
    /** Controlled page change handler. */
    onPageChange?: (page: number) => void;
    /** Controlled page size change handler. */
    onPageSizeChange?: (size: number) => void;

    /** Custom filter components to replace the hardcoded date/status placeholders. */
    toolbarFilters?: React.ReactNode;
    /** Click handler for Excel Upload chip in the title-row action group. */
    onExcelUpload?: () => void;
    /**
     * Click handler for the Refresh button (legacy `pymn_0001_001` parity).
     *
     * Opt-in: only the four Payment modules (Vendor / Expense / Payroll /
     * Overseas) pass this. When present AND the logged-in company is
     * product type HAENGSUNG ("H"), the title-row action group renders the
     * Refresh button in place of Excel Upload. Non-HAENGSUNG companies keep
     * Excel Upload. Internal Transfer never passes this prop, so it keeps
     * its current Excel Upload behaviour for every product type.
     */
    onRefresh?: () => void;
    /**
     * True while a HAENGSUNG Oracle Refresh import is in flight. Disables the
     * Refresh button and shows a spinning glyph so a second click can't fire a
     * duplicate import. Ignored unless the Refresh button is shown.
     */
    refreshing?: boolean;
    /**
     * Click handler for the Request Approval CTA in the toolbar.
     *
     * The second argument is a `clearSelection` callback that resets the
     * shell's private row-selection set. The page stashes it and invokes
     * it when the Request Approval modal closes / cancels / submits, so
     * the checkboxes don't stay ticked after the flow ends. It is NOT
     * called here — the page owns the timing so a validation failure that
     * never opens the modal leaves the selection intact.
     */
    onRequestApproval?: (selectedRows: Row[], clearSelection: () => void) => void;

    /* — Server-driven pagination (opt-in) —————————————————————————— */
    pagination?: {
        page: number;
        pageSize: number;
        totalCount: number;
        onPageChange: (page: number) => void;
        onPageSizeChange: (size: number) => void;
    };

    /* — Server-driven sort (opt-in) ——————————————————————————————— */
    sort?: { field: string | null; direction: ListSortDirection };
    sortableColumns?: ScheduledBatchSortable;
    onSort?: (fieldId: string) => void;

    /* — Period dropdown (opt-in) ——————————————————————————————————
     *
     * When the user picks "Enter Manually" the dropdown emits the
     * chosen window via {@link onManualRangeChange}; the page stores
     * the {@code (fromDate, toDate)} pair and feeds it back via
     * {@link manualRange} so the trigger reads consistently across
     * re-renders. Pages that don't wire {@link onManualRangeChange}
     * have the "Enter Manually" option hidden — the dropdown falls
     * back to the three preset choices.
     */
    period?: PeriodKey;
    onPeriodChange?: (period: PeriodKey) => void;
    manualRange?: ManualDateRange;
    onManualRangeChange?: (range: ManualDateRange) => void;

    /* — Approval-status dropdown (opt-in) —————————————————————————— */
    apprType?: string;
    apprTypeOptions?: ReadonlyArray<{ value: string; labelKey: string }>;
    onApprTypeChange?: (apprType: string) => void;

    /* — Toolbar icons (opt-in) —————————————————————————————————— */
    onPrint?: () => void;
    onListView?: (anchorRect: DOMRect) => void;

    /* — Row-action callbacks (opt-in) —————————————————————————————— */
    onTransferRow?: (row: Row) => void;
    onDeleteRow?:   (row: Row) => void;
    onDownloadRow?: (row: Row) => void;

    /* — Action-permission gates (opt-in; default true) ————————————————
     *
     * Static frontend preparation for the legacy R/D/T action permissions
     * (R = Request Approval, D = Delete, T = Transfer). Each defaults to
     * `true`, so a module that doesn't pass them behaves exactly as before.
     * When a flag is `false` the matching affordance is HIDDEN, not disabled
     * — legacy parity: `pymn_0009_001` removes the button from the DOM when
     * the user lacks the permission, it does not grey it out.
     *
     * These gate UI visibility ONLY; backend authorization is unchanged and
     * remains the real boundary.
     *
     * TODO: replace the caller's static perm object with a real
     * action-permission map resolved from auth/navigation once the backend
     * exposes a USER_MENU_ACTION_AUTH_INFM equivalent (R/D/T per menu slug).
     * See the internal-transfer-scheduled permission audit. The flags below
     * are the only seam — swapping the source is a caller-side change.
     */
    canRequestApprovalAction?: boolean;
    canDeleteAction?: boolean;
    canTransferAction?: boolean;

    /* — Column visibility from View Setting (opt-in) ————————————————
     *
     * When provided, each seeded data column on the shell maps to a
     * View Setting `FIELD_ID` and renders only when its `USE_YN === "Y"`.
     * CHECKBOX, APPROVER, APPROVAL_TITLE, and ACTION columns stay
     * always-rendered (CHECKBOX is a special special FIELD_ID; the
     * other three have no V85 seed entry — they ride through the
     * legacy shell unchanged until the seed catches up).
     *
     * Pages that don't pass this prop fall back to the legacy
     * always-render behaviour — preserves backwards-compat for the
     * other Payment modules that don't yet wire View Setting.
     */
    viewSettingItems?: ViewSettingItem[];

    /**
     * Pre-translated empty-state copy rendered below the table header
     * when the filtered/paginated row set is empty. Each Payment module
     * passes its page-specific message via `t(...)`. Omit to leave the
     * empty body silent (legacy behaviour).
     */
    emptyMessage?: string;

    /**
     * Sticky-wrapped initial-loading flag from the consumer
     * (`useStickyLoading(state.loading && !stableData)`). When true AND
     * the filtered/paginated row set is empty, the shell renders
     * `t("common.loading")` inside the existing {@link TableEmptyState}
     * slot instead of {@link emptyMessage}. Subsequent refetches keep
     * the previous rows visible via the consumer's stable-data latch
     * and never trip this gate. Mirrors the Account Inquiry
     * `stickyInitialLoading` pattern (CLAUDE.md — Settings module).
     */
    loading?: boolean;

    /**
     * Sticky-wrapped mutation-in-flight flag from the consumer
     * (`useStickyLoading(updating || transferring || …)`). When true
     * the per-row action chips (Transfer / Delete / Download) and the
     * toolbar Request-Approval CTA are visibly disabled across the
     * minimum-visibility window so a fast refresh doesn't flicker
     * enabled → disabled → enabled. The functional duplicate-click
     * guard still lives inside the handler.
     */
    actionInFlight?: boolean;

    /**
     * Per-page FIELD_ID aliases. Each entry overrides the default
     * legacy slot id the shell uses for visibility gating + width
     * lookup. Pages that don't pass this prop keep the legacy V131
     * FIELD_ID set (TITL=File Name, REG_ID=Requestor, APPR_SEQ_NO=
     * Approval Ref, no gate on Approver / Approval Title) — preserves
     * backward-compat for Vendor / Expense / Payroll / Overseas.
     *
     * Internal Transfer's V217 seed uses the legacy pymn_0009_001
     * FIELD_IDs (FILE_NM, DRAFT_USER_NM, APPRVR_NM, APPR_DOC_NO, TITL
     * as Approval Title); the page supplies a full alias map so the
     * shell honours those names.
     */
    fieldIdMap?: {
        /** FIELD_ID for the Date/Time slot. Default {@code "REG_DTM"}.
         *  Overseas Payment Scheduled overrides this to {@code "TRNF_DT"}
         *  per legacy {@code pymn_0007_001}. */
        dateTime?: string;
        /** FIELD_ID for the File Name slot. Default {@code "TITL"}. */
        fileName?: string;
        /** FIELD_ID for the No. of Transactions slot. Default
         *  {@code "TOT_TRNS_CNT"}. When the page's legacy schema does
         *  not surface a transaction count, pass a stable sentinel so
         *  the shell still gates the column via View Setting (or omit
         *  the column from the seed entirely to hide it). */
        txnCount?: string;
        /** FIELD_ID for the Total Transfer Amount slot. Default
         *  {@code "TOTAL_TRAN_AMT"}. Overseas Payment Scheduled overrides
         *  this to {@code "TRNF_AMT"} per legacy {@code pymn_0007_001}. */
        totalAmount?: string;
        /** FIELD_ID for the Approval Status slot. Default
         *  {@code "APPR_STTS"} — legacy constant used by every Payment
         *  module. */
        status?: string;
        /** FIELD_ID for the Requestor slot. Default {@code "REG_ID"}. */
        requestor?: string;
        /** FIELD_ID for the Approval Ref slot. Default {@code "APPR_SEQ_NO"}. */
        approvalRef?: string;
        /** FIELD_ID for the Approver slot. When set the column becomes
         *  View-Setting-gated; when omitted the Approver column stays
         *  always-on (legacy behaviour for the 4 other Payment modules). */
        approver?: string;
        /** FIELD_ID for the Approval Title slot. When set the column
         *  becomes View-Setting-gated; when omitted the Approval Title
         *  column stays always-on (legacy behaviour). */
        approvalTitle?: string;
    };
}

const DEFAULT_TABLE_MIN_WIDTH = "var(--w-wb-st-table-min)";
const DEFAULT_SEARCHABLE: (keyof PaymentScheduledBatchRow & string)[] = [
    "fileName",
    "requestor",
    "approver",
    "approvalRef",
    "approvalTitle",
];

/**
 * Shared batch-file Scheduled Payment list page. Every Payment module
 * (Internal Transfer, Vendor, Expense, Payroll, Overseas) routes through
 * this template — see CLAUDE.md §12a "Payment Module Pagination Rule".
 *
 * Visual contract is identical across modules — Figma 1:9972 / 24:1398 /
 * 25:7584 / 27:11294 / 29:14947 all show the same toolbar (Request Approval
 * CTA + period dropdown + shared CalendarIconButton + status dropdown +
 * SearchInput), the same 11-column table (12 with Overseas's Schedule Date
 * extra), the same `paginationWithTotals` footer aligned under Total
 * Transfer Amount, and the same shared Pagination.
 *
 * Module-specific variation (page title, row shape, total amounts, detail
 * route, Schedule Date column) is supplied via props; chrome stays
 * byte-identical so the system reads as one product.
 */
export default function PaymentScheduledBatchListPage<Row extends PaymentScheduledBatchRow>({
    title,
    rows,
    rowDetailHref,
    onRowActivate,
    onApprovalRefClick,
    tableMinWidth,
    extraColumn,
    extraColumnAfterStatus,
    totals,
    countLabel,
    searchableFields,
    search: controlledSearch,
    onSearchChange: controlledSearchChange,
    page: controlledPage,
    pageCount: controlledPageCount,
    pageSize: controlledPageSize,
    onPageChange: controlledPageChange,
    onPageSizeChange: controlledPageSizeChange,
    toolbarFilters,
    onExcelUpload,
    onRefresh,
    refreshing,
    onRequestApproval,
    pagination,
    sort,
    sortableColumns,
    onSort,
    period,
    onPeriodChange,
    manualRange,
    onManualRangeChange,
    apprType,
    apprTypeOptions,
    onApprTypeChange,
    onPrint,
    onListView,
    onTransferRow,
    onDeleteRow,
    onDownloadRow,
    canRequestApprovalAction = true,
    canDeleteAction = true,
    canTransferAction = true,
    viewSettingItems,
    emptyMessage,
    loading,
    actionInFlight,
    fieldIdMap,
}: PaymentScheduledBatchListPageProps<Row>) {
    // FIELD_ID → USE_YN visibility map. When the page doesn't pass
    // `viewSettingItems` the map is empty and `isVisible(...)` returns
    // true for every column — preserves the legacy always-render
    // behaviour for modules that haven't wired View Setting yet.
    const visibilityMap = useMemo(() => {
        const map = new Map<string, boolean>();
        if (viewSettingItems) {
            for (const item of viewSettingItems) {
                map.set(item.field_id, item.use_yn === "Y");
            }
        }
        return map;
    }, [viewSettingItems]);
    const isVisible = (fieldId: string): boolean => {
        if (!viewSettingItems) return true;
        return visibilityMap.get(fieldId) ?? true;
    };

    // FIELD_ID → SIZE map for DB-driven column widths. Pages opt in by
    // shipping a viewSettingItems prop whose entries carry a `size`
    // value (e.g. `"105px"`); each <col> consumes the DB value with a
    // CSS-var fallback so modules that haven't seeded widths keep
    // rendering against the existing tokens.
    const widthByFieldId = useMemo(() => {
        const map = new Map<string, string>();
        if (viewSettingItems) {
            for (const item of viewSettingItems) {
                // Accept only a valid px `size` via the shared validator,
                // so this shell resolves DB widths through the same code
                // path as every other View-Setting-driven table.
                if (item.size && parseViewSettingPxSize(item.size) > 0) {
                    map.set(item.field_id, item.size);
                }
            }
        }
        return map;
    }, [viewSettingItems]);
    const widthFor = (fieldId: string, fallback: string): string =>
        widthByFieldId.get(fieldId) ?? fallback;

    // Resolve each column slot to its FIELD_ID — pages may override via
    // `fieldIdMap`, otherwise the legacy V131 ids apply. The shell uses
    // these for both the visibility gate AND the DB-driven width lookup.
    const dateTimeFieldId      = fieldIdMap?.dateTime      ?? "REG_DTM";
    const fileNameFieldId      = fieldIdMap?.fileName      ?? "TITL";
    const txnCountFieldId      = fieldIdMap?.txnCount      ?? "TOT_TRNS_CNT";
    const totalAmountFieldId   = fieldIdMap?.totalAmount   ?? "TOTAL_TRAN_AMT";
    const statusFieldId        = fieldIdMap?.status        ?? "APPR_STTS";
    const requestorFieldId     = fieldIdMap?.requestor     ?? "REG_ID";
    const approvalRefFieldId   = fieldIdMap?.approvalRef   ?? "APPR_SEQ_NO";
    const approverFieldId      = fieldIdMap?.approver;       // optional
    const approvalTitleFieldId = fieldIdMap?.approvalTitle;  // optional
    const { t } = useTranslation();
    const router = useRouter();

    // HAENGSUNG-only toolbar swap (legacy pymn_0001_001 parity). Resolved
    // once on mount — the dashboard mounts client-side after auth, so
    // `userStorage` is always populated by the time this renders. When the
    // company is product type "H" and the page opted into `onRefresh`, the
    // title-row action group shows Refresh instead of Excel Upload.
    const [isHaengsung] = useState(() => isProductType(userStorage.get(), "H"));



    // When `onSearchChange` is supplied the page owns the search state
    // (server-driven flows debounce-forward to the API). Otherwise the
    // shell keeps its legacy local-state behaviour so mock-data pages
    // continue to client-side filter.
    const isSearchControlled = controlledSearchChange !== undefined;
    const [internalSearch, setInternalSearch] = useState("");
    const search = isSearchControlled ? (controlledSearch ?? "") : internalSearch;
    const setSearch = isSearchControlled
        ? (next: string) => controlledSearchChange(next)
        : setInternalSearch;
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // When the page drives pagination/sort server-side, `rows` is the
    // already-resolved current page — DO NOT client-side filter (the
    // search box is intentionally inert when server-side wiring is on;
    // a follow-up MR forwards the keyword to the API). Pages that
    // still ship the static mock keep the original client-side
    // search-filter behaviour.
    const serverDriven = Boolean(pagination);
    const filtered = useMemo(() => {
        if (serverDriven) return rows;
        if (!search.trim()) return rows;
        const q = search.trim().toLowerCase();
        const fields = (searchableFields ?? DEFAULT_SEARCHABLE) as (keyof Row & string)[];
        return rows.filter((r) =>
            fields
                .map((f) => {
                    const v = r[f];
                    return typeof v === "string" ? v : "";
                })
                .join(" ")
                .toLowerCase()
                .includes(q),
        );
    }, [rows, search, searchableFields, serverDriven]);

    // Header checkbox + select-all only operate on rows that can
    // still be selected — already-submitted rows (`approvalRef` set)
    // are ineligible because Request Approval can't act on them.
    // Mirrors the disabled per-row checkbox state below.
    const selectableRows = filtered.filter((r) => !r.approvalRef);
    const allChecked =
        selectableRows.length > 0 &&
        selectableRows.every((r) => selected.has(r.id));
    const toggleRow = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const toggleAll = () =>
        setSelected(
            allChecked ? new Set() : new Set(selectableRows.map((r) => r.id)),
        );

    const goToDetail = (row: Row) => {
        if (onRowActivate?.(row)) return;
        router.push(rowDetailHref(row));
    };

    /* Inline footer cells — one per rendered column, in the SAME order the
     * header + colgroup render so the `<tfoot>` cells line up exactly. The
     * count label sits under Date/Time; the currency totals fill the Total
     * Transfer Amount column onward. Mirrors the Approval Box fix. */
    const footerSlotKeys: string[] = ["CHECKBOX"];
    if (isVisible(dateTimeFieldId)) footerSlotKeys.push("DATE_TIME");
    if (isVisible(fileNameFieldId)) footerSlotKeys.push("FILE_NAME");
    if (isVisible(txnCountFieldId)) footerSlotKeys.push("TXN_COUNT");
    if (isVisible(totalAmountFieldId)) footerSlotKeys.push("TOTAL_AMOUNT");
    if (extraColumn) footerSlotKeys.push("EXTRA");
    if (isVisible(statusFieldId)) footerSlotKeys.push("STATUS");
    if (extraColumnAfterStatus) footerSlotKeys.push("EXTRA_AFTER_STATUS");
    if (isVisible(requestorFieldId)) footerSlotKeys.push("REQUESTOR");
    if (approverFieldId === undefined || isVisible(approverFieldId))
        footerSlotKeys.push("APPROVER");
    if (isVisible(approvalRefFieldId)) footerSlotKeys.push("APPROVAL_REF");
    if (approvalTitleFieldId === undefined || isVisible(approvalTitleFieldId))
        footerSlotKeys.push("APPROVAL_TITLE");
    footerSlotKeys.push("ACTION");

    const footerCells = placeBatchFooterCells(footerSlotKeys, {
        countLabel:
            countLabel ??
            t("payment.document_count", { count: pagination?.totalCount ?? 0 }),
        countSlotKey: "DATE_TIME",
        amountSlotKey: "TOTAL_AMOUNT",
        totals: mergeBatchTotals(totals),
    });

    /* Shared `<colgroup>` element — rendered by BOTH the main table and the
     * sibling footer table so their column widths match exactly. */
    const colgroupEl = (
        <ScheduledColumns
            extraColumn={extraColumn}
            extraColumnAfterStatus={extraColumnAfterStatus}
            isVisible={isVisible}
            widthFor={widthFor}
            dateTimeFieldId={dateTimeFieldId}
            fileNameFieldId={fileNameFieldId}
            txnCountFieldId={txnCountFieldId}
            totalAmountFieldId={totalAmountFieldId}
            statusFieldId={statusFieldId}
            requestorFieldId={requestorFieldId}
            approvalRefFieldId={approvalRefFieldId}
            approverFieldId={approverFieldId}
            approvalTitleFieldId={approvalTitleFieldId}
        />
    );

    /* Table `min-width` = Σ of the VISIBLE columns' DB px sizes, mirroring
     * the exact slot order + isVisible gates ScheduledColumns renders
     * (checkbox + visible canonical slots + extras + action). Hiding a
     * column via View Setting drops it here too, so the horizontal-scroll
     * threshold shrinks with the visible set (CLAUDE.md §13c, §7a). An
     * explicit `tableMinWidth` prop still overrides; when no px size
     * resolves (seed shipped only token widths) we fall back to the shell
     * token so the table can't collapse. */
    const px = parseViewSettingPxSize;
    const computedMinWidthPx =
        px(widthFor("CHECKBOX", "")) +
        (isVisible(dateTimeFieldId)    ? px(widthFor(dateTimeFieldId, ""))    : 0) +
        (isVisible(fileNameFieldId)    ? px(widthFor(fileNameFieldId, ""))    : 0) +
        (isVisible(txnCountFieldId)    ? px(widthFor(txnCountFieldId, ""))    : 0) +
        (isVisible(totalAmountFieldId) ? px(widthFor(totalAmountFieldId, "")) : 0) +
        (extraColumn                   ? px(extraColumn.width)                : 0) +
        (isVisible(statusFieldId)      ? px(widthFor(statusFieldId, ""))      : 0) +
        (extraColumnAfterStatus        ? px(extraColumnAfterStatus.width)     : 0) +
        (isVisible(requestorFieldId)   ? px(widthFor(requestorFieldId, ""))   : 0) +
        ((approverFieldId === undefined || isVisible(approverFieldId))
            ? px(widthFor(approverFieldId ?? "APPRVR_NM", "")) : 0) +
        (isVisible(approvalRefFieldId) ? px(widthFor(approvalRefFieldId, "")) : 0) +
        ((approvalTitleFieldId === undefined || isVisible(approvalTitleFieldId))
            ? px(widthFor(approvalTitleFieldId ?? "TITL", "")) : 0) +
        px(widthFor("ETC", ""));
    const effectiveMinWidth =
        tableMinWidth ??
        (computedMinWidthPx > 0 ? `${computedMinWidthPx}px` : DEFAULT_TABLE_MIN_WIDTH);

    return (
        <PageLayout>
            <PageHeader title={title}>
                <ScheduledTitleActionGroup
                    onExcelUpload={onExcelUpload}
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                    showRefresh={isHaengsung && onRefresh !== undefined}
                    onPrint={onPrint}
                    onListView={onListView}
                />
            </PageHeader>

            <ScheduledToolbar
                search={search}
                onSearchChange={setSearch}
                toolbarFilters={toolbarFilters}
                period={period}
                onPeriodChange={onPeriodChange}
                manualRange={manualRange}
                onManualRangeChange={onManualRangeChange}
                apprType={apprType}
                apprTypeOptions={apprTypeOptions}
                onApprTypeChange={onApprTypeChange}
                onRequestApproval={
                    onRequestApproval
                        ? () => {
                              const chosen = filtered.filter((r) => selected.has(r.id));
                              onRequestApproval(chosen, () => setSelected(new Set()));
                          }
                        : undefined
                }
                requestApprovalDisabled={selected.size === 0 || Boolean(actionInFlight)}
                // R permission — when false the CTA is removed entirely
                // (legacy hides, not disables). Default true → unchanged.
                showRequestApproval={canRequestApprovalAction}
            />

            <DataTableShell
                footerMode="paginationWithTotals"
                table={
                    <>
                    <table
                        className="w-full table-fixed border-collapse"
                        style={{ minWidth: effectiveMinWidth }}
                    >
                        {colgroupEl}
                        <TableHeader className="sticky top-0 z-10">
                            <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                                <TableHeaderCell textSizeClass="text-wb-13" sortable={false}>
                                    <Checkbox
                                        checked={allChecked}
                                        onCheckedChange={toggleAll}
                                        aria-label={t("payment.aria.select_all")}
                                    />
                                </TableHeaderCell>
                                {isVisible(dateTimeFieldId) &&
                                    renderSortableHeader(
                                        "DATE_TIME",
                                        t("payment.internal.col.date_time"),
                                        sortableColumns,
                                        sort,
                                        onSort,
                                    )}
                                {isVisible(fileNameFieldId) &&
                                    renderSortableHeader(
                                        "FILE_NAME",
                                        t("payment.internal.col.file_name"),
                                        sortableColumns,
                                        sort,
                                        onSort,
                                    )}
                                {isVisible(txnCountFieldId) &&
                                    renderSortableHeader(
                                        "TXN_COUNT",
                                        t("payment.internal.col.txn_count"),
                                        sortableColumns,
                                        sort,
                                        onSort,
                                        "right",
                                    )}
                                {isVisible(totalAmountFieldId) &&
                                    renderSortableHeader(
                                        "TOTAL_AMOUNT",
                                        t("payment.internal.col.total_transfer"),
                                        sortableColumns,
                                        sort,
                                        onSort,
                                        "right",
                                    )}
                                {extraColumn ? (
                                    extraColumn.sortFieldId && sort && onSort ? (
                                        <TableHeaderCell
                                            textSizeClass="text-wb-13"
                                            sortFieldId={extraColumn.sortFieldId}
                                            activeSortField={sort.field}
                                            activeSortDirection={sort.direction}
                                            onSort={onSort}
                                        >
                                            {extraColumn.label}
                                        </TableHeaderCell>
                                    ) : (
                                        <TableHeaderCell
                                            textSizeClass="text-wb-13"
                                            align={extraColumn.align === "right" ? "right" : "left"}
                                        >
                                            {extraColumn.label}
                                        </TableHeaderCell>
                                    )
                                ) : null}
                                {isVisible(statusFieldId) &&
                                    renderSortableHeader(
                                        "STATUS",
                                        t("approval.col.status"),
                                        sortableColumns,
                                        sort,
                                        onSort,
                                    )}
                                {extraColumnAfterStatus ? (
                                    extraColumnAfterStatus.sortFieldId && sort && onSort ? (
                                        <TableHeaderCell
                                            textSizeClass="text-wb-13"
                                            sortFieldId={extraColumnAfterStatus.sortFieldId}
                                            activeSortField={sort.field}
                                            activeSortDirection={sort.direction}
                                            onSort={onSort}
                                        >
                                            {extraColumnAfterStatus.label}
                                        </TableHeaderCell>
                                    ) : (
                                        <TableHeaderCell
                                            textSizeClass="text-wb-13"
                                            align={extraColumnAfterStatus.align === "right" ? "right" : "left"}
                                        >
                                            {extraColumnAfterStatus.label}
                                        </TableHeaderCell>
                                    )
                                ) : null}
                                {isVisible(requestorFieldId) &&
                                    renderSortableHeader(
                                        "REQUESTOR",
                                        t("payment.col.requestor"),
                                        sortableColumns,
                                        sort,
                                        onSort,
                                    )}
                                {(approverFieldId === undefined || isVisible(approverFieldId)) &&
                                    renderSortableHeader(
                                        "APPROVER",
                                        t("payment.col.approver"),
                                        sortableColumns,
                                        sort,
                                        onSort,
                                    )}
                                {isVisible(approvalRefFieldId) &&
                                    renderSortableHeader(
                                        "APPROVAL_REF",
                                        t("payment.internal.col.approval_ref"),
                                        sortableColumns,
                                        sort,
                                        onSort,
                                    )}
                                {(approvalTitleFieldId === undefined || isVisible(approvalTitleFieldId)) &&
                                    renderSortableHeader(
                                        "APPROVAL_TITLE",
                                        t("payment.internal.col.approval_title"),
                                        sortableColumns,
                                        sort,
                                        onSort,
                                    )}
                                <TableHeaderCell textSizeClass="text-wb-13" sortable={false}>{""}</TableHeaderCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map((row) => (
                                <ScheduledRow
                                    key={row.id}
                                    row={row}
                                    extraColumn={extraColumn}
                                    extraColumnAfterStatus={extraColumnAfterStatus}
                                    isVisible={isVisible}
                                    dateTimeFieldId={dateTimeFieldId}
                                    fileNameFieldId={fileNameFieldId}
                                    txnCountFieldId={txnCountFieldId}
                                    totalAmountFieldId={totalAmountFieldId}
                                    statusFieldId={statusFieldId}
                                    requestorFieldId={requestorFieldId}
                                    approvalRefFieldId={approvalRefFieldId}
                                    approverFieldId={approverFieldId}
                                    approvalTitleFieldId={approvalTitleFieldId}
                                    selected={selected.has(row.id)}
                                    onToggle={() => toggleRow(row.id)}
                                    onActivate={() => goToDetail(row)}
                                    onApprovalRefClick={
                                        onApprovalRefClick
                                            ? () => onApprovalRefClick(row)
                                            : undefined
                                    }
                                    onTransfer={onTransferRow ? () => onTransferRow(row) : undefined}
                                    onDelete={onDeleteRow ? () => onDeleteRow(row) : undefined}
                                    onDownload={onDownloadRow ? () => onDownloadRow(row) : undefined}
                                    canDeleteAction={canDeleteAction}
                                    canTransferAction={canTransferAction}
                                    actionInFlight={Boolean(actionInFlight)}
                                />
                            ))}
                        </TableBody>
                    </table>
                    {/* Page-specific empty-state copy — rendered as a
                       sibling of the <table> inside the shell's scroll
                       container so the header stays visible and the
                       message centers in the body area below.
                       While the initial fetch is in flight (sticky-wrapped
                       by the consumer so it stays visible ≥ 400 ms), the
                       slot reads `t("common.loading")` instead of the
                       per-page empty copy — prevents the
                       loading → empty → table flash on fast cached
                       responses. */}
                    {filtered.length === 0 && (loading || emptyMessage) ? (
                        <TableEmptyState
                            message={loading ? t("common.loading") : (emptyMessage ?? "")}
                        />
                    ) : null}
                    </>
                }
                footer={
                    <PaymentBatchTableFooter
                        className="mt-auto"
                        colgroup={colgroupEl}
                        minWidth={effectiveMinWidth}
                        cells={footerCells}
                    />
                }
                pagination={
                    pagination ? (
                        <Pagination
                            page={pagination.page + 1}
                            pageCount={Math.max(
                                1,
                                Math.ceil(pagination.totalCount / pagination.pageSize),
                            )}
                            pageSize={pagination.pageSize}
                            onPageChange={(p) => pagination.onPageChange(p - 1)}
                            onPageSizeChange={pagination.onPageSizeChange}
                            totalLabel={t("common.showing_of", {
                                shown: String(
                                    Math.min(
                                        rows.length,
                                        pagination.totalCount,
                                    ),
                                ),
                                total: String(pagination.totalCount),
                            })}
                            className="shrink-0"
                        />
                    ) : (
                        <Pagination
                            page={controlledPage ?? 1}
                            pageCount={controlledPageCount ?? Math.max(1, Math.ceil(filtered.length / (controlledPageSize ?? 10)))}
                            pageSize={controlledPageSize ?? 10}
                            totalLabel={t("common.showing_of", {
                                shown: String(Math.min(filtered.length, controlledPageSize ?? 10)),
                                total: String(filtered.length),
                            })}
                        onPageChange={controlledPageChange}
                        onPageSizeChange={controlledPageSizeChange}
                            className="shrink-0"
                        />
                    )
                }
            />
        </PageLayout>
    );
}

/* ─────────────────────────── colgroup ─────────────────────────── */

/**
 * Per-column visibility predicate — keyed by the legacy V85 `FIELD_ID`
 * for each seeded data column. Always-on columns (CHECKBOX / APPROVER /
 * APPROVAL_TITLE / ACTION) ignore this hook and render unconditionally.
 */
type FieldVisibility = (fieldId: string) => boolean;
type FieldWidthLookup = (fieldId: string, fallback: string) => string;

function ScheduledColumns<Row extends PaymentScheduledBatchRow>({
    extraColumn,
    extraColumnAfterStatus,
    isVisible = () => true,
    widthFor,
    dateTimeFieldId,
    fileNameFieldId,
    txnCountFieldId,
    totalAmountFieldId,
    statusFieldId,
    requestorFieldId,
    approvalRefFieldId,
    approverFieldId,
    approvalTitleFieldId,
}: {
    extraColumn?: ScheduledBatchExtraColumn<Row>;
    extraColumnAfterStatus?: ScheduledBatchExtraColumn<Row>;
    isVisible?: FieldVisibility;
    widthFor?: FieldWidthLookup;
    dateTimeFieldId: string;
    fileNameFieldId: string;
    txnCountFieldId: string;
    totalAmountFieldId: string;
    statusFieldId: string;
    requestorFieldId: string;
    approvalRefFieldId: string;
    approverFieldId?: string;
    approvalTitleFieldId?: string;
}) {
    const w = widthFor ?? ((_: string, fallback: string) => fallback);
    const checkboxStyle      = { width: w("CHECKBOX",          "var(--w-wb-st-checkbox)") };
    const datetimeStyle      = { width: w(dateTimeFieldId,     "var(--w-wb-st-datetime)") };
    const filenameStyle      = { width: w(fileNameFieldId,     "var(--w-wb-st-filename)") };
    const txnCountStyle      = { width: w(txnCountFieldId,     "var(--w-wb-st-txn-count)") };
    const totalStyle         = { width: w(totalAmountFieldId,  "var(--w-wb-st-total)") };
    const statusStyle        = { width: w(statusFieldId,       "var(--w-wb-st-status)") };
    const requestorStyle     = { width: w(requestorFieldId,    "var(--w-wb-st-requestor)") };
    const approverStyle      = { width: w(approverFieldId ?? "APPRVR_NM", "var(--w-wb-st-approver)") };
    const approvalRefStyle   = { width: w(approvalRefFieldId,  "var(--w-wb-st-approval-ref)") };
    const approvalTitleStyle = { width: w(approvalTitleFieldId ?? "TITL", "var(--w-wb-st-approval-title)") };
    const actionStyle        = { width: w("ETC",               "var(--w-wb-st-action)") };
    return (
        <colgroup>
            <col style={checkboxStyle} />
            {isVisible(dateTimeFieldId)    ? <col style={datetimeStyle} /> : null}
            {isVisible(fileNameFieldId)    ? <col style={filenameStyle} /> : null}
            {isVisible(txnCountFieldId)    ? <col style={txnCountStyle} /> : null}
            {isVisible(totalAmountFieldId) ? <col style={totalStyle} /> : null}
            {extraColumn ? <col style={{ width: extraColumn.width }} /> : null}
            {isVisible(statusFieldId)      ? <col style={statusStyle} /> : null}
            {extraColumnAfterStatus ? <col style={{ width: extraColumnAfterStatus.width }} /> : null}
            {isVisible(requestorFieldId)   ? <col style={requestorStyle} /> : null}
            {(approverFieldId === undefined || isVisible(approverFieldId)) ? <col style={approverStyle} /> : null}
            {isVisible(approvalRefFieldId) ? <col style={approvalRefStyle} /> : null}
            {(approvalTitleFieldId === undefined || isVisible(approvalTitleFieldId)) ? <col style={approvalTitleStyle} /> : null}
            <col style={actionStyle} />
        </colgroup>
    );
}

/* ─────────────────────────── toolbar ─────────────────────────── */

function ScheduledToolbar({
    search,
    onSearchChange,
    toolbarFilters,
    onRequestApproval,
    requestApprovalDisabled,
    showRequestApproval = true,
    period,
    onPeriodChange,
    manualRange,
    onManualRangeChange,
    apprType,
    apprTypeOptions,
    onApprTypeChange,
}: {
    search: string;
    onSearchChange: (v: string) => void;
    toolbarFilters?: React.ReactNode;
    onRequestApproval?: () => void;
    requestApprovalDisabled?: boolean;
    /** R-permission gate — when false the CTA is not rendered at all. */
    showRequestApproval?: boolean;
    period?: PeriodKey;
    onPeriodChange?: (period: PeriodKey) => void;
    manualRange?: ManualDateRange;
    onManualRangeChange?: (range: ManualDateRange) => void;
    apprType?: string;
    apprTypeOptions?: ReadonlyArray<{ value: string; labelKey: string }>;
    onApprTypeChange?: (apprType: string) => void;
}) {
    const { t } = useTranslation();
    return (
        // `relative z-20` keeps the period + status dropdowns' absolutely-
        // positioned popovers above the sibling `<DataTableShell>` table
        // frame (DOM-order siblings without z-index let the later sibling
        // win — without this the popover items get hidden under the
        // sticky `<thead>`).
        <div className="relative z-20 flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
                {/* Request Approval — styled to match the sibling
                    filter chips (period dropdown + status dropdown) so
                    height, border, and shadow line up across the
                    toolbar. Mirrors the `<FilterDropdown>` chrome:
                    `bg-white`, `shadow-wb-btn` (layered hairline +
                    soft drop), `text-wb-14-tight font-medium`. */}
                {showRequestApproval && (
                    <button
                        type="button"
                        onClick={onRequestApproval}
                        disabled={!onRequestApproval || requestApprovalDisabled}
                        className="flex h-[var(--h-wb-filter-btn)] shrink-0 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ntrl-8 shadow-wb-btn transition-colors hover:text-wb-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {t("payment.internal.request_approval")}
                    </button>
                )}
                {toolbarFilters ? (
                    toolbarFilters
                ) : (
                    <>
                        {period !== undefined && onPeriodChange ? (
                            <PaymentDateRangeFilter
                                period={period}
                                onPeriodChange={onPeriodChange}
                                manualRange={manualRange}
                                onManualRangeChange={onManualRangeChange}
                            />
                        ) : (
                            <FilterDropdown
                                label={t("date_range_filter.last_30_days")}
                                width="var(--w-wb-st-period)"
                            />
                        )}
                        {apprTypeOptions && onApprTypeChange ? (
                            <StatusFilterDropdown
                                value={apprType ?? ""}
                                options={apprTypeOptions}
                                onChange={onApprTypeChange}
                            />
                        ) : (
                            <FilterDropdown
                                label={t("payment.internal.filter.all_status")}
                                width="var(--w-wb-st-status-filter)"
                            />
                        )}
                    </>
                )}
            </div>
            <SearchInput value={search} onChange={onSearchChange} />
        </div>
    );
}


/**
 * Interactive Approval-Status filter — replaces the inert
 * `<FilterDropdown>` chip when the page passes `options` + `onChange`.
 * The first option's `value` should be `""` (treated as "All"). Labels
 * are i18n keys resolved at render time so each Payment module can
 * reuse the same component without forcing its own translated strings
 * through the props.
 */
function StatusFilterDropdown({
    value,
    options,
    onChange,
}: {
    value: string;
    options: ReadonlyArray<{ value: string; labelKey: string }>;
    onChange: (next: string) => void;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        function onDocMouseDown(e: MouseEvent) {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", onDocMouseDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocMouseDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const current = options.find((o) => o.value === value) ?? options[0];

    return (
        <div
            ref={rootRef}
            className="relative"
            style={{ width: "var(--w-wb-st-status-filter)" }}
        >
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                // Chrome matches the sibling <FilterDropdown> chips so
                // the toolbar reads as one unified row — same height,
                // same raised shadow (no visible border), same text
                // token. Diverging caused the visible-border look the
                // user flagged.
                className="flex h-[var(--h-wb-filter-btn)] w-full cursor-pointer items-center justify-between gap-2 overflow-clip rounded-md bg-white px-2 text-wb-14-tight font-medium text-wb-ntrl-8 shadow-wb-btn"
            >
                <span className="flex-1 truncate text-left">
                    {t(current.labelKey)}
                </span>
                <ChevronDown
                    aria-hidden
                    className={cn(
                        "size-4 shrink-0 text-wb-ntrl-6 transition-transform",
                        open && "rotate-180",
                    )}
                    strokeWidth={1.8}
                />
            </button>
            {open && (
                <ul
                    role="listbox"
                    className="absolute left-0 right-0 top-[calc(var(--h-wb-filter-btn)+4px)] z-10 rounded-md border border-wb-ntrl-4 bg-white py-1 shadow-wb-card animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out"
                >
                    {options.map((opt) => {
                        const isSelected = opt.value === value;
                        return (
                            <li key={opt.value || "__all__"}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "block w-full truncate px-2.5 py-2 text-left text-wb-13 font-medium",
                                        isSelected
                                            ? "bg-brand-soft text-brand"
                                            : "text-wb-ink hover:bg-wb-bg-sidebar",
                                    )}
                                >
                                    {t(opt.labelKey)}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

/**
 * Period filter — single shared chrome across the whole Payment menu.
 *
 * <p>Mirrors Add-on Service > Sales / Expenses e-Invoices (Figma
 * 100:13382): preset dropdown ({@code last_30_days} / {@code last_90_days}
 * / {@code last_180_days} / Enter Manually) paired with the canonical
 * calendar trigger. Manual mode swaps the dropdown for the shared
 * start ↔ end range picker chips. Adapts the Payment shells' existing
 * {@code period} + {@code manualRange} props to the shared
 * {@link DateRangeFilterValue} shape so per-page callers don't change.
 */
function PaymentDateRangeFilter({
    period,
    onPeriodChange,
    manualRange,
    onManualRangeChange,
}: {
    period: PeriodKey;
    onPeriodChange: (period: PeriodKey) => void;
    manualRange?: ManualDateRange;
    onManualRangeChange?: (range: ManualDateRange) => void;
}) {
    const { locale } = useTranslation();
    const value = periodToDateRangeFilterValue(period, manualRange);
    return (
        <DateRangeFilter
            value={value}
            onChange={(next) => {
                if (next.mode === "manual") {
                    // When the user picks "Enter Manually" from the
                    // preset dropdown, `next.start` / `next.end` are
                    // empty (the preset adapter doesn't carry wire
                    // dates). Seed `manualRange` from the active preset
                    // window so the chips open with meaningful values
                    // and the API receives a real range — mirrors the
                    // Approval Box FilterBar and the e-Invoices client.
                    const seed =
                        next.start && next.end
                            ? { fromDate: yyyymmddFromIso(next.start), toDate: yyyymmddFromIso(next.end) }
                            : computePresetRangeYyyymmdd(period);
                    onManualRangeChange?.(seed);
                    if (period !== "manual") onPeriodChange("manual");
                    return;
                }
                const nextPeriod = presetToPeriodKey(next.preset);
                if (nextPeriod !== period) onPeriodChange(nextPeriod);
            }}
            presetClassName="w-[var(--w-wb-st-period)]"
            formatValue={(iso) => formatIsoDateByLanguage(iso, locale)}
        />
    );
}

function periodToDateRangeFilterValue(
    period: PeriodKey,
    manualRange: ManualDateRange | undefined,
): DateRangeFilterValue {
    if (period === "manual") {
        // Inconsistent-state guard — if `period === "manual"` but no
        // `manualRange` is committed yet, fall back to the Last 30 Days
        // window so the chips never render empty. The onChange handler
        // above seeds `manualRange` on the next user interaction.
        const range = manualRange ?? computePresetRangeYyyymmdd("30d");
        return {
            mode:   "manual",
            preset: "last_30_days",
            start:  isoFromYyyymmdd(range.fromDate),
            end:    isoFromYyyymmdd(range.toDate),
        };
    }
    return {
        mode:   "preset",
        preset: periodKeyToPreset(period),
        start:  "",
        end:    "",
    };
}

/** Resolve the `yyyymmdd` window for the active preset, anchored to
 *  today. Used to seed `manualRange` the first time the user picks
 *  "Enter Manually" so the chips never open empty. */
function computePresetRangeYyyymmdd(period: PeriodKey): ManualDateRange {
    const days =
        period === "180d" ? 180
            : period === "90d"  ? 90
            : period === "7d"   ? 7
            : 30;
    const fmt = (d: Date): string =>
        d.getFullYear().toString().padStart(4, "0") +
        (d.getMonth() + 1).toString().padStart(2, "0") +
        d.getDate().toString().padStart(2, "0");
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    return { fromDate: fmt(start), toDate: fmt(today) };
}

function periodKeyToPreset(period: Exclude<PeriodKey, "manual">): DateRangeFilterPreset {
    switch (period) {
        case "180d": return "last_180_days";
        case "90d":  return "last_90_days";
        // 7d collapses onto the 30d chip — none of the Payment pages
        // surface a 7-day preset in their dropdown; the value only
        // appears in legacy data wiring.
        case "7d":
        case "30d":
        default:     return "last_30_days";
    }
}

function presetToPeriodKey(preset: DateRangeFilterPreset): PeriodKey {
    switch (preset) {
        case "last_180_days": return "180d";
        case "last_90_days":  return "90d";
        case "last_30_days":
        default:              return "30d";
    }
}

/* Date format helpers — yyyy-MM-dd (HTML <input type="date">) ↔
 * yyyyMMdd (backend wire format). */
function isoFromYyyymmdd(raw: string): string {
    if (!raw || raw.length !== 8) return "";
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}
function yyyymmddFromIso(iso: string): string {
    if (!iso || iso.length !== 10) return "";
    return iso.replace(/-/g, "");
}

/**
 * Render one canonical sort-aware column header. When the page passes
 * a `sortableColumns` entry for this column key the header becomes
 * clickable and routes the click into the page's `onSort` handler.
 * Pages that don't wire sort (mock-data twins) pass nothing and the
 * header renders as a plain non-clickable cell.
 */
function renderSortableHeader(
    columnKey: keyof ScheduledBatchSortable,
    label: React.ReactNode,
    sortableColumns: ScheduledBatchSortable | undefined,
    sort: { field: string | null; direction: ListSortDirection } | undefined,
    onSort: ((fieldId: string) => void) | undefined,
    align: "left" | "right" = "left",
) {
    const fieldId = sortableColumns?.[columnKey];
    if (fieldId && sort && onSort) {
        return (
            <TableHeaderCell
                textSizeClass="text-wb-13"
                align={align}
                sortFieldId={fieldId}
                activeSortField={sort.field}
                activeSortDirection={sort.direction}
                onSort={onSort}
            >
                {label}
            </TableHeaderCell>
        );
    }
    return <TableHeaderCell textSizeClass="text-wb-13" align={align}>{label}</TableHeaderCell>;
}

function ScheduledTitleActionGroup({
    onExcelUpload,
    onRefresh,
    refreshing,
    showRefresh,
    onPrint,
    onListView,
}: {
    onExcelUpload?: () => void;
    onRefresh?: () => void;
    /** True while a HAENGSUNG Refresh import is in flight (disables the button). */
    refreshing?: boolean;
    /** When true, render the Refresh button instead of Excel Upload
     *  (HAENGSUNG-only, legacy pymn_0001_001 parity). */
    showRefresh?: boolean;
    onPrint?: () => void;
    onListView?: (anchorRect: DOMRect) => void;
}) {
    return (
        <div className="flex items-center gap-2">
            <PageActionButtons
                showList
                showPrint
                onList={onListView}
                onPrint={onPrint}
            />
            {showRefresh ? (
                <RefreshButton onClick={onRefresh} refreshing={refreshing} />
            ) : (
                <ExcelUploadButton onClick={onExcelUpload} />
            )}
        </div>
    );
}

function RefreshButton({ onClick, refreshing }: { onClick?: () => void; refreshing?: boolean }) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick || refreshing}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-brand bg-white px-4 text-wb-14 font-medium text-brand hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
            <RefreshCw aria-hidden className={`size-4${refreshing ? " animate-spin" : ""}`} strokeWidth={2} />
            {t("common.refresh")}
        </button>
    );
}

function FilterDropdown({ label, width }: { label: string; width?: string }) {
    return (
        <button
            type="button"
            className="flex h-[var(--h-wb-filter-btn)] items-center justify-between gap-2 rounded-md border border-wb-ntrl-4 bg-white px-2.5 text-wb-13 font-medium text-wb-ink hover:bg-neutral-50"
            style={width ? { width } : undefined}
        >
            <span className="truncate">{label}</span>
            <ChevronDown
                aria-hidden
                className="size-4 shrink-0 text-wb-ntrl-6"
                strokeWidth={1.8}
            />
        </button>
    );
}

function ExcelUploadButton({ onClick }: { onClick?: () => void }) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-md bg-white px-4 text-wb-14 font-medium text-wb-ink shadow-wb-btn hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/assets/common/ico-excel.svg"
                alt=""
                aria-hidden
                className="size-5"
            />
            {t("payment.internal.excel_upload")}
        </button>
    );
}

/* ─────────────────────────── row ─────────────────────────── */

function ScheduledRow<Row extends PaymentScheduledBatchRow>({
    row,
    extraColumn,
    extraColumnAfterStatus,
    isVisible,
    dateTimeFieldId,
    fileNameFieldId,
    txnCountFieldId,
    totalAmountFieldId,
    statusFieldId,
    requestorFieldId,
    approvalRefFieldId,
    approverFieldId,
    approvalTitleFieldId,
    selected,
    onToggle,
    onActivate,
    onApprovalRefClick,
    onTransfer,
    onDelete,
    onDownload,
    canDeleteAction = true,
    canTransferAction = true,
    actionInFlight,
}: {
    row: Row;
    extraColumn?: ScheduledBatchExtraColumn<Row>;
    extraColumnAfterStatus?: ScheduledBatchExtraColumn<Row>;
    /** Visibility predicate from the shell — keyed by V85 FIELD_ID. */
    isVisible: FieldVisibility;
    dateTimeFieldId: string;
    fileNameFieldId: string;
    txnCountFieldId: string;
    totalAmountFieldId: string;
    statusFieldId: string;
    requestorFieldId: string;
    approvalRefFieldId: string;
    approverFieldId?: string;
    approvalTitleFieldId?: string;
    selected: boolean;
    onToggle: () => void;
    onActivate: () => void;
    /** Per-cell handler for the Approval Ref column — renders the
     *  value as a clickable affordance with click propagation stopped
     *  so the rest of the row still triggers `onActivate`. */
    onApprovalRefClick?: () => void;
    onTransfer?: () => void;
    onDelete?:   () => void;
    onDownload?: () => void;
    /** D-permission gate (default true) — ANDed into the Delete chip's
     *  existing row-state condition (`canDelete`). */
    canDeleteAction?: boolean;
    /** T-permission gate (default true) — ANDed into the Transfer chip's
     *  existing row-state condition (`action === "transfer"`). */
    canTransferAction?: boolean;
    /** Sticky-wrapped global mutation flag — disables row chips while a
     *  refresh / mutation is in flight. */
    actionInFlight?: boolean;
}) {
    const { t, locale } = useTranslation();
    const { date, time } = row.dateTimeRaw
        ? formatUtcDtmByLanguage(row.dateTimeRaw, locale)
        : splitLegacyDateTime(row.dateTime);

    return (
        <TableRow
            className={cn(
                "h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0",
                row.rowHighlight === "selected" && "bg-wb-status-progress-bg",
                row.rowHighlight === "warning" && "bg-wb-status-pending-bg",
            )}
        >
            <TableCell className="px-2.5 py-2.5">
                {/* Already-submitted rows (those with an approval ref)
                 *  can't be re-submitted via Request Approval — the
                 *  backend rejects with WBE2062 — so the checkbox is
                 *  disabled at the UI layer for clarity. Mirrors the
                 *  legacy `comm_0194_001` flow which short-circuits on
                 *  `APPR_SEQ_NO` before opening the approval dialog. */}
                <Checkbox
                    checked={selected}
                    onCheckedChange={onToggle}
                    disabled={Boolean(row.approvalRef)}
                    aria-label={t("payment.aria.select_file", { fileName: row.fileName })}
                />
            </TableCell>

            {isVisible(dateTimeFieldId) && (
                <BodyCell onClick={onActivate}>
                    <span className="block text-wb-13 font-medium text-wb-ink">{date}</span>
                    {time ? (
                        <span className="mt-0.5 block text-wb-12 font-normal text-wb-ntrl-6">
                            {time}
                        </span>
                    ) : null}
                </BodyCell>
            )}

            {isVisible(fileNameFieldId) && (
                <BodyCell onClick={onActivate}>
                    {/* Long file names clamp to 2 lines + ellipsis; the shared
                        <EllipsisTooltip> surfaces the full value on hover only
                        when the text actually overflows the clamp. `lines={2}`
                        keeps the fixed row height stable. */}
                    <EllipsisTooltip
                        text={row.fileName}
                        lines={2}
                        className="text-wb-13 font-medium text-wb-ink"
                    />
                </BodyCell>
            )}

            {isVisible(txnCountFieldId) && (
                <BodyCell onClick={onActivate} align="right">
                    <TextSpan>
                        {t("payment.internal.txn_count_with_currency", {
                            count: String(row.txnCount),
                            currency: row.txnCurrency,
                        })}
                    </TextSpan>
                </BodyCell>
            )}

            {isVisible(totalAmountFieldId) && (
                <BodyCell onClick={onActivate} align="right">
                    <TextSpan>{formatAmount(row.totalAmount, row.txnCurrency, false)}</TextSpan>
                </BodyCell>
            )}

            {extraColumn ? (
                <TableCell
                    onClick={onActivate}
                    className={cn(
                        "cursor-pointer px-2.5 py-2.5",
                        extraColumn.align === "right" && "text-right",
                        extraColumn.align === "center" && "text-center",
                    )}
                >
                    {extraColumn.render(row)}
                </TableCell>
            ) : null}

            {isVisible(statusFieldId) && (
                <TableCell className="px-2.5 py-2.5">
                    {row.status ? (
                        <StatusBadge
                            status={row.status}
                            step={row.statusStep}
                            label={t(`payment.status.${row.status}`)}
                        />
                    ) : null}
                </TableCell>
            )}

            {extraColumnAfterStatus ? (
                <TableCell
                    onClick={onActivate}
                    className={cn(
                        "cursor-pointer px-2.5 py-2.5",
                        extraColumnAfterStatus.align === "right" && "text-right",
                        extraColumnAfterStatus.align === "center" && "text-center",
                    )}
                >
                    {extraColumnAfterStatus.render(row)}
                </TableCell>
            ) : null}

            {isVisible(requestorFieldId) && (
                <BodyCell onClick={onActivate}>
                    <TextSpan>{row.requestor}</TextSpan>
                </BodyCell>
            )}

            {(approverFieldId === undefined || isVisible(approverFieldId)) && (
                <TableCell className="px-2.5 py-2.5">
                    {/* Shared Approver popover cell (same component as the
                       Approval Box). Name + count chip + chevron; click opens
                       the portal popover with the full approval chain. */}
                    <ApproverPopoverCell
                        name={row.approver}
                        count={
                            row.approverCount != null
                                ? String(row.approverCount)
                                : row.approvers && row.approvers.length > 0
                                  ? String(row.approvers.length)
                                  : null
                        }
                        approvers={scheduledBatchApproversToChain(row.approvers ?? [])}
                    />
                </TableCell>
            )}

            {isVisible(approvalRefFieldId) && (
                <BodyCell onClick={onActivate}>
                    {onApprovalRefClick && row.approvalRef ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                // Stop propagation so the row's
                                // `onActivate` (detail-page navigation)
                                // doesn't fire alongside the
                                // approval-details intent.
                                e.stopPropagation();
                                onApprovalRefClick();
                            }}
                            className="cursor-pointer text-wb-13 font-medium text-brand hover:underline"
                        >
                            {row.docNo ?? row.approvalRef}
                        </button>
                    ) : (
                        <TextSpan>{row.docNo ?? row.approvalRef}</TextSpan>
                    )}
                </BodyCell>
            )}

            {(approvalTitleFieldId === undefined || isVisible(approvalTitleFieldId)) && (
                <BodyCell onClick={onActivate}>
                    {/* Same 2-line clamp + shared-tooltip treatment as File Name —
                        long approval titles truncate after 2 lines and reveal the
                        full text on hover only when clipped. */}
                    <EllipsisTooltip
                        text={row.approvalTitle}
                        lines={2}
                        className="text-wb-13 font-medium leading-snug text-wb-ink"
                    />
                </BodyCell>
            )}

            <TableCell className="px-2.5 py-2.5">
                <RowAction
                    action={row.action}
                    canDelete={row.canDelete ?? false}
                    canDeleteAction={canDeleteAction}
                    canTransferAction={canTransferAction}
                    canDownloadFile={row.canDownloadFile ?? false}
                    transferDisabled={(row.transferDisabled ?? false) || Boolean(actionInFlight)}
                    deleteDisabled={Boolean(actionInFlight)}
                    downloadDisabled={Boolean(actionInFlight)}
                    onPrimary={onActivate}
                    onTransfer={onTransfer}
                    onDelete={onDelete}
                    onDownload={onDownload}
                />
            </TableCell>
        </TableRow>
    );
}

function BodyCell({
    children,
    onClick,
    align = "left",
}: {
    children: React.ReactNode;
    onClick?: () => void;
    align?: "left" | "right";
}) {
    return (
        <TableCell
            onClick={onClick}
            className={cn(
                "px-2.5 py-2.5",
                align === "right" && "text-right",
                onClick && "cursor-pointer",
            )}
        >
            {children}
        </TableCell>
    );
}

function TextSpan({ children }: { children: React.ReactNode }) {
    return (
        <span className="block truncate text-wb-13 font-medium text-wb-ink">
            {children}
        </span>
    );
}

/** Backward-compat fallback: split a legacy pre-formatted
 *  `"DD-MMM-YYYY\nHH:mm:ss"` value into its two display lines when a row
 *  doesn't carry the raw {@code dateTimeRaw} wire timestamp. */
function splitLegacyDateTime(value: string): { date: string; time: string } {
    const [d, tm] = (value ?? "").split("\n");
    return { date: d ?? "", time: tm ?? "" };
}

/**
 * Per-row action cell — mirrors legacy `pymn_0009_001.createActionCell`:
 *
 *   • Transfer / Check icon — only when `action === "transfer"` (not yet
 *     dispatched, awaiting send) or `action === "complete"` (TRNF_YN='Y',
 *     already dispatched).
 *   • Delete pill — only when `canDelete === true` (not yet submitted
 *     for approval, derived per-row by the page).
 *   • Download icon — only when `canDownloadFile === true` (uploaded
 *     Excel exists for the batch).
 *
 * Each control is rendered as soon as its row flag + matching callback
 * are both present; missing callbacks degrade the cell silently so
 * mock-data twins (Vendor / Expense / Payroll / Overseas) keep working.
 */
function RowAction({
    action,
    canDelete,
    canDeleteAction = true,
    canTransferAction = true,
    canDownloadFile,
    transferDisabled,
    deleteDisabled,
    downloadDisabled,
    onPrimary,
    onTransfer,
    onDelete,
    onDownload,
}: {
    action?: ScheduledBatchAction;
    canDelete: boolean;
    /** D-permission gate (default true). ANDed with the row-state
     *  `canDelete` flag — both must hold for the Delete pill to show. */
    canDeleteAction?: boolean;
    /** T-permission gate (default true). ANDed with `action === "transfer"`
     *  — both must hold for the Transfer chip to show. */
    canTransferAction?: boolean;
    canDownloadFile: boolean;
    transferDisabled: boolean;
    deleteDisabled?: boolean;
    downloadDisabled?: boolean;
    onPrimary: () => void;
    onTransfer?: () => void;
    onDelete?:   () => void;
    onDownload?: () => void;
}) {
    const { t } = useTranslation();

    // Suppress the row-click navigation when the user is clicking a
    // nested control — mirrors the legacy stopPropagation pattern so
    // the click doesn't fall through to the row's `onActivate`.
    const stop = (fn?: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        fn?.();
    };

    // Row-state condition AND the static R/D/T action-permission gate
    // (default true → unchanged). `complete` is a status indicator, not an
    // action, so it is NOT gated by the T permission.
    const showTransfer = action === "transfer" && canTransferAction;
    const showComplete = action === "complete";
    const showDelete   = canDelete && canDeleteAction && Boolean(onDelete);
    const showDownload = canDownloadFile && Boolean(onDownload);
    // Fallback so existing mock-data twins still get the document-glyph
    // detail trigger they had before this rewrite — only when no real
    // row-action is rendered.
    //
    // KNOWN NUANCE (accepted; do not change while perms are all true):
    // when `canTransferAction` is false on an approved-but-not-transferred
    // row, `showTransfer` becomes false and this fallback document glyph
    // becomes eligible — whereas legacy shows an empty cell. Harmless today
    // (the static R/D/T layer is all-true, so `showTransfer` is unchanged).
    // REVISIT when the real R/D/T permission API lands: a permission-hidden
    // Transfer should leave the cell empty, not fall through to this glyph.
    const showFallback = !showTransfer && !showComplete && !showDelete && !showDownload;

    return (
        <div className="flex items-center justify-end gap-1.5">
            {showTransfer && (
                <button
                    type="button"
                    onClick={stop(onTransfer ?? onPrimary)}
                    disabled={transferDisabled}
                    className={cn(
                        "flex h-7 items-center rounded-md border px-2 text-wb-13 font-medium",
                        transferDisabled
                            ? "cursor-not-allowed border-wb-ntrl-4 bg-wb-ntrl-3 text-wb-ntrl-6"
                            : "cursor-pointer border-wb-ntrl-4 bg-white text-wb-ink hover:bg-neutral-50",
                    )}
                >
                    {t("payment.internal.transfer_action")}
                </button>
            )}
            {showComplete && (
                <span
                    aria-label={t("payment.internal.transfer_completed")}
                    className="inline-flex size-5 items-center justify-center rounded-full bg-wb-status-approved-text text-white"
                >
                    <Check className="size-3" strokeWidth={3} />
                </span>
            )}
            {showDelete && (
                <button
                    type="button"
                    onClick={stop(onDelete)}
                    disabled={deleteDisabled}
                    aria-label={t("payment.internal.delete_action")}
                    className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-wb-status-rejected-text/40 bg-white px-2 text-wb-13 font-medium text-wb-status-rejected-text hover:bg-wb-status-rejected-bg disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Trash2 className="size-3.5" strokeWidth={1.8} />
                    {t("payment.internal.delete_action")}
                </button>
            )}
            {showDownload && (
                <button
                    type="button"
                    onClick={stop(onDownload)}
                    disabled={downloadDisabled}
                    aria-label={t("payment.internal.download_excel")}
                    className="flex size-6 cursor-pointer items-center justify-center rounded-md text-wb-ntrl-6 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <DownloadIcon />
                </button>
            )}
            {showFallback && <DocumentIcon onClick={stop(onPrimary)} />}
        </div>
    );
}

function DocumentIcon({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={t("payment.aria.open_detail")}
            className="flex size-6 cursor-pointer items-center justify-center rounded-md text-wb-ntrl-6 hover:bg-black/5"
        >
            <FileText className="size-4" strokeWidth={1.8} />
        </button>
    );
}

"use client";

import TableHeaderCell from "@/components/shared/TableHeaderCell";
import Tooltip from "@/components/shared/Tooltip";
import {
    isSpecialViewSettingField,
    ViewSettingColgroup,
    viewSettingMinWidth,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { Button } from "@/components/ui/button";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { SortDirection } from "@/hooks/useTableSort";
import { formatAmount } from "@/lib/currency";
import { formatDateTimeForView, humanizeDatetime, type TFunc } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { isEngineStatusSuccess } from "./mappers";
import {
    SOURCE_ACCOUNTS_COLUMN_REGISTRY,
    SOURCE_ACCOUNTS_FIELD_LABEL_KEYS,
    type SourceAccountColumnRenderContext,
} from "./source-accounts-columns";
import type { OwnAccountSourceRow } from "./types";

type SourceAccountsTableProps = {
    rows: OwnAccountSourceRow[];
    /** Visible columns from the shared {@link useViewSetting} hook
     *  (filtered to `use_yn==='Y'`, sorted by `disp_ord`, with special
     *  CHECKBOX/ETC rows preserved). The page hands this list down so
     *  header + body iterate the same column set in lockstep. */
    visibleColumns: ViewSettingItem[];
    /** Engine availability. When false the per-row Transfer button is
     *  disabled so the user can't click into a flow that's about to
     *  fail. The page surfaces the engine status banner separately. */
    engineReady: boolean;
    /** True when THIS row resolves its own saved cert material. Legacy
     *  gates per account, not per bank: `trns_0001_007.ts:1561-1584`
     *  reads `_v2nxisas.getCertInfo(BANK_CERT_SEQ)` from the row being
     *  transferred, and the linkage itself is per account
     *  (`ACCT_MSTR.BANK_CERT_SEQ`). A row that resolves nothing keeps
     *  showing — the account lives in Bank Account Management — but its
     *  scraping-dependent Transfer button is disabled with an
     *  explanatory tooltip. */
    rowHasCredentials: (row: OwnAccountSourceRow) => boolean;
    onTransfer: (row: OwnAccountSourceRow) => void;
    /** Common-sort triplet from `useTableSort()` (CLAUDE.md §13a).
     *  Omitting any of the three downgrades the header to a static
     *  inactive glyph (no click handler, no `aria-sort`). */
    sortField?:        string | null;
    sortDirection?:    SortDirection;
    onSort?:           (fieldId: string) => void;
    /** Translation key for the "no data" empty-state — keeps the cell
     *  copy localized while letting the page control the wording. */
    emptyMessageKey?:  string;
    className?:        string;
};

/**
 * Source-account picker for Banking > Own Account Transfer. Headers,
 * cells, and column widths are driven entirely by {@link visibleColumns}
 * + {@link SOURCE_ACCOUNTS_COLUMN_REGISTRY} — the same pattern
 * `AccountInquiryPage` follows (CLAUDE.md §13 / §13a).
 *
 * <p>Renders `<thead>` + `<tbody>` only — the summary row is a sibling
 * {@code <SourceAccountsTableFooter>} so the page can pin it to the
 * bottom of the scroll area via `mt-auto` (Approval Box pattern).
 *
 * <p>The per-row Transfer button (registered against the special
 * {@code ETC} column) is gated on:
 *   1. {@code row.canTransfer} — server-side permission check
 *      (ADMIN OR W-grant for the user on the row's account).
 *   2. {@code engineReady} — local NXiSAS bundle reachable.
 */
export default function SourceAccountsTable({
    rows,
    visibleColumns,
    engineReady,
    rowHasCredentials,
    onTransfer,
    sortField,
    sortDirection,
    onSort,
    emptyMessageKey,
    className,
}: SourceAccountsTableProps) {
    const { t } = useTranslation();

    // Column widths come from the live View Setting `size` (DB single
    // source of truth, CLAUDE.md §13). `visibleColumns` already includes
    // the trailing ETC action column (seeded 110px), so a single
    // ViewSettingColgroup covers the whole table. `min-width` = Σ visible
    // DB sizes — legacy stretches to fill above it, locks + scrolls below.
    const minWidth = viewSettingMinWidth(visibleColumns, { fallback: "1100px" });

    return (
        <table
            className={cn("w-full table-fixed border-collapse", className)}
            style={{ minWidth }}
        >
            <ViewSettingColgroup items={visibleColumns} defaultFallback="160px" />

            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    {visibleColumns.map((col) => {
                        const def = SOURCE_ACCOUNTS_COLUMN_REGISTRY[col.field_id];
                        if (!def) return null;
                        // Legacy JEX parity (trns_0001_001_view.jsp): the
                        // row-action column at the right edge has NO
                        // header text. Suppress the i18n label for the
                        // special ETC row even though the column is still
                        // present in the colgroup + tbody.
                        const isAction = isSpecialViewSettingField(col.field_id);
                        const labelKey = SOURCE_ACCOUNTS_FIELD_LABEL_KEYS[col.field_id];
                        const label    = isAction
                            ? ""
                            : (labelKey ? t(labelKey) : col.field_nm);
                        // §13a — column is sortable only when (a) its
                        // View Setting `SORT_YN === "Y"`, (b) it is NOT
                        // a special CHECKBOX/ETC row, and (c) the page
                        // wired the `onSort` triplet.
                        const sortable =
                            col.sort_yn === "Y" &&
                            !isAction &&
                            !!onSort;
                        return (
                            <TableHeaderCell
                                key={col.field_id}
                                textSizeClass="text-wb-13"
                                align={def.align}
                                className={def.headerClassName}
                                sortable={sortable}
                                sortFieldId={sortable ? col.field_id : undefined}
                                activeSortField={sortField}
                                activeSortDirection={sortDirection}
                                onSort={sortable ? onSort : undefined}
                            >
                                {label}
                            </TableHeaderCell>
                        );
                    })}
                </TableRow>
            </TableHeader>

            <TableBody>
                {/* Empty state — page (parent) renders a sibling flex-1
                   div with the empty / loading copy BELOW this table
                   (mirrors Banking > Transfer History + Settings >
                   VAS Account). The table itself just renders an empty
                   tbody so the column headers stay sticky and aligned.
                   {@link emptyMessageKey} is retained on the prop
                   surface for future variants that want an in-tbody
                   message (none today). */}
                {rows.length === 0 ? null : (
                    rows.map((row) => {
                        const ctx: SourceAccountColumnRenderContext = {
                            row,
                            t,
                            engineReady,
                            onTransfer,
                            hasCredentials: rowHasCredentials(row),
                        };
                        return (
                            <TableRow
                                key={`${row.bankCd}:${row.acctNo}`}
                                className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
                            >
                                {visibleColumns.map((col) => {
                                    const def = SOURCE_ACCOUNTS_COLUMN_REGISTRY[col.field_id];
                                    if (!def) return null;
                                    return (
                                        <TableCell
                                            key={col.field_id}
                                            className={def.cellClassName}
                                        >
                                            {def.renderBody(ctx)}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        );
                    })
                )}
            </TableBody>
        </table>
    );
}

/* re-exported helpers ---------------------------------------------------- */

/**
 * Stable composite cell used by the {@code ACCT_BAL_LST_STS} column.
 * Lives here (not in the registry module) so the registry stays a
 * pure data table — the component itself owns the cell visuals.
 */
export function LastRefreshCell({
    t,
    stts,
    lastInquiryAt,
    successLabel,
    failedLabel,
}: {
    t:             TFunc;
    stts:          string | null;
    lastInquiryAt: string | null;
    successLabel:  string;
    failedLabel:   string;
}) {
    // No status and no inquiry time → render blank (not a dash).
    if (!stts && !lastInquiryAt) {
        return null;
    }
    const isSuccess = isEngineStatusSuccess(stts);
    // `lastInquiryAt` is the RAW UTC `ACCT_BAL_LST_INQ_DTM` (the backend ships
    // it unshifted — same contract as Account Inquiry). `humanizeDatetime`
    // parses it as UTC and diffs against the absolute now, so the relative
    // "X ago" is correct; pass `t` so it localises (EN/KO/VI).
    const subText   = lastInquiryAt
        ? humanizeDatetime(lastInquiryAt, t)
        : formatDateTimeForView(lastInquiryAt);
    return (
        <div className="flex flex-col">
            <span
                className={cn(
                    "text-wb-13 font-medium",
                    isSuccess
                        ? "text-wb-status-approved-text"
                        : "text-wb-status-rejected-text",
                )}
            >
                {isSuccess ? successLabel : failedLabel}
            </span>
            <span className="text-wb-13 font-medium text-wb-muted">{subText}</span>
        </div>
    );
}

/**
 * Per-row Transfer action used by the {@code ETC} column.
 * Re-exported so the registry can reference it without importing the
 * table file (which would create a circular module).
 */
export function TransferActionCell({
    row,
    engineReady,
    hasCredentials,
    supportsTransfer,
    onTransfer,
    label,
    noCredentialsTooltip,
    unsupportedTooltip,
}: {
    row:         OwnAccountSourceRow;
    engineReady: boolean;
    /** False when the row's bank has no saved Login Credentials. The
     *  account still shows; the Transfer button is disabled because the
     *  flow needs the bank-login scrape. */
    hasCredentials: boolean;
    /** False when the account's NXiSAS module class supports no transfer
     *  job at all — Vietcom iB@nking (CORPORATE) today. The transfer
     *  could only ever fail at the bank, so the row is disabled up front
     *  rather than after a wasted engine round-trip. */
    supportsTransfer: boolean;
    onTransfer:  (row: OwnAccountSourceRow) => void;
    label:       string;
    /** Hover message shown when the button is disabled specifically
     *  because the bank's Login Credentials were deleted. */
    noCredentialsTooltip: string;
    /** Hover message when the module simply cannot transfer — tells the
     *  user to register the DigiBiz login instead. */
    unsupportedTooltip: string;
}) {
    const disabled = !row.canTransfer || !engineReady || !hasCredentials || !supportsTransfer;
    // Tooltip only for the two reasons the user can act on (not
    // engine-loading / permission). "Cannot transfer at all" is checked
    // first: when a Vietcom CORPORATE account ALSO lacks credentials,
    // registering them would not help — the module still has no transfer
    // job — so the actionable message is the DigiBiz one. The shared
    // <Tooltip> wraps the button in a <span> that owns the hover
    // listeners, so the message shows even though the <button> itself is
    // disabled.
    const tooltip = !supportsTransfer
        ? unsupportedTooltip
        : (!hasCredentials ? noCredentialsTooltip : undefined);
    return (
        <Tooltip content={tooltip}>
            <Button
                type="button"
                variant="outline"
                className="h-8 px-4 text-wb-13"
                disabled={disabled}
                onClick={() => onTransfer(row)}
            >
                {label}
            </Button>
        </Tooltip>
    );
}

/** ACCT_TYPE_CD → display label. Mirrors Account Inquiry's narrow
 *  vocabulary ({@code "Current" | "Savings" | "Fixed"}). OAT's backend
 *  query filters to {@code acct_type_cd IN ('03','05')} for the default
 *  product type and adds {@code '06','08'} for HAENGSUNG saving variants
 *  (per legacy {@code trns_0001_001_r001_act.jsp:74-77}). Unknown codes
 *  fall back to the raw value — defensive only; the server query won't
 *  return them today. */
function acctTypeLabel(code: string | null | undefined): string {
    if (!code) return "";
    switch (code) {
        case "03": return "Current";
        case "05":
        case "06":
        case "08":
            return "Savings";
        default:  return code;
    }
}

/**
 * Bank / account-type composite cell used by the {@code BANK_CD}
 * column. Mirrors Banking &gt; Account Inquiry's `BANK` cell exactly
 * — {@code bankName + icon + "VND • {type}"} on the first line,
 * account number on the second. The icon sits BETWEEN the bank name
 * and the chip (legacy Account Inquiry decision, not a mistake).
 */
export function BankCell({ row }: { row: OwnAccountSourceRow }) {
    const typeLabel = acctTypeLabel(row.acctTypeCd);
    const chip = typeLabel
        ? `${row.ccyCd} • ${typeLabel}`
        : row.ccyCd;
    return (
        <div className="flex flex-col items-start">
            <div className="flex items-start gap-1">
                <span className="whitespace-nowrap text-wb-13 font-medium leading-5 text-wb-ink">
                    {row.bankNm}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/assets/table/ico-building.svg"
                    alt=""
                    aria-hidden
                    className="size-[var(--size-wb-icon-sm)] shrink-0 opacity-50"
                />
                <span className="whitespace-nowrap text-wb-13 font-medium leading-5 text-wb-ink">
                    {chip}
                </span>
            </div>
            <span className="whitespace-nowrap text-wb-13 font-medium leading-5 text-wb-muted">
                {row.acctNo}
            </span>
        </div>
    );
}

/** Right-aligned amount cell used by Balance / Available columns. */
export function AmountCell({ value, ccyCd }: { value: number; ccyCd: string }) {
    return (
        <span className="text-wb-13 font-medium text-wb-ink">
            {formatAmount(value, ccyCd, false)}
        </span>
    );
}

/** Plain text cell used by Account / generic string columns. */
export function PlainTextCell({ text }: { text: string }) {
    return <span className="text-wb-13 font-medium text-wb-dark">{text}</span>;
}

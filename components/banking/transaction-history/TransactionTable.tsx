"use client";

import TableHeaderCell from "@/components/shared/TableHeaderCell";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import ContactSelect from "./ContactSelect";
import PurposeSelect from "./PurposeSelect";
import ReportingAccountSelect from "./ReportingAccountSelect";
import TransactionTableColumns, {
    TRANSACTION_TABLE_MIN_WIDTH,
} from "./TransactionTableColumns";
import VasAccountSelect from "./VasAccountSelect";
import type {
    ContactOption,
    PurposeOption,
    ReportingAccountOption,
    TransactionRow,
    VasAccountOption,
} from "./types";

type TransactionTableProps = {
    rows: TransactionRow[];
    onConfirm?: (rowId: string) => void;
    onUndo?: (rowId: string) => void;
    /** Open the Smart Organizer popup anchored on this row. Replaces
     *  the toolbar's blanket "open for first row" behaviour with a
     *  per-row link (legacy `comm_0196_001` parity — `Match to Payment
     *  Transaction` / `Unmatch` lives in the File Name column). */
    onOrganize?: (rowId: string) => void;
    /** Full Reporting Account picker list (chart of accounts). Empty
     *  array hides the dropdown until the loader resolves — the cell
     *  still renders, just without selectable options. */
    reportingAccountOptions: ReportingAccountOption[];
    /** Fires when the user picks a Reporting Account for one row.
     *  Wrapper owns persistence (PUT to the transaction endpoint). */
    onReportingAccountChange?: (
        rowId: string,
        next: ReportingAccountOption,
    ) => void;
    /** Fires when the user clears (× button) the Reporting Account
     *  on one row. Wrapper sends a DELETE. */
    onReportingAccountClear?: (rowId: string) => void;
    /** Full Purpose picker list (`BUSI_USAG_SET_INFM`). */
    purposeOptions: PurposeOption[];
    /** Recent picks for the active user (most recent first), surfaced
     *  in the popover's "RECENT" section. */
    recentPurposeUseUsagCds: string[];
    /** Fires when the user picks a Purpose for one row. */
    onPurposeChange?: (rowId: string, next: PurposeOption) => void;
    /** Fires when the user clears the Purpose for one row. */
    onPurposeClear?: (rowId: string) => void;
    /** Full VAS Account picker list (`BUSI_VAS_ACCT_INFM`). */
    vasAccountOptions: VasAccountOption[];
    /** Recent VAS picks for the active user (most recent first). */
    recentVasAcctCds: string[];
    /** Fires when the user picks a VAS Account for one row. */
    onVasAccountChange?: (rowId: string, next: VasAccountOption) => void;
    /** Fires when the user clears the VAS Account for one row. */
    onVasAccountClear?: (rowId: string) => void;
    /** Full Contact picker list (`TRCO_INFM`). */
    contactOptions: ContactOption[];
    /** Recent Contact picks for the active user (most recent first). */
    recentContactTrcoKeys: string[];
    /** Fires when the user picks a Contact for one row. */
    onContactChange?: (rowId: string, next: ContactOption) => void;
    /** Fires when the user clears the Contact for one row. */
    onContactClear?: (rowId: string) => void;
    /** Minimum table width in px — must match the footer's `minWidth`. */
    minWidth?: string;
    className?: string;
};

/**
 * Transaction history table aligned with the legacy on-screen layout
 * (10 columns):
 *
 *   1 Transaction ID  · 2 Date/Time  · 3 Deposit · 4 Withdrawal ·
 *   5 Balance         · 6 Remarks    · 7 File Name · 8 Matched Date ·
 *   9 Matched By      · 10 Purpose
 *
 * The summary row is a sibling `<TransactionTableFooter>` pinned to the
 * bottom of the scroll container via `mt-auto` (Approval Box canonical
 * pattern, CLAUDE.md §7a); both tables import the same
 * `TransactionTableColumns` so the Deposit / Withdrawal totals align
 * under their columns.
 *
 * Unconfirmed rows render with the legacy yellow tint plus a row-level
 * Confirm action; confirmed rows render read-only with an Undo action.
 * The Confirm/Undo affordance lives in the Matched By cell so the
 * column structure exactly matches image 2 (no separate Action column).
 */
export default function TransactionTable({
    rows,
    onConfirm,
    onUndo,
    onOrganize,
    reportingAccountOptions,
    onReportingAccountChange,
    onReportingAccountClear,
    purposeOptions,
    recentPurposeUseUsagCds,
    onPurposeChange,
    onPurposeClear,
    vasAccountOptions,
    recentVasAcctCds,
    onVasAccountChange,
    onVasAccountClear,
    contactOptions,
    recentContactTrcoKeys,
    onContactChange,
    onContactClear,
    minWidth = TRANSACTION_TABLE_MIN_WIDTH,
    className,
}: TransactionTableProps) {
    const { t } = useTranslation();
    return (
        <table
            className={cn("w-full table-fixed border-collapse", className)}
            style={{ minWidth }}
        >
            <TransactionTableColumns />

            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell>{t("txn_history.col.transaction_id")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.date_time")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.deposit")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.withdraw")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.balance")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.remarks")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.file_name")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.matched_date")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.matched_by")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.reporting_account")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.purpose")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.vas_account")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.contact_name")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.confirmed_by")}</TableHeaderCell>
                    <TableHeaderCell sortable={false}>&nbsp;</TableHeaderCell>
                </TableRow>
            </TableHeader>

            <TableBody>
                {rows.length === 0 ? (
                    <TableRow className="h-[var(--h-wb-table-row)] border-b border-wb-table-border">
                        <TableCell
                            colSpan={15}
                            className="px-2.5 py-6 text-center align-middle text-wb-13 font-medium text-wb-muted"
                        >
                            {t("common.no_rows")}
                        </TableCell>
                    </TableRow>
                ) : (
                    rows.map((row) => {
                        const isMatched = row.linkMatchYn === "Y";
                        const matchedDate =
                            row.matchedDate ?? row.confirmedBy?.date ?? null;
                        const matchedBy =
                            row.matchedBy ?? row.confirmedBy?.name ?? null;
                        // Legacy `fnsh_0002_001` only tints the
                        // matching-panel cluster (Purpose / Contact
                        // Name / Confirmed by) yellow when the row is
                        // unmatched — those columns are user-editable
                        // / pending input. The bank-statement and
                        // metadata columns on the left stay white.
                        // `panelTint` is the conditional class applied
                        // ONLY to the matching-panel cells below.
                        const panelTint = isMatched ? "" : "bg-[#FFFEDB]";
                        return (
                            <TableRow
                                key={row.id}
                                className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
                            >
                                {/* 1. Transaction ID */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <span className="text-wb-13 font-medium text-wb-ink">
                                        {row.transactionId ?? ""}
                                    </span>
                                </TableCell>

                                {/* 2. Date/Time */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <div className="flex flex-col">
                                        <span className="text-wb-13 font-medium text-wb-ink">
                                            {row.date}
                                        </span>
                                        <span className="text-wb-13 font-medium text-wb-muted">
                                            {row.time}
                                        </span>
                                    </div>
                                </TableCell>

                                {/* 3. Deposit — legacy left-aligns
                                     numeric columns. Green tint
                                     preserved from refactor for the
                                     deposit / withdraw visual cue. */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <span className="text-wb-13 font-medium text-wb-status-approved-text">
                                        {row.deposit ?? "0"}
                                    </span>
                                </TableCell>

                                {/* 4. Withdrawal */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <span className="text-wb-13 font-medium text-wb-status-rejected-text">
                                        {row.withdraw ?? "0"}
                                    </span>
                                </TableCell>

                                {/* 5. Balance */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <span className="text-wb-13 font-medium text-wb-ink">
                                        {row.balance}
                                    </span>
                                </TableCell>

                                {/* 6. Remarks */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <span className="block text-wb-13 font-normal leading-[1.45] text-wb-muted">
                                        {row.remarks}
                                    </span>
                                </TableCell>

                                {/* 7. File Name — when matched, shows the
                                     payment-batch file name + an `Unmatch`
                                     link below; when unmatched, shows the
                                     `Match to Payment Transaction` link
                                     that opens the Smart Organizer popup
                                     (legacy `comm_0196_001` per-row entry). */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    {isMatched ? (
                                        <div className="flex flex-col">
                                            {row.fileName && (
                                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                                    {row.fileName}
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => onOrganize?.(row.id)}
                                                className="self-start text-wb-13 font-medium text-brand underline underline-offset-2 hover:text-brand-hover"
                                            >
                                                {t("smart_organizer.unmatch")}
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => onOrganize?.(row.id)}
                                            className="block text-left text-wb-13 font-medium text-brand underline underline-offset-2 hover:text-brand-hover"
                                        >
                                            {t("smart_organizer.match_link")}
                                        </button>
                                    )}
                                </TableCell>

                                {/* 8. Matched Date */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <span className="text-wb-13 font-medium text-wb-ink">
                                        {isMatched ? (matchedDate ?? "—") : ""}
                                    </span>
                                </TableCell>

                                {/* 9. Matched By */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <span className="truncate text-wb-13 font-medium text-wb-ink">
                                        {isMatched ? (matchedBy ?? "—") : ""}
                                    </span>
                                </TableCell>

                                {/* 10. Reporting Account — chart-of-accounts
                                     picker. Legacy `fnsh_0200_001_view.jsp`
                                     line 327: when `CHART_ACCT_CD` is null
                                     the cell shows the brand-blue "Select
                                     Account" placeholder; when assigned it
                                     shows "Code - Name" + muted breadcrumb
                                     (`CHART_ACCT_LEVEL_NM`). Cell intentionally
                                     does NOT carry the yellow `panelTint` —
                                     Reporting Account assignment is an
                                     orthogonal classification (independent
                                     of matching state) and follows the
                                     legacy `pic-infor` styling that stays
                                     white in both matched and unmatched
                                     rows. */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <ReportingAccountSelect
                                        value={
                                            row.chartAcctSeqNo &&
                                            row.reportingAccountCode &&
                                            row.reportingAccountName
                                                ? {
                                                      chartAcctSeqNo:
                                                          row.chartAcctSeqNo,
                                                      code: row.reportingAccountCode,
                                                      name: row.reportingAccountName,
                                                      breadcrumb:
                                                          row.reportingAccountBreadcrumb ??
                                                          null,
                                                  }
                                                : null
                                        }
                                        options={reportingAccountOptions}
                                        onChange={(next) =>
                                            onReportingAccountChange?.(row.id, next)
                                        }
                                        onClear={
                                            onReportingAccountClear
                                                ? () =>
                                                      onReportingAccountClear(row.id)
                                                : undefined
                                        }
                                    />
                                </TableCell>

                                {/* 11. Purpose — `USE_USAG_CD` from
                                     `ACCT_TRNS_RCV_PAY_INFM`. Cell is
                                     ALWAYS rendered with the legacy
                                     yellow tint (`bg-[#FFFEDB]`) per
                                     the design brief — the column
                                     stays visually distinct from the
                                     matching-cluster yellow which is
                                     conditional. Inside the cell, a
                                     small pencil icon opens the
                                     dropdown picker; the value (when
                                     assigned) renders above it. */}
                                <TableCell className="bg-[#FFFEDB] px-2.5 py-2.5 align-middle">
                                    <PurposeSelect
                                        value={
                                            row.useUsagCd &&
                                            row.purposeCode &&
                                            row.purposeName
                                                ? {
                                                      useUsagCd: row.useUsagCd,
                                                      code:      row.purposeCode,
                                                      name:      row.purposeName,
                                                  }
                                                : null
                                        }
                                        options={purposeOptions}
                                        recentUseUsagCds={recentPurposeUseUsagCds}
                                        onChange={(next) =>
                                            onPurposeChange?.(row.id, next)
                                        }
                                        onClear={
                                            onPurposeClear
                                                ? () =>
                                                      onPurposeClear(row.id)
                                                : undefined
                                        }
                                    />
                                </TableCell>

                                {/* 12. VAS Account — `VAS_ACCT_CD` from
                                     `ACCT_TRNS_RCV_PAY_INFM`. Yellow tint
                                     mirrors the Purpose column (both are
                                     editable classification fields), with
                                     the same pencil-on-hover affordance. */}
                                <TableCell className="bg-[#FFFEDB] px-2.5 py-2.5 align-middle">
                                    <VasAccountSelect
                                        value={
                                            row.vasAcctCd && row.vasAcctName
                                                ? {
                                                      vasAcctCd:  row.vasAcctCd,
                                                      name:       row.vasAcctName,
                                                  }
                                                : null
                                        }
                                        options={vasAccountOptions}
                                        recentVasAcctCds={recentVasAcctCds}
                                        onChange={(next) =>
                                            onVasAccountChange?.(row.id, next)
                                        }
                                        onClear={
                                            onVasAccountClear
                                                ? () => onVasAccountClear(row.id)
                                                : undefined
                                        }
                                    />
                                </TableCell>

                                {/* 13. Contact Name — `RCV_PAY_TRCO_KEY`
                                     + `RCV_PAY_TRCO_NM` snapshot from
                                     `ACCT_TRNS_RCV_PAY_INFM`. Yellow tint
                                     mirrors the Purpose / VAS columns
                                     (all three are editable classification
                                     fields), with the same pencil-on-hover
                                     affordance. */}
                                <TableCell className="bg-[#FFFEDB] px-2.5 py-2.5 align-middle">
                                    <ContactSelect
                                        value={
                                            row.rcvPayTrcoKey && row.rcvPayTrcoNm
                                                ? {
                                                      trcoKey:     row.rcvPayTrcoKey,
                                                      // The snapshot is the only
                                                      // place we have the picker's
                                                      // user-visible hand-key, so
                                                      // when the master option list
                                                      // doesn't include this row's
                                                      // contact (deleted / trashed)
                                                      // we still render the
                                                      // captured name without a
                                                      // separate hand-key. The
                                                      // wrapper joins against the
                                                      // option list to fill the
                                                      // hand-key where possible.
                                                      handTrcoKey:
                                                          contactOptions.find(
                                                              (o) =>
                                                                  o.trcoKey ===
                                                                  row.rcvPayTrcoKey,
                                                          )?.handTrcoKey ?? "",
                                                      name: row.rcvPayTrcoNm,
                                                  }
                                                : null
                                        }
                                        options={contactOptions}
                                        recentTrcoKeys={recentContactTrcoKeys}
                                        onChange={(next) =>
                                            onContactChange?.(row.id, next)
                                        }
                                        onClear={
                                            onContactClear
                                                ? () => onContactClear(row.id)
                                                : undefined
                                        }
                                    />
                                </TableCell>

                                {/* 14. Confirmed by */}
                                <TableCell className={cn("px-2.5 py-2.5 align-middle", panelTint)}>
                                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                        {row.confirmed && row.confirmedBy
                                            ? row.confirmedBy.name
                                            : ""}
                                    </span>
                                </TableCell>

                                {/* 15. Action — Confirm / Undo as a small
                                     white outline button. Matches legacy
                                     `fnsh_0002_001` chrome (NOT the
                                     brand-blue full-width CTA). The
                                     cell shares the same yellow tint
                                     as the matching-panel cluster when
                                     the row is unmatched. */}
                                <TableCell className={cn("px-2.5 py-2.5 align-middle", panelTint)}>
                                    {row.confirmed ? (
                                        <button
                                            type="button"
                                            onClick={() => onUndo?.(row.id)}
                                            className="flex h-7 w-full cursor-pointer items-center justify-center rounded-md border border-wb-ntrl-4 bg-white px-2.5 text-wb-12 font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                                        >
                                            {t("txn_history.action.undo")}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => onConfirm?.(row.id)}
                                            className="flex h-7 w-full cursor-pointer items-center justify-center rounded-md border border-wb-ntrl-4 bg-white px-2.5 text-wb-12 font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                                        >
                                            {t("txn_history.action.confirm")}
                                        </button>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })
                )}
            </TableBody>
        </table>
    );
}

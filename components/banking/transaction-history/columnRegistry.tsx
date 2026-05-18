"use client";

import ContactSelect from "./ContactSelect";
import PurposeSelect from "./PurposeSelect";
import ReportingAccountSelect from "./ReportingAccountSelect";
import VasAccountSelect from "./VasAccountSelect";
import type {
    ContactOption,
    PurposeOption,
    ReportingAccountOption,
    TransactionRow,
    VasAccountOption,
} from "./types";

/**
 * Per-row context handed to every column renderer in the Transaction
 * History table. Mirrors the props the legacy hardcoded JSX received,
 * but routed through one object so {@link TransactionColumnDef.renderBody}
 * can stay declarative and pure.
 *
 * The four picker subcomponents (Reporting Account / Purpose / VAS /
 * Contact) are imported directly in this file rather than threaded
 * through context — the registry is the only consumer.
 */
export type TransactionColumnContext = {
    row: TransactionRow;
    t: (key: string, vars?: Record<string, string | number>) => string;
    /** `"bg-[#FFFEDB]"` when the row is unmatched, `""` otherwise.
     *  Applied conditionally to the matching-panel cluster (Confirmed by). */
    panelTint: string;
    isMatched: boolean;
    onOrganize?: (rowId: string) => void;
    reportingAccountOptions: ReportingAccountOption[];
    onReportingAccountChange?: (
        rowId: string,
        next: ReportingAccountOption,
    ) => void;
    onReportingAccountClear?: (rowId: string) => void;
    purposeOptions: PurposeOption[];
    recentPurposeUseUsagCds: string[];
    onPurposeChange?: (rowId: string, next: PurposeOption) => void;
    onPurposeClear?: (rowId: string) => void;
    vasAccountOptions: VasAccountOption[];
    recentVasAcctCds: string[];
    onVasAccountChange?: (rowId: string, next: VasAccountOption) => void;
    onVasAccountClear?: (rowId: string) => void;
    contactOptions: ContactOption[];
    recentContactTrcoKeys: string[];
    onContactChange?: (rowId: string, next: ContactOption) => void;
    onContactClear?: (rowId: string) => void;
};

export type TransactionColumnDef = {
    /** i18n key for the header label. */
    headerKey: string;
    /** Fallback column width — used when the View Setting `SIZE` field
     *  is blank. */
    defaultWidth: string;
    /** Per-cell className extension. The base `px-2.5 py-2.5 align-middle`
     *  is applied by the table; the registry returns the additional
     *  classes (e.g. an always-yellow tint for Purpose / VAS / Contact). */
    cellClassName?: (ctx: TransactionColumnContext) => string | undefined;
    renderBody: (ctx: TransactionColumnContext) => React.ReactNode;
};

/**
 * DB FIELD_ID → renderer map for the Transaction History table.
 *
 * Keys mirror the V128 / V157 / V159 `SYS_SCR_OPTION_WECMS` seed for
 * `web_svc_id = 'banking-transaction-history'`. Adding a new column is
 * one entry here + (a) a matching SYS_SCR_OPTION seed row in Flyway
 * and (b) a `headerKey` translation in `locales/{en,ko,vi}.json`.
 */
export const TRANSACTION_HISTORY_COLUMN_REGISTRY: Record<string, TransactionColumnDef> = {
    TRSC_ID: {
        headerKey: "txn_history.col.transaction_id",
        defaultWidth: "160px",
        renderBody: ({ row }) => (
            <span className="text-wb-13 font-medium text-wb-ink">
                {row.transactionId ?? ""}
            </span>
        ),
    },
    TRSC_DTM: {
        headerKey: "txn_history.col.date_time",
        defaultWidth: "160px",
        renderBody: ({ row }) => (
            <div className="flex flex-col">
                <span className="text-wb-13 font-medium text-wb-ink">
                    {row.date}
                </span>
                <span className="text-wb-13 font-medium text-wb-muted">
                    {row.time}
                </span>
            </div>
        ),
    },
    DEPOSIT_AMT: {
        headerKey: "txn_history.col.deposit",
        defaultWidth: "140px",
        renderBody: ({ row }) => (
            <span className="text-wb-13 font-medium text-wb-status-approved-text">
                {row.deposit ?? "0"}
            </span>
        ),
    },
    WITHDRAW_AMT: {
        headerKey: "txn_history.col.withdraw",
        defaultWidth: "140px",
        renderBody: ({ row }) => (
            <span className="text-wb-13 font-medium text-wb-status-rejected-text">
                {row.withdraw ?? "0"}
            </span>
        ),
    },
    BAL: {
        headerKey: "txn_history.col.balance",
        defaultWidth: "140px",
        renderBody: ({ row }) => (
            <span className="text-wb-13 font-medium text-wb-ink">
                {row.balance}
            </span>
        ),
    },
    RMRK: {
        headerKey: "txn_history.col.remarks",
        defaultWidth: "240px",
        renderBody: ({ row }) => (
            <span className="block text-wb-13 font-normal leading-[1.45] text-wb-muted">
                {row.remarks}
            </span>
        ),
    },
    FILE_NM: {
        headerKey: "txn_history.col.file_name",
        defaultWidth: "180px",
        renderBody: ({ row, isMatched, onOrganize, t }) =>
            isMatched ? (
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
            ),
    },
    MTCH_DT: {
        headerKey: "txn_history.col.matched_date",
        defaultWidth: "140px",
        renderBody: ({ row, isMatched }) => {
            const matchedDate = row.matchedDate ?? row.confirmedBy?.date ?? null;
            return (
                <span className="text-wb-13 font-medium text-wb-ink">
                    {isMatched ? (matchedDate ?? "—") : ""}
                </span>
            );
        },
    },
    MTCH_BY: {
        headerKey: "txn_history.col.matched_by",
        defaultWidth: "120px",
        renderBody: ({ row, isMatched }) => {
            const matchedBy = row.matchedBy ?? row.confirmedBy?.name ?? null;
            return (
                <span className="truncate text-wb-13 font-medium text-wb-ink">
                    {isMatched ? (matchedBy ?? "—") : ""}
                </span>
            );
        },
    },
    CHART_ACCT_CD: {
        headerKey: "txn_history.col.reporting_account",
        defaultWidth: "190px",
        // Reporting Account assignment is orthogonal to matching state
        // and follows the legacy `pic-infor` styling that stays white
        // in both matched and unmatched rows — no tint.
        renderBody: ({
            row,
            reportingAccountOptions,
            onReportingAccountChange,
            onReportingAccountClear,
        }) => {
            return (
                <ReportingAccountSelect
                    value={
                        row.chartAcctSeqNo &&
                        row.reportingAccountCode &&
                        row.reportingAccountName
                            ? {
                                  chartAcctSeqNo: row.chartAcctSeqNo,
                                  code: row.reportingAccountCode,
                                  name: row.reportingAccountName,
                                  breadcrumb: row.reportingAccountBreadcrumb ?? null,
                              }
                            : null
                    }
                    options={reportingAccountOptions}
                    onChange={(next) => onReportingAccountChange?.(row.id, next)}
                    onClear={
                        onReportingAccountClear
                            ? () => onReportingAccountClear(row.id)
                            : undefined
                    }
                />
            );
        },
    },
    PURPOSE: {
        headerKey: "txn_history.col.purpose",
        defaultWidth: "140px",
        // Purpose is always tinted yellow — editable classification
        // field independent of matching state.
        cellClassName: () => "bg-[#FFFEDB]",
        renderBody: ({
            row,
            purposeOptions,
            recentPurposeUseUsagCds,
            onPurposeChange,
            onPurposeClear,
        }) => {
            return (
                <PurposeSelect
                    value={
                        row.useUsagCd && row.purposeCode && row.purposeName
                            ? {
                                  useUsagCd: row.useUsagCd,
                                  code: row.purposeCode,
                                  name: row.purposeName,
                              }
                            : null
                    }
                    options={purposeOptions}
                    recentUseUsagCds={recentPurposeUseUsagCds}
                    onChange={(next) => onPurposeChange?.(row.id, next)}
                    onClear={onPurposeClear ? () => onPurposeClear(row.id) : undefined}
                />
            );
        },
    },
    VAS_ACCT_CD: {
        headerKey: "txn_history.col.vas_account",
        defaultWidth: "200px",
        cellClassName: () => "bg-[#FFFEDB]",
        renderBody: ({
            row,
            vasAccountOptions,
            recentVasAcctCds,
            onVasAccountChange,
            onVasAccountClear,
        }) => {
            return (
                <VasAccountSelect
                    value={
                        row.vasAcctCd && row.vasAcctName
                            ? {
                                  vasAcctCd: row.vasAcctCd,
                                  name: row.vasAcctName,
                              }
                            : null
                    }
                    options={vasAccountOptions}
                    recentVasAcctCds={recentVasAcctCds}
                    onChange={(next) => onVasAccountChange?.(row.id, next)}
                    onClear={
                        onVasAccountClear ? () => onVasAccountClear(row.id) : undefined
                    }
                />
            );
        },
    },
    CONTACT_NM: {
        headerKey: "txn_history.col.contact_name",
        defaultWidth: "180px",
        cellClassName: () => "bg-[#FFFEDB]",
        renderBody: ({
            row,
            contactOptions,
            recentContactTrcoKeys,
            onContactChange,
            onContactClear,
        }) => {
            return (
                <ContactSelect
                    value={
                        row.rcvPayTrcoKey && row.rcvPayTrcoNm
                            ? {
                                  trcoKey: row.rcvPayTrcoKey,
                                  // The snapshot is the only place we
                                  // have the user-visible hand-key, so
                                  // join against the master list to
                                  // fill it in when the contact still
                                  // exists; fall back to empty when the
                                  // contact has been trashed.
                                  handTrcoKey:
                                      contactOptions.find(
                                          (o) => o.trcoKey === row.rcvPayTrcoKey,
                                      )?.handTrcoKey ?? "",
                                  name: row.rcvPayTrcoNm,
                              }
                            : null
                    }
                    options={contactOptions}
                    recentTrcoKeys={recentContactTrcoKeys}
                    onChange={(next) => onContactChange?.(row.id, next)}
                    onClear={
                        onContactClear ? () => onContactClear(row.id) : undefined
                    }
                />
            );
        },
    },
    CONFIRMED_BY: {
        headerKey: "txn_history.col.confirmed_by",
        defaultWidth: "160px",
        // Confirmed by carries the conditional panel tint (yellow when
        // the row is unmatched, white otherwise).
        cellClassName: ({ panelTint }) => panelTint,
        renderBody: ({ row }) => (
            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                {row.confirmed && row.confirmedBy ? row.confirmedBy.name : ""}
            </span>
        ),
    },
};

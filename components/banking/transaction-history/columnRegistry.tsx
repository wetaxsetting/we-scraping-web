"use client";

import ContactSelect from "./ContactSelect";
import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import PurposeSelect from "@/components/shared/PurposeSelect";
import ReportingAccountSelect from "@/components/shared/ReportingAccountSelect";
import VasAccountSelect from "./VasAccountSelect";
import { formatAmount } from "@/lib/currency";
import { formatDateLang, formatUtcDtmByLanguage } from "@/lib/datetime";
import type { Locale } from "@/lib/i18n";
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
    /** Active language — drives the locale-aware Date/Time cell
     *  (`formatDateLang`). Sourced once from `useTranslation().locale`. */
    locale: Locale;
    /** Currency code for amount formatting (`"VND"` on the VND screen,
     *  the account's CCY on the FCY screen). Amount cells run through
     *  `formatAmount(value, currency, false)` so VND shows 0dp and USD
     *  2dp per the legacy id-ID rule. */
    currency: string;
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
    /** Column text alignment. Amount / number columns are `"right"`
     *  (legacy `tar`); everything else defaults to `"left"`. Drives both
     *  the header (`<TableHeaderCell align>`) and the body cell. */
    align?: "left" | "right";
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
 * Keys mirror the V156 `SYS_SCR_OPTION_WECMS` seed for
 * `web_svc_id = 'banking-transaction-history-vnd'` / `-fcy` (one shared
 * registry — the VND and FCY column sets are currently identical).
 * Adding a new column is one entry here + (a) matching SYS_SCR_OPTION
 * seed rows for BOTH scopes and (b) a `headerKey` translation in
 * `locales/{en,ko,vi}.json`.
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
        renderBody: ({ row, locale }) => (
            <div className="flex flex-col">
                <span className="text-wb-13 font-medium text-wb-ink">
                    {row.dateRaw ? formatDateLang(row.dateRaw, locale) : row.date}
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
        align: "right",
        renderBody: ({ row, currency }) => (
            <span className="text-wb-13 font-medium text-wb-status-approved-text">
                {formatAmount(row.deposit, currency, false)}
            </span>
        ),
    },
    WITHDRAW_AMT: {
        headerKey: "txn_history.col.withdraw",
        defaultWidth: "140px",
        align: "right",
        renderBody: ({ row, currency }) => (
            <span className="text-wb-13 font-medium text-wb-status-rejected-text">
                {formatAmount(row.withdraw, currency, false)}
            </span>
        ),
    },
    BAL: {
        headerKey: "txn_history.col.balance",
        defaultWidth: "140px",
        align: "right",
        renderBody: ({ row, currency }) => (
            <span className="text-wb-13 font-medium text-wb-ink">
                {formatAmount(row.balance, currency, false)}
            </span>
        ),
    },
    RMRK: {
        headerKey: "txn_history.col.remarks",
        defaultWidth: "240px",
        renderBody: ({ row }) => (
            <EllipsisTooltip
                text={row.remarks}
                lines={2}
                className="text-wb-13 font-normal text-wb-muted"
            />
        ),
    },
    FILE_NM: {
        headerKey: "txn_history.col.file_name",
        defaultWidth: "180px",
        renderBody: ({ row, isMatched, onOrganize, t }) =>
            isMatched ? (
                <div className="flex flex-col">
                    {row.fileName && (
                        <EllipsisTooltip
                            text={row.fileName}
                            lines={2}
                            className="text-wb-13 font-medium text-wb-ink"
                        />
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
        renderBody: ({ row, isMatched, locale }) => {
            // MATCHED_AT / CNFM_DTM are UTC instants (`now(UTC)` on the
            // backend) — convert UTC→Vietnam-local and render the date per
            // active locale, never the unshifted legacy slice.
            const rawMatched = row.matchedAtRaw ?? row.confirmedDtmRaw ?? null;
            const matchedDate = rawMatched
                ? formatUtcDtmByLanguage(rawMatched, locale).date
                : null;
            return (
                <span className="text-wb-13 font-medium text-wb-ink">
                    {isMatched ? (matchedDate || "—") : ""}
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
                <EllipsisTooltip
                    text={isMatched ? (matchedBy ?? "—") : ""}
                    className="text-wb-13 font-medium text-wb-ink"
                />
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
        // Yellow + editable while UNCONFIRMED; white + read-only once
        // CONFIRMED (legacy fnsh_0002_001 — the classification locks until
        // the user clicks Undo). Same rule for VAS Account + Contact Name.
        cellClassName: ({ row }) => (row.confirmed ? undefined : "bg-[#FFFEDB]"),
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
                    readOnly={row.confirmed}
                    onChange={(next) => onPurposeChange?.(row.id, next)}
                    onClear={onPurposeClear ? () => onPurposeClear(row.id) : undefined}
                />
            );
        },
    },
    VAS_ACCT_CD: {
        headerKey: "txn_history.col.vas_account",
        defaultWidth: "200px",
        cellClassName: ({ row }) => (row.confirmed ? undefined : "bg-[#FFFEDB]"),
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
                        // Editable (unconfirmed) rows need the resolved name
                        // to render a meaningful chip. Confirmed (read-only)
                        // rows must NEVER blank when the wire carries the code
                        // — fall back to code-only when the active-VAS options
                        // list can't resolve the name (e.g. the master was
                        // deactivated after the pick). Legacy always shows the
                        // stored VAS display text on a confirmed row.
                        row.vasAcctCd && (row.vasAcctName || row.confirmed)
                            ? {
                                  vasAcctCd: row.vasAcctCd,
                                  name: row.vasAcctName ?? "",
                              }
                            : null
                    }
                    options={vasAccountOptions}
                    recentVasAcctCds={recentVasAcctCds}
                    readOnly={row.confirmed}
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
        cellClassName: ({ row }) => (row.confirmed ? undefined : "bg-[#FFFEDB]"),
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
                    readOnly={row.confirmed}
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
        // Legacy fnsh_0002_001 (`bgYellow = CNFM_BY_USER_ID ? "" :
        // "yellow-bg"`, ts:912) — the whole matching panel (Purpose / VAS /
        // Contact / Confirmed by) is yellow while UNCONFIRMED and white once
        // CONFIRMED. Drive off `row.confirmed`, same rule as the other three
        // cells — NOT the match-state `panelTint` (which left this cell yellow
        // on confirmed-but-unmatched rows).
        cellClassName: ({ row }) => (row.confirmed ? undefined : "bg-[#FFFEDB]"),
        renderBody: ({ row, locale }) => {
            if (!(row.confirmed && row.confirmedBy)) {
                return (
                    <span className="block truncate text-wb-13 font-medium text-wb-ink" />
                );
            }
            // Legacy fnsh_0002_001 renders the confirmer as two lines —
            // name over date ("Kim Thu" / "07-07-2026"). CNFM_DTM is a UTC
            // yyyyMMddHHmmss instant, so convert UTC→VN and format per the
            // active locale (same path as the Matched Date column) — VI
            // renders DD-MM-YYYY, matching the live system. Only the name
            // shows when the date is absent.
            const date = row.confirmedDtmRaw
                ? formatUtcDtmByLanguage(row.confirmedDtmRaw, locale).date
                : "";
            return (
                <div className="flex flex-col">
                    <span className="truncate text-wb-13 font-medium text-wb-ink">
                        {row.confirmedBy.name}
                    </span>
                    {date && (
                        <span className="truncate text-wb-13 font-medium text-wb-muted">
                            {date}
                        </span>
                    )}
                </div>
            );
        },
    },
};

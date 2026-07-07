"use client";

import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import {
    isSpecialViewSettingField,
    ViewSettingColgroup,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import type { SortDirection } from "@/hooks/useTableSort";
import { formatIsoDateByLanguage, formatUtcDtmByLanguage } from "@/lib/datetime";
import { useTranslation, type Locale } from "@/lib/i18n";

import type { BankAccountRow } from "./types";
import { isWithdrawalAllowedBank } from "./withdrawalPolicy";

/** Wire FIELD_ID values seeded in `SYS_SCR_OPTION_WECMS` for screen
 *  `bank-account` / area `default` (V127). Keep aligned with both the
 *  Flyway seed and `BankAccountSortField` on the backend. */
export type BankAccountFieldId =
    | "BANK"
    | "ACCOUNT_NICKNAME"
    | "DESCRIPTION"
    | "ACCOUNT_TYPE"
    | "MATURITY_DATE"
    | "VAS_CODE"
    | "VAS_NAME"
    | "VIEW_PERMISSION"
    | "WITHDRAWAL_PERMISSION"
    | "AUDIT_LOGS";

/** i18n key per FIELD_ID. Drives both header and the popover `getLabel`. */
export const BANK_ACCOUNT_FIELD_LABEL_KEY: Record<BankAccountFieldId, string> = {
    BANK:                  "settings.bank_account.col.account",
    ACCOUNT_NICKNAME:      "settings.bank_account.col.nickname",
    DESCRIPTION:           "settings.bank_account.col.description",
    ACCOUNT_TYPE:          "settings.bank_account.col.type",
    MATURITY_DATE:         "settings.bank_account.col.maturity",
    VAS_CODE:              "settings.bank_account.col.vas_code",
    VAS_NAME:              "settings.bank_account.col.vas_name",
    VIEW_PERMISSION:       "settings.bank_account.col.view_permission",
    WITHDRAWAL_PERMISSION: "settings.bank_account.col.withdrawal_permission",
    AUDIT_LOGS:            "settings.bank_account.col.audit_logs",
};

type BankAccountTableProps = {
    rows: BankAccountRow[];
    /** Visible columns in display order — already filtered to `use_yn==="Y"`,
     *  with the leading `CHECKBOX` special row stripped by the caller. */
    columns: ViewSettingItem[];
    /** Current sort field driving the active glyph. */
    activeSortField: string | null;
    /** Current sort direction. */
    activeSortDirection: SortDirection;
    /** Click handler — receives the column's `FIELD_ID`. */
    onSort: (fieldId: string) => void;
    onAccountClick?: (row: BankAccountRow) => void;
    onViewPermissionClick?: (row: BankAccountRow) => void;
    onWithdrawalPermissionClick?: (row: BankAccountRow) => void;
    onAuditLogsClick?: (row: BankAccountRow) => void;
};

/**
 * Bank Account table — Figma 142:18741.
 *
 * Column visibility + display order is driven by the View Setting items
 * passed in `columns` (sourced from `useViewSetting`). Sort glyphs go
 * through the canonical `<TableHeaderCell>` chrome — active column
 * renders the brand-blue chevron, inactive columns render the inert
 * `ico-sort.svg` glyph. Click cycles `default → ASC → DESC → default`
 * via `onSort(FIELD_ID)`.
 *
 * Special FIELD_IDs (`CHECKBOX`, `ETC`) are never sortable and never
 * appear in the popover — the caller filters them out of `columns`.
 */
export default function BankAccountTable({
    rows,
    columns,
    activeSortField,
    activeSortDirection,
    onSort,
    onAccountClick,
    onViewPermissionClick,
    onWithdrawalPermissionClick,
    onAuditLogsClick,
}: BankAccountTableProps) {
    const { t, locale } = useTranslation();

    return (
        <table
            className="table-fixed border-collapse"
            style={{ minWidth: "var(--w-wb-bank-acct-table-min)" }}
        >
            <ViewSettingColgroup items={columns} defaultFallback="auto" />

            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                    {columns.map((col) => {
                        const labelKey =
                            BANK_ACCOUNT_FIELD_LABEL_KEY[
                                col.field_id as BankAccountFieldId
                            ];
                        const label = labelKey ? t(labelKey) : col.field_nm;
                        const sortable =
                            col.sort_yn === "Y" &&
                            !isSpecialViewSettingField(col.field_id);
                        return (
                            <HeaderCell
                                key={col.field_id}
                                fieldId={col.field_id}
                                sortable={sortable}
                                activeSortField={activeSortField}
                                activeSortDirection={activeSortDirection}
                                onSort={onSort}
                            >
                                {label}
                            </HeaderCell>
                        );
                    })}
                </tr>
            </thead>

            <tbody>
                {rows.map((row) => (
                    <tr
                        key={row.id}
                        className="border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]"
                    >
                        {columns.map((col) => (
                            <BodyCell key={col.field_id}>
                                {renderCell(col.field_id as BankAccountFieldId, {
                                    row,
                                    t,
                                    locale,
                                    onAccountClick,
                                    onViewPermissionClick,
                                    onWithdrawalPermissionClick,
                                    onAuditLogsClick,
                                })}
                            </BodyCell>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/* -------------------------------------------------------------------------
 *  Cell renderers — one per FIELD_ID. Pure visual; no business logic.
 * ------------------------------------------------------------------------- */

type CellCtx = {
    row: BankAccountRow;
    t: (key: string) => string;
    locale: Locale;
    onAccountClick?: (row: BankAccountRow) => void;
    onViewPermissionClick?: (row: BankAccountRow) => void;
    onWithdrawalPermissionClick?: (row: BankAccountRow) => void;
    onAuditLogsClick?: (row: BankAccountRow) => void;
};

function renderCell(fieldId: BankAccountFieldId, ctx: CellCtx) {
    const { row, t, locale, onAccountClick, onViewPermissionClick, onWithdrawalPermissionClick, onAuditLogsClick } = ctx;
    switch (fieldId) {
        case "BANK":
            return (
                <>
                    <button
                        type="button"
                        onClick={() => onAccountClick?.(row)}
                        className="block w-full truncate text-left text-wb-13 font-medium text-brand hover:underline"
                    >
                        {row.bankName}
                    </button>
                    <span className="block truncate text-wb-13 font-normal text-wb-muted">
                        {row.accountNumber} ({row.currency})
                    </span>
                </>
            );
        case "ACCOUNT_NICKNAME":
            return (
                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                    {row.nickname}
                </span>
            );
        case "DESCRIPTION": {
            // Blank cell for null / undefined / empty — never the "-"
            // placeholder, never the literal "null" / "undefined".
            const text = row.description ?? "";
            return (
                <EllipsisTooltip
                    text={text}
                    className="text-wb-13 font-medium text-wb-ntrl-8"
                />
            );
        }
        case "ACCOUNT_TYPE": {
            const typeKey =
                row.accountType === "saving"
                    ? "settings.bank_account.type.saving"
                    : row.accountType === "fixed"
                        ? "settings.bank_account.type.fixed"
                        : "settings.bank_account.type.current";
            return (
                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                    {t(typeKey)}
                </span>
            );
        }
        case "MATURITY_DATE":
            // Date-only ISO `yyyy-MM-dd` (SettingsBankAccountService.toRow
            // formats EXPI_DT to ISO). No timezone shift — render per the
            // active language (EN DD-MMM-YYYY / KO YYYY-MM-DD / VI DD-MM-YYYY).
            return (
                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                    {row.maturityDate ? formatIsoDateByLanguage(row.maturityDate, locale) : ""}
                </span>
            );
        case "VAS_CODE":
            return (
                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                    {row.vasCode}
                </span>
            );
        case "VAS_NAME":
            // Raw `VAS_ACCT_NM` only — mirrors legacy `comm_0183_001.ts:782`,
            // where the list column shows the account name without the
            // `<NM>(<CCY>)` combined form. Standard body text colour;
            // legacy comm_0183_001 doesn't tint this column.
            return (
                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                    {row.vasAccountName}
                </span>
            );
        case "VIEW_PERMISSION":
            // Empty label = no active grantee → render the placeholder
            // text (same as the column header). Legacy parity with
            // `comm_0183_001.ts:631`.
            return (
                <button
                    type="button"
                    onClick={() => onViewPermissionClick?.(row)}
                    className="inline-block max-w-full cursor-pointer truncate border-b border-brand text-wb-13 font-medium text-brand"
                >
                    {row.viewPermissionLabel
                        || t("settings.bank_account.col.view_permission")}
                </button>
            );
        case "WITHDRAWAL_PERMISSION":
            // Withdraw permission is only available on the 5 firm-banking
            // withdrawal banks (legacy comm_0183 WBE0452 rule, kept 2026-06-16).
            // Non-whitelisted banks render an inert "—" placeholder so the
            // control can't open the grant dialog — View Permission stays
            // active for every bank.
            if (!isWithdrawalAllowedBank(row.bankCd)) {
                return (
                    <span
                        className="block truncate text-wb-13 font-medium text-wb-ntrl-6"
                        aria-disabled="true"
                    >
                        &mdash;
                    </span>
                );
            }
            return (
                <button
                    type="button"
                    onClick={() => onWithdrawalPermissionClick?.(row)}
                    className="inline-block max-w-full cursor-pointer truncate border-b border-brand text-wb-13 font-medium text-brand"
                >
                    {row.withdrawalPermissionLabel
                        || t("settings.bank_account.col.withdrawal_permission")}
                </button>
            );
        case "AUDIT_LOGS":
            return (
                <button
                    type="button"
                    onClick={() => onAuditLogsClick?.(row)}
                    className="inline-block max-w-full cursor-pointer text-left text-wb-13 font-medium text-brand"
                >
                    <span className="block truncate">{row.auditLogActor}</span>
                    <span className="block truncate">
                        ({row.auditLogDtm
                            ? formatUtcDtmByLanguage(row.auditLogDtm, locale).date
                            : row.auditLogDate})
                    </span>
                </button>
            );
        default:
            return null;
    }
}

/* -------------------------------------------------------------------------
 *  Header / body cell chrome
 * ------------------------------------------------------------------------- */

type HeaderCellProps = {
    children: React.ReactNode;
    fieldId: string;
    sortable: boolean;
    activeSortField: string | null;
    activeSortDirection: SortDirection;
    onSort: (fieldId: string) => void;
};

function HeaderCell({
    children,
    fieldId,
    sortable,
    activeSortField,
    activeSortDirection,
    onSort,
}: HeaderCellProps) {
    const isActive =
        sortable && activeSortField === fieldId && activeSortDirection !== null;

    const glyph = sortable ? (
        isActive && activeSortDirection === "ASC" ? (
            <ChevronGlyph direction="up" />
        ) : isActive && activeSortDirection === "DESC" ? (
            <ChevronGlyph direction="down" />
        ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src="/assets/table/ico-sort.svg"
                alt=""
                aria-hidden
                className="h-3 w-2 shrink-0 opacity-60"
            />
        )
    ) : null;

    const inner = (
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
            {children}
            {glyph}
        </span>
    );

    return (
        <th
            className="whitespace-nowrap bg-wb-bg-sidebar px-3 py-3 text-left align-middle text-wb-13 font-semibold text-wb-dark"
            aria-sort={
                isActive
                    ? activeSortDirection === "ASC"
                        ? "ascending"
                        : "descending"
                    : sortable
                        ? "none"
                        : undefined
            }
        >
            {sortable ? (
                <button
                    type="button"
                    onClick={() => onSort(fieldId)}
                    className="flex w-full cursor-pointer select-none items-center gap-1 bg-transparent p-0 text-left text-inherit"
                >
                    {inner}
                </button>
            ) : (
                inner
            )}
        </th>
    );
}

function ChevronGlyph({ direction }: { direction: "up" | "down" }) {
    // Match the brand chevrons rendered by the shared <TableHeaderCell>
    // when sort is active. Inline SVG so we don't introduce a lucide
    // dependency in this leaf table.
    return (
        <svg
            viewBox="0 0 14 14"
            aria-hidden
            className="size-3.5 shrink-0 text-brand"
        >
            <path
                d={
                    direction === "up"
                        ? "M3 9l4-4 4 4"
                        : "M3 5l4 4 4-4"
                }
                fill="none"
                stroke="currentColor"
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function BodyCell({ children }: { children: React.ReactNode }) {
    return <td className="px-3 py-3 align-middle">{children}</td>;
}

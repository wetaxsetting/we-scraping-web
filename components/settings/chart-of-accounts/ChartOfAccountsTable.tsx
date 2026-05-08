"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import ChartOfAccountsTableColumns, {
    CHART_OF_ACCOUNTS_TABLE_MIN_WIDTH,
} from "./ChartOfAccountsTableColumns";
import type { ChartOfAccountsRow } from "./types";

/**
 * Inline-row mode threaded down from the panel. `null` keeps the table
 * read-only; the panel renders a sibling inline-row table below this
 * one when the mode is set.
 */
export type InlineRowMode =
    | { kind: "add" }
    | { kind: "edit"; row: Extract<ChartOfAccountsRow, { kind: "child" }> }
    | null;

type ChartOfAccountsTableProps = {
    rows: ChartOfAccountsRow[];
    /** Optional handlers — left undefined the row controls are inert (static UI). */
    onEdit?: (row: ChartOfAccountsRow) => void;
    onDelete?: (row: ChartOfAccountsRow) => void;
};

/**
 * Chart of Accounts table — Figma 9196:12740.
 *
 * Mirrors the canonical Settings-popup table chrome shared by Bank Account,
 * Approval Line and ERP Transaction History: bare `<table>` + `table-fixed`
 * + `<colgroup>`, sticky `bg-wb-bg-sidebar` thead, `text-wb-13` for both
 * header and body (CLAUDE.md §5 table typography), shared
 * `border-wb-table-border` row separators, and the canonical
 * `/assets/table/ico-sort.svg` sort glyph.
 *
 * Rows are a two-level tree: group rows (ACC-01 / ACC-02 / ACC-03) render
 * with bold typography and no Parent / Calc Rule / Status / Actions
 * affordances; child rows render the standard cell set with the Parent
 * Account, Status, and edit/delete affordances. Both row kinds share the
 * same `<colgroup>` so columns align across the two styles.
 */
export default function ChartOfAccountsTable({
    rows,
    onEdit,
    onDelete,
}: ChartOfAccountsTableProps) {
    const { t } = useTranslation();

    return (
        <table
            className="table-fixed border-collapse"
            style={{
                width: "100%",
                minWidth: CHART_OF_ACCOUNTS_TABLE_MIN_WIDTH,
            }}
        >
            <ChartOfAccountsTableColumns />

            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                    <th className="bg-wb-bg-sidebar px-2.5 align-middle">
                        <span className="flex items-center justify-center">
                            <Checkbox
                                aria-label={t("settings.chart_of_accounts.select_all")}
                            />
                        </span>
                    </th>
                    <HeaderCell>
                        {t("settings.chart_of_accounts.col.account_code")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.chart_of_accounts.col.type_en")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.chart_of_accounts.col.type_vi")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.chart_of_accounts.col.type_ko")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.chart_of_accounts.col.parent_account")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.chart_of_accounts.col.calc_rule")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.chart_of_accounts.col.status")}
                    </HeaderCell>
                    <th
                        className="bg-wb-bg-sidebar"
                        aria-label={t("settings.chart_of_accounts.col.actions")}
                    />
                </tr>
            </thead>

            <tbody>
                {rows.map((row) => {
                    const isGroup = row.kind === "group";

                    return (
                        <tr
                            key={row.id}
                            className="border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]"
                        >
                            {/* Selection checkbox */}
                            <td className="px-2.5 py-2.5 align-middle">
                                <span className="flex items-center justify-center">
                                    <Checkbox
                                        aria-label={t(
                                            "settings.chart_of_accounts.select_row",
                                            { code: row.accountCode },
                                        )}
                                    />
                                </span>
                            </td>

                            {/* Account Code — bold for group rows so the
                               grouping visually pops; child rows render in
                               the standard medium body weight. */}
                            <BodyCell>
                                <span
                                    className={cn(
                                        "block truncate text-wb-13 text-wb-ink",
                                        isGroup ? "font-bold" : "font-medium",
                                    )}
                                >
                                    {row.accountCode}
                                </span>
                            </BodyCell>

                            {/* Account Type (English) — bold for group rows */}
                            <BodyCell>
                                <span
                                    className={cn(
                                        "block truncate text-wb-13 text-wb-ink",
                                        isGroup ? "font-bold" : "font-medium",
                                    )}
                                >
                                    {row.accountTypeEn}
                                </span>
                            </BodyCell>

                            {/* Account Type (Vietnamese) — bold for group rows */}
                            <BodyCell>
                                <span
                                    className={cn(
                                        "block truncate text-wb-13 text-wb-ink",
                                        isGroup ? "font-bold" : "font-medium",
                                    )}
                                >
                                    {row.accountTypeVi}
                                </span>
                            </BodyCell>

                            {/* Account Type (Korean) — bold for group rows */}
                            <BodyCell>
                                <span
                                    className={cn(
                                        "block truncate text-wb-13 text-wb-ink",
                                        isGroup ? "font-bold" : "font-medium",
                                    )}
                                >
                                    {row.accountTypeKo}
                                </span>
                            </BodyCell>

                            {/* Parent Account — rounded badge on child rows
                               only; group rows leave the cell blank. */}
                            <BodyCell>
                                {row.kind === "child" && (
                                    <span className="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-wb-13 font-medium text-wb-ink shadow-wb-outline">
                                        {row.parentCode}
                                    </span>
                                )}
                            </BodyCell>

                            {/* Calc Rule — small badge with + or - sign,
                               only on the rows that carry one. */}
                            <BodyCell>
                                {row.kind === "child" && row.calcRule && (
                                    <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-md bg-white px-2 text-wb-13 font-medium text-wb-ink shadow-wb-outline">
                                        {row.calcRule}
                                    </span>
                                )}
                            </BodyCell>

                            {/* Status — blue "Active" badge on child rows */}
                            <BodyCell>
                                {row.kind === "child" && (
                                    <span className="inline-flex items-center rounded-md bg-brand-softer px-2 py-0.5 text-wb-13 font-medium text-brand-active">
                                        {t(
                                            "settings.chart_of_accounts.status.active",
                                        )}
                                    </span>
                                )}
                            </BodyCell>

                            {/* Actions — Edit + Delete icon buttons on child
                               rows only. Group rows leave the cell empty,
                               matching the Figma frame. */}
                            <td className="px-2.5 py-2.5 align-middle">
                                {row.kind === "child" && (
                                    <div className="flex items-center justify-start gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => onEdit?.(row)}
                                            aria-label={t(
                                                "settings.chart_of_accounts.actions.edit_aria",
                                                { code: row.accountCode },
                                            )}
                                            className="flex size-7 cursor-pointer items-center justify-center rounded-md bg-white text-wb-ntrl-8 shadow-wb-btn hover:bg-black/[0.03]"
                                        >
                                            <Pencil
                                                className="size-3.5"
                                                strokeWidth={1.8}
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDelete?.(row)}
                                            aria-label={t(
                                                "settings.chart_of_accounts.actions.delete_aria",
                                                { code: row.accountCode },
                                            )}
                                            className="flex size-7 cursor-pointer items-center justify-center rounded-md bg-white text-wb-red-07 shadow-[0_0_0_1px_var(--color-wb-red-04)] hover:bg-wb-red-04/10"
                                        >
                                            <Trash2
                                                className="size-3.5"
                                                strokeWidth={1.8}
                                            />
                                        </button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

/**
 * Canonical Settings-popup table header cell — shared chrome with
 * Bank Account / Approval Line / ERP Transaction History tables.
 */
function HeaderCell({ children }: { children: React.ReactNode }) {
    return (
        <th className="whitespace-nowrap bg-wb-bg-sidebar px-3 py-3 text-left align-middle text-wb-13 font-semibold text-wb-dark">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                {children}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/assets/table/ico-sort.svg"
                    alt=""
                    aria-hidden
                    className="h-3 w-2 shrink-0 opacity-60"
                />
            </span>
        </th>
    );
}

function BodyCell({ children }: { children: React.ReactNode }) {
    return <td className="px-3 py-3 align-middle">{children}</td>;
}

"use client";

import { ChevronsUpDown, MoreVertical } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import VasAccountTableColumns, {
    VAS_ACCOUNT_TABLE_MIN_WIDTH,
} from "./VasAccountTableColumns";
import type { VasAccountRow } from "./types";

type VasAccountTableProps = {
    rows: VasAccountRow[];
    /** Optional handlers — left undefined the row controls are inert (static UI). */
    onToggleParent?: (row: Extract<VasAccountRow, { kind: "parent" }>) => void;
    onRowMenu?: (row: VasAccountRow, anchor: HTMLButtonElement) => void;
};

/**
 * VAS Account table — Figma 9194:8615.
 *
 * Mirrors the canonical Settings-popup table chrome (Bank Account, Approval
 * Line, Chart of Accounts): bare `<table>` + `table-fixed` + `<colgroup>`,
 * sticky `bg-wb-bg-sidebar` thead, `text-wb-13` for both header and body
 * (CLAUDE.md §5 table typography), shared `border-wb-table-border` row
 * separators, and the canonical `/assets/table/ico-sort.svg` sort glyph.
 *
 * Rows are a two-level tree: parent rows render with the `ChevronsUpDown`
 * toggle glyph and a bold VAS Code + Account Name; child rows render with
 * an indented code (no chevron) and the standard medium body weight. Both
 * row kinds share the same `<colgroup>` so columns align across the two
 * styles. The Status column carries the same blue Active badge used by
 * Chart of Accounts.
 */
export default function VasAccountTable({
    rows,
    onToggleParent,
    onRowMenu,
}: VasAccountTableProps) {
    const { t } = useTranslation();

    return (
        <table
            className="table-fixed border-collapse"
            style={{
                width: "100%",
                minWidth: VAS_ACCOUNT_TABLE_MIN_WIDTH,
            }}
        >
            <VasAccountTableColumns />

            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                    <HeaderCell>{t("settings.vas_account.col.code")}</HeaderCell>
                    <HeaderCell>{t("settings.vas_account.col.name")}</HeaderCell>
                    <HeaderCell>{t("settings.vas_account.col.status")}</HeaderCell>
                    <th
                        className="bg-wb-bg-sidebar"
                        aria-label={t("settings.vas_account.col.actions")}
                    />
                </tr>
            </thead>

            <tbody>
                {rows.map((row) => {
                    const isParent = row.kind === "parent";
                    return (
                        <tr
                            key={row.id}
                            className="border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]"
                        >
                            {/* VAS Code — parent rows show the chevron toggle
                               glyph + bold code; child rows are indented (pl-9)
                               so the code visually nests under the parent. */}
                            <td className="px-3 py-3 align-middle">
                                {isParent ? (
                                    <span className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onToggleParent?.(row)}
                                            aria-label={t(
                                                "settings.vas_account.expand_aria",
                                                { code: row.vasCode },
                                            )}
                                            className="flex size-5 cursor-pointer items-center justify-center rounded text-wb-ntrl-6 hover:bg-black/5"
                                        >
                                            <ChevronsUpDown
                                                className="size-3.5"
                                                strokeWidth={2}
                                            />
                                        </button>
                                        <span className="block truncate text-wb-13 font-bold text-wb-ink">
                                            {row.vasCode}
                                        </span>
                                    </span>
                                ) : (
                                    <span className="block truncate pl-9 text-wb-13 font-medium text-wb-ink">
                                        {row.vasCode}
                                    </span>
                                )}
                            </td>

                            {/* VAS Account Name — bold for parents, normal
                               medium for children (matches Figma weight
                               contrast between the two row kinds). */}
                            <td className="px-3 py-3 align-middle">
                                <span
                                    className={cn(
                                        "block truncate text-wb-13 text-wb-ink",
                                        isParent ? "font-bold" : "font-medium",
                                    )}
                                >
                                    {row.accountName}
                                </span>
                            </td>

                            {/* Status — blue Active badge (same token used by
                               Chart of Accounts so the two Settings tables
                               carry an identical badge). */}
                            <td className="px-3 py-3 align-middle">
                                <span className="inline-flex items-center rounded-md bg-brand-softer px-2 py-0.5 text-wb-13 font-medium text-brand-active">
                                    {t("settings.vas_account.status.active")}
                                </span>
                            </td>

                            {/* Three-dot kebab — opens the per-row action menu
                               (Edit / Delete) on the parent panel. Static UI
                               leaves the click inert when no `onRowMenu` is
                               wired. */}
                            <td className="px-3 py-3 align-middle">
                                <button
                                    type="button"
                                    onClick={(e) =>
                                        onRowMenu?.(row, e.currentTarget)
                                    }
                                    aria-label={t(
                                        "settings.vas_account.row_menu_aria",
                                        { code: row.vasCode },
                                    )}
                                    className="flex size-6 cursor-pointer items-center justify-center rounded-md bg-white text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                                >
                                    <MoreVertical
                                        className="size-3.5"
                                        strokeWidth={2}
                                    />
                                </button>
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
 * Chart of Accounts / Bank Account / Approval Line tables. Carries the
 * `/assets/table/ico-sort.svg` glyph at `h-3 w-2 opacity-60` per the
 * existing convention.
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

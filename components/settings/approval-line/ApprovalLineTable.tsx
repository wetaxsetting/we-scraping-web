"use client";

import { ChevronDown, Pencil, Trash2 } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

import type { ApprovalLineRow } from "./types";

type ApprovalLineTableProps = {
    rows: ApprovalLineRow[];
    /** Optional handlers — left undefined the buttons are inert (static UI). */
    onEdit?: (row: ApprovalLineRow) => void;
    onDelete?: (row: ApprovalLineRow) => void;
};

/**
 * Approval Line table — Figma 9196:11717.
 *
 * Mirrors the canonical Settings-popup table chrome shared by Bank Account
 * and ERP Transaction History: bare `<table>` + `table-fixed` +
 * `<colgroup>`, sticky `bg-wb-bg-sidebar` thead, `text-wb-13` for both
 * header and body (CLAUDE.md §5 table typography), shared
 * `border-wb-table-border` row separators, and the canonical
 * `/assets/table/ico-sort.svg` sort glyph.
 *
 * Column widths use percentages (no horizontal scroll required — the four
 * columns fit inside the modal's right-column content area at every
 * supported breakpoint). The Action column is fixed-pixel so the Edit /
 * Delete pair sits flush against the right edge regardless of the modal
 * width.
 */
export default function ApprovalLineTable({
    rows,
    onEdit,
    onDelete,
}: ApprovalLineTableProps) {
    const { t } = useTranslation();

    return (
        <table className="w-full table-fixed border-collapse">
            <colgroup>
                <col style={{ width: "32%" }} />
                <col style={{ width: "38%" }} />
                <col style={{ width: "130px" }} />
                <col style={{ width: "180px" }} />
            </colgroup>

            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                    <HeaderCell>
                        {t("settings.approval_line.col.name")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.approval_line.col.approver")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.approval_line.col.create_date")}
                    </HeaderCell>
                    <th className="bg-wb-bg-sidebar" aria-label={t("settings.approval_line.col.actions")} />
                </tr>
            </thead>

            <tbody>
                {rows.map((row) => (
                    <tr
                        key={row.id}
                        className="border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]"
                    >
                        {/* Approval Line Name */}
                        <BodyCell>
                            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                {row.name}
                            </span>
                        </BodyCell>

                        {/* Approver name — optional count badge + chevron
                           when more than one approver is in the chain. */}
                        <BodyCell>
                            <div className="flex items-center gap-1">
                                <span className="truncate text-wb-13 font-medium text-wb-ink">
                                    {row.approverName}
                                </span>
                                {row.approverCount !== undefined && (
                                    <>
                                        <span className="inline-flex shrink-0 items-center justify-center rounded-[4px] border border-wb-ntrl-4 bg-wb-ntrl-3 px-1 text-wb-10 font-medium text-wb-ntrl-8">
                                            {row.approverCount}
                                        </span>
                                        <ChevronDown
                                            className="size-[18px] shrink-0 text-wb-ntrl-6"
                                            strokeWidth={1.8}
                                            aria-hidden
                                        />
                                    </>
                                )}
                            </div>
                        </BodyCell>

                        {/* Create Date */}
                        <BodyCell>
                            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                {row.createDate}
                            </span>
                        </BodyCell>

                        {/* Actions — Edit (default button) + Delete
                           (warning button). Both sized at h-7 so the row
                           keeps its 48px target height with 10px vertical
                           padding around the buttons. */}
                        <td className="px-2.5 py-2.5 align-middle">
                            <div className="flex items-center justify-start gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => onEdit?.(row)}
                                    aria-label={t("settings.approval_line.actions.edit_aria", { name: row.name })}
                                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md bg-white px-2.5 text-wb-13 font-medium text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03]"
                                >
                                    <Pencil className="size-4" strokeWidth={1.8} />
                                    {t("settings.approval_line.actions.edit")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDelete?.(row)}
                                    aria-label={t("settings.approval_line.actions.delete_aria", { name: row.name })}
                                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-wb-red-04 bg-white px-2.5 text-wb-13 font-medium text-wb-red-07 shadow-wb-warning-btn hover:bg-wb-red-04/10"
                                >
                                    <Trash2 className="size-4" strokeWidth={1.8} />
                                    {t("settings.approval_line.actions.delete")}
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/**
 * Canonical Settings-popup table header cell — shared chrome with
 * Bank Account / ERP Transaction History tables.
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

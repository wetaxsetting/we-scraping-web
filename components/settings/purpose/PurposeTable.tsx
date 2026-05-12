"use client";

import { Fragment } from "react";

import { useTranslation } from "@/lib/i18n";

import PurposeRow from "./PurposeRow";
import PurposeTableColumns, {
    PURPOSE_TABLE_MIN_WIDTH,
} from "./PurposeTableColumns";
import type { PurposeNode } from "./types";

type PurposeTableProps = {
    nodes: PurposeNode[];
    /** Set of parent ids whose children are currently visible. */
    expandedIds: Set<string>;
    onToggleExpand: (id: string) => void;
    onEdit?: (node: PurposeNode) => void;
    onDelete?: (node: PurposeNode) => void;
    onToggle?: (node: PurposeNode, next: boolean) => void;
};

/**
 * Purpose tree-table — Figma 9438:19204.
 *
 * Bare `<table>` + `table-fixed` + shared `<colgroup>` (from
 * `PurposeTableColumns`) so every cell width is owned in one place and
 * the sibling `<PurposeFormRow>` aligns automatically.
 *
 * Read-only renderer only — the inline Add / Edit form lives at the
 * panel layer below the scroll region (Chart of Accounts pattern). When
 * a row is being edited, that row STAYS visible here in its normal
 * place; the form appears as a sibling table pinned to the bottom of
 * the scroll container.
 *
 * Delete behaviour: per-row trash buttons stay live, but `<RowActions>`
 * honours `node.usedInTransactions` and disables the button when the
 * server-side flag is true.
 */
export default function PurposeTable({
    nodes,
    expandedIds,
    onToggleExpand,
    onEdit,
    onDelete,
    onToggle,
}: PurposeTableProps) {
    const { t } = useTranslation();
    return (
        <table
            className="table-fixed border-collapse"
            style={{
                width: "100%",
                minWidth: PURPOSE_TABLE_MIN_WIDTH,
            }}
        >
            <PurposeTableColumns />

            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                    <th aria-hidden className="bg-wb-bg-sidebar" />
                    <HeaderCell>{t("settings.purpose.col.code")}</HeaderCell>
                    <HeaderCell>{t("settings.purpose.col.name")}</HeaderCell>
                    <HeaderCell>{t("settings.purpose.col.description")}</HeaderCell>
                    <th
                        aria-label={t("settings.purpose.col.actions")}
                        className="bg-wb-bg-sidebar"
                    />
                </tr>
            </thead>

            <tbody>
                {nodes.map((parent) => {
                    const isExpanded = expandedIds.has(parent.id);
                    return (
                        <Fragment key={parent.id}>
                            <PurposeRow
                                node={parent}
                                expanded={isExpanded}
                                onToggleExpand={() =>
                                    onToggleExpand(parent.id)
                                }
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onToggle={onToggle}
                            />
                            {isExpanded &&
                                parent.children?.map((child) => (
                                    <PurposeRow
                                        key={child.id}
                                        node={child}
                                        isChild
                                        onEdit={onEdit}
                                        onDelete={onDelete}
                                        onToggle={onToggle}
                                    />
                                ))}
                        </Fragment>
                    );
                })}
            </tbody>
        </table>
    );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
    return (
        <th className="bg-wb-bg-sidebar px-3 py-3 text-left align-middle text-wb-13 font-semibold text-wb-dark">
            {children}
        </th>
    );
}

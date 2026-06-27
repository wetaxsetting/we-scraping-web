"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import RowActions from "./RowActions";
import type { PurposeNode } from "./types";

type PurposeRowProps = {
    node: PurposeNode;
    /** True when this row is a child (level-2) — controls indent + row tint. */
    isChild?: boolean;
    /** Whether the parent's children are visible. Ignored when `isChild`. */
    expanded?: boolean;
    /** Toggle expand / collapse on a parent. Ignored when `isChild`. */
    onToggleExpand?: () => void;
    onEdit?: (node: PurposeNode) => void;
    onDelete?: (node: PurposeNode) => void;
    onToggle?: (node: PurposeNode, next: boolean) => void;
};

/**
 * Single row inside the Purpose tree-table. The same component renders
 * both parent (level-1) and child (level-2) rows so the cell rhythm —
 * column widths, padding, action group placement — stays identical
 * across the two depths. The only visual differences:
 *   - parent rows render the chevron toggle in the first cell;
 *   - child rows replace the chevron with horizontal padding and tint
 *     the row light grey (Figma `bg-[#f5f5f5]`).
 */
export default function PurposeRow({
    node,
    isChild,
    expanded,
    onToggleExpand,
    onEdit,
    onDelete,
    onToggle,
}: PurposeRowProps) {
    const { t } = useTranslation();
    const hasChildren = !isChild && (node.children?.length ?? 0) > 0;

    return (
        <tr
            className={cn(
                "border-b border-wb-table-border last:border-b-0",
                isChild ? "bg-wb-bg-sidebar" : "bg-white hover:bg-black/[0.02]",
            )}
        >
            <td className="px-2.5 py-3 align-middle">
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={onToggleExpand}
                        aria-label={t(
                            expanded
                                ? "settings.purpose.actions.collapse_aria"
                                : "settings.purpose.actions.expand_aria",
                            { code: node.code },
                        )}
                        aria-expanded={expanded}
                        className="flex size-5 cursor-pointer items-center justify-center rounded text-wb-ntrl-8 hover:bg-black/[0.05]"
                    >
                        {expanded ? (
                            <ChevronUp className="size-4" strokeWidth={2} />
                        ) : (
                            <ChevronDown className="size-4" strokeWidth={2} />
                        )}
                    </button>
                ) : (
                    <span aria-hidden className="block size-5" />
                )}
            </td>

            <td className={cn("py-3 align-middle", isChild ? "pl-10 pr-3" : "px-3")}>
                <span
                    className={cn(
                        "block truncate text-wb-13 text-wb-ink",
                        isChild ? "font-medium" : "font-semibold",
                    )}
                >
                    {node.code}
                </span>
            </td>

            <td className="px-3 py-3 align-middle">
                <span
                    className={cn(
                        "block truncate text-wb-13 text-wb-ink",
                        isChild ? "font-medium" : "font-semibold",
                    )}
                >
                    {node.name}
                </span>
            </td>

            <td className="px-3 py-3 align-middle">
                <EllipsisTooltip
                    text={node.description}
                    className="text-wb-13 font-normal text-wb-ntrl-8"
                />
            </td>

            <td className="px-3 py-3 align-middle">
                <RowActions
                    code={node.code}
                    enabled={node.enabled}
                    onEdit={() => onEdit?.(node)}
                    onDelete={() => onDelete?.(node)}
                    onToggle={(next) => onToggle?.(node, next)}
                />
            </td>
        </tr>
    );
}

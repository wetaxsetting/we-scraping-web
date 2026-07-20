"use client";

import { useState } from "react";
import { GripVertical, Minus } from "lucide-react";

import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import ToggleSwitch from "../ToggleSwitch";
import type { PurposeRowVM } from "./types";

type PurposeTableProps = {
    rows: PurposeRowVM[];
    /** "view" → read-only rows with the enable toggle.
     *  "edit" → drag handle + inline inputs + delete (legacy Edit mode). */
    mode: "view" | "edit";
    // view-mode
    onToggle?: (row: PurposeRowVM, next: boolean) => void;
    // edit-mode
    onFieldChange?: (rowKey: string, field: "code" | "name" | "description", value: string) => void;
    onDeleteRow?: (rowKey: string) => void;
    onReorder?: (fromIndex: number, toIndex: number) => void;
};

/**
 * Purpose tree-table — Figma 1353:33865 (view) + 1353:33864 (Edit mode).
 *
 * <p>Legacy comm_0187_001: the flat deposit / withdrawal list. Two
 * render modes gated by {@code mode}:
 * <ul>
 *   <li><b>view</b> — Code · Purpose · Description · enable toggle. No
 *       leading gutter (data is flush-left, matching legacy).</li>
 *   <li><b>edit</b> — a leading drag handle column is inserted for
 *       reorder, plus editable Code/Purpose/Description inputs and a red
 *       delete (Figma "Drag to move").</li>
 * </ul>
 * Rows are a fixed 48px tall in both modes so switching Edit⇄Save keeps
 * the vertical rhythm stable.
 */
export default function PurposeTable({
    rows,
    mode,
    onToggle,
    onFieldChange,
    onDeleteRow,
    onReorder,
}: PurposeTableProps) {
    const { t } = useTranslation();
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const isEdit = mode === "edit";

    return (
        <table
            className="w-full table-fixed border-collapse"
            style={{ minWidth: isEdit ? "1024px" : "980px" }}
        >
            <colgroup>
                {isEdit && <col className="w-[44px]" />}
                <col className="w-[180px]" />
                <col className="w-[280px]" />
                <col />
                <col className="w-[120px]" />
            </colgroup>

            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                    {isEdit && <th aria-hidden className="bg-wb-bg-sidebar" />}
                    <HeaderCell>{t("settings.purpose.col.code")}</HeaderCell>
                    <HeaderCell>{t("settings.purpose.col.name")}</HeaderCell>
                    <HeaderCell>{t("settings.purpose.col.description")}</HeaderCell>
                    <th aria-label={t("settings.purpose.col.actions")} className="bg-wb-bg-sidebar" />
                </tr>
            </thead>

            <tbody>
                {rows.map((row, index) => (
                    <tr
                        key={row.key}
                        draggable={isEdit}
                        onDragStart={isEdit ? () => setDragIndex(index) : undefined}
                        onDragOver={isEdit ? (e) => e.preventDefault() : undefined}
                        onDrop={
                            isEdit
                                ? (e) => {
                                      e.preventDefault();
                                      if (dragIndex !== null && dragIndex !== index) {
                                          onReorder?.(dragIndex, index);
                                      }
                                      setDragIndex(null);
                                  }
                                : undefined
                        }
                        className={cn(
                            "h-12 border-b border-wb-table-border last:border-b-0 bg-white",
                            isEdit ? "cursor-move" : "hover:bg-black/[0.02]",
                            dragIndex === index && "opacity-50",
                        )}
                    >
                        {/* Leading drag handle — edit mode only */}
                        {isEdit && (
                            <td className="px-2.5 align-middle">
                                <span
                                    aria-label={t("settings.purpose.actions.drag_aria")}
                                    className="flex size-5 items-center justify-center text-wb-ntrl-6"
                                >
                                    <GripVertical className="size-4" strokeWidth={1.8} />
                                </span>
                            </td>
                        )}

                        {/* Code */}
                        <td className="px-3 align-middle">
                            {isEdit ? (
                                <CellInput
                                    value={row.code}
                                    onChange={(v) => onFieldChange?.(row.key, "code", v)}
                                    ariaLabel={t("settings.purpose.col.code")}
                                />
                            ) : (
                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                    {row.code}
                                </span>
                            )}
                        </td>

                        {/* Purpose / name */}
                        <td className="px-3 align-middle">
                            {isEdit ? (
                                <CellInput
                                    value={row.name}
                                    onChange={(v) => onFieldChange?.(row.key, "name", v)}
                                    ariaLabel={t("settings.purpose.col.name")}
                                />
                            ) : (
                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                    {row.name}
                                </span>
                            )}
                        </td>

                        {/* Description */}
                        <td className="px-3 align-middle">
                            {isEdit ? (
                                <CellInput
                                    value={row.description}
                                    onChange={(v) => onFieldChange?.(row.key, "description", v)}
                                    ariaLabel={t("settings.purpose.col.description")}
                                    placeholder={t("settings.purpose.form.description_placeholder")}
                                />
                            ) : (
                                <EllipsisTooltip
                                    text={row.description}
                                    className="text-wb-13 font-normal text-wb-ntrl-8"
                                />
                            )}
                        </td>

                        {/* Trailing: toggle (view) or delete (edit) */}
                        <td className="px-3 align-middle">
                            <div className="flex items-center justify-end">
                                {isEdit ? (
                                    <button
                                        type="button"
                                        onClick={() => onDeleteRow?.(row.key)}
                                        aria-label={t("settings.purpose.actions.delete_aria", {
                                            code: row.code || "-",
                                        })}
                                        className="flex size-5 cursor-pointer items-center justify-center rounded-full bg-wb-red-07 text-white hover:bg-wb-red-07/90"
                                    >
                                        <Minus className="size-3" strokeWidth={2.5} />
                                    </button>
                                ) : (
                                    <ToggleSwitch
                                        checked={row.enabled}
                                        onChange={(next) => onToggle?.(row, next)}
                                        ariaLabel={t(
                                            row.enabled
                                                ? "settings.purpose.toggle_on"
                                                : "settings.purpose.toggle_off",
                                        )}
                                    />
                                )}
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
    return (
        <th className="whitespace-nowrap bg-wb-bg-sidebar px-3 py-3 text-left align-middle text-wb-13 font-semibold text-wb-dark">
            {children}
        </th>
    );
}

function CellInput({
    value,
    onChange,
    ariaLabel,
    placeholder,
}: {
    value: string;
    onChange: (v: string) => void;
    ariaLabel: string;
    placeholder?: string;
}) {
    return (
        <input
            type="text"
            value={value}
            aria-label={ariaLabel}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            // Drag handlers live on the row; keep text selectable inside inputs.
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className="h-8 w-full rounded-md border border-wb-ntrl-4 bg-white px-2 text-wb-13 font-medium text-wb-ink outline-none focus:border-brand focus:shadow-wb-focus"
        />
    );
}

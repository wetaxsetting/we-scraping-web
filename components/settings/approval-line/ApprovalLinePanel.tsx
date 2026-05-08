"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";

import ApprovalLineDialog from "./ApprovalLineDialog";
import ApprovalLineTable from "./ApprovalLineTable";
import type { ApproverRow } from "./approverMockData";
import { mockApprovalLineRows } from "./mockData";
import type { ApprovalLineRow } from "./types";

/**
 * Build a one-row approver chain seed for the Update dialog from a panel
 * row. Static UI only — the panel rows carry just the primary approver's
 * display name + an "approverCount" badge, so position + department
 * default to "PO" / "PO" per the Figma user spec ("1 | Thuy Linh | PO |
 * PO | Remove"). When the settings API lands, replace this with the
 * real approver list returned by `GET /approval-lines/:id`.
 */
function seedApproversFromRow(row: ApprovalLineRow): ApproverRow[] {
    return [
        {
            id: `existing-${row.id}`,
            name: row.approverName,
            position: "PO",
            department: "PO",
        },
    ];
}

/**
 * Discriminated union for the dialog state — `null` keeps it closed,
 * `{ mode: "add" }` opens the empty Add dialog, and
 * `{ mode: "update", row }` opens the dialog seeded with that row's
 * name + approver chain. Atomic swap means clicking Edit on a different
 * row while the dialog is already open re-seeds it via the conditional
 * `key` prop without a manual reset call.
 */
type DialogState =
    | { mode: "add" }
    | { mode: "update"; row: ApprovalLineRow };

/**
 * Approval Line panel — Settings popup submenu (Figma 9196:11717).
 *
 * Layout (top → bottom, all inside the modal's right column):
 *   [Header]    — title + description on the left. pt-14 drops the row
 *                 below the shell's absolute Esc/X group; pr-24 reserves
 *                 clearance because this header has no right-side action
 *                 button.
 *   [Filter row] — search input on the left + brand "+ Add Approval line"
 *                 button on the right (justify-between).
 *   [Table]     — single scroll region for the row list. Sticky thead
 *                 stays visible while the body scrolls.
 *
 * Static UI: the search input filters local state by approval-line name;
 * Add / Edit / Delete are no-ops until the settings API lands.
 */
export default function ApprovalLinePanel() {
    const { t } = useTranslation();

    const [keyword, setKeyword] = useState("");
    const [dialog, setDialog] = useState<DialogState | null>(null);

    const filteredRows = useMemo(() => {
        const needle = keyword.trim().toLowerCase();
        if (!needle) return mockApprovalLineRows;
        return mockApprovalLineRows.filter((row) =>
            row.name.toLowerCase().includes(needle),
        );
    }, [keyword]);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — title + description. pr-24 clears the shell's
               absolute Esc/X group at top-4 right-4. */}
            <div className="flex shrink-0 flex-col gap-1 px-8 pb-5 pr-24 pt-14">
                <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                    {t("settings.approval_line.title")}
                </h3>
                <p className="text-wb-13 font-normal text-wb-muted">
                    {t("settings.approval_line.description")}
                </p>
            </div>

            {/* Filter row — search input on the left, primary "+ Add"
               button on the right. Single justify-between flex row per
               Figma 9196:11793. */}
            <div className="flex shrink-0 items-center justify-between gap-4 px-8 pb-4">
                <div className="h-[var(--h-wb-filter-btn)] w-full max-w-[290px]">
                    <div className="relative h-full">
                        <Search
                            className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-wb-ntrl-5"
                            strokeWidth={1.8}
                        />
                        <Input
                            type="text"
                            placeholder={t("settings.approval_line.search_placeholder")}
                            aria-label={t("settings.approval_line.search_placeholder")}
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            className="h-full rounded-md pl-8 pr-2 text-wb-14-tight font-medium placeholder:text-wb-ntrl-5"
                        />
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setDialog({ mode: "add" })}
                    className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                >
                    <Plus className="size-4" strokeWidth={2} />
                    {t("settings.approval_line.add")}
                </button>
            </div>

            {/* Scroll region — owns vertical scroll. Padding lives on the
               inner wrapper so the scrollbar sits flush with the modal
               edges. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8 pb-6">
                <div className="custom-scrollbar-y h-full overflow-y-auto">
                    <ApprovalLineTable
                        rows={filteredRows}
                        onEdit={(row) => setDialog({ mode: "update", row })}
                    />
                </div>
            </div>

            {/* Approval Line dialog — Figma 9196:11969 / 9196:11547 (add)
               + the same shell reused for Update with mode="update".
               Conditional mount + a row-keyed `key` so opening row B
               after row A remounts the dialog with row B's seed values
               instead of leaking row A's draft. Sits at stackLevel=2
               (set inside the dialog) on top of the L1 Settings shell. */}
            {dialog?.mode === "add" && (
                <ApprovalLineDialog
                    mode="add"
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog?.mode === "update" && (
                <ApprovalLineDialog
                    key={`update-${dialog.row.id}`}
                    mode="update"
                    initialName={dialog.row.name}
                    initialApprovers={seedApproversFromRow(dialog.row)}
                    onClose={() => setDialog(null)}
                />
            )}
        </div>
    );
}

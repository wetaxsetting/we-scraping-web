"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

import { mockPurposeRows } from "./mockData";
import PurposeTable from "./PurposeTable";
import PurposeTabs from "./PurposeTabs";
import type { PurposeRow, PurposeTabKey } from "./types";

/**
 * Purpose panel — Figma 9196:11717 "Purpose" frame.
 *
 * Layout (top → bottom, all inside the modal's right column):
 *   [Header]     — title + description + right-aligned Edit button (shrink-0)
 *   [Tabs]       — Banking Deposit / Withdrawal / Deleted (shrink-0)
 *   [Table]      — ONLY this region scrolls; header sticks to top of scroll
 *   [Add button] — FIXED at the bottom, OUTSIDE the scroll container
 *
 * The flex-column + `min-h-0` + `flex-1` on the scroll area is the
 * critical pattern: without `min-h-0` the table container would try to
 * grow to its intrinsic height and push the Add-button off-screen.
 */
export default function PurposePanel() {
    const { t } = useTranslation();
    const [tab, setTab] = useState<PurposeTabKey>("deposit");
    const [rowsByTab, setRowsByTab] = useState<Record<PurposeTabKey, PurposeRow[]>>(
        mockPurposeRows,
    );

    const rows = useMemo(() => rowsByTab[tab], [rowsByTab, tab]);

    const handleToggle = (id: string, next: boolean) => {
        setRowsByTab((prev) => ({
            ...prev,
            [tab]: prev[tab].map((row) =>
                row.id === id ? { ...row, enabled: next } : row,
            ),
        }));
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — title + description on the left, Edit button pinned right.
               pr-24 keeps clear of the shell's Esc/X affordance absolute-positioned
               at top-right. */}
            <div className="flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-8 pr-24">
                <div className="min-w-0">
                    <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("settings.purpose.title")}
                    </h3>
                    <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                        {t("settings.purpose.description")}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="shrink-0 px-8">
                <PurposeTabs active={tab} onChange={setTab} />
            </div>

            {/* Edit button row — aligned right, sits between the tab strip and the
               table. Reserved as a button row so future bulk-actions slot in
               without disturbing the scroll region below. */}
            <div className="flex shrink-0 items-center justify-end px-8 py-3">
                <button
                    type="button"
                    className="flex h-9 cursor-pointer items-center gap-2 rounded-md bg-white px-4 text-wb-14 font-medium text-wb-ink shadow-wb-btn hover:bg-black/5"
                >
                    <Pencil className="size-4" strokeWidth={2} />
                    {t("settings.purpose.edit")}
                </button>
            </div>

            {/* Scroll region — ONLY the table body scrolls. `min-h-0` lets the
               flex child actually shrink so overflow kicks in instead of
               pushing the Add-button off-card. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8">
                <div className="custom-scrollbar h-full overflow-y-auto">
                    <PurposeTable rows={rows} onToggle={handleToggle} />
                </div>
            </div>

            {/* Fixed bottom section — Add-purpose button sits BELOW the scroll
               region, so it stays visible no matter how many rows the table
               contains. */}
            <div className="shrink-0 border-t border-wb-border-sidebar px-8 py-3">
                <button
                    type="button"
                    className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-wb-ntrl-4 bg-white text-wb-13 font-medium text-wb-ink hover:bg-wb-bg-sidebar"
                >
                    <Plus className="size-4" strokeWidth={2} />
                    {t("settings.purpose.add")}
                </button>
            </div>
        </div>
    );
}

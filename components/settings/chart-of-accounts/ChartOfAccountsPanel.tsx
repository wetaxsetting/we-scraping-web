"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import SearchInput from "@/components/shared/SearchInput";
import { useTranslation } from "@/lib/i18n";

import ChartOfAccountsInlineRow from "./ChartOfAccountsInlineRow";
import ChartOfAccountsTable, {
    type InlineRowMode,
} from "./ChartOfAccountsTable";
import ExcelUploadDialog from "./ExcelUploadDialog";
import { mockChartOfAccountsRows } from "./mockData";
import type { ChartOfAccountsRow } from "./types";

/**
 * Chart of Accounts panel — Settings popup submenu (Figma 9196:12740).
 *
 * Layout (top → bottom, all inside the modal's right column):
 *   [Header]      — title + description (shrink-0); pr-24 clears the shell's Esc/X
 *   [Filters]     — Search input on the left, Excel Upload action on the right
 *   [Table]       — single scroll region; vertical scroll when rows overflow
 *   [Add row]     — full-width "+ Add A New Account" button pinned at bottom
 *
 * Static UI: search filters the live mock list by account code / type
 * substring; the Excel Upload, edit, delete, select-all, per-row checkbox,
 * and "+ Add" controls are all inert until the backend lands.
 */
export default function ChartOfAccountsPanel() {
    const { t } = useTranslation();

    const [keyword, setKeyword] = useState("");
    const [excelUploadOpen, setExcelUploadOpen] = useState(false);
    /**
     * Inline-row state. Mutually exclusive with the bottom "+ Add A New
     * Account" button — opening either Add (button) or Edit (pencil
     * icon) hides the button and shows the inline form inside the
     * scroll region. Cancel / Save dismiss back to read-only.
     */
    const [inlineMode, setInlineMode] = useState<InlineRowMode>(null);

    function handleEdit(row: ChartOfAccountsRow) {
        if (row.kind !== "child") return;
        setInlineMode({ kind: "edit", row });
    }

    function handleAddNew() {
        setInlineMode({ kind: "add" });
    }

    function dismissInline() {
        setInlineMode(null);
    }

    /**
     * Search filters the visible row set. Group rows survive the filter as
     * long as at least one of their child rows still matches, so the
     * grouping reads correctly even when only a single child is shown.
     */
    const filteredRows = useMemo(() => {
        const q = keyword.trim().toLowerCase();
        if (!q) return mockChartOfAccountsRows;

        const childMatches = mockChartOfAccountsRows
            .filter((row) => row.kind === "child")
            .filter((row) =>
                [
                    row.accountCode,
                    row.accountTypeEn,
                    row.accountTypeVi,
                    row.accountTypeKo,
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(q),
            );

        const matchedParents = new Set(
            childMatches.map((row) =>
                row.kind === "child" ? row.parentCode : "",
            ),
        );

        return mockChartOfAccountsRows.filter((row) => {
            if (row.kind === "group") return matchedParents.has(row.accountCode);
            return childMatches.includes(row);
        });
    }, [keyword]);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — pr-24 clears the shell's absolute Esc/X group at
               top-4 right-4 so the title row never collides with the
               close affordance. */}
            <div className="flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-14 pr-24">
                <div className="min-w-0">
                    <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("settings.chart_of_accounts.title")}
                    </h3>
                    <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                        {t("settings.chart_of_accounts.description")}
                    </p>
                </div>
            </div>

            {/* Filters — Search left, Excel Upload right. */}
            <div className="flex shrink-0 items-center justify-between gap-3 px-8 pb-3">
                <SearchInput
                    value={keyword}
                    onChange={setKeyword}
                    placeholder={t("common.search")}
                />
                <button
                    type="button"
                    onClick={() => setExcelUploadOpen(true)}
                    className="inline-flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center gap-1.5 rounded-md bg-[#1f7a4d] px-3 text-wb-14 font-medium text-white shadow-wb-btn hover:bg-[#196439]"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element
                       Render the shared `/assets/common/ico-excel.svg` in
                       its native colours (NOT `brightness-0 invert`). The
                       SVG carries the canonical Excel mark — light-green
                       file body, dark-green Excel tab, white "X" glyph —
                       which the filter previously flattened into a pure
                       white silhouette, leaving only a generic file
                       shape on the green button. Native rendering keeps
                       the X visible against the green button bg, matching
                       Figma 9196:12830. */}
                    <img
                        src="/assets/common/ico-excel.svg"
                        alt=""
                        aria-hidden
                        className="size-4"
                    />
                    {t("settings.chart_of_accounts.excel_upload")}
                </button>
            </div>

            {/* Scroll region — shared scroll container holds the read-only
               table AND, when active, the inline Add/Edit form (canonical
               CLAUDE.md §7a sibling-table pattern). Inline form uses
               `mt-auto` to fill empty space when rows are short and
               `sticky bottom-0` to stay pinned while tbody scrolls. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8">
                <div className="custom-scrollbar h-full overflow-auto">
                    <div className="flex min-h-full min-w-min flex-col">
                        <ChartOfAccountsTable
                            rows={filteredRows}
                            onEdit={handleEdit}
                        />
                        {inlineMode && (
                            <ChartOfAccountsInlineRow
                                key={
                                    inlineMode.kind === "edit"
                                        ? `edit-${inlineMode.row.id}`
                                        : "add"
                                }
                                mode={inlineMode}
                                onCancel={dismissInline}
                                onSave={dismissInline}
                                className="sticky bottom-0 z-10 mt-auto"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom slot — sits BELOW the scroll container so it never
               overlaps the last visible row. Two mutually exclusive
               branches keep the panel's overall vertical rhythm
               consistent across modes:
                 - read-only → "+ Add A New Account" button (bare
                   <button>, no wrapping div, so toggling to inline
                   mode unmounts it cleanly with no stale wrapper).
                 - inline mode → a blank spacer that matches the
                   button's vertical footprint (mt-3 + h-8 + mb-3 =
                   56px). Cancel / Save live INSIDE the inline row's
                   trailing cell, so the spacer is purely visual — it
                   stops the inline form from sitting flush against
                   the panel's bottom edge. */}
            {inlineMode ? (
                <div
                    aria-hidden
                    className="mb-3 mt-3 shrink-0"
                />
            ) : (
                <button
                    type="button"
                    onClick={handleAddNew}
                    className="mx-8 mb-3 mt-3 flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                >
                    <Plus className="size-4" strokeWidth={2} />
                    {t("settings.chart_of_accounts.add_account")}
                </button>
            )}

            {/* Excel Upload dialog — Figma 9196:14117. Conditional mount
               so the modal's local state (filename chip, summary chips)
               re-seeds cleanly between opens. Sits at stackLevel=2 over
               the L1 Settings shell. */}
            {excelUploadOpen && (
                <ExcelUploadDialog onClose={() => setExcelUploadOpen(false)} />
            )}
        </div>
    );
}

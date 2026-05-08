"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import SearchInput from "@/components/shared/SearchInput";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";

import AddVasAccountDialog from "./AddVasAccountDialog";
import ExcelUploadDialog from "./ExcelUploadDialog";
import VasAccountRowMenu from "./VasAccountRowMenu";
import VasAccountTable from "./VasAccountTable";
import { mockVasAccountRows } from "./mockData";
import type { VasAccountRow } from "./types";

/**
 * VAS Account panel — Settings popup submenu (Figma 9194:8615).
 *
 * Layout (top → bottom, all inside the modal's right column, per CLAUDE.md
 * §3a Settings panel composition):
 *   [Header]   — title + description (shrink-0); pr-24 clears the shell's Esc/X
 *   [Filters]  — Search input on the left; Active/Inactive checkboxes +
 *                Excel Upload + "+ Add VAS Account" buttons on the right
 *   [Table]    — single scroll region; sticky thead, two-level parent /
 *                child rows
 *
 * Static UI: search filters the live mock list by code / name substring;
 * the Active / Inactive checkboxes, Excel Upload, "+ Add VAS Account",
 * per-row chevron toggle, and three-dot kebab are all inert until the
 * backend lands.
 */
export default function VasAccountPanel() {
    const { t } = useTranslation();
    const dialog = useDialog();

    const [keyword, setKeyword] = useState("");
    const [activeChecked, setActiveChecked] = useState(true);
    const [inactiveChecked, setInactiveChecked] = useState(false);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [excelUploadOpen, setExcelUploadOpen] = useState(false);
    /**
     * Open row-menu state — stores the row id + kebab DOMRect so the
     * portal-rendered menu can pin itself with `position: fixed`.
     * Single-menu-at-a-time: clicking row B's kebab while row A's
     * menu is open swaps to B in one setState; clicking the same
     * row's kebab again toggles closed.
     */
    const [openMenu, setOpenMenu] = useState<
        { rowId: string; rect: DOMRect } | null
    >(null);
    /**
     * The row currently being edited via the row-menu's Edit action.
     * Drives the AddVasAccountDialog in `mode="edit"`. Conditional
     * mount + key=row.id so opening row B after row A starts with a
     * fresh draft seeded from B.
     */
    const [editingRow, setEditingRow] = useState<VasAccountRow | null>(null);

    /**
     * Routes the row-menu Delete action through the shared destructive
     * confirmation dialog. The confirm callback is a no-op on static
     * UI — real DELETE wiring lands when the backend endpoint exists.
     */
    const openDeleteConfirm = (row: VasAccountRow) =>
        dialog.open({
            type: "confirmation",
            destructive: true,
            title: t("settings.vas_account.confirm_delete.title"),
            description: t(
                "settings.vas_account.confirm_delete.description",
                { code: row.vasCode },
            ),
            confirmText: t("settings.vas_account.confirm_delete.confirm"),
            cancelText: t("settings.vas_account.confirm_delete.cancel"),
        });

    const handleRowMenu = (row: VasAccountRow, anchor: HTMLButtonElement) => {
        const rect = anchor.getBoundingClientRect();
        setOpenMenu((prev) =>
            prev?.rowId === row.id ? null : { rowId: row.id, rect },
        );
    };

    /**
     * Search filters the visible row set. Parent rows survive the filter as
     * long as at least one of their child rows still matches, so the parent
     * grouping reads correctly even when only a single child is shown.
     */
    const filteredRows = useMemo(() => {
        const q = keyword.trim().toLowerCase();
        if (!q) return mockVasAccountRows;

        const childMatches = mockVasAccountRows.filter(
            (row): row is Extract<VasAccountRow, { kind: "child" }> =>
                row.kind === "child" &&
                [row.vasCode, row.accountName]
                    .join(" ")
                    .toLowerCase()
                    .includes(q),
        );

        const matchedParents = new Set(
            childMatches.map((row) => row.parentCode),
        );

        return mockVasAccountRows.filter((row) => {
            if (row.kind === "parent")
                return (
                    matchedParents.has(row.vasCode) ||
                    [row.vasCode, row.accountName]
                        .join(" ")
                        .toLowerCase()
                        .includes(q)
                );
            return childMatches.includes(row);
        });
    }, [keyword]);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — pr-24 clears the shell's absolute Esc/X group at
               top-4 right-4 so the title row never collides with the
               close affordance. No right-side action button on this
               panel — the Add / Excel buttons live in the filter row
               per Figma 9194:8615. */}
            <div className="flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-14 pr-24">
                <div className="min-w-0">
                    <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("settings.vas_account.title")}
                    </h3>
                    <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                        {t("settings.vas_account.description")}
                    </p>
                </div>
            </div>

            {/* Filters — Search left, Active/Inactive + Excel Upload +
               Add VAS Account right. */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-8 pb-3">
                <SearchInput
                    value={keyword}
                    onChange={setKeyword}
                    placeholder={t("common.search")}
                />
                <div className="flex flex-wrap items-center gap-3">
                    <CheckboxOption
                        id="vas-active"
                        label={t("settings.vas_account.filter.active")}
                        checked={activeChecked}
                        onChange={setActiveChecked}
                    />
                    <CheckboxOption
                        id="vas-inactive"
                        label={t("settings.vas_account.filter.inactive")}
                        checked={inactiveChecked}
                        onChange={setInactiveChecked}
                    />
                    <button
                        type="button"
                        onClick={() => setExcelUploadOpen(true)}
                        className="inline-flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center gap-1.5 rounded-md bg-[#1f7a4d] px-3 text-wb-14 font-medium text-white shadow-wb-btn hover:bg-[#196439]"
                    >
                        {/* Native colours — NOT `brightness-0 invert` — per
                           CLAUDE.md §8a. The shared `ico-excel.svg` carries
                           the canonical Excel mark and reads correctly
                           against the green button without a filter. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/common/ico-excel.svg"
                            alt=""
                            aria-hidden
                            className="size-4"
                        />
                        {t("settings.vas_account.excel_upload")}
                    </button>
                    <button
                        type="button"
                        onClick={() => setAddDialogOpen(true)}
                        className="inline-flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                    >
                        <Plus className="size-4" strokeWidth={2.25} />
                        {t("settings.vas_account.add")}
                    </button>
                </div>
            </div>

            {/* Scroll region — single shared scroll container holds the
               table. Sticky thead keeps the header visible while the
               body scrolls. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8 pb-3">
                <div className="custom-scrollbar h-full overflow-auto">
                    <VasAccountTable
                        rows={filteredRows}
                        onRowMenu={handleRowMenu}
                    />
                </div>
            </div>

            {/* Row-action menu — same chrome as FirmBankingRowMenu. Rendered
               at the panel level (not inside the row cell) so it can
               portal to document.body and use position: fixed anchored
               to the kebab's bounding rect — escapes the panel's
               overflow-hidden without being clipped. The menu owns its
               own ESC + outside-click dismissal. */}
            {openMenu && (() => {
                const row = mockVasAccountRows.find(
                    (r) => r.id === openMenu.rowId,
                );
                if (!row) return null;
                return (
                    <VasAccountRowMenu
                        anchorRect={openMenu.rect}
                        code={row.vasCode}
                        onEdit={() => setEditingRow(row)}
                        onDelete={() => openDeleteConfirm(row)}
                        onClose={() => setOpenMenu(null)}
                    />
                );
            })()}

            {/* Add VAS Account dialog — Figma 9194:9233. Conditional mount
               so the form's local state (code, name, status) reseeds
               cleanly between opens. Sits at stackLevel=2 over the L1
               Settings shell. */}
            {addDialogOpen && (
                <AddVasAccountDialog
                    onClose={() => setAddDialogOpen(false)}
                />
            )}

            {/* Edit VAS Account dialog — same shell as Add, mode="edit",
               seeded from the row picked via the row-menu Edit action.
               Keyed remount on `row.id` so opening row B after row A
               starts with a fresh draft. */}
            {editingRow && (
                <AddVasAccountDialog
                    key={`edit-${editingRow.id}`}
                    mode="edit"
                    initialValues={{
                        vasCode: editingRow.vasCode,
                        accountName: editingRow.accountName,
                        status: editingRow.status,
                    }}
                    onClose={() => setEditingRow(null)}
                />
            )}

            {/* Upload VAS Account dialog — Figma 9194:9409. Conditional
               mount so the wrapper's local state (uploadOption radio)
               reseeds cleanly between opens. Sits at stackLevel=2 over
               the L1 Settings shell (default for the shared
               ExcelUploadDialog). */}
            {excelUploadOpen && (
                <ExcelUploadDialog
                    onClose={() => setExcelUploadOpen(false)}
                />
            )}
        </div>
    );
}

/**
 * Compact filter checkbox — label sits to the right of the box at
 * `text-wb-13 font-medium`. Used here for the Active / Inactive filter
 * pair on the right side of the filter row.
 */
function CheckboxOption({
    id,
    label,
    checked,
    onChange,
}: {
    id: string;
    label: string;
    checked: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <label
            htmlFor={id}
            className="flex cursor-pointer items-center gap-1.5 text-wb-13 font-medium text-wb-ink"
        >
            <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={(v) => onChange(v === true)}
            />
            {label}
        </label>
    );
}

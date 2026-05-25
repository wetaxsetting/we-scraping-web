"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import ExcelUploadButton from "@/components/shared/ExcelUploadButton";
import SearchInput from "@/components/shared/SearchInput";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiCallError } from "@/lib/api/banking";
import { useTranslation } from "@/lib/i18n";

import AddVasAccountDialog from "./AddVasAccountDialog";
import ExcelUploadDialog from "./ExcelUploadDialog";
import VasAccountRowMenu from "./VasAccountRowMenu";
import VasAccountTable from "./VasAccountTable";
import type { VasAccountRow } from "./types";
import { useVasAccountList, useVasAccountMutations } from "./useVasAccount";

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
 * Wired to the Spring `/api/v1/settings/vas-account` endpoints. Search,
 * status filter, create / edit / delete all round-trip to the backend.
 * Excel Upload stays static UI in this MR — the Spring Excel preview /
 * import endpoints are deferred to a follow-up MR (see
 * `docs/refactor-wecms/features/vas-account.md §1`).
 *
 * Errors propagate through the shared `useDialog()` warning surface so
 * the caller sees the backend `WBE*` code (and the trace id from the
 * envelope is rendered automatically).
 */
export default function VasAccountPanel() {
    const { t } = useTranslation();
    const dialog = useDialog();

    const [keyword, setKeyword] = useState("");
    const [activeChecked, setActiveChecked] = useState(true);
    const [inactiveChecked, setInactiveChecked] = useState(true);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [excelUploadOpen, setExcelUploadOpen] = useState(false);

    // Backend wire `stts` is a repeatable query param — pass single A,
    // single I, or both ([]) to mean "no filter".
    const statuses = useMemo(() => {
        const set: string[] = [];
        if (activeChecked) set.push("A");
        if (inactiveChecked) set.push("I");
        return set;
    }, [activeChecked, inactiveChecked]);

    // Memoise the params object so the hook's `useEffect(run)` doesn't
    // re-fire on every render.
    const params = useMemo(
        () => ({
            searchWd: keyword.trim() || undefined,
            statuses,
        }),
        [keyword, statuses],
    );

    const { rows, initialLoading, error, refetch } = useVasAccountList(params);
    const mutations = useVasAccountMutations();

    /**
     * Open row-menu state — single menu at a time. Pinned via the
     * kebab's bounding rect so the portal-rendered menu can use
     * `position: fixed` and escape the panel's overflow-hidden.
     */
    const [openMenu, setOpenMenu] = useState<{ rowId: string; rect: DOMRect } | null>(null);

    /**
     * Row currently being edited via the row-menu's Edit action.
     * Conditional mount + key=row.id so opening row B after row A
     * starts with a fresh draft seeded from B.
     */
    const [editingRow, setEditingRow] = useState<VasAccountRow | null>(null);

    /** Surface list-fetch failures via the shared error dialog. */
    useEffect(() => {
        if (!error) return;
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: error.message,
            errorCode: error.code,
        });
    }, [error, dialog, t]);

    const handleRowMenu = (row: VasAccountRow, anchor: HTMLButtonElement) => {
        const rect = anchor.getBoundingClientRect();
        setOpenMenu((prev) =>
            prev?.rowId === row.id ? null : { rowId: row.id, rect },
        );
    };

    const openDeleteConfirm = (row: VasAccountRow) =>
        dialog.open({
            type: "confirmation",
            // Standard (non-destructive) confirmation chrome — neutral
            // icon, brand-blue primary button. The delete CTA follows
            // the shared system-dialog "Confirmation" component (Figma
            // standard) instead of the danger-red variant, matching
            // the Excel upload Reset/Replace flow and every other
            // Settings confirmation popup. `destructive` is reserved
            // for explicit red-CTA designs.
            title: t("settings.vas_account.confirm_delete.title"),
            // Intentionally generic — PO call 2026-05-11. The dialog
            // identifies the target row by being opened from the
            // row-menu kebab; an explicit code interpolation in the
            // body read as duplicate information.
            description: t("settings.vas_account.confirm_delete.description"),
            confirmText: t("settings.vas_account.confirm_delete.confirm"),
            cancelText: t("settings.vas_account.confirm_delete.cancel"),
            onConfirm: async () => {
                try {
                    await mutations.remove(row.seqNo);
                    await refetch();
                } catch (e: unknown) {
                    const ex = e as ApiCallError;
                    dialog.open({
                        type: "error",
                        title: t("dialog.error"),
                        description: ex.message,
                        errorCode: ex.code,
                    });
                }
            },
        });

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — pr-24 clears the shell's absolute Esc/X group at
               top-4 right-4. Add / Excel buttons live in the filter row
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
                    <ExcelUploadButton
                        label={t("settings.vas_account.excel_upload")}
                        onClick={() => setExcelUploadOpen(true)}
                    />
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

            {/* Scroll region — table body scrolls, header is sticky.
               The table renders unconditionally so the header (VAS
               Code · VAS Account Name · Status) stays aligned with
               the filter row above. The empty / loading message is a
               sibling div with `flex-1` so it expands to fill the area
               below the header instead of hugging the header at its
               natural cell-padding height. Mirrors the canonical
               ErpTransactionHistoryPanel empty-state pattern.

               `rows.length === 0` is the SINGLE source of truth for
               the empty state — it triggers identically whether the
               wire returned zero rows, the search keyword matched
               nothing, both Active and Inactive are unchecked
               (hook short-circuit), or any combination. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8 pb-3">
                <div className="custom-scrollbar h-full overflow-auto">
                    <div className="flex h-full min-w-[min-content] flex-col">
                        <VasAccountTable rows={rows} onRowMenu={handleRowMenu} />
                        {rows.length === 0 && (
                            <div className="flex flex-1 items-center justify-center px-3 py-12 text-wb-13 font-medium text-wb-ntrl-6">
                                {initialLoading
                                    ? t("settings.vas_account.loading")
                                    : t("settings.vas_account.empty")}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Row-action menu — same chrome as FirmBankingRowMenu. Portal
               to document.body, position: fixed anchored to the kebab. */}
            {openMenu && (() => {
                const row = rows.find((r) => r.id === openMenu.rowId);
                if (!row) return null;
                return (
                    <VasAccountRowMenu
                        anchorRect={openMenu.rect}
                        code={row.vasCode}
                        onEdit={() => {
                            setOpenMenu(null);
                            setEditingRow(row);
                        }}
                        onDelete={() => {
                            setOpenMenu(null);
                            openDeleteConfirm(row);
                        }}
                        onClose={() => setOpenMenu(null)}
                    />
                );
            })()}

            {/* Add VAS Account dialog. Conditional mount so the form's
               local state reseeds cleanly between opens. */}
            {addDialogOpen && (
                <AddVasAccountDialog
                    onClose={() => setAddDialogOpen(false)}
                    onSaved={async () => {
                        setAddDialogOpen(false);
                        await refetch();
                    }}
                />
            )}

            {/* Edit VAS Account dialog — seeded from the row picked via the
               row-menu Edit action. */}
            {editingRow && (
                <AddVasAccountDialog
                    key={`edit-${editingRow.id}`}
                    mode="edit"
                    seqNo={editingRow.seqNo}
                    initialValues={{
                        vasCode: editingRow.vasCode,
                        accountName: editingRow.accountName,
                        status: editingRow.status,
                    }}
                    onClose={() => setEditingRow(null)}
                    onSaved={async () => {
                        setEditingRow(null);
                        await refetch();
                    }}
                />
            )}

            {/* Excel upload — real endpoints (Spring comm_0217_002
               family). Download / Preview / Import wired to
               /api/v1/settings/vas-account/excel/*. After a successful
               import, dismiss the dialog and refetch the list. */}
            {excelUploadOpen && (
                <ExcelUploadDialog
                    onClose={() => setExcelUploadOpen(false)}
                    onSaved={async () => {
                        setExcelUploadOpen(false);
                        await refetch();
                    }}
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

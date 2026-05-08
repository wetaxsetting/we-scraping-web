"use client";

import { useMemo, useState } from "react";

import Pagination, { usePagination } from "@/components/shared/Pagination";
import RowActionMenu from "@/components/shared/RowActionMenu";
import SearchInput from "@/components/shared/SearchInput";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";

import AddNewContactDialog from "./AddNewContactDialog";
import ContactsTable from "./ContactsTable";
import DownloadDropdown from "./DownloadDropdown";
import EditContactDialog from "./EditContactDialog";
import ExcelUploadDialog from "./ExcelUploadDialog";
import { MOCK_TOTAL_COUNT, mockContactsRows } from "./mockData";
import type { ContactLocation, ContactRow } from "./types";

/**
 * Contacts panel — Settings popup submenu (Figma 9194:9683).
 *
 * Layout (top → bottom, all inside the modal's right column):
 *   [Header]      — title + description (shrink-0); pr-24 clears the shell's Esc/X
 *   [Filters]     — search + Local/Overseas checkboxes  /  Download · Excel Upload · Add (shrink-0)
 *   [Table]       — ONLY this region scrolls (vertical + horizontal as needed)
 *   [Pagination]  — fixed at the bottom, OUTSIDE the scroll container
 *
 * Static UI: search filters by contact code / name (case-insensitive),
 * the Local/Overseas checkboxes filter by row.location, and the
 * row-checkbox / 3-dot / Download / Excel Upload / Add controls are
 * inert until the backend lands. The pagination total mirrors the
 * Figma "Page 2 of 3" footer.
 */
export default function ContactsPanel() {
    const { t } = useTranslation();

    const [keyword, setKeyword] = useState("");
    const [showLocal, setShowLocal] = useState(true);
    const [showOverseas, setShowOverseas] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // Add New Contact dialog open/close. Conditional mount + bare boolean
    // is enough for static UI — the dialog seeds its own form state on
    // mount, so closing+reopening starts fresh without an imperative
    // reset.
    const [addContactOpen, setAddContactOpen] = useState(false);
    // Edit Contact dialog — same component as Add, but mode="edit" so
    // the title reads "Edit Contact". Static UI: form state seeds
    // empty (the form does not pre-populate from the row yet — wire
    // when the row-edit endpoint lands). Storing the row anyway so
    // the future seeding path has something to read.
    const [editContactRow, setEditContactRow] = useState<ContactRow | null>(null);
    // Excel Upload preview dialog — opens on the green "Excel Upload"
    // button. Conditional mount so the dialog re-seeds on every open.
    const [excelUploadOpen, setExcelUploadOpen] = useState(false);
    // Row-action menu (Edit / Delete) anchored to a row's kebab. Stores
    // the row id + bounding rect together so React commits "close A,
    // open B" in one render when the user clicks a different row's
    // kebab while another menu is open.
    const [openMenu, setOpenMenu] = useState<
        { row: ContactRow; rect: DOMRect } | null
    >(null);

    const filteredRows = useMemo(() => {
        const q = keyword.trim().toLowerCase();
        return mockContactsRows.filter((row) => {
            if (!showLocal && row.location === "local") return false;
            if (!showOverseas && row.location === "overseas") return false;
            if (!q) return true;
            return (
                row.contactCode.toLowerCase().includes(q) ||
                row.contactName.toLowerCase().includes(q)
            );
        });
    }, [keyword, showLocal, showOverseas]);

    const pagination = usePagination({
        items: filteredRows,
        initialPageSize: 10,
        // Mirror the legacy `$('#checkbox-all').prop('checked', false)` reset
        // — every page-size change clears the row selection so a stale set
        // of ids can't reference rows that have scrolled out of view.
        onPageSizeChange: () => setSelectedIds(new Set()),
    });

    // Total count in the pagination footer mirrors Figma's "Page 2 of 3"
    // when the mock list is unfiltered; once the user filters or searches
    // we honour the local count so the footer stays internally consistent.
    const isUnfiltered =
        filteredRows.length === mockContactsRows.length && keyword.trim() === "";
    const total = isUnfiltered ? MOCK_TOTAL_COUNT : filteredRows.length;
    const shown = Math.min(pagination.pageSize, filteredRows.length);

    const toggleRow = (id: string, next: boolean) => {
        setSelectedIds((prev) => {
            const s = new Set(prev);
            if (next) s.add(id);
            else s.delete(id);
            return s;
        });
    };

    const toggleAll = (next: boolean) => {
        setSelectedIds((prev) => {
            const s = new Set(prev);
            for (const row of pagination.paged) {
                if (next) s.add(row.id);
                else s.delete(row.id);
            }
            return s;
        });
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — pr-24 keeps clear of the shell's Esc/X affordance. */}
            <div className="flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-14 pr-24">
                <div className="min-w-0">
                    <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("settings.contacts.title")}
                    </h3>
                    <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                        {t("settings.contacts.description")}
                    </p>
                </div>
            </div>

            {/* Filter row — search + Local/Overseas checkboxes on the left,
               Download dropdown + Excel Upload + Add on the right. The
               wrap class keeps the right-side action group on its own line
               on narrow viewports. */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-8 pb-3">
                <div className="flex flex-wrap items-center gap-3">
                    <SearchInput
                        value={keyword}
                        onChange={(v) => {
                            setKeyword(v);
                            pagination.resetPage();
                        }}
                        placeholder={t("settings.contacts.search_placeholder")}
                    />
                    <FilterCheckbox
                        checked={showLocal}
                        onChange={(v) => {
                            setShowLocal(v);
                            pagination.resetPage();
                        }}
                        label={t("settings.contacts.location.local")}
                    />
                    <FilterCheckbox
                        checked={showOverseas}
                        onChange={(v) => {
                            setShowOverseas(v);
                            pagination.resetPage();
                        }}
                        label={t("settings.contacts.location.overseas")}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <DownloadDropdown />

                    {/* Excel Upload — solid green per Figma 9194:9773.
                       Native asset colours (no `brightness-0 invert`)
                       so the white "X" glyph stays visible against
                       the dark-green button. Opens the shared Excel
                       Upload preview dialog (Figma 9194:11192) at
                       stackLevel=2 over the L1 Settings shell. */}
                    <button
                        type="button"
                        onClick={() => setExcelUploadOpen(true)}
                        className="inline-flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center gap-1.5 rounded-md bg-[#15803d] px-3 text-wb-14 font-medium text-white shadow-[0_0_0_1px_#166534,0_1px_1px_0_rgba(21,128,61,0.5),0_2px_3px_0_rgba(21,128,61,0.1)] hover:bg-[#166534]"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/common/ico-excel.svg"
                            alt=""
                            aria-hidden
                            className="size-4"
                        />
                        {t("settings.contacts.excel_upload")}
                    </button>

                    {/* Add — primary brand-blue, mirrors §3a primary action.
                       Opens the Add New Contact dialog (Figma 9194:10938). */}
                    <button
                        type="button"
                        onClick={() => setAddContactOpen(true)}
                        className="inline-flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                    >
                        {t("settings.contacts.add")}
                    </button>
                </div>
            </div>

            {/* Scroll region — table body scrolls; header is sticky inside. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8">
                <div className="custom-scrollbar h-full overflow-auto">
                    <ContactsTable
                        rows={pagination.paged}
                        selectedIds={selectedIds}
                        onToggleRow={toggleRow}
                        onToggleAll={toggleAll}
                        openMenuRowId={openMenu?.row.id ?? null}
                        onRowMenuToggle={(row, rect) => {
                            // Atomic swap — clicking row B's kebab while
                            // row A's menu is open closes A and opens B
                            // in a single render. Clicking the same
                            // row's kebab again toggles closed.
                            setOpenMenu((prev) =>
                                prev?.row.id === row.id
                                    ? null
                                    : { row, rect },
                            );
                        }}
                    />
                </div>
            </div>

            {/* Pagination — pinned below the scroll region. */}
            <div className="shrink-0 px-8 py-3">
                <Pagination
                    page={pagination.page}
                    pageCount={Math.max(1, Math.ceil(total / pagination.pageSize))}
                    pageSize={pagination.pageSize}
                    totalLabel={t("common.showing_of", {
                        shown: String(shown),
                        total: String(total),
                    })}
                    onPageChange={pagination.setPage}
                    onPageSizeChange={pagination.setPageSize}
                />
            </div>

            {/* Add New Contact dialog — Figma 9194:10938. Opens at
               stackLevel=2 over the L1 Settings shell. Conditional
               mount so the form re-seeds on every open. */}
            {addContactOpen && (
                <AddNewContactDialog onClose={() => setAddContactOpen(false)} />
            )}

            {/* Edit Contact dialog — Figma 12346:165870. Distinct
               entry point from the +Add button so callers state their
               intent at the import site; internally delegates to the
               same form because Figma 12346:165800 + 12346:165870
               specify identical layouts. Conditional mount + `key`
               re-seed so opening row B after row A remounts the form
               without the previous row's drafts leaking through. */}
            {editContactRow && (
                <EditContactDialog
                    key={editContactRow.id}
                    onClose={() => setEditContactRow(null)}
                />
            )}

            {/* Excel Upload preview dialog — Figma 9194:11192.
               Conditional mount so the variant radio + filename
               re-seed on every open. */}
            {excelUploadOpen && (
                <ExcelUploadDialog onClose={() => setExcelUploadOpen(false)} />
            )}

            {/* Row-action menu (Edit / Delete) — same pattern as Login
               Credentials. Rendered at panel level (not inside the
               table cell) so the shared component can portal to
               document.body and use position: fixed anchored to the
               kebab's bounding rect — escapes the table's scroll
               container without being clipped. The menu owns its own
               ESC + outside-click dismissal. Static UI: Edit + Delete
               are no-ops for now. */}
            {openMenu && (
                <RowActionMenu
                    anchorRect={openMenu.rect}
                    ariaLabel={openMenu.row.contactName}
                    editLabel={t("settings.contacts.row_menu.edit")}
                    deleteLabel={t("settings.contacts.row_menu.delete")}
                    editAriaLabel={t(
                        "settings.contacts.row_menu.aria_edit",
                        { name: openMenu.row.contactName },
                    )}
                    deleteAriaLabel={t(
                        "settings.contacts.row_menu.aria_delete",
                        { name: openMenu.row.contactName },
                    )}
                    onEdit={() => {
                        // Reuse the Add dialog in edit mode — same
                        // layout, only the title flips to "Edit
                        // Contact". RowActionMenu calls onClose right
                        // after onEdit, so the menu dismisses
                        // automatically when the dialog opens.
                        setEditContactRow(openMenu.row);
                    }}
                    onDelete={() => {
                        // Static UI: Delete is a no-op for now. Wire
                        // to a confirmation dialog + DELETE call when
                        // the backend lands.
                    }}
                    onClose={() => setOpenMenu(null)}
                />
            )}
        </div>
    );
}

/**
 * Local / Overseas filter checkbox row — shadcn `<Checkbox>` paired
 * with the label as a single clickable strip so users can hit either
 * the box or the label.
 */
function FilterCheckbox({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
}) {
    return (
        <label className="inline-flex cursor-pointer items-center gap-2 select-none">
            <Checkbox
                checked={checked}
                onCheckedChange={(value) => onChange(value === true)}
                aria-label={label}
            />
            <span className="text-wb-14 font-medium text-wb-ntrl-8">{label}</span>
        </label>
    );
}

// Re-export the location type so callers can share the dropdown selection
// shape without importing from the dropdown's own module.
export type { ContactLocation };

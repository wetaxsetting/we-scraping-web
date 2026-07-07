"use client";

import { MoreHorizontal } from "lucide-react";

import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import { Checkbox } from "@/components/ui/checkbox";
import type { SortDirection } from "@/hooks/useTableSort";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import AddressPopover from "./AddressPopover";
import type { ContactRow } from "./types";

type ContactsTableProps = {
    rows: ContactRow[];
    /** Set of row ids currently selected via the per-row checkbox. */
    selectedIds: Set<string>;
    /** Toggle a single row's checkbox. */
    onToggleRow: (id: string, next: boolean) => void;
    /** Toggle every row on the current page (header checkbox). */
    onToggleAll: (next: boolean) => void;
    /**
     * Currently-sorting FIELD_ID (e.g. {@code HAND_TRCO_KEY}). The shared
     * {@code <TableHeaderCell>} reads this to render its active glyph
     * + ARIA `aria-sort` attribute. {@code null} = default ORDER BY.
     */
    sortField: string | null;
    sortDirection: SortDirection;
    /** Click / Enter / Space handler — receives the column's FIELD_ID. */
    onSort: (fieldId: string) => void;
    /**
     * Click handler for the kebab `⋮` action button. Receives the
     * row and the trigger's bounding rect so the host panel can
     * anchor a portal-mounted `<RowActionMenu>` next to it. The
     * panel-level handler is responsible for toggling the menu
     * state — clicking the same row's kebab again should close it.
     */
    onRowMenuToggle?: (row: ContactRow, rect: DOMRect) => void;
    /**
     * Id of the row whose menu is currently open. Highlights the
     * trigger so the user can see which row's menu is active even
     * when the menu portal renders far from the row.
     */
    openMenuRowId?: string | null;
};

/**
 * Contacts table — Figma 9194:9787.
 *
 * Bare `<table>` + `<colgroup>` + sticky `<thead>`. Row height is
 * 60px (`--h-wb-table-row`) to match the rest of the Settings panels.
 * The Address column is the elastic one (`w-auto`) so it absorbs
 * whatever horizontal space remains after the fixed columns.
 *
 * Selected-row visual is `bg-wb-bg-active` (#e3e3e3) — same token used
 * for the active sidebar item, mirroring the Figma hover/selected
 * treatment on row 2.
 */
export default function ContactsTable({
    rows,
    selectedIds,
    onToggleRow,
    onToggleAll,
    sortField,
    sortDirection,
    onSort,
    onRowMenuToggle,
    openMenuRowId,
}: ContactsTableProps) {
    const { t } = useTranslation();

    const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));
    const someSelected = rows.some((row) => selectedIds.has(row.id));
    const headerState: boolean | "indeterminate" = allSelected
        ? true
        : someSelected
            ? "indeterminate"
            : false;

    return (
        <table className="w-full min-w-[1264px] table-fixed border-collapse">
            {/* Column widths: 44 + 120 + 200 + 140 + 170 + 210 + 320 + 60 = 1264px.
               Address gets 320px (was elastic `w-auto`, which collapsed to
               ~136px inside the Settings panel's narrow content area and
               truncated the 2-line address after a few characters). The
               wider, explicit width lets a typical Vietnamese address
               wrap comfortably on two lines while leaving the +N badge
               anchored to the cell's top-right via `AddressCell`'s
               `flex items-start gap-2 + shrink-0`. */}
            <colgroup>
                <col className="w-[44px]" />
                <col className="w-[120px]" />
                <col className="w-[200px]" />
                <col className="w-[140px]" />
                <col className="w-[170px]" />
                <col className="w-[210px]" />
                <col className="w-[320px]" />
                <col className="w-[60px]" />
            </colgroup>

            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                    {/* Checkbox column — special FIELD_ID per View Setting;
                       never sortable. Plain <th> so the Checkbox primitive
                       lands at the cell's natural padding. */}
                    <th className="bg-wb-bg-sidebar px-2.5 py-3 text-left align-middle">
                        <Checkbox
                            checked={headerState}
                            onCheckedChange={(value) =>
                                onToggleAll(value === true)
                            }
                            aria-label={t("settings.contacts.select_all")}
                        />
                    </th>
                    {/* Sortable columns — FIELD_IDs whitelisted by Spring
                       `ContactSortField` (HAND_TRCO_KEY / TRCO_CMNM /
                       TRCO_TYPE / TRCO_TAX_ID). The two sub-table columns
                       (Deposit Account → BANK_NM, Address →
                       TRCO_BSUN_POST_ADRS) ship with `sortable={false}`
                       because V88 seeds them `SORT_YN='N'` — they project
                       from child rows and have no clean entity-property
                       mapping. */}
                    <TableHeaderCell
                        sortFieldId="HAND_TRCO_KEY"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                        className="bg-wb-bg-sidebar"
                    >
                        {t("settings.contacts.col.contact_code")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="TRCO_CMNM"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                        className="bg-wb-bg-sidebar"
                    >
                        {t("settings.contacts.col.contact_name")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="TRCO_TYPE"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                        className="bg-wb-bg-sidebar"
                    >
                        {t("settings.contacts.col.location")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="TRCO_TAX_ID"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                        className="bg-wb-bg-sidebar"
                    >
                        {t("settings.contacts.col.tax_id")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortable={false}
                        textSizeClass="text-wb-13"
                        className="bg-wb-bg-sidebar"
                    >
                        {t("settings.contacts.col.deposit_account")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortable={false}
                        textSizeClass="text-wb-13"
                        className="bg-wb-bg-sidebar"
                    >
                        {t("settings.contacts.col.address")}
                    </TableHeaderCell>
                    {/* Row-action column — non-sortable, visually empty header. */}
                    <TableHeaderCell
                        sortable={false}
                        textSizeClass="text-wb-13"
                        className="bg-wb-bg-sidebar"
                    >
                        <span aria-hidden="true">&nbsp;</span>
                    </TableHeaderCell>
                </tr>
            </thead>

            <tbody>
                {rows.map((row) => {
                    const selected = selectedIds.has(row.id);
                    return (
                        <tr
                            key={row.id}
                            className={cn(
                                "h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0 transition-colors",
                                selected ? "bg-wb-bg-active" : "hover:bg-black/[0.02]",
                            )}
                        >
                            <td className="px-3 py-2 align-middle">
                                <Checkbox
                                    checked={selected}
                                    onCheckedChange={(value) =>
                                        onToggleRow(row.id, value === true)
                                    }
                                    aria-label={t("settings.contacts.select_row", {
                                        code: row.contactCode,
                                    })}
                                />
                            </td>
                            <td className="px-3 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                {/* <EllipsisTooltip> — single-line
                                   truncate. The dark Figma 9198:8036
                                   tooltip surfaces the full value ONLY
                                   when the visible text is actually
                                   clipped (scrollWidth > clientWidth);
                                   the browser-default `title` tooltip
                                   is never used. */}
                                <EllipsisTooltip text={row.contactCode} />
                            </td>
                            <td className="px-3 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                {/* 2-line clamp — the dark Figma 9198:8036
                                   tooltip surfaces the full value ONLY when
                                   the text actually overflows two lines
                                   (scrollHeight > clientHeight), so a name
                                   that wraps to exactly two lines shows no
                                   tooltip; empty value shows none either.
                                   Never the native `title` attribute. */}
                                <EllipsisTooltip text={row.contactName} lines={2} />
                            </td>
                            <td className="px-3 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                <EllipsisTooltip
                                    text={t(`settings.contacts.location.${row.location}`)}
                                />
                            </td>
                            <td className="px-3 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                <EllipsisTooltip text={row.taxId} />
                            </td>
                            <td className="px-3 py-2 align-middle">
                                <DepositAccountCell deposit={row.deposit} />
                            </td>
                            <td className="px-3 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                <AddressCell row={row} />
                            </td>
                            <td className="px-2 py-2 align-middle">
                                <button
                                    type="button"
                                    onClick={(e) =>
                                        onRowMenuToggle?.(
                                            row,
                                            e.currentTarget.getBoundingClientRect(),
                                        )
                                    }
                                    aria-label={t("settings.contacts.row_actions", {
                                        code: row.contactCode,
                                    })}
                                    aria-haspopup="menu"
                                    aria-expanded={openMenuRowId === row.id}
                                    className={cn(
                                        "flex size-6 cursor-pointer items-center justify-center rounded-md bg-white text-wb-ink shadow-wb-btn hover:bg-black/[0.03]",
                                        openMenuRowId === row.id && "bg-wb-bg-active",
                                    )}
                                >
                                    <MoreHorizontal className="size-3.5" strokeWidth={2} />
                                </button>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

/**
 * Address cell — primary (Current) Address on the left clamped to 2
 * lines, optional `+N` pill on the right counting any additional
 * addresses (e.g. (Changed) Address) recorded for the contact.
 *
 * The pill is anchored to the cell's start so it sits next to the
 * first text line, which lines it up with the row's other
 * single-line cells visually. Tooltip lists every extra address so
 * screen readers / hover users can see what's behind the count.
 */
function AddressCell({ row }: { row: ContactRow }) {
    const primary = row.addressDetail.current;
    const previous = row.addressDetail.previous;
    // `+N` count reflects all stored addresses beyond the current one
    // (mirrors the legacy convention from the previous `+N` badge).
    // The popover handles the "Address(Old)" rendering separately —
    // they're two views of the same data; the badge is the cell-level
    // signal, the popover is the hover-level detail.
    const extrasCount = Math.max(row.addresses.length - 1, 0);
    return (
        // `min-w-0 max-w-full` lets the flex children shrink to the
        // td's fixed colgroup width instead of forcing the parent
        // wider. Without it a single long word can push the row past
        // the table's `min-w` and into the kebab column.
        //
        // <AddressPopover> renders a fixed-width white card on hover —
        // "Address(Current)" + "Default" badge + value, plus
        // "Address(Old)" + value + valid-till date when the row has a
        // previous address. Cell stays single-line truncated so the
        // table layout is stable. Empty address → no popup. The
        // popover is portal-mounted at document.body so it's never
        // clipped by the table's overflow-auto scroll container.
        <div className="flex min-w-0 max-w-full items-center gap-2">
            <AddressPopover
                current={primary}
                previous={previous}
                className="block min-w-0 flex-1"
            >
                <span className="block truncate leading-5">{primary}</span>
            </AddressPopover>
            {extrasCount > 0 && (
                <span
                    aria-label={`+${extrasCount} additional address(es)`}
                    className="inline-flex h-5 shrink-0 items-center rounded-md bg-wb-ntrl-3 px-1.5 text-wb-12 font-medium text-wb-ntrl-8"
                >
                    +{extrasCount}
                </span>
            )}
        </div>
    );
}

/**
 * Two-line deposit-account cell — bank name + bank icon on top, account
 * number muted below. Mirrors the Bank cell baseline from CLAUDE.md
 * §8b but is local to Contacts because the icon order is consistent
 * here (icon AFTER name, no metadata tail).
 *
 * Returns {@code null} when the row has neither a bank name nor an
 * account number — legacy `comm_0184_002` allows a Local contact to be
 * saved with no bank info, and the column should read as empty for
 * that case (rather than rendering a lone bank icon next to two empty
 * lines).
 */
function DepositAccountCell({ deposit }: { deposit: ContactRow["deposit"] }) {
    const hasBankName  = !!deposit.bankName  && deposit.bankName.trim()  !== "";
    const hasAccountNo = !!deposit.accountNo && deposit.accountNo.trim() !== "";
    if (!hasBankName && !hasAccountNo) return null;
    return (
        // `min-w-0 max-w-full` on the outer column + the inner row
        // lets the bank-name and account-number spans shrink to the
        // td's fixed colgroup width instead of pushing the row past
        // the table's `min-w`. Without it long bank names or account
        // numbers overflow into the Address / kebab columns.
        // Both lines use <EllipsisTooltip> so the dark Figma 9198:8036
        // tooltip surfaces ONLY when the visible text is actually
        // clipped — short bank names / account numbers fit the column
        // and never trigger a tooltip, satisfying rule #5.
        <div className="flex min-w-0 max-w-full flex-col items-start">
            {hasBankName && (
                <div className="flex min-w-0 max-w-full items-center gap-1">
                    <EllipsisTooltip
                        text={deposit.bankName}
                        className="min-w-0 flex-1 text-wb-13 font-medium leading-5 text-wb-ink"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/table/ico-building.svg"
                        alt=""
                        aria-hidden
                        className="size-[var(--size-wb-icon-sm)] shrink-0 opacity-50"
                    />
                </div>
            )}
            {hasAccountNo && (
                <EllipsisTooltip
                    text={deposit.accountNo}
                    className="max-w-full text-wb-13 font-medium leading-5 text-wb-muted"
                />
            )}
        </div>
    );
}

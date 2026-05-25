"use client";

import { MoreHorizontal } from "lucide-react";

import TableHeaderCell from "@/components/shared/TableHeaderCell";
import { Checkbox } from "@/components/ui/checkbox";
import type { SortDirection } from "@/hooks/useTableSort";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
                            <td className="whitespace-nowrap px-3 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                {row.contactCode}
                            </td>
                            <td className="px-3 py-2 align-middle text-wb-13 font-medium uppercase text-wb-ink">
                                {/* Up to 2 lines per the latest spec —
                                   long names like "EMERALD CITY
                                   CONSULTING" wrap onto a second line
                                   instead of truncating with an
                                   ellipsis. `title` keeps the full
                                   name reachable for screen readers
                                   and on hover when the line clamp
                                   eventually engages on a 3+ line
                                   value. */}
                                <span className="line-clamp-2" title={row.contactName}>
                                    {row.contactName}
                                </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                {t(`settings.contacts.location.${row.location}`)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                {row.taxId}
                            </td>
                            <td className="px-3 py-2 align-middle">
                                <DepositAccountCell deposit={row.deposit} />
                            </td>
                            <td className="px-3 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                <AddressCell addresses={row.addresses} />
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
function AddressCell({ addresses }: { addresses: string[] }) {
    const primary = addresses[0] ?? "";
    const extras = addresses.slice(1);
    const tooltip =
        extras.length > 0
            ? [primary, ...extras].join("\n")
            : primary;
    return (
        <div className="flex items-start gap-2">
            <span className="line-clamp-2 flex-1 leading-5" title={tooltip}>
                {primary}
            </span>
            {extras.length > 0 && (
                <span
                    aria-label={`+${extras.length} additional address(es)`}
                    className="inline-flex h-5 shrink-0 items-center rounded-md bg-wb-ntrl-3 px-1.5 text-wb-12 font-medium text-wb-ntrl-8"
                >
                    +{extras.length}
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
        <div className="flex flex-col items-start">
            {hasBankName && (
                <div className="flex items-center gap-1">
                    <span className="whitespace-nowrap text-wb-13 font-medium leading-5 text-wb-ink">
                        {deposit.bankName}
                    </span>
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
                <span className="whitespace-nowrap text-wb-13 font-medium leading-5 text-wb-muted">
                    {deposit.accountNo}
                </span>
            )}
        </div>
    );
}

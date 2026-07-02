"use client";

import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

import BankFilterPopover, {
    type BankFilterOption,
    type BankFilterValue,
} from "@/components/shared/BankFilterPopover";
import DateField from "@/components/shared/DateField";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import ReportLayout from "@/components/shared/ReportLayout";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { SCREEN_IDS, DEFAULT_AREA_ID } from "@/lib/viewSettingScreens";
import { cn } from "@/lib/utils";

import {
    COLUMN_REGISTRY,
    DEFAULT_VIEW_SETTING_ITEMS,
    FIELD_LABEL_KEY,
    NUMERIC_FIELD_IDS,
    type ColumnDescriptor,
} from "./columns";
import type { BankGroup, LedgerEntry } from "./types";

/**
 * Banking > Daily Financial (HS) — bank-grouped ledger (legacy `rept_0017_001`,
 * Figma 291:7180) with column View Setting.
 *
 * API-wired: the ledger, Search, bank/account filter, per-field auto-save, and
 * Excel download are driven by {@link DailyFinancialHsClient}. View Setting
 * stays client-side (shared `<ViewSettingPopover>`, no `useViewSetting` hook).
 * The table is fully data-driven by the visible column set so toggling any of
 * the 12 columns preserves the rowSpan-grouped Bank/Currency cells and keeps
 * the SUB TOTAL / TOTAL rows aligned with whatever columns remain visible.
 */

/** Partial per-field save patch — wire (snake_case) keys the backend accepts. */
export type HsEntryPatch = Partial<
    Record<"rept_cd" | "pymn_cd" | "desc_nm_en" | "desc_nm_ko" | "memo", string>
>;

/** Editable column FIELD_ID → backend wire key. */
const FIELD_WIRE_KEY: Readonly<Record<string, keyof HsEntryPatch>> = {
    RECEIPT_CODE: "rept_cd",
    PAYMENT_CODE: "pymn_cd",
    DESCRIPTION_EN: "desc_nm_en",
    DESCRIPTION_KO: "desc_nm_ko",
    MEMO_NOTE: "memo",
};

type SaveField = (entry: LedgerEntry, fieldId: string, value: string) => void;

type DailyFinancialHsPageProps = {
    /** Bank-grouped ledger (projected from the API row stream). */
    groups: readonly BankGroup[];
    /** Report load in flight. */
    loading?: boolean;
    /** As-of date, ISO `YYYY-MM-DD`. */
    asOfDate: string;
    /** Fires when the user picks a new As-of date (does not auto-search). */
    onAsOfChange: (iso: string) => void;
    /** Bank/account options for the filter dropdown. */
    bankOptions: BankFilterOption[];
    /** Selected banks — empty = "All Banks". */
    bankFilters: BankFilterValue[];
    onBankFiltersChange: (next: BankFilterValue[]) => void;
    /** Runs the report for the current date + filter. */
    onSearch: () => void;
    /** Persists one edited field of a ledger row (blur/Enter). */
    onSaveEntry: (acctSeqNo: string, patch: HsEntryPatch) => void;
    /** Downloads the report as `.xlsx`. */
    onDownloadExcel: () => void;
};

export default function DailyFinancialHsPage({
    groups,
    loading = false,
    asOfDate,
    onAsOfChange,
    bankOptions,
    bankFilters,
    onBankFiltersChange,
    onSearch,
    onSaveEntry,
    onDownloadExcel,
}: DailyFinancialHsPageProps) {
    const { t } = useTranslation();

    // View Setting — DB-backed via the shared hook (legacy sys_scr_option_wecms
    // rept_0017_001/table1 → refactor screenId `banking-reports-daily-financial-hs`
    // / `default`, seeded in V249). The backend merges system defaults with the
    // user's saved overrides; Save/Reset persist to
    // PUT/DELETE /api/v1/screen-options/{screenId}/{dymAreaId}.
    const vs = useViewSetting(SCREEN_IDS.BANKING_REPORTS_DAILY_FINANCIAL_HS, DEFAULT_AREA_ID);
    // Until the backend resolves (or if the screen isn't seeded yet), render
    // against the static registry so the table never flashes empty — the DB
    // list is the source of truth once it loads.
    // Stable refs on both branches (module constant fallback) so the
    // visibleColumns memo doesn't recompute every render while unseeded.
    const liveItems: readonly ViewSettingItem[] =
        vs.items.length > 0 ? vs.items : DEFAULT_VIEW_SETTING_ITEMS;

    // `draft` is the in-popover working copy; `anchor` positions the popover
    // and doubles as the open flag.
    const [vsDraft, setVsDraft] = useState<ViewSettingItem[]>([]);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    function openViewSetting(rect: DOMRect) {
        // Snapshot the current View Setting list into a local draft so
        // checkbox / reorder edits stay reversible until Save (legacy
        // comm_0108_001 Cancel semantics). Fall back to the static default
        // when the API hasn't resolved / the screen isn't seeded.
        setVsDraft(liveItems.map((it) => ({ ...it })));
        setVsAnchor(rect);
    }
    function closeViewSetting() {
        setVsAnchor(null);
    }

    // Persist one edited field — skips non-persistable rows (empty ACCT_SEQ_NO,
    // e.g. the BEFORE_BALANCE row, which legacy never edits).
    const saveField: SaveField = (entry, fieldId, value) => {
        if (!entry.acctSeqNo) return;
        const wireKey = FIELD_WIRE_KEY[fieldId];
        if (!wireKey) return;
        onSaveEntry(entry.acctSeqNo, { [wireKey]: value });
    };

    // Visible column descriptors in DISP_ORD order (from the DB View Setting,
    // falling back to the static default) — the single source of truth every
    // table row iterates. Columns with no registry renderer are dropped so the
    // row-mapper never hits an unknown FIELD_ID.
    const visibleColumns = useMemo<ColumnDescriptor[]>(() => {
        const byId = new Map(COLUMN_REGISTRY.map((c) => [c.fieldId, c]));
        return liveItems
            .filter((it) => it.use_yn === "Y")
            .slice()
            .sort((a, b) => a.disp_ord - b.disp_ord)
            .map((it) => byId.get(it.field_id))
            .filter((c): c is ColumnDescriptor => Boolean(c));
    }, [liveItems]);

    return (
        <PageLayout>
            {/* Title row (Figma 291:7180): title left, list icon + Download
               Excel pinned top-right. The list icon opens View Setting. */}
            <PageHeader title={t("report.daily_financial_hs.title")}>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        aria-label={t("view_setting.aria.list_button")}
                        onClick={(e) =>
                            openViewSetting(e.currentTarget.getBoundingClientRect())
                        }
                        className="flex cursor-pointer items-center justify-center rounded-md p-1 hover:bg-black/5"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/assets/common/ico-list.svg" alt="" aria-hidden className="size-5" />
                    </button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onDownloadExcel}
                        className="h-[var(--h-wb-filter-btn)] gap-2 px-4 text-wb-14"
                    >
                        {/* Report Excel action must use the extracted Figma asset,
                           not a lucide glyph (CLAUDE.md §8a). */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/assets/common/ico-excel.svg" alt="" aria-hidden className="size-4" />
                        {t("report.download_excel")}
                    </Button>
                </div>
            </PageHeader>

            {/* Filter card (Figma 291:7395): As-of date + All Banks dropdown +
               Search button. No keyword SearchInput on this report. */}
            <div className="flex shrink-0 flex-col gap-4 rounded-[12px] border border-wb-ntrl-4 bg-wb-bg-card p-4">
                <div className="flex flex-wrap items-center gap-4">
                    <span className="text-wb-16 font-semibold text-wb-ink">
                        {t("report.as_of")}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                        <DateField
                            value={asOfDate}
                            onChange={(iso) => onAsOfChange(iso)}
                            formatValue={(iso) => iso.split("-").reverse().join("-")}
                        />
                        <BankFilterPopover
                            options={bankOptions}
                            value={bankFilters}
                            onChange={onBankFiltersChange}
                            triggerClassName="w-[260px]"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onSearch}
                            disabled={loading}
                            className="h-[var(--h-wb-filter-btn)] gap-2 px-4 text-wb-14 text-brand"
                        >
                            <Search className="size-4" strokeWidth={2} />
                            {t("common.search")}
                        </Button>
                    </div>
                </div>
            </div>

            {/* The table renders directly inside ReportLayout's single
               `overflow-auto` viewport so BOTH axes scroll on one container and
               the sticky `<thead>` anchors to it (matches Cash Flow). */}
            <ReportLayout>
                <LedgerTable groups={groups} columns={visibleColumns} onSaveField={saveField} />
            </ReportLayout>

            {/* Shared View Setting popover — DB-backed via `useViewSetting`.
               Save commits the draft through the shared hook (PUT
               /api/v1/screen-options/{screenId}/{dymAreaId}); it optimistically
               updates the table and rolls back on failure. Reset wipes the
               user's overrides and re-seeds the draft from the returned
               system defaults. Cancel / outside-click / ESC discards. */}
            {vsAnchor && (
                <ViewSettingPopover
                    anchorRect={vsAnchor}
                    items={vsDraft}
                    onItemsChange={setVsDraft}
                    getLabel={(item) => {
                        const key = FIELD_LABEL_KEY[item.field_id];
                        return key ? t(key) : item.field_nm;
                    }}
                    onSave={async () => {
                        // vs.save rolls back + records vs.error on failure;
                        // always close the popover afterward.
                        try {
                            await vs.save(vsDraft);
                        } catch {
                            /* handled by the hook (rollback + vs.error) */
                        } finally {
                            closeViewSetting();
                        }
                    }}
                    onReset={async () => {
                        // Use the list returned by reset() — the closure's
                        // vs.items is stale until the next render.
                        const next = await vs.reset();
                        setVsDraft(next.map((it) => ({ ...it })));
                    }}
                    onClose={closeViewSetting}
                />
            )}
        </PageLayout>
    );
}

const FROZEN_KINDS = new Set(["bank", "currency"]);

function LedgerTable({
    groups,
    columns,
    onSaveField,
}: {
    groups: readonly BankGroup[];
    columns: ColumnDescriptor[];
    onSaveField: SaveField;
}) {
    const { t } = useTranslation();

    // min-width = sum of visible column pixel widths (§7d). Computed inline
    // because the visible set changes at runtime — a static Tailwind
    // `min-w-[Npx]` class cannot express a value that depends on which columns
    // are shown. The table itself is `w-full` so hiding columns stretches the
    // remainder to the container edge (legacy `rept_0017_001` table1 parity —
    // no blank strip on the right); when the sum exceeds the viewport the
    // min-width keeps the horizontal scroll behaviour.
    const totalWidth = `${columns.reduce((sum, c) => sum + c.widthPx, 0)}px`;

    if (columns.length === 0) {
        // Every column hidden — nothing to render but the (empty) chrome.
        return null;
    }

    return (
        <table
            className="w-full table-fixed border-collapse"
            style={{ minWidth: totalWidth }}
        >
            <colgroup>
                {columns.map((col) => (
                    <col key={col.fieldId} className={col.widthClass} />
                ))}
            </colgroup>

            <thead className="sticky top-0 z-10">
                <tr className="h-14 bg-wb-bg-sidebar">
                    {columns.map((col) => (
                        <th
                            key={col.fieldId}
                            className={cn(
                                "border-b border-wb-table-border px-2.5 py-2 align-middle whitespace-nowrap",
                                col.align === "right" ? "text-right" : "text-left",
                                FROZEN_KINDS.has(col.kind) && "border-r",
                            )}
                        >
                            <span className="block text-wb-12 font-normal text-wb-muted">
                                {t(col.koKey)}
                            </span>
                            <span className="block text-wb-13 font-semibold text-wb-ink">
                                {t(col.enKey)}
                            </span>
                        </th>
                    ))}
                </tr>
            </thead>

            <tbody>
                {groups.map((group) => (
                    <BankGroupRows
                        key={group.id}
                        group={group}
                        columns={columns}
                        onSaveField={onSaveField}
                    />
                ))}
            </tbody>
        </table>
    );
}

function BankGroupRows({
    group,
    columns,
    onSaveField,
}: {
    group: BankGroup;
    columns: ColumnDescriptor[];
    onSaveField: SaveField;
}) {
    const { t } = useTranslation();

    // Frozen (Bank / Currency) cells rowSpan across the transaction rows AND
    // the SUB TOTAL row — the blue subtotal starts after them, leaving the
    // frozen pair white (Figma). The rowSpan only materialises when the group
    // has at least one entry row (it is emitted on the first entry); a
    // defensive zero-entry group renders its SUB TOTAL across ALL visible
    // columns instead so the row never comes up short.
    const span = group.entries.length + 1;
    const frozenSpanned = group.entries.length > 0;

    return (
        <>
            {group.entries.map((entry, idx) => (
                <tr key={entry.id} className="h-12 border-b border-wb-table-border">
                    {columns.map((col) => {
                        if (FROZEN_KINDS.has(col.kind)) {
                            // Rendered once (rowSpan) on the first entry row;
                            // subsequent rows leave the slot to the span.
                            return idx === 0 ? (
                                <td
                                    key={col.fieldId}
                                    rowSpan={span}
                                    className="border-r border-wb-table-border px-2.5 py-2 align-middle"
                                >
                                    {col.kind === "bank" ? (
                                        <BankCell group={group} />
                                    ) : (
                                        <span className="text-wb-13 font-medium text-wb-ink">
                                            {group.currency}
                                        </span>
                                    )}
                                </td>
                            ) : null;
                        }
                        return (
                            <EntryCell
                                key={col.fieldId}
                                col={col}
                                entry={entry}
                                onSaveField={onSaveField}
                            />
                        );
                    })}
                </tr>
            ))}

            {/* Blue SUB TOTAL row — one cell per visible column; the frozen
               Bank/Currency slots are filled by the rowSpan above. */}
            <tr className="h-12 border-b border-wb-table-border bg-wb-status-progress-bg hover:bg-wb-status-progress-bg">
                <SummaryCells
                    columns={columns}
                    skipFrozen={frozenSpanned}
                    label={t("report.daily_financial_hs.sub_total")}
                    value={(col) =>
                        col.subtotal ? col.subtotal(group.subtotal) : ""
                    }
                />
            </tr>

            {/* Green TOTAL row (full width) — closes the currency section. */}
            {group.closesTotal && group.total && (
                <tr className="h-12 border-b border-wb-table-border bg-wb-status-approved-bg hover:bg-wb-status-approved-bg">
                    <SummaryCells
                        columns={columns}
                        skipFrozen={false}
                        label={t("report.daily_financial_hs.total")}
                        value={(col) =>
                            col.total ? col.total(group.total!) : ""
                        }
                    />
                </tr>
            )}
        </>
    );
}

/**
 * Renders the cells of a SUB TOTAL / TOTAL row — strictly ONE `<td>` per
 * visible column, NO colSpan. Cell count therefore always matches the header
 * / `<colgroup>` regardless of which columns are hidden or how the popover
 * reordered them, and the cells can never overlap the Bank/Currency rowSpan
 * slots (a colSpan across an occupied slot is undefined table layout — the
 * old collapse-leading-columns approach broke exactly that way).
 *
 * Label placement ("SUB TOTAL" / "TOTAL"):
 *  - normally in the visible column immediately LEFT of the first numeric
 *    column, right-aligned — adjacent to the figures, like legacy;
 *  - when the row's first rendered cell is already numeric (all label-ish
 *    columns hidden), the label shares that first numeric cell (label left,
 *    value right) so it never disappears;
 *  - when no numeric column is visible at all, the label takes the first cell.
 *
 * `skipFrozen` — the SUB TOTAL row sits under the Bank/Currency rowSpan, so
 * those slots are already occupied and must not be re-rendered; the TOTAL row
 * (and a defensive zero-entry SUB TOTAL) renders every visible column itself.
 *
 * Cells are intentionally NOT `position: sticky` — a sticky opaque cell would
 * overlap the numeric cells scrolling under it.
 */
function SummaryCells({
    columns,
    skipFrozen,
    label,
    value,
}: {
    columns: ColumnDescriptor[];
    skipFrozen: boolean;
    label: string;
    value: (col: ColumnDescriptor) => string;
}) {
    const rendered = skipFrozen ? columns.filter((c) => !FROZEN_KINDS.has(c.kind)) : columns;
    if (rendered.length === 0) return null;

    const firstNumericIdx = rendered.findIndex((c) => NUMERIC_FIELD_IDS.has(c.fieldId));
    const labelIdx = firstNumericIdx > 0 ? firstNumericIdx - 1 : 0;
    // Label shares the value cell when the first rendered cell is numeric.
    const labelInline = firstNumericIdx === 0;

    return (
        <>
            {rendered.map((col, i) => {
                const v = value(col);
                if (i !== labelIdx) {
                    return (
                        <td key={col.fieldId} className="px-2.5 py-2 text-right align-middle">
                            <span className="block truncate text-wb-13 font-semibold text-wb-dark">
                                {v}
                            </span>
                        </td>
                    );
                }
                return (
                    <td key={col.fieldId} className="px-2.5 py-2 text-right align-middle">
                        {labelInline ? (
                            <span className="flex items-center justify-between gap-2">
                                <span className="whitespace-nowrap text-wb-13 font-semibold text-wb-dark">
                                    {label}
                                </span>
                                <span className="truncate text-wb-13 font-semibold text-wb-dark">
                                    {v}
                                </span>
                            </span>
                        ) : (
                            <span className="whitespace-nowrap text-wb-13 font-semibold text-wb-dark">
                                {label}
                            </span>
                        )}
                    </td>
                );
            })}
        </>
    );
}

function EntryCell({
    col,
    entry,
    onSaveField,
}: {
    col: ColumnDescriptor;
    entry: LedgerEntry;
    onSaveField: SaveField;
}) {
    const { t } = useTranslation();
    const raw = col.entry ? col.entry(entry) : "";

    // Editable inputs render ONLY on TRANSACTION rows (legacy `rept_0017_001.ts`
    // creates the Receipt/Payment/Description inputs only for `isTransaction`).
    // A BEFORE_BALANCE row's code/description cells fall through to the plain
    // cell below and render blank — no input boxes.
    if (col.kind === "input" && entry.editable) {
        return (
            // `key` includes the projected value so a refetch (search/save)
            // remounts the input with the fresh value — avoids a
            // setState-in-effect re-seed (react-hooks/set-state-in-effect).
            <InputCell
                key={`${col.fieldId}:${raw}`}
                initialValue={raw}
                placeholder={t(col.enKey)}
                onCommit={(value) => onSaveField(entry, col.fieldId, value)}
            />
        );
    }
    return (
        <td
            className={cn(
                "px-2.5 py-2 align-middle",
                col.align === "right" ? "text-right" : "text-left",
            )}
        >
            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                {raw}
            </span>
        </td>
    );
}

function BankCell({ group }: { group: BankGroup }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-wb-13 font-semibold text-wb-ink">{group.bankName}</span>
            {group.accountType && (
                <span className="text-wb-13 font-normal text-wb-ntrl-8">{group.accountType}</span>
            )}
            {group.accentLabel && (
                <span className="text-wb-13 font-semibold text-wb-status-rejected-text">
                    {group.accentLabel}
                </span>
            )}
            <span className="text-wb-13 font-normal text-wb-muted">{group.accountNo}</span>
            {group.dueDateLabel && (
                <span className="mt-1 text-wb-12 font-medium text-wb-status-rejected-text">
                    {group.dueDateLabel}
                </span>
            )}
            {group.dueDateValue && (
                <span className="text-wb-12 font-medium text-wb-status-rejected-text">
                    {group.dueDateValue}
                </span>
            )}
        </div>
    );
}

/**
 * Editable cell (Receipt/Payment code, descriptions, memo). Saves on blur or
 * Enter when the value changed (legacy `rept_0017_001_u001` auto-save). Re-seeds
 * from `initialValue` when the row reloads after a search/refetch. No clear (×)
 * button — the Figma design has none.
 */
function InputCell({
    initialValue,
    placeholder,
    onCommit,
}: {
    initialValue: string;
    placeholder: string;
    onCommit: (value: string) => void;
}) {
    const [value, setValue] = useState(initialValue);
    const savedRef = useRef(initialValue);

    function commit() {
        if (value !== savedRef.current) {
            savedRef.current = value;
            onCommit(value);
        }
    }

    return (
        <td className="px-2.5 py-2 align-middle">
            <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur(); // blur → commit
                }}
                placeholder={placeholder}
                className="h-8 w-full rounded-md border border-wb-ntrl-4 bg-white px-2 text-wb-13 font-medium text-wb-ink placeholder:font-normal placeholder:text-wb-ntrl-5 focus:border-brand focus:outline-none"
            />
        </td>
    );
}

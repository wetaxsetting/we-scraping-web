"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";

import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import ChartOfAccountsTableColumns, {
    CHART_OF_ACCOUNTS_TABLE_MIN_WIDTH,
} from "./ChartOfAccountsTableColumns";
import type { ChartOfAccountsRow } from "./types";

type ChartOfAccountsTableProps = {
    rows: ChartOfAccountsRow[];
    /** Optional handlers — left undefined the row controls are inert. */
    onEdit?: (row: ChartOfAccountsRow) => void;
    onDelete?: (row: ChartOfAccountsRow) => void;
    /** Selected `chartAcctSeqNo` set — populated by the parent panel.
     *  Only child / non-restricted rows are selectable; group rows have
     *  no checkbox at all. Pass an empty Set to render every checkbox
     *  unchecked. */
    selectedIds?: ReadonlySet<string>;
    /** Toggle one selectable row. Wired only when {@link selectedIds}
     *  is also provided. */
    onToggleRow?: (chartAcctSeqNo: string, selected: boolean) => void;
    /** Toggle every selectable row. The panel decides whether "all" is
     *  the keyword-filtered slice or the whole tenant — the table just
     *  forwards the click. */
    onToggleAll?: (selectAll: boolean) => void;
    /** True when every selectable row in the current view is in
     *  {@link selectedIds}. Drives the header checkbox's checked state.
     *  When {@code false} but at least one row is selected, the parent
     *  passes the indeterminate flag below. */
    allSelected?: boolean;
    /** True when SOME but not all selectable rows are selected — the
     *  header checkbox renders the indeterminate (mixed) glyph. */
    someSelected?: boolean;
};

/**
 * Chart of Accounts table — Figma 9196:12740.
 *
 * Mirrors the canonical Settings-popup table chrome shared by Bank Account,
 * Approval Line and ERP Transaction History: bare `<table>` + `table-fixed`
 * + `<colgroup>`, sticky `bg-wb-bg-sidebar` thead, `text-wb-13` for both
 * header and body (CLAUDE.md §5 table typography), and shared
 * `border-wb-table-border` row separators. Headers are display-only — no
 * sort glyph and no click-to-sort behaviour on this screen.
 *
 * Rows are a two-level tree: group rows (ACC-01 / ACC-02 / ACC-03) render
 * with bold typography and no Parent / Calc Rule / Status / Actions
 * affordances; child rows render the standard cell set with the Parent
 * Account, Status, and edit/delete affordances. Both row kinds share the
 * same `<colgroup>` so columns align across the two styles.
 */
export default function ChartOfAccountsTable({
    rows,
    onEdit,
    onDelete,
    selectedIds,
    onToggleRow,
    onToggleAll,
    allSelected = false,
    someSelected = false,
}: ChartOfAccountsTableProps) {
    const { t } = useTranslation();

    // Header checkbox state: `true` when every selectable row in scope
    // is checked, `"indeterminate"` when only some are. Radix's Checkbox
    // (shadcn primitive) accepts both shapes via `CheckedState`.
    const headerChecked: boolean | "indeterminate" = allSelected
        ? true
        : someSelected
            ? "indeterminate"
            : false;

    // accountCode → English name. Used to render the Parent Account
    // badge as "{code} {parent's name}" (e.g. "ACC-01 REVENUE",
    // "Code002 OTHERS") instead of just the bare code. Truncation
    // inside the badge handles the narrow-column case so the cell
    // ends up reading "ACC-01 REVEN" / "Code002 OTH" — matches the
    // Figma 9196:12740 reference. Built from the same rows the table
    // renders so the lookup is always in sync with what's visible
    // (orphan / out-of-view parents fall back to bare-code).
    const nameByCode = useMemo(() => {
        const m = new Map<string, string>();
        for (const row of rows) m.set(row.accountCode, row.accountTypeEn);
        return m;
    }, [rows]);

    return (
        <table
            className="table-fixed border-collapse"
            style={{
                width: "100%",
                minWidth: CHART_OF_ACCOUNTS_TABLE_MIN_WIDTH,
            }}
        >
            <ChartOfAccountsTableColumns />

            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                    <th className="bg-wb-bg-sidebar px-2.5 align-middle">
                        <span className="flex items-center justify-center">
                            <Checkbox
                                aria-label={t("settings.chart_of_accounts.select_all")}
                                checked={headerChecked}
                                onCheckedChange={(next) => {
                                    // Header toggles every selectable row.
                                    // Treat the indeterminate path as a
                                    // "select all" click — matches the
                                    // canonical select-all UX (click on a
                                    // mixed header fills the selection).
                                    onToggleAll?.(next !== false);
                                }}
                            />
                        </span>
                    </th>
                    <HeaderCell>
                        {t("settings.chart_of_accounts.col.account_code")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.chart_of_accounts.col.type_en")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.chart_of_accounts.col.type_vi")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.chart_of_accounts.col.type_ko")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.chart_of_accounts.col.parent_account")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.chart_of_accounts.col.calc_rule")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.chart_of_accounts.col.status")}
                    </HeaderCell>
                    <th
                        className="bg-wb-bg-sidebar"
                        aria-label={t("settings.chart_of_accounts.col.actions")}
                    />
                </tr>
            </thead>

            <tbody>
                {rows.map((row) => {
                    const isGroup = row.kind === "group";

                    return (
                        <tr
                            key={row.id}
                            className="border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]"
                        >
                            {/* Selection checkbox — group rows (restricted
                               roots ACC-01/02/03) have no checkbox at all
                               because the backend rejects bulk delete /
                               deactivate of restricted codes. The cell stays
                               for column alignment. */}
                            <td className="px-2.5 py-2.5 align-middle">
                                {!isGroup && !row.restricted && (
                                    <span className="flex items-center justify-center">
                                        <Checkbox
                                            aria-label={t(
                                                "settings.chart_of_accounts.select_row",
                                                { code: row.accountCode },
                                            )}
                                            checked={
                                                selectedIds?.has(row.chartAcctSeqNo) ?? false
                                            }
                                            onCheckedChange={(next) => {
                                                onToggleRow?.(
                                                    row.chartAcctSeqNo,
                                                    next !== false,
                                                );
                                            }}
                                        />
                                    </span>
                                )}
                            </td>

                            {/* Account Code — bold for group rows so the
                               grouping visually pops; child rows render in
                               the standard medium body weight.
                               Indentation reflects `chartAcctLevel` so the
                               tree shape (PO directive 2026-05-25) is
                               visible at a glance:
                                 level 1 → no indent (roots)
                                 level 2 → 16 px (one indent stop)
                                 level 3 → 32 px (two indent stops)
                               Backend already DFS pre-orders the rows
                               so the indentation matches the parent
                               immediately above it. Orphans / cycle
                               rows (level === null) get no indent —
                               they're listed in the orphan tail. */}
                            <BodyCell>
                                <span
                                    className={cn(
                                        "block truncate text-wb-13 text-wb-ink",
                                        isGroup ? "font-bold" : "font-medium",
                                    )}
                                    style={{
                                        paddingLeft:
                                            row.chartAcctLevel && row.chartAcctLevel > 1
                                                ? `${(row.chartAcctLevel - 1) * 16}px`
                                                : undefined,
                                    }}
                                >
                                    {row.accountCode}
                                </span>
                            </BodyCell>

                            {/* Account Type (English) — bold for group rows */}
                            <BodyCell>
                                <span
                                    className={cn(
                                        "block truncate text-wb-13 text-wb-ink",
                                        isGroup ? "font-bold" : "font-medium",
                                    )}
                                >
                                    {row.accountTypeEn}
                                </span>
                            </BodyCell>

                            {/* Account Type (Vietnamese) — bold for group rows.
                               Long values truncate with ellipsis; the full
                               string surfaces via the shared
                               <EllipsisTooltip> (Figma 9198:8036) when the
                               cell width clips the text. No `title`
                               attribute — browser-default tooltip is
                               explicitly forbidden. */}
                            <BodyCell>
                                <EllipsisTooltip
                                    text={row.accountTypeVi}
                                    className={cn(
                                        "text-wb-13 text-wb-ink",
                                        isGroup ? "font-bold" : "font-medium",
                                    )}
                                />
                            </BodyCell>

                            {/* Account Type (Korean) — bold for group rows.
                               Same ellipsis-tooltip pattern as the
                               Vietnamese column above. */}
                            <BodyCell>
                                <EllipsisTooltip
                                    text={row.accountTypeKo}
                                    className={cn(
                                        "text-wb-13 text-wb-ink",
                                        isGroup ? "font-bold" : "font-medium",
                                    )}
                                />
                            </BodyCell>

                            {/* Parent Account — rounded badge on child rows
                               only; group rows leave the cell blank.
                               Label format mirrors Figma 9196:12740:
                               "{parentCode} {parentNameEn}" (e.g.
                               "ACC-01 REVENUE", "Code002 OTHERS"). The
                               badge's `max-w-full` clamps to the cell;
                               the inner <EllipsisTooltip> (Figma
                               9198:8036) ellipsis-truncates the label
                               inside the badge and surfaces the full
                               string in a portalled tooltip only when
                               the text is actually clipped — never via
                               the browser-default `title` attribute.
                               Orphan rows whose parent is out of view
                               fall back to the bare code. */}
                            <BodyCell>
                                {row.kind === "child" && row.parentCode && (() => {
                                    const parentName = nameByCode.get(row.parentCode);
                                    const label = parentName
                                        ? `${row.parentCode} ${parentName}`
                                        : row.parentCode;
                                    return (
                                        <span className="inline-flex max-w-full items-center rounded-md bg-white px-2 py-0.5 text-wb-13 font-medium text-wb-ink shadow-wb-outline">
                                            <EllipsisTooltip text={label} />
                                        </span>
                                    );
                                })()}
                            </BodyCell>

                            {/* Calc Rule — small badge with + or - sign.
                               PO directive 2026-05-25: Calc Rule is
                               only meaningful for level-3 rows; level 1
                               and level 2 act as grouping headers and
                               must not render a sign. The badge is
                               gated on both `calcRule` presence AND
                               `chartAcctLevel === 3` so grandfathered
                               DEV rows that carry a value at the wrong
                               level no longer leak through the table —
                               backend `assertCalRuleLevel3Only` blocks
                               new writes, this is the display side. */}
                            <BodyCell>
                                {row.kind === "child"
                                    && row.calcRule
                                    && row.chartAcctLevel === 3 && (
                                    <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-md bg-white px-2 text-wb-13 font-medium text-wb-ink shadow-wb-outline">
                                        {row.calcRule}
                                    </span>
                                )}
                            </BodyCell>

                            {/* Status — blue "Active" / red "Inactive" badge
                               on child rows. Group rows leave the cell
                               empty (system-managed roots have no toggle). */}
                            <BodyCell>
                                {row.kind === "child" && (
                                    <span
                                        className={cn(
                                            "inline-flex items-center rounded-md px-2 py-0.5 text-wb-13 font-medium",
                                            row.status === "active"
                                                ? "bg-brand-softer text-brand-active"
                                                : "bg-wb-status-rejected-bg text-wb-status-rejected-text",
                                        )}
                                    >
                                        {t(
                                            row.status === "active"
                                                ? "settings.chart_of_accounts.status.active"
                                                : "settings.chart_of_accounts.status.inactive",
                                        )}
                                    </span>
                                )}
                            </BodyCell>

                            {/* Actions — Edit + Delete icon buttons on child
                               rows only. Restricted rows (the panel passes
                               them as "group" rows in the refactor data
                               shape) leave the cell empty. Non-restricted
                               child rows always render the pair; the
                               handlers themselves are no-ops when the
                               backend rejects the action (the parent panel
                               surfaces the error via useDialog).

                               `justify-end` pins the pair against the
                               cell's right edge so it visually hugs the
                               table's right side regardless of how the
                               140 px column relates to the icons'
                               combined width (~62 px). `shrink-0` on
                               each button locks the 28 px size against
                               any flex pressure if a future change
                               shares the cell with a sibling. */}
                            <td className="px-2.5 py-2.5 align-middle">
                                {row.kind === "child" && (
                                    <div className="flex items-center justify-end gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => onEdit?.(row)}
                                            aria-label={t(
                                                "settings.chart_of_accounts.actions.edit_aria",
                                                { code: row.accountCode },
                                            )}
                                            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md bg-white text-wb-ntrl-8 shadow-wb-btn hover:bg-black/[0.03]"
                                        >
                                            <Pencil
                                                className="size-3.5"
                                                strokeWidth={1.8}
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDelete?.(row)}
                                            aria-label={t(
                                                "settings.chart_of_accounts.actions.delete_aria",
                                                { code: row.accountCode },
                                            )}
                                            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md bg-white text-wb-red-07 shadow-[0_0_0_1px_var(--color-wb-red-04)] hover:bg-wb-red-04/10"
                                        >
                                            <Trash2
                                                className="size-3.5"
                                                strokeWidth={1.8}
                                            />
                                        </button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

/**
 * Canonical Settings-popup table header cell — shared chrome with
 * Bank Account / Approval Line / ERP Transaction History tables.
 */
function HeaderCell({ children }: { children: React.ReactNode }) {
    return (
        <th className="whitespace-nowrap bg-wb-bg-sidebar px-3 py-3 text-left align-middle text-wb-13 font-semibold text-wb-dark">
            {children}
        </th>
    );
}

function BodyCell({ children }: { children: React.ReactNode }) {
    return <td className="px-3 py-3 align-middle">{children}</td>;
}

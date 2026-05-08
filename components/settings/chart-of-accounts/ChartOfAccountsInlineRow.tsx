"use client";

import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import ChartOfAccountsTableColumns, {
    CHART_OF_ACCOUNTS_TABLE_MIN_WIDTH,
} from "./ChartOfAccountsTableColumns";
import type { ChartOfAccountsRow } from "./types";

const ACCOUNT_CODE_MAX = 10;

type StatusValue = "active" | "inactive";

type InlineMode =
    | { kind: "add" }
    | { kind: "edit"; row: Extract<ChartOfAccountsRow, { kind: "child" }> };

type ChartOfAccountsInlineRowProps = {
    mode: InlineMode;
    onCancel: () => void;
    onSave: () => void;
    /**
     * Optional class names applied to the outer `<table>`. The panel uses
     * this to stack `mt-auto` (fills empty space below the data table when
     * rows are short — eliminates the blank gap that triggered the
     * refactor) on top of `sticky bottom-0` (keeps the row pinned to the
     * scroll container's bottom while tbody scrolls). Both are panel-level
     * concerns; the row itself stays presentation-only.
     */
    className?: string;
};

/**
 * Chart of Accounts — inline Add / Edit row (Figma 9196:13534).
 *
 * Renders as a self-contained `<table>` with the SAME `<colgroup>` as
 * the main read-only `<ChartOfAccountsTable>`. Both tables sit inside
 * one shared horizontal-scroll container (panel layer), so columns
 * stay perfectly aligned with the header above regardless of vertical
 * or horizontal scroll position — the canonical CLAUDE.md §7a
 * sibling-table pattern. Two modes:
 *
 *   - kind: "add"  — empty inputs with placeholders; status defaults to
 *                    "Active". Used by the panel's "+ Add A New Account"
 *                    button.
 *   - kind: "edit" — inputs pre-seeded from the clicked row. Used by the
 *                    pencil icon on each child row.
 *
 * The cell layout maps to the table's 9-column colgroup
 * (checkbox · code · english · vietnamese · korean · parent · calc rule
 *  · status · actions). Calc Rule sits empty in the inline row to match
 * the Figma frame; the trailing cell colspans Status + Actions so the
 * dropdown sits next to the Cancel / Save buttons inside one flex row,
 * matching Figma 9196:13899.
 *
 * Static UI: every input writes only to local state; Save is a no-op
 * that delegates to `onSave`, which today just dismisses the row. Once
 * the API lands, swap `onSave` for the real PATCH / POST call.
 */
export default function ChartOfAccountsInlineRow({
    mode,
    onCancel,
    onSave,
    className,
}: ChartOfAccountsInlineRowProps) {
    const { t } = useTranslation();

    const seed = mode.kind === "edit" ? mode.row : null;

    const [accountCode, setAccountCode] = useState(seed?.accountCode ?? "");
    const [nameEn, setNameEn] = useState(seed?.accountTypeEn ?? "");
    const [nameVi, setNameVi] = useState(seed?.accountTypeVi ?? "");
    const [nameKo, setNameKo] = useState(seed?.accountTypeKo ?? "");
    const [parentCode, setParentCode] = useState(seed?.parentCode ?? "");
    const [status, setStatus] = useState<StatusValue>("active");

    return (
        <table
            className={cn(
                "table-fixed border-collapse border-t border-wb-table-border bg-wb-bg-footer",
                className,
            )}
            style={{
                width: "100%",
                minWidth: CHART_OF_ACCOUNTS_TABLE_MIN_WIDTH,
            }}
        >
            <ChartOfAccountsTableColumns />
            <tbody>
                {/* `align-top` keeps every cell's first child (the input
                   row) anchored at the same Y, so inputs across all
                   columns line up horizontally even though the Account
                   Code cell is taller (it carries the character counter
                   below the input). Row height = 10px py + 32px input +
                   8px gap + 12px counter + 10px py = 72px (Figma spec).
                   Cells without a counter get the same 10px py and
                   leave the bottom slack empty — that's how Figma frames
                   the row. */}
                <tr className="align-top">
                    {/* Checkbox column — empty placeholder so the row
                       aligns with the table's first column. Reuses the
                       same 10px vertical padding as the input cells so
                       the row height is uniform across cells. */}
                    <td className="px-2.5 py-2.5" />

                    {/* Account Code — input + character counter stack. */}
                    <td className="px-2.5 py-2.5">
                        <InlineInput
                            value={accountCode}
                            onChange={(next) =>
                                setAccountCode(next.slice(0, ACCOUNT_CODE_MAX))
                            }
                            maxLength={ACCOUNT_CODE_MAX}
                            placeholder={t(
                                "settings.chart_of_accounts.inline.placeholder.code",
                            )}
                            ariaLabel={t(
                                "settings.chart_of_accounts.col.account_code",
                            )}
                        />
                        <span className="mt-2 block text-wb-12 font-medium leading-3 text-wb-ntrl-8">
                            {t(
                                "settings.chart_of_accounts.inline.character_count",
                                {
                                    current: accountCode.length,
                                    max: ACCOUNT_CODE_MAX,
                                },
                            )}
                        </span>
                    </td>

                    {/* Account Name (English) */}
                    <td className="px-2.5 py-2.5">
                        <InlineInput
                            value={nameEn}
                            onChange={setNameEn}
                            placeholder={t(
                                "settings.chart_of_accounts.inline.placeholder.name_en",
                            )}
                            ariaLabel={t(
                                "settings.chart_of_accounts.col.type_en",
                            )}
                        />
                    </td>

                    {/* Account Name (Vietnamese) */}
                    <td className="px-2.5 py-2.5">
                        <InlineInput
                            value={nameVi}
                            onChange={setNameVi}
                            placeholder={t(
                                "settings.chart_of_accounts.inline.placeholder.name_vi",
                            )}
                            ariaLabel={t(
                                "settings.chart_of_accounts.col.type_vi",
                            )}
                        />
                    </td>

                    {/* Account Name (Korean) */}
                    <td className="px-2.5 py-2.5">
                        <InlineInput
                            value={nameKo}
                            onChange={setNameKo}
                            placeholder={t(
                                "settings.chart_of_accounts.inline.placeholder.name_ko",
                            )}
                            ariaLabel={t(
                                "settings.chart_of_accounts.col.type_ko",
                            )}
                        />
                    </td>

                    {/* Parent Account — input with trailing search icon */}
                    <td className="px-2.5 py-2.5">
                        <InlineInput
                            value={parentCode}
                            onChange={setParentCode}
                            placeholder={t(
                                "settings.chart_of_accounts.inline.placeholder.parent",
                            )}
                            ariaLabel={t(
                                "settings.chart_of_accounts.col.parent_account",
                            )}
                            trailingIcon={
                                <Search
                                    className="size-4 text-wb-ntrl-6"
                                    strokeWidth={1.8}
                                    aria-hidden
                                />
                            }
                        />
                    </td>

                    {/* Calc Rule — empty in the inline row, matches Figma
                       9196:13534. */}
                    <td className="px-2.5 py-2.5" />

                    {/* Status + Actions — colSpan=2 so the merged cell
                       holds the Status dropdown on the left and Cancel /
                       Save on the right, all on one horizontal line at
                       the far right of the row. The 96px Actions column
                       alone is too narrow for both buttons; merging with
                       Status gives the trailing cell ~206px so Cancel +
                       Save fit alongside the dropdown. The whole cell
                       lives inside the table, so it follows horizontal
                       scrolling in lockstep with the inputs to its left.
                       All three controls share `h-8` so they sit at the
                       same Y as the input cells (row uses `align-top`). */}
                    <td colSpan={2} className="px-2.5 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <StatusDropdown
                                value={status}
                                onChange={setStatus}
                                t={t}
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                                >
                                    {t("settings.chart_of_accounts.inline.cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={onSave}
                                    className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium tracking-wb-tight text-white shadow-wb-brand-btn hover:bg-brand-hover"
                                >
                                    {t("settings.chart_of_accounts.inline.save")}
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    );
}

/**
 * Inline text input — Figma 9196:13888 et al. 32px high, 6px corner
 * radius, 1px ring shadow (`shadow-wb-outline`), 14px medium body. Slim
 * variant of the standard `<Input>` primitive sized for a row that has
 * to fit five inputs side-by-side inside a settings table.
 */
type InlineInputProps = {
    value: string;
    onChange: (next: string) => void;
    placeholder: string;
    ariaLabel: string;
    maxLength?: number;
    trailingIcon?: React.ReactNode;
};

function InlineInput({
    value,
    onChange,
    placeholder,
    ariaLabel,
    maxLength,
    trailingIcon,
}: InlineInputProps) {
    return (
        <div className="relative w-full">
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={ariaLabel}
                maxLength={maxLength}
                className={cn(
                    "h-8 w-full rounded-md bg-white py-2 pl-2 text-wb-14 font-medium leading-4 text-wb-ink placeholder:text-wb-ntrl-5",
                    "shadow-wb-outline outline-none",
                    "focus:shadow-[0px_0px_0px_1px_var(--color-brand)]",
                    trailingIcon ? "pr-7" : "pr-2",
                )}
            />
            {trailingIcon && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center"
                >
                    {trailingIcon}
                </span>
            )}
        </div>
    );
}

/**
 * Status dropdown — Figma 9196:13898. Static-UI: clicking the trigger
 * is a no-op (no menu opens). The visible label still tracks `value`
 * so a future menu wiring can flip the state without touching the
 * trigger markup. 32px high, default-button shadow, black label,
 * trailing chevron — matches the canonical Settings dropdown chrome.
 */
function StatusDropdown({
    value,
    onChange: _onChange,
    t,
}: {
    value: StatusValue;
    onChange: (next: StatusValue) => void;
    t: (key: string) => string;
}) {
    const labelKey =
        value === "active"
            ? "settings.chart_of_accounts.status.active"
            : "settings.chart_of_accounts.status.inactive";

    return (
        <button
            type="button"
            className="inline-flex h-8 min-w-[100px] cursor-pointer items-center justify-between gap-1 rounded-md bg-white pl-2 pr-1.5 text-wb-14 font-medium tracking-wb-tight text-wb-dark shadow-wb-btn hover:bg-black/[0.02]"
        >
            <span>{t(labelKey)}</span>
            <ChevronDown
                className="size-4 shrink-0 text-wb-dark"
                strokeWidth={1.8}
                aria-hidden
            />
        </button>
    );
}

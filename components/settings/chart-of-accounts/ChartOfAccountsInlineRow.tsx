"use client";

import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import ChartOfAccountsTableColumns, {
    CHART_OF_ACCOUNTS_TABLE_MIN_WIDTH,
} from "./ChartOfAccountsTableColumns";
import InlineDropdown, { type InlineDropdownOption } from "./InlineDropdown";
import type {
    ChartOfAccountsFormValues,
    ChartOfAccountsStatus,
    InlineRowMode,
} from "./types";

const ACCOUNT_CODE_MAX = 10;
const ACCOUNT_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Lightweight option type for the Parent picker. */
export type ParentOption = {
    code:  string;
    label: string;
    /** Level of THIS parent option in the tree (1 / 2 / 3). The inline
     *  row uses {@code level + 1} as the prospective level of the new /
     *  edited child, then gates the Calc Rule dropdown on that
     *  prospective level === 3 (PO directive 2026-05-25 — only level-3
     *  rows may carry a +/- sign). */
    level: number;
};

type ChartOfAccountsInlineRowProps = {
    mode: NonNullable<InlineRowMode>;
    initialValues: ChartOfAccountsFormValues;
    parentOptions: ParentOption[];
    submitting?: boolean;
    onCancel: () => void;
    onSave: (values: ChartOfAccountsFormValues) => void;
    /** Optional class names applied to the outer `<table>` — the panel
     *  uses this to stack `mt-auto` (fills empty space below the data
     *  table when rows are short) on top of `sticky bottom-0` (keeps
     *  the row pinned to the scroll container's bottom while tbody
     *  scrolls). Both are panel-level concerns; the row itself stays
     *  presentation-only. */
    className?: string;
};

/**
 * Chart of Accounts — inline Add / Edit row (Figma 9196:13534).
 *
 * Renders as a self-contained `<table>` with the SAME `<colgroup>` as
 * the main read-only `<ChartOfAccountsTable>`. Both tables sit inside
 * one shared horizontal-scroll container (panel layer), so columns
 * stay aligned with the header above regardless of scroll position
 * (canonical CLAUDE.md §7a sibling-table pattern).
 *
 * <p>Phase 1 wires Save to the panel's mutation hook. The parent /
 * calc-rule / status pickers are real `<select>` elements styled to
 * match the legacy button chrome — readable, keyboard-navigable, and
 * cheap to maintain. Client-side validation guards the code shape
 * (1..10 chars, alphanumeric + underscore + hyphen) so the user gets
 * inline feedback before the round-trip; the backend re-validates
 * everything (cycle / depth / restricted-rename / parent-existence /
 * duplicate-code) and any surviving error surfaces via the parent's
 * error dialog.
 */
export default function ChartOfAccountsInlineRow({
    mode,
    initialValues,
    parentOptions,
    submitting,
    onCancel,
    onSave,
    className,
}: ChartOfAccountsInlineRowProps) {
    const { t } = useTranslation();

    const [accountCode, setAccountCode] = useState(initialValues.accountCode);
    const [nameEn, setNameEn]            = useState(initialValues.nameEn);
    const [nameVi, setNameVi]            = useState(initialValues.nameVi);
    const [nameKo, setNameKo]            = useState(initialValues.nameKo);
    const [parentCode, setParentCode]    = useState(initialValues.parentCode);
    const [calcRule, setCalcRule]        = useState(initialValues.calcRule);
    const [status, setStatus]            = useState<ChartOfAccountsStatus>(
        initialValues.status,
    );
    const [touched, setTouched] = useState(false);

    // Prospective level of THIS row given the currently-picked parent.
    // PO directive 2026-05-25: the Calc Rule (+/-) is only allowed at
    // level 3. We compute it from the picked parent option's `level`
    // field — `parent.level + 1` is what the new / edited row would
    // become. When no parent is picked yet (blank) the prospective
    // level is unknown; we treat that as "not level 3" and disable
    // the Calc Rule dropdown.
    const prospectiveLevel = useMemo(() => {
        if (!parentCode) return null;
        const opt = parentOptions.find((p) => p.code === parentCode);
        return opt ? opt.level + 1 : null;
    }, [parentCode, parentOptions]);
    const calcRuleAllowed = prospectiveLevel === 3;

    // Force calcRule back to "" whenever the picked parent makes the
    // row a non-level-3 row. Otherwise an old value typed into the
    // dropdown before the parent change would still ride the Save
    // payload and trip the backend `assertCalRuleLevel3Only` guard.
    useEffect(() => {
        if (!calcRuleAllowed && calcRule !== "") setCalcRule("");
    }, [calcRuleAllowed, calcRule]);

    /* ---------------------------------------------------------------
     *  Dropdown option lists — translated lazily per render so locale
     *  switches inside the open inline row propagate without a remount.
     * --------------------------------------------------------------- */

    /**
     * Parent dropdown options — the legacy "(No parent)" head row was
     * removed per PO directive 2026-05-25. Level 1 (NULL parent) is
     * reserved for the three seeded RESTRICTED_CODES (ACC-01 / ACC-02 /
     * ACC-03); every user-driven create / update must pick a real
     * parent. The placeholder on the closed dropdown still reads
     * "Select parent…" so the requirement is visible before the user
     * opens it.
     */
    const parentDropdownOptions = useMemo<InlineDropdownOption[]>(() => {
        return parentOptions.map((opt) => ({
            value: opt.code,
            label: opt.label,
        }));
    }, [parentOptions]);

    const calcRuleOptions = useMemo<InlineDropdownOption[]>(() => [
        { value: "", label: t("settings.chart_of_accounts.inline.calc_rule_none") },
        { value: "+", label: "+" },
        { value: "-", label: "-" },
    ], [t]);

    const statusOptions = useMemo<InlineDropdownOption[]>(() => [
        { value: "active",   label: t("settings.chart_of_accounts.status.active") },
        { value: "inactive", label: t("settings.chart_of_accounts.status.inactive") },
    ], [t]);

    /**
     * Client-side validation — covers the shape rules the backend's
     * bean-validation also checks. The backend is the source of truth
     * for cross-row rules (duplicate / cycle / depth / parent-exists);
     * those surface via dialog after the round-trip.
     */
    const codeError = (() => {
        if (!touched) return null;
        const t = accountCode.trim();
        if (!t) return "required";
        if (t.length > ACCOUNT_CODE_MAX) return "length";
        if (!ACCOUNT_CODE_PATTERN.test(t)) return "format";
        return null;
    })();
    const nameEnError = touched && !nameEn.trim() ? "required" : null;
    // Parent is required — PO directive 2026-05-25. Backend returns
    // WBE_CHART_OF_ACCOUNTS_PARENT_REQUIRED if it slips through.
    const parentError = touched && !parentCode.trim() ? "required" : null;
    const hasError =
        codeError !== null || nameEnError !== null || parentError !== null;

    const handleSave = () => {
        setTouched(true);
        // Re-evaluate against fresh values — `touched` only becomes
        // true on this line and the React state above is still stale
        // (will update next render). So check inline.
        if (!accountCode.trim()) return;
        if (accountCode.trim().length > ACCOUNT_CODE_MAX) return;
        if (!ACCOUNT_CODE_PATTERN.test(accountCode.trim())) return;
        if (!nameEn.trim()) return;
        if (!parentCode.trim()) return;
        onSave({
            accountCode: accountCode.trim(),
            nameEn:      nameEn.trim(),
            nameVi,
            nameKo,
            parentCode,
            calcRule,
            status,
        });
    };

    return (
        <table
            className={cn(
                "table-fixed border-collapse border-t border-wb-table-border bg-wb-bg-footer",
                className,
            )}
            style={{
                width:    "100%",
                minWidth: CHART_OF_ACCOUNTS_TABLE_MIN_WIDTH,
            }}
        >
            <ChartOfAccountsTableColumns />
            <tbody>
                {/* align-top keeps every cell's first child (the input
                   row) anchored at the same Y so inputs line up even
                   though Account Code is taller (carries the counter). */}
                <tr className="align-top">
                    {/* Checkbox column — empty placeholder. */}
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
                            invalid={codeError !== null}
                            // The "edit" variant disables the code input —
                            // changing the code on an existing row is
                            // allowed by the backend (the dup-on-rename
                            // check fires), but the static UI didn't
                            // surface it and the inline edit flow is
                            // simpler when the surrogate (`chartAcctSeqNo`)
                            // stays mapped to one code. A future MR can
                            // drop this once the rename UX is settled.
                            disabled={mode.kind === "edit"}
                        />
                        <span className="mt-2 block text-wb-12 font-medium leading-3 text-wb-ntrl-8">
                            {t(
                                "settings.chart_of_accounts.inline.character_count",
                                {
                                    current: accountCode.length,
                                    max:     ACCOUNT_CODE_MAX,
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
                            invalid={nameEnError !== null}
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

                    {/* Parent Account — styled dropdown anchored to its
                       trigger via a portalled panel, so it can overflow
                       the row's <td> clip rect AND the Settings modal's
                       scroll container without breaking the table
                       layout. Panel width mirrors the trigger width
                       exactly (no panelMinWidthPx override) so the open
                       panel reads as a continuation of the input chrome;
                       long parent labels truncate with ellipsis inside
                       the trigger thanks to the InlineDropdown's
                       `truncate` rule on its inner label span. The
                       column is sized in `ChartOfAccountsTableColumns`
                       — change widths there, not here. */}
                    <td className="px-2.5 py-2.5">
                        <InlineDropdown
                            value={parentCode}
                            onChange={setParentCode}
                            options={parentDropdownOptions}
                            ariaLabel={t(
                                "settings.chart_of_accounts.col.parent_account",
                            )}
                        />
                    </td>

                    {/* Calc Rule — compact 3-option picker (em-dash /
                       + / -). Panel width = trigger width per the
                       project-wide consistency rule. The column itself
                       is 110px (set in ChartOfAccountsTableColumns).
                       Gated on `calcRuleAllowed` (prospective level
                       === 3) per PO directive 2026-05-25. When the
                       picked parent makes this row a level 1 or 2 the
                       dropdown renders disabled with the em-dash value
                       so the user sees "Calc Rule isn't available
                       here" instead of a misleading enabled picker. */}
                    <td className="px-2.5 py-2.5">
                        <InlineDropdown
                            value={calcRule}
                            onChange={(next) =>
                                setCalcRule(next as "+" | "-" | "")
                            }
                            options={calcRuleOptions}
                            ariaLabel={t(
                                "settings.chart_of_accounts.col.calc_rule",
                            )}
                            maxPanelHeightPx={120}
                            disabled={!calcRuleAllowed}
                        />
                    </td>

                    {/* Status + Actions — colSpan=2 so the merged cell
                       holds the Status dropdown on the left and Cancel /
                       Save on the right. Status trigger has a fixed
                       w-[110px] so Cancel/Save retain their natural
                       widths on the right; the panel mirrors the
                       trigger width exactly. */}
                    <td colSpan={2} className="px-2.5 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <InlineDropdown
                                value={status}
                                onChange={(next) =>
                                    setStatus(next as ChartOfAccountsStatus)
                                }
                                options={statusOptions}
                                ariaLabel={t(
                                    "settings.chart_of_accounts.col.status",
                                )}
                                triggerClassName="w-[110px]"
                                maxPanelHeightPx={120}
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    disabled={submitting}
                                    className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {t("settings.chart_of_accounts.inline.cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={submitting || hasError}
                                    className={cn(
                                        "inline-flex h-8 cursor-pointer items-center justify-center rounded-md px-3 text-wb-14-tight font-medium tracking-wb-tight",
                                        submitting || hasError
                                            ? "bg-wb-ntrl-4 text-white cursor-not-allowed"
                                            : "bg-brand text-white shadow-wb-brand-btn hover:bg-brand-hover",
                                    )}
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

/* ---------------------------------------------------------------- */

type InlineInputProps = {
    value: string;
    onChange: (next: string) => void;
    placeholder: string;
    ariaLabel: string;
    maxLength?: number;
    invalid?: boolean;
    disabled?: boolean;
};

function InlineInput({
    value,
    onChange,
    placeholder,
    ariaLabel,
    maxLength,
    invalid,
    disabled,
}: InlineInputProps) {
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            aria-invalid={invalid || undefined}
            maxLength={maxLength}
            disabled={disabled}
            className={cn(
                "h-8 w-full rounded-md bg-white py-2 px-2 text-wb-14 font-medium leading-4 text-wb-ink placeholder:text-wb-ntrl-5",
                "shadow-wb-outline outline-none",
                "focus:shadow-[0px_0px_0px_1px_var(--color-brand)]",
                invalid && "shadow-[0px_0px_0px_1px_var(--color-wb-red-07)]",
                disabled && "cursor-not-allowed bg-wb-bg-card text-wb-ntrl-6",
            )}
        />
    );
}


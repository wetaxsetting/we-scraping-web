"use client";

import { useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import ChartOfAccountsTableColumns, {
    CHART_OF_ACCOUNTS_TABLE_MIN_WIDTH,
} from "./ChartOfAccountsTableColumns";
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
    const hasError = codeError !== null || nameEnError !== null;

    const handleSave = () => {
        setTouched(true);
        // Re-evaluate against fresh values — `touched` only becomes
        // true on this line and the React state above is still stale
        // (will update next render). So check inline.
        if (!accountCode.trim()) return;
        if (accountCode.trim().length > ACCOUNT_CODE_MAX) return;
        if (!ACCOUNT_CODE_PATTERN.test(accountCode.trim())) return;
        if (!nameEn.trim()) return;
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

                    {/* Parent Account — native select for keyboard
                       accessibility. Empty option = root row. */}
                    <td className="px-2.5 py-2.5">
                        <InlineSelect
                            value={parentCode}
                            onChange={setParentCode}
                            ariaLabel={t(
                                "settings.chart_of_accounts.col.parent_account",
                            )}
                        >
                            <option value="">
                                {t(
                                    "settings.chart_of_accounts.inline.no_parent",
                                )}
                            </option>
                            {parentOptions.map((opt) => (
                                <option key={opt.code} value={opt.code}>
                                    {opt.label}
                                </option>
                            ))}
                        </InlineSelect>
                    </td>

                    {/* Calc Rule — native select with em-dash / + / -. */}
                    <td className="px-2.5 py-2.5">
                        <InlineSelect
                            value={calcRule}
                            onChange={(next) =>
                                setCalcRule(next as "+" | "-" | "")
                            }
                            ariaLabel={t(
                                "settings.chart_of_accounts.col.calc_rule",
                            )}
                        >
                            <option value="">
                                {t(
                                    "settings.chart_of_accounts.inline.calc_rule_none",
                                )}
                            </option>
                            <option value="+">+</option>
                            <option value="-">-</option>
                        </InlineSelect>
                    </td>

                    {/* Status + Actions — colSpan=2 so the merged cell
                       holds the Status dropdown on the left and Cancel /
                       Save on the right. */}
                    <td colSpan={2} className="px-2.5 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <InlineSelect
                                value={status}
                                onChange={(next) =>
                                    setStatus(next as ChartOfAccountsStatus)
                                }
                                ariaLabel={t(
                                    "settings.chart_of_accounts.col.status",
                                )}
                                widthClass="min-w-[100px]"
                            >
                                <option value="active">
                                    {t(
                                        "settings.chart_of_accounts.status.active",
                                    )}
                                </option>
                                <option value="inactive">
                                    {t(
                                        "settings.chart_of_accounts.status.inactive",
                                    )}
                                </option>
                            </InlineSelect>
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

type InlineSelectProps = {
    value: string;
    onChange: (next: string) => void;
    ariaLabel: string;
    children: React.ReactNode;
    widthClass?: string;
};

function InlineSelect({
    value,
    onChange,
    ariaLabel,
    children,
    widthClass,
}: InlineSelectProps) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={ariaLabel}
            className={cn(
                "h-8 w-full cursor-pointer rounded-md bg-white px-2 text-wb-14 font-medium leading-4 text-wb-ink shadow-wb-outline outline-none",
                "focus:shadow-[0px_0px_0px_1px_var(--color-brand)]",
                widthClass,
            )}
        >
            {children}
        </select>
    );
}

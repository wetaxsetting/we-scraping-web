"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    type DialogStackLevel,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

import {
    SELECT_BANK_ACCOUNTS_ROWS,
    type BankAccountRow,
} from "./selectBankAccountsMockData";

export type SelectBankAccountsDialogProps = {
    /** Bank brand name — surfaces in aria-labels. The visible identity
     *  comes from `bankLogo`. */
    bankName: string;
    /** Optional bank logo / brand mark rendered above the table. */
    bankLogo?: ReactNode;
    /** Static row set. Defaults to the canonical 3-row mock for callers
     *  that don't yet have their own data source. */
    rows?: readonly BankAccountRow[];
    /** Back button — closes this popup and (typically) returns the user
     *  to the previous step in the flow. */
    onBack: () => void;
    /** Save handler. When omitted (or `saveDisabled`), the Save button
     *  stays in its disabled visual state and clicks no-op. Receives the
     *  rows the user has checked. */
    onSave?: (rows: BankAccountRow[]) => void;
    /** Optional explicit override — when `true`, force Save into its
     *  disabled visual state regardless of selection. When omitted, the
     *  dialog auto-enables Save as soon as ≥ 1 row is checked AND
     *  `onSave` is provided. */
    saveDisabled?: boolean;
    /** Position in the modal stack. Defaults to `3` because the canonical
     *  use is the Settings → Registered → Login ID/PW → Select Bank
     *  Accounts chain. Callers that open this popup directly from a
     *  Settings panel (e.g. Bank Account Management → +Add → Select Bank
     *  → Select Bank Accounts) pass `2` so the overlay dim and z-index
     *  match CLAUDE.md §"Modal stacking convention". */
    stackLevel?: DialogStackLevel;
};

/**
 * Select Bank Accounts feature dialog — Figma 1081:25485.
 *
 * Reusable account-registration popup: title + subtitle, bank logo,
 * editable account table (checkbox + Account No + Currency + Account
 * Type + Account Nickname + Account Details + VAS Code + VAS Account
 * Name), and a right-aligned Back + Save footer. Triggered today by
 * the Login click inside `<LoginIdPasswordDialog>`, but generic enough
 * to be reused by any future flow that asks the user to register
 * bank accounts after authenticating.
 *
 * Static UI: row state (checkbox + editable inputs + dropdown text) is
 * kept locally; Save is a no-op until backend wiring lands. Back +
 * overlay click + ESC dismiss.
 */
export default function SelectBankAccountsDialog({
    bankName,
    bankLogo,
    rows = SELECT_BANK_ACCOUNTS_ROWS,
    onBack,
    onSave,
    saveDisabled,
    stackLevel = 3,
}: SelectBankAccountsDialogProps) {
    const { t } = useTranslation();

    // Row-level interactive state — checkbox + editable cell drafts.
    // Keyed by row id so the seeded `rows` prop drives initial values.
    const [editableRows, setEditableRows] = useState<BankAccountRow[]>(() =>
        rows.map((row) => ({ ...row })),
    );
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const allChecked =
        editableRows.length > 0 && selectedIds.size === editableRows.length;
    const someChecked = selectedIds.size > 0 && !allChecked;

    // Save lights up as soon as ≥ 1 row is checked AND a parent supplies
    // `onSave`. The optional `saveDisabled` prop wins when explicitly
    // `true` — lets a parent veto the auto-enable (e.g. while a previous
    // submission is in flight).
    const isSaveDisabled =
        saveDisabled === true || !onSave || selectedIds.size === 0;

    function toggleRow(id: string) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleAll() {
        setSelectedIds((prev) =>
            prev.size === editableRows.length
                ? new Set()
                : new Set(editableRows.map((row) => row.id)),
        );
    }

    function updateRow<K extends keyof BankAccountRow>(
        id: string,
        key: K,
        value: BankAccountRow[K],
    ) {
        setEditableRows((prev) =>
            prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
        );
    }

    function handleSave() {
        if (isSaveDisabled || !onSave) return;
        onSave(editableRows.filter((row) => selectedIds.has(row.id)));
    }

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onBack();
            }}
        >
            <DialogContent
                // Stack position is caller-driven: defaults to L3 for the
                // Settings → Registered → child chain, and L2 when opened
                // directly from a Settings panel (Bank Account → +Add).
                // The shared modalStack ensures ESC and X dismiss only
                // this dialog regardless of the selected level.
                stackLevel={stackLevel}
                className="max-w-[1024px] gap-0 rounded-2xl p-0"
            >
                <div className="flex flex-col gap-6 py-6">
                    {/* Header — title + subtitle, gap-1.5 per Figma. */}
                    <div className="flex flex-col items-start gap-1.5 px-6">
                        <DialogTitle asChild>
                            <h2 className="text-wb-16 font-semibold text-wb-dark">
                                {t(
                                    "settings.login_credentials.select_bank_accounts.title",
                                )}
                            </h2>
                        </DialogTitle>
                        <DialogDescription asChild>
                            <p className="text-wb-13 font-medium text-wb-dark/70">
                                {t(
                                    "settings.login_credentials.select_bank_accounts.subtitle",
                                )}
                            </p>
                        </DialogDescription>
                    </div>

                    {/* Body — bank logo + scrollable table. The horizontal
                       scroll wrapper handles narrow viewports without
                       collapsing column widths. */}
                    <div className="flex flex-col gap-4 px-6">
                        {bankLogo && (
                            <div
                                className="flex items-center"
                                aria-label={bankName}
                            >
                                {bankLogo}
                            </div>
                        )}

                        <div className="custom-scrollbar-x w-full overflow-x-auto">
                            <table className="w-full min-w-[920px] border-collapse">
                                <colgroup>
                                    <col className="w-[40px]" />
                                    <col className="w-[170px]" />
                                    <col className="w-[96px]" />
                                    <col className="w-[120px]" />
                                    <col className="w-[148px]" />
                                    <col className="w-[179px]" />
                                    <col className="w-[96px]" />
                                    <col />
                                </colgroup>
                                <thead>
                                    <tr className="h-10 border-y border-wb-border-sidebar bg-wb-bg-card">
                                        <th className="px-4 text-left">
                                            <Checkbox
                                                checked={allChecked}
                                                indeterminate={someChecked}
                                                onChange={toggleAll}
                                                ariaLabel={t(
                                                    "settings.login_credentials.select_bank_accounts.toggle_all",
                                                )}
                                            />
                                        </th>
                                        <HeaderCell>
                                            {t(
                                                "settings.login_credentials.select_bank_accounts.col.account_no",
                                            )}
                                        </HeaderCell>
                                        <HeaderCell>
                                            {t(
                                                "settings.login_credentials.select_bank_accounts.col.currency",
                                            )}
                                        </HeaderCell>
                                        <HeaderCell>
                                            {t(
                                                "settings.login_credentials.select_bank_accounts.col.account_type",
                                            )}
                                        </HeaderCell>
                                        <HeaderCell>
                                            {t(
                                                "settings.login_credentials.select_bank_accounts.col.account_nickname",
                                            )}
                                        </HeaderCell>
                                        <HeaderCell>
                                            {t(
                                                "settings.login_credentials.select_bank_accounts.col.account_details",
                                            )}
                                        </HeaderCell>
                                        <HeaderCell>
                                            {t(
                                                "settings.login_credentials.select_bank_accounts.col.vas_code",
                                            )}
                                        </HeaderCell>
                                        <HeaderCell className="pr-1">
                                            {t(
                                                "settings.login_credentials.select_bank_accounts.col.vas_account_name",
                                            )}
                                        </HeaderCell>
                                    </tr>
                                </thead>
                                <tbody>
                                    {editableRows.map((row, index) => {
                                        // Striped rows — even index white,
                                        // odd index gray (Figma 1081:25501
                                        // / 1081:25622 / 1081:25573 etc).
                                        const stripedBg =
                                            index % 2 === 1 ? "bg-wb-bg-sidebar" : "bg-white";
                                        return (
                                            <tr
                                                key={row.id}
                                                className={`h-[52px] border-b border-wb-border-sidebar ${stripedBg}`}
                                            >
                                                <td className="px-4">
                                                    <Checkbox
                                                        checked={selectedIds.has(
                                                            row.id,
                                                        )}
                                                        onChange={() =>
                                                            toggleRow(row.id)
                                                        }
                                                        ariaLabel={t(
                                                            "settings.login_credentials.select_bank_accounts.toggle_row",
                                                            { account: row.accountNo },
                                                        )}
                                                    />
                                                </td>
                                                <BodyCell>
                                                    <CellInput
                                                        value={row.accountNo}
                                                        onChange={(v) =>
                                                            updateRow(
                                                                row.id,
                                                                "accountNo",
                                                                v,
                                                            )
                                                        }
                                                        ariaLabel={t(
                                                            "settings.login_credentials.select_bank_accounts.col.account_no",
                                                        )}
                                                    />
                                                </BodyCell>
                                                <BodyCell>
                                                    <span className="text-wb-14 font-medium text-wb-dark">
                                                        {row.currency}
                                                    </span>
                                                </BodyCell>
                                                <BodyCell>
                                                    <AccountTypeSelect
                                                        value={row.accountType}
                                                        placeholder={t(
                                                            "settings.login_credentials.select_bank_accounts.account_type_placeholder",
                                                        )}
                                                    />
                                                </BodyCell>
                                                <BodyCell>
                                                    <CellInput
                                                        value={row.accountNickname}
                                                        onChange={(v) =>
                                                            updateRow(
                                                                row.id,
                                                                "accountNickname",
                                                                v,
                                                            )
                                                        }
                                                        ariaLabel={t(
                                                            "settings.login_credentials.select_bank_accounts.col.account_nickname",
                                                        )}
                                                    />
                                                </BodyCell>
                                                <BodyCell>
                                                    <CellInput
                                                        value={row.accountDetails}
                                                        onChange={(v) =>
                                                            updateRow(
                                                                row.id,
                                                                "accountDetails",
                                                                v,
                                                            )
                                                        }
                                                        placeholder={t(
                                                            "settings.login_credentials.select_bank_accounts.placeholder.account_details",
                                                        )}
                                                        ariaLabel={t(
                                                            "settings.login_credentials.select_bank_accounts.col.account_details",
                                                        )}
                                                    />
                                                </BodyCell>
                                                <BodyCell>
                                                    <CellInput
                                                        value={row.vasCode}
                                                        onChange={(v) =>
                                                            updateRow(
                                                                row.id,
                                                                "vasCode",
                                                                v,
                                                            )
                                                        }
                                                        ariaLabel={t(
                                                            "settings.login_credentials.select_bank_accounts.col.vas_code",
                                                        )}
                                                    />
                                                </BodyCell>
                                                <BodyCell className="pr-1">
                                                    <CellInput
                                                        value={row.vasAccountName}
                                                        onChange={(v) =>
                                                            updateRow(
                                                                row.id,
                                                                "vasAccountName",
                                                                v,
                                                            )
                                                        }
                                                        ariaLabel={t(
                                                            "settings.login_credentials.select_bank_accounts.col.vas_account_name",
                                                        )}
                                                    />
                                                </BodyCell>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Footer — Back + Save, right-aligned. */}
                    <div className="flex items-center justify-end px-6">
                        <div className="flex items-start gap-2">
                            <button
                                type="button"
                                onClick={onBack}
                                className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03]"
                            >
                                {t(
                                    "settings.login_credentials.select_bank_accounts.back",
                                )}
                            </button>
                            <button
                                type="button"
                                disabled={isSaveDisabled}
                                aria-disabled={isSaveDisabled}
                                onClick={isSaveDisabled ? undefined : handleSave}
                                className={
                                    isSaveDisabled
                                        ? "flex h-8 cursor-not-allowed items-center justify-center rounded-md bg-wb-ntrl-4 px-3 text-wb-14-tight font-medium tracking-wb-tight text-white shadow-wb-outline"
                                        : "flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium tracking-wb-tight text-white shadow-wb-brand-btn hover:bg-brand-hover"
                                }
                            >
                                {t("common.save")}
                            </button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function HeaderCell({
    children,
    className = "",
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <th
            className={`pr-4 py-3 text-left text-wb-13 font-semibold leading-normal text-wb-dark whitespace-nowrap ${className}`}
        >
            {children}
        </th>
    );
}

function BodyCell({
    children,
    className = "",
}: {
    children: ReactNode;
    className?: string;
}) {
    return <td className={`pr-4 align-middle ${className}`}>{children}</td>;
}

/** Match the Figma cell input — h-8, rounded-md, 1 px outline shadow
 *  (no focus colour change to honour the project-wide "no blue ring"
 *  contract on this popup family). */
function CellInput({
    value,
    onChange,
    placeholder,
    ariaLabel,
}: {
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
    ariaLabel: string;
}) {
    const id = useId();
    return (
        <div className="flex h-8 items-center rounded-md bg-white px-2 shadow-wb-outline">
            <input
                id={id}
                aria-label={ariaLabel}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                spellCheck={false}
                className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-wb-14 font-medium leading-4 text-wb-ntrl-8 outline-none ring-0 placeholder:text-wb-ntrl-5 focus:border-0 focus:outline-none focus:ring-0"
            />
        </div>
    );
}

/** Account Type cell — visual dropdown only. Clicking is a no-op for
 *  static UI; wire a real menu when the API/options arrive. */
function AccountTypeSelect({
    value,
    placeholder,
}: {
    value: string;
    placeholder: string;
}) {
    const display = value || placeholder;
    return (
        <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md bg-white p-2 shadow-wb-btn"
        >
            <span className="min-w-0 flex-1 truncate text-left text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                {display}
            </span>
            <ChevronDown
                className="size-4 shrink-0 text-wb-ntrl-8"
                strokeWidth={2}
                aria-hidden
            />
        </button>
    );
}

function Checkbox({
    checked,
    indeterminate = false,
    onChange,
    ariaLabel,
}: {
    checked: boolean;
    indeterminate?: boolean;
    onChange: () => void;
    ariaLabel: string;
}) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={indeterminate ? "mixed" : checked}
            aria-label={ariaLabel}
            onClick={onChange}
            className={
                "flex size-5 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors " +
                (checked || indeterminate
                    ? "border-brand bg-brand text-white"
                    : "border-wb-ntrl-4 bg-white hover:border-wb-ntrl-6")
            }
        >
            {indeterminate ? (
                <span aria-hidden className="block h-0.5 w-2.5 bg-white" />
            ) : checked ? (
                <svg
                    aria-hidden
                    className="size-3"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M2 6.5L5 9.5L10 3.5" />
                </svg>
            ) : null}
        </button>
    );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import BankBrandLogo from "./BankBrandLogo";
import type { BankAccountRow } from "./types";

type EditBankAccountDialogProps = {
    /** Account that triggered the dialog. Always non-null when this
     *  component is mounted — the parent conditionally renders the
     *  dialog and supplies a `key={row.id}` so form state seeds from
     *  this row's values on mount. */
    account: BankAccountRow;
    onClose: () => void;
};

const NICKNAME_MAX = 20;
const DESCRIPTION_MAX = 30;

/**
 * Account-type dropdown options. Stable order — Current → Saving →
 * Fixed Deposit. The wider `BankAccountRow.accountType` enum is
 * "current" | "saving" only; the dropdown surfaces the third option
 * for the static UI even though the table never renders Fixed Deposit
 * rows.
 */
type AccountTypeKey = "current" | "saving" | "fixed";

const ACCOUNT_TYPE_OPTIONS: ReadonlyArray<{
    value: AccountTypeKey;
    labelKey: string;
}> = [
    { value: "current", labelKey: "settings.bank_account.type.current" },
    { value: "saving", labelKey: "settings.bank_account.type.saving" },
    { value: "fixed", labelKey: "settings.bank_account.type.fixed" },
];

/**
 * Edit Bank Account dialog — Figma 142:21385.
 *
 * Custom-shape modal that deliberately deviates from the standard
 * <DialogHeader>/<DialogBody>/<DialogFooter> rhythm because the Figma
 * frame specifies its own padding, radius, typography, and footer
 * shape. The shared <Dialog> primitive (Radix portal + overlay +
 * keyboard) still provides the chrome — only the content shape is
 * overridden.
 *
 * Per Figma:
 *   - Container:     bg-white rounded-[16px] p-[24px] gap-[32px]
 *   - Close X        — top-right; closes only this dialog (Settings stays)
 *   - Title:         16px / 600 / #1b1b1b
 *   - Subtitle:      13px / 500 / #333 with opacity-70
 *   - Bank logo:     114 × 40 placeholder mark
 *   - Table:         flex-row of 6 columns, each a flex-col with the
 *                    header strip (bg-#fbfbfb border-y #e1e1e1 h-[40px])
 *                    and data row (border-b #e1e1e1 h-[68px]) glued
 *                    column-by-column rather than a single grid
 *   - Inputs:        h-[32px] rounded-[6px] with a 1px ring-shadow
 *                    (#d4d4d4) — NOT a border
 *   - Footer:        flex justify-end gap-2 with default-button +
 *                    primary-button shadows on the Back / Save chips
 *
 * Static UI: Back / Save / overlay / ESC all close. Form state seeds
 * from `account` on mount; the parent passes `key={row.id}` so
 * switching rows re-mounts the dialog with fresh state.
 */
export default function EditBankAccountDialog({
    account,
    onClose,
}: EditBankAccountDialogProps) {
    const { t } = useTranslation();

    const [nickname, setNickname] = useState(account.nickname);
    const [description, setDescription] = useState(account.description);
    const [accountType, setAccountType] = useState<AccountTypeKey>(
        account.accountType === "saving" ? "saving" : "current",
    );

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                // Per-Figma overrides: 16px corner radius, no padding
                // (handled by the inner stack). Width caps to the
                // natural width of the column template (~960px) without
                // dominating the viewport. Sits at level 2 — the
                // Settings modal underneath is L1, so the shared
                // modalStack lets ESC close only this dialog.
                stackLevel={2}
                className="max-w-[960px] rounded-2xl p-0"
            >
                <div className="flex w-full flex-col gap-8 p-6">
                    {/* Header + bank logo + table — single 24px-gap stack
                       per Figma 142:21386. Title→subtitle gap is 6px,
                       logo→table gap is 16px. */}
                    <div className="flex flex-col items-start gap-6">
                        {/* Header: title + subtitle.
                           DialogTitle / DialogDescription are routed through
                           the Radix primitives via `asChild` so the rendered
                           DOM stays the Figma-spec'd <h2> + <p>, while Radix
                           still gets its accessibility annotations
                           (aria-labelledby / aria-describedby) — without
                           those, Radix logs a runtime warning that the
                           Dialog is not screen-reader-accessible. */}
                        <div className="flex w-full flex-col items-start gap-1.5">
                            <DialogTitle asChild>
                                <h2 className="text-wb-16 font-semibold text-wb-dark">
                                    {t("settings.bank_account.edit.title")}
                                </h2>
                            </DialogTitle>
                            <DialogDescription asChild>
                                <p className="text-wb-13 font-medium text-wb-dark/70">
                                    {t("settings.bank_account.edit.description")}
                                </p>
                            </DialogDescription>
                        </div>

                        {/* Bank logo + table block */}
                        <div className="flex flex-col items-start gap-4">
                            {/* Logo placeholder — Figma shows the live bank
                               wordmark (114 × 40); we ship a brand-coloured
                               mark stand-in until licensed assets land. */}
                            <BankBrandLogo bankName={account.bankName} />

                            {/* Table — flex-row of 6 columns. Each column
                               owns its header strip + data cell so the
                               #fbfbfb header band is continuous across the
                               row but each column controls its own width. */}
                            <div className="flex items-start">
                                <Column width={144}>
                                    <HeaderCell label={t("settings.bank_account.col.account")} />
                                    <ReadOnlyCell value={account.accountNumber.replace(/-/g, "")} />
                                </Column>

                                <Column width={84}>
                                    <HeaderCell label={t("settings.bank_account.edit.col.currency")} />
                                    <ReadOnlyCell value={account.currency} />
                                </Column>

                                <Column width={198}>
                                    <HeaderCell label={t("settings.bank_account.col.nickname")} />
                                    <InputCell>
                                        <ClearableInput
                                            value={nickname}
                                            onChange={setNickname}
                                            maxLength={NICKNAME_MAX}
                                            ariaLabel={t("settings.bank_account.col.nickname")}
                                        />
                                        <CharacterCount current={nickname.length} max={NICKNAME_MAX} />
                                    </InputCell>
                                </Column>

                                <Column width={198}>
                                    <HeaderCell label={t("settings.bank_account.col.description")} />
                                    <InputCell>
                                        <ClearableInput
                                            value={description}
                                            onChange={setDescription}
                                            maxLength={DESCRIPTION_MAX}
                                            ariaLabel={t("settings.bank_account.col.description")}
                                        />
                                        <CharacterCount current={description.length} max={DESCRIPTION_MAX} />
                                    </InputCell>
                                </Column>

                                <Column>
                                    <HeaderCell label={t("settings.bank_account.col.type")} />
                                    {/* Account Type dropdown sits in a
                                       data cell that hugs its content;
                                       overflow is allowed so the open
                                       menu can extend past the cell.
                                       Fixed h-[68px] so the bottom
                                       border lines up with the read-only
                                       and input cells in the same row. */}
                                    <div className="relative flex h-[68px] items-start border-b border-wb-border-sidebar pr-4 pt-2">
                                        <AccountTypeDropdown
                                            value={accountType}
                                            onChange={setAccountType}
                                        />
                                    </div>
                                </Column>

                                <Column width={132}>
                                    <HeaderCell label={t("settings.bank_account.col.maturity")} />
                                    <div className="flex h-[68px] items-start border-b border-wb-border-sidebar py-2">
                                        <MaturityDateField
                                            value={account.maturityDate || "25 Apr 2024"}
                                        />
                                    </div>
                                </Column>
                            </div>
                        </div>
                    </div>

                    {/* Footer — Back (outline) + Save (primary blue),
                       right-aligned. Both at p-2 / rounded-6 with the
                       default- and primary-button shadow stacks per
                       Figma 142:21636 / 142:21637. */}
                    <div className="flex w-full items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 cursor-pointer items-center justify-center gap-1 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("common.back")}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 cursor-pointer items-center justify-center gap-1 rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                        >
                            {t("settings.bank_account.edit.save")}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────

function Column({
    width,
    children,
}: {
    /** Fixed pixel width per Figma 142:21394 (Account=144, Currency=84,
     *  Nickname=198, Description=198, Maturity=132). Account Type hugs
     *  its content so width is omitted there. */
    width?: number;
    children: React.ReactNode;
}) {
    return (
        <div
            className="flex flex-col items-start gap-px self-stretch"
            style={width ? { width } : undefined}
        >
            {children}
        </div>
    );
}

function HeaderCell({ label }: { label: string }) {
    return (
        <div className="flex h-10 w-full items-center border-y border-wb-border-sidebar bg-wb-bg-card py-3 pr-4">
            <span className="text-wb-13 font-semibold tracking-wb-tight text-wb-dark">
                {label}
            </span>
        </div>
    );
}

function ReadOnlyCell({ value }: { value: string }) {
    return (
        <div className="flex h-[68px] w-full items-start border-b border-wb-border-sidebar pr-4 pt-2">
            <span className="flex h-8 items-center text-wb-14 font-medium text-wb-dark">
                {value}
            </span>
        </div>
    );
}

function InputCell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex w-full flex-col items-start justify-center gap-1 border-b border-wb-border-sidebar py-2 pr-4">
            {children}
        </div>
    );
}

type ClearableInputProps = {
    value: string;
    onChange: (next: string) => void;
    maxLength: number;
    ariaLabel: string;
};

function ClearableInput({ value, onChange, maxLength, ariaLabel }: ClearableInputProps) {
    return (
        <div className="relative w-full">
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
                maxLength={maxLength}
                aria-label={ariaLabel}
                className={cn(
                    "h-8 w-full rounded-md bg-white py-2 pl-2 pr-7 text-wb-14 font-medium leading-4 text-wb-ntrl-8",
                    "shadow-wb-outline outline-none",
                    "focus:shadow-[0px_0px_0px_1px_var(--color-brand)]",
                )}
            />
            {value.length > 0 && (
                <button
                    type="button"
                    onClick={() => onChange("")}
                    aria-label="Clear"
                    className="absolute right-2 top-1/2 flex size-4 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-wb-ntrl-4 text-white hover:bg-wb-ntrl-6"
                >
                    <X className="size-2.5" strokeWidth={2.5} />
                </button>
            )}
        </div>
    );
}

function CharacterCount({ current, max }: { current: number; max: number }) {
    return (
        <span className="block w-full text-right text-wb-12 font-medium text-wb-ntrl-8">
            {current}/{max} Characters
        </span>
    );
}

/** Static date "input" — Figma shows a non-interactive chip showing the
 *  current maturity date plus a calendar icon. Click handler is a no-op
 *  in this static UI. */
function MaturityDateField({ value }: { value: string }) {
    return (
        <button
            type="button"
            className="flex h-8 w-full cursor-pointer items-center gap-2 overflow-clip rounded-md bg-white px-2 text-left text-wb-14 font-medium text-wb-ntrl-8 shadow-wb-btn hover:bg-black/[0.02]"
        >
            <span className="flex-1 truncate">{value}</span>
            <Calendar
                className="size-4 shrink-0 text-wb-ntrl-8"
                strokeWidth={1.8}
                aria-hidden
            />
        </button>
    );
}

type AccountTypeDropdownProps = {
    value: AccountTypeKey;
    onChange: (next: AccountTypeKey) => void;
};

/**
 * Account-type dropdown — Figma 142:22055.
 *
 * Trigger uses the default-button shadow stack (no border). Menu uses
 * drop-shadow + 8px padding + 2px gap between options; each option is
 * 28px tall with 8px padding and 4px corner radius. Selected option
 * uses CMS-PRIME-08 (#0152a3) blue text rather than a background fill.
 */
function AccountTypeDropdown({ value, onChange }: AccountTypeDropdownProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);

    const labelFor = (key: AccountTypeKey) =>
        t(ACCOUNT_TYPE_OPTIONS.find((o) => o.value === key)!.labelKey);

    return (
        <div ref={ref} className="relative inline-block">
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((prev) => !prev)}
                className="flex h-8 cursor-pointer items-center justify-between overflow-clip rounded-md bg-white shadow-wb-btn hover:bg-black/[0.02]"
            >
                <span className="flex items-center gap-2 py-2 pl-2 pr-1 text-wb-14 font-medium tracking-wb-tight text-wb-dark">
                    <span className="whitespace-nowrap">{labelFor(value)}</span>
                </span>
                <span className="flex items-center justify-center py-2 pl-1 pr-2">
                    <ChevronDown
                        className={cn(
                            "size-4 shrink-0 text-wb-ntrl-8 transition-transform",
                            open && "rotate-180",
                        )}
                        strokeWidth={2}
                        aria-hidden
                    />
                </span>
            </button>
            {open && (
                <ul
                    role="listbox"
                    className="absolute left-0 top-full z-30 mt-1 w-full min-w-[140px] overflow-hidden rounded-md bg-white p-2 shadow-[0px_0px_0.5px_0px_rgba(0,0,0,0.22),0px_1px_1px_0px_rgba(0,0,0,0.06),0px_4px_10px_0px_rgba(0,0,0,0.15)]"
                >
                    {ACCOUNT_TYPE_OPTIONS.map((opt, i) => {
                        const selected = opt.value === value;
                        return (
                            <li
                                key={opt.value}
                                role="option"
                                aria-selected={selected}
                                onClick={() => {
                                    onChange(opt.value);
                                    setOpen(false);
                                }}
                                className={cn(
                                    "flex h-7 cursor-pointer items-center truncate whitespace-nowrap rounded p-2 text-wb-13 font-medium hover:bg-wb-bg-active",
                                    i > 0 && "mt-0.5",
                                    selected ? "text-brand-hover" : "text-wb-ntrl-8",
                                )}
                            >
                                {labelFor(opt.value)}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

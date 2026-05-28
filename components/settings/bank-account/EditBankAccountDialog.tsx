"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import DateField, { formatDateChipNumeric } from "@/components/shared/DateField";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { ApiCallError } from "@/lib/api/banking";
import { updateBankAccount } from "@/lib/api/bankAccount";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import BankBrandLogo from "./BankBrandLogo";
import type { BankAccountRow } from "./types";
import VasAccountPicker, { type VasAccountSelection } from "./VasAccountPicker";

type EditBankAccountDialogProps = {
    /** Account that triggered the dialog. Always non-null when this
     *  component is mounted — the parent conditionally renders the
     *  dialog and supplies a `key={row.id}` so form state seeds from
     *  this row's values on mount. */
    account: BankAccountRow;
    onClose: () => void;
    /** Fired after a successful PATCH so the parent panel can refetch
     *  the bank-account list and re-render the row with the new
     *  values. */
    onSaved?: () => void;
};

/** Map the dialog's semantic {@link AccountTypeKey} to the legacy 2-char
 *  {@code ACCT_TYPE_CD} the backend expects, branching on the row's
 *  currency to pick the right legacy code:
 *    Fixed  → 02 (DEPOSIT)
 *    Current → 03 (VND/KHR), 04 (USD), 07 (KRW)
 *    Saving  → 05 (VND/KHR), 06 (USD), 08 (KRW)
 *  Mirrors the AcctTypeCd enum in `wecms-api/.../common/enums/AcctTypeCd.java`. */
function toAccountTypeCd(value: AccountTypeKey, currency: string): string {
    if (value === "fixed") return "02";
    if (value === "saving") {
        if (currency === "USD") return "06";
        if (currency === "KRW") return "08";
        return "05";
    }
    if (currency === "USD") return "04";
    if (currency === "KRW") return "07";
    return "03";
}

/** Inverse of {@link toAccountTypeCd} — map the legacy 2-char
 *  `ACCT_TYPE_CD` back to the dialog's semantic key so the dropdown
 *  seeds from the authoritative wire code. Mirrors legacy
 *  `comm_0183_003`, which seeds the select from `val.ACCT_TYPE_CD`:
 *    02 → fixed · 05/06/08 → saving · 03/04/07 → current.
 *  Returns `null` for blank / unknown codes so the caller can fall back
 *  to the row's lossy `accountType` bucket. */
function accountTypeKeyFromCd(cd: string): AccountTypeKey | null {
    if (cd === "02") return "fixed";
    if (cd === "05" || cd === "06" || cd === "08") return "saving";
    if (cd === "03" || cd === "04" || cd === "07") return "current";
    return null;
}

const NICKNAME_MAX = 20;
const DESCRIPTION_MAX = 30;

/**
 * Account-type dropdown options. Stable order — Current → Saving →
 * Fixed Deposit. Mirrors `BankAccountRow.accountType`
 * ("current" | "saving" | "fixed"), which the mapper derives from the
 * legacy `ACCT_TYPE_CD` per the `AcctTypeCd` enum.
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
 *                    and data row (border-b #e1e1e1 h-[88px]) glued
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
    onSaved,
}: EditBankAccountDialogProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    // Seed from the authoritative raw `ACCT_TYPE_CD` (legacy parity);
    // fall back to the lossy semantic bucket only when the wire code is
    // blank/unknown so older rows still open sensibly.
    const initialAccountType: AccountTypeKey =
        accountTypeKeyFromCd(account.accountTypeCd) ?? account.accountType;

    const [nickname, setNickname] = useState(account.nickname);
    const [description, setDescription] = useState(account.description);
    const [accountType, setAccountType] = useState<AccountTypeKey>(initialAccountType);
    /** ISO `yyyy-MM-dd` (or empty string for current accounts). The
     *  mapper already converts the legacy {@code yyyyMMdd} form, so
     *  this state mirrors the wire shape directly. */
    const [maturityDate, setMaturityDate] = useState(account.maturityDate);

    /** Maturity Date applies only to Saving / Fixed Deposit accounts.
     *  Current accounts disable the field — legacy `comm_0183_003`
     *  parity (the datepicker is `disabled` for ACCT_TYPE 03 / 04). */
    const maturityDisabled = accountType === "current";

    /** Account-type change handler. Switching to a Current account
     *  clears the Maturity Date (the field is then disabled), mirroring
     *  legacy `comm_0183_003`'s onSelect for codes 03 / 04. */
    function handleAccountTypeChange(next: AccountTypeKey) {
        setAccountType(next);
        if (next === "current") setMaturityDate("");
    }

    /** VAS Account mapping. Seeded from the row's existing values when
     *  the dialog mounts. `null` = no mapping; an object = the picked
     *  row from BUSI_VAS_ACCT_INFM. The PATCH body only includes the
     *  triple when this differs from `initialVasSelection`. */
    const initialVasSelection: VasAccountSelection | null =
        account.vasAcctSeqNo > 0 && account.vasCode
            ? {
                  seqNo: account.vasAcctSeqNo,
                  code:  account.vasCode,
                  name:  account.vasAccountName,
              }
            : null;
    const [vasAccount, setVasAccount] = useState<VasAccountSelection | null>(
        initialVasSelection,
    );
    /** Inflight guard — Save is idempotent but multiple round-trips
     *  while one is pending would surface confusing toast ordering. */
    const [saving, setSaving] = useState(false);

    async function handleSave() {
        if (saving) return;
        // Build a partial patch — only include fields the user changed
        // so we don't accidentally null out anything the dialog didn't
        // surface, and so the audit log reflects the real edit.
        const body: Parameters<typeof updateBankAccount>[2] = {};
        if (nickname !== account.nickname)     body.nickname = nickname;
        if (description !== account.description) body.description = description;
        if (accountType !== initialAccountType) {
            body.account_type_cd = toAccountTypeCd(accountType, account.currency);
        }
        if (maturityDate !== account.maturityDate) body.maturity_date = maturityDate;

        // VAS Account triple — fires when the user picked a different
        // row OR cleared an existing mapping. `0` is the wire sentinel
        // for "clear"; backend then null-outs all three fields on
        // ACCT_MSTR.
        const initialSeq = initialVasSelection?.seqNo ?? 0;
        const currentSeq = vasAccount?.seqNo ?? 0;
        if (initialSeq !== currentSeq) {
            body.vas_acct_seq_no = currentSeq;
            body.vas_acct_cd     = vasAccount?.code ?? "";
            body.vas_acct_nm     = vasAccount?.name ?? "";
        }

        // Nothing to save — close without a network hit. Matches the
        // legacy parity of "no-op if nothing changed".
        if (Object.keys(body).length === 0) {
            onClose();
            return;
        }

        setSaving(true);
        try {
            await updateBankAccount(account.bankCd, account.accountNumber, body);
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("settings.bank_account.edit.save_success"),
                onConfirm: () => {
                    onSaved?.();
                    onClose();
                },
                onClose: () => {
                    onSaved?.();
                    onClose();
                },
            });
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            const message = err instanceof ApiCallError ? err.message : String(err);
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                // Per-Figma overrides: 16px corner radius, no padding
                // (handled by the inner stack). Width capped narrower
                // than the dashboard default — the form fits in ~820px
                // with the column widths below, and the popover for the
                // Maturity Date renders inline (no portal needed) since
                // we override the primitive's `overflow-hidden` to
                // `overflow-visible`. Sits at level 2 — the Settings
                // modal underneath is L1, so the shared modalStack lets
                // ESC close only this dialog.
                stackLevel={2}
                className="max-w-[1150px] !overflow-visible rounded-2xl p-0"
                // Suppress Radix's default "focus first focusable child"
                // behaviour — the VAS combobox is the first focusable
                // element in the form and would auto-open on dialog
                // mount otherwise. The dialog still traps focus once
                // the user tabs into it.
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className="flex w-full flex-col gap-8 p-8">
                    {/* Header + bank logo + table — single stack with
                       generous vertical rhythm. */}
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
                        <div className="flex w-full flex-col items-start gap-5">
                            {/* Logo placeholder — Figma shows the live bank
                               wordmark (114 × 40); we ship a brand-coloured
                               mark stand-in until licensed assets land. */}
                            <BankBrandLogo
                                bankName={account.bankName}
                                bankCd={account.bankCd}
                            />

                            {/* Table — flex-row of 6 columns. Each column
                               owns its header strip + data cell so the
                               #fbfbfb header band is continuous across the
                               row but each column controls its own width. */}
                            <div className="flex items-start">
                                <Column width={128}>
                                    <HeaderCell label={t("settings.bank_account.col.account")} />
                                    <ReadOnlyCell value={account.accountNumber.replace(/-/g, "")} />
                                </Column>

                                <Column width={76}>
                                    <HeaderCell label={t("settings.bank_account.edit.col.currency")} />
                                    <ReadOnlyCell value={account.currency} />
                                </Column>

                                <Column width={168}>
                                    <HeaderCell label={t("settings.bank_account.col.vas_name")} />
                                    <div className="relative flex h-[88px] w-full min-w-0 items-center border-b border-wb-border-sidebar pr-4">
                                        <VasAccountPicker
                                            value={vasAccount}
                                            onChange={setVasAccount}
                                        />
                                    </div>
                                </Column>

                                <Column width={168}>
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

                                <Column width={168}>
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

                                <Column width={204}>
                                    <HeaderCell label={t("settings.bank_account.col.type")} />
                                    {/* Fixed-width column + full-width
                                       dropdown so the row never reflows
                                       when the selected label changes
                                       width (e.g. Current → Fixed Deposit
                                       Account). Without the fixed width
                                       the longer label pushed the flex
                                       row past the dialog content area
                                       and broke column alignment.
                                       Fixed h-[88px] so the bottom border
                                       lines up with the sibling cells. */}
                                    <div className="relative flex h-[88px] w-full min-w-0 items-center border-b border-wb-border-sidebar pr-4">
                                        <AccountTypeDropdown
                                            value={accountType}
                                            onChange={handleAccountTypeChange}
                                        />
                                    </div>
                                </Column>

                                <Column width={158}>
                                    <HeaderCell label={t("settings.bank_account.col.maturity")} />
                                    <div className="flex h-[88px] w-full min-w-0 items-center border-b border-wb-border-sidebar">
                                        <DateField
                                            value={maturityDate}
                                            onChange={setMaturityDate}
                                            formatValue={formatDateChipNumeric}
                                            placeholder={t("settings.bank_account.edit.maturity_placeholder")}
                                            className="w-full"
                                            iconInside
                                            disabled={maturityDisabled}
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
                            disabled={saving}
                            className="flex h-8 cursor-pointer items-center justify-center gap-1 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {t("common.back")}
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={saving}
                            className="flex h-8 cursor-pointer items-center justify-center gap-1 rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
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
    /** Fixed pixel width. Every column is fixed + `shrink-0` so the row
     *  width is constant and columns never squeeze into each other.
     *  Current allocation (sums to 1070, inside the 1086px content area
     *  of the 1150px dialog): Account=128, Currency=76, VAS=168,
     *  Nickname=168, Description=168, Account Type=204, Maturity=158.
     *  Account Type is sized to fit "Fixed Deposit Account"; the dropdown
     *  fills the column and truncates longer locale labels with an
     *  ellipsis rather than overflowing. */
    width?: number;
    children: React.ReactNode;
}) {
    return (
        <div
            // Locked to its fixed pixel width: `shrink-0` (never shrink),
            // no flex-grow (never grow), and `min-w-0` to defeat the flex
            // `min-width:auto` content-floor — without `min-w-0` a wide
            // child (the un-truncated "Fixed Deposit Account" label) would
            // expand the column past its set width and shove the Maturity
            // Date column right. The row width is therefore constant
            // regardless of the selected Account Type label.
            className="flex min-w-0 shrink-0 flex-col items-start gap-px self-stretch"
            style={width ? { width } : undefined}
        >
            {children}
        </div>
    );
}

function HeaderCell({ label }: { label: string }) {
    return (
        <div className="flex h-11 w-full items-center border-y border-wb-border-sidebar bg-wb-bg-card py-3 pr-4">
            <span className="text-wb-13 font-semibold tracking-wb-tight text-wb-dark">
                {label}
            </span>
        </div>
    );
}

function ReadOnlyCell({ value }: { value: string }) {
    return (
        <div className="flex h-[88px] w-full items-center border-b border-wb-border-sidebar pr-4">
            <span className="text-wb-14 font-medium text-wb-dark">
                {value}
            </span>
        </div>
    );
}

function InputCell({ children }: { children: React.ReactNode }) {
    // 88px-tall cell pinned to the same height as every sibling column
    // so all column bottom borders sit at one Y line. The input chip
    // is rendered as the FIRST slot (vertically centered to match the
    // read-only / dropdown / date-chip in sibling columns) and the
    // character counter as the SECOND slot, absolutely positioned at
    // the cell's bottom so the counter line doesn't push the input
    // off-center.
    const slots = Array.isArray(children) ? children : [children];
    const [input, counter] = slots;
    return (
        <div className="relative flex h-[88px] w-full items-center border-b border-wb-border-sidebar pr-4">
            <div className="w-full">{input}</div>
            <div className="absolute bottom-1.5 left-0 right-4">{counter}</div>
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
        <div ref={ref} className="relative w-full min-w-0">
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((prev) => !prev)}
                className="flex h-8 w-full min-w-0 cursor-pointer items-center justify-between overflow-hidden rounded-md bg-white shadow-wb-btn hover:bg-black/[0.02]"
            >
                {/* Single truncating flex child — `min-w-0` lets it
                   shrink below its content so `truncate`
                   (overflow-hidden + ellipsis + nowrap) actually clips
                   instead of overflowing into the Maturity column. The
                   earlier nested-span markup left the inner label at
                   `min-width:auto`, which is why long labels spilled. */}
                <span className="min-w-0 flex-1 truncate py-2 pl-2 pr-1 text-left text-wb-14 font-medium tracking-wb-tight text-wb-dark">
                    {labelFor(value)}
                </span>
                <span className="flex shrink-0 items-center justify-center py-2 pl-1 pr-2">
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

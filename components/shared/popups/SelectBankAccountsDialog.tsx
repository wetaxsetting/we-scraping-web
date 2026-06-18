"use client";

import {
    useEffect,
    useId,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    type DialogStackLevel,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

import { type BankAccountRow } from "./selectBankAccountsMockData";

export type SelectBankAccountsDialogProps = {
    /** Bank brand name — surfaces in aria-labels. The visible identity
     *  comes from `bankLogo`. */
    bankName: string;
    /** Optional bank logo / brand mark rendered above the table. */
    bankLogo?: ReactNode;
    /** Account rows to register — produced by the scrape mapper
     *  ({@link mapScrapedToBankRow}) and passed by the host panel.
     *  An empty array renders an empty table body. */
    rows: readonly BankAccountRow[];
    /** Back button — closes this popup and (typically) returns the user
     *  to the previous step in the flow. Also fired on overlay-click /
     *  ESC / X close, so the host can treat any dismissal as "abandon"
     *  (e.g. delete the unverified credential — see LoginCredentialsPanel). */
    onBack: () => void;
    /** Save handler. When omitted (or `saveDisabled`), the Save button
     *  stays in its disabled visual state and clicks no-op. Receives the
     *  rows the user has checked. */
    onSave?: (rows: BankAccountRow[]) => void;
    /** Optional explicit override — when `true`, force Save into its
     *  disabled visual state regardless of selection. When omitted, the
     *  dialog auto-enables Save as soon as ≥ 1 row is checked, every
     *  checked row is complete (Account No + Currency + Account Type),
     *  AND `onSave` is provided. */
    saveDisabled?: boolean;
    /** Show the VAS Code / VAS Account Name columns. Defaults to `true`.
     *  The host passes `false` for product type `H` (legacy hides VAS for
     *  HAENGSUNG — `comm_0218_nxisas_view.jsp` `if (!"H".equals(prdtTypes))`).
     *  When false the columns are not rendered and the host omits the VAS
     *  fields from the save payload. */
    showVas?: boolean;
    /** Position in the modal stack. Defaults to `3` because the canonical
     *  use is the Settings → Registered → Login ID/PW → Select Bank
     *  Accounts chain. Callers that open this popup directly from a
     *  Settings panel (e.g. Bank Account Management → +Add → Select Bank
     *  → Select Bank Accounts) pass `2` so the overlay dim and z-index
     *  match CLAUDE.md §"Modal stacking convention". */
    stackLevel?: DialogStackLevel;
};

/**
 * The three business account-type kinds shown in the dropdown. The
 * *label* is always one of Current / Savings / Fixed Deposit; the
 * *stored value* is the currency-specific legacy {@code ACCT_TYPE_CD}.
 * Mirrors the live JEX `comm_0218_nxisas.ts:getAcctType()` (1236-1258),
 * which builds exactly these three options per currency.
 */
const ACCT_TYPE_KINDS = [
    { kind: "CURRENT", labelKey: "settings.login_credentials.select_bank_accounts.acct_type.current" },
    { kind: "SAVINGS", labelKey: "settings.login_credentials.select_bank_accounts.acct_type.savings" },
    { kind: "FIXED", labelKey: "settings.login_credentials.select_bank_accounts.acct_type.fixed_deposit" },
] as const;

/**
 * Resolve a business kind + currency to the legacy {@code ACCT_TYPE_CD},
 * exactly as `comm_0218_nxisas.ts:getAcctType()`:
 * <ul>
 *   <li>Current → VND `03`, USD `04`, KRW `07` (default `03`)</li>
 *   <li>Savings → VND `05`, USD `06`, KRW `08` (default `05`)</li>
 *   <li>Fixed Deposit → `02` for every currency</li>
 * </ul>
 * The same three labels render for every currency; only the submitted
 * code differs.
 */
function acctTypeCodeFor(kind: "CURRENT" | "SAVINGS" | "FIXED", currency: string): string {
    const ccy = (currency || "").trim().toUpperCase();
    if (kind === "FIXED") return "02";
    if (kind === "CURRENT") return ccy === "USD" ? "04" : ccy === "KRW" ? "07" : "03";
    return ccy === "USD" ? "06" : ccy === "KRW" ? "08" : "05"; // SAVINGS
}

/** Format a scraped maturity date for read-only display. The Coocon
 *  acct-list `maturityDate` is a String; when it is a clean 8-digit
 *  `yyyyMMdd` (the legacy `EXPI_DT` shape) render it as `yyyy-MM-dd`,
 *  otherwise show it verbatim. Never fabricates a value — blank in,
 *  blank out. */
function formatMaturityDate(raw: string): string {
    const v = (raw ?? "").trim();
    if (/^\d{8}$/.test(v)) {
        return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    }
    return v;
}

/** A selected row is registrable only when Account No, Currency, AND
 *  Account Type are all present — legacy parity with
 *  `comm_0218_nxisas.ts:funcSaveButtonState` (Save stays disabled until
 *  every checked row carries a valid account type). */
function rowIsComplete(row: BankAccountRow): boolean {
    return (
        row.accountNo.trim().length > 0 &&
        row.currency.trim().length > 0 &&
        row.accountType.trim().length > 0
    );
}

/**
 * Select Bank Accounts feature dialog — Figma 1081:25485.
 *
 * Reusable account-registration popup: title + subtitle, bank logo,
 * editable account table (checkbox + Account No + Currency + Account
 * Type + Maturity Date + Account Nickname + Account Details [+ VAS Code
 * + VAS Account Name when {@code showVas}]) and a right-aligned Back +
 * Save footer. VAS columns render for non-`H` product types and persist
 * to {@code ACCT_MSTR.VAS_ACCT_CD/NM}; the host passes
 * {@code showVas=false} for product type `H` (legacy parity). Triggered
 * today by the Login click inside `<LoginIdPasswordDialog>`, but generic
 * enough to be reused by any future flow that asks the user to register
 * bank accounts after authenticating.
 *
 * Layout: the dialog is a FIXED-height card (matches the Settings modal
 * default height, `--w-wb-settings-card-h`). Only the account table
 * body scrolls (vertical + horizontal); the header and the Back/Save
 * footer stay pinned. The popup never grows with the number of rows.
 *
 * Back + overlay click + ESC all dismiss via `onBack`.
 */
export default function SelectBankAccountsDialog({
    bankName,
    bankLogo,
    rows,
    onBack,
    onSave,
    saveDisabled,
    showVas = true,
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

    const selectedRows = editableRows.filter((row) => selectedIds.has(row.id));
    // At least one checked row is missing Account No / Currency / Account
    // Type — block Save and surface the inline hint.
    const hasIncompleteSelection =
        selectedRows.length > 0 && selectedRows.some((row) => !rowIsComplete(row));

    // Save lights up only when ≥ 1 row is checked, every checked row is
    // complete, AND a parent supplies `onSave`. The optional
    // `saveDisabled` prop wins when explicitly `true` (e.g. while a
    // previous submission is in flight).
    const isSaveDisabled =
        saveDisabled === true ||
        !onSave ||
        selectedIds.size === 0 ||
        hasIncompleteSelection;

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
                // Wider than the prior 1024px so more table columns show
                // without horizontal scroll, but capped below the Settings
                // modal shell (--w-wb-settings-card = 1300px) so it stays
                // visually inside it. FIXED height = the Settings card
                // default (`--w-wb-settings-card-h`, 760px), viewport-bounded
                // by the primitive's max-h — so the popup never grows with
                // the row count; only the table body scrolls.
                className="h-[var(--w-wb-settings-card-h)] max-w-[1200px] gap-0 rounded-2xl p-0"
            >
                {/* Header — title + subtitle, gap-1.5 per Figma. Pinned. */}
                <div className="flex shrink-0 flex-col items-start gap-1.5 px-6 pt-6 pr-14">
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

                {/* Body — bank logo + scrollable table. This column flexes
                   to fill the fixed-height card; the inner wrapper is the
                   single scroll surface (vertical when rows overflow,
                   horizontal when the table is wider than the card). */}
                <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-2 pt-4">
                    {bankLogo && (
                        <div
                            className="flex shrink-0 items-center"
                            aria-label={bankName}
                        >
                            {bankLogo}
                        </div>
                    )}

                    <div className="custom-scrollbar min-h-0 w-full flex-1 overflow-auto">
                        <table
                            className={`w-full border-collapse ${
                                showVas ? "min-w-[1090px]" : "min-w-[910px]"
                            }`}
                        >
                            <colgroup>
                                <col className="w-[40px]" />
                                <col className="w-[170px]" />
                                <col className="w-[96px]" />
                                <col className="w-[190px]" />
                                <col className="w-[110px]" />
                                <col className="w-[148px]" />
                                {showVas ? (
                                    <>
                                        <col className="w-[179px]" />
                                        <col className="w-[96px]" />
                                        <col />
                                    </>
                                ) : (
                                    <col />
                                )}
                            </colgroup>
                            <thead>
                                <tr className="h-10 border-y border-wb-table-border">
                                    <th className="sticky top-0 z-10 bg-wb-bg-card px-4 text-left">
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
                                            "settings.login_credentials.select_bank_accounts.col.maturity_date",
                                        )}
                                    </HeaderCell>
                                    <HeaderCell>
                                        {t(
                                            "settings.login_credentials.select_bank_accounts.col.account_nickname",
                                        )}
                                    </HeaderCell>
                                    <HeaderCell className={showVas ? "" : "pr-1"}>
                                        {t(
                                            "settings.login_credentials.select_bank_accounts.col.account_details",
                                        )}
                                    </HeaderCell>
                                    {showVas && (
                                        <>
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
                                        </>
                                    )}
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
                                            className={`h-[52px] border-b border-wb-table-border ${stripedBg}`}
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
                                                    currency={row.currency}
                                                    placeholder={t(
                                                        "settings.login_credentials.select_bank_accounts.account_type_placeholder",
                                                    )}
                                                    onChange={(v) =>
                                                        updateRow(
                                                            row.id,
                                                            "accountType",
                                                            v,
                                                        )
                                                    }
                                                    ariaLabel={t(
                                                        "settings.login_credentials.select_bank_accounts.col.account_type",
                                                    )}
                                                />
                                            </BodyCell>
                                            <BodyCell>
                                                {/* Maturity Date — read-only
                                                   (legacy EXPI_DT display). Blank
                                                   for current accounts. */}
                                                <span className="text-wb-14 font-medium text-wb-dark">
                                                    {formatMaturityDate(
                                                        row.maturityDate,
                                                    ) || "—"}
                                                </span>
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
                                            {/* Account Details — last column
                                               when VAS is hidden (pr-1);
                                               otherwise VAS Account Name is
                                               last. VAS Code / VAS Account
                                               Name persist to
                                               ACCT_MSTR.VAS_ACCT_CD/NM for
                                               non-H product types; the host
                                               hides them (showVas=false) for
                                               product type H (legacy parity). */}
                                            <BodyCell className={showVas ? "" : "pr-1"}>
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
                                            {showVas && (
                                                <>
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
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer — pinned. Validation hint (left) + Back/Save
                   (right). border-t separates it from the scrolling body. */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-wb-border-sidebar px-6 py-3">
                    <p
                        className="text-wb-12 font-medium text-wb-error"
                        role={hasIncompleteSelection ? "alert" : undefined}
                    >
                        {hasIncompleteSelection
                            ? t(
                                  "settings.login_credentials.select_bank_accounts.account_type_required",
                              )
                            : ""}
                    </p>
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
            className={`sticky top-0 z-10 bg-wb-bg-card pr-4 py-3 text-left text-wb-13 font-semibold leading-normal text-wb-dark whitespace-nowrap ${className}`}
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

/** Cell input — h-8, rounded-md, with the common Settings input border
 *  ({@code border-wb-ntrl-4}, same as the sibling LoginIdPasswordDialog
 *  FormField). No focus colour change, honouring the project-wide "no
 *  blue ring" contract on this popup family. */
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
        <div className="flex h-8 items-center rounded-md border border-wb-ntrl-4 bg-white px-2">
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

/** Account Type cell — a functional, currency-driven dropdown.
 *
 *  Custom (non-native) dropdown styled to match the WeCMS dropdown
 *  family. The menu is rendered into {@code document.body} via
 *  {@code createPortal} with {@code position: fixed} anchored to the
 *  trigger's rect — so it is NEVER clipped by the table's
 *  {@code overflow-auto} scroll wrapper OR the dialog's
 *  {@code overflow-hidden} + translate transform (same pattern as
 *  {@code LoginCredentialsRowMenu}; a native {@code <select>} looked
 *  off-brand and an inline absolute menu would be cut off).
 *
 *  Options are the three business kinds with the row's CURRENCY suffix —
 *  e.g. {@code "Current (VND)"} / {@code "Savings (VND)"} /
 *  {@code "Fixed Deposit (VND)"}, and {@code "(KRW)"} / {@code "(USD)"}
 *  for those currencies (legacy `comm_0218_nxisas.ts:getAcctType()`
 *  labels). The stored value is the currency-specific legacy
 *  {@code ACCT_TYPE_CD} ({@link acctTypeCodeFor}); the raw scraped
 *  string is never an option (mapped upstream via
 *  {@link normalizeAcctTypeCd} or left blank). The incoming {@code value}
 *  is treated as selected only when it matches one of the three currency
 *  codes — and the mapped code auto-selects on open. */
function AccountTypeSelect({
    value,
    currency,
    placeholder,
    onChange,
    ariaLabel,
}: {
    value: string;
    currency: string;
    placeholder: string;
    onChange: (next: string) => void;
    ariaLabel: string;
}) {
    const { t } = useTranslation();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [rect, setRect] = useState<DOMRect | null>(null);

    const ccy = (currency || "").trim().toUpperCase();
    const options = ACCT_TYPE_KINDS.map((entry) => {
        const base = t(entry.labelKey);
        return {
            code: acctTypeCodeFor(entry.kind, currency),
            // Currency-suffixed label, e.g. "Current VND" (space, no
            // parens — per the PO display spec + the After mockup).
            label: ccy ? `${base} ${ccy}` : base,
        };
    });
    // Honour the incoming value only when it matches one of the three
    // currency-specific codes — never echo a raw scraped string / stale code.
    const selectedOption = options.find((o) => o.code === value) ?? null;

    function openMenu() {
        if (triggerRef.current) {
            setRect(triggerRef.current.getBoundingClientRect());
            setOpen(true);
        }
    }

    // Dismiss on outside-click / ESC / scroll / resize. The menu lives in
    // a body portal, so close on any table/page scroll (its fixed position
    // would otherwise drift away from the trigger).
    useEffect(() => {
        if (!open) return;
        function onMouseDown(e: MouseEvent) {
            const tgt = e.target as Node | null;
            if (!tgt) return;
            if (menuRef.current?.contains(tgt)) return;
            if (triggerRef.current?.contains(tgt)) return;
            setOpen(false);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(false);
            }
        }
        function onScrollOrResize() {
            setOpen(false);
        }
        const id = setTimeout(() => {
            document.addEventListener("mousedown", onMouseDown);
        }, 0);
        document.addEventListener("keydown", onKey, true);
        // Capture phase so a scroll inside the table's overflow container
        // (which doesn't bubble) still closes the menu.
        window.addEventListener("scroll", onScrollOrResize, true);
        window.addEventListener("resize", onScrollOrResize);
        return () => {
            clearTimeout(id);
            document.removeEventListener("mousedown", onMouseDown);
            document.removeEventListener("keydown", onKey, true);
            window.removeEventListener("scroll", onScrollOrResize, true);
            window.removeEventListener("resize", onScrollOrResize);
        };
    }, [open]);

    const menuStyle: React.CSSProperties = (() => {
        if (!rect || typeof window === "undefined") return {};
        const OFFSET = 4;
        const PAD = 8;
        // Menu width == trigger width exactly (no auto-resize). The
        // Account Type column is sized wide enough (w-[190px]) that the
        // longest label ("Fixed Deposit VND") fits in both the trigger
        // and the menu.
        const width = rect.width;
        const estHeight = 3 * 36 + 8; // 3 options + padding
        let left = rect.left;
        if (left + width > window.innerWidth - PAD) {
            left = window.innerWidth - width - PAD;
        }
        if (left < PAD) left = PAD;
        const below = rect.bottom + OFFSET;
        if (below + estHeight < window.innerHeight - PAD) {
            return { position: "fixed", top: below, left, width };
        }
        return { position: "fixed", bottom: window.innerHeight - rect.top + OFFSET, left, width };
    })();

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => (open ? setOpen(false) : openMenu())}
                className="flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-wb-ntrl-4 bg-white px-2 text-left text-wb-13 font-medium text-wb-ink hover:bg-black/[0.03]"
            >
                <span
                    className={`min-w-0 flex-1 truncate ${
                        selectedOption ? "text-wb-ink" : "text-wb-ntrl-5"
                    }`}
                >
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                {open ? (
                    <ChevronUp
                        className="size-4 shrink-0 text-wb-ntrl-6"
                        strokeWidth={2}
                        aria-hidden
                    />
                ) : (
                    <ChevronDown
                        className="size-4 shrink-0 text-wb-ntrl-6"
                        strokeWidth={2}
                        aria-hidden
                    />
                )}
            </button>
            {open &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="listbox"
                        aria-label={ariaLabel}
                        style={menuStyle}
                        // pointer-events-auto: the host is a modal Radix
                        // <Dialog>, which sets `pointer-events: none` on
                        // <body>; this menu is portaled to <body> (outside
                        // the dialog content) so without this it inherits
                        // `none` and the options can't be clicked.
                        className="pointer-events-auto z-[80] flex flex-col gap-0.5 rounded-md border border-wb-ntrl-4 bg-white p-1 shadow-[0_4px_12px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]"
                    >
                        {options.map((o) => {
                            const isSel = o.code === value;
                            return (
                                <button
                                    key={o.code}
                                    type="button"
                                    role="option"
                                    aria-selected={isSel}
                                    onClick={() => {
                                        onChange(o.code);
                                        setOpen(false);
                                    }}
                                    className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-wb-13 font-medium hover:bg-wb-bg-sidebar ${
                                        isSel ? "text-brand" : "text-wb-ink"
                                    }`}
                                >
                                    <span className="truncate">{o.label}</span>
                                    {isSel && (
                                        <Check className="size-3.5 shrink-0 text-brand" />
                                    )}
                                </button>
                            );
                        })}
                    </div>,
                    document.body,
                )}
        </>
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

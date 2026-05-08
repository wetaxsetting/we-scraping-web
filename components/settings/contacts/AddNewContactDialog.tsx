"use client";

import { useState } from "react";
import {
    Calendar,
    ChevronDown,
    Paperclip,
    Plus,
    Search,
    Trash2,
    UserRound,
    X,
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { ContactLocation } from "./types";

type AddNewContactDialogProps = {
    onClose: () => void;
    /**
     * Dialog variant. Same UI / layout / spacing / behaviour for both
     * modes — Edit only differs in (1) the title ("Edit Contact") and
     * (2) the initial form state (pre-filled with dummy contact data
     * vs Add's empty defaults). Defaults to `"add"`.
     */
    mode?: "add" | "edit";
};

/**
 * Shared address used by both Add and Edit Figma nodes
 * (12346:165800 / 12346:165870) inside the (Current) Address textarea.
 */
const FIGMA_CURRENT_ADDRESS =
    "LK08-13, Khu phố 3, Phường 6, Thành phố Mỹ Tho, Tỉnh Tiền Giang, Việt Nam";

/**
 * Default form state for `mode="add"` — Figma 12346:165800. Contact
 * Code / Contact Name / Tax ID render as empty placeholders; the
 * deposit-account list is seeded with the two cards Figma shows
 * (Account 1 verified via Lookup with the WEBCASH recipient label,
 * Account 2 in the manual "select bank → enter account no" state
 * with empty recipient); (Current) Address is pre-filled with the
 * Figma sample value.
 */
const ADD_DEFAULTS = {
    contactCode: "",
    contactName: "",
    taxId: "",
    location: "local" as ContactLocation,
    accounts: [
        {
            id: "add-acc-1",
            bank: "ShinhanBank - Shinhan Bank",
            currency: "VND",
            accountNo: "700071155641",
            recipient: "CONG TY CO PHAN WEBCASH VIET NAM",
            lookupVerified: true,
        },
        {
            id: "add-acc-2",
            bank: "HSBC - HSBC Vietnam",
            currency: "USD",
            accountNo: "",
            recipient: "",
            lookupVerified: false,
        },
    ] as DepositAccountDraft[],
    address: FIGMA_CURRENT_ADDRESS,
    changedAddressOpen: false,
    changedAddress: "",
    validTill: "",
};

/**
 * Default form state for `mode="edit"` — Figma 12346:165870. Same
 * structural shape as Add (per the two Figma nodes confirming
 * identical layouts), but with primary fields filled in
 * (`Contact Code` / `Contact Name` / `Tax ID` = TIKI sample data
 * `0309532909` / `CÔNG TY CỔ PHẦN TIKI` / `0309532909`) and
 * `accounts[1].recipient = "Nguyễn Văn A"` instead of empty. Static
 * UI scope — these defaults are not bound to a specific row yet;
 * once the row-edit endpoint lands, swap the literals for an
 * `initialValues` prop seeded by the caller.
 */
const EDIT_DEFAULTS = {
    contactCode: "0309532909",
    contactName: "CÔNG TY CỔ PHẦN TIKI",
    taxId: "0309532909",
    location: "local" as ContactLocation,
    accounts: [
        {
            id: "edit-acc-1",
            bank: "ShinhanBank - Shinhan Bank",
            currency: "VND",
            accountNo: "700071155641",
            recipient: "CONG TY CO PHAN WEBCASH VIET NAM",
            lookupVerified: true,
        },
        {
            id: "edit-acc-2",
            bank: "HSBC - HSBC Vietnam",
            currency: "USD",
            accountNo: "",
            recipient: "Nguyễn Văn A",
            lookupVerified: false,
        },
    ] as DepositAccountDraft[],
    address: FIGMA_CURRENT_ADDRESS,
    changedAddressOpen: false,
    changedAddress: "",
    validTill: "",
};

/**
 * Add New Contact dialog — Figma 9194:10938.
 *
 * Custom-shape modal (`p-0` + `rounded-[16px]`) that deviates from the
 * standard `<DialogHeader>/<DialogBody>/<DialogFooter>` rhythm because
 * the Figma frame specifies its own padding (`p-[24px] gap-[16px]`),
 * 16px corner radius, and a borderless footer. Same pattern as
 * `<EditBankAccountDialog>` — the shared Radix primitive still owns
 * the chrome (portal, overlay, keyboard handling, modal stack).
 *
 * Stack: opens from inside Settings → `stackLevel={2}`. Default
 * `closeOnOutsideClick={false}` (inherited from the L2 default) so a
 * click on the dimmed Settings modal underneath does NOT dismiss
 * this dialog by accident. ESC + X + Cancel + Save all close.
 *
 * Static UI: form state lives in this component; Save just dismisses
 * (no API). Defaults are intentionally minimal — one empty deposit
 * account, empty current address, no changed address. The user reveals
 * extra structure by clicking "+ Add another account" or
 * "+ Add (Changed) Address". Delete affordances on each section
 * remove only that section; the LAST remaining deposit account hides
 * its Delete button so the form can never end up with zero accounts.
 */
export default function AddNewContactDialog({
    onClose,
    mode = "add",
}: AddNewContactDialogProps) {
    const { t } = useTranslation();
    // Initial state is the only thing that diverges between Add and
    // Edit — Add starts blank with one empty deposit account and the
    // (Changed) Address section collapsed; Edit seeds every field
    // from EDIT_DEFAULTS and opens the (Changed) Address block since
    // a contact-being-edited typically already has prior addresses.
    const isEdit = mode === "edit";

    // Single switch between the two Figma frames: Add (12346:165800)
    // → ADD_DEFAULTS, Edit (12346:165870) → EDIT_DEFAULTS. Every other
    // useState slot below pulls its initial value from the same
    // `defaults` object so the two frames stay in lock-step
    // structurally — only the literal values diverge.
    const defaults = isEdit ? EDIT_DEFAULTS : ADD_DEFAULTS;

    const [contactCode, setContactCode] = useState(defaults.contactCode);
    const [contactName, setContactName] = useState(defaults.contactName);
    const [taxId, setTaxId] = useState(defaults.taxId);
    const [location, setLocation] = useState<ContactLocation>(defaults.location);
    const [accounts, setAccounts] = useState<DepositAccountDraft[]>(
        defaults.accounts,
    );
    const [address, setAddress] = useState(defaults.address);
    // (Changed) Address is hidden by default in both Figma frames;
    // clicking the "+ Add (Changed) Address" link reveals the textarea
    // + Valid Till row + Delete (Changed) Address affordance. Hitting
    // Delete clears the open flag (and the local draft values) so the
    // link reappears.
    const [changedAddressOpen, setChangedAddressOpen] = useState(
        defaults.changedAddressOpen,
    );
    const [changedAddress, setChangedAddress] = useState(
        defaults.changedAddress,
    );
    const [validTill, setValidTill] = useState(defaults.validTill);

    const updateAccount = (id: string, patch: Partial<DepositAccountDraft>) => {
        setAccounts((prev) =>
            prev.map((acc) => (acc.id === id ? { ...acc, ...patch } : acc)),
        );
    };
    const removeAccount = (id: string) => {
        setAccounts((prev) => {
            // Defence in depth — UI hides the Delete button on the last
            // card, but a stale event from a removed sibling could still
            // fire. Refuse to drop below one entry so the form is never
            // in a "zero accounts" state.
            if (prev.length <= 1) return prev;
            return prev.filter((acc) => acc.id !== id);
        });
    };
    const addAccount = () => {
        setAccounts((prev) => [
            ...prev,
            {
                id: `acc-${Date.now()}`,
                bank: "",
                currency: "",
                accountNo: "",
                recipient: "",
                // New cards start in the manual flow — Recipient Name
                // input is editable, Lookup button reserves space but
                // hides until the user runs the lookup.
                lookupVerified: false,
            },
        ]);
    };
    const openChangedAddress = () => setChangedAddressOpen(true);
    const closeChangedAddress = () => {
        setChangedAddressOpen(false);
        setChangedAddress("");
        setValidTill("");
    };

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                stackLevel={2}
                hideClose
                aria-describedby={undefined}
                // Per-Figma overrides: 16px corner radius, no internal padding
                // (handled by the inner stack). Width capped at 500px —
                // every inner control is `w-full`, so this stretches
                // the form fields and address textareas to fit the
                // shell exactly. The primitive caps at
                // `max-w-[calc(100vw-32px)]` so narrower viewports
                // keep a 16px gutter on each side.
                //
                // Height is locked to the Settings card height
                // (`--w-wb-settings-card-h` = 760px) so the dialog
                // visually aligns with the Settings popup it opens
                // above. `max-h-[calc(100vh-32px)]` (also on the
                // primitive) keeps it on-screen for shorter viewports.
                className="h-[var(--w-wb-settings-card-h)] max-w-[500px] rounded-2xl p-0"
            >
                {/* Outer stack fills the fixed-height shell:
                   title bar (shrink-0) → scrollable body (flex-1) →
                   footer (shrink-0). Body owns the only vertical scroll
                   inside the dialog. */}
                <div className="flex h-full w-full flex-col">
                    {/* Title bar — Figma 9194:10939. 16px semibold + 24px
                       close X. Sits at `shrink-0` so it never scrolls. */}
                    <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-6 pb-2">
                        <DialogTitle className="text-wb-16 font-semibold tracking-wb-tight text-wb-dark">
                            {t(
                                isEdit
                                    ? "settings.contacts.edit_dialog.title"
                                    : "settings.contacts.add_dialog.title",
                            )}
                        </DialogTitle>
                        <button
                            type="button"
                            aria-label={t("settings.close")}
                            onClick={onClose}
                            className="flex size-6 cursor-pointer items-center justify-center rounded-sm text-wb-ink hover:bg-black/5"
                        >
                            <X className="size-[18px]" strokeWidth={2} />
                        </button>
                    </div>

                    {/* Scrollable body — owns all form sections + bottom
                       attach/attachments row. `gap-8` between major
                       sections (form / address / attach) per Figma 32px
                       outer gap. */}
                    <div className="custom-scrollbar flex-1 overflow-y-auto px-6 pb-4">
                        <div className="flex flex-col gap-8">
                            {/* Section 1 — primary fields + radio + deposit accounts */}
                            <div className="flex flex-col gap-4">
                                <FormField
                                    label={t("settings.contacts.add_dialog.field.contact_code")}
                                    required
                                >
                                    <TextInput
                                        value={contactCode}
                                        onChange={setContactCode}
                                        placeholder={t(
                                            "settings.contacts.add_dialog.placeholder.contact_code",
                                        )}
                                    />
                                </FormField>

                                <FormField
                                    label={t("settings.contacts.add_dialog.field.contact_name")}
                                    required
                                >
                                    <TextInput
                                        value={contactName}
                                        onChange={setContactName}
                                        placeholder={t(
                                            "settings.contacts.add_dialog.placeholder.contact_name",
                                        )}
                                    />
                                </FormField>

                                <FormField label={t("settings.contacts.add_dialog.field.tax_id")}>
                                    <TextInput
                                        value={taxId}
                                        onChange={setTaxId}
                                        placeholder={t(
                                            "settings.contacts.add_dialog.placeholder.tax_id",
                                        )}
                                    />
                                </FormField>

                                {/* Local / Overseas radio row — Figma 9194:10951. */}
                                <div className="flex items-center gap-6 py-1">
                                    <RadioPill
                                        checked={location === "local"}
                                        onClick={() => setLocation("local")}
                                        label={t("settings.contacts.location.local")}
                                    />
                                    <RadioPill
                                        checked={location === "overseas"}
                                        onClick={() => setLocation("overseas")}
                                        label={t("settings.contacts.location.overseas")}
                                    />
                                </div>

                                {/* Deposit accounts — stacked cards with
                                   24px gap per Figma 9194:10954. The last
                                   remaining card hides its Delete chip so
                                   the form can never reach zero accounts. */}
                                <div className="flex flex-col gap-6">
                                    {accounts.map((acc) => (
                                        <DepositAccountCard
                                            key={acc.id}
                                            account={acc}
                                            canDelete={accounts.length > 1}
                                            onChange={(patch) =>
                                                updateAccount(acc.id, patch)
                                            }
                                            onRemove={() => removeAccount(acc.id)}
                                        />
                                    ))}

                                    {/* Add another account — outlined chip, brand-08
                                       label. Border matches the Attach button so
                                       all secondary action chips read as one
                                       family. */}
                                    <button
                                        type="button"
                                        onClick={addAccount}
                                        className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 self-start rounded-md border border-wb-table-border bg-white px-2 text-wb-14 font-medium text-brand-hover hover:bg-black/[0.03]"
                                    >
                                        <Plus className="size-4" strokeWidth={2} />
                                        {t("settings.contacts.add_dialog.add_another_account")}
                                    </button>
                                </div>
                            </div>

                            {/* Section 2 — Current Address textarea, then EITHER
                               the "+ Add (Changed) Address" link OR the
                               revealed (Changed) Address block. Mutually
                               exclusive: clicking the link swaps it for
                               the block; clicking Delete (Changed) Address
                               swaps the block back for the link. Figma
                               9194:10976 (collapsed) + the screenshots
                               supplied with the task brief (expanded). */}
                            <div className="flex flex-col gap-4">
                                <FormField
                                    label={t("settings.contacts.add_dialog.field.current_address")}
                                >
                                    <textarea
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        rows={3}
                                        className="w-full resize-y rounded-md bg-white px-2 pb-4 pt-2 text-wb-14-tight font-medium leading-[18px] text-wb-ntrl-8 shadow-[0_0_0_1px_var(--color-wb-ntrl-4)] outline-none placeholder:text-wb-ntrl-5 focus:shadow-[0_0_0_1px_var(--color-brand)]"
                                    />
                                </FormField>

                                {changedAddressOpen ? (
                                    <ChangedAddressBlock
                                        address={changedAddress}
                                        onAddressChange={setChangedAddress}
                                        validTill={validTill}
                                        onValidTillChange={setValidTill}
                                        onDelete={closeChangedAddress}
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        onClick={openChangedAddress}
                                        className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 self-start rounded-md border border-wb-table-border bg-white px-2 text-wb-14 font-medium text-brand-hover hover:bg-black/[0.03]"
                                    >
                                        <Plus className="size-4" strokeWidth={2} />
                                        {t("settings.contacts.add_dialog.add_changed_address")}
                                    </button>
                                )}
                            </div>

                            {/* Section 3 — Attach + Attachments row. Figma 9194:10988. */}
                            <div className="flex h-8 items-center gap-2.5">
                                <button
                                    type="button"
                                    className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-wb-table-border bg-white px-2 text-wb-14 font-medium text-wb-dark hover:bg-black/[0.03]"
                                >
                                    <Paperclip className="size-4" strokeWidth={2} />
                                    {t("settings.contacts.add_dialog.attach")}
                                </button>
                                <button
                                    type="button"
                                    className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-wb-table-border bg-white px-2 text-wb-14 font-medium text-brand-hover hover:bg-black/[0.03]"
                                >
                                    {t("settings.contacts.add_dialog.attachments")}
                                    <ChevronDown className="size-4" strokeWidth={2} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer — Cancel + Save right-aligned. No `border-t`
                       per Figma (the standard `<DialogFooter>` would add
                       one). px-6 pb-6 pt-3 keeps the rhythm consistent
                       with the dialog's 24px outer padding. */}
                    <div className="flex shrink-0 items-center justify-end gap-2 px-6 pb-6 pt-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("settings.contacts.add_dialog.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                        >
                            {t("settings.contacts.add_dialog.save")}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─────────────────────────────────────────────────────────────
// Internal types + small subcomponents
// ─────────────────────────────────────────────────────────────

type DepositAccountDraft = {
    id: string;
    bank: string;
    currency: string;
    accountNo: string;
    recipient: string;
    /**
     * `true` when the recipient was set via the Lookup Recipient
     * flow — Figma renders the verified recipient as a static label
     * below Lookup/Delete and shows the Lookup button. `false` (or
     * undefined) when the user is entering the recipient manually —
     * Figma shows a Recipient Name input ABOVE Lookup/Delete and
     * paints the Lookup button at `opacity-0` (hidden but reserves
     * space). See nodes 12346:165817 (verified) vs 12346:165828
     * (manual) in the Add Figma.
     */
    lookupVerified?: boolean;
};

/**
 * Form-field wrapper — label (with optional red asterisk) on top, control
 * below, with the Figma-spec'd 8px gap between them. Local to this dialog
 * because the larger app form-field shape (used by login) carries an
 * error slot we don't need here.
 */
function FormField({
    label,
    required = false,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label className="flex flex-col gap-2">
            <span className="flex items-start gap-0.5 text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                {label}
                {required && (
                    <span className="text-wb-red-07" aria-hidden>
                        *
                    </span>
                )}
            </span>
            {children}
        </label>
    );
}

/**
 * Bare text input — h-32 rounded-6 with a 1px outline-shadow (NOT a
 * border, per Figma). Matches the Figma `Text Field` instance used by
 * every short input in this dialog (Code / Name / Tax ID / account no
 * / recipient).
 */
function TextInput({
    value,
    onChange,
    placeholder,
    rightSlot,
    onClear,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    /** Optional right-side icon slot (e.g. search). Sits flush right. */
    rightSlot?: React.ReactNode;
    /** When provided AND value is non-empty, renders a clear (X) chip. */
    onClear?: () => void;
}) {
    return (
        <div className="flex h-8 w-full items-center gap-1 rounded-md bg-white px-2 shadow-[0_0_0_1px_var(--color-wb-ntrl-4)] focus-within:shadow-[0_0_0_1px_var(--color-brand)]">
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="min-w-0 flex-1 bg-transparent text-wb-14-tight font-medium text-wb-ntrl-8 outline-none placeholder:text-wb-ntrl-5"
            />
            {value && onClear && (
                <button
                    type="button"
                    onClick={onClear}
                    aria-label="Clear"
                    className="flex size-4 cursor-pointer items-center justify-center rounded-full text-wb-ntrl-5 hover:text-wb-ink"
                >
                    <X className="size-3.5" strokeWidth={2} />
                </button>
            )}
            {rightSlot}
        </div>
    );
}

/**
 * Currency dropdown chip — 32px tall, raised default-button shadow (3
 * layers) per Figma. Static UI: clicking does nothing yet; the value
 * prop drives the displayed label.
 */
function CurrencyDropdown({ value }: { value: string }) {
    const { t } = useTranslation();
    const label = value
        ? t("settings.contacts.add_dialog.currency_value", { code: value })
        : t("settings.contacts.add_dialog.currency_placeholder");
    return (
        <button
            type="button"
            className="flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md bg-white px-2 text-wb-14-tight font-medium text-wb-ntrl-8 shadow-wb-btn hover:bg-black/[0.03]"
        >
            <span className={cn("truncate", !value && "text-wb-ntrl-5")}>
                {label}
            </span>
            <ChevronDown className="size-4 shrink-0" strokeWidth={2} />
        </button>
    );
}

/**
 * Local / Overseas radio button. Custom (no Radix radio in the project)
 * so the visual matches the Figma 18px ring + 6px brand inner dot exactly.
 * The whole label is the click target.
 */
function RadioPill({
    checked,
    onClick,
    label,
}: {
    checked: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={onClick}
            className="inline-flex cursor-pointer items-center gap-2.5"
        >
            <span
                className={cn(
                    "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    checked ? "border-brand" : "border-wb-ntrl-4",
                )}
            >
                {checked && (
                    <span className="size-2 rounded-full bg-brand" />
                )}
            </span>
            <span className="text-wb-14 font-medium text-wb-ntrl-8">
                {label}
            </span>
        </button>
    );
}

/**
 * One deposit-account card — Figma 12346:165817 (verified) +
 * 12346:165828 (manual). Bank input (with search glyph), Currency
 * dropdown, Account No input. Then EITHER:
 *   - Verified flow (`account.lookupVerified === true`): no
 *     Recipient Name input; Lookup Recipient button visible; static
 *     recipient label rendered below the Lookup/Delete row.
 *   - Manual flow (default): Recipient Name input visible above
 *     Lookup/Delete; Lookup button rendered with `invisible` so it
 *     reserves its space without showing.
 * Delete account hides on the last remaining card so the form can
 * never end up empty.
 */
function DepositAccountCard({
    account,
    canDelete,
    onChange,
    onRemove,
}: {
    account: DepositAccountDraft;
    /** Hide the Delete account chip when this is the only card. */
    canDelete: boolean;
    onChange: (patch: Partial<DepositAccountDraft>) => void;
    onRemove: () => void;
}) {
    const { t } = useTranslation();
    const isVerified = !!account.lookupVerified;
    return (
        <div className="flex w-full flex-col gap-2">
            {/* Bank — labelled as "Deposit Account" per Figma. The search
               glyph is decorative; clicking it is inert in static UI. */}
            <FormField label={t("settings.contacts.add_dialog.field.deposit_account")}>
                <TextInput
                    value={account.bank}
                    onChange={(v) => onChange({ bank: v })}
                    placeholder={t(
                        "settings.contacts.add_dialog.placeholder.deposit_account",
                    )}
                    rightSlot={
                        <Search className="size-4 shrink-0 text-brand" strokeWidth={2} />
                    }
                />
            </FormField>

            {/* Currency dropdown — separate row per Figma 9194:10957 */}
            <CurrencyDropdown value={account.currency} />

            {/* Account no — text input with optional clear chip when filled */}
            <TextInput
                value={account.accountNo}
                onChange={(v) => onChange({ accountNo: v })}
                placeholder={t(
                    "settings.contacts.add_dialog.placeholder.account_no",
                )}
                onClear={() => onChange({ accountNo: "" })}
            />

            {/* Recipient Name input — only when NOT verified via Lookup.
               Verified accounts replace this with a static label below
               the Lookup/Delete row. */}
            {!isVerified && (
                <FormField
                    label={t("settings.contacts.add_dialog.field.recipient_name")}
                >
                    <TextInput
                        value={account.recipient}
                        onChange={(v) => onChange({ recipient: v })}
                        placeholder={t(
                            "settings.contacts.add_dialog.placeholder.recipient_name",
                        )}
                    />
                </FormField>
            )}

            {/* Lookup + Delete row. The Lookup button uses `invisible`
               in manual mode so it reserves vertical space (matching
               Figma's `opacity-0` treatment) — keeps the row height
               consistent across both card variants. */}
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    className={cn(
                        "inline-flex h-8 cursor-pointer items-center gap-1 rounded-md bg-white px-2 text-wb-14 font-medium text-brand shadow-wb-btn hover:bg-black/[0.03]",
                        !isVerified && "invisible",
                    )}
                >
                    <Search className="size-4" strokeWidth={2} />
                    {t("settings.contacts.add_dialog.lookup_recipient")}
                </button>
                {canDelete ? (
                    <button
                        type="button"
                        onClick={onRemove}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-wb-14 font-medium text-wb-red-07 hover:bg-black/[0.03]"
                    >
                        <Trash2 className="size-4" strokeWidth={2} />
                        {t("settings.contacts.add_dialog.delete_account")}
                    </button>
                ) : (
                    <span aria-hidden />
                )}
            </div>

            {/* Verified-recipient label — only when the card is in
               the lookup-verified state (Account 1 in both Figma
               frames). Mirrors the legacy WeCMS "verified recipient"
               line under a populated deposit account. */}
            {isVerified && account.recipient && (
                <div className="flex items-end gap-1">
                    <UserRound
                        className="size-4 shrink-0 text-wb-ntrl-8"
                        strokeWidth={2}
                    />
                    <span className="truncate text-wb-12 font-medium text-wb-ntrl-8">
                        {account.recipient}
                    </span>
                </div>
            )}
        </div>
    );
}

/**
 * (Changed) Address reveal block — appears in place of the
 * "+ Add (Changed) Address" link once the user clicks it. Renders the
 * Changed Address textarea, a Valid Till date chip, and a Delete
 * (Changed) Address affordance. Delete unmounts the block (parent
 * clears `changedAddressOpen` + draft values), which puts the
 * "+ Add (Changed) Address" link back.
 */
function ChangedAddressBlock({
    address,
    onAddressChange,
    validTill,
    onValidTillChange,
    onDelete,
}: {
    address: string;
    onAddressChange: (v: string) => void;
    validTill: string;
    onValidTillChange: (v: string) => void;
    onDelete: () => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-3">
            <FormField
                label={t("settings.contacts.add_dialog.field.changed_address")}
            >
                <textarea
                    value={address}
                    onChange={(e) => onAddressChange(e.target.value)}
                    rows={3}
                    className="w-full resize-y rounded-md bg-white px-2 pb-4 pt-2 text-wb-14-tight font-medium leading-[18px] text-wb-ntrl-8 shadow-[0_0_0_1px_var(--color-wb-ntrl-4)] outline-none placeholder:text-wb-ntrl-5 focus:shadow-[0_0_0_1px_var(--color-brand)]"
                />
            </FormField>

            {/* Valid Till row — label · date chip · Delete affordance.
               Date input is a native `<input type="date">` styled to
               match the dialog's other inputs. Calendar glyph is
               decorative — the native picker still opens by clicking
               anywhere in the input. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="text-wb-14 font-medium text-wb-ntrl-8">
                        {t("settings.contacts.add_dialog.field.valid_till")}
                    </span>
                    <div className="flex h-8 items-center gap-1 rounded-md bg-white px-2 shadow-[0_0_0_1px_var(--color-wb-ntrl-4)] focus-within:shadow-[0_0_0_1px_var(--color-brand)]">
                        <input
                            type="date"
                            value={validTill}
                            onChange={(e) => onValidTillChange(e.target.value)}
                            className="min-w-0 bg-transparent text-wb-14-tight font-medium text-wb-ntrl-8 outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                        />
                        <Calendar
                            className="size-4 shrink-0 text-wb-ntrl-8"
                            strokeWidth={2}
                        />
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onDelete}
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-wb-table-border bg-white px-2 text-wb-14 font-medium text-wb-red-07 hover:bg-black/[0.03]"
                >
                    <Trash2 className="size-4" strokeWidth={2} />
                    {t("settings.contacts.add_dialog.delete_changed_address")}
                </button>
            </div>
        </div>
    );
}

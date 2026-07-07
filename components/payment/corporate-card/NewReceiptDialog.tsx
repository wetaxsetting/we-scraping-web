"use client";

import {
    Calendar,
    ChevronDown,
    Paperclip,
    Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ApiCallError } from "@/lib/api/banking";
import { createCardReceipt, fetchPurposeOptions, uploadCardReceiptFile } from "@/lib/api/cardTransactions";
import { fetchContacts } from "@/lib/api/contacts";
import { useApiData } from "@/lib/api/useApiData";
import { AttachmentCountDropdown } from "@/components/shared/attachment/AttachmentCountDropdown";
import { useDialog } from "@/components/shared/dialog";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import type { ApiPurposeOption } from "@/lib/types/api";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ============================================================================
 *  "New Receipt" sub-popup — opens from the Link Card Payments dialog's
 *  Receipt tab. Mirrors legacy {@code prch_0011_001} — the manual
 *  expense / receipt entry form.
 *
 *  Stacked at level 2 above the parent Link Card Payments dialog.
 *
 *  UI matches Figma 7146:49087 (Contacts mode) / 1183:26545 (Manual mode) /
 *  3836:22535 (Contacts picker popup). Contacts + Purpose pickers are wired
 *  to the live `/settings/contacts` + `card-transactions/purpose-options`
 *  endpoints; Save posts `POST /card-transactions/receipts`. Attachments are
 *  collected client-side only — the receipt-create endpoint does not accept
 *  files (no backend contract change in this UI refactor).
 *
 *  Project/Site (shown in the Figma Contacts frame) is intentionally omitted:
 *  the create-receipt request carries no such field, and this is a UI-only
 *  refactor — no backend field is introduced.
 * ========================================================================== */

type NewReceiptDialogProps = {
    onClose:    () => void;
    onCreated:  () => void;
};

/* ── Shared input styling — mirrors the two Figma field treatments ──
 *  · flatField  — text fields with a 1px flat border (#d4d4d4 / ntrl-4):
 *    Name (manual) / Tax ID / Amount / Purpose / Description.
 *  · raisedField — dropdown-style controls with the elevated button
 *    shadow: Date / Payment Method.                                    */
const FLAT_FIELD =
    "h-9 w-full rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-14 font-medium text-wb-ink placeholder:text-wb-ntrl-5 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40";
const RAISED_FIELD =
    "h-9 w-full rounded-md bg-white px-3 text-wb-14 font-medium text-wb-ink shadow-wb-btn placeholder:text-wb-ntrl-5 focus:outline-none focus:ring-1 focus:ring-brand/40";

export default function NewReceiptDialog({
    onClose,
    onCreated,
}: NewReceiptDialogProps) {
    const { t } = useTranslation();
    const sysDialog = useDialog();

    const today = useTodayLabel();

    const [date,           setDate]           = useState(today);
    /** Picked contact in Contacts mode (null in Manual mode). Carries
     *  the full `ApiContactRow` so we can echo `trco_key` / `trco_tax_id`
     *  / and read the picked currency from the row's accounts if needed. */
    const [pickedContact,  setPickedContact]  = useState<PickedContact | null>(null);
    /** Free-text contact name in Manual mode. */
    const [manualContact,  setManualContact]  = useState("");
    /** Free-text tax id in Manual mode. Ignored in Contacts mode. */
    const [manualTaxId,    setManualTaxId]    = useState("");
    const [contactsMode,   setContactsMode]   = useState(true); // toggle: Contacts / Manual
    const [amount,         setAmount]         = useState("");
    /** Picked Purpose option (USE_USAG_CD + localized name). Null
     *  when the user hasn't picked one. */
    const [pickedPurpose,  setPickedPurpose]  = useState<ApiPurposeOption | null>(null);
    const [description,    setDescription]    = useState("");
    const [paymentMethod,  setPaymentMethod]  = useState("");
    const [saving,         setSaving]         = useState(false);
    /** Synchronous in-flight guard. `disabled`/`saving` are render-derived, so
     *  two clicks in the same frame (before `setSaving(true)` re-renders and
     *  disables the button) would BOTH pass the `canSave` check and fire two
     *  `POST /receipts` → two receipts. A ref flips synchronously on the first
     *  invocation, so the second returns immediately regardless of render timing. */
    const submittingRef = useRef(false);

    /** Attachment list (Figma "Attachments (N)"). Uploaded to BUSA_DOC_FILE
     *  after the receipt is created (audit G3/G5). */
    const [attachments,    setAttachments]    = useState<File[]>([]);
    const [attachOpen,     setAttachOpen]     = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const effectiveName = contactsMode
        ? (pickedContact?.trcoCmnm ?? "")
        : manualContact.trim();
    const effectiveTaxId = contactsMode
        ? (pickedContact?.trcoTaxId ?? "")
        : manualTaxId.trim();

    const canSave = effectiveName !== "" && Number(amount) > 0 && !saving;

    /** Convert the DD-MM-YYYY input back to yyyyMMdd for the wire. */
    const toYmd = (ddmmyyyy: string): string => {
        const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(ddmmyyyy.trim());
        return m ? `${m[3]}${m[2]}${m[1]}` : "";
    };

    const handleAttachPick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files ?? []);
        if (picked.length > 0) {
            setAttachments((prev) => [...prev, ...picked]);
            setAttachOpen(true);
        }
        e.target.value = ""; // allow re-picking the same file
    };

    const handleSave = async () => {
        if (submittingRef.current) return; // reject a concurrent second submit
        const useDt = toYmd(date);
        if (useDt === "") {
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: t("payment.card.new_receipt.error.bad_date"),
            });
            return;
        }
        submittingRef.current = true;
        setSaving(true);
        try {
            const { doc_id } = await createCardReceipt({
                use_dt:       useDt,
                trco_key:     contactsMode ? pickedContact?.trcoKey : undefined,
                contact_name: effectiveName,
                tax_id:       effectiveTaxId || undefined,
                amount:       String(amount),
                ccy_cd:       "VND",
                purpose_cd:   pickedPurpose?.use_usag_cd,
                description:  description.trim() || undefined,
            });
            // Persist attachments to BUSA_DOC_FILE against the new receipt
            // (audit G3/G5). One call per file (backend allocates FILE_ID per
            // upload); sequential to keep the per-doc MAX+1 order deterministic.
            for (const file of attachments) {
                await uploadCardReceiptFile(doc_id, file);
            }
            sysDialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("payment.card.new_receipt.success"),
            });
            onCreated();
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code    : "WBE9999";
            const msg  = err instanceof ApiCallError ? err.message : t("payment.card.new_receipt.error.generic");
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: msg,
                errorCode:   code,
            });
        } finally {
            setSaving(false);
            submittingRef.current = false;
        }
    };

    return (
        <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent
                stackLevel={2}
                className="flex max-h-[calc(100vh-32px)] w-[452px] max-w-[calc(100vw-32px)] flex-col gap-6 rounded-2xl p-0"
                aria-describedby={undefined}
            >
                {/* Header — title (built-in close X sits at top-4 right-4) */}
                <div className="shrink-0 px-4 pr-12 pt-6">
                    <DialogTitle className="text-wb-16 font-semibold tracking-wb-tight text-wb-dark">
                        {t("payment.card.new_receipt.title")}
                    </DialogTitle>
                </div>

                {/* Body — scrolls if the viewport is short */}
                <div className="custom-scrollbar-y flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
                    {/* Date */}
                    <Field label={t("payment.card.new_receipt.date")} required>
                        <div className="relative">
                            <input
                                type="text"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className={cn(RAISED_FIELD, "pr-9")}
                                placeholder="DD-MM-YYYY"
                            />
                            <Calendar
                                aria-hidden
                                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-wb-ntrl-6"
                                strokeWidth={1.6}
                            />
                        </div>
                    </Field>

                    {/* Name — searchable Contacts picker (Contacts mode) or
                        free text (Manual mode), with the Contacts / Manual
                        toggle on the right. Mirrors legacy
                        `prch_0011_001.ts:102-148`. */}
                    <Field label={t("payment.card.new_receipt.name")} required>
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                {contactsMode ? (
                                    <ContactPicker
                                        value={pickedContact}
                                        onPick={setPickedContact}
                                        placeholder={t("payment.card.new_receipt.contact_placeholder")}
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        value={manualContact}
                                        onChange={(e) => setManualContact(e.target.value)}
                                        placeholder={t("payment.card.new_receipt.contact_placeholder")}
                                        className={FLAT_FIELD}
                                    />
                                )}
                            </div>
                            {/* Contacts / Manual toggle — blue pill (on =
                                Contacts, off = Manual), label flips with the
                                state. Switching clears both sides so stale
                                state doesn't leak. Mirrors legacy toggle +
                                ML pair `_j002` / `_j005`. */}
                            <button
                                type="button"
                                role="switch"
                                aria-checked={contactsMode}
                                onClick={() => {
                                    setContactsMode((v) => !v);
                                    setPickedContact(null);
                                    setManualContact("");
                                    setManualTaxId("");
                                }}
                                className="flex shrink-0 cursor-pointer items-center gap-2 px-1"
                            >
                                <span
                                    aria-hidden
                                    className={cn(
                                        "relative inline-flex h-[18px] w-[30px] items-center rounded-full transition-colors",
                                        contactsMode ? "bg-brand" : "bg-wb-ntrl-3",
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "absolute size-[14px] rounded-full bg-white shadow-wb-btn transition-all",
                                            contactsMode ? "left-[14px]" : "left-[2px]",
                                        )}
                                    />
                                </span>
                                <span className="text-wb-14 font-medium text-wb-ink">
                                    {contactsMode
                                        ? t("payment.card.new_receipt.toggle.contacts")
                                        : t("payment.card.new_receipt.toggle.manual")}
                                </span>
                            </button>
                        </div>
                    </Field>

                    {/* Tax ID — read-only echo of the picked contact's
                        TRCO_TAX_ID in Contacts mode (legacy disable), editable
                        text in Manual mode (legacy enable). */}
                    <Field label={t("payment.card.new_receipt.tax_id")}>
                        {contactsMode ? (
                            <input
                                type="text"
                                value={effectiveTaxId}
                                placeholder={t("payment.card.new_receipt.tax_id_placeholder")}
                                className={cn(FLAT_FIELD, "bg-wb-bg-card text-wb-ntrl-6")}
                                readOnly
                            />
                        ) : (
                            <input
                                type="text"
                                value={manualTaxId}
                                onChange={(e) => setManualTaxId(e.target.value)}
                                placeholder={t("payment.card.new_receipt.tax_id_placeholder")}
                                className={FLAT_FIELD}
                            />
                        )}
                    </Field>

                    {/* Amount — right-aligned numeric */}
                    <Field label={t("payment.card.new_receipt.amount")} required>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                            placeholder="0.00"
                            className={cn(FLAT_FIELD, "text-right")}
                        />
                    </Field>

                    {/* Purpose — searchable dropdown backed by USAG_INFM
                        (USAG_GRP_CD='6'). Mirrors legacy `prch_0011_001.ts:91`. */}
                    <Field label={t("payment.card.new_receipt.purpose")}>
                        <PurposePicker
                            value={pickedPurpose}
                            onPick={setPickedPurpose}
                            placeholder={t("payment.card.new_receipt.purpose_placeholder")}
                        />
                    </Field>

                    {/* Description — plain text input (no lookup/search icon) */}
                    <Field label={t("payment.card.new_receipt.description")}>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t("payment.card.new_receipt.description_placeholder")}
                            className={FLAT_FIELD}
                        />
                    </Field>

                    {/* Payment Method — WeCMS-style dropdown (no native select) */}
                    <Field label={t("payment.card.new_receipt.payment_method")}>
                        <PaymentMethodSelect
                            value={paymentMethod}
                            onChange={setPaymentMethod}
                            options={[
                                { value: "", label: t("payment.card.new_receipt.payment_method_none") },
                            ]}
                        />
                    </Field>

                    {/* Attachment — Attach button + floating "Attachments (N)"
                        dropdown. Reuses the shared <AttachmentCountDropdown>
                        (Request Approval / Figma 770:22631 style): white card,
                        rounded, soft popup shadow, file-type icon + ellipsised
                        name per row. Opens upward so it never overlaps the
                        footer. On Save the files are uploaded to BUSA_DOC_FILE
                        against the new receipt (audit G3/G5). */}
                    <div className="flex min-h-8 flex-wrap items-center gap-2.5">
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleAttachPick}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-wb-ntrl-4 bg-white px-2 text-wb-14 font-medium text-wb-dark hover:bg-black/3"
                        >
                            <Paperclip className="size-4" strokeWidth={1.6} aria-hidden />
                            {t("payment.card.new_receipt.attach")}
                        </button>

                        {attachments.length > 0 && (
                            <AttachmentCountDropdown
                                files={attachments}
                                open={attachOpen}
                                onToggle={() => setAttachOpen((v) => !v)}
                                countLabel={t("payment.card.new_receipt.attachments_count", {
                                    count: String(attachments.length),
                                })}
                                onClear={() => { setAttachments([]); setAttachOpen(false); }}
                                clearLabel={t("payment.card.new_receipt.remove_attachment")}
                            />
                        )}
                    </div>
                </div>

                {/* Footer — Cancel + Save */}
                <div className="flex shrink-0 items-center justify-end gap-2.5 px-4 pb-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-4 text-wb-14 font-medium text-wb-ink shadow-wb-btn hover:bg-black/3"
                    >
                        {t("dialog.cancel")}
                    </button>
                    <button
                        type="button"
                        disabled={!canSave}
                        onClick={() => { if (canSave) void handleSave(); }}
                        className={cn(
                            "flex h-8 items-center justify-center rounded-md px-4 text-wb-14 font-medium",
                            canSave
                                ? "cursor-pointer bg-brand text-white shadow-wb-brand-btn hover:bg-brand-hover"
                                : "cursor-not-allowed bg-wb-ntrl-4 text-white",
                        )}
                    >
                        {saving ? t("common.loading") : t("dialog.save")}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ── Label + input row ─────────────────────────────────────────── */

function Field({
    label,
    required,
    children,
}: {
    label:      string;
    required?:  boolean;
    children:   React.ReactNode;
}) {
    return (
        <label className="flex flex-col gap-2">
            <span className="flex items-center gap-0.5 text-wb-14 font-medium text-wb-ntrl-8">
                {label}
                {required && <span aria-hidden className="text-wb-status-rejected-text">*</span>}
            </span>
            {children}
        </label>
    );
}

/** Local DD-MM-YYYY label for today — replace with the shared
 *  `<DateField>` picker once the receipt-create endpoint lands. */
function useTodayLabel(): string {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

/* ── Payment Method — WeCMS-style dropdown ──────────────────────────
 *  Replaces the native <select> so the menu matches every other WeCMS
 *  popup (white card, rounded, shadow, neutral hover) instead of the
 *  browser's blue option list. Options + selected value are owned by the
 *  caller — no behavior / payload / API change. Mirrors the shared
 *  `SearchSelect` row token (`text-wb-13 font-medium tracking-wb-tight`). */
type SelectOption = { value: string; label: string };

function PaymentMethodSelect({
    value,
    onChange,
    options,
}: {
    value:    string;
    onChange: (v: string) => void;
    options:  SelectOption[];
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const selected = options.find((o) => o.value === value) ?? options[0];

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={cn(RAISED_FIELD, "flex cursor-pointer items-center justify-between pr-9 text-left")}
            >
                <span className="truncate">{selected?.label ?? ""}</span>
            </button>
            <ChevronDown
                aria-hidden
                className={cn(
                    "pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-wb-ntrl-6 transition-transform",
                    open && "rotate-180",
                )}
                strokeWidth={1.6}
            />
            {open && (
                <ul
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 right-0 top-10 z-50 max-h-60 overflow-y-auto rounded-lg bg-white py-1 shadow-wb-popup animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out"
                >
                    {options.map((o) => {
                        const isSel = o.value === value;
                        return (
                            <li key={o.value}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSel}
                                    onClick={() => { onChange(o.value); setOpen(false); }}
                                    className={cn(
                                        "flex w-full cursor-pointer items-center rounded p-2 text-left text-wb-13 font-medium tracking-wb-tight text-wb-ntrl-8 hover:bg-wb-bg-sidebar",
                                        isSel && "bg-wb-bg-active",
                                    )}
                                >
                                    {o.label}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

/* ── Contact picker — searchable dropdown over /settings/contacts ──
 *  Mirrors legacy `prch_0011_001.ts:90` `comboDataSearch 'TRCO'`. The
 *  user types in the chip to filter; clicking a row commits the pick
 *  and auto-fills the Tax ID field on the parent form. The dropdown list
 *  matches the Figma contacts popup (3836:22535) — a radio list with the
 *  company name and a "{code} . {tax id}" sub-line. */

export type PickedContact = {
    trcoKey:    string;
    trcoCmnm:   string;
    trcoTaxId:  string | null;
};

function ContactPicker({
    value,
    onPick,
    placeholder,
}: {
    value:       PickedContact | null;
    onPick:      (c: PickedContact | null) => void;
    placeholder: string;
}) {
    const { t } = useTranslation();
    const [open,  setOpen]  = useState(false);
    const [query, setQuery] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    // Stale-while-revalidate fetch — triggers on every keystroke
    // (debouncing is intentionally skipped for the first MR; the list
    // endpoint already caps at 15 rows per page so the network cost
    // is low).
    const state = useApiData(
        () => open
            ? fetchContacts({ search: query || undefined, size: 15 })
            : Promise.resolve(null),
        [open, query],
    );
    const rows = state.data?.rows ?? [];

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const display = value?.trcoCmnm ?? "";

    return (
        <div ref={ref} className="relative">
            <div className="relative">
                <input
                    type="text"
                    value={open ? query : display}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        if (!open) setOpen(true);
                        if (value) onPick(null); // clear pick when user retypes
                    }}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    className={cn(FLAT_FIELD, "pr-9")}
                />
                <Search
                    aria-hidden
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brand"
                    strokeWidth={1.6}
                />
            </div>
            {open && (
                <div
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 right-0 top-10 z-50 max-h-72 overflow-y-auto overflow-x-hidden rounded-lg bg-white pb-2 shadow-wb-popup animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out"
                >
                    <div className="px-3 pb-1.5 pt-4 text-wb-12 font-medium leading-4 uppercase tracking-wb-tight text-wb-ntrl-6">
                        {t("payment.card.new_receipt.contacts_header")}
                    </div>
                    {state.loading && rows.length === 0 && (
                        <div className="px-3 py-2 text-wb-14 text-wb-muted">
                            {t("common.loading")}
                        </div>
                    )}
                    {!state.loading && rows.length === 0 && (
                        <div className="px-3 py-2 text-wb-14 text-wb-muted">
                            {t("payment.card.new_receipt.no_contacts")}
                        </div>
                    )}
                    <div className="flex flex-col gap-0.5">
                        {rows.map((r) => {
                            const isSel = value?.trcoKey === r.trco_key;
                            const code  = r.hand_trco_key || r.trco_key;
                            return (
                                <button
                                    key={r.trco_key}
                                    type="button"
                                    role="option"
                                    aria-selected={isSel}
                                    onClick={() => {
                                        onPick({
                                            trcoKey:   r.trco_key,
                                            trcoCmnm:  r.trco_cmnm,
                                            trcoTaxId: r.trco_tax_id,
                                        });
                                        setQuery("");
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "flex w-full cursor-pointer items-center gap-3 px-3 py-1.5 text-left hover:bg-neutral-50",
                                        isSel && "bg-brand-soft",
                                    )}
                                >
                                    <span
                                        aria-hidden
                                        className={cn(
                                            "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                                            isSel ? "border-brand" : "border-wb-ntrl-4",
                                        )}
                                    >
                                        {isSel && <span className="size-2 rounded-full bg-brand" />}
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="truncate text-wb-13 font-medium leading-4 tracking-wb-tight text-wb-ink">
                                            {r.trco_cmnm}
                                        </span>
                                        {(code || r.trco_tax_id) && (
                                            <span className="flex flex-wrap items-center gap-1 text-wb-14 font-normal leading-5 text-wb-ntrl-6">
                                                {code && <span>{code}</span>}
                                                {code && r.trco_tax_id && (
                                                    <span className="font-semibold">.</span>
                                                )}
                                                {r.trco_tax_id && <span>{r.trco_tax_id}</span>}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Purpose picker — USAG_INFM dropdown ────────────────────────── */

function PurposePicker({
    value,
    onPick,
    placeholder,
}: {
    value:       ApiPurposeOption | null;
    onPick:      (p: ApiPurposeOption | null) => void;
    placeholder: string;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    // Purpose is a tiny static dictionary — fetch once on open + filter
    // client-side. Caches across re-opens.
    const state = useApiData(
        () => open ? fetchPurposeOptions("6") : Promise.resolve(null),
        [open],
    );
    const filtered = useMemo(() => {
        const all = state.data ?? [];
        const q = query.trim().toLowerCase();
        if (!q) return all;
        return all.filter((p) =>
            p.usag_nm.toLowerCase().includes(q)
            || p.use_usag_cd.toLowerCase().includes(q),
        );
    }, [state.data, query]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const display = value?.usag_nm ?? "";

    return (
        <div ref={ref} className="relative">
            <div className="relative">
                <input
                    type="text"
                    value={open ? query : display}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        if (!open) setOpen(true);
                        if (value) onPick(null);
                    }}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    className={cn(FLAT_FIELD, "pr-9")}
                />
                <Search
                    aria-hidden
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brand"
                    strokeWidth={1.6}
                />
            </div>
            {open && (
                <ul
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 right-0 top-10 z-50 max-h-60 overflow-y-auto rounded-lg border border-wb-ntrl-4 bg-white py-1 shadow-wb-card animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out"
                >
                    {state.loading && filtered.length === 0 && (
                        <li className="px-3 py-2 text-wb-14 text-wb-muted">
                            {t("common.loading")}
                        </li>
                    )}
                    {!state.loading && filtered.length === 0 && (
                        <li className="px-3 py-2 text-wb-14 text-wb-muted">
                            {t("payment.card.new_receipt.no_purposes")}
                        </li>
                    )}
                    {filtered.map((p) => {
                        const isSel = value?.use_usag_cd === p.use_usag_cd;
                        return (
                            <li key={p.use_usag_cd}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSel}
                                    onClick={() => {
                                        onPick(p);
                                        setQuery("");
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "flex w-full cursor-pointer items-center px-3 py-2 text-left text-wb-14 font-medium text-wb-ink hover:bg-neutral-50",
                                        isSel && "bg-brand-soft",
                                    )}
                                >
                                    <span className="truncate">{p.usag_nm}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

"use client";

import { Calendar, Check, ChevronDown, Paperclip, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ApiCallError } from "@/lib/api/banking";
import { createCardReceipt, fetchPurposeOptions } from "@/lib/api/cardTransactions";
import { fetchContacts } from "@/lib/api/contacts";
import { useApiData } from "@/lib/api/useApiData";
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
 *  Stacked at level 2 above the parent Link Card Payments dialog. Static
 *  UI scope this MR — Save is a no-op until the backend
 *  {@code POST /api/v1/purchase/receipts} endpoint lands. Contact picker
 *  + Purpose picker are placeholders (open the existing Contacts /
 *  Purpose dialogs in a future MR).
 * ========================================================================== */

type NewReceiptDialogProps = {
    onClose:    () => void;
    onCreated:  () => void;
};

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

    const handleSave = async () => {
        const useDt = toYmd(date);
        if (useDt === "") {
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: t("payment.card.new_receipt.error.bad_date"),
            });
            return;
        }
        setSaving(true);
        try {
            await createCardReceipt({
                use_dt:       useDt,
                trco_key:     contactsMode ? pickedContact?.trcoKey : undefined,
                contact_name: effectiveName,
                tax_id:       effectiveTaxId || undefined,
                amount:       String(amount),
                ccy_cd:       "VND",
                purpose_cd:   pickedPurpose?.use_usag_cd,
                description:  description.trim() || undefined,
            });
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
        }
    };

    return (
        <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent
                stackLevel={2}
                className="w-[520px] max-w-[calc(100vw-32px)] p-0"
                aria-describedby={undefined}
            >
                <DialogTitle className="px-6 pt-6 text-wb-16 font-semibold tracking-wb-tight text-wb-dark">
                    {t("payment.card.new_receipt.title")}
                </DialogTitle>

                <div className="flex flex-col gap-4 px-6 py-4">
                    {/* Date */}
                    <Field label={t("payment.card.new_receipt.date")} required>
                        <div className="relative">
                            <input
                                type="text"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="h-9 w-full rounded-md border border-wb-ntrl-4 bg-white px-3 pr-9 text-wb-13 font-normal text-wb-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
                                placeholder="DD-MM-YYYY"
                            />
                            <Calendar
                                aria-hidden
                                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-wb-ntrl-6"
                                strokeWidth={1.6}
                            />
                        </div>
                    </Field>

                    {/* Contacts Name — searchable dropdown in Contacts
                        mode (queries `/settings/contacts` with the
                        typed search), free text in Manual mode.
                        Mirrors legacy `prch_0011_001.ts:102-148`. */}
                    <Field
                        label={t("payment.card.new_receipt.contact_name_required")}
                        required
                    >
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
                                        className="h-9 w-full rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-normal text-wb-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
                                    />
                                )}
                            </div>
                            {/* Contacts / Manual toggle — proper switch
                                (track + sliding thumb) with the label
                                flipping between "Contacts" (on) and
                                "Manual" (off). Mirrors legacy
                                `prch_0011_001.ts:102-148` toggle behaviour
                                + the ML pair `_j002` (Contacts) / `_j005`
                                (Manual). Switching clears both sides so
                                stale state doesn't leak. */}
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
                                className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2"
                            >
                                <span
                                    aria-hidden
                                    className={cn(
                                        "relative inline-block h-5 w-9 rounded-full transition-colors",
                                        contactsMode ? "bg-brand" : "bg-wb-ntrl-4",
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "absolute top-0.5 inline-block size-4 rounded-full bg-white shadow-wb-btn transition-all",
                                            contactsMode ? "left-4.5" : "left-0.5",
                                        )}
                                    />
                                </span>
                                <span className="text-wb-13 font-medium text-wb-ink">
                                    {contactsMode
                                        ? t("payment.card.new_receipt.toggle.contacts")
                                        : t("payment.card.new_receipt.toggle.manual")}
                                </span>
                            </button>
                        </div>
                    </Field>

                    {/* Tax ID — two modes:
                        - Contacts mode: read-only echo of the picked
                          contact's TRCO_TAX_ID (mirrors legacy
                          `prch_0011_001.ts:417` disable behaviour).
                        - Manual mode: editable text input — the user
                          types the tax id directly (mirrors legacy
                          `prch_0011_001.ts:395` enable on Manual). */}
                    <Field label={t("payment.card.new_receipt.tax_id")}>
                        {contactsMode ? (
                            <input
                                type="text"
                                value={effectiveTaxId}
                                placeholder={t("payment.card.new_receipt.tax_id_placeholder")}
                                className="h-9 w-full rounded-md border border-wb-ntrl-4 bg-wb-bg-card px-3 text-wb-13 font-normal text-wb-ntrl-6"
                                readOnly
                            />
                        ) : (
                            <input
                                type="text"
                                value={manualTaxId}
                                onChange={(e) => setManualTaxId(e.target.value)}
                                placeholder={t("payment.card.new_receipt.tax_id_placeholder")}
                                className="h-9 w-full rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-normal text-wb-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
                            />
                        )}
                    </Field>

                    {/* Amount */}
                    <Field label={t("payment.card.new_receipt.amount")} required>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                            placeholder="0.00"
                            className="h-9 w-full rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-normal text-wb-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
                        />
                    </Field>

                    {/* Purpose — searchable dropdown backed by
                        USAG_INFM (USAG_GRP_CD='6'). Mirrors legacy
                        `prch_0011_001.ts:91`. */}
                    <Field label={t("payment.card.new_receipt.purpose")}>
                        <PurposePicker
                            value={pickedPurpose}
                            onPick={setPickedPurpose}
                            placeholder={t("payment.card.new_receipt.purpose_placeholder")}
                        />
                    </Field>

                    {/* Description */}
                    <Field label={t("payment.card.new_receipt.description")}>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t("payment.card.new_receipt.description_placeholder")}
                            className="h-9 w-full rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-normal text-wb-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
                        />
                    </Field>

                    {/* Payment Method */}
                    <Field label={t("payment.card.new_receipt.payment_method")}>
                        <div className="relative">
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="h-9 w-full cursor-pointer appearance-none rounded-md border border-wb-ntrl-4 bg-white px-3 pr-9 text-wb-13 font-normal text-wb-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
                            >
                                <option value="">{t("payment.card.new_receipt.payment_method_none")}</option>
                            </select>
                            <svg
                                aria-hidden
                                viewBox="0 0 16 16"
                                className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 text-wb-ntrl-6"
                                fill="currentColor"
                            >
                                <path d="M3 6l5 5 5-5z" />
                            </svg>
                        </div>
                    </Field>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-wb-table-border px-6 py-3">
                    <button
                        type="button"
                        className="flex h-8 cursor-pointer items-center gap-2 rounded-md bg-white px-3 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-black/3"
                    >
                        <Paperclip className="size-3.5" strokeWidth={1.6} aria-hidden />
                        {t("payment.card.new_receipt.attach")}
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-4 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-black/3"
                        >
                            {t("dialog.cancel")}
                        </button>
                        <button
                            type="button"
                            disabled={!canSave}
                            onClick={() => { if (canSave) void handleSave(); }}
                            className={cn(
                                "flex h-8 items-center justify-center rounded-md px-4 text-wb-13 font-medium",
                                canSave
                                    ? "cursor-pointer bg-brand text-white shadow-wb-brand-btn hover:bg-brand-hover"
                                    : "cursor-not-allowed bg-wb-ntrl-4 text-white",
                            )}
                        >
                            {saving ? t("common.loading") : t("dialog.save")}
                        </button>
                    </div>
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
        <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1 text-wb-13 font-medium text-wb-ink">
                {label}
                {required && <span aria-hidden className="text-wb-status-rejected-text">•</span>}
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

/* ── Contact picker — searchable dropdown over /settings/contacts ──
 *  Mirrors legacy `prch_0011_001.ts:90` `comboDataSearch 'TRCO'`. The
 *  user types in the chip to filter; clicking a row commits the pick
 *  and auto-fills the Tax ID field on the parent form. */

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
                    className="h-9 w-full rounded-md border border-wb-ntrl-4 bg-white px-3 pr-9 text-wb-13 font-normal text-wb-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
                />
                <Search
                    aria-hidden
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-wb-ntrl-6"
                    strokeWidth={1.6}
                />
            </div>
            {open && (
                <ul
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 right-0 top-10 z-50 max-h-60 overflow-y-auto rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
                >
                    {state.loading && rows.length === 0 && (
                        <li className="px-3 py-2 text-wb-13 text-wb-muted">
                            {t("common.loading")}
                        </li>
                    )}
                    {!state.loading && rows.length === 0 && (
                        <li className="px-3 py-2 text-wb-13 text-wb-muted">
                            {t("payment.card.new_receipt.no_contacts")}
                        </li>
                    )}
                    {rows.map((r) => {
                        const isSel = value?.trcoKey === r.trco_key;
                        return (
                            <li key={r.trco_key}>
                                <button
                                    type="button"
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
                                        "flex w-full cursor-pointer items-center gap-2 border-b border-wb-table-border px-3 py-2 text-left last:border-b-0 hover:bg-neutral-50",
                                        isSel && "bg-brand-soft",
                                    )}
                                >
                                    <span className="flex size-4 shrink-0 items-center justify-center">
                                        {isSel && (
                                            <Check className="size-4 text-brand" strokeWidth={2} aria-hidden />
                                        )}
                                    </span>
                                    <span className="flex min-w-0 flex-col">
                                        <span className="truncate text-wb-13 font-semibold text-wb-ink">
                                            {r.trco_cmnm}
                                        </span>
                                        {r.trco_tax_id && (
                                            <span className="truncate text-wb-11 font-normal text-wb-muted">
                                                MST: {r.trco_tax_id}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
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
    const all = state.data ?? [];
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return all;
        return all.filter((p) =>
            p.usag_nm.toLowerCase().includes(q)
            || p.use_usag_cd.toLowerCase().includes(q),
        );
    }, [all, query]);

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
                    className="h-9 w-full rounded-md border border-wb-ntrl-4 bg-white px-3 pr-9 text-wb-13 font-normal text-wb-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
                />
                <ChevronDown
                    aria-hidden
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-wb-ntrl-6"
                    strokeWidth={1.6}
                />
            </div>
            {open && (
                <ul
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 right-0 top-10 z-50 max-h-60 overflow-y-auto rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
                >
                    {state.loading && filtered.length === 0 && (
                        <li className="px-3 py-2 text-wb-13 text-wb-muted">
                            {t("common.loading")}
                        </li>
                    )}
                    {!state.loading && filtered.length === 0 && (
                        <li className="px-3 py-2 text-wb-13 text-wb-muted">
                            {t("payment.card.new_receipt.no_purposes")}
                        </li>
                    )}
                    {filtered.map((p) => {
                        const isSel = value?.use_usag_cd === p.use_usag_cd;
                        return (
                            <li key={p.use_usag_cd}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onPick(p);
                                        setQuery("");
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "flex w-full cursor-pointer items-center gap-2 border-b border-wb-table-border px-3 py-2 text-left last:border-b-0 hover:bg-neutral-50",
                                        isSel && "bg-brand-soft",
                                    )}
                                >
                                    <span className="flex size-4 shrink-0 items-center justify-center">
                                        {isSel && (
                                            <Check className="size-4 text-brand" strokeWidth={2} aria-hidden />
                                        )}
                                    </span>
                                    <span className="truncate text-wb-13 font-medium text-wb-ink">
                                        {p.usag_nm}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

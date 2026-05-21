"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    type DialogStackLevel,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { ScrapedCardDraft } from "./addCardFlowTypes";

export type SelectCardsDialogProps = {
    /** Institution display name — surfaces in aria-labels. Not rendered
     *  in the body anymore (legacy comm_0218_nxisas Step 3 shows no
     *  body-level bank logo). */
    bankName: string;
    /** Scraped card rows the user reviews + optionally edits — sourced
     *  from the NXISAS CARD_INFO scrape that just completed. */
    cards:    readonly ScrapedCardDraft[];
    /** Previous button — closes this popup and returns to Login ID/PW. */
    onBack:   () => void;
    /** Save handler — receives the edited card list as a whole (no
     *  selection: every row registers). Backend dedupes on
     *  {@code (BIZ_KEY, BANK_CD, CARD_NO)}. */
    onSave?:  (rows: ScrapedCardDraft[]) => void;
    /** Optional override — force Save into its disabled visual state
     *  regardless of state (e.g. while a save call is in flight). */
    saveDisabled?: boolean;
    /** Position in the modal stack. Defaults to `4` (Card Management
     *  modal L1 → Manage Cards L2 → Select Bank L3 → Login L3 → this
     *  L4) per CLAUDE.md §"Modal stacking convention". */
    stackLevel?: DialogStackLevel;
};

/**
 * Card Management &gt; Add Card &mdash; Step 3 popup: "Confirming your
 * card company registration information." Mirrors legacy
 * {@code comm_0218_nxisas_view.jsp:158-218} (the
 * {@code ks-confirm-card-registration} layer popup) at the visual
 * fidelity of the live JEX system (image 2 in the design handoff).
 *
 * <h2>UX contract</h2>
 *
 * <ul>
 *   <li><b>No checkbox column.</b> Every visible row registers on Save —
 *       the user can't deselect individual cards. The user clicks
 *       Previous to drop the entire scrape result and re-authenticate
 *       if they don't want any of them.</li>
 *   <li><b>Editable Card Holder Name.</b> Pencil icon next to the
 *       holder-name text toggles the cell into an inline input
 *       (Enter to commit, Esc to revert, onBlur to commit). Default
 *       value comes from the parent state machine — when the scrape
 *       returned no {@code holderName}, the parent seeds the field with
 *       "{bankShortName} {last4OfCardNum}" (e.g. "Woori 5559") so the
 *       user has a sensible draft to keep or rename.</li>
 *   <li><b>Card Type</b> is the localised label
 *       ("Credit card" / "Debit card") from the parent's
 *       {@code labelForCardType} — never the full scraped product name.</li>
 *   <li><b>Footer is justify-between</b>: Previous on the left,
 *       Save on the right (legacy {@code btn-area w-100
 *       justify-content-between}).</li>
 * </ul>
 */
export default function SelectCardsDialog({
    bankName,
    cards,
    onBack,
    onSave,
    saveDisabled,
    stackLevel = 4,
}: SelectCardsDialogProps) {
    const { t } = useTranslation();

    /** Editable copy of the incoming card rows. Cloned once on mount —
     *  the parent unmounts this dialog whenever the popup-chain step
     *  changes (challenge resume, Previous, etc.), so a fresh mount
     *  with a fresh `cards` prop is React's natural reset path. The
     *  parent should pass `key={…}` if it ever needs to force a clone
     *  without remounting. */
    const [editableRows, setEditableRows] = useState<ScrapedCardDraft[]>(() =>
        cards.map((c) => ({ ...c })),
    );

    /** `id` of the row whose Card Holder Name cell is currently in
     *  inline-edit mode. `null` when no cell is being edited. */
    const [editingId, setEditingId] = useState<string | null>(null);

    const updateHolderName = (id: string, next: string) => {
        setEditableRows((prev) =>
            prev.map((row) => (row.id === id ? { ...row, cardHldrNm: next } : row)),
        );
    };

    const isSaveDisabled = saveDisabled === true || !onSave;

    const handleSave = () => {
        if (isSaveDisabled || !onSave) return;
        onSave(editableRows);
    };

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onBack();
            }}
        >
            <DialogContent
                stackLevel={stackLevel}
                aria-label={bankName}
                className="max-w-[920px] gap-0 rounded-2xl p-0"
            >
                <div className="flex flex-col gap-6 py-6">
                    {/* Header — title + subtitle, gap-1.5 per Figma. */}
                    <div className="flex flex-col items-start gap-1.5 px-6">
                        <DialogTitle asChild>
                            <h2 className="text-wb-16 font-semibold text-wb-dark">
                                {t("payment.card.management.add_card.confirm.title")}
                            </h2>
                        </DialogTitle>
                        <DialogDescription asChild>
                            <p className="text-wb-13 font-medium text-wb-dark/70">
                                {t("payment.card.management.add_card.confirm.subtitle")}
                            </p>
                        </DialogDescription>
                    </div>

                    {/* Body — scrollable card table. No bank logo per legacy
                       Step 3 (the bank identity already lives in the
                       prior Step 1 + Step 2 dialogs). */}
                    <div className="flex flex-col px-6">
                        <div className="custom-scrollbar-x w-full overflow-x-auto">
                            <table className="w-full min-w-[760px] border-collapse">
                                <colgroup>
                                    <col className="w-[320px]" />
                                    <col className="w-[260px]" />
                                    <col />
                                </colgroup>
                                <thead>
                                    <tr className="h-10 border-y border-wb-border-sidebar bg-wb-bg-card">
                                        <HeaderCell className="pl-4">
                                            {t("payment.card.management.add_card.confirm.col.card_holder")}
                                        </HeaderCell>
                                        <HeaderCell>
                                            {t("payment.card.management.add_card.confirm.col.card_number")}
                                        </HeaderCell>
                                        <HeaderCell className="pr-4">
                                            {t("payment.card.management.add_card.confirm.col.card_type")}
                                        </HeaderCell>
                                    </tr>
                                </thead>
                                <tbody>
                                    {editableRows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={3}
                                                className="px-4 py-6 text-center text-wb-13 font-medium text-wb-muted"
                                            >
                                                {t("payment.card.management.add_card.confirm.empty")}
                                            </td>
                                        </tr>
                                    ) : (
                                        editableRows.map((row) => (
                                            <tr
                                                key={row.id}
                                                className="h-[52px] border-b border-wb-border-sidebar bg-white"
                                            >
                                                <td className="pl-4 pr-2 align-middle">
                                                    {editingId === row.id ? (
                                                        <HolderNameInput
                                                            value={row.cardHldrNm}
                                                            onChange={(v) => updateHolderName(row.id, v)}
                                                            onCommit={() => setEditingId(null)}
                                                            onCancel={() => {
                                                                // Esc reverts to the value
                                                                // currently in state — that's
                                                                // already the latest commit
                                                                // before this edit started, so
                                                                // just close the editor.
                                                                setEditingId(null);
                                                            }}
                                                            ariaLabel={t(
                                                                "payment.card.management.add_card.confirm.col.card_holder",
                                                            )}
                                                        />
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="truncate text-wb-14 font-medium text-wb-dark"
                                                                title={row.cardHldrNm}
                                                            >
                                                                {row.cardHldrNm || "—"}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                aria-label={t(
                                                                    "payment.card.management.add_card.confirm.edit_holder",
                                                                )}
                                                                onClick={() => setEditingId(row.id)}
                                                                className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-wb-ntrl-4 bg-white text-wb-ntrl-8 shadow-wb-btn hover:bg-black/[0.03]"
                                                            >
                                                                <Pencil className="size-3.5" strokeWidth={1.8} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="pr-4 align-middle">
                                                    <span className="text-wb-14 font-medium text-wb-dark">
                                                        {row.cardNo}
                                                    </span>
                                                </td>
                                                <td className="pr-4 align-middle">
                                                    <span className="text-wb-14 font-medium text-wb-dark">
                                                        {row.cardTypeLabel || row.cardTypeCd || "—"}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Footer — Previous (left) + Save (right), per legacy
                       `btn-area w-100 justify-content-between`. */}
                    <div className="flex items-center justify-between px-6">
                        <button
                            type="button"
                            onClick={onBack}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("payment.card.management.add_card.previous")}
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
            className={`py-3 text-left text-wb-13 font-semibold leading-normal text-wb-dark whitespace-nowrap ${className}`}
        >
            {children}
        </th>
    );
}

function HolderNameInput({
    value,
    onChange,
    onCommit,
    onCancel,
    ariaLabel,
}: {
    value:     string;
    onChange:  (next: string) => void;
    onCommit:  () => void;
    onCancel:  () => void;
    ariaLabel: string;
}) {
    const id = useId();
    const ref = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
        ref.current?.focus();
        ref.current?.select();
    }, []);
    return (
        <div className="flex h-8 max-w-[280px] items-center rounded-md bg-white px-2 shadow-wb-outline">
            <input
                id={id}
                ref={ref}
                aria-label={ariaLabel}
                value={value}
                maxLength={50}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        onCommit();
                    } else if (e.key === "Escape") {
                        e.preventDefault();
                        onCancel();
                    }
                }}
                onBlur={onCommit}
                spellCheck={false}
                className={cn(
                    "min-w-0 flex-1 appearance-none border-0 bg-transparent text-wb-14 font-medium leading-4 text-wb-dark outline-none ring-0 placeholder:text-wb-ntrl-5",
                    "focus:border-0 focus:outline-none focus:ring-0",
                )}
            />
        </div>
    );
}

"use client";

import { useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import ToggleSwitch from "@/components/settings/ToggleSwitch";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type EditFirmBankingDetailsDialogProps = {
    onClose: () => void;
    /**
     * Modal-stack depth. Defaults to `2` (opened from a row's kebab on
     * top of the L1 Settings shell). Pass `3` when this dialog opens
     * on top of the L2 Firm Banking Details modal so the overlay
     * z-index ramp lines up correctly with the convention in
     * components/ui/dialog.tsx.
     */
    stackLevel?: 2 | 3;
};

/**
 * Edit Firm Banking Details dialog — Figma 5936:24675.
 *
 * Opens from a row's kebab `⋮` → Edit on the Firm Banking Settings
 * panel. Stacks on top of the Settings modal (stackLevel 2).
 *
 * Static UI: every field renders as a read-only key/value row;
 * Save / Cancel both close the dialog (no PATCH yet). The "Firm
 * Banking Status" toggle flips locally so the on-screen state
 * mirrors a real interaction without persisting.
 *
 * Layout per Figma 5936:24675:
 *   - Container: `rounded-2xl px-4 py-6 gap-6` — same compact rhythm
 *     as the New Firm Banking add dialog.
 *   - Body: 5 rows stacked vertically; each row is a flex of two
 *     columns — labels (left, fixed 191 px wide) + values (right,
 *     flex-1) — with a single `border-b` painting the divider line
 *     across both columns.
 *   - Row height: 44 px aligned (label py-3 = 24 px chrome + 20 px
 *     leading; value py-1.5 = 12 px chrome + 32 px content matches).
 *   - Title: `text-wb-16 font-semibold text-wb-dark` matching the
 *     New dialog. NOT the standard `<DialogHeader>` 18 px because
 *     Figma deliberately picks a smaller compact header for both
 *     dialogs in this flow.
 *   - Footer: text-only Cancel (no bg, no shadow) + brand-pill Save.
 *     Matches Figma 5936:24738 exactly — Cancel is intentionally
 *     plainer than the New dialog's outlined cancel because this
 *     is an edit-record flow where Save is the dominant action.
 */
export default function EditFirmBankingDetailsDialog({
    onClose,
    stackLevel = 2,
}: EditFirmBankingDetailsDialogProps) {
    const { t } = useTranslation();

    // Static-UI: toggle flips locally so the on-screen status reads
    // the way a real interaction would. No persistence.
    const [active, setActive] = useState(true);

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                stackLevel={stackLevel}
                hideClose
                className="max-w-[500px] rounded-2xl p-0"
            >
                <div className="flex w-full flex-col gap-6 px-4 py-6">
                    <DialogTitle asChild>
                        <h2 className="text-wb-16 font-semibold leading-[18px] text-wb-dark">
                            {t(
                                "settings.firm_banking_settings.edit_firm_banking_details.title",
                            )}
                        </h2>
                    </DialogTitle>

                    <div className="flex flex-col">
                        <Row
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.bank_name",
                            )}
                            required
                        >
                            <ShinhanIcon className="size-4 shrink-0" />
                            <span className="text-wb-14 font-medium text-wb-ntrl-10">
                                SHINHAN VN
                            </span>
                        </Row>

                        <Row
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.partner_id",
                            )}
                            required
                        >
                            <span className="text-wb-14 font-medium text-wb-ntrl-10">
                                DNFEQWERDFA112013
                            </span>
                        </Row>

                        <Row
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.van_code",
                            )}
                            required
                        >
                            <span className="text-wb-14 font-medium text-wb-ntrl-10">
                                GV00000000002
                            </span>
                        </Row>

                        <Row
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.withdrawal_account",
                            )}
                            required
                        >
                            <span className="text-wb-14 font-medium text-wb-ntrl-10">
                                0001-00000569-14
                            </span>
                        </Row>

                        <Row
                            label={t(
                                "settings.firm_banking_settings.edit_firm_banking_details.firm_banking_status",
                            )}
                        >
                            <span
                                className={cn(
                                    "text-wb-14 font-medium",
                                    active
                                        ? "text-wb-status-approved-text"
                                        : "text-wb-ntrl-6",
                                )}
                            >
                                {t(
                                    active
                                        ? "settings.firm_banking_settings.status.active"
                                        : "settings.firm_banking_settings.status.inactive",
                                )}
                            </span>
                            <ToggleSwitch
                                checked={active}
                                onChange={setActive}
                                tone="brand"
                                ariaLabel={t(
                                    "settings.firm_banking_settings.edit_firm_banking_details.aria_status_toggle",
                                )}
                            />
                        </Row>
                    </div>

                    {/* Footer — text-only Cancel (no bg, no shadow per
                       Figma 5936:24739) + brand-pill Save (Figma
                       5936:24740 with the standard primary-button
                       shadow stack). */}
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-brand shadow-wb-btn hover:bg-brand-soft"
                        >
                            {t("common.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                        >
                            {t("common.save")}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function Row({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-[44px] items-stretch border-b border-wb-ntrl-3">
            <div className="flex w-[191px] shrink-0 items-start gap-0.5 py-3">
                <span className="text-wb-14 font-medium text-wb-ntrl-8">
                    {label}
                </span>
                {required && (
                    <span
                        aria-hidden
                        className="text-wb-14 font-medium text-wb-red-07"
                    >
                        *
                    </span>
                )}
            </div>
            <div className="flex flex-1 items-center gap-2 py-1.5">
                {children}
            </div>
        </div>
    );
}

/**
 * Compact Shinhan brand mark — 16 px circle scaled from the 36 px
 * mark used in <BankLogo>. Inlined here so the value cell keeps its
 * own size without extending <BankLogo>'s public surface; the artwork
 * (navy disc + teal swoosh + lighter mid-blue accent) stays in sync
 * with the linked-account list.
 */
function ShinhanIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 36 36"
            className={cn("block overflow-hidden rounded-full", className)}
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <defs>
                <clipPath id="edit-firm-banking-shinhan-clip">
                    <circle cx="18" cy="18" r="18" />
                </clipPath>
            </defs>
            <g clipPath="url(#edit-firm-banking-shinhan-clip)">
                <rect width="36" height="36" fill="#0E3A6B" />
                <path
                    d="M-2 24 Q18 4 38 24 L38 32 Q18 14 -2 32 Z"
                    fill="#00A5C5"
                />
                <path
                    d="M-2 20 Q18 6 38 20 L38 14 Q18 0 -2 14 Z"
                    fill="#5DADE2"
                    opacity="0.55"
                />
            </g>
        </svg>
    );
}

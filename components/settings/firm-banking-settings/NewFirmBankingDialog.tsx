"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type NewFirmBankingDialogProps = {
    onClose: () => void;
};

/**
 * "New Firm Banking" dialog — Figma 5936:24436.
 *
 * Opens from the "+ Add" button on the Firm Banking Settings panel
 * and stacks on top of the Settings modal (stackLevel 2). Static UI
 * only — Cancel closes; Next stays disabled until the validation +
 * backend wiring lands. The shared <Dialog> primitive provides
 * portal / focus / ESC chrome; the inner shape mirrors Figma's
 * compact 16/24 padding rhythm rather than the standard
 * <DialogHeader>/<DialogBody>/<DialogFooter> stack — see
 * EditBankAccountDialog for the same precedent.
 *
 * The Edit flow uses a sibling component
 * (<EditFirmBankingDetailsDialog>) that mirrors Figma 5936:24675's
 * read-only key/value layout and its own footer, rather than
 * sharing this component.
 */
export default function NewFirmBankingDialog({
    onClose,
}: NewFirmBankingDialogProps) {
    const { t } = useTranslation();

    const [partnerId, setPartnerId] = useState("");
    const [vanCode, setVanCode] = useState("");

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
                className="max-w-[400px] rounded-2xl p-0"
            >
                <div className="flex w-full flex-col gap-6 px-4 py-6">
                    <DialogTitle asChild>
                        <h2 className="text-wb-16 font-semibold leading-[18px] text-wb-dark">
                            {t("settings.firm_banking_settings.new_firm_banking.title")}
                        </h2>
                    </DialogTitle>

                    <div className="flex flex-col gap-4">
                        <Field
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.bank_name",
                            )}
                        >
                            <DropdownChip>
                                <WooriIcon className="size-4 shrink-0" />
                                <span className="flex-1 truncate">Woori Bank</span>
                            </DropdownChip>
                        </Field>

                        <Field
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.partner_id",
                            )}
                        >
                            <TextInput
                                value={partnerId}
                                onChange={setPartnerId}
                                placeholder={t(
                                    "settings.firm_banking_settings.new_firm_banking.partner_id_placeholder",
                                )}
                                ariaLabel={t(
                                    "settings.firm_banking_settings.new_firm_banking.partner_id",
                                )}
                            />
                        </Field>

                        <Field
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.van_code",
                            )}
                        >
                            <TextInput
                                value={vanCode}
                                onChange={setVanCode}
                                placeholder={t(
                                    "settings.firm_banking_settings.new_firm_banking.van_code_placeholder",
                                )}
                                ariaLabel={t(
                                    "settings.firm_banking_settings.new_firm_banking.van_code",
                                )}
                            />
                        </Field>

                        <Field
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.withdrawal_account",
                            )}
                        >
                            <DropdownChip>
                                <span className="flex-1 truncate">
                                    00003-3049523-120 (VND)
                                </span>
                            </DropdownChip>
                        </Field>
                    </div>

                    {/* Cancel + Next. Next is intentionally disabled in
                       the static UI — validation + submit wiring lands
                       with the backend. */}
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("common.cancel")}
                        </button>
                        <button
                            type="button"
                            disabled
                            aria-disabled
                            className="flex h-8 cursor-not-allowed items-center justify-center rounded-md bg-wb-ntrl-4 px-3 text-wb-14-tight font-medium text-white shadow-wb-outline"
                        >
                            {t("settings.firm_banking_settings.new_firm_banking.next")}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-start gap-0.5">
                <span className="text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                    {label}
                </span>
                <span
                    aria-hidden
                    className="text-wb-14 font-medium leading-4 text-wb-status-rejected-text"
                >
                    *
                </span>
            </div>
            {children}
        </div>
    );
}

function DropdownChip({ children }: { children: React.ReactNode }) {
    return (
        <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-md bg-white p-2 text-left text-wb-14 font-medium leading-4 text-wb-ntrl-8 shadow-wb-btn hover:bg-black/[0.02]"
        >
            {children}
            <ChevronDown
                className="size-4 shrink-0 text-wb-ntrl-8"
                strokeWidth={2}
                aria-hidden
            />
        </button>
    );
}

type TextInputProps = {
    value: string;
    onChange: (next: string) => void;
    placeholder: string;
    ariaLabel: string;
};

function TextInput({ value, onChange, placeholder, ariaLabel }: TextInputProps) {
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className={cn(
                "h-8 w-full rounded-md bg-white px-2 text-wb-14 font-medium leading-4 text-wb-ntrl-8 placeholder:text-wb-ntrl-5",
                "shadow-wb-outline outline-none",
                "focus:shadow-[0px_0px_0px_1px_var(--color-brand)]",
            )}
        />
    );
}

/**
 * Compact Woori brand mark — 16 px circle scaled from the 36 px mark
 * used in <BankLogo>. Inlined here so the dropdown row keeps its own
 * size without extending <BankLogo>'s public surface; the artwork
 * (navy circle + white wave + cream lower band) stays in sync with
 * the linked-account list.
 */
function WooriIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 36 36"
            className={cn("block overflow-hidden rounded-full", className)}
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <defs>
                <clipPath id="new-firm-banking-woori-clip">
                    <circle cx="18" cy="18" r="18" />
                </clipPath>
            </defs>
            <g clipPath="url(#new-firm-banking-woori-clip)">
                <rect width="36" height="36" fill="#0046A8" />
                <path
                    d="M-2 22 Q9 13 18 22 T38 22 L38 38 L-2 38 Z"
                    fill="#FFFFFF"
                />
                <path
                    d="M-2 26 Q9 19 18 26 T38 26 L38 38 L-2 38 Z"
                    fill="#F5E6C8"
                />
            </g>
        </svg>
    );
}

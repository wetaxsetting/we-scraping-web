"use client";

import { useMemo, useState } from "react";
import { ArrowDown } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { OwnAccountRow } from "./types";

/** Option shape consumed by the inline From/To pickers. Derived at the
 *  call site from the real {@link OwnAccountRow} list returned by
 *  `/api/v1/banking/transfers/own-accounts`. */
type OwnAccountOption = {
    value: string;
    label: string;
    /** Balance chip shown next to the account name in the picker. */
    balance: string;
};

type TransferDialogProps = {
    open: boolean;
    /** Real account list — the same rows the underlying page renders. The
     *  dialog derives picker options from this list so the From / To
     *  choices match what the user sees on the page exactly. */
    accounts: OwnAccountRow[];
    /** Account the user clicked Transfer from — preselected as From account. */
    fromAccountId?: string;
    onClose: () => void;
};

function toOption(row: OwnAccountRow): OwnAccountOption {
    return {
        value: row.id,
        label: `${row.bankName} • ${row.accountNo} (${row.currency})`,
        balance: row.available,
    };
}

/**
 * Transfer form rendered as a shadcn Dialog. Opened from the
 * Transfer Own Accounts list when a row's Transfer button is clicked. The
 * "From account" is preselected from the clicked row; the user picks a "To
 * account", enters amount + memo, then the confirmation/success flow runs
 * through the global `useDialog()` system modal.
 */
export default function TransferDialog({
    open,
    accounts,
    fromAccountId,
    onClose,
}: TransferDialogProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    const options = useMemo<OwnAccountOption[]>(
        () => accounts.map(toOption),
        [accounts],
    );

    // Initial selections derived from props — the parent remounts this
    // dialog by passing a fresh `fromAccountId`, so lazy `useState` init
    // is sufficient to seed From / To without an effect.
    const [from, setFrom] = useState<OwnAccountOption | null>(
        () => options.find((o) => o.value === fromAccountId) ?? options[0] ?? null,
    );
    const [to, setTo] = useState<OwnAccountOption | null>(() => {
        const initialFrom =
            options.find((o) => o.value === fromAccountId) ?? options[0] ?? null;
        if (!initialFrom) return null;
        return options.find((o) => o.value !== initialFrom.value) ?? null;
    });
    const [amount, setAmount] = useState("");
    const [memo, setMemo] = useState("");

    const handleReview = () => {
        if (!from || !to) return;
        if (!amount.trim()) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: t("transfer_own.error.amount_required"),
            });
            return;
        }
        if (from.value === to.value) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: t("transfer_own.error.same_account"),
            });
            return;
        }
        dialog.open({
            type: "confirmation",
            title: t("dialog.confirmation"),
            description: t("transfer_own.confirm_description", { amount }),
            confirmText: t("dialog.yes"),
            cancelText: t("dialog.no"),
            onConfirm: () => {
                onClose();
                dialog.open({
                    type: "success",
                    title: t("dialog.success"),
                    description: t("transfer_own.success_description"),
                });
            },
        });
    };

    if (!from || !to) return null;

    return (
        <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
            <DialogContent
                // Figma frame has title + account list only, no description
                // — opt out of Radix's a11y description requirement.
                aria-describedby={undefined}
                className="max-w-[540px]"
            >
                <DialogHeader>
                    <DialogTitle>{t("transfer_own.title")}</DialogTitle>
                </DialogHeader>

                <DialogBody className="flex flex-col gap-4">
                    <AccountSelect
                        label={t("transfer_own.from_label")}
                        value={from}
                        options={options}
                        onChange={setFrom}
                    />

                    <div className="flex justify-center">
                        <div className="flex size-8 items-center justify-center rounded-full border border-wb-border-sidebar bg-white text-wb-ink shadow-wb-btn">
                            <ArrowDown className="size-4" strokeWidth={2} />
                        </div>
                    </div>

                    <AccountSelect
                        label={t("transfer_own.to_label")}
                        value={to}
                        options={options.filter(
                            (o) => o.value !== from.value,
                        )}
                        onChange={setTo}
                    />

                    <div className="flex flex-col gap-1.5">
                        <Label
                            htmlFor="dlg-transfer-amount"
                            className="text-wb-13 font-medium text-wb-ink"
                        >
                            {t("transfer_own.amount_label")}
                        </Label>
                        <Input
                            id="dlg-transfer-amount"
                            inputMode="decimal"
                            placeholder={t("transfer_own.amount_placeholder")}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="h-10 text-wb-16 font-medium"
                        />
                        <span className="text-wb-12 font-normal text-wb-muted">
                            {t("transfer_own.available_balance", {
                                balance: from.balance,
                            })}
                        </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label
                            htmlFor="dlg-transfer-memo"
                            className="text-wb-13 font-medium text-wb-ink"
                        >
                            {t("transfer_own.memo_label")}
                        </Label>
                        <Input
                            id="dlg-transfer-memo"
                            placeholder={t("transfer_own.memo_placeholder")}
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            className="h-9"
                        />
                    </div>
                </DialogBody>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-9 px-4 text-wb-14"
                        onClick={onClose}
                    >
                        {t("transfer_own.reset")}
                    </Button>
                    <Button
                        type="button"
                        className="h-9 px-4 text-wb-14"
                        onClick={handleReview}
                    >
                        {t("transfer_own.review")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AccountSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: OwnAccountOption;
    options: OwnAccountOption[];
    onChange: (next: OwnAccountOption) => void;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-wb-13 font-medium text-wb-ink">{label}</span>
            <div className="custom-scrollbar-y max-h-[160px] overflow-y-auto rounded-md border border-wb-border-sidebar bg-white shadow-wb-card">
                <div className="flex flex-col divide-y divide-wb-border-sidebar">
                    {options.map((option) => {
                        const active = option.value === value.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => onChange(option)}
                                className={cn(
                                    "flex cursor-pointer items-center justify-between gap-4 px-3 py-2.5 text-left transition-colors",
                                    active
                                        ? "bg-brand-softer"
                                        : "hover:bg-wb-bg-sidebar",
                                )}
                                aria-pressed={active}
                            >
                                <span className="truncate text-wb-13 font-medium text-wb-ink">
                                    {option.label}
                                </span>
                                <span
                                    className={cn(
                                        "shrink-0 text-wb-13 font-medium",
                                        active ? "text-brand" : "text-wb-muted",
                                    )}
                                >
                                    {option.balance}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

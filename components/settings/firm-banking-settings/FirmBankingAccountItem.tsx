"use client";

import { MoreVertical } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import BankLogo from "./BankLogo";
import type { FirmBankingLinkedAccount } from "./types";

type FirmBankingAccountItemProps = {
    account: FirmBankingLinkedAccount;
    /** Fired when the user clicks the row body (anywhere except the
     *  kebab) — opens the Firm Banking Details modal. The kebab calls
     *  `e.stopPropagation()` so its own click never bubbles into this
     *  handler. */
    onClick?: (account: FirmBankingLinkedAccount) => void;
    /** Fired when the user clicks the kebab `⋮`. The parent uses the
     *  trigger's bounding rect to position the row-action menu via
     *  portal so it can escape the panel's `overflow-hidden`. */
    onMore?: (account: FirmBankingLinkedAccount, rect: DOMRect) => void;
};

/**
 * Single linked-account row — Figma 134:17104.
 *
 * Layout (desktop / laptop):
 *   [logo]  [bank name + account no.]   [status + last-updated]   [⋮ kebab]
 *
 * On narrow viewports the right-side status block wraps under the bank
 * label so the kebab stays reachable without horizontal scroll. Status
 * colour comes from the WB365 ramps (green-03 / red-04) — never inline a
 * custom hex.
 */
export default function FirmBankingAccountItem({
    account,
    onClick,
    onMore,
}: FirmBankingAccountItemProps) {
    const { t } = useTranslation();
    const statusKey =
        account.status === "active"
            ? "settings.firm_banking_settings.status.active"
            : "settings.firm_banking_settings.status.inactive";

    const handleClick = () => onClick?.(account);
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick(account);
        }
    };

    const interactiveProps = onClick
        ? {
              role: "button" as const,
              tabIndex: 0,
              onClick: handleClick,
              onKeyDown: handleKeyDown,
              "aria-label": t(
                  "settings.firm_banking_settings.firm_banking_details.aria_open",
                  { bank: account.bankName },
              ),
          }
        : {};

    return (
        <div
            {...interactiveProps}
            className={cn(
                "flex items-center gap-3 bg-wb-bg-sidebar px-4 py-3 sm:gap-4",
                onClick &&
                    "cursor-pointer hover:bg-black/[0.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
            )}
        >
            <BankLogo
                bank={account.bank}
                bankName={account.bankName}
                bankCd={account.outBankCd}
            />

            {/* Bank label column — fills available width on small screens. */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate text-wb-13 font-medium text-wb-dark">
                    {account.bankName}
                </p>
                <p className="truncate text-wb-13 font-medium text-wb-ntrl-6">
                    {account.accountNumber}
                </p>
            </div>

            {/* Status column — right-aligned, hidden of meta on extra-small
               screens so the row still fits. `hidden sm:flex` keeps the
               status visible from 640 px upward; below that the text-only
               kebab affordance remains. */}
            <div className="hidden min-w-0 flex-1 flex-col items-end gap-1 sm:flex">
                <p
                    className={cn(
                        "text-wb-14 font-medium",
                        account.status === "active"
                            ? "text-wb-status-approved-text"
                            : "text-wb-status-rejected-text",
                    )}
                >
                    {t(statusKey)}
                </p>
                <p className="truncate text-wb-13 font-medium text-wb-ntrl-6">
                    {t("settings.firm_banking_settings.last_updated", {
                        value: account.lastUpdated,
                    })}
                </p>
            </div>

            <button
                type="button"
                aria-label={t("settings.firm_banking_settings.more_actions", {
                    bank: account.bankName,
                })}
                onClick={(e) => {
                    // Prevent the row's click handler from also firing.
                    // The kebab opens the More menu; the row body opens
                    // the Details dialog — they are mutually exclusive.
                    e.stopPropagation();
                    onMore?.(account, e.currentTarget.getBoundingClientRect());
                }}
                className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md bg-white text-wb-ink shadow-wb-btn hover:bg-black/5"
            >
                <MoreVertical className="size-3.5" strokeWidth={2} />
            </button>
        </div>
    );
}

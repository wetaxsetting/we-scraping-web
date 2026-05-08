"use client";

import { useTranslation } from "@/lib/i18n";

import FirmBankingAccountItem from "./FirmBankingAccountItem";
import type { FirmBankingLinkedAccount } from "./types";

type FirmBankingLinkedAccountsProps = {
    accounts: FirmBankingLinkedAccount[];
    onItemClick?: (account: FirmBankingLinkedAccount) => void;
    onMore?: (account: FirmBankingLinkedAccount, rect: DOMRect) => void;
};

/**
 * Linked Accounts section — Figma 134:17103.
 *
 * Section label sits above one rounded container that holds every linked
 * account stacked with a 2 px gap. The clip-rounded wrapper turns those
 * gaps into hairline dividers, matching the Automation Settings shape so
 * the two panels read as siblings.
 */
export default function FirmBankingLinkedAccounts({
    accounts,
    onItemClick,
    onMore,
}: FirmBankingLinkedAccountsProps) {
    const { t } = useTranslation();
    return (
        <section className="flex flex-col gap-1">
            <h4 className="px-2.5 py-1.5 text-wb-13 font-medium text-wb-ntrl-6">
                {t("settings.firm_banking_settings.section.linked_accounts")}
            </h4>
            <div className="flex flex-col gap-[2px] overflow-clip rounded-lg">
                {accounts.map((account) => (
                    <FirmBankingAccountItem
                        key={account.id}
                        account={account}
                        onClick={onItemClick}
                        onMore={onMore}
                    />
                ))}
            </div>
        </section>
    );
}

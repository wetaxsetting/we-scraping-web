"use client";

import ToggleSwitch from "@/components/settings/ToggleSwitch";
import { useTranslation } from "@/lib/i18n";

import type { FirmBankingAutomationKey, FirmBankingAutomationSetting } from "./types";

type FirmBankingAutomationSettingsProps = {
    settings: FirmBankingAutomationSetting[];
    onToggle: (key: FirmBankingAutomationKey, next: boolean) => void;
};

/**
 * Automation Settings section — Figma 134:17083.
 *
 * Two stacked rows inside one rounded container, each with a brand-blue
 * toggle on the left and the rule label to its right. Rows share the
 * neutral-02 row background and a 2 px gap that the parent `rounded-[8px]
 * overflow-clip` clips into a hairline divider.
 */
export default function FirmBankingAutomationSettings({
    settings,
    onToggle,
}: FirmBankingAutomationSettingsProps) {
    const { t } = useTranslation();
    return (
        <section className="flex flex-col gap-1">
            <h4 className="px-2.5 py-1.5 text-wb-13 font-medium text-wb-ntrl-6">
                {t("settings.firm_banking_settings.section.automation")}
            </h4>
            <div className="flex flex-col gap-[2px] overflow-clip rounded-lg">
                {settings.map((setting) => (
                    <div
                        key={setting.key}
                        className="flex min-h-12 items-center gap-2 bg-wb-bg-sidebar px-4 py-3"
                    >
                        <ToggleSwitch
                            tone="brand"
                            checked={setting.enabled}
                            onChange={(next) => onToggle(setting.key, next)}
                            ariaLabel={t(setting.labelKey)}
                        />
                        <span className="text-wb-13 font-medium text-wb-ntrl-8">
                            {t(setting.labelKey)}
                        </span>
                    </div>
                ))}
            </div>
        </section>
    );
}

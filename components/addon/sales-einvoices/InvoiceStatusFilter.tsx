"use client";

import FilterDropdown from "@/components/shared/FilterDropdown";
import { useTranslation } from "@/lib/i18n";

/**
 * Invoice Status dropdown trigger — thin wrapper around the shared
 * `FilterDropdown` that fixes the width to the status-filter token used by
 * this page so every feature page gets identical chrome (32px height,
 * shadow-wb-btn, 14-tight typography).
 */

type InvoiceStatusFilterProps = {
    value: string;
    onClick?: () => void;
    className?: string;
};

export default function InvoiceStatusFilter({
    value,
    onClick,
    className,
}: InvoiceStatusFilterProps) {
    const { t } = useTranslation();
    return (
        <FilterDropdown
            value={value}
            onClick={onClick}
            ariaLabel={t("sales_einvoices.filter.invoice_status")}
            className={className ?? "w-[var(--w-wb-si-status-filter)]"}
        />
    );
}

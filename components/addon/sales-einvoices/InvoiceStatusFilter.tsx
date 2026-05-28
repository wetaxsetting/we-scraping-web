"use client";

import { useEffect, useRef, useState } from "react";

import FilterDropdown from "@/components/shared/FilterDropdown";
import {
    INVOICE_STATUS_FILTER_OPTIONS,
    type InvoiceStatusFilterKey,
} from "@/lib/api/einvoiceStatus";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type InvoiceStatusFilterProps = {
    /** Currently selected option key (null treated as `all`). */
    value: InvoiceStatusFilterKey;
    /** i18n prefix for label resolution — `sales_einvoices` or
     *  `expenses_einvoices`. */
    translationPrefix: "sales_einvoices" | "expenses_einvoices";
    onChange: (next: InvoiceStatusFilterKey) => void;
    className?: string;
};

/**
 * Invoice Status dropdown — wires the trigger to a click-to-open popover
 * with the 5 logical-status options surfaced from
 * {@link INVOICE_STATUS_FILTER_OPTIONS}.
 *
 * <p>Frontend MR B — selection change cascades up through {@code onChange}
 * to the client wrapper which both (a) sends the canonical English form
 * on the wire as {@code ?status=…} (forward-compat with the IR-4 backend
 * filter) and (b) post-filters the current page slice via the regex
 * helper (visible-feedback stop-gap until the backend filter lands).
 */
export default function InvoiceStatusFilter({
    value,
    translationPrefix,
    onChange,
    className,
}: InvoiceStatusFilterProps) {
    const { t } = useTranslation();
    const k = (suffix: string) => `${translationPrefix}.${suffix}`;
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Click-outside dismiss — same pattern as `BankFilterPopover`.
    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);

    const labelFor = (key: InvoiceStatusFilterKey) => t(k(`filter.status.${key}`));

    return (
        <div
            ref={ref}
            className={cn(
                "relative w-[var(--w-wb-si-status-filter)]",
                className,
            )}
        >
            <FilterDropdown
                value={labelFor(value)}
                onClick={() => setOpen((prev) => !prev)}
                ariaLabel={t(k("filter.invoice_status"))}
                className="w-full"
            />
            {open && (
                <ul
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 top-full z-20 mt-1 max-h-64 w-full overflow-y-auto overflow-x-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
                >
                    {INVOICE_STATUS_FILTER_OPTIONS.map((opt) => (
                        <li
                            key={opt.key}
                            role="option"
                            aria-selected={value === opt.key}
                            onClick={() => {
                                onChange(opt.key);
                                setOpen(false);
                            }}
                            className={cn(
                                "cursor-pointer truncate whitespace-nowrap px-2 py-1.5 text-wb-14-tight font-medium text-wb-ntrl-8 hover:bg-wb-bg-active",
                                value === opt.key && "bg-wb-bg-active",
                            )}
                        >
                            {labelFor(opt.key)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

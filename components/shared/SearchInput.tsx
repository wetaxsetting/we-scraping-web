"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type SearchInputProps = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
};

/**
 * Search field with the leading Search glyph — reused on every filter row that
 * has a keyword search. The container is 230px wide on md+ (matching the Figma
 * spec for all data-table pages) and full-width below that.
 */
export default function SearchInput({
    value,
    onChange,
    placeholder,
    className,
}: SearchInputProps) {
    const { t } = useTranslation();
    const ph = placeholder ?? t("common.search");
    return (
        <div className={cn("h-[var(--h-wb-filter-btn)] w-full md:w-[var(--w-wb-search)]", className)}>
            <div className="relative h-full">
                <Search
                    className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-wb-ntrl-5"
                    strokeWidth={1.8}
                />
                <Input
                    type="text"
                    placeholder={ph}
                    aria-label={ph}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-full rounded-md pl-8 pr-2 text-wb-14-tight font-medium placeholder:text-wb-ntrl-5"
                />
            </div>
        </div>
    );
}

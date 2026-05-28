"use client";

import SearchInput from "@/components/shared/SearchInput";
import { useTranslation } from "@/lib/i18n";

/*
 * Search bar — Figma node 12346:43832. Reuses the shared <SearchInput> (the
 * sanctioned project search field) widened to fill the popup. UI only for now;
 * the value is controlled by the parent so real search can hang off `onChange`
 * once the API lands.
 */
type NotificationSearchProps = {
    value: string;
    onChange: (value: string) => void;
};

export default function NotificationSearch({ value, onChange }: NotificationSearchProps) {
    const { t } = useTranslation();
    return (
        <SearchInput
            value={value}
            onChange={onChange}
            placeholder={t("notification.search_placeholder")}
            className="md:w-full"
        />
    );
}

"use client";

import { useMemo } from "react";

import SearchSelect, { type SearchSelectOption } from "@/components/shared/SearchSelect";
import { useTranslation } from "@/lib/i18n";

import type { ContactOption } from "./types";

type ContactSelectProps = {
    value: ContactOption | null;
    options: ContactOption[];
    recentTrcoKeys: string[];
    onChange: (next: ContactOption) => void;
    onClear?: () => void;
    alwaysEditable?: boolean;
    matchTriggerWidth?: boolean;
};

/** Display label — "handTrcoKey - name" (e.g. "00501 - ABC Co."). Mirrors
 *  legacy `fnsh_0200_001` which writes `RCV_PAY_TRCO_KEY` + `RCV_PAY_TRCO_NM`
 *  together so the cell stays stable when the master contact is renamed. */
const labelOf = (o: ContactOption) => `${o.handTrcoKey} - ${o.name}`;

/**
 * Contact picker — a thin adapter over the shared {@link SearchSelect}.
 * Maps {@link ContactOption} → `{ id, label }` ("handTrcoKey - name") and
 * supplies the "Contact Name" section title + RECENT list.
 */
export default function ContactSelect({
    value,
    options,
    recentTrcoKeys,
    onChange,
    onClear,
    alwaysEditable = false,
    matchTriggerWidth = false,
}: ContactSelectProps) {
    const { t } = useTranslation();

    const byId = useMemo(() => {
        const m = new Map<string, ContactOption>();
        for (const o of options) m.set(o.trcoKey, o);
        return m;
    }, [options]);

    const items: SearchSelectOption[] = useMemo(
        () => options.map((o) => ({ id: o.trcoKey, label: labelOf(o) })),
        [options],
    );

    return (
        <SearchSelect
            value={value ? { id: value.trcoKey, label: labelOf(value) } : null}
            options={items}
            recentIds={recentTrcoKeys}
            sectionTitle={t("txn_history.col.contact_name")}
            recentTitle={t("txn_history.contact.recent")}
            ariaLabel={t("txn_history.col.select_contact")}
            clearAriaLabel={t("txn_history.contact.clear")}
            placeholder={t("txn_history.contact.placeholder")}
            onChange={(sel) => {
                const opt = byId.get(sel.id);
                if (opt) onChange(opt);
            }}
            onClear={onClear}
            alwaysEditable={alwaysEditable}
            matchTriggerWidth={matchTriggerWidth}
        />
    );
}

"use client";

import { useMemo } from "react";

import SearchSelect, { type SearchSelectOption } from "@/components/shared/SearchSelect";
import { useTranslation } from "@/lib/i18n";

import type { VasAccountOption } from "./types";

type VasAccountSelectProps = {
    value: VasAccountOption | null;
    options: VasAccountOption[];
    recentVasAcctCds: string[];
    onChange: (next: VasAccountOption) => void;
    onClear?: () => void;
    alwaysEditable?: boolean;
    matchTriggerWidth?: boolean;
};

/** Display label — "code - name" (e.g. "2113445 - ppp"). */
const labelOf = (o: VasAccountOption) => `${o.vasAcctCd} - ${o.name}`;

/**
 * VAS Account picker — a thin adapter over the shared {@link SearchSelect}.
 * Maps {@link VasAccountOption} → `{ id, label }` ("code - name") and
 * supplies the "VAS Account" section title + RECENT list.
 */
export default function VasAccountSelect({
    value,
    options,
    recentVasAcctCds,
    onChange,
    onClear,
    alwaysEditable = false,
    matchTriggerWidth = false,
}: VasAccountSelectProps) {
    const { t } = useTranslation();

    const byId = useMemo(() => {
        const m = new Map<string, VasAccountOption>();
        for (const o of options) m.set(o.vasAcctCd, o);
        return m;
    }, [options]);

    const items: SearchSelectOption[] = useMemo(
        () => options.map((o) => ({ id: o.vasAcctCd, label: labelOf(o) })),
        [options],
    );

    return (
        <SearchSelect
            value={value ? { id: value.vasAcctCd, label: labelOf(value) } : null}
            options={items}
            recentIds={recentVasAcctCds}
            sectionTitle={t("txn_history.col.vas_account")}
            recentTitle={t("txn_history.vas_account.recent")}
            ariaLabel={t("txn_history.col.select_vas_account")}
            clearAriaLabel={t("txn_history.vas_account.clear")}
            placeholder={t("txn_history.vas_account.placeholder")}
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
